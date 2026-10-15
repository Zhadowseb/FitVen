-- A friend starts a workout and you get "Push started". With this you can cheer
-- them on from that notification - "💪 Good workout!" - and they are told:
-- "Sebastian cheered you on", in their notification history and as a push once
-- the Edge Function below is deployed.
--
-- Run after 20261011090000_daily-steps.sql. That is the order, not a
-- dependency. What this does depend on is live: the notification tables from
-- 20260609112711_push-notifications.sql, 20260609112712_workout-start-
-- notifications.sql and 20260610205948_notification-history.sql,
-- notification_preferences.post_like_notifications from 20261009090000_a-like-
-- notifies-the-poster.sql (the model for the switch here), and
-- private.blocked_between from 20260917120000_gyms-and-lift-verification.sql.
--
-- What it adds:
--   * notification_preferences.cheer_notifications - the athlete's switch, on
--     unless they turn it off (Notification settings, "When someone cheers you
--     on"). Off means no history row and no push, as it does for likes. The
--     workout-start function reads it too: with it off, the push about their
--     workout carries no reply buttons.
--   * public.workout_cheer - one row per cheer: which workout (the
--     workout_started notification_events row), who sent it, who gets it, which
--     of the three presets - or "custom" with up to 140 characters of text.
--   * private.can_cheer - the one place that says whether a cheer may be sent.
--   * private.notify_recipient_of_cheer - an after insert trigger, the same
--     shape as private.notify_post_owner_of_like: an event, then the inbox row
--     the bell shows, then the event marked sent.
--
-- Who may cheer (the insert policy, through private.can_cheer):
--   * the workout is a workout_started event, less than six hours old;
--   * the sender was told about it: they have an inbox row for that event;
--   * the cheer goes to the person who started the workout. The app never
--     says who that is: a before insert trigger writes recipient_id from the
--     event, so nobody can send a cheer to someone else's inbox;
--   * not to yourself, and not across a block, either way.
-- One cheer per person per workout (unique event_id, sender_id). The app
-- inserts with on conflict do nothing, so a second press is ignored quietly.
-- The sender may delete their cheer. Nobody may change one.
--
-- The text of a custom cheer reaches a lock screen, so it is cleaned in the
-- database, whatever the app sent: line breaks and repeated spaces become one
-- space, the ends are trimmed, and what is left has to be 1-140 characters.
-- A preset carries no text; the app and the push write it from the id.
--
-- A cheer never fails because of the notification. Anything the trigger
-- cannot do is a warning in the log, and the cheer is saved.
--
-- The inbox title and body are English, as the other inbox rows are; the
-- notification page shows its own translation of the presets. data carries the
-- sender's name as well as their id: the athlete may not follow the sender, and
-- then profiles does not answer for them.
--
-- Until this has run, the reply buttons in the app cannot save a cheer, the
-- switch in the app is shown on and cannot be saved, and nothing else changes.
-- Safe to run twice.

begin;

create schema if not exists private;

/* ------------------------------------------------------------ the switch -- */

alter table public.notification_preferences
  add column if not exists cheer_notifications boolean not null default true;

/* ------------------------------------------------------------- the table -- */

create table if not exists public.workout_cheer (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  preset text not null,
  message text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint workout_cheer_preset_valid
    check (preset in ('good_workout', 'lets_go', 'crush_it', 'custom')),
  constraint workout_cheer_message_matches_preset
    check (
      (preset = 'custom' and message is not null and char_length(message) between 1 and 140)
      or (preset <> 'custom' and message is null)
    ),
  constraint workout_cheer_not_self
    check (sender_id <> recipient_id),
  constraint workout_cheer_one_per_person unique (event_id, sender_id)
);

create index if not exists workout_cheer_recipient_idx
  on public.workout_cheer (recipient_id, created_at desc);

/* ------------------------------------------------- who may cheer, in one -- */

create or replace function private.can_cheer(
  cheered_event_id uuid,
  cheering_user_id uuid,
  cheered_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    cheering_user_id is not null
    and cheered_user_id is not null
    and cheering_user_id <> cheered_user_id
    and exists (
      select 1
      from public.notification_events event
      where event.id = cheered_event_id
        and event.event_type = 'workout_started'
        and event.actor_id = cheered_user_id
        and event.created_at > timezone('utc', now()) - interval '6 hours'
    )
    and exists (
      select 1
      from public.notification_inbox inbox
      where inbox.user_id = cheering_user_id
        and inbox.event_id = cheered_event_id
    )
    and not private.blocked_between(cheering_user_id, cheered_user_id);
$$;

-- Called from a policy, which checks execute as the querying user.
revoke all on function private.can_cheer(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_cheer(uuid, uuid, uuid) to authenticated;

/* ------------------------------------------ the recipient, and the text -- */

create or replace function private.prepare_workout_cheer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select event.actor_id
    into new.recipient_id
  from public.notification_events event
  where event.id = new.event_id;

  if new.preset = 'custom' then
    new.message := nullif(btrim(regexp_replace(coalesce(new.message, ''), '\s+', ' ', 'g')), '');
  else
    new.message := null;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_workout_cheer() from public, anon, authenticated;

drop trigger if exists workout_cheer_prepare on public.workout_cheer;
create trigger workout_cheer_prepare
before insert on public.workout_cheer
for each row execute function private.prepare_workout_cheer();

/* ------------------------------------------------------- the permissions -- */

alter table public.workout_cheer enable row level security;

revoke all on public.workout_cheer from anon, authenticated;

-- recipient_id is not in the list: the trigger above writes it.
grant select, delete on public.workout_cheer to authenticated;
grant insert (event_id, preset, message) on public.workout_cheer to authenticated;

drop policy if exists "Cheers can be sent by someone told about the workout"
  on public.workout_cheer;

create policy "Cheers can be sent by someone told about the workout"
on public.workout_cheer
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.can_cheer(event_id, sender_id, recipient_id)
);

drop policy if exists "A cheer is visible to its sender and its recipient"
  on public.workout_cheer;

create policy "A cheer is visible to its sender and its recipient"
on public.workout_cheer
for select
to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
);

drop policy if exists "A sender can take back their cheer"
  on public.workout_cheer;

create policy "A sender can take back their cheer"
on public.workout_cheer
for delete
to authenticated
using (sender_id = (select auth.uid()));

/* ----------------------------------------------------------- the trigger -- */

create or replace function private.notify_recipient_of_cheer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
  wants_cheers boolean;
  cheer_text text;
  cheer_data jsonb;
  new_event_id uuid;
begin
  select coalesce(
    (
      select preference.cheer_notifications
      from public.notification_preferences preference
      where preference.user_id = new.recipient_id
    ),
    true
  )
  into wants_cheers;

  if not wants_cheers then
    return null;
  end if;

  select coalesce(
    nullif(btrim(profile.display_name), ''),
    nullif(split_part(profile.username, '#', 1), '')
  )
  into sender_name
  from public.profiles profile
  where profile.id = new.sender_id;

  sender_name := coalesce(sender_name, 'Someone');

  cheer_text := case new.preset
    when 'good_workout' then '💪 Good workout!'
    when 'lets_go' then '🔥 Let''s go!'
    when 'crush_it' then '👏 Crush it!'
    else '💬 ' || coalesce(new.message, '')
  end;

  cheer_data := jsonb_build_object(
    'cheer_id', new.id,
    'workout_event_id', new.event_id,
    'sender_id', new.sender_id,
    'sender_name', sender_name,
    'recipient_id', new.recipient_id,
    'preset', new.preset,
    'message', new.message
  );

  insert into public.notification_events (event_key, event_type, actor_id, source_table, source_id, status, payload)
  values (
    'cheer:' || new.event_id || ':' || new.sender_id,
    'cheer',
    new.sender_id,
    'workout_cheer',
    new.id::text,
    'processing',
    cheer_data
  )
  on conflict (event_key) do nothing
  returning id into new_event_id;

  -- Told already, about this workout by this person.
  if new_event_id is null then
    return null;
  end if;

  insert into public.notification_inbox (user_id, actor_id, event_id, event_type, title, body, data)
  values (
    new.recipient_id,
    new.sender_id,
    new_event_id,
    'cheer',
    sender_name || ' cheered you on',
    cheer_text,
    cheer_data
  )
  on conflict (user_id, event_id) do nothing;

  update public.notification_events event
     set recipient_count = 1,
         status = 'sent',
         sent_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where event.id = new_event_id;

  return null;
exception
  when others then
    raise warning 'A cheer on event % could not notify its recipient: %', new.event_id, sqlerrm;
    return null;
end;
$$;

revoke all on function private.notify_recipient_of_cheer() from public, anon, authenticated;

drop trigger if exists workout_cheer_notify_recipient on public.workout_cheer;
create trigger workout_cheer_notify_recipient
after insert on public.workout_cheer
for each row execute function private.notify_recipient_of_cheer();

commit;

-- The push. The history row above needs nothing more; the push is sent by the
-- send-cheer-notification Edge Function, which reads the event this trigger
-- wrote and sends it to the athlete's devices once.
--
-- 1. Deploy the new function (verify_jwt is off in supabase/config.toml; it
--    checks the same FITVEN_NOTIFICATION_WEBHOOK_SECRET as the others):
--      supabase functions deploy send-cheer-notification
--
-- 2. Create a Database Webhook in the Supabase Dashboard:
--      Table: public.workout_cheer
--      Events: INSERT
--      URL: https://<project-ref>.supabase.co/functions/v1/send-cheer-notification
--      Method: POST
--      Headers:
--        Content-Type: application/json
--        x-fitven-webhook-secret: <the value of FITVEN_NOTIFICATION_WEBHOOK_SECRET>
--
-- 3. Redeploy the workout-start function last. It now puts the workout's event
--    id in the push and, when the athlete has cheers on, the reply buttons:
--      supabase functions deploy send-workout-started-notification
--
-- Checks afterwards:
--
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.workout_cheer'::regclass and not tgisinternal;
--
--   select column_name, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'notification_preferences'
--     and column_name = 'cheer_notifications';
--
--   select event_key, status, recipient_count, expo_response is not null as pushed
--   from public.notification_events
--   where event_type = 'cheer'
--   order by created_at desc limit 10;
