-- Read-only export af hele øvelseskataloget.
-- Kør i Supabase SQL editor og tryk "Download CSV" på resultatet.
--
-- Én række pr. øvelse i public."Exercise". Muskler slås op via
-- public."Muscle_Activation" -> public."Muscle", og muskelgrupper derfra via
-- public.muscle_group_assignment -> public.muscle_group, altså samme kæde som
-- appen selv bruger.

select
  e.id                        as exercise_id,
  e.name                      as name,
  e.nickname                  as nickname,
  e.official                  as official,

  (select string_agg(m.name, ', ' order by m.name)
     from public."Muscle_Activation" ma
     join public."Muscle" m on m.id = ma.muscle_id
    where ma.exercise_id = e.id
      and lower(btrim(coalesce(ma.activation_level, ''))) = 'primary'
  ) as primary_muscles,

  (select string_agg(m.name, ', ' order by m.name)
     from public."Muscle_Activation" ma
     join public."Muscle" m on m.id = ma.muscle_id
    where ma.exercise_id = e.id
      and lower(btrim(coalesce(ma.activation_level, ''))) = 'secondary'
  ) as secondary_muscles,

  (select string_agg(g.name, ', ' order by g.name)
     from (select distinct mg.name
             from public."Muscle_Activation" ma
             join public.muscle_group_assignment mga on mga.muscle_id = ma.muscle_id
             join public.muscle_group mg on mg.id = mga.muscle_group_id
            where ma.exercise_id = e.id
              and mg.is_active
              and lower(btrim(coalesce(ma.activation_level, ''))) = 'primary'
          ) g
  ) as primary_muscle_groups,

  (select count(*)
     from public."Muscle_Activation" ma
    where ma.exercise_id = e.id
  ) as muscle_activation_count,

  e.default_visible_columns::text as default_visible_columns

from public."Exercise" e
order by e.name, e.id;
