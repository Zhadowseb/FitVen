-- Weight per side or for both sides (4d).
--
-- Run after 20261001090000_dev-kpis.sql.
--
-- `exercise_instance.weight_mode` says how one workout's weights for an
-- exercise are written: 'total' (both sides together) or 'per_side' (one
-- dumbbell, one handle). Null - every row from before this, and every row an
-- older app writes - means total, and the app never sends a null, so a row
-- another phone set is not erased by one that does not know the column.
--
-- `exercise_column_preferences.weight_mode` is the same choice for a catalog
-- exercise, per user, so it follows the person to a new phone. A custom
-- exercise already carries its own in `custom_exercise.weight_mode`
-- (20260928090000_custom-exercises-can-be-shared.sql), which also allows
-- 'bodyweight'; these two columns do not.
--
-- The app reaches the cloud before or after this, either way: until it has
-- run, a phone on 2.16 finds the column missing (42703 on a read, PGRST204 on
-- a write), syncs both tables without it for the rest of that session, and
-- keeps the choice on the phone. Nothing else stops syncing. After it has
-- run, the next start of the app sends and reads it.
--
-- Idempotent: `add column if not exists`, and the check constraints only
-- when they are not there yet. A nullable column with no default, so no row
-- is rewritten. One table per transaction, each with a lock timeout: the
-- lesson of 20260921180000_music-opt-in.sql, where two tables in one
-- transaction deadlocked against a live app session. A busy moment makes a
-- block give up rather than queue; run it again.

begin;

set local lock_timeout = '5s';

alter table public.exercise_instance
  add column if not exists weight_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'exercise_instance_weight_mode_known'
      and conrelid = 'public.exercise_instance'::regclass
  ) then
    alter table public.exercise_instance
      add constraint exercise_instance_weight_mode_known
      check (weight_mode in ('total', 'per_side'))
      not valid;
  end if;
end;
$$;

commit;

begin;

set local lock_timeout = '5s';

alter table public.exercise_column_preferences
  add column if not exists weight_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'exercise_column_preferences_weight_mode_known'
      and conrelid = 'public.exercise_column_preferences'::regclass
  ) then
    alter table public.exercise_column_preferences
      add constraint exercise_column_preferences_weight_mode_known
      check (weight_mode in ('total', 'per_side'))
      not valid;
  end if;
end;
$$;

commit;

-- The checks were added `not valid`, so adding them held the table's lock
-- only for a moment rather than for a scan of every row. Validating takes a
-- lock that lets reads and writes go on. Every row is null here, which
-- passes; run again, it is a no-op.
alter table public.exercise_instance
  validate constraint exercise_instance_weight_mode_known;

alter table public.exercise_column_preferences
  validate constraint exercise_column_preferences_weight_mode_known;

notify pgrst, 'reload schema';

-- Check afterwards. Both should name the column, and the second should be 0
-- until a phone on 2.16 has switched an exercise:
--
--   select table_name, column_name
--   from information_schema.columns
--   where table_schema = 'public'
--     and column_name = 'weight_mode'
--     and table_name in ('exercise_instance', 'exercise_column_preferences');
--
--   select count(*) from public.exercise_instance where weight_mode = 'per_side';
