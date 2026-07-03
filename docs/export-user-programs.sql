-- Read-only export of all non-deleted program data for one Supabase user.
-- Run in the Supabase SQL editor and copy/download the single JSON result.

with constants as (
  select '3a91c5d3-0257-4c89-bf00-f4c223b768cc'::uuid as user_id
),
program_scope as (
  select p.*
  from public."Program" p
  join constants c on c.user_id = p.user_id
  where p.deleted_at is null
),
mesocycle_scope as (
  select m.*
  from public."Mesocycle" m
  join program_scope p on p.id = m.cloud_program_id
  where m.deleted_at is null
),
microcycle_scope as (
  select mc.*
  from public."Microcycle" mc
  join mesocycle_scope m on m.id = mc.cloud_mesocycle_id
  where mc.deleted_at is null
),
day_scope as (
  select d.*
  from public."Day" d
  join microcycle_scope mc on mc.id = d.cloud_microcycle_id
  where d.deleted_at is null
),
workout_scope as (
  select w.*
  from public.workout_type_instance w
  join day_scope d on d.id = w.cloud_day_id
  where w.deleted_at is null
),
exercise_scope as (
  select e.*
  from public.exercise_instance e
  join workout_scope w on w.id = e.cloud_workout_type_instance_id
  where e.deleted_at is null
),
set_scope as (
  select s.*
  from public."set" s
  join exercise_scope e on e.id = s.cloud_exercise_instance_id
  where s.deleted_at is null
)
select jsonb_pretty(
  jsonb_build_object(
    'export_type', 'fitapp_user_programs',
    'export_version', 1,
    'exported_at', now(),
    'user_id', (select user_id from constants),
    'counts', jsonb_build_object(
      'programs', (select count(*) from program_scope),
      'mesocycles', (select count(*) from mesocycle_scope),
      'microcycles', (select count(*) from microcycle_scope),
      'days', (select count(*) from day_scope),
      'workouts', (select count(*) from workout_scope),
      'exercises', (select count(*) from exercise_scope),
      'sets', (select count(*) from set_scope)
    ),
    'tables', jsonb_build_object(
      'Program', (
        select coalesce(
          jsonb_agg(to_jsonb(p) order by p.start_date, p.id),
          '[]'::jsonb
        )
        from program_scope p
      ),
      'Mesocycle', (
        select coalesce(
          jsonb_agg(to_jsonb(m) order by m.cloud_program_id, m.mesocycle_number, m.id),
          '[]'::jsonb
        )
        from mesocycle_scope m
      ),
      'Microcycle', (
        select coalesce(
          jsonb_agg(to_jsonb(mc) order by mc.cloud_mesocycle_id, mc.microcycle_number, mc.id),
          '[]'::jsonb
        )
        from microcycle_scope mc
      ),
      'Day', (
        select coalesce(
          jsonb_agg(to_jsonb(d) order by d.cloud_microcycle_id, d.date, d.id),
          '[]'::jsonb
        )
        from day_scope d
      ),
      'workout_type_instance', (
        select coalesce(
          jsonb_agg(to_jsonb(w) order by w.cloud_day_id, w.date, w.id),
          '[]'::jsonb
        )
        from workout_scope w
      ),
      'exercise_instance', (
        select coalesce(
          jsonb_agg(to_jsonb(e) order by e.cloud_workout_type_instance_id, e.exercise_order, e.id),
          '[]'::jsonb
        )
        from exercise_scope e
      ),
      'set', (
        select coalesce(
          jsonb_agg(to_jsonb(s) order by s.cloud_exercise_instance_id, s.set_number, s.id),
          '[]'::jsonb
        )
        from set_scope s
      )
    )
  )
) as program_export_json;
