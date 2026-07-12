export const runningSchemaSql = `

  CREATE TABLE IF NOT EXISTS Run (
      Run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      type TEXT
        DEFAULT 'WORKING_SET'
        NOT NULL
        CHECK (type IN ('WARMUP', 'WORKING_SET', 'COOLDOWN')),

      set_number INTEGER NOT NULL,
      is_pause INTEGER NOT NULL DEFAULT 0,
      distance INTEGER,
      pace TEXT,
      time INTEGER,
      heartrate INTEGER,
      stat_priority TEXT,
      completion_target TEXT,

      actual_distance REAL,
      actual_duration_seconds INTEGER,
      actual_pace REAL,

      done INTEGER NOT NULL DEFAULT 0
  );
`;
