export const weightliftingSchemaSql = `

  CREATE TABLE IF NOT EXISTS Exercise (
      exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      nickname TEXT
  );

  CREATE TABLE IF NOT EXISTS Exercise_Instance (
      exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id INTEGER,
      last_updated INTEGER NOT NULL DEFAULT 0,
      cloud_exercise_instance_id INTEGER,
      remote_local_exercise_instance_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      workout_type_instance_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      exercise_order INTEGER NOT NULL DEFAULT 0,
      sets INTEGER NOT NULL DEFAULT 0,
      visible_columns TEXT,
      note TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Exercise_Instance_Sync_Delete (
      exercise_instance_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_exercise_instance_id INTEGER UNIQUE,
      remote_local_exercise_instance_id INTEGER UNIQUE,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS "Set" (
      sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id INTEGER,
      last_updated INTEGER NOT NULL DEFAULT 0,
      cloud_set_id INTEGER,
      remote_local_set_id INTEGER,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      set_number INTEGER NOT NULL,
      exercise_instance_id INTEGER NOT NULL,

      personal_record INTEGER NOT NULL DEFAULT 0,

      pause INTEGER,
      rpe INTEGER,
      weight INTEGER,
      rm_percentage INTEGER,
      reps INTEGER,

      done INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      amrap INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      needs_sync INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS Set_Sync_Delete (
      set_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_set_id INTEGER UNIQUE,
      remote_local_set_id INTEGER UNIQUE,
      sync_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS Estimated_Set (
      estimated_set_id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      estimated_weight INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS RMWeightProgression (
      rm_weight_progression_id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      progression_weight REAL NOT NULL DEFAULT 0,

      UNIQUE(mesocycle_id, exercise_name)
  );
`;

export async function initializeWeightliftingData(db) {
  const standardExercises = [
    'Squat',
    'Bench Press',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pull-Up',
    'Dip',
  ];

  const checkExercisesInit = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM Exercise;`
  );

  if (checkExercisesInit.count === 0) {
    const placeholders = standardExercises.map(() => '(?)').join(', ');
    await db.runAsync(
      `INSERT INTO Exercise (name) VALUES ${placeholders};`,
      standardExercises
    );
  }
}
