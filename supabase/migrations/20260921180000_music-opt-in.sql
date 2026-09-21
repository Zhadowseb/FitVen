-- Sharing music is opt-in in the database, not only in the app.
--
-- Run after 20260921170000_blocked-members-cannot-watch.sql.
--
-- The insert policy on `workout_music` asked whether the row was yours and
-- whether the workout was yours. It did not ask whether you had turned sharing
-- on - only `pollWorkoutMusic` did, in the client - while the select policy
-- shows the table to every follower. A rule that lives only in the app is a
-- suggestion, because the same API answers an HTTP client holding the anon
-- key.
--
-- This is a check on the writer's own row, not a block between two people, so
-- it belongs in the policy; the rule in `src/AGENTS.md` about keeping block
-- checks out of policies is about the other case.
--
-- This file touches one table on purpose. It first shipped with the lift-video
-- index in the same transaction, which held a lock on `workout_music` while
-- asking for one on `gym_lift`, and deadlocked against a live app session
-- holding them the other way round. The index is now its own file.

begin;

-- Fail rather than queue. A policy swap needs the table to itself for a
-- moment, and waiting for it behind a long-running read is how the deadlock
-- happened. If this times out, run it again when the app is quieter.
set local lock_timeout = '5s';

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

commit;
