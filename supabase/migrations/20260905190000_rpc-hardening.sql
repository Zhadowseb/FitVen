-- Two loose ends from the security review, plus one thing the block migration
-- broke on its way past.
--
-- Run after 20260905143000_user-blocks.sql.
--
-- 13. public.refresh_sync_local_watchers_count was a REST endpoint. Anything
--     in public that is not a trigger function is callable over /rest/v1/rpc by
--     any client holding the anon key, and this one took the user id as a
--     parameter and had no search_path. RLS kept it from actually touching
--     another user's rows, so it was a hardening gap rather than a hole - but
--     it is only ever called by a trigger, so the fix is to remove the endpoint
--     rather than to armour it.
--
-- 15. private.handle_new_user put the part of the email address before the @
--     into a public username and display name. For most people that is their
--     real name, published to every user of the app, from a field they entered
--     to sign in with.
--
-- And: the client used to pick a free username tag by reading every profile
-- sharing the base. 20260905143000 stopped profiles answering to strangers, so
-- that read now returns nothing and the client guesses. The database already
-- allocates tags properly, under an advisory lock; this opens that up.

/* ------------------------------------------------ 13. the watcher counter -- */

create or replace function private.refresh_sync_local_watchers_count(
  target_user_id uuid,
  target_entity_table text,
  target_entity_id bigint
)
returns void
language plpgsql
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

-- Still security invoker, deliberately. The user id comes from the row being
-- written, and the write itself already had to pass the watcher table's own
-- policy, which requires it to equal auth.uid(). Making this definer would let
-- it reach rows the caller could not otherwise touch, for no gain.
create or replace function private.sync_local_watchers_refresh_count_trigger()
returns trigger
language plpgsql
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

-- Repointed before the old pair is dropped, so the count is never maintained by
-- a function that no longer exists.
drop trigger if exists sync_local_watchers_refresh_count on public.sync_local_watchers;
create trigger sync_local_watchers_refresh_count
after insert or update or delete on public.sync_local_watchers
for each row
execute function private.sync_local_watchers_refresh_count_trigger();

drop function if exists public.sync_local_watchers_refresh_count_trigger();
drop function if exists public.refresh_sync_local_watchers_count(uuid, text, bigint);

/* --------------------------------------- the username tag the client needs -- */

create or replace function public.claim_username_code(username_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return private.allocate_username_code(
    private.normalize_username_base(username_base)
  );
end;
$function$;

revoke all on function public.claim_username_code(text) from public;
revoke all on function public.claim_username_code(text) from anon;
grant execute on function public.claim_username_code(text) to authenticated;

/* ------------------------------------------- 15. no names out of the email -- */

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username_base text;
  candidate_username_code text;
  chosen_display_name text;
begin
  -- The email is gone from both fallbacks. What is left is what the person
  -- typed on the register screen, and failing that the neutral 'user', which
  -- normalize_username_base already returns for anything unusable. Somebody who
  -- ends up as user#4821 can rename themselves; somebody whose full name was
  -- published cannot take it back.
  requested_username_base := private.normalize_username_base(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username_base', ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'user'
    )
  );
  candidate_username_code := private.allocate_username_code(requested_username_base);
  chosen_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    requested_username_base
  );

  insert into public.profiles (
    id,
    username,
    username_base,
    username_code,
    display_name,
    bio
  )
  values (
    new.id,
    requested_username_base || '#' || candidate_username_code,
    requested_username_base,
    candidate_username_code,
    chosen_display_name,
    ''
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

/* ------------------------------------- names already taken from an email -- */

-- Nothing is rewritten automatically. A display name that happens to match the
-- email is usually also the name the person chose and answers to, and silently
-- renaming live accounts is worse than leaving them. This lists the ones worth
-- looking at by hand:
--
--   select profile.id, profile.username, profile.display_name
--   from public.profiles profile
--   join auth.users account on account.id = profile.id
--   where profile.username_base = private.normalize_username_base(
--           split_part(account.email, '@', 1)
--         )
--      or profile.display_name = split_part(account.email, '@', 1);

notify pgrst, 'reload schema';
