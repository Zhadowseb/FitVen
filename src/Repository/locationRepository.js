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

export async function replaceLocationDebugLogsByWorkout(
  db,
  workoutId,
  diagnostics
) {
  await deleteLocationDebugLogsByWorkout(db, workoutId);
  const createdAt = Date.now();
  const statement = await db.prepareAsync(
    `INSERT INTO LocationDebugLog (
      workout_id,
      latitude,
      longitude,
      accuracy,
      timestamp,
      accepted,
      rejection_reason,
      distance_meters,
      time_diff_seconds,
      speed_meters_per_second,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
  );

  try {
    for (const diagnostic of Array.isArray(diagnostics) ? diagnostics : []) {
      await statement.executeAsync([
          workoutId,
          diagnostic.latitude,
          diagnostic.longitude,
          diagnostic.accuracy,
          diagnostic.timestamp,
          diagnostic.accepted ? 1 : 0,
          diagnostic.rejectionReason,
          diagnostic.distanceMeters,
          diagnostic.timeDiffSeconds,
          diagnostic.speedMetersPerSecond,
          createdAt,
        ]);
    }
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getLocationDebugLogsByWorkout(db, workoutId) {
  return db.getAllAsync(
    `SELECT *
     FROM LocationDebugLog
     WHERE workout_id = ?
     ORDER BY timestamp ASC, id ASC;`,
    [workoutId]
  );
}

export async function getLocationDebugSummaryByWorkout(db, workoutId) {
  return db.getAllAsync(
    `SELECT
       rejection_reason,
       accepted,
       COUNT(*) AS point_count,
       AVG(accuracy) AS average_accuracy,
       MAX(time_diff_seconds) AS max_gap_seconds
     FROM LocationDebugLog
     WHERE workout_id = ?
     GROUP BY rejection_reason, accepted
     ORDER BY point_count DESC;`,
    [workoutId]
  );
}
