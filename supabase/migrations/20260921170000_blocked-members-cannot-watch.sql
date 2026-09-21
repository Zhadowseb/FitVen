-- A blocked member cannot watch the other's verification video.
--
-- Run after 20260921140000_lift-videos-stay-in-the-centre.sql.
--
-- That file shut the videos to the centre they were lifted in, and is
-- already applied, so this is a follow-up rather than an edit to it.
-- `private.can_watch_lift_video` was the one function in it that did not ask
-- about blocks. Everything else does: `private.ranked_lifts`, the vote
-- trigger and the verification queue. The gap was reachable - a leaderboard
-- row carries the lifter's id and the lift id, and the object path is
-- `<user_id>/<lift_id>.<ext>` - so somebody who had seen a row before
-- blocking could still ask for a signed URL and get one.
--
-- The function below is the applied one with that single clause added.

begin;

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
        -- The one path in that file that forgot it. ranked_lifts, the vote
        -- trigger and the queue all drop a blocked pair; this did not, so
        -- somebody who saw a row before blocking could still ask for the
        -- signed URL afterwards and get it.
        and not private.blocked_between((select auth.uid()), lift.user_id)
    );
$$;

revoke all on function private.can_watch_lift_video(text) from public;
revoke all on function private.can_watch_lift_video(text) from anon;
revoke all on function private.can_watch_lift_video(text) from authenticated;

commit;
