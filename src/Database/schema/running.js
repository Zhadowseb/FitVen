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

      done INTEGER NOT NULL DEFAULT 0
  );
`;
