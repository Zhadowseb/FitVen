-- The one number a day keeps: a person's steps for each day.
--
-- Run after 20261010090000_more-catalog-exercises.sql.
--
-- The app reads the day's steps from the phone - its health app (Apple Health,
-- Health Connect), its own motion history, or, on Android without a health app,
-- the phone's step sensor - and keeps one row per day on the phone
-- (Daily_Steps). This is where that row goes, so a new phone gets the history
-- back and the days a phone could no longer read are not lost with it.
--
-- `source` says which of them the number came from, best first: health,
-- motion, sensor. A day takes the best source that has a number for it, and a
-- worse source never replaces a better one; between two numbers from the same
-- source the larger one wins (src/Utils/dailyStepLog.js). The app does that
-- before it writes, so the table only holds the result.
--
-- Only the day's steps, never the training the app adds on top: that is
-- computed from the workouts, on the phone.
--
-- Health data, so it follows the same rules as the rest of the account:
--   * only the owner can read or write a row - there is no policy for anyone
--     else, followers included;
--   * a write needs the privacy policy to have been accepted (any version; the
--     app asks for the one it carries before it sends anything);
--   * it is deleted with the account: the delete-account function removes
--     every row with the user's id, and `on delete cascade` does the rest.
--
-- The app reaches the cloud before or after this, either way: until it has
-- run, a phone on this version finds the table missing (42P01 / PGRST205), keeps
-- the days on the phone and tries again at the next start.
--
-- Idempotent: `create table if not exists`, `drop policy if exists`. One
-- transaction with a lock timeout, the lesson of
-- 20260921180000_music-opt-in.sql: a busy moment makes it give up rather than
-- queue behind a live session; run it again.

begin;

set local lock_timeout = '5s';

create table if not exists public.daily_steps (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  day        date        not null,
  steps      integer     not null check (steps >= 0 and steps <= 200000),
  source     text        not null check (source in ('health', 'motion', 'sensor')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, day)
);

comment on table public.daily_steps is
  'A person''s steps for one day, from the best source the phone had for it. Owner only.';

alter table public.daily_steps enable row level security;

revoke all on public.daily_steps from anon, authenticated;
grant select, insert, update, delete on public.daily_steps to authenticated;

drop policy if exists "Users can read their own steps" on public.daily_steps;
create policy "Users can read their own steps"
on public.daily_steps
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can record their own steps" on public.daily_steps;
create policy "Users can record their own steps"
on public.daily_steps
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.profile_private private
    where private.user_id = (select auth.uid())
      and private.privacy_policy_version is not null
  )
);

drop policy if exists "Users can correct their own steps" on public.daily_steps;
create policy "Users can correct their own steps"
on public.daily_steps
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.profile_private private
    where private.user_id = (select auth.uid())
      and private.privacy_policy_version is not null
  )
);

drop policy if exists "Users can delete their own steps" on public.daily_steps;
create policy "Users can delete their own steps"
on public.daily_steps
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
