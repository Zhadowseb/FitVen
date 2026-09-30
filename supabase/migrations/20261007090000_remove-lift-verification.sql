-- Video verification of lifts is removed, all the way through.
--
-- Run after 20261006090000. That is the order, not a dependency: this only
-- depends on what 20260917120000_gyms-and-lift-verification.sql and the
-- migrations after it that touch gym_lift have already made live.
--
-- The owner decided on 2026-09-30 that it is too early for verification
-- videos, and that the feature can be built again later. So this takes it out
-- of the cloud as well as the app:
--
--   * gym_lift_vote and every vote in it, with the vote triggers;
--   * gym_lift.video_path, video_status, approvals and rejections;
--   * the review queue (gym_lift_verification_queue), the request
--     (request_lift_verification), the check the video policy called
--     (can_watch_lift_video), and trains_at_gym, which only they used;
--   * the storage policies of the lift-videos bucket;
--   * every lift_verification_requested notification (the inbox rows go with
--     their event, on delete cascade).
--
-- Every list now counts every lift, a rejected one included:
--
--   * private.ranked_lifts has no verified-only rule for the whole country,
--     no rejected rows, and no video columns. The country's list is each
--     person's best lift of the exercise, one row per person; a row per
--     centre was only ever possible before with a verified video at two.
--   * public_profile gives every record its rank.
--   * gym_scope_summary counts every lifter.
--   * category_rows: Powerlifting has no "Kun video" and leaves no rejected
--     single out.
--
-- The functions that read ranked_lifts without its video columns
-- (gym_leaderboard_overview, gym_exercise_leaderboard,
-- national_exercise_leaderboard, national_strongest, gym_recent_records) are
-- not restated. Their bodies are text, so they keep working against the new
-- ranked_lifts; their rows' JSON simply no longer carries video_status,
-- approvals and rejections, which the app no longer reads.
--
-- By hand, after this has run: the files in the lift-videos bucket are not
-- deleted here, because Supabase does not allow deleting from storage.objects
-- or storage.buckets in SQL. Empty the bucket and delete it in the dashboard,
-- under Storage. Until then the files sit there with no policy that lets
-- anybody read, upload or delete them.
--
-- No Edge Function reads any of this, so nothing needs deploying.
--
-- Safe to run twice.

begin;

/* ------------------------------------------------------ storage policies -- */

-- First, because the read policy calls can_watch_lift_video.
drop policy if exists "Authenticated users can read lift videos" on storage.objects;
drop policy if exists "Centre members can read lift videos" on storage.objects;
drop policy if exists "Users can upload their own lift videos" on storage.objects;
drop policy if exists "Users can replace their own lift videos" on storage.objects;
drop policy if exists "Users can delete their own lift videos" on storage.objects;

/* ------------------------------------------------ the review and request -- */

drop function if exists public.gym_lift_verification_queue(bigint);
drop function if exists public.request_lift_verification(bigint);
drop function if exists private.can_watch_lift_video(text);

/* ----------------------------------------------------------------- votes -- */

drop table if exists public.gym_lift_vote;
drop function if exists private.gym_lift_vote_before_insert();
drop function if exists private.gym_lift_vote_recount();
drop function if exists private.trains_at_gym(uuid, bigint);

/* ------------------------------------------------- the gym_lift triggers -- */

drop trigger if exists gym_lift_reject_foreign_video on public.gym_lift;
drop function if exists private.gym_lift_reject_foreign_video();

-- What stays of the two triggers: the timestamps, the previous weight, and
-- the identity columns put back on an upsert.
create or replace function private.gym_lift_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.previous_weight_kg := null;
  new.created_at := timezone('utc', now());
  new.updated_at := new.created_at;
  return new;
end;
$$;

-- A lift at a new weight keeps the weight it replaced, for "up from".
create or replace function private.gym_lift_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.weight_kg <> old.weight_kg then
    new.previous_weight_kg := old.weight_kg;
  else
    new.previous_weight_kg := old.previous_weight_kg;
  end if;

  new.user_id := old.user_id;
  new.gym_id := old.gym_id;
  new.exercise_id := old.exercise_id;
  new.created_at := old.created_at;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

/* --------------------------------------------------------------- indexes -- */

drop index if exists public.gym_lift_national_idx;
drop index if exists public.gym_lift_video_path_idx;

-- The country's list reads one exercise across every centre.
create index if not exists gym_lift_exercise_weight_idx
  on public.gym_lift (exercise_id, weight_kg desc);

/* ---------------------------------------------------------- ranked_lifts -- */

-- The one place the ranking rules live. Every leaderboard function selects
-- from this. Rows of people blocked either way are already gone, the
-- viewer's own excepted; rank is computed over what remains.
--
--   target_gym_id  null for the whole country: each person's best lift of
--                  the exercise at any public centre, one row per person
--   scope          'gym' or 'friends' (people the viewer follows, plus the viewer)
--   unit           'kg' or 'bw' (weight over bodyweight; rows without one drop)
--
-- Its columns change (the video ones go), which create or replace cannot do.
drop function if exists private.ranked_lifts(uuid, bigint, bigint, text, text);

create function private.ranked_lifts(
  viewer_id uuid,
  target_gym_id bigint,
  target_exercise_id bigint,
  scope text,
  unit text
)
returns table (
  lift_id bigint,
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_path text,
  gym_id bigint,
  gym_short_name text,
  gym_city text,
  exercise_id bigint,
  exercise_name text,
  weight_kg numeric,
  reps integer,
  bodyweight_kg numeric,
  ratio numeric,
  sort_key numeric,
  performed_at timestamptz,
  previous_weight_kg numeric,
  is_me boolean,
  row_json jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select
      lift.*,
      profile.display_name,
      profile.avatar_path,
      gym.short_name as gym_short_name,
      gym.city as gym_city,
      case
        when lift.bodyweight_kg is not null and lift.bodyweight_kg > 0
          then round(lift.weight_kg / lift.bodyweight_kg, 3)
        else null
      end as ratio
    from public.gym_lift lift
    join public.profiles profile on profile.id = lift.user_id
    join public.gym gym on gym.id = lift.gym_id
    where (target_gym_id is null or lift.gym_id = target_gym_id)
      and (target_exercise_id is null or lift.exercise_id = target_exercise_id)
      and gym.is_public
      and (
        lift.user_id = viewer_id
        or not private.blocked_between(viewer_id, lift.user_id)
      )
      and (
        coalesce(scope, 'gym') <> 'friends'
        or lift.user_id = viewer_id
        or exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = viewer_id
            and follow.following_id = lift.user_id
        )
      )
      and (coalesce(unit, 'kg') <> 'bw' or lift.bodyweight_kg is not null)
  ),
  keyed as (
    select
      visible.*,
      case when coalesce(unit, 'kg') = 'bw' then visible.ratio else visible.weight_kg end as sort_key
    from visible
  ),
  -- A centre holds one row per person and exercise; the country holds the
  -- best of each person's rows.
  counted as (
    select keyed.*
    from keyed
    where target_gym_id is not null
    union all
    select best.*
    from (
      select distinct on (keyed.user_id, keyed.exercise_id) keyed.*
      from keyed
      where target_gym_id is null
      order by keyed.user_id, keyed.exercise_id, keyed.sort_key desc, keyed.performed_at asc, keyed.id asc
    ) best
  ),
  ranked as (
    select
      counted.*,
      rank() over (
        partition by counted.exercise_id
        order by counted.sort_key desc, counted.performed_at asc, counted.id asc
      ) as rank
    from counted
  )
  select
    ranked.id,
    ranked.rank,
    ranked.user_id,
    ranked.display_name,
    ranked.avatar_path,
    ranked.gym_id,
    ranked.gym_short_name,
    ranked.gym_city,
    ranked.exercise_id,
    ranked.exercise_name,
    ranked.weight_kg,
    ranked.reps,
    ranked.bodyweight_kg,
    ranked.ratio,
    ranked.sort_key,
    ranked.performed_at,
    ranked.previous_weight_kg,
    ranked.user_id = viewer_id as is_me,
    -- The row as the client receives it. Built here, once, so every function
    -- that reads this hands out the same shape.
    jsonb_build_object(
      'lift_id', ranked.id,
      'rank', ranked.rank,
      'user_id', ranked.user_id,
      'display_name', ranked.display_name,
      'avatar_path', ranked.avatar_path,
      'gym', jsonb_build_object('id', ranked.gym_id, 'short_name', ranked.gym_short_name, 'city', ranked.gym_city),
      'exercise_id', ranked.exercise_id,
      'exercise_name', ranked.exercise_name,
      'weight_kg', ranked.weight_kg,
      'reps', ranked.reps,
      'bodyweight_kg', ranked.bodyweight_kg,
      'ratio', ranked.ratio,
      'performed_at', ranked.performed_at,
      'previous_weight_kg', ranked.previous_weight_kg,
      'is_me', ranked.user_id = viewer_id
    ) as row_json
  from ranked;
$$;

revoke all on function private.ranked_lifts(uuid, bigint, bigint, text, text) from public, anon, authenticated;

/* ---------------------------------------------------- public_profile -- */

-- Restated from 20260927100000_public-profiles.sql. Only the video parts
-- are gone: every record has its rank, and a tie is the earlier lift.
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
  -- the centre it was lifted in.
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
    order by
      featured.exercise_id,
      ranked.weight_kg desc,
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
        'rank', best.rank,
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

/* ------------------------------------------------- gym_scope_summary -- */

-- Restated from 20260929090000_gym-scope-and-categories.sql. Only the three
-- `video_status <> 'rejected'` conditions are gone: every lifter counts.
create or replace function public.gym_scope_summary(
  p_level text,
  p_country text default null,
  p_region text default null,
  p_gym_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  viewer_id uuid := auth.uid();
  v_country text := upper(btrim(p_country));
  v_region text := lower(btrim(p_region));
  v_home_country text;
  result jsonb;
begin
  if viewer_id is null then
    return null;
  end if;

  if p_level = 'world' then
    select gym.country_code
    into v_home_country
    from public.gym gym
    where gym.id = private.home_gym_id_for(viewer_id)
      and gym.is_public;

    with hidden as (
      select block.blocked_id as user_id from public.user_blocks block where block.blocker_id = viewer_id
      union
      select block.blocker_id from public.user_blocks block where block.blocked_id = viewer_id
    ),
    centres as (
      select gym.country_code, count(*)::integer as gym_count
      from public.gym gym
      where gym.is_public
      group by gym.country_code
    ),
    lifters as (
      select gym.country_code, count(distinct lift.user_id)::integer as lifter_count
      from public.gym_lift lift
      join public.gym gym on gym.id = lift.gym_id
      where gym.is_public
        and not exists (select 1 from hidden where hidden.user_id = lift.user_id)
      group by gym.country_code
    )
    select jsonb_build_object(
      'level', 'world',
      'countries', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', lifters.country_code,
            'gym_count', coalesce(centres.gym_count, 0),
            'lifter_count', lifters.lifter_count,
            'is_yours', coalesce(lifters.country_code = v_home_country, false)
          )
          order by lifters.lifter_count desc, lifters.country_code asc
        ),
        '[]'::jsonb
      )
    )
    into result
    from lifters
    left join centres on centres.country_code = lifters.country_code;

    return result;
  end if;

  if p_level = 'country' then
    with hidden as (
      select block.blocked_id as user_id from public.user_blocks block where block.blocker_id = viewer_id
      union
      select block.blocker_id from public.user_blocks block where block.blocked_id = viewer_id
    ),
    centres as (
      select gym.id, gym.region_key
      from public.gym gym
      where gym.is_public
        and gym.country_code = v_country
    ),
    lifted as (
      select distinct lift.gym_id, lift.user_id
      from public.gym_lift lift
      join centres on centres.id = lift.gym_id
      where not exists (select 1 from hidden where hidden.user_id = lift.user_id)
    ),
    regions as (
      select
        region.region_key,
        region.name_da,
        region.name_en,
        region.where_da,
        region.where_en,
        region.sort_order,
        count(distinct centres.id)::integer as gym_count,
        count(distinct lifted.user_id)::integer as lifter_count
      from public.gym_region region
      join centres on centres.region_key = region.region_key
      left join lifted on lifted.gym_id = centres.id
      where region.country_code = v_country
      group by region.region_key, region.name_da, region.name_en, region.where_da, region.where_en, region.sort_order
    )
    select jsonb_build_object(
      'level', 'country',
      'country', jsonb_build_object(
        'code', v_country,
        'gym_count', (select count(*)::integer from centres),
        'lifter_count', (select count(distinct lifted.user_id)::integer from lifted)
      ),
      'regions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'key', regions.region_key,
              'name_da', regions.name_da,
              'name_en', regions.name_en,
              'where_da', regions.where_da,
              'where_en', regions.where_en,
              'gym_count', regions.gym_count,
              'lifter_count', regions.lifter_count
            )
            order by regions.sort_order, regions.region_key
          )
          from regions
        ),
        '[]'::jsonb
      )
    )
    into result;

    return result;
  end if;

  if p_level = 'region' then
    with hidden as (
      select block.blocked_id as user_id from public.user_blocks block where block.blocker_id = viewer_id
      union
      select block.blocker_id from public.user_blocks block where block.blocked_id = viewer_id
    ),
    centres as (
      select gym.id, gym.name, gym.short_name, gym.chain, gym.city, gym.image_url
      from public.gym gym
      where gym.is_public
        and gym.country_code = v_country
        and gym.region_key = v_region
    ),
    counted as (
      select
        centres.*,
        (
          select count(distinct lift.user_id)::integer
          from public.gym_lift lift
          where lift.gym_id = centres.id
            and not exists (select 1 from hidden where hidden.user_id = lift.user_id)
        ) as lifter_count
      from centres
    )
    select jsonb_build_object(
      'level', 'region',
      'country', jsonb_build_object('code', v_country),
      'region', (
        select jsonb_build_object(
          'key', region.region_key,
          'name_da', region.name_da,
          'name_en', region.name_en,
          'where_da', region.where_da,
          'where_en', region.where_en,
          'gym_count', (select count(*)::integer from centres)
        )
        from public.gym_region region
        where region.country_code = v_country
          and region.region_key = v_region
      ),
      'gyms', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', counted.id,
              'name', counted.name,
              'short_name', counted.short_name,
              'chain', counted.chain,
              'city', counted.city,
              'image_url', counted.image_url,
              'lifter_count', counted.lifter_count
            )
            order by counted.lifter_count desc, counted.short_name asc, counted.id asc
          )
          from counted
        ),
        '[]'::jsonb
      )
    )
    into result;

    return result;
  end if;

  if p_level = 'gym' then
    select jsonb_build_object(
      'level', 'gym',
      'country', jsonb_build_object('code', gym.country_code),
      'region', case
        when region.region_key is null then null
        else jsonb_build_object(
          'key', region.region_key,
          'name_da', region.name_da,
          'name_en', region.name_en,
          'where_da', region.where_da,
          'where_en', region.where_en
        )
      end,
      'gym', jsonb_build_object('id', gym.id, 'name', gym.name, 'short_name', gym.short_name)
    )
    into result
    from public.gym gym
    left join public.gym_region region
      on region.country_code = gym.country_code
     and region.region_key = gym.region_key
    where gym.id = p_gym_id
      and gym.is_public;

    return coalesce(
      result,
      jsonb_build_object('level', 'gym', 'country', null, 'region', null, 'gym', null)
    );
  end if;

  return null;
end;
$$;

revoke all on function public.gym_scope_summary(text, text, text, bigint) from public, anon;
grant execute on function public.gym_scope_summary(text, text, text, bigint) to authenticated;

/* ----------------------------------------------------- category_rows -- */

-- Restated from 20261004090000_progress-counts-every-exercise.sql. Only
-- Powerlifting changed: no "Kun video" branch (the app no longer sends
-- only_video, and it is ignored if an old app does), and no rejected single
-- is left out. The signature is the same.
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
      -- The sets themselves: reps = 1, no estimate. The cloud keeps a set's
      -- weight in whole kilos (field("weight", int()) in
      -- src/Services/cloudSync/cloudSyncFields.js truncates it on upload).
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
        and logged_set.reps = 1
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

/* --------------------------------------------------- the video columns -- */

-- Last, once nothing reads them. The update grant on video_path and the
-- status check go with their columns.
alter table public.gym_lift drop column if exists video_path;
alter table public.gym_lift drop column if exists video_status;
alter table public.gym_lift drop column if exists approvals;
alter table public.gym_lift drop column if exists rejections;

/* ---------------------------------------------------- old notifications -- */

-- Their inbox rows are deleted with them (notification_inbox.event_id is on
-- delete cascade).
delete from public.notification_events
where event_type = 'lift_verification_requested';

commit;
