-- Centres get a country and a region, and are ranked in four categories:
-- Consistency (flid), Powerlifting, Progress (fremgang) and Calisthenics.
--
-- Run after 20260928090000_custom-exercises-can-be-shared.sql. That is the
-- order, not a dependency. What this does depend on is already live:
--   * public.gym, public.gym_lift, private.featured_exercises,
--     private.home_gym_id_for and private.blocked_between from
--     20260917120000_gyms-and-lift-verification.sql;
--   * profile_private.birth_date (20260628211540_profile-birthdate.sql) and
--     profile_private.sex (20260927090000_a-lifter-can-give-their-sex.sql);
--   * set.set_type (20260923100000_a-set-has-a-type.sql);
--   * public.user_blocks (20260905143000_user-blocks.sql).
--
-- Why. Until now every centre was a point on a Danish map, and the only
-- ranking was one exercise at a time. The Centres screens now go world ->
-- country -> region -> centre, and on every level but the world they show
-- who leads in four categories. That needs two things the schema did not
-- have: where a centre is (country_code, region_key and public.gym_region),
-- and the rules the four categories count by.
--
-- What it adds:
--   * gym.country_code (ISO 3166-1 alpha-2, 'DK' for every centre today) and
--     gym.region_key, backfilled for Danish centres from the postal code into
--     the four landsdele. scripts/import-gyms/regions.js derives the same keys
--     for new rows; scripts/test-gym-categories.js holds the two together.
--   * public.gym_region: a region's name and its "in {region}" phrase in both
--     languages, and the order the country lists them in.
--   * private.calisthenics_event: which catalogue exercises are pull-ups,
--     dips and push-ups, and what each is worth.
--   * three security definer reads - gym_scope_summary, gym_category_cards
--     and gym_category_leaderboard - over four private helpers. Nothing else
--     is reachable from the app: profile_private (sex, birth year) and other
--     people's sets are read here and never handed out.
--
-- Who counts at a level: somebody with a finished workout in the last 90 days
-- at a public centre inside it (SCOPE_ACTIVE_DAYS in src/Utils/gymCategories.js).
-- Nobody on either side of a block with the viewer, ever, and with "friends"
-- only the viewer and the people they follow. Where a record counts:
-- powerlifting and calisthenics sets count at the centre their workout was
-- matched to (workout_type_instance.gym_id); consistency and progress are the
-- person's own, wherever they trained.
--
-- The rule constants have a JavaScript twin in src/Utils/gymCategories.js
-- (STREAK_MIN_WORKOUTS, PROGRESS_WINDOW_DAYS, PROGRESS_MIN_SETS,
-- SCOPE_ACTIVE_DAYS, PROGRESS_MAX_REPS, CALISTHENICS_FACTORS), and the test
-- reads this file to hold them together.
--
-- Everything is computed when it is asked for, set-based, one pass per
-- category, so it is always right; a cache would have to be filtered per
-- viewer anyway, because blocks and "friends" change who is on a list. At
-- today's size that is milliseconds. Measured on Postgres 17 against a load
-- far past it - 2,000 lifters, 160,000 workouts, 1.9 million sets - a
-- centre's four cards take 0.2 s, a country's lists 0.2-2.5 s and a
-- country's four cards about 7 s, against the 8 s statement timeout. Long
-- before that size, the next step is a 15-minute cache of the cards per
-- level with `me` computed per viewer, or indexes on
-- exercise_instance.cloud_workout_type_instance_id and
-- set.cloud_exercise_instance_id (created concurrently, in a file of their
-- own).
--
-- Until this has run, the app gets "function does not exist" (PGRST202) and
-- "column does not exist" (42703): the Centres levels and category pages read
-- as not available yet, and nothing else changes. The gym importer writes the
-- two new columns, so run it only after this. Safe to run twice.

begin;

-- gym is read on every workout start (match_gym). A busy moment makes this
-- give up rather than queue in front of the app - the lesson of
-- 20260921180000_music-opt-in.sql.
set local lock_timeout = '5s';

create schema if not exists private;

/* ------------------------------------------------------ where a centre is -- */

alter table public.gym
  add column if not exists country_code text not null default 'DK';
alter table public.gym
  add column if not exists region_key text;

comment on column public.gym.country_code is
  'ISO 3166-1 alpha-2, upper case. Every centre in data/gyms is Danish, which is the default.';
comment on column public.gym.region_key is
  'The region inside the country, a key into public.gym_region. Null shows the centre on the country level only.';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'gym_country_code_iso'
      and conrelid = 'public.gym'::regclass
  ) then
    alter table public.gym
      add constraint gym_country_code_iso
      check (country_code ~ '^[A-Z]{2}$');
  end if;
end;
$$;

create index if not exists gym_scope_idx on public.gym (country_code, region_key);

/* ------------------------------------------------------------- regions -- */

-- A region's name and its "in {region}" phrase, because the preposition is
-- part of the place in both languages: "på Sjælland" but "i Jylland", "on
-- Zealand" but "in Jutland". The app reads them through gym_scope_summary in
-- the language it is in.
create table if not exists public.gym_region (
  country_code text not null,
  region_key   text not null,
  name_da      text not null,
  name_en      text not null,
  where_da     text not null,
  where_en     text not null,
  sort_order   integer not null default 0,
  primary key (country_code, region_key)
);

insert into public.gym_region (country_code, region_key, name_da, name_en, where_da, where_en, sort_order)
values
  ('DK', 'sjaelland', 'Sjælland', 'Zealand', 'på Sjælland', 'on Zealand', 1),
  ('DK', 'jylland', 'Jylland', 'Jutland', 'i Jylland', 'in Jutland', 2),
  ('DK', 'fyn', 'Fyn', 'Funen', 'på Fyn', 'on Funen', 3),
  ('DK', 'bornholm', 'Bornholm', 'Bornholm', 'på Bornholm', 'on Bornholm', 4)
on conflict (country_code, region_key) do update
set name_da = excluded.name_da,
    name_en = excluded.name_en,
    where_da = excluded.where_da,
    where_en = excluded.where_en,
    sort_order = excluded.sort_order;

alter table public.gym_region enable row level security;

-- Readable by anyone signed in, written by nobody in the app: new countries
-- and regions come from the SQL editor, like the centres from the importer.
revoke all on public.gym_region from anon, authenticated;
grant select on public.gym_region to authenticated;

drop policy if exists "Regions are viewable by authenticated users" on public.gym_region;
create policy "Regions are viewable by authenticated users"
on public.gym_region
for select
to authenticated
using (true);

-- The four Danish landsdele from the postal code, only where nothing has set
-- a region yet and the code is four digits. First match wins, so Bornholm is
-- carved out of the Zealand range before it (the ranges include
-- Lolland-Falster and Møn). The same ranges, in the same order, as
-- scripts/import-gyms/regions.js - scripts/test-gym-categories.js reads the
-- lines below and fails if the two disagree.
--
-- Materialized so the cast only ever sees a four-digit code: Postgres does
-- not promise the order it checks a where clause in.
with coded as materialized (
  select gym.id, btrim(gym.postal_code)::integer as code
  from public.gym gym
  where gym.country_code = 'DK'
    and gym.region_key is null
    and btrim(gym.postal_code) ~ '^[0-9]{4}$'
)
update public.gym gym
set region_key = case
      when coded.code between 3700 and 3799 then 'bornholm'
      when coded.code between 1000 and 4999 then 'sjaelland'
      when coded.code between 5000 and 5999 then 'fyn'
      when coded.code between 6000 and 9999 then 'jylland'
    end
from coded
where coded.id = gym.id
  and coded.code between 1000 and 9999;

-- A region key has to be one the country has, or the centre would vanish from
-- its region without anything failing. A centre without one (null) is not
-- checked, and shows on the country level only.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'gym_region_known'
      and conrelid = 'public.gym'::regclass
  ) then
    alter table public.gym
      add constraint gym_region_known
      foreign key (country_code, region_key)
      references public.gym_region (country_code, region_key)
      on update cascade;
  end if;
end;
$$;

/* ---------------------------------------------------- calisthenics events -- */

-- Which catalogue exercises count as pull-ups, dips and push-ups, and what one
-- rep of each is worth. A table rather than constants in a function so the
-- list and the factors can change without an app release or a migration:
-- an exercise added to the catalogue later, or a factor the spec's open point
-- 4 settles differently, is one row in the SQL editor. In private, where
-- PostgREST cannot reach; only the functions below read it.
create table if not exists private.calisthenics_event (
  exercise_id bigint primary key references public."Exercise"(id) on delete cascade,
  event       text not null check (event in ('pullups', 'dips', 'pushups')),
  factor      numeric not null check (factor > 0)
);

comment on table private.calisthenics_event is
  'Catalogue exercises that count in Calisthenics, the event each is and the points per rep. Edit here to change the list without an app release; CALISTHENICS_FACTORS in src/Utils/gymCategories.js is the app''s copy of the defaults.';

alter table private.calisthenics_event enable row level security;
revoke all on private.calisthenics_event from public, anon, authenticated;

-- The exact spellings, matched the way a workout names its exercises. Not
-- chin-ups, which are a different pull, and not bench dips, which are not a
-- dip on bars. Existing rows are left alone, so a factor changed by hand
-- survives the second run.
insert into private.calisthenics_event (exercise_id, event, factor)
select exercise.id, spelling.event, spelling.factor
from public."Exercise" exercise
join (
  values
    ('pull up', 'pullups', 3),
    ('pull-up', 'pullups', 3),
    ('pull ups', 'pullups', 3),
    ('pull-ups', 'pullups', 3),
    ('pullup', 'pullups', 3),
    ('pullups', 'pullups', 3),
    ('dips', 'dips', 2),
    ('dip', 'dips', 2),
    ('chest dips', 'dips', 2),
    ('tricep dips', 'dips', 2),
    ('triceps dips', 'dips', 2),
    ('parallel bar dips', 'dips', 2),
    ('push up', 'pushups', 1),
    ('push-up', 'pushups', 1),
    ('push ups', 'pushups', 1),
    ('push-ups', 'pushups', 1),
    ('pushup', 'pushups', 1),
    ('pushups', 'pushups', 1),
    ('armstrækninger', 'pushups', 1)
) as spelling(name, event, factor)
  on lower(btrim(exercise.name)) = spelling.name
on conflict (exercise_id) do nothing;

/* ---------------------------------------------------------------- scope -- */

-- The public centres inside a level: every one for the world, a country's, a
-- region's, or one centre. Anything else is no centres at all.
create or replace function private.scope_gyms(
  p_level text,
  p_country text,
  p_region text,
  p_gym_id bigint
)
returns table (gym_id bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select gym.id
  from public.gym gym
  where gym.is_public
    and case p_level
      when 'world' then true
      when 'country' then gym.country_code = upper(btrim(p_country))
      when 'region' then gym.country_code = upper(btrim(p_country))
                     and gym.region_key = lower(btrim(p_region))
      when 'gym' then gym.id = p_gym_id
      else false
    end;
$$;

revoke all on function private.scope_gyms(text, text, text, bigint) from public, anon, authenticated;

-- Who is on the lists at a level, as the viewer may see them: a finished,
-- not-deleted workout at one of its centres in the last 90 days
-- (SCOPE_ACTIVE_DAYS), nobody blocked either way, and with p_friends_only
-- only the viewer and the people the viewer follows.
--
-- For each: their sex and age group, from profile_private and never handed
-- out - only whether they pass the filter does (in_filter); and their centre
-- in the level, which is the name on their row - their own centre when it is
-- inside, otherwise the one they trained in most there, ties by short name.
--
--   gender     all, men (sex male) or women (sex female). Without a sex a
--              person is only in all.
--   age group  all, u23, 23-39 or 40+, from the birth year against this year
--              in Copenhagen. Without a birth year only in all.
--
-- `done::text` as in 20260924090000: these columns predate the migrations
-- folder and their type is not written down; cast to text, a boolean and an
-- integer both compare. is_deleting is a boolean (20260515150145) and is
-- compared as one, so the sync indexes' `where is_deleting = false` applies.
create or replace function private.scope_members(
  p_viewer uuid,
  p_level text,
  p_country text,
  p_region text,
  p_gym_id bigint,
  p_friends_only boolean,
  p_gender text,
  p_age_group text
)
returns table (
  member_id uuid,
  sex text,
  age_group text,
  centre_id bigint,
  centre_short_name text,
  in_filter boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/Copenhagen')::date as day
  ),
  scope as materialized (
    select gym.id as gym_id, gym.short_name
    from private.scope_gyms(p_level, p_country, p_region, p_gym_id) scoped
    join public.gym gym on gym.id = scoped.gym_id
  ),
  visits as materialized (
    select workout.user_id, workout.gym_id, count(*) as workouts
    from public.workout_type_instance workout
    join scope on scope.gym_id = workout.gym_id
    where workout.done::text in ('true', '1', 't')
      and workout.deleted_at is null
      and workout.is_deleting = false
      and workout.date::date >= (select today.day from today) - 90
    group by workout.user_id, workout.gym_id
  ),
  people as (
    select distinct visits.user_id
    from visits
  ),
  allowed as (
    select people.user_id
    from people
    where p_viewer is not null
      and (
        people.user_id = p_viewer
        or not private.blocked_between(p_viewer, people.user_id)
      )
      and (
        not coalesce(p_friends_only, false)
        or people.user_id = p_viewer
        or exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = p_viewer
            and follow.following_id = people.user_id
        )
      )
  ),
  favourite as (
    select distinct on (visits.user_id) visits.user_id, visits.gym_id, scope.short_name
    from visits
    join scope on scope.gym_id = visits.gym_id
    order by visits.user_id, visits.workouts desc, scope.short_name asc, visits.gym_id asc
  ),
  described as (
    select
      allowed.user_id,
      settings.sex,
      case
        when settings.birth_date is null then null
        when extract(year from (select today.day from today)) - extract(year from settings.birth_date) < 23 then 'u23'
        when extract(year from (select today.day from today)) - extract(year from settings.birth_date) < 40 then '23-39'
        else '40+'
      end as age_group,
      coalesce(home.gym_id, favourite.gym_id) as centre_id,
      coalesce(home.short_name, favourite.short_name) as centre_short_name
    from allowed
    join favourite on favourite.user_id = allowed.user_id
    left join public.profile_private settings on settings.user_id = allowed.user_id
    left join scope home on home.gym_id = settings.home_gym_id
  )
  select
    described.user_id,
    described.sex,
    described.age_group,
    described.centre_id,
    described.centre_short_name,
    (
      coalesce(p_gender, 'all') not in ('men', 'women')
      or (p_gender = 'men' and described.sex is not distinct from 'male')
      or (p_gender = 'women' and described.sex is not distinct from 'female')
    )
    and (
      coalesce(p_age_group, 'all') not in ('u23', '23-39', '40+')
      or described.age_group is not distinct from p_age_group
    )
  from described;
$$;

revoke all on function private.scope_members(uuid, text, text, text, bigint, boolean, text, text)
  from public, anon, authenticated;

/* ---------------------------------------------------------- the values -- */

-- One row per member of the level: their value in one category under its
-- filters, when they reached it (the tie-breaker - the earlier one ranks
-- first), what their row says (detail), and for the viewer the personal card
-- (breakdown). Every member comes back, whether or not they have a value; the
-- lists rank those with in_filter and a value above 0. A set counts when it
-- is done and not failed, a working or AMRAP set (a warm-up is below what you
-- can do and a drop set the easier half of one - canBePersonalRecord in
-- src/Utils/setTypes.js), with a positive weight where weight is the point,
-- in a finished workout; nothing deleted, and every row owned by the member
-- all the way down, so nobody's sets can be hung on somebody else's workout.
--
--   flid           p_filters {tab: workouts | streak, period: week | month |
--                  year, age_group}. Finished workouts of any type, wherever,
--                  in Copenhagen time. Workouts is the count in the current
--                  calendar week, month or year. A streak is Monday-based
--                  weeks with at least three workouts (STREAK_MIN_WORKOUTS),
--                  counted back from last week, with this week added once it
--                  has its three - so a week in progress never breaks it.
--                  Sickness lives on the phone, so a sick week breaks the
--                  streak here; that is accepted.
--   powerlifting   p_filters {age_group, only_video}. The best single (reps
--                  = 1, no estimate) in bench press, squat and deadlift, in a
--                  workout at a centre in the level; a missing lift is 0.
--                  only_video counts the verified gym_lift singles instead.
--   fremgang       p_filters {tab: all | bench | squat | deadlift}. The best
--                  e1RM (Brzycki, reps 1-12, as the rest of the app) of the
--                  last 30 days against the 30 before, from all of the
--                  person's workouts; each window needs three sets of the
--                  lift. No age filter, as on the page.
--   calisthenics   p_filters {age_group}. The most reps in one set without
--                  added weight, per event, at centres in the level, all
--                  time, times the event's factor.
--
-- How it stays fast. The members are worked out once, as arrays, and every
-- table is narrowed by their ids before anything is joined - the user_id
-- indexes the sync already keeps answer that, so a centre's forty people
-- read forty people's sets, not everybody's. The two settings on the
-- function are deliberate:
--   * plan_cache_mode = force_custom_plan, so each call is planned with the
--     arrays it has - forty ids or four thousand - instead of a plan cached
--     for whichever it saw first.
--   * enable_nestloop = off. The joins are on keys the planner cannot
--     estimate - flags compared as text, names through lower(btrim()), an
--     owner that is the same person on both sides - so it guesses one row
--     where there are half a million and picks a nested loop. Measured on
--     1.9 million sets: over a minute for a country's list with it, two
--     seconds without. Hash joins cost the same whatever the guess. The
--     setting holds inside this function and what it calls, nowhere else.
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
        (array_agg(finished.day order by finished.day))[3] as third_day
      from finished
      group by finished.user_id, date_trunc('week', finished.day::timestamp)::date
    ),
    -- Weeks with enough workouts before this one, newest first. A run of
    -- them from last week has weeks_ago 1, 2, 3 ... in step with its place.
    earlier as (
      select
        weekly.user_id,
        weekly.third_day,
        (v_week_start - weekly.week_start) / 7 as weeks_ago,
        row_number() over (partition by weekly.user_id order by weekly.week_start desc) as place
      from weekly
      where weekly.workouts >= 3
        and weekly.week_start < v_week_start
    ),
    streak_run as (
      select
        earlier.user_id,
        count(*)::integer as weeks,
        max(earlier.third_day) filter (where earlier.weeks_ago = 1) as last_week_third
      from earlier
      where earlier.weeks_ago = earlier.place
      group by earlier.user_id
    ),
    this_week as (
      select weekly.user_id, weekly.third_day
      from weekly
      where weekly.week_start = v_week_start
        and weekly.workouts >= 3
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
        -- The streak reached its length when its newest week got its third
        -- workout.
        coalesce(this_week.third_day, streak_run.last_week_third) as streak_day
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

    return query
    with members as (
      select *
      from unnest(v_ids, v_centres, v_centre_names, v_in_filter)
        as listed(member_id, centre_id, centre_short_name, in_filter)
    ),
    featured as (
      select
        lower(fe.exercise_name) as name_key,
        (array['bench', 'squat', 'deadlift'])[fe.sort_order] as lift
      from private.featured_exercises() fe
    ),
    -- The last 60 days of their working and AMRAP sets in the three lifts,
    -- wherever they trained, as an estimated one-rep max. Brzycki, as
    -- src/Utils/oneRepMaxUtils.js computes it, and only up to 12 reps
    -- (MAX_ESTIMATE_REPS there, PROGRESS_MAX_REPS in gymCategories.js).
    workouts as materialized (
      select workout.id, workout.user_id, workout.date::date as day
      from public.workout_type_instance workout
      where workout.user_id = any(v_ids)
        and workout.date::date between v_today - 59 and v_today
        and workout.done::text in ('true', '1', 't')
        and workout.deleted_at is null
        and workout.is_deleting = false
    ),
    lifts as materialized (
      select instance.id, workouts.user_id, workouts.day, featured.lift
      from public.exercise_instance instance
      join workouts
        on workouts.id = instance.cloud_workout_type_instance_id
       and workouts.user_id = instance.user_id
      join featured on featured.name_key = lower(btrim(instance.exercise_name))
      where instance.user_id = any(v_ids)
        and instance.deleted_at is null
        and instance.is_deleting = false
    ),
    logged as materialized (
      select
        lifts.user_id,
        lifts.lift,
        lifts.day,
        logged_set.weight::numeric / (1.0278 - 0.0278 * logged_set.reps) as e1rm
      from public."set" logged_set
      join lifts
        on lifts.id = logged_set.cloud_exercise_instance_id
       and lifts.user_id = logged_set.user_id
      where logged_set.user_id = any(v_ids)
        and logged_set.deleted_at is null
        and logged_set.is_deleting = false
        and logged_set.reps between 1 and 12
        and logged_set.weight > 0
        and logged_set.done::text in ('true', '1', 't')
        and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
        and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
    ),
    -- Window A is the last 30 days including today, window B the 30 before
    -- (PROGRESS_WINDOW_DAYS). Each needs three sets of the lift
    -- (PROGRESS_MIN_SETS), so one heavy day after a quiet month is not +300 %.
    windows as (
      select
        logged.user_id,
        logged.lift,
        max(logged.e1rm) filter (where logged.day >= v_today - 29) as now_best,
        count(*) filter (where logged.day >= v_today - 29) as now_sets,
        max(logged.e1rm) filter (where logged.day < v_today - 29) as before_best,
        count(*) filter (where logged.day < v_today - 29) as before_sets
      from logged
      group by logged.user_id, logged.lift
    ),
    qualified as (
      select windows.*
      from windows
      where windows.now_sets >= 3
        and windows.before_sets >= 3
        and windows.before_best > 0
    ),
    reached as (
      select logged.user_id, logged.lift, min(logged.day) as day
      from logged
      join qualified
        on qualified.user_id = logged.user_id
       and qualified.lift = logged.lift
      where logged.day >= v_today - 29
        and logged.e1rm = qualified.now_best
      group by logged.user_id, logged.lift
    ),
    rises as (
      select
        qualified.user_id,
        qualified.lift,
        round(round(qualified.before_best * 2) / 2, 1) as before_kg,
        round(round(qualified.now_best * 2) / 2, 1) as now_kg,
        round((qualified.now_best - qualified.before_best) / qualified.before_best * 100) as percent,
        reached.day as reached_day
      from qualified
      join reached
        on reached.user_id = qualified.user_id
       and reached.lift = qualified.lift
    ),
    -- "All lifts" is the person's largest rise and which lift it was; a tab
    -- is that one lift.
    chosen as (
      select distinct on (rises.user_id) rises.*
      from rises
      where v_tab = 'all' or rises.lift = v_tab
      order by rises.user_id, rises.percent desc, array_position(array['bench', 'squat', 'deadlift'], rises.lift)
    ),
    mine as (
      select jsonb_object_agg(
        rises.lift,
        jsonb_build_object('before', rises.before_kg, 'now', rises.now_kg, 'percent', rises.percent)
      ) as parts
      from rises
      where rises.user_id = p_viewer
    )
    select
      members.member_id,
      chosen.percent,
      chosen.reached_day::timestamp at time zone 'Europe/Copenhagen',
      case
        when chosen.user_id is null then null
        else jsonb_build_object(
          'lift', chosen.lift,
          'before', chosen.before_kg,
          'now', chosen.now_kg,
          'percent', chosen.percent
        )
      end,
      case
        when members.member_id = p_viewer then jsonb_build_object(
          'bench', (select mine.parts -> 'bench' from mine),
          'squat', (select mine.parts -> 'squat' from mine),
          'deadlift', (select mine.parts -> 'deadlift' from mine)
        )
      end,
      members.centre_id,
      members.centre_short_name,
      members.in_filter
    from members
    left join chosen on chosen.user_id = members.member_id;

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

-- The list itself: category_rows ranked. Somebody is on it with a value above
-- 0 under the filter. Value first, then whoever got there first, then the id,
-- so a place is never shared and the order never changes between two reads -
-- the same tie-break as private.ranked_lifts. place is null for everybody
-- else, the viewer included when the filter leaves them out.
create or replace function private.category_ranking(
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
  place bigint,
  score numeric,
  achieved_at timestamptz,
  detail jsonb,
  breakdown jsonb,
  centre_id bigint,
  centre_short_name text,
  in_filter boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with board as materialized (
    select *
    from private.category_rows(
      p_viewer, p_category, p_level, p_country, p_region, p_gym_id, p_gender, p_filters, p_friends_only
    )
  ),
  listed as (
    select
      board.member_id,
      rank() over (
        order by board.score desc, board.achieved_at asc nulls last, board.member_id asc
      ) as place
    from board
    where board.in_filter
      and board.score > 0
  )
  select
    board.member_id,
    listed.place,
    board.score,
    board.achieved_at,
    board.detail,
    board.breakdown,
    board.centre_id,
    board.centre_short_name,
    board.in_filter
  from board
  left join listed on listed.member_id = board.member_id;
$$;

revoke all on function private.category_ranking(uuid, text, text, text, text, bigint, text, jsonb, boolean)
  from public, anon, authenticated;

-- A person on a list, as the client receives them: the four fields
-- public_profile also gives a stranger, and nothing from profile_private.
create or replace function private.category_person(target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', profile.id,
    'display_name', profile.display_name,
    'username', profile.username,
    'avatar_path', profile.avatar_path
  )
  from public.profiles profile
  where profile.id = target_user_id;
$$;

revoke all on function private.category_person(uuid) from public, anon, authenticated;

/* ------------------------------------------------------ gym_scope_summary -- */

-- What a level holds, with counts. Lifters are the people with a lift on a
-- centre's board that was not rejected (gym_lift), minus anybody blocked
-- either way with the viewer.
--
--   world    countries[{code, gym_count, lifter_count, is_yours}]: only
--            countries with lifters, most lifters first. is_yours is the
--            country of the viewer's own centre.
--   country  country{code, gym_count, lifter_count} and regions[{key,
--            name_da, name_en, where_da, where_en, gym_count, lifter_count}]
--            in the country's order, only regions with a centre.
--   region   country{code}, region{key, names, gym_count} (null for a
--            region the country does not have), gyms[{id, name, short_name,
--            chain, city, image_url, lifter_count}], most lifters first.
--   gym      country{code}, region{key, names} or null, gym{id, name,
--            short_name}; all null for a centre that is not public.
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
        and lift.video_status <> 'rejected'
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
      where lift.video_status <> 'rejected'
        and not exists (select 1 from hidden where hidden.user_id = lift.user_id)
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
            and lift.video_status <> 'rejected'
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

/* ----------------------------------------------------- gym_category_cards -- */

-- The four cards of a level, most participants first: how many are on each
-- list, who leads it, and where the viewer stands. Each card is its
-- category's list under its default filters - Consistency by workouts this
-- month, Powerlifting all lifts, Progress all lifts, all ages.
--
--   top  {user, value, gym_short_name, detail, is_me} of #1, or null for an
--        empty list
--   me   {rank, value, total, in_scope, in_filter, progress}: in_scope false
--        when the viewer has not trained at the level in 90 days ("not on
--        Funen"), rank null when they are not on the list, progress their
--        value as a share of #1's.
create or replace function public.gym_category_cards(
  p_level text,
  p_country text default null,
  p_region text default null,
  p_gym_id bigint default null,
  p_gender text default 'all',
  p_friends_only boolean default false
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
  result jsonb;
begin
  if viewer_id is null then
    return null;
  end if;

  with categories (category, sort_order) as (
    values ('flid', 1), ('powerlifting', 2), ('fremgang', 3), ('calisthenics', 4)
  ),
  cards as (
    select categories.category, categories.sort_order, card.*
    from categories
    cross join lateral (
      with board as materialized (
        select *
        from private.category_ranking(
          viewer_id, categories.category, p_level, p_country, p_region, p_gym_id,
          p_gender, '{}'::jsonb, p_friends_only
        )
      ),
      leader as (
        select board.*
        from board
        where board.place = 1
      )
      select
        (select count(*)::integer from board where board.place is not null) as participant_count,
        (
          select jsonb_build_object(
            'user', private.category_person(leader.member_id),
            'value', leader.score,
            'gym_short_name', leader.centre_short_name,
            'detail', leader.detail,
            'is_me', leader.member_id = viewer_id
          )
          from leader
        ) as top_json,
        (
          select jsonb_build_object(
            'rank', board.place,
            'value', board.score,
            'in_scope', true,
            'in_filter', board.in_filter,
            'progress', case
              when board.place is null then null
              when (select leader.score from leader) > 0
                then round(least(1, greatest(0, board.score / (select leader.score from leader))), 4)
            end
          )
          from board
          where board.member_id = viewer_id
        ) as me_json
    ) card
  )
  select jsonb_build_object(
    'cards',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', cards.category,
          'participant_count', cards.participant_count,
          'top', cards.top_json,
          'me', coalesce(
            cards.me_json,
            jsonb_build_object('rank', null, 'value', null, 'in_scope', false, 'in_filter', false, 'progress', null)
          ) || jsonb_build_object('total', cards.participant_count)
        )
        order by cards.participant_count desc, cards.sort_order asc
      ),
      '[]'::jsonb
    )
  )
  into result
  from cards;

  return result;
end;
$$;

revoke all on function public.gym_category_cards(text, text, text, bigint, text, boolean) from public, anon;
grant execute on function public.gym_category_cards(text, text, text, bigint, text, boolean) to authenticated;

/* ----------------------------------------------- gym_category_leaderboard -- */

-- One category's list at a level: the podium (up to three; none for
-- Progress, whose page puts the personal card there), the rows after it up
-- to p_limit places in all, how many are on it, and the viewer.
--
--   row  {rank, user, value, gym_short_name, detail, is_me}
--   me   the viewer's row whenever they are a member of the level - also in
--        the top three - with gap_to_next (the value between them and the
--        place above, null at #1 and off the list), in_filter (false when
--        the filter leaves them out; rank is then null) and breakdown (the
--        personal card for Progress and Calisthenics). Null when the viewer
--        has not trained at the level.
--
-- Powerlifting adds home_gym_rank to the viewer's detail: their place on the
-- same list at their own centre, when they have one and are on it.
create or replace function public.gym_category_leaderboard(
  p_category text,
  p_level text,
  p_country text default null,
  p_region text default null,
  p_gym_id bigint default null,
  p_gender text default 'all',
  p_filters jsonb default '{}'::jsonb,
  p_friends_only boolean default false,
  p_limit integer default 50
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
  v_category text := case
    when p_category in ('flid', 'powerlifting', 'fremgang', 'calisthenics') then p_category
  end;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_home_gym_id bigint;
  v_home_rank bigint;
  result jsonb;
begin
  if viewer_id is null or v_category is null then
    return null;
  end if;

  with board as materialized (
    select *
    from private.category_ranking(
      viewer_id, v_category, p_level, p_country, p_region, p_gym_id,
      p_gender, coalesce(p_filters, '{}'::jsonb), p_friends_only
    )
  ),
  page as (
    select
      board.*,
      jsonb_build_object(
        'rank', board.place,
        'user', private.category_person(board.member_id),
        'value', board.score,
        'gym_short_name', board.centre_short_name,
        'detail', board.detail,
        'is_me', board.member_id = viewer_id
      ) as row_json
    from board
    where board.place <= safe_limit
  ),
  mine as (
    select
      board.*,
      (
        select above.score
        from board above
        where above.place = board.place - 1
      ) - board.score as gap_to_next
    from board
    where board.member_id = viewer_id
  )
  select jsonb_build_object(
    'category', v_category,
    'total', (select count(*)::integer from board where board.place is not null),
    'podium', case
      when v_category = 'fremgang' then '[]'::jsonb
      else coalesce(
        (select jsonb_agg(page.row_json order by page.place) from page where page.place <= 3),
        '[]'::jsonb
      )
    end,
    'rows', coalesce(
      (
        select jsonb_agg(page.row_json order by page.place)
        from page
        where v_category = 'fremgang' or page.place > 3
      ),
      '[]'::jsonb
    ),
    'me', (
      select jsonb_build_object(
        'rank', mine.place,
        'user', private.category_person(mine.member_id),
        'value', mine.score,
        'gym_short_name', mine.centre_short_name,
        'detail', mine.detail,
        'is_me', true,
        'gap_to_next', mine.gap_to_next,
        'in_filter', mine.in_filter,
        'breakdown', mine.breakdown
      )
      from mine
    )
  )
  into result;

  if v_category = 'powerlifting' and result -> 'me' is not null and jsonb_typeof(result -> 'me') = 'object' then
    v_home_gym_id := private.home_gym_id_for(viewer_id);

    if v_home_gym_id is not null then
      if p_level = 'gym' and p_gym_id = v_home_gym_id then
        v_home_rank := (result -> 'me' ->> 'rank')::bigint;
      else
        select ranking.place
        into v_home_rank
        from private.category_ranking(
          viewer_id, 'powerlifting', 'gym', null, null, v_home_gym_id,
          p_gender, coalesce(p_filters, '{}'::jsonb), p_friends_only
        ) ranking
        where ranking.member_id = viewer_id;
      end if;
    end if;

    result := jsonb_set(
      result,
      '{me,detail}',
      coalesce(result -> 'me' -> 'detail', '{}'::jsonb) || jsonb_build_object('home_gym_rank', v_home_rank)
    );
  end if;

  return result;
end;
$$;

revoke all on function public.gym_category_leaderboard(text, text, text, text, bigint, text, jsonb, boolean, integer)
  from public, anon;
grant execute on function public.gym_category_leaderboard(text, text, text, text, bigint, text, jsonb, boolean, integer)
  to authenticated;

commit;

notify pgrst, 'reload schema';

-- Check afterwards, in the SQL editor. All of these only read.
--
-- The centres by country and region. Every Danish centre should have one of
-- the four regions; the second query should return no rows.
--
--   select country_code, region_key, count(*) as centres
--   from public.gym group by country_code, region_key order by 1, 2;
--
--   select id, chain, name, postal_code
--   from public.gym where country_code = 'DK' and region_key is null;
--
-- How many catalogue exercises each calisthenics event matched by name. A
-- zero means the catalogue spells it some other way: add a row by hand.
--
--   select wanted.event, count(event.exercise_id) as matched,
--          string_agg(exercise.name, ', ' order by exercise.name) as exercises
--   from (values ('pullups'), ('dips'), ('pushups')) as wanted(event)
--   left join private.calisthenics_event event on event.event = wanted.event
--   left join public."Exercise" exercise on exercise.id = event.exercise_id
--   group by wanted.event order by wanted.event;
