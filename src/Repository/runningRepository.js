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

// A day's date as "YYYY-MM-DD": a Day row holds it in either that or "DD.MM.YYYY".
const DAY_ISO_SQL = `CASE
  WHEN d.date LIKE '__.__.____'
  THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
  ELSE d.date
END`;

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
  // A walk's route is a place somebody went, and goes with the walk.
  await db.runAsync(
    `DELETE FROM LocationLog
     WHERE workout_id = ?;`,
    [workoutId]
  );
  await db.runAsync(
    `DELETE FROM Run
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

/**
 * The one row a walk keeps what it covered in: a working segment that is not a
 * pause. A walk recorded by the old Run flow may have more rows, and this is
 * the first of them.
 */
export async function getWalkSegment(db, workoutId) {
  return db.getFirstAsync(
    `SELECT *
     FROM Run
     WHERE workout_id = ?
       AND COALESCE(is_pause, 0) = 0
       AND ${NORMALIZED_RUN_TYPE_SQL} = 'WORKING_SET'
     ORDER BY set_number ASC, Run_id ASC
     LIMIT 1;`,
    [workoutId]
  );
}

/** What every finished segment of the workout added up to. */
export async function getWalkTotals(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        COALESCE(SUM(actual_distance), 0) AS distance_km,
        COALESCE(SUM(actual_duration_seconds), 0) AS duration_seconds,
        SUM(actual_steps) AS steps,
        COUNT(*) AS segments
     FROM Run
     WHERE workout_id = ?
       AND COALESCE(is_pause, 0) = 0
       AND done = 1;`,
    [workoutId]
  );
}

/**
 * Writes what the walk has covered into its segment, making the segment when
 * there is none. `done` is only ever raised here by finishing the walk.
 */
export async function saveWalkSegment(
  db,
  {
    workoutId,
    distanceKm,
    durationSeconds,
    paceMinutes,
    steps,
    done = false,
  }
) {
  const existing = await getWalkSegment(db, workoutId);

  if (!existing) {
    await db.runAsync(
      `INSERT INTO Run (
        workout_id,
        type,
        set_number,
        is_pause,
        actual_distance,
        actual_duration_seconds,
        actual_pace,
        actual_steps,
        done
      ) VALUES (?, 'WORKING_SET', 1, 0, ?, ?, ?, ?, ?);`,
      [
        workoutId,
        distanceKm ?? null,
        durationSeconds ?? null,
        paceMinutes ?? null,
        steps ?? null,
        done ? 1 : 0,
      ]
    );
    return;
  }

  await db.runAsync(
    `UPDATE Run
     SET actual_distance = ?,
         actual_duration_seconds = ?,
         actual_pace = ?,
         actual_steps = ?,
         done = CASE WHEN ? = 1 THEN 1 ELSE done END
     WHERE Run_id = ?;`,
    [
      distanceKm ?? null,
      durationSeconds ?? null,
      paceMinutes ?? null,
      steps ?? null,
      done ? 1 : 0,
      existing.Run_id,
    ]
  );
}

/**
 * What the finished walks of each day covered, for the Steps page: steps and
 * kilometres per day ("YYYY-MM-DD"), between two days inclusive.
 */
export async function getWalkTotalsByDay(db, { fromIso, toIso }) {
  return db.getAllAsync(
    `SELECT
        ${DAY_ISO_SQL} AS date,
        COALESCE(SUM(r.actual_steps), 0) AS steps,
        COALESCE(SUM(r.actual_distance), 0) AS distance_km
     FROM Run r
     JOIN Workout_Type_Instance w ON w.workout_id = r.workout_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE w.workout_type = 'Walk'
       AND w.done = 1
       AND r.done = 1
       AND COALESCE(r.is_pause, 0) = 0
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND ${DAY_ISO_SQL} BETWEEN ? AND ?
     GROUP BY ${DAY_ISO_SQL}
     ORDER BY ${DAY_ISO_SQL} ASC;`,
    [fromIso, toIso]
  );
}

/** A restart: the segment goes back to nothing covered, and open again. */
export async function resetWalkSegments(db, workoutId) {
  await db.runAsync(
    `UPDATE Run
     SET actual_distance = NULL,
         actual_duration_seconds = NULL,
         actual_pace = NULL,
         actual_steps = NULL,
         done = 0
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
