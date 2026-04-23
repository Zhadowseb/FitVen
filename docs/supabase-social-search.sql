create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

alter table public.profiles enable row level security;
alter table public.user_follows enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Follow rows are viewable by authenticated users" on public.user_follows;
create policy "Follow rows are viewable by authenticated users"
on public.user_follows
for select
to authenticated
using (true);

drop policy if exists "Users can follow from their own profile" on public.user_follows;
create policy "Users can follow from their own profile"
on public.user_follows
for insert
to authenticated
with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users can delete their own follows" on public.user_follows;
create policy "Users can delete their own follows"
on public.user_follows
for delete
to authenticated
using (auth.uid() = follower_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  candidate_username text;
  fallback_suffix text;
begin
  fallback_suffix := right(replace(new.id::text, '-', ''), 6);
  requested_username := lower(
    regexp_replace(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'username', ''),
        split_part(coalesce(new.email, new.id::text), '@', 1)
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    )
  );
  requested_username := trim(both '_' from requested_username);

  if length(requested_username) < 3 then
    requested_username := 'user';
  end if;

  candidate_username := left(requested_username, 20);

  if exists (
    select 1
    from public.profiles profile
    where profile.username = candidate_username
  ) then
    candidate_username := left(requested_username, greatest(3, 20 - length(fallback_suffix) - 1))
      || '_' || fallback_suffix;
  end if;

  insert into public.profiles (id, username, display_name, bio)
  values (
    new.id,
    candidate_username,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1),
      candidate_username
    ),
    ''
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, username, display_name, bio)
select
  auth_user.id,
  left(
    lower(
      regexp_replace(
        split_part(coalesce(auth_user.email, auth_user.id::text), '@', 1),
        '[^a-z0-9_]+',
        '_',
        'g'
      )
    ),
    13
  ) || '_' || right(replace(auth_user.id::text, '-', ''), 6),
  split_part(coalesce(auth_user.email, auth_user.id::text), '@', 1),
  ''
from auth.users auth_user
left join public.profiles profile on profile.id = auth_user.id
where profile.id is null
on conflict (id) do nothing;
