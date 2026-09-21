-- The dev dashboard: an admin flag, feedback that can be read, and a place to
-- put the store numbers.
--
-- Run after 20260921190000_one-verification-request-per-window.sql.
--
-- Three things here, and the first one is the one to read twice.
--
-- 1. `profile_private.is_admin`. That table already carries an update policy
--    and an insert policy scoped to the row's owner, and neither of them says
--    anything about columns - so adding the flag there hands every signed-in
--    account a way to make itself an admin with one PATCH. The column grants
--    below take `is_admin` out of what `authenticated` may write, and the
--    trigger refuses it a second time in case a later migration re-runs the
--    blanket `grant update on table profile_private` that 20260628211540
--    carries. A hidden button is not access control, and neither is a grant
--    that one careless line restores.
--
-- 2. `public."Feedback"` already exists and the app already writes to it
--    (`src/Services/feedbackService.js`). The messages just could not be read
--    back. This adds the columns the dashboard needs and puts RLS on the table
--    rather than creating a second one beside it, so the feedback already sent
--    shows up on the screen the day it ships.
--
--    The table predates this folder, so its exact shape is not recorded
--    anywhere here. Every statement below is `if not exists` for that reason.
--    If it turns out to date its rows under another name than `created_at`,
--    the rows that exist will all carry the migration's own timestamp and sort
--    together at the top once; new ones are right from the start.
--
-- 3. `store_stats` is written by a server function holding the App Store and
--    Google Play keys, never by the app. `authenticated` gets select and only
--    when admin; nothing else. No key belongs in the bundle.
--
-- Deliberately not here: `os` and `device` on a feedback row. The design
-- document asks the client to fill them from `expo-device`. The published
-- privacy policy does not list them, `feedbackService` removed exactly those
-- fields once already because together they fingerprint a device, and adding
-- a data category would mean raising PRIVACY_POLICY_VERSION and asking every
-- user to accept again. The columns exist so that decision can be revisited
-- without another migration; the client leaves them empty.

begin;

/* ---------------------------------------------------------- the flag ----- */

alter table public.profile_private
  add column if not exists is_admin boolean not null default false;

comment on column public.profile_private.is_admin is
  'Set by hand in the database. Never writable from the app - see the column grants and the guard trigger in 20260921220000_dev-dashboard.sql.';

-- The table grant is for every column; these two take one column back out of
-- it. Without them the update policy on this table - scoped to the row, not to
-- the columns - is enough to make yourself an admin.
revoke insert (is_admin) on table public.profile_private from authenticated;
revoke update (is_admin) on table public.profile_private from authenticated;

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
  if pg_catalog.current_user in ('authenticated', 'anon') then
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

drop trigger if exists reject_self_appointed_admin on public.profile_private;
create trigger reject_self_appointed_admin
before insert or update of is_admin on public.profile_private
for each row
execute function private.reject_self_appointed_admin();

-- A policy expression is evaluated as the querying user - `security definer`
-- governs what the body may read, not who may call it - so this has to be
-- callable by `authenticated` or every policy using it fails with "permission
-- denied for function". 20260921200000 is the bug report for that mistake.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select private_profile.is_admin
      from public.profile_private as private_profile
      where private_profile.user_id = (select auth.uid())
    ),
    false
  );
$$;

grant execute on function private.is_admin() to authenticated;

/* ------------------------------------------------------- the feedback ---- */

-- Creates nothing on a project that has the table; gives a fresh one the shape
-- the app has always written.
create table if not exists public."Feedback" (
  id bigint generated by default as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  message text not null,
  app_version text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public."Feedback"
  add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public."Feedback"
  add column if not exists kind text not null default 'other';
alter table public."Feedback"
  add column if not exists os text;
alter table public."Feedback"
  add column if not exists device text;
alter table public."Feedback"
  add column if not exists read_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'feedback_kind_known'
      and conrelid = 'public."Feedback"'::regclass
  ) then
    alter table public."Feedback"
      add constraint feedback_kind_known
      check (kind in ('bug', 'idea', 'praise', 'other'));
  end if;
end;
$$;

-- Newest first is the only order the list is ever read in.
create index if not exists feedback_created_at_idx
  on public."Feedback" (created_at desc);

alter table public."Feedback" enable row level security;

grant select, insert, update on table public."Feedback" to authenticated;

-- Sending is for everybody; a signed-out form posts a row with no user_id.
drop policy if exists "Anyone signed in can send feedback" on public."Feedback";
create policy "Anyone signed in can send feedback"
on public."Feedback"
for insert
to authenticated
with check (user_id is null or user_id = (select auth.uid()));

-- Reading is not. A feedback message is somebody writing to the developer, not
-- to the other users.
drop policy if exists "Only an admin reads feedback" on public."Feedback";
create policy "Only an admin reads feedback"
on public."Feedback"
for select
to authenticated
using (private.is_admin());

-- The only update the dashboard makes is marking one read.
drop policy if exists "Only an admin marks feedback read" on public."Feedback";
create policy "Only an admin marks feedback read"
on public."Feedback"
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

/* ---------------------------------------------------- the store numbers -- */

create table if not exists public.store_stats (
  day date not null,
  platform text not null,
  downloads integer not null default 0,
  rating numeric(2, 1),
  rating_count integer,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (day, platform),
  constraint store_stats_platform_known check (platform in ('ios', 'android'))
);

create index if not exists store_stats_day_idx on public.store_stats (day desc);

alter table public.store_stats enable row level security;

-- Select only, and only for an admin. The writer is the scheduled function,
-- which holds the service role and is not subject to this.
revoke all on table public.store_stats from authenticated;
grant select on table public.store_stats to authenticated;

drop policy if exists "Only an admin reads the store numbers" on public.store_stats;
create policy "Only an admin reads the store numbers"
on public.store_stats
for select
to authenticated
using (private.is_admin());

/* ------------------------------------------------------- how it is doing -- */

-- Active accounts, counted over `workout_type_instance` because that is the
-- one table every training session touches and every sync writes.
--
-- It is a function rather than a policy on that table for a reason: the number
-- needs one count across everybody, and the only way to get that from a policy
-- would be to let an admin read every user's training rows. The developer
-- wanting a number is not a reason to widen who can read the data behind it.
-- The admin check is inside the body, so the grant below hands out the count
-- and nothing else.
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
        (pg_catalog.timezone('utc', pg_catalog.now())
          - pg_catalog.make_interval(days => greatest(coalesce(window_days, 1), 1)))
    )
    else null
  end;
$$;

revoke all on function public.admin_active_users(integer) from public;
grant execute on function public.admin_active_users(integer) to authenticated;

commit;

notify pgrst, 'reload schema';
