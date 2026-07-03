export async function getLocationLogsByWorkout(db, workoutId) {
  return db.getAllAsync(
    `SELECT *
     FROM LocationLog
     WHERE workout_id = ?
     ORDER BY timestamp ASC, id ASC;`,
    [workoutId]
  );
}

export async function createLocationLog(
  db,
  { workoutId, latitude, longitude, accuracy, timestamp }
) {
  await db.runAsync(
    `INSERT INTO LocationLog (
      workout_id,
      latitude,
      longitude,
      accuracy,
      timestamp
    ) VALUES (?, ?, ?, ?, ?);`,
    [workoutId, latitude, longitude, accuracy, timestamp]
  );
}

export async function getLatestLocationLogByWorkout(db, workoutId) {
  return db.getFirstAsync(
    `SELECT *
     FROM LocationLog
     WHERE workout_id = ?
     ORDER BY timestamp DESC, id DESC
     LIMIT 1;`,
    [workoutId]
  );
}

export async function createLocationTrackingBreak(
  db,
  { workoutId, timestamp = Date.now() }
) {
  // Null coordinates separate independently tracked start/resume sessions.
  await createLocationLog(db, {
    workoutId,
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp,
  });
}

export async function deleteLocationLogsByWorkout(db, workoutId) {
  await db.runAsync(
    `DELETE FROM LocationLog
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function deleteLocationDebugLogsByWorkout(db, workoutId) {
  await db.runAsync(
    `DELETE FROM LocationDebugLog
     WHERE workout_id = ?;`,
    [workoutId]
  );
}
