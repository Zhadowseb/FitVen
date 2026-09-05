-- GDPR art. 17: erasure.
--
-- Run after 20260905143000_user-blocks.sql.
--
-- The tables are discovered rather than listed. A hardcoded list is the same
-- mistake as the sync field lists this project already had: it is right on the
-- day it is written and silently wrong the first time somebody adds a table.
-- "Every column in public that names a user" is a rule that stays true.
--
-- What this does not do: the auth user itself, and the avatar file in storage.
-- Neither is reachable from SQL with the privileges this runs under, so the
-- delete-account Edge Function does those two and calls this for the rest.

create or replace function private.purge_user_data(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  -- Every way a row can name its owner. actor_id and following_id are here on
  -- purpose: a notification about this person sitting in someone else's inbox,
  -- and someone else's follow of them, are both this person's data.
  owner_columns constant text[] := array[
    'user_id',
    'author_id',
    'actor_id',
    'blocker_id',
    'blocked_id',
    'follower_id',
    'following_id',
    'source_user_id'
  ];

  -- Children first, so a foreign key with no cascade does not stop the delete.
  -- Anything not named here lands between these and profiles, and a table that
  -- fails is retried on the next pass, so this list only has to be roughly
  -- right - it is a hint, not a dependency graph.
  child_first constant text[] := array[
    'set',
    'exercise_instance',
    'workout_type_instance',
    'Day',
    'Microcycle',
    'Mesocycle',
    'Program',
    'social_post_like',
    'social_post_hidden_exercise',
    'social_post',
    'notification_inbox',
    'notification_events',
    'push_tokens',
    'workout_start_notification_sources',
    'user_follows',
    'user_blocks'
  ];

  targets record;
  pending text[] := '{}';
  next_pending text[] := '{}';
  entry text;
  target_table text;
  target_column text;
  deleted_count bigint;
  summary jsonb := '{}'::jsonb;
  pass integer;
begin
  if target_user is null then
    raise exception 'purge_user_data needs a user id';
  end if;

  for targets in
    select
      column_row.table_name as owner_table,
      column_row.column_name as owner_column,
      case
        when column_row.table_name = 'profiles' then 900
        when array_position(child_first, column_row.table_name) is not null
          then array_position(child_first, column_row.table_name)
        else 500
      end as delete_rank
    from information_schema.columns as column_row
    join information_schema.tables as table_row
      on table_row.table_schema = column_row.table_schema
     and table_row.table_name = column_row.table_name
    where column_row.table_schema = 'public'
      and table_row.table_type = 'BASE TABLE'
      and (
        column_row.column_name = any(owner_columns)
        or (column_row.table_name = 'profiles' and column_row.column_name = 'id')
      )
    order by delete_rank asc, column_row.table_name asc
  loop
    pending := pending || (targets.owner_table || '.' || targets.owner_column);
  end loop;

  -- Three passes. Each one deletes what it can and keeps what a foreign key
  -- refused, which resolves ordering without this function having to know the
  -- constraint graph. If something still refuses after the third, that is a
  -- cycle or a genuine bug and erasure must not report success.
  for pass in 1..3 loop
    exit when array_length(pending, 1) is null;

    next_pending := '{}';

    foreach entry in array pending loop
      target_table := split_part(entry, '.', 1);
      target_column := split_part(entry, '.', 2);

      begin
        execute format(
          'delete from public.%I where %I = $1',
          target_table,
          target_column
        ) using target_user;

        get diagnostics deleted_count = row_count;

        if deleted_count > 0 then
          summary := jsonb_set(
            summary,
            array[entry],
            to_jsonb(
              coalesce((summary -> entry)::bigint, 0::bigint) + deleted_count
            )
          );
        end if;
      exception
        when others then
          next_pending := next_pending || entry;
      end;
    end loop;

    pending := next_pending;
  end loop;

  if array_length(pending, 1) is not null then
    raise exception
      'Could not erase every row for %; still refusing: %',
      target_user,
      array_to_string(pending, ', ');
  end if;

  return summary;
end;
$function$;

revoke all on function private.purge_user_data(uuid) from public;
revoke all on function private.purge_user_data(uuid) from anon;
revoke all on function private.purge_user_data(uuid) from authenticated;

-- PostgREST only exposes public, so the Edge Function cannot reach the function
-- above directly. This is the doorway, and it is open to the service role and
-- nobody else: a signed-in client calling it gets a permission error, not a
-- deleted account. The Function has already checked the caller's token against
-- the id it passes in.
create or replace function public.purge_user_account(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return private.purge_user_data(target_user);
end;
$function$;

revoke all on function public.purge_user_account(uuid) from public;
revoke all on function public.purge_user_account(uuid) from anon;
revoke all on function public.purge_user_account(uuid) from authenticated;
grant execute on function public.purge_user_account(uuid) to service_role;

notify pgrst, 'reload schema';
