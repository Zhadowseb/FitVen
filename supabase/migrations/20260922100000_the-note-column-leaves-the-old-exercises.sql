-- Turn note, RPE and 1RM% off on the exercise rows written before they were
-- opt-in.
--
-- Run after 20260922090000_a-feedback-message-has-a-status.sql.
--
-- `20260916210000_opt-in-column-defaults.sql` did this for
-- `exercise_column_preferences` and stopped there. `exercise_instance` was
-- never touched, and it still held 26 rows with note on.
--
-- That was enough on its own, because of how a workout is copied:
-- `cloneWorkoutContents` carries `visible_columns` across verbatim, which is
-- right - a copy should look like the thing it was copied from. But it means a
-- legacy row is not a museum piece. Copy a session from before the default
-- changed and the NOTE column arrives in a brand new exercise, and that copy
-- is itself a legacy row now, syncing back up. Six months on it still looked
-- like the default had never changed.
--
-- The fix is the data, not the copy. With the old rows corrected, a copy is
-- right because its source is, and turning NOTE on for an exercise still
-- sticks and still travels into copies of it - which is what a per-exercise
-- choice is for.
--
-- The app has the matching half: the local pass that does the same to the
-- device's own rows now runs under `opt_in_visible_columns_v2`, so it goes
-- once more rather than staying shut behind a flag set before any of this was
-- true. Both sides land on the same answer, so neither overwrites the other.
--
-- Anybody who deliberately switched one of these on before today loses it
-- once. That is the price of the correction and it is a single tap to undo,
-- per exercise, and it now stays.

begin;

update public.exercise_instance
set
  visible_columns = visible_columns
    || jsonb_build_object('note', false, 'rpe', false, 'rm_percentage', false)
where
  coalesce((visible_columns ->> 'note')::boolean, false)
  or coalesce((visible_columns ->> 'rpe')::boolean, false)
  or coalesce((visible_columns ->> 'rm_percentage')::boolean, false);

-- The catalog's own defaults, for the same reason. The app already strips
-- these three from whatever the catalog carries, so nothing reads them today -
-- but a default that says one thing while the code says another is a trap for
-- whoever touches `withoutOptInColumns` next.
update public."Exercise"
set
  default_visible_columns = default_visible_columns
    || jsonb_build_object('note', false, 'rpe', false, 'rm_percentage', false)
where
  default_visible_columns is not null
  and (
    coalesce((default_visible_columns ->> 'note')::boolean, false)
    or coalesce((default_visible_columns ->> 'rpe')::boolean, false)
    or coalesce((default_visible_columns ->> 'rm_percentage')::boolean, false)
  );

commit;

-- Check afterwards; both of these should return 0.
--
--   select count(*) from public.exercise_instance
--   where (visible_columns ->> 'note') in ('true', '1');
--
--   select count(*) from public.exercise_column_preferences
--   where (visible_columns ->> 'note') in ('true', '1');
