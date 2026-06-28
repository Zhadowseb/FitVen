create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  username_base text not null,
  username_code text not null,
  display_name text not null,
  avatar_path text,
  bio text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists username_base text;
alter table public.profiles add column if not exists username_code text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles alter column bio set default '';
alter table public.profiles alter column created_at set default timezone('utc', now());
alter table public.profiles alter column updated_at set default timezone('utc', now());

create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  manual_max_heart_rate smallint,
  measured_max_heart_rate smallint,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_private_birth_date_minimum
    check (birth_date is null or birth_date >= date '1900-01-01'),
  constraint profile_private_manual_max_heart_rate_range
    check (manual_max_heart_rate is null or manual_max_heart_rate between 60 and 250),
  constraint profile_private_measured_max_heart_rate_range
    check (measured_max_heart_rate is null or measured_max_heart_rate between 60 and 250)
);

alter table public.profile_private
  add column if not exists manual_max_heart_rate smallint;
alter table public.profile_private
  add column if not exists measured_max_heart_rate smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_private_manual_max_heart_rate_range'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_manual_max_heart_rate_range
      check (manual_max_heart_rate is null or manual_max_heart_rate between 60 and 250);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_private_measured_max_heart_rate_range'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_measured_max_heart_rate_range
      check (measured_max_heart_rate is null or measured_max_heart_rate between 60 and 250);
  end if;
end;
$$;

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles drop constraint if exists profiles_username_base_format;
alter table public.profiles drop constraint if exists profiles_username_code_format;
alter table public.profiles drop constraint if exists profiles_username_full_format;

create or replace function private.normalize_username_base(raw_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_value text;
begin
  normalized_value := trim(
    both '_'
    from lower(regexp_replace(coalesce(raw_input, ''), '[^a-z0-9_]+', '_', 'g'))
  );
  normalized_value := left(normalized_value, 20);

  if length(normalized_value) < 3 then
    normalized_value := 'user';
  end if;

  return normalized_value;
end;
$$;

create or replace function private.allocate_username_code(requested_username_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_number integer;
  candidate_code text;
  random_start integer;
  code_offset integer;
begin
  if requested_username_base !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Invalid username base: %', requested_username_base;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_username_base, 0));
  random_start := floor(random() * 10000)::integer;

  for code_offset in 0..9999 loop
    candidate_number := (random_start + code_offset) % 10000;
    candidate_code := lpad(candidate_number::text, 4, '0');

    if not exists (
      select 1
      from public.profiles profile
      where profile.username_base = requested_username_base
        and profile.username_code = candidate_code
    ) then
      return candidate_code;
    end if;
  end loop;

  raise exception 'Username base "%" has no remaining 4-digit tags', requested_username_base;
end;
$$;

update public.profiles profile
set username_base = private.normalize_username_base(
  case
    when coalesce(profile.username, '') ~ '^[a-z0-9_]{3,20}#[0-9]{4}$'
      then split_part(profile.username, '#', 1)
    else coalesce(profile.username_base, profile.username)
  end
)
where coalesce(profile.username_base, '') = ''
   or profile.username_base !~ '^[a-z0-9_]{3,20}$';

update public.profiles profile
set username_code = split_part(profile.username, '#', 2)
where (coalesce(profile.username_code, '') = ''
   or profile.username_code !~ '^[0-9]{4}$')
  and coalesce(profile.username, '') ~ '^[a-z0-9_]{3,20}#[0-9]{4}$';

do $$
declare
  profile_row record;
begin
  for profile_row in
    select profile.id, profile.username_base
    from public.profiles profile
    where coalesce(profile.username_code, '') = ''
       or profile.username_code !~ '^[0-9]{4}$'
    order by profile.created_at, profile.id
  loop
    update public.profiles profile
    set username_code = private.allocate_username_code(profile_row.username_base)
    where profile.id = profile_row.id;
  end loop;
end;
$$;

update public.profiles profile
set display_name = coalesce(nullif(profile.display_name, ''), profile.username_base)
where profile.display_name is null
   or profile.display_name = '';

update public.profiles profile
set username = profile.username_base || '#' || profile.username_code
where profile.username is distinct from profile.username_base || '#' || profile.username_code;

alter table public.profiles alter column username_base set not null;
alter table public.profiles alter column username_code set not null;
alter table public.profiles alter column display_name set not null;
alter table public.profiles alter column bio set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_base_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_base_format
      check (username_base ~ '^[a-z0-9_]{3,20}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_code_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_code_format
      check (username_code ~ '^[0-9]{4}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_full_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_full_format
      check (username = username_base || '#' || username_code);
  end if;
end;
$$;

create unique index if not exists profiles_username_base_code_idx
  on public.profiles (username_base, username_code);

create index if not exists profiles_username_base_idx
  on public.profiles (username_base);

create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_follows enable row level security;

grant select, insert, update, delete
on table public.profile_private
to authenticated;

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

drop policy if exists "Users can view their own private profile" on public.profile_private;
create policy "Users can view their own private profile"
on public.profile_private
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own private profile" on public.profile_private;
create policy "Users can insert their own private profile"
on public.profile_private
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own private profile" on public.profile_private;
create policy "Users can update their own private profile"
on public.profile_private
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own private profile" on public.profile_private;
create policy "Users can delete their own private profile"
on public.profile_private
for delete
to authenticated
using ((select auth.uid()) = user_id);

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

do $$
begin
  if to_regclass('public.workout_type_instance') is not null then
    execute '
      create index if not exists workout_type_instance_user_date_idx
        on public.workout_type_instance (user_id, date)
    ';

    execute '
      drop policy if exists "Followed workout activity is viewable" on public.workout_type_instance
    ';

    execute '
      create policy "Followed workout activity is viewable"
      on public.workout_type_instance
      for select
      to authenticated
      using (
        (select auth.uid()) = user_id
        or (
          deleted_at is null
          and date between current_date - 1 and current_date + 1
          and exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = (select auth.uid())
              and follow.following_id = public.workout_type_instance.user_id
          )
        )
      )
    ';
  end if;
end;
$$;

drop policy if exists "Users can select their own avatar objects" on storage.objects;
create policy "Users can select their own avatar objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their own avatar objects" on storage.objects;
create policy "Users can upload their own avatar objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own avatar objects" on storage.objects;
create policy "Users can update their own avatar objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own avatar objects" on storage.objects;
create policy "Users can delete their own avatar objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username_base text;
  candidate_username_code text;
begin
  requested_username_base := private.normalize_username_base(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username_base', ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    )
  );
  candidate_username_code := private.allocate_username_code(requested_username_base);

  insert into public.profiles (
    id,
    username,
    username_base,
    username_code,
    display_name,
    bio
  )
  values (
    new.id,
    requested_username_base || '#' || candidate_username_code,
    requested_username_base,
    candidate_username_code,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1),
      requested_username_base
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

do $$
declare
  auth_user_row record;
  requested_username_base text;
  candidate_username_code text;
begin
  for auth_user_row in
    select auth_source.*
    from auth.users auth_source
    left join public.profiles profile on profile.id = auth_source.id
    where profile.id is null
    order by auth_source.created_at, auth_source.id
  loop
    requested_username_base := private.normalize_username_base(
      coalesce(
        nullif(auth_user_row.raw_user_meta_data ->> 'username_base', ''),
        nullif(auth_user_row.raw_user_meta_data ->> 'username', ''),
        split_part(coalesce(auth_user_row.email, auth_user_row.id::text), '@', 1)
      )
    );
    candidate_username_code := private.allocate_username_code(requested_username_base);

    insert into public.profiles (
      id,
      username,
      username_base,
      username_code,
      display_name,
      bio
    )
    values (
      auth_user_row.id,
      requested_username_base || '#' || candidate_username_code,
      requested_username_base,
      candidate_username_code,
      coalesce(
        nullif(auth_user_row.raw_user_meta_data ->> 'display_name', ''),
        split_part(coalesce(auth_user_row.email, auth_user_row.id::text), '@', 1),
        requested_username_base
      ),
      ''
    )
    on conflict (id) do nothing;
  end loop;
end;
$$;
