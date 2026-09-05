export const locationSchemaSql = `

  -- Held every GPS point the tracker saw, accepted or rejected, with speed and
  -- accuracy, and nothing ever deleted them. A run starts and ends at home, so
  -- that is a home address sitting unencrypted on the device forever. Dropped
  -- on every launch, so existing installs lose what they already stored.
  DROP TABLE IF EXISTS LocationDebugLog;

  CREATE TABLE IF NOT EXISTS LocationLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    timestamp INTEGER
  );

  CREATE INDEX IF NOT EXISTS location_log_workout_timestamp_idx
  ON LocationLog(workout_id, timestamp);
`;
