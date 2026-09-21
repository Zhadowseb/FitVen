-- One verification request per lift per ten minutes, enforced by the index.
--
-- Run after 20260921180100_lift-video-index.sql.
--
-- The limit added in 20260921140000 was a select followed by an insert. Two
-- calls a second apart both passed the select - under read committed neither
-- sees the other's uncommitted row - and both sent, filling ten inboxes each.
-- The unique index on event_key would have caught them, except the key
-- carried the epoch second, so it only caught calls inside the same second.
--
-- The key now names a ten-minute bucket, and the insert is `on conflict do
-- nothing`. There is no longer a gap between deciding and writing: the index
-- decides. A call that loses reports nobody notified, which is what the
-- client already does with a zero.
--
-- Two calls either side of a bucket boundary still both go through. That is
-- a second's worth of slack rather than an unbounded loop, and it costs no
-- lock to leave it there.

begin;

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

  -- No check first. Two calls a second apart both passed a select and both
  -- inserted, because neither sees the other's uncommitted row under read
  -- committed - and the epoch second in the key meant the unique index only
  -- caught calls inside the same second. The key is now one bucket per lift
  -- per ten minutes, so the index itself is the rate limit and there is
  -- nothing between the check and the write to slip through.

  select profile.display_name into lifter_name from public.profiles profile where profile.id = viewer_id;
  select gym.short_name into gym_short_name from public.gym gym where gym.id = lift.gym_id;

  insert into public.notification_events (event_key, event_type, actor_id, source_table, source_id, status, payload)
  values (
    'lift-verification:' || lift.id || ':' ||
      (floor(extract(epoch from timezone('utc', now())) / 600))::bigint,
    'lift_verification_requested',
    viewer_id,
    'gym_lift',
    lift.id::text,
    'processing',
    jsonb_build_object('lift_id', lift.id, 'gym_id', lift.gym_id, 'exercise_id', lift.exercise_id)
  )
  on conflict (event_key) do nothing
  returning id into event_id;

  -- Somebody already asked for this lift inside the same ten minutes. The
  -- client already treats a zero as nobody notified.
  if event_id is null then
    return 0;
  end if;

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
