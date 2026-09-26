-- The developer overview's numbers: the columns they are counted from, a table
-- for what only the repository knows, and the functions that do the counting.
--
-- Run after 20261001080000_the-admin-guard-runs-as-its-caller.sql, which this
-- depends on: every function here trusts is_admin. Before that,
-- 20260930090000_store-stats-ios-daily.sql. That is the order, not a
-- dependency; the cron job there can be scheduled or not. What this does depend
-- on is already live: private.is_admin() as
-- 20260921230000_the-admin-guard-asks-who-is-asking.sql left it, store_stats
-- and Feedback from 20260921220000_dev-dashboard.sql, and Feedback.status from
-- 20260922090000_a-feedback-message-has-a-status.sql.
--
-- The page this feeds (Dev · Overblik) is for the one account with is_admin,
-- and every number on it is about everybody else. So the rule for the whole
-- file is the one admin_active_users started with: the admin gets counts,
-- never rows. A policy that let the admin select from workout_type_instance
-- would produce the same numbers and hand over every user's training history
-- with them. Each function below checks is_admin in its own body, raises for
-- anybody else, and returns one jsonb object of aggregates - no user id, no
-- name, no row per user.
--
-- All of that is only as admin-only as the flag, and the flag was not
-- guarded from 20260921230000 until
-- 20261001080000_the-admin-guard-runs-as-its-caller.sql, which has to run
-- first: that file makes private.reject_self_appointed_admin security
-- invoker, so the app can no longer set is_admin on itself.
--
-- What it adds:
--
--   * workout_type_instance.started_from - where the workout was started from
--     (program, recent, calendar, empty, other), set by the app when it creates
--     the row. Null for every row from before, and those are not counted. The
--     follower policy on this table is row-based, so a follower who can see
--     the workout can see this too; it says how a workout was created and
--     nothing about the person.
--
--   * profile_private.last_opened_at, last_opened_platform, last_app_version -
--     when the app was last opened, on which platform and in which version,
--     written by the app (src/Sync/AppOpenSync.js) at most once an hour. They
--     sit under the four owner-only policies that table already has, so only
--     the owner can read or write them. The table grant from
--     20260628211540_profile-birthdate.sql is for every column, new ones
--     included, so the owner's writes need nothing granted here, and the
--     is_admin guard is a trigger on that one column that never sees them.
--     One column holds the platform, so somebody who uses both phones counts
--     on the one they opened last.
--
--   * store_stats.crash_rate, anr_rate, measured_at - the share of users who
--     met a crash, and an ANR, over the 28 days up to measured_at, in percent,
--     the way Play Console and App Store Connect report them. Nothing writes
--     them yet; the tile says "Ikke koblet på" until something does.
--
--   * public.dev_metrics - what only the repository knows: release lag per
--     platform, rework, bug debt and commits per feature, written once a day
--     by .github/workflows/dev-metrics.yml with the service role, which is not
--     subject to RLS; and the Supabase usage the admin types in by hand. The
--     admin reads, inserts and updates it; nobody else can do anything with
--     it, and anon has no grant at all.
--
--   * admin_user_totals, admin_training_kpis, admin_started_from,
--     admin_feature_usage, admin_bug_reports and admin_secondary_kpis, with
--     private.duplicate_sync_ids behind S9 - callable by nobody but them. The
--     store health and the release lag need no function: store_stats and
--     dev_metrics are admin-only under their own policies, so the app reads
--     them directly.
--
-- How the numbers are counted, where the design left a choice:
--
--   * Days and weeks are Europe/Copenhagen, and weeks start on Monday.
--   * A workout's day is `date`. The design's
--     coalesce(original_start_time::date, date) cannot be said here: the cloud
--     keeps original_start_time as a time of day - "18:04:11", from the
--     phone's clock - with no date to cast, so `date` is the whole answer.
--   * Runs count exactly like strength, in KPI-1 and KPI-3 alike.
--   * KPI-1 is seven whole days up to yesterday, and the series is twelve of
--     them a week apart. A window that ended today would be missing most of
--     today every morning, and "fell more than 25 %" would go off before
--     lunch. KPI-2 is whole Monday-Sunday weeks. KPI-3 is the fourteen days
--     up to yesterday, as the design says.
--   * KPI-3's sick days are checked after all. The sickness periods
--     (public."Sickness") never reach the cloud, but marking a period sick
--     sets is_sick on every day in it, and "Day".is_sick is a synced field
--     (SYNCED_FIELDS.Day) - so a workout whose day is marked sick is left
--     out. A finished workout only counts as done with original_start_time
--     and a set; a run has no distance up here (the Run rows stay on the
--     phone), so a run or a walk counts when its clock ran.
--   * Active means opened the app in the window (last_opened_at). Until
--     anybody's app has written that, the push tokens stand in - seen when a
--     phone registers its token, and only for people with push on - and the
--     answer says which it used.
--   * A feature's share counts active users only, so it can never pass
--     100 %: somebody who liked a post in the window but is not among the
--     active users is in neither half of the fraction.
--
-- Until this has run, the overview's new tiles read "Ikke koblet på" - the
-- service answers { unavailable: true } for a function, table or column that
-- is not there - and the downloads card, the feedback and everything else on
-- the page are as before. The app copes too: the workout sync leaves
-- started_from out once the cloud says the column is missing
-- (src/Utils/startedFrom.js), so shipping the app first costs the counts and
-- nothing else.
--
-- Three tables are altered here, two of which the app writes all day, and each
-- alter needs its table to itself for a moment. The lock timeout makes a busy
-- moment fail the whole file rather than queue behind it - the lesson of
-- 20260921180000_music-opt-in.sql. If it times out, run it again. Safe to run
-- twice.
--
-- Measured on a copy with 300,000 workouts, 900,000 exercises and 2.7 million
-- sets - fifty times the largest probe in the performance audit of
-- 2026-08-31 - the slowest function answers in about three seconds, inside
-- the eight a request is allowed. Past a million sets, index exercise_instance's
-- cloud_workout_type_instance_id and set's cloud_exercise_instance_id (create
-- index concurrently, a file of its own each): finding which workouts have a
-- set is most of the time, and it is a scan of every set without them.

begin;

set local lock_timeout = '5s';

/* ------------------------------------------------ the store's own health -- */

alter table public.store_stats
  add column if not exists crash_rate numeric,
  add column if not exists anr_rate numeric,
  add column if not exists measured_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'store_stats_crash_rate_is_a_percent'
      and conrelid = 'public.store_stats'::regclass
  ) then
    alter table public.store_stats
      add constraint store_stats_crash_rate_is_a_percent
      check (crash_rate is null or crash_rate between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'store_stats_anr_rate_is_a_percent'
      and conrelid = 'public.store_stats'::regclass
  ) then
    alter table public.store_stats
      add constraint store_stats_anr_rate_is_a_percent
      check (anr_rate is null or anr_rate between 0 and 100);
  end if;
end;
$$;

comment on column public.store_stats.crash_rate is
  'Percent of users who met a crash over the 28 days up to measured_at, as the store reports it. 0.5 means 0.5 %. Nothing writes it yet.';
comment on column public.store_stats.anr_rate is
  'Percent of users who met an ANR over the 28 days up to measured_at (Android only). Nothing writes it yet.';
comment on column public.store_stats.measured_at is
  'When the store measured crash_rate and anr_rate. The row''s day is the day the downloads are for.';

/* ------------------------------------------------------ the app opening -- */

alter table public.profile_private
  add column if not exists last_opened_at timestamptz,
  add column if not exists last_opened_platform text,
  add column if not exists last_app_version text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'profile_private_last_opened_platform_known'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_last_opened_platform_known
      check (last_opened_platform is null or last_opened_platform in ('ios', 'android'));
  end if;

  -- A version string, not an essay. The owner writes this column, and the
  -- admin's list of versions in use is read from it.
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'profile_private_last_app_version_length'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_last_app_version_length
      check (last_app_version is null or char_length(last_app_version) <= 40);
  end if;
end;
$$;

comment on column public.profile_private.last_opened_at is
  'When the app was last opened, written by the app at most once an hour. Private: only its owner reads it; the admin sees how many opened the app, through admin_user_totals, never the row.';
comment on column public.profile_private.last_opened_platform is
  'ios or android: the platform of the open in last_opened_at.';
comment on column public.profile_private.last_app_version is
  'The app version of the open in last_opened_at. Counted per version for the admin (S5), never shown per user.';

/* -------------------------------------------------- where it started from -- */

alter table public.workout_type_instance
  add column if not exists started_from text;

do $$
begin
  -- The same five as STARTED_FROM_VALUES in src/Utils/startedFrom.js. A value
  -- the app sends that this does not accept fails the whole workout upload.
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'workout_type_instance_started_from_known'
      and conrelid = 'public.workout_type_instance'::regclass
  ) then
    alter table public.workout_type_instance
      add constraint workout_type_instance_started_from_known
      check (
        started_from is null
        or started_from in ('program', 'recent', 'calendar', 'empty', 'other')
      );
  end if;
end;
$$;

comment on column public.workout_type_instance.started_from is
  'Where the workout was started from: program, recent, calendar, empty or other. Set by the app when it creates the row; null for rows from before 20261001090000_dev-kpis.sql, which the overview does not count.';

/* ------------------------------------------------------- the dev metrics -- */

create table if not exists public.dev_metrics (
  key text not null,
  platform text not null default 'all',
  value jsonb not null,
  measured_at timestamptz not null default now(),
  constraint dev_metrics_pkey primary key (key, platform),
  constraint dev_metrics_platform_known check (platform in ('all', 'ios', 'android')),
  constraint dev_metrics_key_shape check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  constraint dev_metrics_value_is_an_object check (jsonb_typeof(value) = 'object')
);

comment on table public.dev_metrics is
  'What only the repository knows (release_lag, rework, bug_debt, feature_commits), written daily by the dev-metrics GitHub Action with the service role, and supabase_usage, typed in by the admin. One row per key and platform; platform is ''all'' when the number is not per platform. Admin-only.';

alter table public.dev_metrics enable row level security;

-- The service role is how the Action writes, and it is not subject to RLS.
-- The admin gets select, insert and update through the policies below.
-- Supabase's default privileges hand every new table to anon as well; this
-- takes that back.
revoke all on table public.dev_metrics from anon, authenticated;
grant select, insert, update on table public.dev_metrics to authenticated;
grant select, insert, update, delete on table public.dev_metrics to service_role;

drop policy if exists "Only an admin reads the dev metrics" on public.dev_metrics;
create policy "Only an admin reads the dev metrics"
on public.dev_metrics
for select
to authenticated
using (private.is_admin());

drop policy if exists "Only an admin adds dev metrics" on public.dev_metrics;
create policy "Only an admin adds dev metrics"
on public.dev_metrics
for insert
to authenticated
with check (private.is_admin());

drop policy if exists "Only an admin changes dev metrics" on public.dev_metrics;
create policy "Only an admin changes dev metrics"
on public.dev_metrics
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

/* ------------------------------------------------------------ the users -- */

-- Section 3: downloads and active users per platform.
--
-- Downloads are the stores' first installs. A platform with no store_stats
-- row at all is null - nobody has told us - and one with rows but none in the
-- last seven days is 0, the same distinction buildStoreStats draws.
create or replace function public.admin_user_totals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_today constant date := (pg_catalog.now() at time zone 'Europe/Copenhagen')::date;
  active_since constant timestamptz := pg_catalog.now() - interval '14 days';
  has_app_open boolean;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  has_app_open := exists (
    select 1
    from public.profile_private as private_profile
    where private_profile.last_opened_at is not null
  );

  return (
    with store as (
      select
        stats.platform,
        sum(stats.downloads) as downloads,
        coalesce(sum(stats.downloads) filter (where stats.day > local_today - 7), 0) as last_week
      from public.store_stats as stats
      group by stats.platform
    ),
    active as (
      select private_profile.user_id, private_profile.last_opened_platform as platform
      from public.profile_private as private_profile
      where has_app_open
        and private_profile.last_opened_at >= active_since
      union
      select token.user_id, token.platform
      from public.push_tokens as token
      where not has_app_open
        and token.enabled
        and token.last_seen_at >= active_since
    )
    select jsonb_build_object(
      'downloads', jsonb_build_object(
        'ios', (select store.downloads from store where store.platform = 'ios'),
        'android', (select store.downloads from store where store.platform = 'android'),
        'total', (select sum(store.downloads) from store),
        'last_week', jsonb_build_object(
          'ios', (select store.last_week from store where store.platform = 'ios'),
          'android', (select store.last_week from store where store.platform = 'android'),
          'total', (select sum(store.last_week) from store)
        )
      ),
      -- Somebody with a token on each platform counts on both and once in
      -- the total.
      'active', jsonb_build_object(
        'ios', (select count(distinct active.user_id) from active where active.platform = 'ios'),
        'android', (select count(distinct active.user_id) from active where active.platform = 'android'),
        'total', (select count(distinct active.user_id) from active),
        'source', case when has_app_open then 'app_open' else 'push_tokens' end,
        'window_days', 14
      ),
      'computed_at', pg_catalog.now()
    )
  );
end;
$$;

/* ------------------------------------------------------------ is it used -- */

-- KPI-1, 2 and 3, each with its series, oldest point first.
--
--   trainers_7d     people with a finished workout in the seven whole days up
--                   to yesterday; `previous` is the seven before those
--   comes_back      of the people who trained in the week before last, how
--                   many trained again last week - whole Monday-Sunday weeks
--   plan_completed  per person, the share of the workouts dated in the
--                   fourteen days up to yesterday that were really done, and
--                   the median of that among people with at least three
--
-- One read of the workouts serves all three, and only the set lookup reads
-- them again: KPI-3's twelve two-week windows reach furthest back, 91 days
-- before today. `days_back` is how many days before yesterday a workout is
-- dated, which puts it in its windows by division rather than by comparing
-- it with each of the twelve.
--
-- work_mem: finding which workouts have a set means holding every candidate
-- exercise in a hash while all the sets stream past. At the default the hash
-- spills to disk, and on the copy described at the top that alone took three
-- of the eight seconds a request is allowed.
create or replace function public.admin_training_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
declare
  local_today constant date := (pg_catalog.now() at time zone 'Europe/Copenhagen')::date;
  this_monday constant date := pg_catalog.date_trunc('week', local_today::timestamp)::date;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  return (
    with workouts as (
      select
        workout.id,
        workout.user_id,
        workout.date::date as day,
        local_today - 1 - workout.date::date as days_back,
        workout.done,
        workout.original_start_time is not null as started,
        lower(coalesce(workout.workout_type, '')) in ('run', 'walk') as is_distance,
        coalesce(workout.elapsed_time, 0) > 0 as clock_ran,
        sick_day.id is not null as on_sick_day
      from public.workout_type_instance as workout
      left join public."Day" as sick_day
        on sick_day.id = workout.cloud_day_id
       and sick_day.user_id = workout.user_id
       and sick_day.is_sick
       and sick_day.deleted_at is null
      where workout.deleted_at is null
        and not workout.is_deleting
        and workout.date::date between local_today - 91 and local_today - 1
    ),
    -- KPI-1. Window `weeks` is days_back 7 * weeks to 7 * weeks + 6.
    trainers as (
      select back.weeks, count(distinct trained.user_id) as value
      from generate_series(0, 11) as back(weeks)
      left join workouts as trained
        on trained.done
       and trained.days_back / 7 = back.weeks
      group by back.weeks
    ),
    -- KPI-2: `back.weeks` = 1 is last week, the latest whole one.
    trained_weeks as (
      select distinct
        workouts.user_id,
        pg_catalog.date_trunc('week', workouts.day::timestamp)::date as week_start
      from workouts
      where workouts.done
        and workouts.day >= this_monday - 63
        and workouts.day < this_monday
    ),
    retention as (
      select
        back.weeks,
        count(week_before.user_id) as trained_before,
        count(this_week.user_id) as came_back
      from generate_series(1, 8) as back(weeks)
      left join trained_weeks as week_before
        on week_before.week_start = this_monday - 7 * back.weeks - 7
      left join trained_weeks as this_week
        on this_week.week_start = this_monday - 7 * back.weeks
       and this_week.user_id = week_before.user_id
      group by back.weeks
    ),
    -- KPI-3. Only the workouts that could count as done need their sets
    -- looked up. They are picked from the table again rather than from
    -- `workouts`: a query that reads a CTE cannot be split across parallel
    -- workers, and this is the one part heavy enough to want them.
    with_sets as (
      select distinct exercise.cloud_workout_type_instance_id as workout_id
      from public.workout_type_instance as candidate
      join public.exercise_instance as exercise
        on exercise.cloud_workout_type_instance_id = candidate.id
      join public."set" as workout_set
        on workout_set.cloud_exercise_instance_id = exercise.id
      where candidate.done
        and candidate.original_start_time is not null
        and candidate.deleted_at is null
        and not candidate.is_deleting
        and lower(coalesce(candidate.workout_type, '')) not in ('run', 'walk')
        and candidate.date::date between local_today - 91 and local_today - 1
        and exercise.deleted_at is null
        and not exercise.is_deleting
        and workout_set.deleted_at is null
        and not workout_set.is_deleting
    ),
    planned as (
      select
        workouts.user_id,
        workouts.days_back,
        workouts.done
          and workouts.started
          and (
            with_sets.workout_id is not null
            or (workouts.is_distance and workouts.clock_ran)
          ) as completed
      from workouts
      left join with_sets on with_sets.workout_id = workouts.id
      where not workouts.on_sick_day
    ),
    -- Window `weeks` is days_back 7 * weeks to 7 * weeks + 13, so a workout
    -- belongs to window days_back / 7 and to the window after it in time,
    -- days_back / 7 - 1.
    plan_per_user as (
      select
        belongs.weeks,
        planned.user_id,
        count(*) as planned_count,
        count(*) filter (where planned.completed) as completed_count
      from planned
      cross join lateral (
        values (planned.days_back / 7), (planned.days_back / 7 - 1)
      ) as belongs(weeks)
      where belongs.weeks between 0 and 11
      group by belongs.weeks, planned.user_id
      having count(*) >= 3
    ),
    plan as (
      select
        back.weeks,
        round(
          (percentile_cont(0.5) within group (
            order by (100.0 * plan_per_user.completed_count / plan_per_user.planned_count)::double precision
          ))::numeric,
          1
        ) as median,
        count(plan_per_user.user_id) as users
      from generate_series(0, 11) as back(weeks)
      left join plan_per_user on plan_per_user.weeks = back.weeks
      group by back.weeks
    )
    select jsonb_build_object(
      'trainers_7d', jsonb_build_object(
        'value', (select trainers.value from trainers where trainers.weeks = 0),
        'previous', (select trainers.value from trainers where trainers.weeks = 1),
        'series', (
          select jsonb_agg(
            jsonb_build_object(
              'week_start', local_today - 7 - 7 * trainers.weeks,
              'value', trainers.value
            )
            order by trainers.weeks desc
          )
          from trainers
        )
      ),
      'comes_back', (
        select jsonb_build_object(
          'both', latest.came_back,
          'last_week', latest.trained_before,
          'percent', case
            when latest.trained_before > 0
              then round(100.0 * latest.came_back / latest.trained_before, 1)
          end,
          'series', (
            select jsonb_agg(
              jsonb_build_object(
                'week_start', this_monday - 7 * retention.weeks,
                'percent', case
                  when retention.trained_before > 0
                    then round(100.0 * retention.came_back / retention.trained_before, 1)
                end,
                'n', retention.trained_before
              )
              order by retention.weeks desc
            )
            from retention
          )
        )
        from retention as latest
        where latest.weeks = 1
      ),
      'plan_completed', (
        select jsonb_build_object(
          'median', latest.median,
          'users', latest.users,
          'series', (
            select jsonb_agg(
              jsonb_build_object(
                'week_start', local_today - 7 - 7 * plan.weeks,
                'median', plan.median,
                'users', plan.users
              )
              order by plan.weeks desc
            )
            from plan
          )
        )
        from plan as latest
        where latest.weeks = 0
      ),
      'computed_at', pg_catalog.now()
    )
  );
end;
$$;

-- "Startet fra": finished workouts in the window by where they were started.
--
-- `available` is false until any row anywhere has started_from. Until then
-- only "program" can be told apart - a workout whose day belongs to a
-- program's week - and the other four are null rather than 0. Once it is
-- true, rows without the column (older app versions) are left out of the
-- total as well as the counts, so the bars add up to the whole.
create or replace function public.admin_started_from(days integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_days constant integer := least(greatest(coalesce(admin_started_from.days, 28), 1), 366);
  local_today constant date := (pg_catalog.now() at time zone 'Europe/Copenhagen')::date;
  has_values boolean;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  has_values := exists (
    select 1
    from public.workout_type_instance as workout
    where workout.started_from is not null
  );

  return (
    with finished as (
      select workout.user_id, workout.cloud_day_id, workout.started_from
      from public.workout_type_instance as workout
      where workout.done
        and workout.deleted_at is null
        and not workout.is_deleting
        and workout.date::date between local_today - window_days + 1 and local_today
    ),
    counted as (
      select
        count(*) as all_finished,
        count(finished.started_from) as known,
        count(*) filter (where finished.started_from = 'program') as program,
        count(*) filter (where finished.started_from = 'recent') as recent,
        count(*) filter (where finished.started_from = 'calendar') as calendar,
        count(*) filter (where finished.started_from = 'empty') as empty,
        count(*) filter (where finished.started_from = 'other') as other,
        count(*) filter (where program_day.cloud_microcycle_id is not null) as in_a_program
      from finished
      left join public."Day" as program_day
        on program_day.id = finished.cloud_day_id
       and program_day.user_id = finished.user_id
    )
    select jsonb_build_object(
      'days', window_days,
      'available', has_values,
      'total', case when has_values then counted.known else counted.all_finished end,
      'counts', case
        when has_values then jsonb_build_object(
          'program', counted.program,
          'recent', counted.recent,
          'calendar', counted.calendar,
          'empty', counted.empty,
          'other', counted.other
        )
        else jsonb_build_object(
          'program', counted.in_a_program,
          'recent', null,
          'calendar', null,
          'empty', null,
          'other', null
        )
      end,
      'computed_at', pg_catalog.now()
    )
    from counted
  );
end;
$$;

-- KPI-4: how many of the active users used each feature in the window, in
-- the design's order, with the commit counts the Action measured beside them.
--
-- What "used" is read from, one table each:
--   run              a finished workout of type Run, dated in the window
--   posts            social_post created
--   likes            social_post_like created
--   follows          user_follows created - a follow made, not one kept
--   gymLifts         gym_lift performed
--   music            workout_music played
--   sickness         a day marked sick ("Day".is_sick), dated in the window
--   customExercises  custom_exercise created or changed - the cloud half,
--                    since 20260928090000; the phone's Exercise.is_custom is
--                    not up here
--   push             a push token that is on and was seen
--
-- `share` is a percentage with one decimal, like comes_back.percent. The
-- commits, first_in_store_at and in_latest_store_tag come from
-- dev_metrics.feature_commits and are null until the Action has written it.
create or replace function public.admin_feature_usage(days integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_days constant integer := least(greatest(coalesce(admin_feature_usage.days, 28), 1), 366);
  since constant timestamptz := pg_catalog.now() - window_days * interval '1 day';
  local_today constant date := (pg_catalog.now() at time zone 'Europe/Copenhagen')::date;
  first_day constant date := local_today - window_days + 1;
  has_app_open boolean;
  commits jsonb;
  commits_measured_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  has_app_open := exists (
    select 1
    from public.profile_private as private_profile
    where private_profile.last_opened_at is not null
  );

  select metric.value, metric.measured_at
  into commits, commits_measured_at
  from public.dev_metrics as metric
  where metric.key = 'feature_commits'
    and metric.platform = 'all';

  return (
    with active as (
      select private_profile.user_id
      from public.profile_private as private_profile
      where has_app_open
        and private_profile.last_opened_at >= since
      union
      select token.user_id
      from public.push_tokens as token
      where not has_app_open
        and token.enabled
        and token.last_seen_at >= since
    ),
    used as (
      select 'run' as feature, workout.user_id
      from public.workout_type_instance as workout
      where workout.done
        and workout.deleted_at is null
        and not workout.is_deleting
        and lower(workout.workout_type) = 'run'
        and workout.date::date between first_day and local_today
      union
      select 'posts', post.author_id
      from public.social_post as post
      where post.created_at >= since
      union
      select 'likes', post_like.user_id
      from public.social_post_like as post_like
      where post_like.created_at >= since
      union
      select 'follows', follow.follower_id
      from public.user_follows as follow
      where follow.created_at >= since
      union
      select 'gymLifts', lift.user_id
      from public.gym_lift as lift
      where lift.performed_at >= since
      union
      select 'music', music.user_id
      from public.workout_music as music
      where music.played_at >= since
      union
      select 'sickness', sick_day.user_id
      from public."Day" as sick_day
      where sick_day.is_sick
        and sick_day.deleted_at is null
        and not sick_day.is_deleting
        and sick_day.date::date between first_day and local_today
      union
      select 'customExercises', exercise.user_id
      from public.custom_exercise as exercise
      where exercise.created_at >= since
         or exercise.updated_at >= since
      union
      select 'push', token.user_id
      from public.push_tokens as token
      where token.enabled
        and token.last_seen_at >= since
    ),
    features (feature_key, sort_order) as (
      values
        ('run', 1),
        ('posts', 2),
        ('likes', 3),
        ('follows', 4),
        ('gymLifts', 5),
        ('music', 6),
        ('sickness', 7),
        ('customExercises', 8),
        ('push', 9)
    ),
    counted as (
      select features.feature_key, features.sort_order, count(distinct active.user_id) as users
      from features
      left join used on used.feature = features.feature_key
      left join active on active.user_id = used.user_id
      group by features.feature_key, features.sort_order
    ),
    total as (
      select count(*) as active_users from active
    )
    select jsonb_build_object(
      'days', window_days,
      'active_users', total.active_users,
      'source', case when has_app_open then 'app_open' else 'push_tokens' end,
      'features', (
        select jsonb_agg(
          jsonb_build_object(
            'key', counted.feature_key,
            'users', counted.users,
            'share', case
              when total.active_users > 0
                then round(100.0 * counted.users / total.active_users, 1)
            end,
            'commits', commits -> 'features' -> counted.feature_key -> 'commits',
            'first_in_store_at', commits -> 'features' -> counted.feature_key -> 'firstInStoreAt',
            'in_latest_store_tag', commits -> 'features' -> counted.feature_key -> 'inLatestStoreTag'
          )
          order by counted.sort_order
        )
        from counted
      ),
      'commits_since', commits -> 'since',
      'measured_at', commits_measured_at,
      'computed_at', pg_catalog.now()
    )
    from total
  );
end;
$$;

/* ------------------------------------------------------- does it work -- */

-- KPI-5b: bug reports in the window per app version. The version is read the
-- way the app writes it ("v2.13.0 | build 24") and kept as "2.13.0": two
-- builds of one version are one version. A report from a signed-out form has
-- no user and counts in `count`, not in `users`. `oldest_new_days` is the age
-- of the oldest bug still `new`, whenever it came in.
create or replace function public.admin_bug_reports(days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_days constant integer := least(greatest(coalesce(admin_bug_reports.days, 7), 1), 366);
  since constant timestamptz := pg_catalog.now() - window_days * interval '1 day';
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  return (
    with bugs as (
      select
        feedback.user_id,
        nullif(
          btrim(
            regexp_replace(
              split_part(coalesce(feedback.app_version, ''), '|', 1),
              '^[[:space:]]*[vV]',
              ''
            )
          ),
          ''
        ) as version
      from public."Feedback" as feedback
      where feedback.kind = 'bug'
        and feedback.created_at >= since
    ),
    by_version as (
      select bugs.version, count(*) as reports, count(distinct bugs.user_id) as users
      from bugs
      group by bugs.version
    )
    select jsonb_build_object(
      'days', window_days,
      'total', (select count(*) from bugs),
      'users', (select count(distinct bugs.user_id) from bugs),
      'by_version', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'version', by_version.version,
              'count', by_version.reports,
              'users', by_version.users
            )
            order by by_version.reports desc, by_version.users desc, by_version.version desc nulls last
          )
          from by_version
        ),
        '[]'::jsonb
      ),
      'oldest_new_days', (
        select round((extract(epoch from pg_catalog.now() - min(feedback.created_at)) / 86400)::numeric, 1)
        from public."Feedback" as feedback
        where feedback.kind = 'bug'
          and feedback.status = 'new'
      ),
      'computed_at', pg_catalog.now()
    )
  );
end;
$$;

/* ------------------------------------------------- when a number moves -- */

-- S9's duplicates in one synced table: every sync id carried by more than one
-- live row of the same person, where one of those rows changed since
-- `touched_since`. One row out per duplicate: its newest change.
--
-- Starting from the rows changed recently is what makes this affordable. The
-- old copy of a new duplicate is found by probing for its key, not by
-- grouping every row the table has ever held - on the set table that grouping
-- alone ran past the eight seconds a request is allowed.
--
-- Only admin_secondary_kpis calls it, with a fixed list of the seven synced
-- tables, and it runs with that function's rights. Nobody else may call it.
create or replace function private.duplicate_sync_ids(target regclass, touched_since timestamptz)
returns table (newest timestamptz)
language plpgsql
stable
set search_path = ''
as $$
begin
  return query execute pg_catalog.format(
    'select max(synced.last_updated)
     from %1$s as synced
     where synced.deleted_at is null
       and not synced.is_deleting
       and (synced.user_id, synced.sync_id) in (
         select touched.user_id, touched.sync_id
         from %1$s as touched
         where touched.last_updated >= $1
           and touched.sync_id is not null
           and touched.deleted_at is null
           and not touched.is_deleting
       )
     group by synced.user_id, synced.sync_id
     having count(*) > 1',
    target
  )
  using touched_since;
end;
$$;

revoke all on function private.duplicate_sync_ids(regclass, timestamptz)
  from public, anon, authenticated, service_role;

-- The folding sections. S1, S8 and S10 are what dev_metrics holds; S3 needs
-- the phones to report failed outbox rows, which nothing does yet, so it is
-- null.
--
--   s2   workouts dated in the last seven days that were started, and of
--        those the unfinished ones nobody has touched in twelve hours. The
--        row's own last_updated says that: the start itself is a time of day
--        with no date, and cannot say how old a workout is.
--   s4   the median days from a message arriving to its status changing, over
--        the decisions of the last 28 days; `over_seven_days` counts the
--        messages of any kind still `new` after a week.
--   s5   active users (opened the app in 14 days) per app version, read the
--        way the bug reports are: the app writes "v2.13.0 | build 24", and
--        that is 2.13.0. Null until any app has written the column.
--   s6   accounts created in the last seven days, and of those the ones with
--        a finished workout within their first seven days.
--   s9   over the last 28 days: finished strength workouts with no set, and
--        sync ids that more than one live row of the same table and person
--        carries, one of them changed in the window (see
--        private.duplicate_sync_ids). `week_ago` is the same pair for the 28
--        days that ended a week ago, so a rise can be told from a count that
--        is merely above zero. The window is what makes the number worth
--        watching - over all history one empty workout from March would keep
--        it above zero for good - and what keeps it inside the eight seconds a
--        request has. A workout changed in the last hour is left out: its sets
--        may be on their way up in the same sync.
create or replace function public.admin_secondary_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
declare
  local_today constant date := (pg_catalog.now() at time zone 'Europe/Copenhagen')::date;
  active_since constant timestamptz := pg_catalog.now() - interval '14 days';
  week_ago constant timestamptz := pg_catalog.now() - interval '7 days';
  window_start constant timestamptz := pg_catalog.now() - interval '28 days';
  week_ago_window_start constant timestamptz := pg_catalog.now() - interval '35 days';
begin
  if not private.is_admin() then
    raise exception 'Only an admin can read the developer overview.'
      using errcode = '42501';
  end if;

  return (
    with started as (
      select workout.done, workout.last_updated
      from public.workout_type_instance as workout
      where workout.original_start_time is not null
        and workout.deleted_at is null
        and not workout.is_deleting
        and workout.date::date between local_today - 6 and local_today
    ),
    triaged as (
      select
        greatest(extract(epoch from feedback.status_changed_at - feedback.created_at), 0) / 86400 as waited_days
      from public."Feedback" as feedback
      where feedback.status <> 'new'
        and feedback.status_changed_at >= pg_catalog.now() - interval '28 days'
    ),
    versions as (
      select
        nullif(
          btrim(
            regexp_replace(
              split_part(private_profile.last_app_version, '|', 1),
              '^[[:space:]]*[vV]',
              ''
            )
          ),
          ''
        ) as version,
        count(*) as users
      from public.profile_private as private_profile
      where private_profile.last_app_version is not null
        and private_profile.last_opened_at >= active_since
      group by 1
    ),
    new_accounts as (
      select
        profile.id,
        exists (
          select 1
          from public.workout_type_instance as workout
          where workout.user_id = profile.id
            and workout.done
            and workout.deleted_at is null
            and not workout.is_deleting
            and workout.date::date
              between (profile.created_at at time zone 'Europe/Copenhagen')::date
                  and (profile.created_at at time zone 'Europe/Copenhagen')::date + 6
        ) as trained
      from public.profiles as profile
      where profile.created_at >= week_ago
    ),
    strength as (
      select workout.id, workout.date::date as day
      from public.workout_type_instance as workout
      where workout.done
        and workout.deleted_at is null
        and not workout.is_deleting
        and workout.workout_type in ('Resistance', 'StrengthTraining', 'Upperbody', 'Legs')
        and workout.date::date between local_today - 34 and local_today
        and workout.last_updated < pg_catalog.now() - interval '1 hour'
    ),
    -- The same workouts again, from the table rather than from `strength`, so
    -- the scan of the sets can be split across parallel workers.
    strength_with_sets as (
      select distinct exercise.cloud_workout_type_instance_id as workout_id
      from public.workout_type_instance as candidate
      join public.exercise_instance as exercise
        on exercise.cloud_workout_type_instance_id = candidate.id
      join public."set" as workout_set
        on workout_set.cloud_exercise_instance_id = exercise.id
      where candidate.done
        and candidate.deleted_at is null
        and not candidate.is_deleting
        and candidate.workout_type in ('Resistance', 'StrengthTraining', 'Upperbody', 'Legs')
        and candidate.date::date between local_today - 34 and local_today
        and exercise.deleted_at is null
        and not exercise.is_deleting
        and workout_set.deleted_at is null
        and not workout_set.is_deleting
    ),
    empty_strength as (
      select strength.day
      from strength
      left join strength_with_sets on strength_with_sets.workout_id = strength.id
      where strength_with_sets.workout_id is null
    ),
    duplicates as (
      select found.newest
      from unnest(array[
        'public."Program"',
        'public."Mesocycle"',
        'public."Microcycle"',
        'public."Day"',
        'public.workout_type_instance',
        'public.exercise_instance',
        'public."set"'
      ]::regclass[]) as synced(table_name)
      cross join lateral private.duplicate_sync_ids(synced.table_name, week_ago_window_start) as found
    ),
    metrics as (
      select metric.key, metric.value, metric.measured_at
      from public.dev_metrics as metric
      where metric.platform = 'all'
        and metric.key in ('rework', 'bug_debt', 'supabase_usage')
    )
    select jsonb_build_object(
      's1', (
        select jsonb_build_object('value', metrics.value, 'measured_at', metrics.measured_at)
        from metrics
        where metrics.key = 'rework'
      ),
      's2', (
        select jsonb_build_object(
          'stale', count(*) filter (
            where not started.done
              and started.last_updated < pg_catalog.now() - interval '12 hours'
          ),
          'started', count(*)
        )
        from started
      ),
      's3', null,
      's4', jsonb_build_object(
        'median_days', (
          select round((percentile_cont(0.5) within group (order by triaged.waited_days::double precision))::numeric, 1)
          from triaged
        ),
        'total', (select count(*) from triaged),
        'over_seven_days', (
          select count(*)
          from public."Feedback" as feedback
          where feedback.status = 'new'
            and feedback.created_at < week_ago
        )
      ),
      's5', case
        when exists (
          select 1
          from public.profile_private as private_profile
          where private_profile.last_app_version is not null
        )
          then jsonb_build_object(
            'versions', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('version', versions.version, 'users', versions.users)
                  order by versions.users desc, versions.version desc nulls last
                )
                from versions
              ),
              '[]'::jsonb
            )
          )
      end,
      's6', (
        select jsonb_build_object(
          'new_accounts', count(*),
          'trained_within_7d', count(*) filter (where new_accounts.trained)
        )
        from new_accounts
      ),
      's8', (
        select jsonb_build_object('value', metrics.value, 'measured_at', metrics.measured_at)
        from metrics
        where metrics.key = 'bug_debt'
      ),
      's9', jsonb_build_object(
        'strength_without_sets', (
          select count(*) from empty_strength where empty_strength.day >= local_today - 27
        ),
        'duplicate_sync_ids', (
          select count(*) from duplicates where duplicates.newest >= window_start
        ),
        'week_ago', jsonb_build_object(
          'strength_without_sets', (
            select count(*) from empty_strength where empty_strength.day <= local_today - 7
          ),
          'duplicate_sync_ids', (
            select count(*) from duplicates where duplicates.newest < week_ago
          )
        )
      ),
      's10', (
        select jsonb_build_object('value', metrics.value, 'measured_at', metrics.measured_at)
        from metrics
        where metrics.key = 'supabase_usage'
      ),
      'computed_at', pg_catalog.now()
    )
  );
end;
$$;

/* ------------------------------------------------------------ the grants -- */

-- Signed-in accounts only, and inside each body only the admin gets further
-- than the first line. Supabase's default privileges give a new function in
-- public to anon and the service role as well; this takes both back.
revoke all on function public.admin_user_totals() from public, anon, service_role;
revoke all on function public.admin_training_kpis() from public, anon, service_role;
revoke all on function public.admin_started_from(integer) from public, anon, service_role;
revoke all on function public.admin_feature_usage(integer) from public, anon, service_role;
revoke all on function public.admin_bug_reports(integer) from public, anon, service_role;
revoke all on function public.admin_secondary_kpis() from public, anon, service_role;

grant execute on function public.admin_user_totals() to authenticated;
grant execute on function public.admin_training_kpis() to authenticated;
grant execute on function public.admin_started_from(integer) to authenticated;
grant execute on function public.admin_feature_usage(integer) to authenticated;
grant execute on function public.admin_bug_reports(integer) to authenticated;
grant execute on function public.admin_secondary_kpis() to authenticated;

commit;

notify pgrst, 'reload schema';

-- Check afterwards. Every query here only reads.
--
-- The guard runs as the caller now - false - and the flag is held by the one
-- account it was given to. Anything else in the second list set it itself
-- while the guard was open:
--
--   select prosecdef from pg_proc where oid = 'private.reject_self_appointed_admin'::regproc;
--   select user_id from public.profile_private where is_admin;
--
-- The seven columns, one row each:
--
--   select table_name, column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and (table_name, column_name) in (
--       ('workout_type_instance', 'started_from'),
--       ('profile_private', 'last_opened_at'),
--       ('profile_private', 'last_opened_platform'),
--       ('profile_private', 'last_app_version'),
--       ('store_stats', 'crash_rate'),
--       ('store_stats', 'anr_rate'),
--       ('store_stats', 'measured_at'))
--   order by table_name, column_name;
--
-- The owner can still write their own three new fields - true, true, true:
--
--   select has_column_privilege('authenticated', 'public.profile_private', 'last_opened_at', 'UPDATE'),
--          has_column_privilege('authenticated', 'public.profile_private', 'last_opened_platform', 'INSERT'),
--          has_column_privilege('authenticated', 'public.profile_private', 'last_app_version', 'UPDATE');
--
-- dev_metrics: RLS on, three policies, and nothing for anon - true, 3, false:
--
--   select (select relrowsecurity from pg_class where oid = 'public.dev_metrics'::regclass),
--          (select count(*) from pg_policies where schemaname = 'public' and tablename = 'dev_metrics'),
--          has_table_privilege('anon', 'public.dev_metrics', 'SELECT');
--
-- The six functions: security definer, callable by authenticated, not by anon:
--
--   select p.proname, p.prosecdef,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon
--   from pg_proc as p
--   join pg_namespace as n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('admin_user_totals', 'admin_training_kpis', 'admin_started_from',
--                       'admin_feature_usage', 'admin_bug_reports', 'admin_secondary_kpis')
--   order by p.proname;
--
-- The guard. The SQL editor is nobody in particular, so this has to fail with
-- "Only an admin can read the developer overview.":
--
--   select public.admin_user_totals();
--
-- And the numbers as the admin. set_config changes this session's settings
-- only and writes nothing:
--
--   select set_config('request.jwt.claims', json_build_object('sub', '<admin user id>')::text, false);
--   select public.admin_user_totals();
--   select public.admin_training_kpis();
--   select public.admin_secondary_kpis();
