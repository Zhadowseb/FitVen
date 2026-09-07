-- Favourite exercises, per user.
--
-- The starred exercises the catalog and the mid-workout picker show first. A row
-- with is_favourite = false is kept rather than deleted, because that is how
-- un-starring reaches the user's other devices: a missing row means "never
-- starred here", which is not the same thing.
--
-- Shaped exactly like exercise_column_preferences (20260519012251): keyed on the
-- shared Exercise id, one row per user per exercise, and readable and writable
-- only by the user it belongs to.

begin;

create table if not exists public.exercise_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id bigint not null references public."Exercise"(id) on delete cascade,
  is_favourite boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, exercise_id)
);

alter table public.exercise_favourites
  add column if not exists user_id uuid;
alter table public.exercise_favourites
  add column if not exists exercise_id bigint;
alter table public.exercise_favourites
  add column if not exists is_favourite boolean;
alter table public.exercise_favourites
  add column if not exists updated_at timestamptz;

delete from public.exercise_favourites
where user_id is null
   or exercise_id is null;

update public.exercise_favourites
set is_favourite = true
where is_favourite is null;

update public.exercise_favourites
set updated_at = timezone('utc', now())
where updated_at is null;

alter table public.exercise_favourites
  alter column user_id set not null;
alter table public.exercise_favourites
  alter column exercise_id set not null;
alter table public.exercise_favourites
  alter column is_favourite set default true;
alter table public.exercise_favourites
  alter column is_favourite set not null;
alter table public.exercise_favourites
  alter column updated_at set default timezone('utc', now());
alter table public.exercise_favourites
  alter column updated_at set not null;

create index if not exists exercise_favourites_exercise_idx
  on public.exercise_favourites (exercise_id);

alter table public.exercise_favourites enable row level security;

grant select, insert, update, delete
  on public.exercise_favourites
  to authenticated;

drop policy if exists "Users can view their own exercise favourites"
  on public.exercise_favourites;
create policy "Users can view their own exercise favourites"
  on public.exercise_favourites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own exercise favourites"
  on public.exercise_favourites;
create policy "Users can insert their own exercise favourites"
  on public.exercise_favourites
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own exercise favourites"
  on public.exercise_favourites;
create policy "Users can update their own exercise favourites"
  on public.exercise_favourites
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own exercise favourites"
  on public.exercise_favourites;
create policy "Users can delete their own exercise favourites"
  on public.exercise_favourites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
