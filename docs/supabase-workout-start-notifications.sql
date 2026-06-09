-- Adds durable notification-event dedupe for workout-start pushes.
--
-- Run after:
--   docs/supabase-push-notifications.sql
--
-- The Edge Function uses this table to prevent repeated pushes for the same
-- workout if a webhook retries or the same workout is paused and started again.

begin;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  source_table text not null,
  source_id text not null,
  status text not null default 'processing',
  recipient_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  expo_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_events
  add column if not exists id uuid default gen_random_uuid();

alter table public.notification_events
  add column if not exists event_key text;

alter table public.notification_events
  add column if not exists event_type text;

alter table public.notification_events
  add column if not exists actor_id uuid;

alter table public.notification_events
  add column if not exists source_table text;

alter table public.notification_events
  add column if not exists source_id text;

alter table public.notification_events
  add column if not exists status text;

alter table public.notification_events
  add column if not exists recipient_count integer;

alter table public.notification_events
  add column if not exists payload jsonb;

alter table public.notification_events
  add column if not exists expo_response jsonb;

alter table public.notification_events
  add column if not exists error_message text;

alter table public.notification_events
  add column if not exists sent_at timestamptz;

alter table public.notification_events
  add column if not exists created_at timestamptz;

alter table public.notification_events
  add column if not exists updated_at timestamptz;

alter table public.notification_events
  alter column id set default gen_random_uuid();

alter table public.notification_events
  alter column status set default 'processing';

alter table public.notification_events
  alter column recipient_count set default 0;

alter table public.notification_events
  alter column payload set default '{}'::jsonb;

alter table public.notification_events
  alter column created_at set default timezone('utc', now());

alter table public.notification_events
  alter column updated_at set default timezone('utc', now());

update public.notification_events
set
  id = coalesce(id, gen_random_uuid()),
  status = coalesce(nullif(btrim(status), ''), 'processing'),
  recipient_count = coalesce(recipient_count, 0),
  payload = coalesce(payload, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

delete from public.notification_events
where event_key is null
   or btrim(event_key) = ''
   or event_type is null
   or btrim(event_type) = ''
   or source_table is null
   or btrim(source_table) = ''
   or source_id is null
   or btrim(source_id) = '';

with duplicate_rows as (
  select
    ctid,
    row_number() over (
      partition by event_key
      order by created_at asc, ctid asc
    ) as duplicate_rank
  from public.notification_events
)
delete from public.notification_events event
using duplicate_rows
where event.ctid = duplicate_rows.ctid
  and duplicate_rows.duplicate_rank > 1;

alter table public.notification_events
  alter column id set not null;

alter table public.notification_events
  alter column event_key set not null;

alter table public.notification_events
  alter column event_type set not null;

alter table public.notification_events
  alter column source_table set not null;

alter table public.notification_events
  alter column source_id set not null;

alter table public.notification_events
  alter column status set not null;

alter table public.notification_events
  alter column recipient_count set not null;

alter table public.notification_events
  alter column payload set not null;

alter table public.notification_events
  alter column created_at set not null;

alter table public.notification_events
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_events_pkey'
      and conrelid = 'public.notification_events'::regclass
  ) then
    alter table public.notification_events
      add constraint notification_events_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_events_actor_fkey'
      and conrelid = 'public.notification_events'::regclass
  ) then
    alter table public.notification_events
      add constraint notification_events_actor_fkey
      foreign key (actor_id)
      references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_events_status_valid'
      and conrelid = 'public.notification_events'::regclass
  ) then
    alter table public.notification_events
      add constraint notification_events_status_valid
      check (status in ('processing', 'sent', 'skipped', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_events_recipient_count_nonnegative'
      and conrelid = 'public.notification_events'::regclass
  ) then
    alter table public.notification_events
      add constraint notification_events_recipient_count_nonnegative
      check (recipient_count >= 0);
  end if;
end $$;

create unique index if not exists notification_events_event_key_idx
  on public.notification_events (event_key);

create index if not exists notification_events_actor_created_idx
  on public.notification_events (actor_id, created_at desc);

create index if not exists notification_events_source_idx
  on public.notification_events (source_table, source_id);

create schema if not exists private;

create or replace function private.set_notification_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_notification_event_updated_at
  on public.notification_events;

create trigger set_notification_event_updated_at
before update on public.notification_events
for each row
execute function private.set_notification_event_updated_at();

alter table public.notification_events enable row level security;

revoke all on public.notification_events from anon;
revoke all on public.notification_events from authenticated;

commit;

-- Webhook setup:
--
-- 1. Deploy the function:
--      supabase functions deploy send-workout-started-notification
--
-- 2. Set a secret in Supabase Functions:
--      FITVEN_NOTIFICATION_WEBHOOK_SECRET=<long-random-value>
--
-- 3. Create a Database Webhook in the Supabase Dashboard:
--      Table: public.workout_type_instance
--      Events: INSERT and UPDATE
--      URL: https://<project-ref>.supabase.co/functions/v1/send-workout-started-notification
--      Method: POST
--      Headers:
--        Content-Type: application/json
--        x-fitven-webhook-secret: <same-long-random-value>
--
-- The function itself filters non-start writes, so the webhook can listen to
-- every INSERT and UPDATE on workout_type_instance. INSERT is required when a
-- workout is first synced to Supabase after its timer has already started.
--
-- Manual SQL test after the webhook is active:
--
-- 1. Confirm the receiving account has a token:
--      select profile.username, token.platform, token.enabled, token.last_seen_at
--      from public.push_tokens token
--      join public.profiles profile on profile.id = token.user_id
--      order by token.last_seen_at desc;
--
-- 2. Pick a workout owned by the test account:
--      select id, user_id, label, done, is_active, timer_start
--      from public.workout_type_instance
--      where user_id = '<test-account-user-id>'
--      order by id desc
--      limit 10;
--
-- 3. Reset and start one workout. Delete the event row only when deliberately
--    retesting the same workout id:
--      delete from public.notification_events
--      where event_key = 'workout_started:<workout-id>';
--
--      update public.workout_type_instance
--      set done = false,
--          is_active = false,
--          timer_start = null,
--          deleted_at = null,
--          is_deleting = false,
--          last_updated = timezone('utc', now())
--      where id = <workout-id>;
--
--      update public.workout_type_instance
--      set done = false,
--          is_active = true,
--          timer_start = (now() at time zone 'utc')::time,
--          deleted_at = null,
--          is_deleting = false,
--          last_updated = timezone('utc', now())
--      where id = <workout-id>;
