-- When a friend last trained, and when they train next.
--
-- Run after 20260917120000_gyms-and-lift-verification.sql.
--
-- The tiles ask for 180 days back and 60 forward so a tile with nothing today
-- can say "3 days ago" instead of nothing. They asked `workout_type_instance`
-- directly, and the follower policy on that table
-- (20260515150145_side-by-side-sync-migration.sql) only lets a follower see
-- `date >= current_date - 1`. So the answer for anybody but yourself was
-- always empty, every friend fell into the empty band, and the relative-day
-- wording the tiles were built for could not be reached.
--
-- Widening that policy is the wrong fix. It would hand every follower your
-- whole training history to solve a problem that needs two dates. This is a
-- security definer function instead, the same shape as every ranked read in
-- the centre migration: it answers only for people the viewer actually
-- follows, drops anyone blocked either way, and returns two dates per person
-- rather than any rows.

begin;

create or replace function public.friends_surrounding_activity(
  target_ids uuid[],
  past_days integer default 180,
  future_days integer default 60
)
returns table (
  user_id uuid,
  last_workout_at date,
  next_workout_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  visible as (
    select distinct follow.following_id as id
    from public.user_follows follow
    where follow.follower_id = (select id from viewer)
      and follow.following_id = any(target_ids)
      and not private.blocked_between((select id from viewer), follow.following_id)
  ),
  workouts as (
    select
      workout.user_id,
      workout.date::date as day,
      workout.done
    from public.workout_type_instance workout
    join visible on visible.id = workout.user_id
    where workout.deleted_at is null
      and coalesce(workout.is_deleting, false) = false
      and workout.date::date between current_date - past_days
                                 and current_date + future_days
  )
  select
    visible.id as user_id,
    (
      -- Finished, and before today. "Last trained" is about what happened.
      select max(past.day)
      from workouts past
      where past.user_id = visible.id
        and past.done = true
        and past.day < current_date
    ) as last_workout_at,
    (
      -- Not finished, and after today. A planned workout is one nobody has
      -- done yet; a finished one in the future is a data error, not a plan.
      select min(future.day)
      from workouts future
      where future.user_id = visible.id
        and coalesce(future.done, false) = false
        and future.day > current_date
    ) as next_workout_at
  from visible
  where (select id from viewer) is not null;
$$;

revoke all on function public.friends_surrounding_activity(uuid[], integer, integer)
  from public, anon;
grant execute on function public.friends_surrounding_activity(uuid[], integer, integer)
  to authenticated;

commit;
