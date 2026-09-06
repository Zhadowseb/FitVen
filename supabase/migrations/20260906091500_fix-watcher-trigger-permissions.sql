-- Fixes a break introduced by 20260905190000_rpc-hardening.sql.
--
-- Run after 20260905190000_rpc-hardening.sql.
--
-- That migration moved the sync watcher functions out of public, to take them
-- off PostgREST's surface, and left them as security invoker with this
-- reasoning: the user id comes from the row being written, the watcher table's
-- own policy already forces that to equal auth.uid(), so definer would grant
-- reach for no gain.
--
-- The reasoning was about the wrong thing. Security invoker means the function
-- body runs as the caller, and `authenticated` has no USAGE on schema private -
-- that is the entire point of the schema. So every insert, update and delete on
-- public.sync_local_watchers began failing with
--
--   42501: permission denied for schema private
--
-- which is on the path of ordinary workout sync. Nothing was exposed by it and
-- nothing was lost; syncing simply stopped from the moment that migration ran.
--
-- Security definer is the fix, and it is safe here for the reason the original
-- comment gave: target_user_id arrives from a row that the watcher table's
-- INSERT policy has already pinned to auth.uid(), so the updates below cannot
-- reach another user's rows. search_path is pinned and every name is qualified.

create or replace function private.refresh_sync_local_watchers_count(
  target_user_id uuid,
  target_entity_table text,
  target_entity_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  watcher_count integer;
begin
  select count(*)::integer
    into watcher_count
  from public.sync_local_watchers
  where user_id = target_user_id
    and entity_table = target_entity_table
    and entity_id = target_entity_id;

  case target_entity_table
    when 'Program' then
      update public."Program"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Mesocycle' then
      update public."Mesocycle"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Microcycle' then
      update public."Microcycle"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Day' then
      update public."Day"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'workout_type_instance' then
      update public.workout_type_instance
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'exercise_instance' then
      update public.exercise_instance
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'set' then
      update public."set"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
  end case;
end;
$function$;

create or replace function private.sync_local_watchers_refresh_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_sync_local_watchers_count(
      new.user_id,
      new.entity_table,
      new.entity_id
    );
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    perform private.refresh_sync_local_watchers_count(
      old.user_id,
      old.entity_table,
      old.entity_id
    );
  end if;

  return null;
end;
$function$;

-- Recreated so the trigger is certainly bound to the definer version, whatever
-- state the project was left in.
drop trigger if exists sync_local_watchers_refresh_count on public.sync_local_watchers;
create trigger sync_local_watchers_refresh_count
after insert or update or delete on public.sync_local_watchers
for each row execute function private.sync_local_watchers_refresh_count_trigger();

notify pgrst, 'reload schema';
