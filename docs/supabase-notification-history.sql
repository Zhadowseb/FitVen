-- Adds a durable, user-readable notification inbox.
--
-- Run after:
--   docs/supabase-social-search.sql
--   docs/supabase-workout-start-notifications.sql

begin;

create table if not exists public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, event_id)
);

create index if not exists notification_inbox_user_created_idx
  on public.notification_inbox (user_id, created_at desc);

create index if not exists notification_inbox_user_unread_idx
  on public.notification_inbox (user_id, created_at desc)
  where read_at is null;

create schema if not exists private;

create or replace function private.set_notification_inbox_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_notification_inbox_updated_at
  on public.notification_inbox;

create trigger set_notification_inbox_updated_at
before update on public.notification_inbox
for each row
execute function private.set_notification_inbox_updated_at();

alter table public.notification_inbox enable row level security;

revoke all
  on public.notification_inbox
  from anon, authenticated;

grant select, delete
  on public.notification_inbox
  to authenticated;

grant update (read_at)
  on public.notification_inbox
  to authenticated;

drop policy if exists "Users can view their own notification inbox"
  on public.notification_inbox;

create policy "Users can view their own notification inbox"
on public.notification_inbox
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark their own notifications as read"
  on public.notification_inbox;

create policy "Users can mark their own notifications as read"
on public.notification_inbox
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own notifications"
  on public.notification_inbox;

create policy "Users can delete their own notifications"
on public.notification_inbox
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;

-- Redeploy the workout-start function after applying this migration:
--   supabase functions deploy send-workout-started-notification
