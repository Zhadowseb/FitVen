-- The admin guard could not name the role it was checking.
--
-- Run after 20260921220000_dev-dashboard.sql.
--
-- That file is applied, so this is a follow-up rather than an edit to it.
--
-- `private.reject_self_appointed_admin` asked whether the caller was
-- `pg_catalog.current_user`. `current_user` is a reserved keyword, not a
-- function in a schema, so qualifying it makes the parser read it as a column
-- on a table called `pg_catalog` - and the trigger failed with "missing
-- FROM-clause entry for table pg_catalog" on every write to the column it
-- guards, including the one that sets the flag in the first place. The guard
-- was written under `set search_path = ''`, where everything else does have to
-- be qualified; this is the one thing that must not be.
--
-- It failed closed, which is the right way round for a guard to be wrong: the
-- flag could not be set by anybody, rather than by everybody.
--
-- The active-user count goes with it. It compared `last_updated`, which is
-- `timestamptz`, against `timezone('utc', now())`, which is a `timestamp` -
-- Postgres casts the plain one using the session's own time zone, so the same
-- query answered differently depending on who asked and from where. `now()`
-- alone is already the right type.

begin;

create or replace function private.reject_self_appointed_admin()
returns trigger
language plpgsql
security definer
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

create or replace function public.admin_active_users(window_days integer default 1)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_admin() then (
      select count(distinct workout.user_id)::integer
      from public.workout_type_instance as workout
      where workout.last_updated >=
        (pg_catalog.now()
          - pg_catalog.make_interval(days => greatest(coalesce(window_days, 1), 1)))
    )
    else null
  end;
$$;

commit;

notify pgrst, 'reload schema';
