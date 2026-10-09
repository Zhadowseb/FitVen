-- A set counts for every rep count below it. Powerlifting's best single in
-- bench press, squat and deadlift is the heaviest weight in any set of one
-- rep or more: 90 kg x 3 is also 90 kg for 1, so it counts as a 90 kg single.
-- The owner's, on 2026-09-30: "Hvis jeg bænker 90x3, så har jeg jo allerede
-- lavet 90x1, og det kan derfor bruges til powerlifting."
--
-- Run after 20261007090000_remove-lift-verification.sql, and that is a
-- dependency: this restates private.category_rows as 20261007090000 leaves
-- it. Run the other way round, 20261007090000 would put the singles-only rule
-- back.
--
-- One function, private.category_rows, restated whole from 20261007090000
-- with one rule changed and nothing else, so a diff between the two shows
-- exactly what moved:
--
--   powerlifting  and logged_set.reps = 1   ->   and logged_set.reps >= 1
--
-- and the comment above it. The rest of the rule is as it was: a set that is
-- done, not failed, a working or AMRAP set (a warm-up and a drop set never
-- count), with a weight above 0, of a finished workout at one of the level's
-- centres. A person's best per lift is still the heaviest such weight, the
-- earliest day it was reached on a tie, and the total the three added up.
-- Consistency, Progress and Calisthenics are character for character the
-- same.
--
-- Security definer, the empty search_path, the two planner settings and the
-- signature are as they were; create or replace keeps the owner and the
-- privileges, and the revoke is restated so the file says who may call it.
-- Nothing that calls it changes.
--
-- What does not change, and why:
--
--   * The centre's, the country's and the strongest lists, the centre
--     overview and a public profile's records rank gym_lift, which holds a
--     person's heaviest set per exercise per centre whatever its reps. 90 kg
--     x 3 is already a 90 kg lift there.
--   * Nothing is written for a rep count a set was not. gym_lift keeps each
--     lift with its own reps, so a centre's new records, Explore's "new
--     records" and "up from" count what they counted before, and the app's
--     personal_record flag stays at the set's own rep count.
--
-- No Edge Function reads any of this, so nothing needs deploying.
--
-- Safe to run twice.

begin;

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
      -- The sets themselves, no estimate. A set counts for every rep count
      -- below it: 90 kg x 3 is a 90 kg single too, so any set of one rep or
      -- more is a single at its weight. The weight is the set's as the cloud
      -- keeps it, decimals and all since 20261003090000.
      --
      select
        lifts.user_id,
        lifts.lift,
        logged_set.weight::numeric as weight_kg,
        lifts.day::timestamp at time zone 'Europe/Copenhagen' as achieved
      from public."set" logged_set
      join lifts
        on lifts.id = logged_set.cloud_exercise_instance_id
       and lifts.user_id = logged_set.user_id
      where logged_set.user_id = any(v_ids)
        and logged_set.deleted_at is null
        and logged_set.is_deleting = false
        and logged_set.reps >= 1
        and logged_set.weight > 0
        and logged_set.done::text in ('true', '1', 't')
        and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
        and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
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
-- The new body is the live one - true, false:
--
--   select pg_get_functiondef('private.category_rows'::regproc) like '%logged_set.reps >= 1%',
--          pg_get_functiondef('private.category_rows'::regproc) like '%logged_set.reps = 1%';
--
-- The function: security definer, its three settings, and callable by
-- nobody in the app - true, {search_path="", enable_nestloop=off,
-- plan_cache_mode=force_custom_plan}, false, false:
--
--   select p.prosecdef, p.proconfig,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'private' and p.proname = 'category_rows';
