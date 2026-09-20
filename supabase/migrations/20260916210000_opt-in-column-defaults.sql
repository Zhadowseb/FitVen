-- Turn note, RPE and 1RM% off in the saved column preferences.
--
-- Run after 20260519012251_exercise-column-preferences.sql.
--
-- These three columns became opt-in some time ago, and the app has a repair
-- that turns them off in the local database. The cloud copy was never touched,
-- and the preference table syncs both ways - so the repair cleaned the device,
-- the next sync pulled the old value back down, and every exercise added to a
-- workout came with a NOTE column again. It looked like the default had never
-- changed. It had; the default was just never what got read, because a saved
-- preference wins over it.
--
-- One-off, and deliberately matched to what the app's own repair does, so the
-- two sides agree afterwards rather than overwriting each other. The repair is
-- now guarded to run once as well - before this it ran on every launch, which
-- made these columns impossible to keep rather than off by default.
--
-- After this, turning NOTE on for an exercise sticks and syncs, which is what a
-- per-exercise preference is for. Only the historical rows are corrected.

update public.exercise_column_preferences
set
  visible_columns = visible_columns
    || jsonb_build_object('note', false, 'rpe', false, 'rm_percentage', false),
  updated_at = timezone('utc', now())
where
  coalesce((visible_columns ->> 'note')::boolean, false)
  or coalesce((visible_columns ->> 'rpe')::boolean, false)
  or coalesce((visible_columns ->> 'rm_percentage')::boolean, false);

-- Check afterwards; this should return no rows.
--
--   select exercise_id, visible_columns
--   from public.exercise_column_preferences
--   where (visible_columns ->> 'note') in ('true', '1');
