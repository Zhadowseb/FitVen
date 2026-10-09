-- Exercises people make can be shared, found, added as a copy, saved and
-- reported.
--
-- Run after 20260927110000_a-block-hides-public-posts-too.sql. That is the
-- order, not a dependency. What this does depend on is already live:
-- private.blocked_between and private.home_gym_id_for from
-- 20260917120000_gyms-and-lift-verification.sql, the notification tables from
-- 20260609112712_workout-start-notifications.sql and
-- 20260610205948_notification-history.sql, and private.contains_blocked_term
-- from 20260912220000_ugc-safety.sql.
--
-- Until now a custom exercise lived in one place, the phone's own database. It
-- held a name and its muscles, nothing of it reached the cloud, and a new phone
-- lost it. This gives it a cloud half, public.custom_exercise, and every custom
-- exercise goes there - private by default, so it comes back after a
-- reinstall. Sharing is one column the owner sets: is_public.
--
-- Not public."Exercise". That is the shared catalog every user downloads in
-- full: an old app build would pull everybody's exercises into its catalog,
-- its name uniqueness would collide across people, and the leaderboards key on
-- it. The owner column is user_id, not owner_id, so the account purge
-- (private.purge_user_data deletes by user_id) erases these rows with the
-- rest.
--
-- What it adds:
--   * custom_exercise - one row per exercise, and the table answers for your
--     own rows only. Adding somebody's exercise makes a copy owned by the
--     person adding it, with source_exercise_id pointing at the original; a
--     copy can never be shared, and adopter_count on the original counts them.
--   * custom_exercise_save and custom_exercise_report - the saved list and the
--     reports, reached through the functions below and nothing else.
--   * private.custom_exercise_stats - the typical sets, reps and weight, the
--     weight distribution and the users per centre, computed here and cached
--     for a day, so the list never asks for them row by row.
--   * browse_custom_exercises, custom_exercise_detail, adopt_custom_exercise,
--     set_custom_exercise_saved and report_custom_exercise - the only way to
--     read somebody else's exercise. Security definer, like public_profile,
--     and each hands out a fixed set of fields.
--   * the exercise-videos bucket: private, written only in your own folder,
--     and a file readable by others only while its exercise is.
--
-- "Visible" means shared, not hidden, not a copy, and no block between the
-- owner and the viewer either way. The block goes through the security definer
-- private.blocked_between, never through a policy expression (src/AGENTS.md).
-- The one exception is custom_exercise_detail, which shows the owner their own
-- exercise whatever its state, so they can see it the way others do.
--
-- Three different people reporting an exercise hide it (hidden_at) and tell
-- the owner through the notification inbox. The copies people already added
-- stay where they are.
--
-- Until this has run, the app gets "function does not exist" and "relation
-- does not exist". The library and an exercise page read as not available
-- yet, sharing, adding, saving and reporting say the same, and custom
-- exercises stay on the phone as before - the sync tries again on the next
-- launch. Nothing else changes. Safe to run twice.

begin;

create schema if not exists private;

/* ------------------------------------------------------- the step rule -- */

-- A check constraint cannot hold a subquery, so the rule for the steps lives
-- in a function: at most five, each one 1 to 140 characters and not blank.
-- The same limits as MAX_STEPS and STEP_MAX_LENGTH in
-- src/Utils/customExercises.js - a limit changed in one place only is a save
-- that works on the phone and fails here.
create or replace function private.custom_exercise_steps_are_valid(candidate text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_ndims(candidate), 1) = 1
     and coalesce(array_length(candidate, 1), 0) <= 5
     and not exists (
       select 1
       from unnest(candidate) as step(content)
       where step.content is null
          or btrim(step.content) = ''
          or char_length(step.content) > 140
     );
$$;

-- Unlike every other helper here, this one stays callable by authenticated. A
-- check constraint is evaluated as the person writing the row - the same trap
-- 20260921200000_let-the-policy-call-its-own-check.sql fell into with a
-- policy - so without execute every insert would fail with "permission denied
-- for function". It reads nothing and decides only about its argument.
revoke all on function private.custom_exercise_steps_are_valid(text[]) from public, anon;
grant execute on function private.custom_exercise_steps_are_valid(text[]) to authenticated, service_role;

/* ------------------------------------------------------ custom_exercise -- */

create table if not exists public.custom_exercise (
  id                 bigint generated by default as identity primary key,
  user_id            uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name               text not null,
  description        text,
  muscle_group_keys  jsonb not null default '{"primary": [], "secondary": []}'::jsonb,
  equipment          text,
  weight_mode        text not null default 'total',
  steps              text[] not null default '{}',
  video_path         text,
  poster_path        text,
  video_duration_ms  integer,
  is_public          boolean not null default false,
  shared_at          timestamptz,
  source_exercise_id bigint references public.custom_exercise(id) on delete set null,
  adopter_count      integer not null default 0,
  hidden_at          timestamptz,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

comment on column public.custom_exercise.source_exercise_id is
  'Set on a copy somebody added: the exercise it was copied from. A copy is '
  'never shared. Null again when the original is deleted - the copy stays.';

comment on column public.custom_exercise.hidden_at is
  'Set once three different people have reported the exercise. It leaves the '
  'library for everyone; the owner still sees it, and copies stay.';

-- The limits the app holds as well (src/Utils/customExercises.js). Checked
-- here because the API answers an HTTP client with the anon key, so the app
-- always sending the right values is not a guard.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_name_valid'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_name_valid
      check (name = btrim(name) and char_length(name) between 2 and 80);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_description_length'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_description_length
      check (description is null or char_length(description) <= 120);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_muscles_are_an_object'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_muscles_are_an_object
      check (jsonb_typeof(muscle_group_keys) = 'object');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_equipment_known'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_equipment_known
      check (
        equipment is null
        or equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'band', 'none', 'other')
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_weight_mode_known'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_weight_mode_known
      check (weight_mode in ('total', 'per_side', 'bodyweight'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_steps_valid'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_steps_valid
      check (private.custom_exercise_steps_are_valid(steps));
  end if;

  -- The rule storage.objects enforces on the upload, applied to the row that
  -- points at it - the lesson of 20260921140000: without it you upload into
  -- your own folder and then point your row at somebody else's file.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_video_is_own_upload'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_video_is_own_upload
      check (video_path is null or starts_with(video_path, user_id::text || '/'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_poster_is_own_upload'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_poster_is_own_upload
      check (poster_path is null or starts_with(poster_path, user_id::text || '/'));
  end if;

  -- 20 seconds, and one more for what the picker's trim leaves over.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_video_duration'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_video_duration
      check (video_duration_ms is null or video_duration_ms between 1 and 21000);
  end if;

  -- The app names this constraint when it explains why a copy cannot be
  -- shared (src/Services/exerciseService.js).
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_copy_is_private'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_copy_is_private
      check (not (is_public and source_exercise_id is not null));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_adopter_count_nonnegative'
      and conrelid = 'public.custom_exercise'::regclass
  ) then
    alter table public.custom_exercise
      add constraint custom_exercise_adopter_count_nonnegative
      check (adopter_count >= 0);
  end if;
end;
$$;

-- Names are unique per person whatever the case, as they are on the phone,
-- where every table links to an exercise by its name. Leading with user_id,
-- this is also the index behind every lookup by owner - the own-rows policies
-- and the account purge - so there is no separate one on user_id.
create unique index if not exists custom_exercise_user_name_key
  on public.custom_exercise (user_id, lower(name));

-- The library's two orders, over only what it can show.
create index if not exists custom_exercise_popular_idx
  on public.custom_exercise (adopter_count desc, id desc)
  where is_public and hidden_at is null and source_exercise_id is null;

create index if not exists custom_exercise_newest_idx
  on public.custom_exercise (shared_at desc, id desc)
  where is_public and hidden_at is null and source_exercise_id is null;

-- A copy's original, for "have I added it", the users of an exercise, and the
-- set null when an original is deleted.
create index if not exists custom_exercise_source_idx
  on public.custom_exercise (source_exercise_id)
  where source_exercise_id is not null;

-- The storage read policy below asks which exercise a file belongs to, once
-- for every file that is signed.
create index if not exists custom_exercise_video_path_idx
  on public.custom_exercise (video_path)
  where video_path is not null;

create index if not exists custom_exercise_poster_path_idx
  on public.custom_exercise (poster_path)
  where poster_path is not null;

/* ------------------------------------------------------- the timestamps -- */

-- updated_at is when the owner's exercise last changed, and the phone's sync
-- compares it to decide whether there is an edit to take. So it moves with
-- what the owner writes - the content, the video, sharing, and a copy losing
-- its original - and not with the two columns this file keeps on the owner's
-- behalf. adopter_count moves whenever anybody adds a copy, and without this
-- every copy taken would read on the owner's phone as an edit to pull.
create or replace function private.custom_exercise_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name, new.description, new.muscle_group_keys, new.equipment, new.weight_mode,
      new.steps, new.video_path, new.poster_path, new.video_duration_ms, new.is_public,
      new.source_exercise_id)
     is distinct from
     (old.name, old.description, old.muscle_group_keys, old.equipment, old.weight_mode,
      old.steps, old.video_path, old.poster_path, old.video_duration_ms, old.is_public,
      old.source_exercise_id) then
    new.updated_at := timezone('utc', now());
  else
    new.updated_at := old.updated_at;
  end if;

  -- When it was shared, which is what "Newest" orders by. Sharing it again
  -- counts as sharing it now.
  if new.is_public and not old.is_public then
    new.shared_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

revoke all on function private.custom_exercise_before_update() from public, anon, authenticated;

drop trigger if exists custom_exercise_before_update on public.custom_exercise;
create trigger custom_exercise_before_update
before update on public.custom_exercise
for each row execute function private.custom_exercise_before_update();

/* -------------------------------------------------------- adopter_count -- */

-- How many copies an exercise has, kept on the original so the library can
-- order by it without counting. Security definer: the copy is the adder's row
-- and the original somebody else's, and adopter_count is not in the client's
-- update grant at all. An increment rather than a recount, so two people
-- adding at the same moment cannot both count one.
create or replace function private.custom_exercise_count_adopters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.source_exercise_id is not distinct from old.source_exercise_id then
      return null;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    if old.source_exercise_id is not null then
      update public.custom_exercise exercise
         set adopter_count = greatest(exercise.adopter_count - 1, 0)
       where exercise.id = old.source_exercise_id;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.source_exercise_id is not null then
      update public.custom_exercise exercise
         set adopter_count = exercise.adopter_count + 1
       where exercise.id = new.source_exercise_id;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.custom_exercise_count_adopters() from public, anon, authenticated;

drop trigger if exists custom_exercise_count_adopters on public.custom_exercise;
create trigger custom_exercise_count_adopters
after insert or delete or update of source_exercise_id on public.custom_exercise
for each row execute function private.custom_exercise_count_adopters();

/* ------------------------------------------------------ the term filter -- */

-- A shared exercise is text other people read, so it gets the check posts and
-- profiles already have (20260912220000_ugc-safety.sql): when it is shared,
-- and on every edit while it is. A private exercise is nobody else's business.
-- Only on the columns people read. The counters this file writes on the
-- owner's behalf must never be refused, or a report could not hide an
-- exercise whose words were added to the list after it was shared.
create or replace function private.custom_exercise_reject_blocked_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_public
     and (
       private.contains_blocked_term(new.name)
       or private.contains_blocked_term(new.description)
       or private.contains_blocked_term(array_to_string(new.steps, ' '))
     ) then
    -- Says nothing about which word, like the post and profile checks. The
    -- app recognises the sentence (src/Services/exerciseService.js).
    raise exception 'This exercise cannot be shared as written.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.custom_exercise_reject_blocked_terms() from public, anon, authenticated;

drop trigger if exists custom_exercise_term_check on public.custom_exercise;
create trigger custom_exercise_term_check
before insert or update of name, description, steps, is_public on public.custom_exercise
for each row execute function private.custom_exercise_reject_blocked_terms();

/* ------------------------------------------------- who may do what to it -- */

alter table public.custom_exercise enable row level security;

-- Your own rows, and only by column. Everything that is not yours goes through
-- the functions below. The owner, the original, the counters, hidden_at and
-- shared_at are not the client's to write, and neither is the name after the
-- insert: every table on the phone links to an exercise by name, so a
-- custom exercise keeps the name it was created with.
revoke all on public.custom_exercise from anon, authenticated;
grant select, delete on public.custom_exercise to authenticated;
grant insert (name, description, muscle_group_keys, equipment, weight_mode, steps)
  on public.custom_exercise to authenticated;
grant update (description, muscle_group_keys, equipment, weight_mode, steps, is_public, video_path, poster_path, video_duration_ms)
  on public.custom_exercise to authenticated;

drop policy if exists "Users can view their own custom exercises" on public.custom_exercise;
create policy "Users can view their own custom exercises"
on public.custom_exercise
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create their own custom exercises" on public.custom_exercise;
create policy "Users can create their own custom exercises"
on public.custom_exercise
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own custom exercises" on public.custom_exercise;
create policy "Users can update their own custom exercises"
on public.custom_exercise
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own custom exercises" on public.custom_exercise;
create policy "Users can delete their own custom exercises"
on public.custom_exercise
for delete
to authenticated
using (user_id = (select auth.uid()));

/* ------------------------------------------------- saved and reported -- */

create table if not exists public.custom_exercise_save (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  exercise_id bigint not null references public.custom_exercise(id) on delete cascade,
  created_at  timestamptz not null default timezone('utc', now()),
  primary key (user_id, exercise_id)
);

-- A deleted exercise takes its saves with it.
create index if not exists custom_exercise_save_exercise_idx
  on public.custom_exercise_save (exercise_id);

create table if not exists public.custom_exercise_report (
  id          bigint generated by default as identity primary key,
  exercise_id bigint not null references public.custom_exercise(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason      text not null,
  note        text,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (exercise_id, reporter_id)
);

-- A deleted account takes its reports with it, through the cascade on
-- profiles; this is what that delete looks the rows up by.
create index if not exists custom_exercise_report_reporter_idx
  on public.custom_exercise_report (reporter_id);

do $$
begin
  -- REPORT_REASONS and REPORT_NOTE_MAX_LENGTH in src/Utils/customExercises.js.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_report_reason_known'
      and conrelid = 'public.custom_exercise_report'::regclass
  ) then
    alter table public.custom_exercise_report
      add constraint custom_exercise_report_reason_known
      check (reason in ('wrong', 'offensive', 'duplicate', 'other'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'custom_exercise_report_note_length'
      and conrelid = 'public.custom_exercise_report'::regclass
  ) then
    alter table public.custom_exercise_report
      add constraint custom_exercise_report_note_length
      check (note is null or char_length(note) <= 500);
  end if;
end;
$$;

alter table public.custom_exercise_save enable row level security;
alter table public.custom_exercise_report enable row level security;

-- No policy and no grant. Both are read and written through the functions
-- below and nothing else: what somebody saved is theirs alone, and the owner
-- of a reported exercise must not learn who reported it - that is what stops
-- a report from turning into the next round of the argument.
revoke all on public.custom_exercise_save from anon, authenticated;
revoke all on public.custom_exercise_report from anon, authenticated;

/* ------------------------------------------------------ hide on report -- */

-- The third different person hides it, at once, and the owner hears why in
-- the inbox - the same shape as request_lift_verification in
-- 20260917120000_gyms-and-lift-verification.sql: an event, then the inbox row
-- the bell shows. No actor, so the owner cannot tell who reported it. The
-- title and body are English, as the other inbox rows are; the notification
-- page shows its own translation of this one.
--
-- Three rather than the two that hide a post (20260921120000): an exercise is
-- something people build on, and a copy is already in other people's
-- catalogs, so one more voice before it disappears from the library.
create or replace function private.hide_custom_exercise_when_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_total integer;
  hidden_exercise public.custom_exercise%rowtype;
  new_event_id uuid;
begin
  select count(distinct report.reporter_id)
    into reporter_total
  from public.custom_exercise_report report
  where report.exercise_id = new.exercise_id;

  if reporter_total < 3 then
    return null;
  end if;

  update public.custom_exercise exercise
     set hidden_at = timezone('utc', now())
   where exercise.id = new.exercise_id
     and exercise.hidden_at is null
  returning exercise.* into hidden_exercise;

  -- Hidden already, and the owner has been told.
  if not found then
    return null;
  end if;

  insert into public.notification_events (event_key, event_type, actor_id, source_table, source_id, status, payload)
  values (
    'custom-exercise-hidden:' || hidden_exercise.id || ':' ||
      floor(extract(epoch from hidden_exercise.hidden_at))::bigint,
    'custom_exercise_hidden',
    null,
    'custom_exercise',
    hidden_exercise.id::text,
    'processing',
    jsonb_build_object('exercise_id', hidden_exercise.id, 'exercise_name', hidden_exercise.name)
  )
  on conflict (event_key) do nothing
  returning id into new_event_id;

  if new_event_id is null then
    return null;
  end if;

  insert into public.notification_inbox (user_id, actor_id, event_id, event_type, title, body, data)
  values (
    hidden_exercise.user_id,
    null,
    new_event_id,
    'custom_exercise_hidden',
    'Your exercise was hidden',
    hidden_exercise.name || ' was reported by several people and no longer shows in the library. Copies people already added stay.',
    jsonb_build_object('exercise_id', hidden_exercise.id, 'exercise_name', hidden_exercise.name)
  )
  on conflict (user_id, event_id) do nothing;

  update public.notification_events event
     set recipient_count = 1,
         status = 'sent',
         sent_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where event.id = new_event_id;

  return null;
end;
$$;

revoke all on function private.hide_custom_exercise_when_reported() from public, anon, authenticated;

drop trigger if exists custom_exercise_report_hide on public.custom_exercise_report;
create trigger custom_exercise_report_hide
after insert on public.custom_exercise_report
for each row execute function private.hide_custom_exercise_when_reported();

/* ---------------------------------------------------------- the numbers -- */

-- In private, where PostgREST cannot reach, and read only by the functions
-- below. gym_users maps a centre to how many of the exercise's users have it
-- as their centre; it never holds who they are.
create table if not exists private.custom_exercise_stats (
  exercise_id       bigint primary key references public.custom_exercise(id) on delete cascade,
  set_count         integer not null default 0,
  typical_sets      integer,
  typical_reps      integer,
  typical_weight_kg numeric,
  buckets           jsonb,
  gym_users         jsonb not null default '{}'::jsonb,
  owner_gym_id      bigint,
  computed_at       timestamptz not null default timezone('utc', now())
);

alter table private.custom_exercise_stats enable row level security;
revoke all on private.custom_exercise_stats from public, anon, authenticated;

-- One exercise's numbers, from the sets its users logged: the exercise and its
-- direct copies (the family), each member's own workouts, the exercise
-- matched by name the way the phone links it. Done working and AMRAP sets
-- only - not a warm-up, a drop set, a failed or a deleted one.
--
--   set_count          the sets
--   typical_sets       the median number of sets per exercise in a workout
--   typical_reps       the median reps
--   typical_weight_kg  the median weight, to the nearest half kilo
--   buckets            six bars between the 10th and the 90th percentile of
--                      the weight on 5 kg edges, the outer two open ("-50",
--                      "90+"), and only from 20 sets with a weight: a
--                      distribution drawn from five is a guess
--                      (DISTRIBUTION_MIN_SETS in src/Utils/customExercises.js)
--   gym_users          centre id -> how many members have it as their centre
--   owner_gym_id       the owner's centre
--
-- `done::text` and friends as in 20260924090000: these columns predate the
-- folder and their type is not written down here. Every join also names the
-- member and `is_deleting = false`, which is what the (user_id, last_updated)
-- sync indexes from 20260515150145 answer; nothing promises an index on the
-- parent ids themselves.
create or replace function private.refresh_custom_exercise_stats(p_exercise_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_of uuid;
  total_sets integer := 0;
  lifted_kg numeric[];
  rep_counts numeric[];
  sets_per_instance numeric[];
  median_sets integer;
  median_reps integer;
  median_weight numeric;
  low_kg double precision;
  high_kg double precision;
  first_edge numeric;
  bucket_step numeric;
  bucket_json jsonb;
  centre_json jsonb;
  owner_centre bigint;
begin
  select exercise.user_id
    into owner_of
  from public.custom_exercise exercise
  where exercise.id = p_exercise_id;

  if owner_of is null then
    return;
  end if;

  with family as (
    select member.user_id, lower(member.name) as name_key
    from public.custom_exercise member
    where member.id = p_exercise_id
       or member.source_exercise_id = p_exercise_id
  ),
  logged as (
    select
      instance.id as instance_id,
      logged_set.weight::numeric as kg,
      logged_set.reps::numeric as rep_count
    from family
    join public.exercise_instance instance
      on instance.user_id = family.user_id
     and lower(btrim(instance.exercise_name)) = family.name_key
     and instance.deleted_at is null
     and instance.is_deleting = false
    join public.workout_type_instance workout
      on workout.id = instance.cloud_workout_type_instance_id
     and workout.user_id = family.user_id
     and workout.deleted_at is null
     and coalesce(workout.is_deleting, false) = false
    join public."set" logged_set
      on logged_set.cloud_exercise_instance_id = instance.id
     and logged_set.user_id = family.user_id
     and logged_set.deleted_at is null
     and logged_set.is_deleting = false
     and logged_set.done::text in ('true', '1', 't')
     and coalesce(logged_set.failed::text, 'false') not in ('true', '1', 't')
     and (logged_set.set_type is null or logged_set.set_type in ('working', 'amrap'))
  )
  select
    count(*)::integer,
    coalesce(array_agg(logged.kg) filter (where logged.kg > 0), '{}'),
    coalesce(array_agg(logged.rep_count) filter (where logged.rep_count > 0), '{}'),
    coalesce(
      (
        select array_agg(per_instance.sets)
        from (
          select count(*)::numeric as sets
          from logged per_set
          group by per_set.instance_id
        ) per_instance
      ),
      '{}'
    )
  into total_sets, lifted_kg, rep_counts, sets_per_instance
  from logged;

  -- Rounded as numeric, half away from zero; a double would round 2.5 to 2.
  select round((percentile_cont(0.5) within group (order by counted.n::double precision))::numeric)::integer
    into median_sets
  from unnest(sets_per_instance) as counted(n);

  select round((percentile_cont(0.5) within group (order by counted.n::double precision))::numeric)::integer
    into median_reps
  from unnest(rep_counts) as counted(n);

  select round(round((percentile_cont(0.5) within group (order by lift.kg::double precision))::numeric * 2) / 2, 1)
    into median_weight
  from unnest(lifted_kg) as lift(kg);

  if coalesce(array_length(lifted_kg, 1), 0) >= 20 then
    select
      percentile_cont(0.1) within group (order by lift.kg::double precision),
      percentile_cont(0.9) within group (order by lift.kg::double precision)
    into low_kg, high_kg
    from unnest(lifted_kg) as lift(kg);

    -- step = max(5, round5((round5(P90) - round5(P10)) / 6)), and edge k =
    -- e0 + k * step. At least 5 kg a bar, so a tight spread still reads as
    -- bars rather than as one column.
    --
    -- e0 is placed so the six bars sit centred on the middle of P10 and P90,
    -- not started at P10. Rounding the step to 5 kg makes the six bars cover
    -- a little more or less than P10 to P90; started at P10, all of that
    -- error lands in the top bar, which then swallows real weights and reads
    -- as the most common one. Centred, it is shared by both ends. Never below
    -- 0, which no weight is.
    bucket_step := greatest(5, round(((round(high_kg::numeric / 5) * 5) - (round(low_kg::numeric / 5) * 5)) / 6 / 5) * 5);
    first_edge := greatest(0, round(((low_kg + high_kg) / 2)::numeric / 5) * 5 - 3 * bucket_step);

    select jsonb_agg(
             jsonb_build_object(
               'from', case when bar.k = 0 then null else first_edge + bar.k * bucket_step end,
               'to', case when bar.k = 5 then null else first_edge + (bar.k + 1) * bucket_step end,
               'count', (
                 select count(*)::integer
                 from unnest(lifted_kg) as lift(kg)
                 where (bar.k = 0 or lift.kg >= first_edge + bar.k * bucket_step)
                   and (bar.k = 5 or lift.kg < first_edge + (bar.k + 1) * bucket_step)
               )
             )
             order by bar.k
           )
      into bucket_json
    from generate_series(0, 5) as bar(k);
  else
    bucket_json := null;
  end if;

  -- Each member's centre, asked once per person.
  with members as (
    select distinct member.user_id
    from public.custom_exercise member
    where member.id = p_exercise_id
       or member.source_exercise_id = p_exercise_id
  ),
  homes as materialized (
    select members.user_id, private.home_gym_id_for(members.user_id) as centre_id
    from members
  )
  select
    coalesce(
      (
        select jsonb_object_agg(centre.centre_id::text, centre.member_count)
        from (
          select homes.centre_id, count(*)::integer as member_count
          from homes
          where homes.centre_id is not null
          group by homes.centre_id
        ) centre
      ),
      '{}'::jsonb
    ),
    (select homes.centre_id from homes where homes.user_id = owner_of)
  into centre_json, owner_centre;

  insert into private.custom_exercise_stats as stats (
    exercise_id,
    set_count,
    typical_sets,
    typical_reps,
    typical_weight_kg,
    buckets,
    gym_users,
    owner_gym_id,
    computed_at
  )
  values (
    p_exercise_id,
    total_sets,
    median_sets,
    median_reps,
    median_weight,
    bucket_json,
    centre_json,
    owner_centre,
    timezone('utc', now())
  )
  on conflict (exercise_id) do update
  set set_count = excluded.set_count,
      typical_sets = excluded.typical_sets,
      typical_reps = excluded.typical_reps,
      typical_weight_kg = excluded.typical_weight_kg,
      buckets = excluded.buckets,
      gym_users = excluded.gym_users,
      owner_gym_id = excluded.owner_gym_id,
      computed_at = excluded.computed_at;
end;
$$;

revoke all on function private.refresh_custom_exercise_stats(bigint) from public, anon, authenticated;

/* ------------------------------------------------------------- helpers -- */

-- Whether the viewer may see an exercise: shared, not hidden, not a copy, and
-- no block either way. Your own shared exercise is visible to you on the same
-- terms.
create or replace function private.custom_exercise_is_visible(target_id bigint, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.custom_exercise exercise
    where exercise.id = target_id
      and viewer_id is not null
      and exercise.is_public
      and exercise.hidden_at is null
      and exercise.source_exercise_id is null
      and not private.blocked_between(exercise.user_id, viewer_id)
  );
$$;

revoke all on function private.custom_exercise_is_visible(bigint, uuid) from public, anon, authenticated;

-- One exercise as the library and the exercise page hand it out. Columns by
-- name, never exercise.* or profile.*, so a column added later is not handed
-- out by accident. The owner comes with the four fields public_profile also
-- gives a stranger, and nothing from profile_private. users is the owner
-- plus everyone who added it.
create or replace function private.custom_exercise_item(target_id bigint, viewer_id uuid, viewer_gym_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', exercise.id,
    'name', exercise.name,
    'description', exercise.description,
    'muscle_group_keys', exercise.muscle_group_keys,
    'equipment', exercise.equipment,
    'weight_mode', exercise.weight_mode,
    'has_video', exercise.video_path is not null,
    'video_duration_ms', exercise.video_duration_ms,
    'poster_path', exercise.poster_path,
    'users', exercise.adopter_count + 1,
    'shared_at', exercise.shared_at,
    'owner', jsonb_build_object(
      'id', profile.id,
      'display_name', profile.display_name,
      'username', profile.username,
      'avatar_path', profile.avatar_path
    ),
    'owner_in_your_gym', coalesce(viewer_gym_id is not null and stats.owner_gym_id = viewer_gym_id, false),
    'is_mine', exercise.user_id = viewer_id,
    'is_added', exists (
      select 1
      from public.custom_exercise own_copy
      where own_copy.user_id = viewer_id
        and own_copy.source_exercise_id = exercise.id
    ),
    'is_saved', exists (
      select 1
      from public.custom_exercise_save saved
      where saved.user_id = viewer_id
        and saved.exercise_id = exercise.id
    )
  )
  from public.custom_exercise exercise
  join public.profiles profile on profile.id = exercise.user_id
  left join private.custom_exercise_stats stats on stats.exercise_id = exercise.id
  where exercise.id = target_id;
$$;

revoke all on function private.custom_exercise_item(bigint, uuid, bigint) from public, anon, authenticated;

-- The viewer's own row, as adopt_custom_exercise hands back the copy it made:
-- what the phone stores about an exercise, and none of what this file keeps
-- on the owner's behalf.
create or replace function private.custom_exercise_own_json(own_row public.custom_exercise)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', own_row.id,
    'name', own_row.name,
    'description', own_row.description,
    'muscle_group_keys', own_row.muscle_group_keys,
    'equipment', own_row.equipment,
    'weight_mode', own_row.weight_mode,
    'steps', to_jsonb(own_row.steps),
    'is_public', own_row.is_public,
    'source_exercise_id', own_row.source_exercise_id,
    'video_path', own_row.video_path,
    'poster_path', own_row.poster_path,
    'video_duration_ms', own_row.video_duration_ms,
    'created_at', own_row.created_at,
    'updated_at', own_row.updated_at
  );
$$;

revoke all on function private.custom_exercise_own_json(public.custom_exercise) from public, anon, authenticated;

/* ------------------------------------------------ browse_custom_exercises -- */

-- One page of the library. Six sorts share one control, as they do on screen:
-- three are orders and three are filters that then order by use.
--
--   popular             adopter_count
--   newest              when it was shared
--   gym                 its users in the viewer's centre, then adopter_count
--   following, video,   only the owners the viewer follows, only those with
--   saved               a video, only the viewer's saved ones; by adopter_count
--
-- Keyset pages, everything descending on (s1, s2, id). The cursor is the last
-- row's keys as strings, so the numbers come back exactly as they left - an
-- epoch with microseconds does not survive a round trip through a JavaScript
-- number. The keys are computed, so the page is a sort over what the viewer
-- can see rather than a walk down an index; at the size this library will be
-- for a long time that is the cheaper thing to be sure of, and the partial
-- indexes above still carry the "can be shown" half of the filter.
--
-- The first page also says how many match (total), how many there are at all
-- (library_total), and brings up to 50 stale numbers up to date - under a
-- try-lock, so two first pages at once never wait for each other.
create or replace function public.browse_custom_exercises(
  p_sort text default 'popular',
  p_muscle_group text default null,
  p_query text default null,
  p_cursor jsonb default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  sort_choice text := coalesce(p_sort, 'popular');
  page_size integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  muscle_key text := nullif(btrim(coalesce(p_muscle_group, '')), '');
  search_text text := btrim(coalesce(p_query, ''));
  search_pattern text;
  viewer_gym_id bigint;
  after_s1 numeric;
  after_s2 numeric;
  after_id bigint;
  is_first_page boolean;
  stale_id bigint;
  matching_total integer;
  visible_total integer;
  page_ids bigint[];
  page_s1 numeric[];
  page_s2 numeric[];
  next_cursor jsonb;
  items_json jsonb;
begin
  if viewer_id is null then
    return null;
  end if;

  if sort_choice not in ('popular', 'newest', 'gym', 'following', 'video', 'saved') then
    sort_choice := 'popular';
  end if;

  -- Name and description, as typed: % and _ are letters here, not wildcards.
  -- Below two characters the search is ignored rather than matching all.
  if char_length(search_text) >= 2 then
    search_pattern := '%' || replace(replace(replace(left(search_text, 80), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  end if;

  if p_cursor is not null and jsonb_typeof(p_cursor) = 'object' then
    after_s1 := (p_cursor ->> 's1')::numeric;
    after_s2 := (p_cursor ->> 's2')::numeric;
    after_id := (p_cursor ->> 'id')::bigint;
  end if;

  is_first_page := after_s1 is null or after_s2 is null or after_id is null;
  viewer_gym_id := private.home_gym_id_for(viewer_id);

  if is_first_page and pg_try_advisory_xact_lock(20260928090000) then
    for stale_id in
      select exercise.id
      from public.custom_exercise exercise
      left join private.custom_exercise_stats stats on stats.exercise_id = exercise.id
      where exercise.is_public
        and exercise.hidden_at is null
        and exercise.source_exercise_id is null
        and (stats.exercise_id is null or stats.computed_at < timezone('utc', now()) - interval '1 day')
      order by stats.computed_at asc nulls first, exercise.id asc
      limit 50
    loop
      -- One exercise whose numbers cannot be worked out must not take the
      -- library down with it; it keeps the numbers it had.
      begin
        perform private.refresh_custom_exercise_stats(stale_id);
      exception
        when others then
          raise warning 'custom exercise % kept its old numbers: %', stale_id, sqlerrm;
      end;
    end loop;
  end if;

  with visible as (
    select
      exercise.id,
      case sort_choice
        when 'newest' then extract(epoch from coalesce(exercise.shared_at, exercise.created_at))
        when 'gym' then coalesce((stats.gym_users ->> viewer_gym_id::text)::numeric, 0)
        else exercise.adopter_count::numeric
      end as s1,
      case sort_choice
        when 'gym' then exercise.adopter_count::numeric
        else 0::numeric
      end as s2,
      (
        (muscle_key is null or (exercise.muscle_group_keys -> 'primary') ? muscle_key)
        and (
          search_pattern is null
          or exercise.name ilike search_pattern escape E'\\'
          or coalesce(exercise.description, '') ilike search_pattern escape E'\\'
        )
        and (
          sort_choice <> 'following'
          or exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = viewer_id
              and follow.following_id = exercise.user_id
          )
        )
        and (sort_choice <> 'video' or exercise.video_path is not null)
        and (
          sort_choice <> 'saved'
          or exists (
            select 1
            from public.custom_exercise_save saved
            where saved.user_id = viewer_id
              and saved.exercise_id = exercise.id
          )
        )
      ) as matches
    from public.custom_exercise exercise
    left join private.custom_exercise_stats stats on stats.exercise_id = exercise.id
    where exercise.is_public
      and exercise.hidden_at is null
      and exercise.source_exercise_id is null
      and not private.blocked_between(exercise.user_id, viewer_id)
  ),
  page as (
    select visible.id, visible.s1, visible.s2
    from visible
    where visible.matches
      and (is_first_page or (visible.s1, visible.s2, visible.id) < (after_s1, after_s2, after_id))
    order by visible.s1 desc, visible.s2 desc, visible.id desc
    limit page_size + 1
  )
  select
    case when is_first_page then (select count(*)::integer from visible where visible.matches) end,
    case when is_first_page then (select count(*)::integer from visible) end,
    coalesce((select array_agg(page.id order by page.s1 desc, page.s2 desc, page.id desc) from page), '{}'),
    coalesce((select array_agg(page.s1 order by page.s1 desc, page.s2 desc, page.id desc) from page), '{}'),
    coalesce((select array_agg(page.s2 order by page.s1 desc, page.s2 desc, page.id desc) from page), '{}')
  into matching_total, visible_total, page_ids, page_s1, page_s2;

  -- One more row than the page was fetched; if it came, there is a next page,
  -- and it starts after the page's last row.
  if coalesce(array_length(page_ids, 1), 0) > page_size then
    next_cursor := jsonb_build_object(
      's1', page_s1[page_size]::text,
      's2', page_s2[page_size]::text,
      'id', page_ids[page_size]::text
    );
    page_ids := page_ids[1:page_size];
  end if;

  -- offset 0 keeps the subquery from being folded into the outer query, which
  -- would build every item twice: once to check it and once to hand it out.
  select coalesce(jsonb_agg(built.item order by built.ord), '[]'::jsonb)
    into items_json
  from (
    select listed.ord, private.custom_exercise_item(listed.exercise_id, viewer_id, viewer_gym_id) as item
    from unnest(page_ids) with ordinality as listed(exercise_id, ord)
    offset 0
  ) built
  where built.item is not null;

  return jsonb_build_object(
    'items', items_json,
    'next_cursor', next_cursor,
    'total', matching_total,
    'library_total', visible_total,
    'viewer_has_gym', viewer_gym_id is not null
  );
end;
$$;

revoke all on function public.browse_custom_exercises(text, text, text, jsonb, integer) from public, anon;
grant execute on function public.browse_custom_exercises(text, text, text, jsonb, integer) to authenticated;

/* ------------------------------------------------- custom_exercise_detail -- */

-- One exercise: what the library row has, and the steps, the video, when it
-- was made, the owner's centre and the numbers. Null for an exercise the
-- viewer cannot see, which is the same answer as for one that does not exist.
-- The owner sees their own whatever its state - private, hidden or a copy -
-- so they can look at it the way others do.
create or replace function public.custom_exercise_detail(p_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_row public.custom_exercise%rowtype;
  cached private.custom_exercise_stats%rowtype;
  viewer_gym_id bigint;
  owner_centre_id bigint;
  item_json jsonb;
begin
  if viewer_id is null or p_id is null then
    return null;
  end if;

  select exercise.* into target_row
  from public.custom_exercise exercise
  where exercise.id = p_id;

  if not found then
    return null;
  end if;

  if target_row.user_id <> viewer_id
     and not private.custom_exercise_is_visible(p_id, viewer_id) then
    return null;
  end if;

  select stats.* into cached
  from private.custom_exercise_stats stats
  where stats.exercise_id = p_id;

  if not found or cached.computed_at < timezone('utc', now()) - interval '1 day' then
    begin
      perform private.refresh_custom_exercise_stats(p_id);
    exception
      when others then
        raise warning 'custom exercise % kept its old numbers: %', p_id, sqlerrm;
    end;

    select stats.* into cached
    from private.custom_exercise_stats stats
    where stats.exercise_id = p_id;
  end if;

  viewer_gym_id := private.home_gym_id_for(viewer_id);
  -- Asked now rather than read from the cache: one row, and the page names it.
  owner_centre_id := private.home_gym_id_for(target_row.user_id);
  item_json := private.custom_exercise_item(p_id, viewer_id, viewer_gym_id);

  if item_json is null then
    return null;
  end if;

  return item_json || jsonb_build_object(
    'owner_in_your_gym', viewer_gym_id is not null and owner_centre_id is not distinct from viewer_gym_id,
    'steps', to_jsonb(target_row.steps),
    'video_path', target_row.video_path,
    'created_at', target_row.created_at,
    -- The short name only, the way public_profile hands out a centre.
    'owner_gym_name', (
      select gym.short_name
      from public.gym gym
      where gym.id = owner_centre_id
        and gym.is_public
    ),
    'viewer_has_gym', viewer_gym_id is not null,
    'stats', jsonb_build_object(
      'users', target_row.adopter_count + 1,
      -- Only the viewer's own centre, as a count. Never the map.
      'gym_users', case
        when viewer_gym_id is null then null
        else coalesce((cached.gym_users ->> viewer_gym_id::text)::integer, 0)
      end,
      'typical_sets', cached.typical_sets,
      'typical_reps', cached.typical_reps,
      'typical_weight_kg', cached.typical_weight_kg,
      'set_count', coalesce(cached.set_count, 0),
      'buckets', cached.buckets
    )
  );
end;
$$;

revoke all on function public.custom_exercise_detail(bigint) from public, anon;
grant execute on function public.custom_exercise_detail(bigint) to authenticated;

/* -------------------------------------------------- adopt_custom_exercise -- */

-- Adds a copy to the viewer's own exercises: name, muscles, equipment, weight
-- mode, description and steps. Never the owner's sets, which are not in this
-- table at all, and never the video.
--
--   own            it is the viewer's own
--   already_added  the viewer has a copy of it; here it is
--   name_taken     the viewer already has an exercise by that name, or the
--                  shared catalog does - the phone links everything to an
--                  exercise by name, so the name cannot be there twice
--   added          the copy, just made
--
-- Null for an exercise the viewer cannot see.
create or replace function public.adopt_custom_exercise(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  original public.custom_exercise%rowtype;
  own_copy public.custom_exercise%rowtype;
begin
  if viewer_id is null or p_id is null then
    return null;
  end if;

  select exercise.* into original
  from public.custom_exercise exercise
  where exercise.id = p_id;

  if not found then
    return null;
  end if;

  if original.user_id = viewer_id then
    return jsonb_build_object('status', 'own', 'exercise', private.custom_exercise_own_json(original));
  end if;

  if not private.custom_exercise_is_visible(p_id, viewer_id) then
    return null;
  end if;

  select exercise.* into own_copy
  from public.custom_exercise exercise
  where exercise.user_id = viewer_id
    and exercise.source_exercise_id = p_id
  order by exercise.id
  limit 1;

  if found then
    return jsonb_build_object('status', 'already_added', 'exercise', private.custom_exercise_own_json(own_copy));
  end if;

  if exists (
       select 1
       from public.custom_exercise mine
       where mine.user_id = viewer_id
         and lower(mine.name) = lower(original.name)
     )
     or exists (
       select 1
       from public."Exercise" shared
       where lower(btrim(shared.name)) = lower(original.name)
     ) then
    return jsonb_build_object('status', 'name_taken', 'exercise', null);
  end if;

  insert into public.custom_exercise (
    user_id,
    name,
    description,
    muscle_group_keys,
    equipment,
    weight_mode,
    steps,
    is_public,
    source_exercise_id
  )
  values (
    viewer_id,
    original.name,
    original.description,
    original.muscle_group_keys,
    original.equipment,
    original.weight_mode,
    original.steps,
    false,
    p_id
  )
  on conflict do nothing
  returning * into own_copy;

  if not found then
    -- Two taps at once, and the other one made the copy; or the name was
    -- taken in between.
    select exercise.* into own_copy
    from public.custom_exercise exercise
    where exercise.user_id = viewer_id
      and exercise.source_exercise_id = p_id
    order by exercise.id
    limit 1;

    if found then
      return jsonb_build_object('status', 'already_added', 'exercise', private.custom_exercise_own_json(own_copy));
    end if;

    return jsonb_build_object('status', 'name_taken', 'exercise', null);
  end if;

  return jsonb_build_object('status', 'added', 'exercise', private.custom_exercise_own_json(own_copy));
end;
$$;

revoke all on function public.adopt_custom_exercise(bigint) from public, anon;
grant execute on function public.adopt_custom_exercise(bigint) to authenticated;

/* ---------------------------------------------- set_custom_exercise_saved -- */

-- Puts an exercise on the viewer's saved list, or takes it off, and answers
-- whether it is on it now. Only what the viewer can find can be saved;
-- taking one off always works, whatever became of it since.
create or replace function public.set_custom_exercise_saved(p_id bigint, p_saved boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null or p_id is null then
    return false;
  end if;

  if coalesce(p_saved, false) then
    if not private.custom_exercise_is_visible(p_id, viewer_id) then
      return false;
    end if;

    insert into public.custom_exercise_save (user_id, exercise_id)
    values (viewer_id, p_id)
    on conflict do nothing;

    return true;
  end if;

  delete from public.custom_exercise_save saved
  where saved.user_id = viewer_id
    and saved.exercise_id = p_id;

  return false;
end;
$$;

revoke all on function public.set_custom_exercise_saved(bigint, boolean) from public, anon;
grant execute on function public.set_custom_exercise_saved(bigint, boolean) to authenticated;

/* ------------------------------------------------- report_custom_exercise -- */

-- A report on an exercise the viewer can find, never their own. Reporting
-- twice is one report (on conflict do nothing), so one person cannot hide an
-- exercise alone. Answers whether it is hidden now; null when there was
-- nothing the viewer could report.
create or replace function public.report_custom_exercise(p_id bigint, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  owner_of uuid;
  hidden_now boolean;
begin
  if viewer_id is null or p_id is null then
    return null;
  end if;

  if p_reason is null or p_reason not in ('wrong', 'offensive', 'duplicate', 'other') then
    raise exception 'That is not a reason an exercise can be reported for.'
      using errcode = '22023';
  end if;

  select exercise.user_id into owner_of
  from public.custom_exercise exercise
  where exercise.id = p_id;

  if owner_of is null
     or owner_of = viewer_id
     or not private.custom_exercise_is_visible(p_id, viewer_id) then
    return null;
  end if;

  insert into public.custom_exercise_report (exercise_id, reporter_id, reason, note)
  values (p_id, viewer_id, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  on conflict (exercise_id, reporter_id) do nothing;

  select exercise.hidden_at is not null into hidden_now
  from public.custom_exercise exercise
  where exercise.id = p_id;

  return jsonb_build_object('hidden', coalesce(hidden_now, false));
end;
$$;

revoke all on function public.report_custom_exercise(bigint, text, text) from public, anon;
grant execute on function public.report_custom_exercise(bigint, text, text) to authenticated;

/* -------------------------------------------------------------- storage -- */

-- A clip that shows the exercise, and its first frame as a poster the list
-- shows: <user id>/<exercise id>.mp4 or .mov, and <exercise id>-poster.jpg.
-- Private, and 30 MB - VIDEO_MAX_BYTES in src/Utils/customExercises.js. The
-- client compresses towards 720p and 20 seconds.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-videos', 'exercise-videos', false, 31457280, array['video/mp4', 'video/quicktime', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Whether a file belongs to an exercise the viewer can see. security definer
-- because it reads other people's rows, which the table does not answer for
-- - the same reason as private.can_watch_lift_video.
create or replace function private.can_view_exercise_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.custom_exercise exercise
       where (exercise.video_path = object_name or exercise.poster_path = object_name)
         and exercise.is_public
         and exercise.hidden_at is null
         and exercise.source_exercise_id is null
         and not private.blocked_between(exercise.user_id, (select auth.uid()))
     );
$$;

-- Called from a policy, so the person reading has to be able to call it. A
-- policy expression is evaluated as the querying user; without this grant
-- every signed-in read of storage.objects fails - avatars included - which is
-- exactly what 20260921200000_let-the-policy-call-its-own-check.sql had to
-- repair for lift videos. Execute is all it takes: the policy holds the
-- function itself, not its name, so authenticated needs no usage on schema
-- private, and it keeps none (20260906091500 explains why it has none).
revoke all on function private.can_view_exercise_media(text) from public, anon;
grant execute on function private.can_view_exercise_media(text) to authenticated;

drop policy if exists "Users can upload their own exercise videos" on storage.objects;
create policy "Users can upload their own exercise videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can replace their own exercise videos" on storage.objects;
create policy "Users can replace their own exercise videos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own exercise videos" on storage.objects;
create policy "Users can delete their own exercise videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Your own folder, and somebody else's file while its exercise can be found.
drop policy if exists "Exercise videos are readable while the exercise is shared" on storage.objects;
create policy "Exercise videos are readable while the exercise is shared"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.can_view_exercise_media(name)
  )
);

commit;

notify pgrst, 'reload schema';
