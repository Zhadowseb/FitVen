// Queries behind the Train tab's library tiles and tools: counts, weeks and
// bests read straight from the local database.

// A stored day in its ISO form. Day.date holds both "01.08.2026" and
// "2026-08-01", and everything here sorts, groups and compares on it.
function isoDaySql(dateExpression) {
  return `CASE
    WHEN ${dateExpression} LIKE '__.__.____'
    THEN substr(${dateExpression}, 7, 4) || '-' ||
         substr(${dateExpression}, 4, 2) || '-' ||
         substr(${dateExpression}, 1, 2)
    ELSE ${dateExpression}
  END`;
}

/**
 * How many personal records were set on each day there is one, oldest first.
 *
 * The same sets as weightliftingRepository.getCompletedStrengthSetsForPersonalRecords
 * - done, not failed, with a weight and reps, not a warm-up, nothing deleted -
 * so the total is the trophy room's record count, counted by SQLite rather
 * than by reading every set there has ever been.
 */
export async function getPersonalRecordCountsByDay(db) {
  return db.getAllAsync(
    `SELECT
        ${isoDaySql("d.date")} AS performed_date_sort,
        COUNT(*) AS record_count
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE COALESCE(s.personal_record, 0) = 1
       AND s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND COALESCE(s.set_type, 'working') <> 'warmup'
       AND TRIM(e.exercise_name) <> ''
     GROUP BY performed_date_sort
     ORDER BY performed_date_sort ASC;`
  );
}

/**
 * Every week of every program, with what Utils/trainLibrary needs to call it
 * done: how many days and workouts it holds, its last day, and how many of
 * the workouts are complete.
 *
 * Complete means what it means on every progress bar in the app
 * (completedWorkoutForProgressSql in programRepository): finished, or on a
 * sick day that has passed - sickness is an absence, not a week left open.
 * `todayIso` is the phone's calendar day, "yyyy-mm-dd".
 */
export async function getProgramMicrocycleProgress(db, { todayIso }) {
  const dayIso = isoDaySql("d.date");

  return db.getAllAsync(
    `SELECT
        m.program_id,
        mc.microcycle_id,
        COUNT(DISTINCT d.day_id) AS day_count,
        MAX(${dayIso}) AS last_day_sort,
        COUNT(w.workout_id) AS workout_count,
        COALESCE(SUM(CASE
          WHEN w.workout_id IS NULL THEN 0
          WHEN COALESCE(w.done, 0) = 1 THEN 1
          WHEN COALESCE(d.is_sick, 0) = 1 AND date(${dayIso}) < date(?) THEN 1
          ELSE 0
        END), 0) AS completed_count
     FROM Mesocycle m
     JOIN Microcycle mc
       ON mc.mesocycle_id = m.mesocycle_id
      AND COALESCE(mc.deleted_at, '') = ''
     LEFT JOIN Day d
       ON d.microcycle_id = mc.microcycle_id
      AND COALESCE(d.deleted_at, '') = ''
     LEFT JOIN Workout_Type_Instance w
       ON w.day_id = d.day_id
      AND COALESCE(w.deleted_at, '') = ''
     WHERE COALESCE(m.deleted_at, '') = ''
     GROUP BY m.program_id, mc.microcycle_id
     ORDER BY m.program_id ASC, mc.microcycle_id ASC;`,
    [todayIso]
  );
}
