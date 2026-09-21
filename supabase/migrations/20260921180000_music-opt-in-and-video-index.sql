-- The music opt-in gets a server side, and lift videos get the index the
-- lookup behind them needs.
--
-- Run after 20260921170000_blocked-members-cannot-watch.sql.
--
-- Both from the review of PR #253.

begin;

/* ------------------------------------------- sharing music is opt-in -- */

-- The insert policy asked whether the row was yours and whether the workout
-- was yours. It did not ask whether you had turned sharing on - only
-- `pollWorkoutMusic` did, in the client. The select policy shows the table to
-- every follower, so the toggle protecting it had no counterpart in the
-- database, and a rule that lives only in the app is a suggestion: the same
-- API answers an HTTP client holding the anon key.
--
-- This is a check on the writer's own row, not a block between two people, so
-- it belongs in the policy - the rule in src/AGENTS.md about keeping block
-- checks out of policies is about the other case.
drop policy if exists "Users can record their own workout music" on public.workout_music;

create policy "Users can record their own workout music"
on public.workout_music
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.workout_type_instance workout
    where workout.id = public.workout_music.workout_type_instance_id
      and workout.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.profile_private settings
    where settings.user_id = (select auth.uid())
      and settings.share_music_with_friends
  )
);

/* ------------------------------------------------ finding a lift video -- */

-- `private.can_watch_lift_video` is the read policy behind the lift-videos
-- bucket and filters on `video_path`; none of the three indexes on gym_lift
-- covers that column. Every signed URL cost a sequential scan, and the client
-- signs the whole verification queue at once. Partial, because the column is
-- null for every lift without a video, which is most of them.
create index if not exists gym_lift_video_path_idx
  on public.gym_lift (video_path)
  where video_path is not null;

commit;
