-- The step of the weight bar, per exercise and per person.
--
-- Run after 20261011090000_daily-steps.sql. That is the order,
-- not a dependency: this only needs exercise_column_preferences from
-- 20260519012251_exercise-column-preferences.sql.
--
-- While a weight is edited in a workout, a bar over the keyboard has minus,
-- plus and a small field with the step they move by. What is typed in the
-- field is kept for that exercise, and is what minus and plus use from then on
-- - in every workout, and on the lock screen card - so it follows the person to
-- a new phone like the exercise's weight_mode does.
--
--   * exercise_column_preferences.weight_step - kg, between 0.25 and 50, or 0.
--     Null: never chosen, and what an older app writes (it does not send the
--     column) - another phone's choice is not erased by it. 0: the person
--     cleared the field, the automatic step applies again. 0 is a value and not
--     a null because a null is not sent: a cleared step stored as null on the
--     phone would never reach the cloud, and the old step would come back from
--     it.
--
-- The app reaches the cloud before or after this, either way: until it has
-- run, a phone on this version finds the column missing (42703 on a read,
-- PGRST204 on a write), syncs the preferences without it for the rest of that
-- session, and keeps the step on the phone. Nothing else stops syncing.
--
-- A custom exercise has no row in the cloud's catalogue, so its step stays on
-- the phone that set it.
--
-- Idempotent: `add column if not exists`, and the check only when it is not
-- there yet. A nullable column with no default, so no row is rewritten. A
-- lock timeout: a busy moment makes this give up rather than queue; run it
-- again.

begin;

set local lock_timeout = '5s';

alter table public.exercise_column_preferences
  add column if not exists weight_step numeric(5, 2);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'exercise_column_preferences_weight_step_valid'
      and conrelid = 'public.exercise_column_preferences'::regclass
  ) then
    alter table public.exercise_column_preferences
      add constraint exercise_column_preferences_weight_step_valid
      check (weight_step is null or weight_step = 0 or (weight_step >= 0.25 and weight_step <= 50))
      not valid;
  end if;
end;
$$;

commit;

-- Added `not valid` so the lock is held for a moment and not for a scan.
-- Every row is null here, which passes; run again, it is a no-op.
alter table public.exercise_column_preferences
  validate constraint exercise_column_preferences_weight_step_valid;

notify pgrst, 'reload schema';

-- Check afterwards. It should name the column, and the count should be 0 until
-- a phone has chosen a step:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'exercise_column_preferences'
--     and column_name = 'weight_step';
--
--   select count(*) from public.exercise_column_preferences
--   where weight_step is not null;
