-- Adds per-exercise default set-list columns and user overrides.
-- Run this against the Supabase project before shipping clients that sync
-- exercise column preferences.

begin;

alter table public."Exercise"
  add column if not exists default_visible_columns jsonb;

update public."Exercise"
set default_visible_columns = '{
  "note": true,
  "rest": true,
  "set": true,
  "reps": true,
  "rpe": true,
  "rm_percentage": true,
  "weight": true,
  "done": true
}'::jsonb
where default_visible_columns is null;

alter table public."Exercise"
  alter column default_visible_columns set default '{
    "note": true,
    "rest": true,
    "set": true,
    "reps": true,
    "rpe": true,
    "rm_percentage": true,
    "weight": true,
    "done": true
  }'::jsonb;

alter table public."Exercise"
  alter column default_visible_columns set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_default_visible_columns_object'
      and conrelid = 'public."Exercise"'::regclass
  ) then
    alter table public."Exercise"
      add constraint exercise_default_visible_columns_object
      check (jsonb_typeof(default_visible_columns) = 'object');
  end if;
end $$;

create table if not exists public.exercise_column_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id bigint not null references public."Exercise"(id) on delete cascade,
  visible_columns jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, exercise_id)
);

alter table public.exercise_column_preferences
  add column if not exists user_id uuid;
alter table public.exercise_column_preferences
  add column if not exists exercise_id bigint;
alter table public.exercise_column_preferences
  add column if not exists visible_columns jsonb;
alter table public.exercise_column_preferences
  add column if not exists updated_at timestamptz;

delete from public.exercise_column_preferences
where user_id is null
   or exercise_id is null;

update public.exercise_column_preferences
set visible_columns = '{
  "note": true,
  "rest": true,
  "set": true,
  "reps": true,
  "rpe": true,
  "rm_percentage": true,
  "weight": true,
  "done": true
}'::jsonb
where visible_columns is null;

update public.exercise_column_preferences
set updated_at = timezone('utc', now())
where updated_at is null;

alter table public.exercise_column_preferences
  alter column user_id set not null;
alter table public.exercise_column_preferences
  alter column exercise_id set not null;
alter table public.exercise_column_preferences
  alter column visible_columns set not null;
alter table public.exercise_column_preferences
  alter column updated_at set default timezone('utc', now());
alter table public.exercise_column_preferences
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_column_preferences_user_exercise_unique'
      and conrelid = 'public.exercise_column_preferences'::regclass
  ) then
    alter table public.exercise_column_preferences
      add constraint exercise_column_preferences_user_exercise_unique
      unique (user_id, exercise_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_column_preferences_visible_columns_object'
      and conrelid = 'public.exercise_column_preferences'::regclass
  ) then
    alter table public.exercise_column_preferences
      add constraint exercise_column_preferences_visible_columns_object
      check (jsonb_typeof(visible_columns) = 'object');
  end if;
end $$;

create index if not exists exercise_column_preferences_exercise_idx
  on public.exercise_column_preferences (exercise_id);

alter table public.exercise_column_preferences enable row level security;

grant select, insert, update, delete
  on public.exercise_column_preferences
  to authenticated;

drop policy if exists "Users can view their own exercise column preferences"
  on public.exercise_column_preferences;
create policy "Users can view their own exercise column preferences"
  on public.exercise_column_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own exercise column preferences"
  on public.exercise_column_preferences;
create policy "Users can insert their own exercise column preferences"
  on public.exercise_column_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own exercise column preferences"
  on public.exercise_column_preferences;
create policy "Users can update their own exercise column preferences"
  on public.exercise_column_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own exercise column preferences"
  on public.exercise_column_preferences;
create policy "Users can delete their own exercise column preferences"
  on public.exercise_column_preferences
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
