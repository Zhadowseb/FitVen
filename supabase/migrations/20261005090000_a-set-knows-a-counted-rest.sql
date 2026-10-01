-- A set knows whether its rest was planned or counted.
--
-- Run after 20261004090000_progress-counts-every-exercise.sql.
--
-- A set ticked off without a rest written now has the rest after it counted up
-- by the app, from the tick to the next set (src/Utils/restCountUp.js). That
-- time is kept in the set's ordinary `pause`, and `rest_counted` says it was
-- counted: a record of the rest that was taken, not a rest to count down. The
-- difference decides what a new set inherits - the next set, a copied workout,
-- the exercise's first set next week - and whether ticking the set off again
-- counts down or up. Without it on the cloud side, a counted rest would come
-- back as a planned one on the next phone.
--
-- Null means "not known": every row from before this, and every row an older
-- app creates. The app treats a null as "keep what the phone has", and always
-- sends true or false itself, so a phone that does not know the column never
-- erases the flag another phone wrote.
--
-- The app reaches the cloud before or after this, either way: until it has
-- run, a phone on this version finds the column missing (42703 on a read,
-- PGRST204 on a write), syncs sets without it for the rest of that session,
-- and keeps the flag on the phone. Nothing else stops syncing; a counted rest
-- travels as a plain rest meanwhile. After it has run, the next start of the
-- app sends and reads it.
--
-- Idempotent: `add column if not exists`. A nullable column with no default,
-- so no row is rewritten. One statement in a transaction with a lock timeout,
-- the lesson of 20260921180000_music-opt-in.sql: a busy moment makes it give
-- up rather than queue behind a live session; run it again.

begin;

set local lock_timeout = '5s';

alter table public."set"
  add column if not exists rest_counted boolean;

commit;

notify pgrst, 'reload schema';

-- Check afterwards. The first should name the column; the second is 0 until a
-- phone on this version has counted a rest:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'set' and column_name = 'rest_counted';
--
--   select count(*) from public."set" where rest_counted;
