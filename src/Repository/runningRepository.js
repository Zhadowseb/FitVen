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
