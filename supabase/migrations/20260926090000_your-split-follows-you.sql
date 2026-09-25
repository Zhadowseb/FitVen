-- The split somebody chose on the Train tab follows them to a new phone.
--
-- Run after 20260925110000_a-post-knows-its-centre.sql.
--
-- A split is the two to six sessions somebody rotates through without a
-- program - "Push", "Pull", "Legs". It is kept as the names, not as workout
-- ids: a workout id is local to one phone, and the card finds each session's
-- latest workout by its name anyway (the way Home's split guess does). Null
-- is "no split chosen", and the card goes back to the guess.
--
-- It sits on profile_private, beside the home centre and the heart-rate
-- settings, under the policies that already let only its owner read and write
-- the row.
--
-- Until this has run, a chosen split is kept on the phone only and the app
-- says nothing about it. Safe to run twice.

begin;

alter table public.profile_private
  add column if not exists split_names text[];

alter table public.profile_private
  drop constraint if exists profile_private_split_names_shape;

alter table public.profile_private
  add constraint profile_private_split_names_shape
  check (split_names is null or cardinality(split_names) between 2 and 6);

commit;
