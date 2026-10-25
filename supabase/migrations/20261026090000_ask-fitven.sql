-- Ask FitVen: what the AI is allowed to read, how many questions a month, and
-- whether the person said yes. Not run yet. See docs/ASK-FITVEN.md.
--
-- Run after 20261016090000_popular-exercises.sql. That is the order, not a
-- dependency: it reads "Program", "Mesocycle", "Microcycle", "Day",
-- public.workout_type_instance, public.exercise_instance, public."set" and
-- public.daily_steps, which are all live.
--
-- WHAT THE AI CAN SEE. Only the signed-in person's own rows, and it can only ask
-- through the eight functions in schema `ai`. The model never sends SQL and
-- never names a table. Plain row level security is not enough for this: some
-- policies open rows to other people on purpose - the follower policy on
-- public.workout_type_instance lets anybody who follows you read yesterday,
-- today and tomorrow in full - so a query run as the person would read a
-- friend's workout. Every function here therefore filters on
-- (select auth.uid()) itself, on EVERY owned table it touches, as well as
-- relying on RLS:
--
--   * no function takes a user id; the ids it takes (a workout) are only used
--     inside the owner filter, so somebody else's id returns nothing;
--   * they run as the caller (security invoker), with search_path = '' and
--     every name qualified; callable by `authenticated` only, not anon;
--   * they only read. Nothing in this file lets the AI write.
--   * sickness (Day.is_sick, the Sickness table) is left out on purpose.
--
-- scripts/test-ask-fitven-sql.js reads this file and fails when a function in
-- `ai` breaks one of those rules. scripts/ask-fitven-isolation.sql is the real
-- test, run in the SQL editor once this has run: it makes two people, one
-- following the other, and proves each function returns only the caller's rows.
-- It rolls everything back.
--
-- THE QUESTIONS. Three tiers, a monthly limit each (public.ai_tier_limit - change
-- the numbers there, no new app build): haiku 10, sonnet 5, opus 2, counted per
-- calendar month in Copenhagen. public.ai_claim_question counts one for the
-- caller and refuses past the limit; only the edge function with the service
-- role may give one back (public.ai_refund_question) when the AI provider
-- failed after it was counted.
--
-- THE YES. public.ai_consent holds one row per person who has agreed to their
-- training data being sent to the AI provider for a question. No row, no
-- answers: the edge function checks it, the app asks for it.
--
-- Both tables have a user_id column, so deleting an account removes their rows
-- (private.purge_user_data finds every public table with one; on delete cascade
-- from profiles covers the rest).
--
-- Idempotent: create ... if not exists, create or replace, drop policy if
-- exists. One transaction with a lock timeout: a busy moment makes it give up
-- rather than queue behind a live session; run it again.

begin;

set local lock_timeout = '5s';

/* ------------------------------------------------------------ the tables -- */

create table if not exists public.ai_consent (
  user_id      uuid        primary key references public.profiles(id) on delete cascade,
  consented_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_usage (
  user_id   uuid    not null references public.profiles(id) on delete cascade,
  month     date    not null,
  tier      text    not null check (tier in ('haiku', 'sonnet', 'opus')),
  questions integer not null default 0 check (questions >= 0),
  tokens    bigint  not null default 0 check (tokens >= 0),
  primary key (user_id, month, tier)
);

alter table public.ai_consent enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Owners can read their AI consent" on public.ai_consent;
create policy "Owners can read their AI consent"
on public.ai_consent
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Owners can read their AI usage" on public.ai_usage;
create policy "Owners can read their AI usage"
on public.ai_usage
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Read only for the person; every write goes through the functions below.
revoke all on public.ai_consent from public, anon, authenticated;
revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_consent to authenticated;
grant select on public.ai_usage to authenticated;

/* ---------------------------------------------- the questions and the yes -- */

create or replace function public.ai_tier_limit(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier when 'haiku' then 10 when 'sonnet' then 5 when 'opus' then 2 end;
$$;

-- The month a question is counted in: the calendar month in Copenhagen.
create or replace function public.ai_month()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', timezone('Europe/Copenhagen', now()))::date;
$$;

create or replace function public.ai_usage_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_month date := public.ai_month();
begin
  if v_user is null then
    return null;
  end if;

  return jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'tiers', jsonb_build_object(
      'haiku', jsonb_build_object(
        'used', coalesce((select usage.questions from public.ai_usage usage
                          where usage.user_id = v_user and usage.month = v_month and usage.tier = 'haiku'), 0),
        'limit', public.ai_tier_limit('haiku')),
      'sonnet', jsonb_build_object(
        'used', coalesce((select usage.questions from public.ai_usage usage
                          where usage.user_id = v_user and usage.month = v_month and usage.tier = 'sonnet'), 0),
        'limit', public.ai_tier_limit('sonnet')),
      'opus', jsonb_build_object(
        'used', coalesce((select usage.questions from public.ai_usage usage
                          where usage.user_id = v_user and usage.month = v_month and usage.tier = 'opus'), 0),
        'limit', public.ai_tier_limit('opus'))
    )
  );
end;
$$;

-- Counts one question for the caller, in one statement, so two at once cannot
-- both slip under the limit.
create or replace function public.ai_claim_question(p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer := public.ai_tier_limit(p_tier);
  v_month date := public.ai_month();
  v_used integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if v_limit is null then
    raise exception 'unknown tier' using errcode = '22023';
  end if;

  insert into public.ai_usage as usage (user_id, month, tier, questions)
  values (v_user, v_month, p_tier, 1)
  on conflict (user_id, month, tier)
  do update set questions = usage.questions + 1
    where usage.questions < v_limit
  returning usage.questions into v_used;

  if v_used is null then
    select usage.questions
    into v_used
    from public.ai_usage usage
    where usage.user_id = v_user and usage.month = v_month and usage.tier = p_tier;

    return jsonb_build_object('allowed', false, 'used', coalesce(v_used, 0), 'limit', v_limit);
  end if;

  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit);
end;
$$;

-- Gives a counted question back. The edge function only, with the service role,
-- when the provider failed after the question was counted; the caller of the
-- app could otherwise refund themselves for ever.
create or replace function public.ai_refund_question(p_user uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage usage
  set questions = greatest(usage.questions - 1, 0)
  where usage.user_id = p_user
    and usage.month = public.ai_month()
    and usage.tier = p_tier;
end;
$$;

-- What a question cost, for the person's own row. Only adds, and only a sane amount at a time.
create or replace function public.ai_record_tokens(p_tier text, p_tokens bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or public.ai_tier_limit(p_tier) is null then
    return;
  end if;

  update public.ai_usage usage
  set tokens = usage.tokens + least(greatest(coalesce(p_tokens, 0), 0), 200000)
  where usage.user_id = v_user
    and usage.month = public.ai_month()
    and usage.tier = p_tier;
end;
$$;

create or replace function public.ai_get_consent()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_at timestamptz;
begin
  if v_user is null then
    return null;
  end if;

  select consent.consented_at into v_at from public.ai_consent consent where consent.user_id = v_user;

  return v_at;
end;
$$;

create or replace function public.ai_set_consent(p_consent boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_at timestamptz;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if p_consent then
    insert into public.ai_consent (user_id) values (v_user)
    on conflict (user_id) do update set consented_at = timezone('utc', now())
    returning consented_at into v_at;

    return v_at;
  end if;

  delete from public.ai_consent consent where consent.user_id = v_user;

  return null;
end;
$$;

revoke all on function public.ai_tier_limit(text) from public, anon;
revoke all on function public.ai_month() from public, anon;
revoke all on function public.ai_usage_summary() from public, anon;
revoke all on function public.ai_claim_question(text) from public, anon;
revoke all on function public.ai_refund_question(uuid, text) from public, anon, authenticated;
revoke all on function public.ai_record_tokens(text, bigint) from public, anon;
revoke all on function public.ai_get_consent() from public, anon;
revoke all on function public.ai_set_consent(boolean) from public, anon;

grant execute on function public.ai_tier_limit(text) to authenticated;
grant execute on function public.ai_month() to authenticated;
grant execute on function public.ai_usage_summary() to authenticated;
grant execute on function public.ai_claim_question(text) to authenticated;
grant execute on function public.ai_refund_question(uuid, text) to service_role;
grant execute on function public.ai_record_tokens(text, bigint) to authenticated;
grant execute on function public.ai_get_consent() to authenticated;
grant execute on function public.ai_set_consent(boolean) to authenticated;

/* ----------------------------------------------- the tools: schema ai -- */

create schema if not exists ai;

revoke all on schema ai from public, anon;
grant usage on schema ai to authenticated;

-- 1. Who the person is as a lifter.
create or replace function ai.profile_summary(p_today date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := coalesce(p_today, (timezone('Europe/Copenhagen', now()))::date);
  v_result jsonb;
  v_program_name text;
  v_program_status text;
  v_split jsonb := '[]'::jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select
    jsonb_build_object(
      'first_workout', min(workout.date::date),
      'workouts_4w', count(*) filter (where workout.date::date > v_today - 28),
      'workouts_12w', count(*) filter (where workout.date::date > v_today - 84)
    )
  into v_result
  from public.workout_type_instance workout
  where workout.user_id = v_user
    and workout.deleted_at is null
    and workout.is_deleting = false
    and workout.done::text in ('true', '1', 't')
    and workout.date::date <= v_today;

  select program.program_name, program.status
  into v_program_name, v_program_status
  from public."Program" program
  where program.user_id = v_user
    and program.deleted_at is null
    and program.is_deleting = false
  order by (program.status = 'ACTIVE') desc, program.id desc
  limit 1;

  -- The names of the person's split, where they have chosen one. A phone or a
  -- database without the column simply has none.
  begin
    select coalesce(to_jsonb(private_profile.split_names), '[]'::jsonb)
    into v_split
    from public.profile_private private_profile
    where private_profile.user_id = v_user;
  exception when others then
    v_split := '[]'::jsonb;
  end;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'active_program', v_program_name,
    'program_status', v_program_status,
    'split_names', coalesce(v_split, '[]'::jsonb),
    'unit', 'kg'
  );
end;
$$;

-- 2. The finished workouts in a range, newest first.
create or replace function ai.list_workouts(p_from date default null, p_to date default null, p_max integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
  v_from date := greatest(coalesce(p_from, v_today - 90), v_today - 730);
  v_to date := least(coalesce(p_to, v_today), v_today + 1);
  v_max integer := least(greatest(coalesce(p_max, 30), 1), 60);
  v_total integer;
  v_rows jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select count(*)
  into v_total
  from public.workout_type_instance workout
  where workout.user_id = v_user
    and workout.deleted_at is null
    and workout.is_deleting = false
    and workout.done::text in ('true', '1', 't')
    and workout.date::date between v_from and v_to;

  select coalesce(jsonb_agg(picked.entry order by picked.day desc, picked.id desc), '[]'::jsonb)
  into v_rows
  from (
    select
      workout.id,
      workout.date::date as day,
      jsonb_build_object(
        'id', workout.id,
        'date', workout.date::date,
        'label', workout.label,
        'type', workout.workout_type,
        'minutes', round(coalesce(workout.elapsed_time, 0) / 60.0),
        'sets_done', (
          select count(*)
          from public.exercise_instance instance
          join public."set" logged_set
            on logged_set.cloud_exercise_instance_id = instance.id
           and logged_set.user_id = v_user
          where instance.cloud_workout_type_instance_id = workout.id
            and instance.user_id = v_user
            and instance.deleted_at is null and instance.is_deleting = false
            and logged_set.deleted_at is null and logged_set.is_deleting = false
            and logged_set.done::text in ('true', '1', 't')
            and coalesce(logged_set.set_type, 'working') <> 'warmup'
        ),
        'exercises', coalesce((
          select jsonb_agg(instance.exercise_name order by instance.exercise_order, instance.id)
          from public.exercise_instance instance
          where instance.cloud_workout_type_instance_id = workout.id
            and instance.user_id = v_user
            and instance.deleted_at is null and instance.is_deleting = false
        ), '[]'::jsonb),
        'pr_count', (
          select count(*)
          from public.exercise_instance instance
          join public."set" logged_set
            on logged_set.cloud_exercise_instance_id = instance.id
           and logged_set.user_id = v_user
          where instance.cloud_workout_type_instance_id = workout.id
            and instance.user_id = v_user
            and instance.deleted_at is null and instance.is_deleting = false
            and logged_set.deleted_at is null and logged_set.is_deleting = false
            and logged_set.personal_record::text in ('true', '1', 't')
        )
      ) as entry
    from public.workout_type_instance workout
    where workout.user_id = v_user
      and workout.deleted_at is null
      and workout.is_deleting = false
      and workout.done::text in ('true', '1', 't')
      and workout.date::date between v_from and v_to
    order by workout.date::date desc, workout.id desc
    limit v_max
  ) picked;

  return jsonb_build_object('truncated', v_total > v_max, 'total', v_total, 'workouts', v_rows);
end;
$$;

-- 3. One workout, with its sets. The id is only used inside the owner filter.
create or replace function ai.workout_detail(p_workout_id bigint)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workout record;
  v_exercises jsonb;
begin
  if v_user is null or p_workout_id is null then
    return null;
  end if;

  select workout.id, workout.date::date as day, workout.label, workout.workout_type, workout.elapsed_time
  into v_workout
  from public.workout_type_instance workout
  where workout.id = p_workout_id
    and workout.user_id = v_user
    and workout.deleted_at is null
    and workout.is_deleting = false;

  if v_workout.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(exercise.entry order by exercise.exercise_order, exercise.id), '[]'::jsonb)
  into v_exercises
  from (
    select
      instance.id,
      instance.exercise_order,
      jsonb_build_object(
        'name', instance.exercise_name,
        'weight_mode', coalesce(instance.weight_mode, 'total'),
        'note', instance.note,
        'sets', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'n', logged_set.set_number,
              'reps', logged_set.reps,
              'weight', logged_set.weight,
              'type', coalesce(logged_set.set_type, 'working'),
              'done', logged_set.done::text in ('true', '1', 't'),
              'failed', logged_set.failed::text in ('true', '1', 't'),
              'rpe', logged_set.rpe
            )
            order by logged_set.set_number, logged_set.id
          )
          from public."set" logged_set
          where logged_set.cloud_exercise_instance_id = instance.id
            and logged_set.user_id = v_user
            and logged_set.deleted_at is null
            and logged_set.is_deleting = false
        ), '[]'::jsonb)
      ) as entry
    from public.exercise_instance instance
    where instance.cloud_workout_type_instance_id = v_workout.id
      and instance.user_id = v_user
      and instance.deleted_at is null
      and instance.is_deleting = false
  ) exercise;

  return jsonb_build_object(
    'id', v_workout.id,
    'date', v_workout.day,
    'label', v_workout.label,
    'type', v_workout.workout_type,
    'minutes', round(coalesce(v_workout.elapsed_time, 0) / 60.0),
    'exercises', v_exercises
  );
end;
$$;

-- 4. One exercise, session by session. Brzycki, up to 12 reps, as the app does it.
create or replace function ai.exercise_history(p_exercise_name text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
  v_from date := greatest(coalesce(p_from, v_today - 365), v_today - 730);
  v_to date := least(coalesce(p_to, v_today), v_today + 1);
  v_name text := lower(btrim(coalesce(p_exercise_name, '')));
  v_total integer;
  v_sessions jsonb;
begin
  if v_user is null or v_name = '' then
    return null;
  end if;

  with sets as (
    select
      workout.id as workout_id,
      workout.date::date as day,
      logged_set.reps,
      logged_set.weight::numeric as weight,
      coalesce(instance.weight_mode, 'total') as weight_mode
    from public.workout_type_instance workout
    join public.exercise_instance instance
      on instance.cloud_workout_type_instance_id = workout.id
     and instance.user_id = v_user
    join public."set" logged_set
      on logged_set.cloud_exercise_instance_id = instance.id
     and logged_set.user_id = v_user
    where workout.user_id = v_user
      and workout.deleted_at is null and workout.is_deleting = false
      and workout.done::text in ('true', '1', 't')
      and workout.date::date between v_from and v_to
      and lower(btrim(instance.exercise_name)) = v_name
      and instance.deleted_at is null and instance.is_deleting = false
      and logged_set.deleted_at is null and logged_set.is_deleting = false
      and logged_set.done::text in ('true', '1', 't')
      and logged_set.failed::text not in ('true', '1', 't')
      and coalesce(logged_set.set_type, 'working') <> 'warmup'
      and logged_set.reps > 0
      and logged_set.weight is not null
  ),
  sessions as (
    select
      sets.workout_id,
      sets.day,
      count(*) as set_count,
      max(sets.weight_mode) as weight_mode,
      sum(sets.reps * sets.weight) as volume,
      max(case when sets.reps <= 12 then sets.weight * 36.0 / (37 - sets.reps) end) as est_1rm,
      (array_agg(jsonb_build_object('reps', sets.reps, 'weight', sets.weight)
                 order by case when sets.reps <= 12 then sets.weight * 36.0 / (37 - sets.reps) else sets.weight end desc))[1] as top_set
    from sets
    group by sets.workout_id, sets.day
  )
  select count(*) into v_total from sessions;

  with sets as (
    select
      workout.id as workout_id,
      workout.date::date as day,
      logged_set.reps,
      logged_set.weight::numeric as weight,
      coalesce(instance.weight_mode, 'total') as weight_mode
    from public.workout_type_instance workout
    join public.exercise_instance instance
      on instance.cloud_workout_type_instance_id = workout.id
     and instance.user_id = v_user
    join public."set" logged_set
      on logged_set.cloud_exercise_instance_id = instance.id
     and logged_set.user_id = v_user
    where workout.user_id = v_user
      and workout.deleted_at is null and workout.is_deleting = false
      and workout.done::text in ('true', '1', 't')
      and workout.date::date between v_from and v_to
      and lower(btrim(instance.exercise_name)) = v_name
      and instance.deleted_at is null and instance.is_deleting = false
      and logged_set.deleted_at is null and logged_set.is_deleting = false
      and logged_set.done::text in ('true', '1', 't')
      and logged_set.failed::text not in ('true', '1', 't')
      and coalesce(logged_set.set_type, 'working') <> 'warmup'
      and logged_set.reps > 0
      and logged_set.weight is not null
  ),
  sessions as (
    select
      sets.workout_id,
      sets.day,
      count(*) as set_count,
      max(sets.weight_mode) as weight_mode,
      sum(sets.reps * sets.weight) as volume,
      max(case when sets.reps <= 12 then sets.weight * 36.0 / (37 - sets.reps) end) as est_1rm,
      (array_agg(jsonb_build_object('reps', sets.reps, 'weight', sets.weight)
                 order by case when sets.reps <= 12 then sets.weight * 36.0 / (37 - sets.reps) else sets.weight end desc))[1] as top_set
    from sets
    group by sets.workout_id, sets.day
    order by sets.day desc, sets.workout_id desc
    limit 120
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', sessions.day,
        'weight_mode', sessions.weight_mode,
        'top_set', sessions.top_set,
        'est_1rm', round(sessions.est_1rm, 1),
        'volume', round(sessions.volume),
        'sets', sessions.set_count
      )
      order by sessions.day desc, sessions.workout_id desc
    ),
    '[]'::jsonb
  )
  into v_sessions
  from sessions;

  return jsonb_build_object('exercise', p_exercise_name, 'truncated', v_total > 120, 'total', v_total, 'sessions', v_sessions);
end;
$$;

-- 5. The sets the app flagged as records.
create or replace function ai.personal_records(p_exercise_name text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := nullif(lower(btrim(coalesce(p_exercise_name, ''))), '');
  v_rows jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select coalesce(jsonb_agg(best.entry order by best.exercise, best.reps), '[]'::jsonb)
  into v_rows
  from (
    select
      instance.exercise_name as exercise,
      logged_set.reps,
      jsonb_build_object(
        'exercise', instance.exercise_name,
        'reps', logged_set.reps,
        'weight', max(logged_set.weight::numeric),
        'date', max(workout.date::date)
      ) as entry
    from public.workout_type_instance workout
    join public.exercise_instance instance
      on instance.cloud_workout_type_instance_id = workout.id
     and instance.user_id = v_user
    join public."set" logged_set
      on logged_set.cloud_exercise_instance_id = instance.id
     and logged_set.user_id = v_user
    where workout.user_id = v_user
      and workout.deleted_at is null and workout.is_deleting = false
      and workout.done::text in ('true', '1', 't')
      and instance.deleted_at is null and instance.is_deleting = false
      and logged_set.deleted_at is null and logged_set.is_deleting = false
      and logged_set.done::text in ('true', '1', 't')
      and logged_set.personal_record::text in ('true', '1', 't')
      and coalesce(logged_set.set_type, 'working') <> 'warmup'
      and (v_name is null or lower(btrim(instance.exercise_name)) = v_name)
    group by instance.exercise_name, logged_set.reps
    order by instance.exercise_name, logged_set.reps
    limit 100
  ) best;

  return jsonb_build_object('records', v_rows);
end;
$$;

-- 6. Sets per week, per exercise: the model reads names, and groups them itself.
create or replace function ai.weekly_volume(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
  v_from date := greatest(coalesce(p_from, v_today - 84), v_today - 730);
  v_to date := least(coalesce(p_to, v_today), v_today + 1);
  v_weeks jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select coalesce(jsonb_agg(weekly.entry order by weekly.week desc), '[]'::jsonb)
  into v_weeks
  from (
    select
      per_exercise.week,
      jsonb_build_object(
        'week', per_exercise.week,
        'exercise_sets', jsonb_object_agg(per_exercise.exercise_name, per_exercise.set_count)
      ) as entry
    from (
      select
        date_trunc('week', workout.date::date::timestamp)::date as week,
        instance.exercise_name,
        count(*) as set_count
      from public.workout_type_instance workout
      join public.exercise_instance instance
        on instance.cloud_workout_type_instance_id = workout.id
       and instance.user_id = v_user
      join public."set" logged_set
        on logged_set.cloud_exercise_instance_id = instance.id
       and logged_set.user_id = v_user
      where workout.user_id = v_user
        and workout.deleted_at is null and workout.is_deleting = false
        and workout.done::text in ('true', '1', 't')
        and workout.date::date between v_from and v_to
        and instance.deleted_at is null and instance.is_deleting = false
        and logged_set.deleted_at is null and logged_set.is_deleting = false
        and logged_set.done::text in ('true', '1', 't')
        and coalesce(logged_set.set_type, 'working') <> 'warmup'
      group by 1, instance.exercise_name
    ) per_exercise
    group by per_exercise.week
    order by per_exercise.week desc
    limit 104
  ) weekly;

  return jsonb_build_object('weeks', v_weeks);
end;
$$;

-- 7. The active program, level by level (or the latest one when none is active).
create or replace function ai.program_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_program record;
  v_blocks jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select program.id, program.program_name, program.status, program.start_date
  into v_program
  from public."Program" program
  where program.user_id = v_user
    and program.deleted_at is null
    and program.is_deleting = false
  order by (program.status = 'ACTIVE') desc, program.id desc
  limit 1;

  if v_program.id is null then
    return jsonb_build_object('program', null, 'blocks', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(block.entry order by block.mesocycle_number), '[]'::jsonb)
  into v_blocks
  from (
    select
      mesocycle.mesocycle_number,
      jsonb_build_object(
        'mesocycle', mesocycle.mesocycle_number,
        'weeks', mesocycle.weeks,
        'focus', mesocycle.focus,
        'microcycles', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'n', microcycle.microcycle_number,
              'focus', microcycle.focus,
              'days', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'weekday', day.weekday,
                    'date', day.date,
                    'workouts', coalesce((
                      select jsonb_agg(
                        jsonb_build_object(
                          'label', workout.label,
                          'exercises', coalesce((
                            select jsonb_agg(instance.exercise_name order by instance.exercise_order, instance.id)
                            from public.exercise_instance instance
                            where instance.cloud_workout_type_instance_id = workout.id
                              and instance.user_id = v_user
                              and instance.deleted_at is null and instance.is_deleting = false
                          ), '[]'::jsonb)
                        )
                        order by workout.id
                      )
                      from public.workout_type_instance workout
                      where workout.cloud_day_id = day.id
                        and workout.user_id = v_user
                        and workout.deleted_at is null and workout.is_deleting = false
                    ), '[]'::jsonb)
                  )
                  order by day.date, day.id
                )
                from public."Day" day
                where day.cloud_microcycle_id = microcycle.id
                  and day.user_id = v_user
                  and day.deleted_at is null and day.is_deleting = false
              ), '[]'::jsonb)
            )
            order by microcycle.microcycle_number
          )
          from public."Microcycle" microcycle
          where microcycle.cloud_mesocycle_id = mesocycle.id
            and microcycle.user_id = v_user
            and microcycle.deleted_at is null and microcycle.is_deleting = false
        ), '[]'::jsonb)
      ) as entry
    from public."Mesocycle" mesocycle
    where mesocycle.cloud_program_id = v_program.id
      and mesocycle.user_id = v_user
      and mesocycle.deleted_at is null and mesocycle.is_deleting = false
    order by mesocycle.mesocycle_number
    limit 6
  ) block;

  return jsonb_build_object(
    'program', jsonb_build_object('name', v_program.program_name, 'status', v_program.status, 'start_date', v_program.start_date),
    'blocks', v_blocks
  );
end;
$$;

-- 8. The day's steps.
create or replace function ai.daily_steps(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
  v_from date := greatest(coalesce(p_from, v_today - 28), v_today - 730);
  v_to date := least(coalesce(p_to, v_today), v_today + 1);
  v_days jsonb;
begin
  if v_user is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('day', steps.day, 'steps', steps.steps, 'source', steps.source)
           order by steps.day desc), '[]'::jsonb)
  into v_days
  from (
    select daily.day, daily.steps, daily.source
    from public.daily_steps daily
    where daily.user_id = v_user
      and daily.day between v_from and v_to
    order by daily.day desc
    limit 366
  ) steps;

  return jsonb_build_object('days', v_days);
end;
$$;

-- Callable by signed-in people and nobody else.
revoke all on function ai.profile_summary(date) from public, anon;
revoke all on function ai.list_workouts(date, date, integer) from public, anon;
revoke all on function ai.workout_detail(bigint) from public, anon;
revoke all on function ai.exercise_history(text, date, date) from public, anon;
revoke all on function ai.personal_records(text) from public, anon;
revoke all on function ai.weekly_volume(date, date) from public, anon;
revoke all on function ai.program_overview() from public, anon;
revoke all on function ai.daily_steps(date, date) from public, anon;

grant execute on function ai.profile_summary(date) to authenticated;
grant execute on function ai.list_workouts(date, date, integer) to authenticated;
grant execute on function ai.workout_detail(bigint) to authenticated;
grant execute on function ai.exercise_history(text, date, date) to authenticated;
grant execute on function ai.personal_records(text) to authenticated;
grant execute on function ai.weekly_volume(date, date) to authenticated;
grant execute on function ai.program_overview() to authenticated;
grant execute on function ai.daily_steps(date, date) to authenticated;

commit;

notify pgrst, 'reload schema';

-- PostgREST has to be told to serve the `ai` schema, or the edge function cannot
-- call these: Settings -> API -> Exposed schemas, add `ai` (or, in SQL,
-- alter role authenticator set pgrst.db_schemas = 'public, graphql_public, ai';
-- then notify pgrst, 'reload config'). Until it is, the function answers
-- "unavailable". Nothing in `ai` is reachable by anon either way.
--
-- Check afterwards, in the SQL editor, with scripts/ask-fitven-isolation.sql.
