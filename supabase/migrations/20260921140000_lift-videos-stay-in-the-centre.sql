-- A verification video is for the centre it was lifted in, not for everybody
-- with an account.
--
-- Run after 20260917120000_gyms-and-lift-verification.sql.
--
-- That file is already applied, so this is the follow-up rather than an edit to
-- it. Three holes, all found by the review agents on PR #253. The three
-- functions below are copied from it verbatim with one change each, so a diff
-- against the original shows exactly what moved.
--
-- 1. `gym_lift_verification_queue` worked out centre membership, put it in the
--    payload as `can_vote`, and then handed `video_path` to everybody anyway.
--    The storage policy was `bucket_id = 'lift-videos'` and nothing else, so
--    the signed URL was issued as well. Centres are public and searchable, so
--    any signed-in user could open any centre's leaderboard and watch
--    strangers' verification videos. The comments in that file say members
--    only; only the vote was.
-- 2. `video_path` accepted any string. The client always writes
--    `<user_id>/<lift_id>.<ext>`, but PostgREST does not have to, so a user
--    could point their own lift at somebody else's real video and have the
--    centre vote it through.
-- 3. `request_lift_verification` put the epoch second in the event key, so
--    every call was a new event and a loop could fill ten inboxes at will.

begin;

/* ------------------------------------------------- who may watch a video -- */

-- security definer because the answer depends on `gym_lift`, which only
-- answers for your own rows, and on other people's workouts. A policy
-- expression can see neither, so this cannot live inline in the policy - the
-- same reason every ranked read in the original file is a function.
create or replace function private.can_watch_lift_video(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- Your own folder first: you can watch what you uploaded, including before
    -- it is attached to a lift.
    (storage.foldername(object_name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.gym_lift lift
      where lift.video_path = object_name
        and private.trains_at_gym((select auth.uid()), lift.gym_id)
    );
$$;

revoke all on function private.can_watch_lift_video(text) from public;
revoke all on function private.can_watch_lift_video(text) from anon;
revoke all on function private.can_watch_lift_video(text) from authenticated;

drop policy if exists "Authenticated users can read lift videos" on storage.objects;
drop policy if exists "Centre members can read lift videos" on storage.objects;

create policy "Centre members can read lift videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lift-videos'
  and private.can_watch_lift_video(name)
);

/* -------------------------------------------- the queue is members only -- */

-- Somebody who does not train here now gets an empty queue rather than a list
-- of paths. `can_vote` stays in the payload, always true, because the client
-- reads it and an unchanged client has to keep working.
create or replace function public.gym_lift_verification_queue(target_gym_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  ranked as (
    select * from private.ranked_lifts((select id from viewer), target_gym_id, null, 'gym', 'kg')
  ),
  pending as (
    select
      r.row_json,
      lift.video_path,
      lift.updated_at as video_uploaded_at,
      (
        select count(*) + 1
        from ranked other
        where other.exercise_id = r.exercise_id
          and other.rank is not null
          and other.video_status = 'verified'
          and other.weight_kg > r.weight_kg
      ) as rank_if_verified
    from ranked r
    join public.gym_lift lift on lift.id = r.lift_id
    where r.video_status = 'pending'
      and not r.is_me
      and lift.video_path is not null
      and not exists (
        select 1
        from public.gym_lift_vote vote
        where vote.lift_id = r.lift_id
          and vote.voter_id = (select id from viewer)
      )
  )
  select coalesce(jsonb_agg(
    pending.row_json || jsonb_build_object(
      'video_path', pending.video_path,
      'video_uploaded_at', pending.video_uploaded_at,
      'rank_if_verified', pending.rank_if_verified,
      'can_vote', true
    )
    order by pending.video_uploaded_at asc
  ), '[]'::jsonb)
  from pending
  where (select id from viewer) is not null
    and private.trains_at_gym((select id from viewer), target_gym_id);
$$;

revoke all on function public.gym_lift_verification_queue(bigint) from public, anon;
grant execute on function public.gym_lift_verification_queue(bigint) to authenticated;

/* ------------------------------------ a video has to be the lifter's own -- */

create or replace function private.gym_lift_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('fitven.gym_lift_recount', true) = 'on' then
    new.updated_at := timezone('utc', now());
    return new;
  end if;

  -- The same rule storage.objects already enforces on the upload, applied to
  -- the row that points at it. Without it the upload rule is decoration: you
  -- upload into your own folder and then point your lift at somebody else's.
  if new.video_path is not null
     and (storage.foldername(new.video_path))[1] is distinct from new.user_id::text then
    raise exception 'A lift video has to be your own upload.' using errcode = '42501';
  end if;

  -- The votes go with the video. Deleting them fires the recount trigger,
  -- which would update this very row from inside its own BEFORE trigger -
  -- Postgres refuses that ("tuple to be updated was already modified") - so
  -- the recount is told to stand down; the values are set right here anyway.
  if new.weight_kg <> old.weight_kg then
    new.previous_weight_kg := old.weight_kg;
    new.video_path := null;
    new.video_status := 'none';
    new.approvals := 0;
    new.rejections := 0;
    perform set_config('fitven.gym_lift_skip_recount', 'on', true);
    delete from public.gym_lift_vote where lift_id = old.id;
    perform set_config('fitven.gym_lift_skip_recount', 'off', true);
  elsif new.video_path is distinct from old.video_path then
    new.video_status := case when new.video_path is null then 'none' else 'pending' end;
    new.approvals := 0;
    new.rejections := 0;
    perform set_config('fitven.gym_lift_skip_recount', 'on', true);
    delete from public.gym_lift_vote where lift_id = old.id;
    perform set_config('fitven.gym_lift_skip_recount', 'off', true);
  else
    new.video_status := old.video_status;
    new.approvals := old.approvals;
    new.rejections := old.rejections;
    new.previous_weight_kg := old.previous_weight_kg;
  end if;

  new.user_id := old.user_id;
  new.gym_id := old.gym_id;
  new.exercise_id := old.exercise_id;
  new.created_at := old.created_at;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- The insert path needs the same rule: a row can be created with a video
-- already on it.
create or replace function private.gym_lift_reject_foreign_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.video_path is not null
     and (storage.foldername(new.video_path))[1] is distinct from new.user_id::text then
    raise exception 'A lift video has to be your own upload.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists gym_lift_reject_foreign_video on public.gym_lift;
create trigger gym_lift_reject_foreign_video
before insert on public.gym_lift
for each row execute function private.gym_lift_reject_foreign_video();

/* --------------------------------------- one request per lift, not ten -- */

create or replace function public.request_lift_verification(target_lift_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  lift public.gym_lift%rowtype;
  lifter_name text;
  gym_short_name text;
  event_id uuid;
  recipient_count integer := 0;
begin
  if viewer_id is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into lift from public.gym_lift where id = target_lift_id;

  if not found or lift.user_id <> viewer_id then
    raise exception 'That lift is not yours to send for verification.' using errcode = '42501';
  end if;

  if lift.video_path is null then
    raise exception 'Attach a video first.' using errcode = '23514';
  end if;

  -- The epoch second in the event key below makes every call a new event, so a
  -- loop filled ten inboxes as fast as it could run. A lift that has already
  -- asked within the window notifies nobody and reports zero, which is what
  -- the client already does with a zero.
  if exists (
    select 1
    from public.notification_events event
    where event.event_type = 'lift_verification_requested'
      and event.source_table = 'gym_lift'
      and event.source_id = lift.id::text
      and event.created_at >= timezone('utc', now()) - interval '10 minutes'
  ) then
    return 0;
  end if;

  select profile.display_name into lifter_name from public.profiles profile where profile.id = viewer_id;
  select gym.short_name into gym_short_name from public.gym gym where gym.id = lift.gym_id;

  insert into public.notification_events (event_key, event_type, actor_id, source_table, source_id, status, payload)
  values (
    'lift-verification:' || lift.id || ':' || floor(extract(epoch from timezone('utc', now())))::bigint,
    'lift_verification_requested',
    viewer_id,
    'gym_lift',
    lift.id::text,
    'processing',
    jsonb_build_object('lift_id', lift.id, 'gym_id', lift.gym_id, 'exercise_id', lift.exercise_id)
  )
  returning id into event_id;

  with members as (
    select workout.user_id, max(workout.date) as last_date
    from public.workout_type_instance workout
    where workout.gym_id = lift.gym_id
      and workout.done = true
      and workout.deleted_at is null
      and workout.date::date >= current_date - 90
      and workout.user_id <> viewer_id
      and not private.blocked_between(viewer_id, workout.user_id)
    group by workout.user_id
    order by last_date desc
    limit 10
  ),
  inserted as (
    insert into public.notification_inbox (user_id, actor_id, event_id, event_type, title, body, data)
    select
      members.user_id,
      viewer_id,
      event_id,
      'lift_verification_requested',
      coalesce(lifter_name, 'Someone') || ' wants a lift verified',
      lift.exercise_name || ' · ' || trim(to_char(lift.weight_kg, 'FM9999990.##')) || ' kg at ' || coalesce(gym_short_name, 'your centre'),
      jsonb_build_object('lift_id', lift.id, 'gym_id', lift.gym_id, 'exercise_id', lift.exercise_id)
    from members
    on conflict (user_id, event_id) do nothing
    returning 1
  )
  select count(*)::integer into recipient_count from inserted;

  update public.notification_events
  set recipient_count = request_lift_verification.recipient_count,
      status = 'sent',
      sent_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = event_id;

  return recipient_count;
end;
$$;

revoke all on function public.request_lift_verification(bigint) from public, anon;
grant execute on function public.request_lift_verification(bigint) to authenticated;

commit;
