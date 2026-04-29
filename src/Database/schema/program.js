export const programSchemaSql = `

  CREATE TABLE IF NOT EXISTS App_Metadata (
    metadata_key TEXT PRIMARY KEY,
    metadata_value TEXT
  );

  CREATE TABLE IF NOT EXISTS Program (
    program_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_program_id INTEGER,
    remote_local_program_id INTEGER,
    sync_id TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    program_name TEXT,
    start_date TEXT NOT NULL,
    status TEXT
      DEFAULT 'NOT_STARTED'
      NOT NULL
      CHECK (status IN ('COMPLETE', 'ACTIVE', 'NOT_STARTED')),
    needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Program_Sync_Delete (
    program_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_program_id INTEGER UNIQUE,
    sync_id TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS Program_Best_Exercise (
    program_best_exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    is_selected INTEGER NOT NULL DEFAULT 1,

    UNIQUE(program_id, exercise_name)
  );

  CREATE TABLE IF NOT EXISTS Mesocycle(
      mesocycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_mesocycle_id INTEGER,
      remote_local_mesocycle_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      program_id INTEGER NOT NULL,
      mesocycle_number INTEGER NOT NULL,
      weeks INTEGER NOT NULL DEFAULT 0,
      focus TEXT DEFAULT "No focus set",
      done INTEGER NOT NULL DEFAULT 0,
      needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Mesocycle_Sync_Delete (
    mesocycle_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_mesocycle_id INTEGER UNIQUE,
    sync_id TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS Microcycle(
      microcycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_microcycle_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      mesocycle_id INTEGER NOT NULL,
      microcycle_number INTEGER NOT NULL,
      focus TEXT DEFAULT "No focus",
      done INTEGER NOT NULL DEFAULT 0,
      needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Microcycle_Sync_Delete (
    microcycle_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_microcycle_id INTEGER UNIQUE,
    sync_id TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS Day (
      day_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_day_id INTEGER,
      remote_local_day_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      microcycle_id INTEGER NOT NULL,
      program_id INTEGER NOT NULL,
      Weekday TEXT NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Workout_Type (
      workout_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS Workout_Type_Instance (
      workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_workout_type_instance_id INTEGER,
      remote_local_workout_type_instance_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      day_id INTEGER NOT NULL,
      workout_type TEXT,
      date TEXT NOT NULL,
      label TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      needs_sync INTEGER NOT NULL DEFAULT 1,

      /*======Workout Timer=======*/
      is_active INTEGER DEFAULT 0,
      original_start_time INTEGER,
      timer_start INTEGER,
      elapsed_time INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS Workout_Type_Instance_Sync_Delete (
    workout_type_instance_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_workout_type_instance_id INTEGER UNIQUE,
    remote_local_workout_type_instance_id INTEGER UNIQUE,
    sync_id TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );
`;
