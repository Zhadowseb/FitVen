-- Adds device push token storage for Expo push notifications.
--
-- Run before enabling notification registration in the app.
-- The follow-up workout notification trigger/Edge Function can read enabled
-- rows from this table when sending pushes to followers.

begin;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.push_tokens
  add column if not exists id uuid default gen_random_uuid();

alter table public.push_tokens
  add column if not exists user_id uuid;

alter table public.push_tokens
  add column if not exists expo_push_token text;

alter table public.push_tokens
  add column if not exists platform text;

alter table public.push_tokens
  add column if not exists enabled boolean;

alter table public.push_tokens
  add column if not exists last_seen_at timestamptz;

alter table public.push_tokens
  add column if not exists created_at timestamptz;

alter table public.push_tokens
  add column if not exists updated_at timestamptz;

alter table public.push_tokens
  alter column id set default gen_random_uuid();

alter table public.push_tokens
  alter column platform set default 'unknown';

alter table public.push_tokens
  alter column enabled set default true;

alter table public.push_tokens
  alter column last_seen_at set default timezone('utc', now());

alter table public.push_tokens
  alter column created_at set default timezone('utc', now());

alter table public.push_tokens
  alter column updated_at set default timezone('utc', now());

update public.push_tokens
set
  id = coalesce(id, gen_random_uuid()),
  platform = coalesce(nullif(btrim(platform), ''), 'unknown'),
  enabled = coalesce(enabled, true),
  last_seen_at = coalesce(last_seen_at, timezone('utc', now())),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

delete from public.push_tokens
where user_id is null
   or expo_push_token is null
   or btrim(expo_push_token) = '';

with duplicate_rows as (
  select
    ctid,
    row_number() over (
      partition by user_id, expo_push_token
      order by last_seen_at desc, updated_at desc, created_at desc, ctid desc
    ) as duplicate_rank
  from public.push_tokens
)
delete from public.push_tokens push_token
using duplicate_rows
where push_token.ctid = duplicate_rows.ctid
  and duplicate_rows.duplicate_rank > 1;

alter table public.push_tokens
  alter column id set not null;

alter table public.push_tokens
  alter column user_id set not null;

alter table public.push_tokens
  alter column expo_push_token set not null;

alter table public.push_tokens
  alter column platform set not null;

alter table public.push_tokens
  alter column enabled set not null;

alter table public.push_tokens
  alter column last_seen_at set not null;

alter table public.push_tokens
  alter column created_at set not null;

alter table public.push_tokens
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_pkey'
      and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_user_fkey'
      and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_user_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_platform_valid'
      and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_platform_valid
      check (platform in ('android', 'ios', 'web', 'unknown'));
  end if;
end $$;

create unique index if not exists push_tokens_user_token_idx
  on public.push_tokens (user_id, expo_push_token);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id, enabled, last_seen_at desc);

create schema if not exists private;

create or replace function private.set_push_token_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_push_token_updated_at
  on public.push_tokens;

create trigger set_push_token_updated_at
before update on public.push_tokens
for each row
execute function private.set_push_token_updated_at();

alter table public.push_tokens enable row level security;

grant select, insert, update, delete
  on public.push_tokens
  to authenticated;

drop policy if exists "Users can view their own push tokens"
  on public.push_tokens;

create policy "Users can view their own push tokens"
on public.push_tokens
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can register their own push tokens"
  on public.push_tokens;

create policy "Users can register their own push tokens"
on public.push_tokens
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own push tokens"
  on public.push_tokens;

create policy "Users can update their own push tokens"
on public.push_tokens
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own push tokens"
  on public.push_tokens;

create policy "Users can delete their own push tokens"
on public.push_tokens
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
