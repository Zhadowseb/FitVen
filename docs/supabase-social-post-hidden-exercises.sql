-- Adds per-user exercise visibility preferences for workout summary posts.
--
-- Run after:
--   docs/supabase-social-search.sql
--   the exercise catalog schema that creates public."Exercise"
--
-- No row means the exercise is shown in social posts. A row means the user has
-- hidden that exercise from future generated workout summary posts.

begin;

create table if not exists public.social_post_hidden_exercise (
  user_id uuid not null,
  exercise_id bigint not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint social_post_hidden_exercise_pkey
    primary key (user_id, exercise_id),
  constraint social_post_hidden_exercise_user_fkey
    foreign key (user_id)
    references public.profiles(id)
    on update cascade
    on delete cascade,
  constraint social_post_hidden_exercise_exercise_fkey
    foreign key (exercise_id)
    references public."Exercise"(id)
    on update cascade
    on delete cascade
);

alter table public.social_post_hidden_exercise
  add column if not exists user_id uuid;

alter table public.social_post_hidden_exercise
  add column if not exists exercise_id bigint;

alter table public.social_post_hidden_exercise
  add column if not exists created_at timestamptz;

alter table public.social_post_hidden_exercise
  alter column created_at set default timezone('utc', now());

update public.social_post_hidden_exercise
set created_at = coalesce(created_at, timezone('utc', now()));

delete from public.social_post_hidden_exercise
where user_id is null
   or exercise_id is null;

with duplicate_rows as (
  select
    ctid,
    row_number() over (
      partition by user_id, exercise_id
      order by created_at asc, ctid asc
    ) as duplicate_rank
  from public.social_post_hidden_exercise
)
delete from public.social_post_hidden_exercise hidden_exercise
using duplicate_rows
where hidden_exercise.ctid = duplicate_rows.ctid
  and duplicate_rows.duplicate_rank > 1;

alter table public.social_post_hidden_exercise
  alter column user_id set not null;

alter table public.social_post_hidden_exercise
  alter column exercise_id set not null;

alter table public.social_post_hidden_exercise
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_hidden_exercise_pkey'
      and conrelid = 'public.social_post_hidden_exercise'::regclass
  ) then
    alter table public.social_post_hidden_exercise
      add constraint social_post_hidden_exercise_pkey
      primary key (user_id, exercise_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_hidden_exercise_user_fkey'
      and conrelid = 'public.social_post_hidden_exercise'::regclass
  ) then
    alter table public.social_post_hidden_exercise
      add constraint social_post_hidden_exercise_user_fkey
      foreign key (user_id)
      references public.profiles(id)
      on update cascade
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_hidden_exercise_exercise_fkey'
      and conrelid = 'public.social_post_hidden_exercise'::regclass
  ) then
    alter table public.social_post_hidden_exercise
      add constraint social_post_hidden_exercise_exercise_fkey
      foreign key (exercise_id)
      references public."Exercise"(id)
      on update cascade
      on delete cascade;
  end if;
end $$;

create index if not exists social_post_hidden_exercise_exercise_idx
  on public.social_post_hidden_exercise (exercise_id);

alter table public.social_post_hidden_exercise enable row level security;

grant select, insert, delete
  on public.social_post_hidden_exercise
  to authenticated;

drop policy if exists "Users can view their hidden social post exercises"
  on public.social_post_hidden_exercise;

create policy "Users can view their hidden social post exercises"
on public.social_post_hidden_exercise
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can hide their own social post exercises"
  on public.social_post_hidden_exercise;

create policy "Users can hide their own social post exercises"
on public.social_post_hidden_exercise
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unhide their own social post exercises"
  on public.social_post_hidden_exercise;

create policy "Users can unhide their own social post exercises"
on public.social_post_hidden_exercise
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
