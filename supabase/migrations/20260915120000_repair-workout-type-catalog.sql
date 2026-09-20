-- Repair installations that ran the catalog migration before all built-in
-- types were seeded. Keep existing names, visibility and access policies.
-- Inactive legacy types still need to exist: older local workouts can sync.
begin;

insert into public.workout_type (type, display_name, is_active)
values
  ('Resistance', 'Resistance', true),
  ('Run', 'Run', true),
  ('Walk', 'Walk', true),
  ('Upperbody', 'Upperbody', false),
  ('Legs', 'Legs', false),
  ('StrengthTraining', 'StrengthTraining', false)
on conflict (type) do nothing;

commit;
