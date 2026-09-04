export const locationSchemaSql = `

  CREATE TABLE IF NOT EXISTS LocationLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS LocationDebugLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    timestamp INTEGER,
    accepted INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    distance_meters REAL,
    time_diff_seconds REAL,
    speed_meters_per_second REAL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS location_log_workout_timestamp_idx
  ON LocationLog(workout_id, timestamp);

  CREATE INDEX IF NOT EXISTS location_debug_log_workout_timestamp_idx
  ON LocationDebugLog(workout_id, timestamp);
`;
