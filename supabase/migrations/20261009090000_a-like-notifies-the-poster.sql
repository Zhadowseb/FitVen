-- A like tells the post's author: "Bo liked your post", in their notification
-- history, and as a push once the Edge Function below is deployed.
--
-- Run after 20261004090000_progress-counts-every-exercise.sql. That is the
-- order, not a dependency. What this does depend on is live: social_post and
-- social_post_like from 20260525142801_social-posts.sql, social_post.hidden_at
-- from 20260921120000_hide-a-reported-post.sql, the notification tables from
-- 20260609112711_push-notifications.sql, 20260609112712_workout-start-
-- notifications.sql and 20260610205948_notification-history.sql, and
-- private.blocked_between from 20260917120000_gyms-and-lift-verification.sql.
--
-- What it adds:
--   * notification_preferences.post_like_notifications - the author's switch,
--     on unless they turn it off (Notification settings, "When someone likes
--     your post"). Off means no history row and no push.
--   * private.notify_post_owner_of_like - an after insert trigger on
--     social_post_like, the same shape as hide_custom_exercise_when_reported
--     in 20260928090000_custom-exercises-can-be-shared.sql: an event, then
--     the inbox row the bell shows, then the event marked sent. Security
--     definer, because the liker can write neither table.
--
-- Nobody is told when:
--   * you like your own post;
--   * there is a block between the two of you, either way. The like insert
--     policy already hides a post across a block, so this is the second lock,
--     and it goes through private.blocked_between, never a policy (src/AGENTS.md);
--   * the post is deleted or hidden;
--   * the author has switched likes off.
--
-- One notification per person per post, for as long as the event is kept.
-- The event key is
-- post-liked:<post_id>:<liker_id> and the insert is on conflict do nothing, so
-- an unlike and a like again, or an upsert that lands twice, finds the key
-- taken and writes nothing. The event outlives the inbox row: deleting the
-- notification does not let the next like send another.
--
-- A like never fails because of this. Anything the trigger cannot do is a
-- warning in the log, and the like is saved as before.
--
-- The title and body are English, as the other inbox rows are; the
-- notification page shows its own translation of this one. data carries the
-- liker's name as well as their id: the author may not follow the liker, and
-- then profiles does not answer for them, so the history page's actor join
-- comes back empty.
--
-- Until this has run, a like tells nobody, as before, and the switch in the
-- app is shown on and cannot be saved. Nothing else changes. Safe to run
-- twice.

begin;

create schema if not exists private;

/* ------------------------------------------------------------ the switch -- */

alter table public.notification_preferences
  add column if not exists post_like_notifications boolean not null default true;

/* ----------------------------------------------------------- the trigger -- */

create or replace function private.notify_post_owner_of_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  liked_post public.social_post%rowtype;
  liker_name text;
  wants_likes boolean;
  like_data jsonb;
  new_event_id uuid;
begin
  select * into liked_post from public.social_post post where post.id = new.post_id;

  if not found
     or liked_post.author_id = new.user_id
     or liked_post.deleted_at is not null
     or liked_post.hidden_at is not null then
    return null;
  end if;

  if private.blocked_between(new.user_id, liked_post.author_id) then
    return null;
  end if;

  select coalesce(
    (
      select preference.post_like_notifications
      from public.notification_preferences preference
      where preference.user_id = liked_post.author_id
    ),
    true
  )
  into wants_likes;

  if not wants_likes then
    return null;
  end if;

  select coalesce(
    nullif(btrim(profile.display_name), ''),
    nullif(split_part(profile.username, '#', 1), '')
  )
  into liker_name
  from public.profiles profile
  where profile.id = new.user_id;

  liker_name := coalesce(liker_name, 'Someone');

  like_data := jsonb_build_object(
    'post_id', liked_post.id,
    'author_id', liked_post.author_id,
    'liker_id', new.user_id,
    'liker_name', liker_name,
    'post_title', liked_post.title,
    'workout_type', liked_post.workout_type
  );

  insert into public.notification_events (event_key, event_type, actor_id, source_table, source_id, status, payload)
  values (
    'post-liked:' || liked_post.id || ':' || new.user_id,
    'social_post_liked',
    new.user_id,
    'social_post_like',
    liked_post.id || ':' || new.user_id,
    'processing',
    like_data
  )
  on conflict (event_key) do nothing
  returning id into new_event_id;

  -- Told already, about this post by this person.
  if new_event_id is null then
    return null;
  end if;

  insert into public.notification_inbox (user_id, actor_id, event_id, event_type, title, body, data)
  values (
    liked_post.author_id,
    new.user_id,
    new_event_id,
    'social_post_liked',
    liker_name || ' liked your post',
    liked_post.title,
    like_data
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
    raise warning 'A like on post % could not notify its author: %', new.post_id, sqlerrm;
    return null;
end;
$$;

revoke all on function private.notify_post_owner_of_like() from public, anon, authenticated;

drop trigger if exists social_post_like_notify_owner on public.social_post_like;
create trigger social_post_like_notify_owner
after insert on public.social_post_like
for each row execute function private.notify_post_owner_of_like();

commit;

-- The push. The history row above needs nothing more; the push is sent by the
-- send-post-liked-notification Edge Function, which reads the event this
-- trigger wrote and sends it to the author's devices once.
--
-- 1. Redeploy the workout-start function first. Its limit of twelve events an
--    hour per person counted every notification event, so a dozen likes in an
--    hour would have refused that person's next workout-start push. It now
--    counts workout starts only:
--      supabase functions deploy send-workout-started-notification
--
-- 2. Deploy the new function (verify_jwt is off in supabase/config.toml; it
--    checks the same FITVEN_NOTIFICATION_WEBHOOK_SECRET as the workout one):
--      supabase functions deploy send-post-liked-notification
--
-- 3. Create a Database Webhook in the Supabase Dashboard:
--      Table: public.social_post_like
--      Events: INSERT
--      URL: https://<project-ref>.supabase.co/functions/v1/send-post-liked-notification
--      Method: POST
--      Headers:
--        Content-Type: application/json
--        x-fitven-webhook-secret: <the value of FITVEN_NOTIFICATION_WEBHOOK_SECRET>
--
-- Checks afterwards:
--
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.social_post_like'::regclass and not tgisinternal;
--
--   select column_name, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'notification_preferences'
--     and column_name = 'post_like_notifications';
--
--   select event_key, status, recipient_count, expo_response is not null as pushed
--   from public.notification_events
--   where event_type = 'social_post_liked'
--   order by created_at desc limit 10;
