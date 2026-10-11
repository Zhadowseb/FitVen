export const stepsSchemaSql = `

  -- One row for each day: the number of steps FitVen shows for it, and which
  -- source it came from (Utils/dailyStepLog.js: "health", "motion" or
  -- "sensor", best first). Only the day's steps - the phone's own count, read
  -- from its health app or its motion sensor - never the training added on top
  -- of it, which is computed. The history the health apps keep is longer than
  -- what can be read back later, so a day is kept here once it has been seen.
  -- It follows the person to the cloud (public.daily_steps) and back.
  CREATE TABLE IF NOT EXISTS Daily_Steps (
    day TEXT PRIMARY KEY NOT NULL,
    steps INTEGER NOT NULL,
    source TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    needs_sync INTEGER NOT NULL DEFAULT 1
  );

  -- What FitVen's own step sensor has counted for each day, added up as the
  -- readings come in (Services/stepSensorService.js). The steps keep their
  -- fractions, so adding many small intervals loses nothing; they become the
  -- day's whole number in Daily_Steps. Stays on the phone: it is the working
  -- of one source, not the day's number.
  CREATE TABLE IF NOT EXISTS Sensor_Steps (
    day TEXT PRIMARY KEY NOT NULL,
    steps REAL NOT NULL
  );

  -- The watch walks (exercise sessions of Health Connect) that have been made
  -- into walks, one row each (Services/watchWalkService.js). It is how a session
  -- is never imported twice - also when the walk was deleted afterwards, which
  -- is why the row stays - and how a walk finds its session again to load the
  -- route. Times in ms. On the phone only.
  CREATE TABLE IF NOT EXISTS Imported_Health_Walk (
    hc_id TEXT PRIMARY KEY NOT NULL,
    workout_id INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    origin TEXT,
    imported_at INTEGER NOT NULL,
    route_loaded INTEGER NOT NULL DEFAULT 0
  );
`;
