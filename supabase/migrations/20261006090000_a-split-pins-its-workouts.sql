-- A session in somebody's split can be one particular workout.
--
-- Run after 20260926090000_your-split-follows-you.sql.
--
-- Until now a split was only names, and each session repeated the latest
-- workout of its name. That cannot hold two sessions that are both "Push" -
-- the same exercises, at a different intensity on different days - and a
-- workout picked in the calendar repeated whatever "Push" was done last, not
-- the one picked. The earlier migration kept names because a workout id is
-- local to one phone; a workout's sync_id is not, it is the identity the
-- workout has on every phone.
--
-- split_entries is one object per session, in order:
--
--   { "name": "Push", "workout": "<sync_id>" | null, "last": "<sync_id>" | null }
--
-- `workout` is the pinned workout, the one repeated; null is a session by
-- name, as before. `last` is the copy made the last time that pinned session
-- was started, which is how two sessions of one name are told apart.
--
-- split_names stays, and the app keeps writing it beside the entries: a build
-- from before this reads and writes only the names, and the app lays its pins
-- back onto them when the two disagree. Names may repeat; nothing here ever
-- said they could not.
--
-- Until this has run, the app sends the names alone and keeps the pins on the
-- phone. Safe to run twice.

begin;

alter table public.profile_private
  add column if not exists split_entries jsonb;

alter table public.profile_private
  drop constraint if exists profile_private_split_entries_shape;

-- A case rather than an and: jsonb_array_length raises on anything that is
-- not an array, and Postgres does not promise to test the type first.
alter table public.profile_private
  add constraint profile_private_split_entries_shape
  check (
    split_entries is null
    or case
      when jsonb_typeof(split_entries) = 'array'
        then jsonb_array_length(split_entries) between 2 and 6
      else false
    end
  );

commit;
