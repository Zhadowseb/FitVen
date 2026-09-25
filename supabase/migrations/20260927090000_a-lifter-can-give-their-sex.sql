-- A lifter can give their sex.
--
-- Run after 20260925110000_a-post-knows-its-centre.sql.
--
-- Records and leaderboards are one list today. Powerlifting and weightlifting
-- rank men and women apart, and the centre and national rankings are meant to
-- be able to do the same later. Nothing is split yet, and what exactly the
-- answer will be used for is not decided - but a split needs the answer on
-- file before it can be made, so Edit profile asks now: male, female, or not
-- given. Null is "not given"; it is the default, and what everybody who never
-- answers stays.
--
-- It is private. The column sits in profile_private beside the birth year and
-- under the four owner-only policies that table already has
-- (20260628211540_profile-birthdate.sql): a user can read and write their own
-- row and nobody else's. The table's grants cover a new column as they are, so
-- nothing here changes who can see what. It is never on the public profile,
-- and no function that answers for other people reads it. A ranking split by
-- sex will need a security definer function that uses the value without
-- handing it out - a decision for then, not for this file.
--
-- Until this has run, the app asks for the column, is told it does not exist,
-- and carries on without it: the profile loads and saves as before, and Edit
-- profile does not offer the field. Safe to run twice.

begin;

alter table public.profile_private
  add column if not exists sex text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'profile_private_sex_known'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_sex_known
      check (sex is null or sex in ('male', 'female'));
  end if;
end;
$$;

comment on column public.profile_private.sex is
  'male, female, or null for not given. Private: only its owner can read it, under the policies on this table, and it is never on the public profile. Kept so records and leaderboards can be split by sex later.';

commit;

notify pgrst, 'reload schema';

-- Check afterwards. The first should list the column; the second should be 0.
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profile_private'
--     and column_name = 'sex';
--
--   select count(*) from public.profile_private
--   where sex is not null and sex not in ('male', 'female');
