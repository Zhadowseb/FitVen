-- The exercises the most people train regularly, for the top of the exercise
-- library (public.popular_exercises). Not run yet.
--
-- Run after 20261011090000_daily-steps.sql. That is the order, not a
-- dependency: it only reads public.workout_type_instance, public.exercise_instance,
-- public."set" and public."Exercise", all of which are live.
--
-- What "popular" means. An exercise is popular for a person when they do it
-- again and again, not when they tried it once. Over the person's last 90
-- days of finished workouts (the window the centre categories use):
--
--   * it was in at least 3 of their workouts, with at least one set ticked off
--     in it, and
--   * it was in at least 15 % of all their finished workouts in the window.
--
-- Both have to hold: three is what makes a try a habit, and 15 % - about one
-- workout in every seven - is the low bar the owner asked for, so somebody
-- who trains five times a week and does an exercise every other week still
-- counts, and somebody with a hundred workouts who did it three times does
-- not. The same numbers are in src/Utils/exercisePopularity.js
-- (scripts/test-exercise-popularity.js checks that the two agree).
--
-- An exercise's score is the number of people for whom it is popular. A tie
-- goes to the one more people have tried at all, then to the name. Only
-- catalogue exercises are listed: a custom exercise's name is its owner's own
-- text, and a list would show it to strangers. Only the exercise name and two
-- counts leave the database - nobody is named, and nobody can be told apart
-- in them. An exercise popular for fewer than p_min_users people is left out,
-- so a list never says "one person".
--
-- security definer, because it counts everybody's workouts, which no one can
-- read; only signed-in people may call it.

begin;

create or replace function public.popular_exercises(
  p_limit integer default 5,
  p_min_users integer default 2
)
returns table (
  exercise_name text,
  regular_users integer,
  tried_users integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Europe/Copenhagen')::date;
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
  v_min integer := greatest(1, coalesce(p_min_users, 2));
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  with workouts as materialized (
    select workout.id, workout.user_id
    from public.workout_type_instance workout
    where workout.date::date between v_today - 89 and v_today
      and workout.done::text in ('true', '1', 't')
      and workout.deleted_at is null
      and workout.is_deleting = false
  ),
  per_person as (
    select workouts.user_id, count(*)::numeric as total
    from workouts
    group by workouts.user_id
  ),
  catalogue as (
    select distinct on (lower(btrim(exercise.name)))
      lower(btrim(exercise.name)) as name_key,
      exercise.name as name
    from public."Exercise" exercise
    order by lower(btrim(exercise.name)), exercise.id
  ),
  used as (
    select
      workouts.user_id,
      catalogue.name,
      count(distinct workouts.id) as workouts_with
    from public.exercise_instance instance
    join workouts
      on workouts.id = instance.cloud_workout_type_instance_id
     and workouts.user_id = instance.user_id
    join catalogue on catalogue.name_key = lower(btrim(instance.exercise_name))
    where instance.deleted_at is null
      and instance.is_deleting = false
      and exists (
        select 1
        from public."set" logged_set
        where logged_set.cloud_exercise_instance_id = instance.id
          and logged_set.user_id = instance.user_id
          and logged_set.deleted_at is null
          and logged_set.done::text in ('true', '1', 't')
      )
    group by workouts.user_id, catalogue.name
  )
  select
    used.name::text,
    (count(*) filter (
      where used.workouts_with >= 3
        and used.workouts_with / per_person.total >= 0.15
    ))::integer as regular_users,
    count(*)::integer as tried_users
  from used
  join per_person on per_person.user_id = used.user_id
  group by used.name
  having count(*) filter (
    where used.workouts_with >= 3
      and used.workouts_with / per_person.total >= 0.15
  ) >= v_min
  order by regular_users desc, tried_users desc, used.name
  limit v_limit;
end;
$$;

revoke all on function public.popular_exercises(integer, integer) from public, anon;
grant execute on function public.popular_exercises(integer, integer) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Check afterwards, in the SQL editor. Both only read.
--
-- The function exists, runs as its owner and is callable by signed-in people only
-- (true, false, true):
--
--   select p.prosecdef,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'popular_exercises';
--
-- And the list as somebody signed in. set_config changes this session's
-- settings only and writes nothing; min 1 shows the whole top of the list on
-- a small base of lifters:
--
--   select set_config('request.jwt.claims', json_build_object('sub', '<user id>')::text, false);
--   select * from public.popular_exercises(10, 1);
