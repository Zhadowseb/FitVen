-- An index for the lookup behind every signed lift video.
--
-- Run after 20260921180000_music-opt-in.sql.
--
-- `private.can_watch_lift_video` is the read policy behind the `lift-videos`
-- bucket and filters on `gym_lift.video_path`. None of the three indexes on
-- that table covers the column, so every signed URL was a sequential scan -
-- and the client signs a whole verification queue at once.
--
-- **Run this file on its own, as the only statement in the editor.**
-- `create index concurrently` cannot run inside a transaction block, which is
-- also the point: it takes no lock that stops writes, so it cannot deadlock
-- against the app the way the first version of this change did.
--
-- If it fails halfway it leaves an invalid index behind. Check with
--
--   select indexrelid::regclass, indisvalid
--   from pg_index
--   where indexrelid = 'gym_lift_video_path_idx'::regclass;
--
-- and if `indisvalid` is false, `drop index gym_lift_video_path_idx;` and run
-- this again.
--
-- Partial, because `video_path` is null for every lift without a video, which
-- is most of them.

create index concurrently if not exists gym_lift_video_path_idx
  on public.gym_lift (video_path)
  where video_path is not null;
