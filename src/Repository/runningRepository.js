const NORMALIZED_RUN_TYPE_SQL = `
  CASE
    WHEN type IS NULL THEN 'WORKING_SET'
    WHEN UPPER(REPLACE(REPLACE(TRIM(type), '-', '_'), ' ', '_')) IN ('WARMUP', 'WARM_UP')
      THEN 'WARMUP'
    WHEN UPPER(REPLACE(REPLACE(TRIM(type), '-', '_'), ' ', '_')) IN ('COOLDOWN', 'COOL_DOWN')
      THEN 'COOLDOWN'
    ELSE 'WORKING_SET'
  END
`;

export async function getRunSets(db, { workoutId, type }) {
  return db.getAllAsync(
    `SELECT *
     FROM Run
     WHERE workout_id = ?
       AND ${NORMALIZED_RUN_TYPE_SQL} = ?
     ORDER BY set_number ASC, is_pause DESC, Run_id ASC;`,
    [workoutId, type]
  );
}

export async function getOrderedRunSetsForWorkout(db, workoutId) {
  return db.getAllAsync(
    `SELECT *
     FROM Run
     WHERE workout_id = ?
     ORDER BY
       CASE ${NORMALIZED_RUN_TYPE_SQL}
         WHEN 'WARMUP' THEN 1
         WHEN 'WORKING_SET' THEN 2
         WHEN 'COOLDOWN' THEN 3
       END,
       set_number ASC,
       is_pause DESC,
       Run_id ASC;`,
    [workoutId]
  );
}

export async function countActiveRunSets(db, { workoutId, type }) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM Run
     WHERE workout_id = ?
       AND ${NORMALIZED_RUN_TYPE_SQL} = ?
       AND is_pause = 0;`,
    [workoutId, type]
  );
}

export async function createRunSet(
  db,
  {
    workoutId,
    type,
    setNumber,
    isPause = 0,
    distance = null,
    pace = null,
    time = null,
    heartrate = null,
    statPriority = null,
    done = 0,
  }
) {
  return db.runAsync(
    `INSERT INTO Run (
      workout_id,
      type,
      set_number,
      is_pause,
      distance,
      pace,
      time,
      heartrate,
      stat_priority,
      done
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      workoutId,
      type,
      setNumber,
      isPause,
      distance,
      pace,
      time,
      heartrate,
      statPriority,
      done,
    ]
  );
}

export async function updateRunSetField(db, { runId, field, value }) {
  await db.runAsync(
    `UPDATE Run
     SET ${field} = ?
     WHERE Run_id = ?;`,
    [value, runId]
  );
}

export async function updateRunSetDone(db, { runId, done }) {
  await db.runAsync(
    `UPDATE Run
     SET done = ?
     WHERE Run_id = ?;`,
    [done ? 1 : 0, runId]
  );
}

export async function completeRunSet(
  db,
  { runId, actualDistanceKm, actualDurationSeconds, actualPaceMinutes }
) {
  await db.runAsync(
    `UPDATE Run
     SET done = 1,
         actual_distance = ?,
         actual_duration_seconds = ?,
         actual_pace = ?
     WHERE Run_id = ?;`,
    [
      actualDistanceKm ?? null,
      actualDurationSeconds ?? null,
      actualPaceMinutes ?? null,
      runId,
    ]
  );
}

export async function resetRunSetProgress(db, workoutId) {
  await db.runAsync(
    `UPDATE Run
     SET done = 0,
         actual_distance = NULL,
         actual_duration_seconds = NULL,
         actual_pace = NULL
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function deleteRunSetById(db, runId) {
  await db.runAsync(
    `DELETE FROM Run
     WHERE Run_id = ?;`,
    [runId]
  );
}

export async function updateRunSetNumber(db, { runId, setNumber }) {
  await db.runAsync(
    `UPDATE Run
     SET set_number = ?
     WHERE Run_id = ?;`,
    [setNumber, runId]
  );
}

export async function updateRunSetPause(db, { runId, isPause }) {
  await db.runAsync(
    `UPDATE Run
     SET is_pause = ?
     WHERE Run_id = ?;`,
    [isPause ? 1 : 0, runId]
  );
}

export async function deleteRunSetsByWorkout(db, workoutId) {
  await db.runAsync(
    `DELETE FROM Run
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

/**
 * The finished segments of every finished run or walk - what was actually
 * covered, not what was planned - with the workout's type and day. Pauses
 * carry no distance and are left out.
 */
export async function getCompletedRunSegmentsForStatistics(db) {
  return db.getAllAsync(
    `SELECT
        r.workout_id,
        r.type,
        r.actual_distance,
        r.actual_duration_seconds,
        w.workout_type,
        d.date AS performed_date,
        CASE
          WHEN d.date LIKE '__.__.____'
          THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
          ELSE d.date
        END AS performed_date_sort
     FROM Run r
     JOIN Workout_Type_Instance w ON w.workout_id = r.workout_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE r.done = 1
       AND COALESCE(r.is_pause, 0) = 0
       AND w.done = 1
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
     ORDER BY performed_date_sort ASC, r.workout_id ASC, r.set_number ASC;`
  );
}
