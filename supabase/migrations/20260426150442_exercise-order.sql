-- Adds persisted ordering for strength workout exercises.
-- Run this against the Supabase project before shipping clients that select
-- exercise_order from public.exercise_instance.

ALTER TABLE public.exercise_instance
  ADD COLUMN IF NOT EXISTS exercise_order integer NOT NULL DEFAULT 0;

WITH ordered_exercises AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, cloud_workout_type_instance_id
      ORDER BY
        CASE
          WHEN COALESCE(exercise_order, 0) > 0 THEN exercise_order
          ELSE id
        END ASC,
        id ASC
    ) AS next_exercise_order
  FROM public.exercise_instance
  WHERE deleted_at IS NULL
)
UPDATE public.exercise_instance AS exercise_instance
SET exercise_order = ordered_exercises.next_exercise_order
FROM ordered_exercises
WHERE exercise_instance.id = ordered_exercises.id
  AND exercise_instance.exercise_order <> ordered_exercises.next_exercise_order;
