-- A workout's start coordinates leave the cloud.
--
-- Run after 20260917120000_gyms-and-lift-verification.sql.
--
-- That migration put start_latitude and start_longitude on
-- workout_type_instance without touching the table's row-level security, and
-- row-level security is row-based: the policy "Followed workout activity is
-- viewable" from 20260515150145_side-by-side-sync-migration.sql lets anyone
-- who follows you select your whole row for yesterday, today and tomorrow.
-- The two new columns went with it.
--
-- Following is a plain insert with no approval, so anyone could follow anyone
-- and then read `select=start_latitude,start_longitude,date` straight over
-- REST. The coordinates are rounded to six decimals - about ten centimetres.
-- For somebody who starts the timer at home, that is their address.
--
-- The app never showed them. They existed so that a workout which could not
-- reach a centre at the time could be matched later, and that retry reads the
-- device's own SQLite, where the columns stay. The only thing lost is
-- retrying a match for a workout whose device has since been reinstalled.
--
-- Dropping beats locking down. A column nothing reads is a column with
-- somebody's address in it waiting for the next policy change.

begin;

alter table public.workout_type_instance
  drop column if exists start_latitude;

alter table public.workout_type_instance
  drop column if exists start_longitude;

commit;
