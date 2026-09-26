-- The admin guard never fired: any signed-in account could make itself admin.
--
-- Run after 20260921230000_the-admin-guard-asks-who-is-asking.sql. It replaces
-- the function that file left, and depends on nothing else.
--
-- private.reject_self_appointed_admin refuses a change to
-- profile_private.is_admin when `current_user` is `authenticated` or `anon`.
-- 20260921230000 left it `security definer`, and inside a security definer
-- function `current_user` is the function's owner, never the role PostgREST
-- sets for the request - so the condition was never true and the trigger let
-- every change through.
--
-- The column revokes in 20260921220000_dev-dashboard.sql were meant to be the
-- first line of defence, and they are not one: Postgres ignores a column-level
-- revoke while the role holds the same privilege on the whole table, and
-- 20260628211540_profile-birthdate.sql grants update on the whole table.
-- `has_column_privilege('authenticated', 'public.profile_private',
-- 'is_admin', 'UPDATE')` is true with the revoke in place.
--
-- Together: one PATCH from any signed-in account set its own is_admin, and
-- from then on the admin functions answered it - the Feedback messages with
-- who sent them, the store numbers, the active-user counts. Tried on a copy of
-- the schema, before and after this change.
--
-- The fix is the one word: the function runs as its caller (security
-- invoker). It reads nothing but the row the trigger hands it, so it needs no
-- rights of its own. With it, the same update fails with "is_admin cannot be
-- changed from the app", and the SQL editor and the service role - which are
-- where the flag is meant to be set - set it as before.
--
-- After running it, look at who holds the flag:
--   select user_id, updated_at from public.profile_private where is_admin;
-- Only the developer's own account should come back.
--
-- Until this has run, the hole is open. Safe to run twice.

begin;

create or replace function private.reject_self_appointed_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only end-user connections are refused. PostgREST sets the role to
  -- `authenticated` for a signed-in request and to `anon` otherwise; the
  -- service role and the SQL editor arrive as something else, which is where
  -- the flag is meant to be set from.
  --
  -- `current_user` is deliberately unqualified. It is a keyword the parser
  -- resolves on its own, and naming a schema in front of it is a syntax error
  -- rather than a lookup.
  --
  -- And the function runs as its caller. Under security definer
  -- `current_user` is whoever owns the function, so this condition is never
  -- true - which is how it stood from 20260921230000 until this file.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and coalesce(new.is_admin, false) then
      raise exception 'is_admin cannot be set from the app';
    end if;

    if tg_op = 'UPDATE'
      and coalesce(new.is_admin, false) is distinct from coalesce(old.is_admin, false)
    then
      raise exception 'is_admin cannot be changed from the app';
    end if;
  end if;

  return new;
end;
$$;

commit;
