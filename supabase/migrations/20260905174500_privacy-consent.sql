-- GDPR art. 13 and art. 9: recorded consent.
--
-- Run after 20260424004053_social-search.sql.
--
-- The app stores training data, a birth year, and — through workouts, sickness
-- entries and heart rate — health data, which art. 9 treats as a special
-- category. Consent for that has to be given, and has to be provable
-- afterwards, which means storing which version of the policy was agreed to and
-- when. A boolean would not survive the first time the policy text changes.

alter table public.profile_private
  add column if not exists privacy_policy_version text;

alter table public.profile_private
  add column if not exists privacy_policy_accepted_at timestamptz;

comment on column public.profile_private.privacy_policy_version is
  'The PRIVACY_POLICY_VERSION the user agreed to. Null means never asked, which the app treats as consent outstanding.';

notify pgrst, 'reload schema';
