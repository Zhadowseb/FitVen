-- Somebody else's profile: the page a name opens.
--
-- Run after 20260927090000_a-lifter-can-give-their-sex.sql. That is the order,
-- not a dependency. What this does depend on is already live: blocks from
-- 20260905143000_user-blocks.sql, and private.ranked_lifts,
-- private.featured_exercises, private.home_gym_id_for and
-- private.blocked_between from 20260917120000_gyms-and-lift-verification.sql.
--
-- 20260905143000 made public.profiles and public.user_follows answer only to
-- the people a row involves. That was the point, because the whole user base
-- and the follow graph had been one select away. It also means the profile of
-- somebody you have no relationship with cannot be read from the tables at
-- all. This function is the one controlled way in. It is security definer, the
-- same shape as search_profiles and the leaderboard reads, and it hands out a
-- fixed set of fields and nothing else.
--
-- What it hands out: the display name, the username and its code, the avatar
-- path, the bio, the short name of their centre, how many people follow them
-- and how many they follow, how many workouts they have finished, how many
-- they finished in each of the last 12 weeks, whether the viewer follows them,
-- and their records in the three big lifts.
--
-- What it does not hand out:
--   * Anything private. The birth year, the sex, the heart rate and the consent
--     dates stay where they are, and this function does not read that table at
--     all. Their centre comes through private.home_gym_id_for, which the rest
--     of the app already asks, and only the centre's id and short name come
--     back.
--   * Who follows them, or whom they follow. The lists stay closed and only
--     the counts come out.
--   * Which workouts they did. Activity is a count per week, with no names,
--     types or days.
--
-- If either of the two has blocked the other, the answer is null. That is the
-- same answer as for a profile that does not exist, so a block cannot be
-- reopened through a profile, and the blocked person cannot tell the two apart.
--
-- A record is the person's heaviest lift in bench press, squat and deadlift
-- (private.featured_exercises), read through private.ranked_lifts, so the
-- leaderboard's own rules decide what the viewer may see and where the lift
-- ranks at its centre. The rank is handed out only for a verified lift,
-- because gold and a place need an approved video, as on the leaderboard. A
-- rejected lift is never a record.
--
-- Posts are not in here. The app reads them from social_post under the
-- policies that already govern it, so the viewer gets exactly the posts they
-- may see.
--
-- Until this has run, the app gets "function does not exist", and a profile
-- opened from a name says it is not available. Nothing else changes. Safe to
-- run twice.

begin;

create or replace function public.public_profile(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  profile_json jsonb;
  home_gym_json jsonb;
  follower_total integer;
  following_total integer;
  viewer_follows boolean;
  finished_total integer;
  weekly_json jsonb;
  records_json jsonb;
begin
  if viewer_id is null or target_user_id is null then
    return null;
  end if;

  -- Either way round, and before anything about them is read.
  if private.blocked_between(viewer_id, target_user_id) then
    return null;
  end if;

  -- The columns by name, never profile.*: a column added to profiles later is
  -- not handed out by accident. The username fallback is for rows written
  -- before the base and the code had columns of their own.
  select jsonb_build_object(
    'id', profile.id,
    'display_name', profile.display_name,
    'username_base', coalesce(profile.username_base, nullif(split_part(profile.username, '#', 1), '')),
    'username_code', coalesce(profile.username_code, nullif(split_part(profile.username, '#', 2), '')),
    'avatar_path', profile.avatar_path,
    'bio', profile.bio
  )
  into profile_json
  from public.profiles profile
  where profile.id = target_user_id;

  if profile_json is null then
    return null;
  end if;

  select jsonb_build_object('id', gym.id, 'short_name', gym.short_name)
  into home_gym_json
  from public.gym gym
  where gym.id = private.home_gym_id_for(target_user_id)
    and gym.is_public;

  select
    (select count(*)::integer from public.user_follows follow where follow.following_id = target_user_id),
    (select count(*)::integer from public.user_follows follow where follow.follower_id = target_user_id),
    exists (
      select 1
      from public.user_follows follow
      where follow.follower_id = viewer_id
        and follow.following_id = target_user_id
    )
  into follower_total, following_total, viewer_follows;

  -- Monday-based weeks, oldest first and this week last.
  with finished as (
    select workout.date::date as day
    from public.workout_type_instance workout
    where workout.user_id = target_user_id
      and workout.done = true
      and workout.deleted_at is null
      and coalesce(workout.is_deleting, false) = false
  ),
  weeks as (
    select
      series.weeks_ago,
      date_trunc('week', current_date::timestamp)::date - series.weeks_ago * 7 as week_start
    from generate_series(0, 11) as series(weeks_ago)
  ),
  weekly as (
    select weeks.weeks_ago, count(finished.day)::integer as workouts
    from weeks
    left join finished
      on finished.day >= weeks.week_start
     and finished.day < weeks.week_start + 7
    group by weeks.weeks_ago
  )
  select
    (select count(*)::integer from finished),
    (select jsonb_agg(weekly.workouts order by weekly.weeks_ago desc) from weekly)
  into finished_total, weekly_json;

  -- The heaviest lift per featured exercise across their centres, ranked at
  -- the centre it was lifted in. On a tie the verified one is the record.
  with featured as (
    select fe.exercise_id, fe.exercise_name, fe.sort_order
    from private.featured_exercises() fe
  ),
  best as (
    select distinct on (featured.exercise_id)
      featured.exercise_id,
      featured.exercise_name,
      featured.sort_order,
      ranked.lift_id,
      ranked.rank,
      ranked.gym_id,
      ranked.gym_short_name,
      ranked.gym_city,
      ranked.weight_kg,
      ranked.reps,
      ranked.video_status,
      ranked.approvals,
      ranked.performed_at
    from featured
    -- One ranking per centre and exercise they have lifted in, however many
    -- lifts they logged there: ranked_lifts ranks the whole centre each call.
    join (
      select distinct own.gym_id, own.exercise_id
      from public.gym_lift own
      where own.user_id = target_user_id
    ) own
      on own.exercise_id = featured.exercise_id
    cross join lateral private.ranked_lifts(viewer_id, own.gym_id, featured.exercise_id, 'gym', 'kg') ranked
    where ranked.user_id = target_user_id
      and ranked.video_status <> 'rejected'
    order by
      featured.exercise_id,
      ranked.weight_kg desc,
      (ranked.video_status = 'verified') desc,
      ranked.performed_at asc,
      ranked.lift_id asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exercise_id', best.exercise_id,
        'exercise_name', best.exercise_name,
        'lift_id', best.lift_id,
        'weight_kg', best.weight_kg,
        'reps', best.reps,
        'video_status', best.video_status,
        'approvals', best.approvals,
        'rank', case when best.video_status = 'verified' then best.rank end,
        'gym', jsonb_build_object('id', best.gym_id, 'short_name', best.gym_short_name, 'city', best.gym_city),
        'performed_at', best.performed_at
      )
      order by best.sort_order, best.exercise_id
    ),
    '[]'::jsonb
  )
  into records_json
  from best;

  return profile_json || jsonb_build_object(
    'home_gym', home_gym_json,
    'follower_count', follower_total,
    'following_count', following_total,
    'is_following', viewer_follows,
    'workout_count', coalesce(finished_total, 0),
    'weekly_workouts', coalesce(weekly_json, '[]'::jsonb),
    'records', records_json
  );
end;
$$;

revoke all on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

commit;
