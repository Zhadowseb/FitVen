-- A friend's tile can show that they set a personal record today.
--
-- Run after 20260923100000_a-set-has-a-type.sql.
--
-- A friend's sets are private: "Followed workout activity is viewable" opens
-- their workouts from yesterday to tomorrow, and nothing below them. The crown
-- on a tile needs one fact out of the sets - how many personal records one of
-- those workouts holds - so this hands out that count and nothing more: not
-- which exercise, not the weight, not the set.
--
-- Security definer because it reads rows the caller cannot. Before it counts
-- anything it asks what the workout policy asks - your own workout, or a
-- followed person's within a day of today - so it says nothing about a
-- workout the caller could not already see. An id the caller may not see
-- simply does not come back.
--
-- `personal_record::text` and friends for the same reason as in
-- 20260923100000: these columns predate the folder and their type is not
-- written down here. Cast to text, a boolean and an integer both compare.
--
-- Until this has run, the app gets "function does not exist", shows no
-- crowns, and nothing else changes. Safe to run twice.

begin;

create or replace function public.workout_record_counts(workout_ids bigint[])
returns table (workout_id bigint, records integer)
language sql
stable
security definer
set search_path = ''
as $$
  select workout.id, count(record_set.id)::integer
  from public.workout_type_instance workout
  join public.exercise_instance exercise
    on exercise.cloud_workout_type_instance_id = workout.id
   and exercise.deleted_at is null
  join public."set" record_set
    on record_set.cloud_exercise_instance_id = exercise.id
   and record_set.deleted_at is null
   and record_set.personal_record::text in ('true', '1', 't')
   and record_set.done::text in ('true', '1', 't')
   and coalesce(record_set.failed::text, 'false') not in ('true', '1', 't')
  where workout.id = any(workout_ids)
    and workout.deleted_at is null
    and coalesce(workout.is_deleting, false) = false
    and (
      workout.user_id = (select auth.uid())
      or (
        workout.date >= current_date - 1
        and workout.date <= current_date + 1
        and exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = (select auth.uid())
            and follow.following_id = workout.user_id
        )
      )
    )
  group by workout.id;
$$;

revoke all on function public.workout_record_counts(bigint[]) from public;
grant execute on function public.workout_record_counts(bigint[]) to authenticated;

commit;
