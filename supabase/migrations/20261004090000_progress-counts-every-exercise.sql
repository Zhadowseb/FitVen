-- Progress (fremgang) counts every exercise in the catalogue, not only bench
-- press, squat and deadlift, and a week counts towards Consistency's (flid)
-- weeks in a row at two workouts, not three. Both are the owner's, after the
-- first test round.
--
-- Run after 20261001090000_dev-kpis.sql. That is the order, not a
-- dependency. What this does depend on is live: private.category_rows,
-- private.featured_exercises and public."Exercise", from
-- 20260929090000_gym-scope-and-categories.sql and
-- 20260917120000_gyms-and-lift-verification.sql.
--
-- One function, private.category_rows, which serves all four categories, and
-- the index its Progress now reads through. The function is restated whole: the body below is the one in 20260929090000 with two
-- parts changed and nothing else, so a diff between the two shows exactly
-- what moved. Security definer, the empty search_path, the two planner
-- settings and the revoke are as they were; create or replace keeps the
-- owner and the privileges, and the revoke is restated so the file says who
-- may call it. Nothing that calls it changes: category_ranking and the three
-- public reads pass detail and breakdown through as they come.
--
--   flid       A streak week is a Monday-based week with at least two
--              finished workouts (STREAK_MIN_WORKOUTS in
--              src/Utils/gymCategories.js), counted back from last week, with
--              this week added once it has its two. A streak reached its
--              length on the day its newest week got its second workout. The
--              Train tab's "Din form" already counts two
--              (src/Utils/trainLibrary.js), so the two agree again.
--   fremgang   Every exercise in public."Exercise", matched to a workout's
--              exercise by lower(btrim(name)), as the calisthenics events
--              are. The rules are the same: Brzycki up to 12 reps
--              (PROGRESS_MAX_REPS), the last 30 days against the 30 before
--              (PROGRESS_WINDOW_DAYS), three sets of the exercise in each
--              window (PROGRESS_MIN_SETS). A person's value is their largest
--              rise; two the same go to the one reached first, then the name.
--              A custom exercise does not count. It is not in the catalogue
--              (it lives in custom_exercise), and its name is its owner's own
--              text, which a list would show to strangers.
--
-- What a Progress row says:
--   detail     {lift, exercise_name, before, now, percent}: the exercise as
--              the catalogue writes it, and lift bench | squat | deadlift
--              for the three and null for the rest, so the app can write
--              those three in its own language and an app from before 2.15.2
--              still names them.
--   breakdown  the viewer's only: a list of their five largest rises,
--              largest first, each shaped like detail, and [] without one. It
--              was an object keyed by lift; the app reads both
--              (mapBreakdown in src/Services/categoryLeaderboardService.js).
--   The bench | squat | deadlift tab, which only an app from before 2.15.2
--   still sends, still ranks that one lift.
--
-- How fast. Progress now reads every set the members did in 60 days, not
-- three lifts' worth. Measured on Postgres 17 against the load 20260929090000
-- was measured on - 2,000 lifters, 160,000 workouts, 1.9 million sets - with
-- 17 exercise names in place of 8, 13 of them weighted catalogue exercises,
-- so four times the sets count. The first version of this body - the
-- three-lift query with the catalogue in place of the three - took a
-- country's Progress list from 1.7 s to 5.3 s, and a country's four cards
-- from 4.9 s to 9.5 s, past the 8 s statement timeout. Most of it was joining
-- the sets back onto their windows to find the day a rise was reached; the
-- rest, reading every set the members ever did and joining it against four
-- times the exercises. Two changes bring it back:
--   * the day is taken in the pass that finds the best (windows below);
--   * the exercises are worked out first, as arrays, and their sets found
--     through a new index on "set".cloud_exercise_instance_id. The ids go in
--     as an array, as the members do, because with enable_nestloop off the
--     planner cannot use an index inside a join. The index alone, with the
--     old shape, changed nothing.
-- Old body and new, called in turn on the same load, medians of five: a
-- country's Progress list 2.1 s -> 2.3 s, a region's 1.1 s -> 1.2 s, a
-- centre's 91 ms -> 67 ms; Consistency's streak list for a country 0.48 s ->
-- 0.51 s, with more people on it at two a week. A country's four cards took
-- about 6.3 s either way on that machine, against the 8 s statement timeout,
-- so the next step at that size is still the one 20260929090000 names: a
-- cache of the cards per level.
--
-- Until this has run, Progress counts the three lifts and a streak week
-- needs three workouts, and the app reads that as it does today. Safe to run
-- twice.

begin;

-- "set" is written on every set a phone uploads. A busy moment makes this
-- give up rather than queue in front of the app - the lesson of
-- 20260921180000_music-opt-in.sql. One table, so nothing here can take its
-- locks in the opposite order to the app.
set local lock_timeout = '5s';

/* --------------------------------------------- the sets by their exercise -- */

-- Progress finds the members' sets by the exercise instance they belong to
-- (category_rows below), and nothing indexed "set".cloud_exercise_instance_id.
-- Partial like the sync indexes (20260515150145), because every read of
-- sets asks for is_deleting = false.
--
-- Not concurrently: this file is one transaction. The index takes as long
-- to build as "set" takes to read, and holds writes to "set" for that long -
-- a moment today, 1.0 s at 1.9 million sets. Should "set" be far bigger when
-- this is run, build the index on its own first, as the only statement in
-- the editor, and this line then leaves it alone:
--
--   create index concurrently if not exists set_cloud_exercise_instance_idx
--     on public."set" (cloud_exercise_instance_id) where is_deleting = false;
create index if not exists set_cloud_exercise_instance_idx
  on public."set" (cloud_exercise_instance_id)
  where is_deleting = false;

/* -------------------------------------------------------- category_rows -- */

create or replace function private.category_rows(
  p_viewer uuid,
  p_category text,
  p_level text,
  p_country text,
  p_region text,
  p_gym_id bigint,
  p_gender text,
  p_filters jsonb,
  p_friends_only boolean
)
returns table (
  member_id uuid,
  score numeric,
  achieved_at timestamptz,
  detail jsonb,
  breakdown jsonb,
  centre_id bigint,
  centre_short_name text,
  in_filter boolean
)
language plpgsql
stable
security definer
set search_path = ''
set enable_nestloop = off
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Europe/Copenhagen')::date;
  v_week_start date := date_trunc('week', (now() at time zone 'Europe/Copenhagen')::date::timestamp)::date;
  v_filters jsonb := case when jsonb_typeof(p_filters) = 'object' then p_filters else '{}'::jsonb end;
  v_gender text := case when p_gender in ('men', 'women') then p_gender else 'all' end;
  v_age text;
  v_tab text;
  v_period text;
  v_period_start date;
  v_period_end date;
  v_only_video boolean;
  v_ids uuid[];
  v_centres bigint[];
  v_centre_names text[];
  v_in_filter boolean[];
  v_gyms bigint[];
begin
  if p_category is null or p_category not in ('flid', 'powerlifting', 'fremgang', 'calisthenics') then
    return;
  end if;

  v_age := coalesce(v_filters ->> 'age_group', v_filters ->> 'ageGroup');
  v_age := case
    when p_category <> 'fremgang' and v_age in ('u23', '23-39', '40+') then v_age
    else 'all'
  end;

  select
    coalesce(array_agg(members.member_id), '{}'),
    coalesce(array_agg(members.centre_id), '{}'),
    coalesce(array_agg(members.centre_short_name), '{}'),
    coalesce(array_agg(members.in_filter), '{}')
  into v_ids, v_centres, v_centre_names, v_in_filter
  from private.scope_members(p_viewer, p_level, p_country, p_region, p_gym_id, p_friends_only, v_gender, v_age) members;

  if cardinality(v_ids) = 0 then
    return;
  end if;

  select coalesce(array_agg(scoped.gym_id), '{}')
  into v_gyms
  from private.scope_gyms(p_level, p_country, p_region, p_gym_id) scoped;

  if p_category = 'flid' then
    v_tab := case when v_filters ->> 'tab' = 'streak' then 'streak' else 'workouts' end;
    v_period := case when v_filters ->> 'period' in ('week', 'year') then v_filters ->> 'period' else 'month' end;
    v_period_start := case v_period
      when 'week' then v_week_start
      when 'year' then date_trunc('year', v_today::timestamp)::date
      else date_trunc('month', v_today::timestamp)::date
    end;
    v_period_end := case v_period
      when 'week' then v_week_start + 7
      when 'year' then (date_trunc('year', v_today::timestamp) + interval '1 year')::date
      else (date_trunc('month', v_today::timestamp) + interval '1 month')::date
    end;

    return query
    with members as (
      select *
      from unnest(v_ids, v_centres, v_centre_names, v_in_filter)
        as listed(member_id, centre_id, centre_short_name, in_filter)
    ),
    -- Every finished workout of theirs up to today, of any type, wherever it
    -- was: consistency is the person's own. A finished workout dated in the
    -- future is a data error, not a workout done.
    finished as materialized (
      select workout.user_id, workout.date::date as day
      from public.workout_type_instance workout
      where workout.user_id = any(v_ids)
        and workout.done::text in ('true', '1', 't')
        and workout.deleted_at is null
        and workout.is_deleting = false
        and workout.date::date <= v_today
    ),
    weekly as (
      select
        finished.user_id,
        date_trunc('week', finished.day::timestamp)::date as week_start,
        count(*) as workouts,
        (array_agg(finished.day order by finished.day))[2] as second_day
      from finished
      group by finished.user_id, date_trunc('week', finished.day::timestamp)::date
    ),
    -- Weeks with enough workouts before this one, newest first. A run of
    -- them from last week has weeks_ago 1, 2, 3 ... in step with its place.
    earlier as (
      select
        weekly.user_id,
        weekly.second_day,
        (v_week_start - weekly.week_start) / 7 as weeks_ago,
        row_number() over (partition by weekly.user_id order by weekly.week_start desc) as place
      from weekly
      where weekly.workouts >= 2
        and weekly.week_start < v_week_start
    ),
    streak_run as (
      select
        earlier.user_id,
        count(*)::integer as weeks,
        max(earlier.second_day) filter (where earlier.weeks_ago = 1) as last_week_second
      from earlier
      where earlier.weeks_ago = earlier.place
      group by earlier.user_id
    ),
    this_week as (
      select weekly.user_id, weekly.second_day
      from weekly
      where weekly.week_start = v_week_start
        and weekly.workouts >= 2
    ),
    totals as (
      select
        finished.user_id,
        count(*) filter (where finished.day >= v_period_start and finished.day < v_period_end)::integer as workouts,
        max(finished.day) filter (where finished.day >= v_period_start and finished.day < v_period_end) as period_last,
        max(finished.day) as last_day
      from finished
      group by finished.user_id
    ),
    counted as (
      select
        members.member_id,
        members.centre_id,
        members.centre_short_name,
        members.in_filter,
        coalesce(totals.workouts, 0) as workouts,
        coalesce(streak_run.weeks, 0) + case when this_week.user_id is null then 0 else 1 end as weeks,
        totals.last_day,
        totals.period_last,
        -- The streak reached its length when its newest week got its second
        -- workout.
        coalesce(this_week.second_day, streak_run.last_week_second) as streak_day
      from members
      left join totals on totals.user_id = members.member_id
      left join streak_run on streak_run.user_id = members.member_id
      left join this_week on this_week.user_id = members.member_id
    )
    select
      counted.member_id,
      (case when v_tab = 'streak' then counted.weeks else counted.workouts end)::numeric,
      (case when v_tab = 'streak' then counted.streak_day else counted.period_last end)::timestamp
        at time zone 'Europe/Copenhagen',
      case
        when v_tab = 'streak' then jsonb_build_object(
          'weeks', counted.weeks,
          'last_workout_at', counted.last_day
        )
        else jsonb_build_object(
          'workouts', counted.workouts,
          'weeks', counted.weeks,
          'last_workout_at', counted.last_day
        )
      end,
      null::jsonb,
      counted.centre_id,
      counted.centre_short_name,
      counted.in_filter
    from counted;

  elsif p_category = 'powerlifting' then
    v_only_video := coalesce(v_filters ->> 'only_video', v_filters ->> 'onlyVideo', 'false') in ('true', 't', '1');

    return query
    with members as (
      select *
      from unnest(v_ids, v_centres, v_centre_names, v_in_filter)
        as listed(member_id, centre_id, centre_short_name, in_filter)
    ),
    featured as (
      select
        fe.exercise_id,
        lower(fe.exercise_name) as name_key,
        (array['bench', 'squat', 'deadlift'])[fe.sort_order] as lift
      from private.featured_exercises() fe
    ),
    workouts as materialized (
      select workout.id, workout.user_id, workout.gym_id, workout.date::date as day
      from public.workout_type_instance workout
      where workout.user_id = any(v_ids)
        and workout.gym_id = any(v_gyms)
        and workout.done::text in ('true', '1', 't')
        and workout.deleted_at is null
        and workout.is_deleting = false
    ),
    lifts as materialized (
      select instance.id, workouts.user_id, workouts.gym_id, workouts.day, featured.exercise_id, featured.lift
      from public.exercise_instance instance
      join workouts
        on workouts.id = instance.cloud_workout_type_instance_id
       and workouts.user_id = instance.user_id
      join featured on featured.name_key = lower(btrim(instance.exercise_name))
      where instance.user_id = any(v_ids)
        and instance.deleted_at is null
        and instance.is_deleting = false
    ),
    singles as (
      -- The sets themselves: reps = 1, no estimate. The cloud keeps a set's
      -- weight in whole kilos (field("weight", int()) in
      -- src/Services/cloudSync/cloudSyncFields.js truncates it on upload).
      --
      -- A single is left out when that person's gym_lift row for the
      -- exercise at that centre is a rejected single at or below its
      -- weight. That removes exactly the rejected lift: gym_lift holds the
      -- heaviest set at the centre, so no single there is heavier than the
      -- row, and one at or above its weight is the very lift the video was
      -- voted down for (or the same weight logged twice, which the board
      -- cannot tell apart). Every lighter single was never judged and still
      -- counts, as it does at another centre. The row has to be a single for
      -- this - a rejected 100 x 5 says nothing about a 100 x 1 - and the
      -- row's weight is truncated like the set's, so 102.5 kg on the phone
      -- (102 in the cloud) still meets its own row.
      select
        lifts.user_id,
        lifts.lift,
        logged_set.weight::numeric as weight_kg,
        lifts.day::timestamp at time zone 'Europe/Copenhagen' as achieved
      from public."set" logged_set
      join lifts
        on lifts.id = logged_set.cloud_exercise_instance_id
       and lifts.user_id = logged_set.user_id
      where not v_only_video
        and logged_set.user_id = any(v_ids)
        and logged_set.deleted_at is null
        and logged_set.is_deleting = false
        and logged_set.reps = 1
        and logged_set.weight > 0
        and logged_set.done::text in ('true', '1', 't')
        and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
        and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
        and not exists (
          select 1
          from public.gym_lift judged
          where judged.user_id = lifts.user_id
            and judged.gym_id = lifts.gym_id
            and judged.exercise_id = lifts.exercise_id
            and judged.video_status = 'rejected'
            and judged.reps = 1
            and trunc(judged.weight_kg) <= logged_set.weight
        )
      union all
      -- Only video: the lifts three people who train there approved, and
      -- only the singles among them.
      select
        lift.user_id,
        featured.lift,
        lift.weight_kg::numeric,
        lift.performed_at
      from public.gym_lift lift
      join featured on featured.exercise_id = lift.exercise_id
      where v_only_video
        and lift.user_id = any(v_ids)
        and lift.gym_id = any(v_gyms)
        and lift.video_status = 'verified'
        and lift.reps = 1
        and lift.weight_kg > 0
    ),
    -- One row per weight before the best is picked, as in calisthenics.
    per_weight as (
      select singles.user_id, singles.lift, singles.weight_kg, min(singles.achieved) as achieved
      from singles
      group by singles.user_id, singles.lift, singles.weight_kg
    ),
    best as (
      select distinct on (per_weight.user_id, per_weight.lift)
        per_weight.user_id,
        per_weight.lift,
        per_weight.weight_kg,
        per_weight.achieved
      from per_weight
      order by per_weight.user_id, per_weight.lift, per_weight.weight_kg desc, per_weight.achieved asc
    ),
    totals as (
      select
        best.user_id,
        coalesce(max(best.weight_kg) filter (where best.lift = 'bench'), 0) as bench,
        coalesce(max(best.weight_kg) filter (where best.lift = 'squat'), 0) as squat,
        coalesce(max(best.weight_kg) filter (where best.lift = 'deadlift'), 0) as deadlift,
        -- The total was reached when its last lift was.
        max(best.achieved) as achieved
      from best
      group by best.user_id
    )
    select
      members.member_id,
      coalesce(totals.bench + totals.squat + totals.deadlift, 0)::numeric,
      totals.achieved,
      jsonb_build_object(
        'bench', coalesce(totals.bench, 0),
        'squat', coalesce(totals.squat, 0),
        'deadlift', coalesce(totals.deadlift, 0)
      ),
      null::jsonb,
      members.centre_id,
      members.centre_short_name,
      members.in_filter
    from members
    left join totals on totals.user_id = members.member_id;

  elsif p_category = 'fremgang' then
    v_tab := case when v_filters ->> 'tab' in ('bench', 'squat', 'deadlift') then v_filters ->> 'tab' else 'all' end;

    -- Every catalogue exercise in the members' last 60 days, worked out once
    -- as arrays, like the members: the instance, whose it is, its day and
    -- the exercise. The sets are then found by their instance, through
    -- set_cloud_exercise_instance_idx, rather than by reading every set the
    -- members ever did, which with every exercise and not three made a
    -- country's list half as slow again. A block of its own, so the arrays
    -- belong to this category only.
    declare
      v_lift_ids bigint[];
      v_lift_users uuid[];
      v_lift_days date[];
      v_lift_exercises bigint[];
    begin
      -- Every exercise in the catalogue by the name a workout gives it. One
      -- row a name: the catalogue's names are unique as written, not once
      -- trimmed and lower-cased, so the oldest row wins and its id stands
      -- for the name from here on. A custom exercise is not in the
      -- catalogue and does not count: its name is its owner's own text, and
      -- a list shows it to strangers.
      with catalogue as (
        select distinct on (lower(btrim(exercise.name)))
          exercise.id as exercise_id,
          lower(btrim(exercise.name)) as name_key
        from public."Exercise" exercise
        order by lower(btrim(exercise.name)), exercise.id
      ),
      workouts as materialized (
        select workout.id, workout.user_id, workout.date::date as day
        from public.workout_type_instance workout
        where workout.user_id = any(v_ids)
          and workout.date::date between v_today - 59 and v_today
          and workout.done::text in ('true', '1', 't')
          and workout.deleted_at is null
          and workout.is_deleting = false
      )
      select
        coalesce(array_agg(instance.id), '{}'),
        coalesce(array_agg(workouts.user_id), '{}'),
        coalesce(array_agg(workouts.day), '{}'),
        coalesce(array_agg(catalogue.exercise_id), '{}')
      into v_lift_ids, v_lift_users, v_lift_days, v_lift_exercises
      from public.exercise_instance instance
      join workouts
        on workouts.id = instance.cloud_workout_type_instance_id
       and workouts.user_id = instance.user_id
      join catalogue on catalogue.name_key = lower(btrim(instance.exercise_name))
      where instance.user_id = any(v_ids)
        and instance.deleted_at is null
        and instance.is_deleting = false;

      return query
      with members as (
        select *
        from unnest(v_ids, v_centres, v_centre_names, v_in_filter)
          as listed(member_id, centre_id, centre_short_name, in_filter)
      ),
      -- The catalogue again, with the name a row is written with and which
      -- of the three lifts it is, if any.
      catalogue as materialized (
        select distinct on (lower(btrim(exercise.name)))
          exercise.id as exercise_id,
          lower(btrim(exercise.name)) as name_key,
          btrim(exercise.name) as exercise_name,
          (array['bench', 'squat', 'deadlift'])[fe.sort_order] as lift
        from public."Exercise" exercise
        left join private.featured_exercises() fe on fe.exercise_id = exercise.id
        order by lower(btrim(exercise.name)), exercise.id
      ),
      lifts as (
        select *
        from unnest(v_lift_ids, v_lift_users, v_lift_days, v_lift_exercises)
          as listed(id, user_id, day, exercise_id)
      ),
      -- Their working and AMRAP sets in those exercises, wherever they
      -- trained, as an estimated one-rep max. Brzycki, as
      -- src/Utils/oneRepMaxUtils.js computes it, and only up to 12 reps
      -- (MAX_ESTIMATE_REPS there, PROGRESS_MAX_REPS in gymCategories.js).
      logged as (
        select
          lifts.user_id,
          lifts.exercise_id,
          lifts.day,
          logged_set.weight::numeric / (1.0278 - 0.0278 * logged_set.reps) as e1rm
        from public."set" logged_set
        join lifts
          on lifts.id = logged_set.cloud_exercise_instance_id
         and lifts.user_id = logged_set.user_id
        where logged_set.cloud_exercise_instance_id = any(v_lift_ids)
          and logged_set.user_id = any(v_ids)
          and logged_set.deleted_at is null
          and logged_set.is_deleting = false
          and logged_set.reps between 1 and 12
          and logged_set.weight > 0
          and logged_set.done::text in ('true', '1', 't')
          and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
          and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
      ),
      -- Window A is the last 30 days including today, window B the 30
      -- before (PROGRESS_WINDOW_DAYS). Each needs three sets of the exercise
      -- (PROGRESS_MIN_SETS), so one heavy day after a quiet month is not
      -- +300 %. Window A's best comes with the first day it was lifted, the
      -- day the rise was reached, as one pair: arrays compare element by
      -- element, so the largest pair is the best estimate and, of two the
      -- same, the one most days ago. One pass, where joining the sets back
      -- onto their windows took over half the time with every exercise.
      windows as (
        select
          logged.user_id,
          logged.exercise_id,
          max(array[logged.e1rm, v_today - logged.day]) filter (where logged.day >= v_today - 29) as now_pair,
          count(*) filter (where logged.day >= v_today - 29) as now_sets,
          max(logged.e1rm) filter (where logged.day < v_today - 29) as before_best,
          count(*) filter (where logged.day < v_today - 29) as before_sets
        from logged
        group by logged.user_id, logged.exercise_id
      ),
      qualified as (
        select
          windows.*,
          windows.now_pair[1] as now_best,
          v_today - windows.now_pair[2]::integer as now_day
        from windows
        where windows.now_sets >= 3
          and windows.before_sets >= 3
          and windows.before_best > 0
      ),
      rises as (
        select
          qualified.user_id,
          catalogue.name_key,
          catalogue.exercise_name,
          catalogue.lift,
          round(round(qualified.before_best * 2) / 2, 1) as before_kg,
          round(round(qualified.now_best * 2) / 2, 1) as now_kg,
          round((qualified.now_best - qualified.before_best) / qualified.before_best * 100) as percent,
          qualified.now_day as reached_day
        from qualified
        join catalogue on catalogue.exercise_id = qualified.exercise_id
      ),
      -- A person's value is their largest rise, in whichever exercise it
      -- was. Two the same: the one reached first, as on the list, then the
      -- name, so the pick never changes between two reads. A tab (bench,
      -- squat or deadlift, which only an app from before 2.15.2 still
      -- sends) is that one lift.
      chosen as (
        select distinct on (rises.user_id) rises.*
        from rises
        where v_tab = 'all' or rises.lift = v_tab
        order by rises.user_id, rises.percent desc, rises.reached_day asc, rises.name_key asc
      ),
      -- The viewer's own card: their five largest rises, in the same order.
      mine as (
        select jsonb_agg(
          jsonb_build_object(
            'lift', own.lift,
            'exercise_name', own.exercise_name,
            'before', own.before_kg,
            'now', own.now_kg,
            'percent', own.percent
          )
          order by own.percent desc, own.reached_day asc, own.name_key asc
        ) as parts
        from (
          select rises.*
          from rises
          where rises.user_id = p_viewer
          order by rises.percent desc, rises.reached_day asc, rises.name_key asc
          limit 5
        ) own
      )
      select
        members.member_id,
        chosen.percent,
        chosen.reached_day::timestamp at time zone 'Europe/Copenhagen',
        case
          when chosen.user_id is null then null
          else jsonb_build_object(
            'lift', chosen.lift,
            'exercise_name', chosen.exercise_name,
            'before', chosen.before_kg,
            'now', chosen.now_kg,
            'percent', chosen.percent
          )
        end,
        case
          when members.member_id = p_viewer then coalesce((select mine.parts from mine), '[]'::jsonb)
        end,
        members.centre_id,
        members.centre_short_name,
        members.in_filter
      from members
      left join chosen on chosen.user_id = members.member_id;
    end;

  elsif p_category = 'calisthenics' then
    return query
    with members as (
      select *
      from unnest(v_ids, v_centres, v_centre_names, v_in_filter)
        as listed(member_id, centre_id, centre_short_name, in_filter)
    ),
    events as (
      select lower(btrim(exercise.name)) as name_key, calisthenics.event, calisthenics.factor
      from private.calisthenics_event calisthenics
      join public."Exercise" exercise on exercise.id = calisthenics.exercise_id
    ),
    workouts as materialized (
      select workout.id, workout.user_id, workout.date::date as day
      from public.workout_type_instance workout
      where workout.user_id = any(v_ids)
        and workout.gym_id = any(v_gyms)
        and workout.done::text in ('true', '1', 't')
        and workout.deleted_at is null
        and workout.is_deleting = false
    ),
    moves as materialized (
      select instance.id, workouts.user_id, workouts.day, events.event, events.factor
      from public.exercise_instance instance
      join workouts
        on workouts.id = instance.cloud_workout_type_instance_id
       and workouts.user_id = instance.user_id
      join events on events.name_key = lower(btrim(instance.exercise_name))
      where instance.user_id = any(v_ids)
        and instance.deleted_at is null
        and instance.is_deleting = false
    ),
    logged as (
      select
        moves.user_id,
        moves.event,
        moves.factor,
        logged_set.reps::numeric as reps,
        moves.day
      from public."set" logged_set
      join moves
        on moves.id = logged_set.cloud_exercise_instance_id
       and moves.user_id = logged_set.user_id
      where logged_set.user_id = any(v_ids)
        and logged_set.deleted_at is null
        and logged_set.is_deleting = false
        and logged_set.reps > 0
        and (logged_set.weight is null or logged_set.weight = 0)
        and logged_set.done::text in ('true', '1', 't')
        and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
        and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
    ),
    -- One row per rep count before the best is picked, so the pick sorts a
    -- few rows per person rather than every set they ever did.
    per_reps as (
      select logged.user_id, logged.event, logged.factor, logged.reps, min(logged.day) as day
      from logged
      group by logged.user_id, logged.event, logged.factor, logged.reps
    ),
    best as (
      select distinct on (per_reps.user_id, per_reps.event)
        per_reps.user_id,
        per_reps.event,
        per_reps.reps,
        per_reps.factor,
        per_reps.reps * per_reps.factor as points,
        per_reps.day
      from per_reps
      order by per_reps.user_id, per_reps.event, per_reps.reps * per_reps.factor desc, per_reps.reps desc, per_reps.day asc
    ),
    totals as (
      select
        best.user_id,
        sum(best.points) as points,
        -- The points were reached when the last of the three bests was.
        max(best.day) as day,
        jsonb_object_agg(
          best.event,
          jsonb_build_object('reps', best.reps, 'factor', best.factor, 'points', best.points)
        ) as parts
      from best
      group by best.user_id
    ),
    -- What one rep of an event is worth, for the personal card's empty
    -- fields. Null when the catalogue has no exercise for it.
    factors as (
      select
        max(calisthenics.factor) filter (where calisthenics.event = 'pullups') as pullups,
        max(calisthenics.factor) filter (where calisthenics.event = 'dips') as dips,
        max(calisthenics.factor) filter (where calisthenics.event = 'pushups') as pushups
      from private.calisthenics_event calisthenics
    )
    select
      members.member_id,
      coalesce(totals.points, 0),
      totals.day::timestamp at time zone 'Europe/Copenhagen',
      jsonb_build_object(
        'pullups', coalesce((totals.parts -> 'pullups' ->> 'reps')::numeric, 0),
        'dips', coalesce((totals.parts -> 'dips' ->> 'reps')::numeric, 0),
        'pushups', coalesce((totals.parts -> 'pushups' ->> 'reps')::numeric, 0)
      ),
      case
        when members.member_id = p_viewer then jsonb_build_object(
          'pullups', coalesce(totals.parts -> 'pullups',
            jsonb_build_object('reps', 0, 'factor', (select factors.pullups from factors), 'points', 0)),
          'dips', coalesce(totals.parts -> 'dips',
            jsonb_build_object('reps', 0, 'factor', (select factors.dips from factors), 'points', 0)),
          'pushups', coalesce(totals.parts -> 'pushups',
            jsonb_build_object('reps', 0, 'factor', (select factors.pushups from factors), 'points', 0))
        )
      end,
      members.centre_id,
      members.centre_short_name,
      members.in_filter
    from members
    left join totals on totals.user_id = members.member_id;
  end if;

  return;
end;
$$;

revoke all on function private.category_rows(uuid, text, text, text, text, bigint, text, jsonb, boolean)
  from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Check afterwards, in the SQL editor. All of these only read.
--
-- The function: security definer, its three settings, owned as before, and
-- callable by nobody in the app - true, {search_path="",
-- enable_nestloop=off, plan_cache_mode=force_custom_plan}, false, false:
--
--   select p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'private' and p.proname = 'category_rows';
--
-- The new body is the live one - true, true:
--
--   select pg_get_functiondef('private.category_rows'::regproc) like '%weekly.workouts >= 2%',
--          pg_get_functiondef('private.category_rows'::regproc) like '%v_lift_ids%';
--
-- The indexes on "set". set_cloud_exercise_instance_idx should be there and
-- valid; another index on cloud_exercise_instance_id alone would be a
-- duplicate from before the migrations folder, and one of the two can go:
--
--   select indexrelid::regclass as index, indisvalid, pg_get_indexdef(indexrelid)
--   from pg_index where indrelid = 'public."set"'::regclass order by 1;
--
-- Catalogue names that are one exercise once trimmed and lower-cased. The
-- first name listed is the one a Progress row shows; no rows is the
-- expected answer:
--
--   select lower(btrim(name)) as name_key, string_agg(name, ' | ' order by id) as names
--   from public."Exercise" group by 1 having count(*) > 1;
--
-- And the list as somebody who trained in Denmark. set_config changes this
-- session's settings only and writes nothing. The rows name their exercise,
-- and your own card is a list:
--
--   select set_config('request.jwt.claims', json_build_object('sub', '<user id>')::text, false);
--   select entry -> 'detail' ->> 'exercise_name' as exercise, count(*)
--   from jsonb_array_elements(public.gym_category_leaderboard('fremgang', 'country', 'DK') -> 'rows') entry
--   group by 1 order by 2 desc;
--   select jsonb_typeof(public.gym_category_leaderboard('fremgang', 'country', 'DK') -> 'me' -> 'breakdown');
