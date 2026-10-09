export const weightliftingSchemaSql = `

  CREATE TABLE IF NOT EXISTS Exercise (
      exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_exercise_id INTEGER UNIQUE,
      name TEXT NOT NULL UNIQUE,
      nickname TEXT,
      default_visible_columns TEXT,
      official INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      custom_muscle_group_keys TEXT,
      -- A custom exercise's cloud half is public.custom_exercise, not the
      -- catalog: cloud_exercise_id above is the catalog's id and stays null on
      -- a custom row. No owner column - this database belongs to one user, so
      -- every custom row in it is theirs; a copy of somebody else's is marked
      -- by source_exercise_id. The list in db.js (EXERCISE_EXTRA_COLUMNS) is
      -- the same columns for an existing install.
      cloud_custom_exercise_id INTEGER,
      is_public INTEGER NOT NULL DEFAULT 0,
      source_exercise_id INTEGER,
      description TEXT,
      steps TEXT,
      equipment TEXT,
      weight_mode TEXT NOT NULL DEFAULT 'total',
      video_path TEXT,
      poster_path TEXT,
      video_duration_ms INTEGER,
      custom_needs_upload INTEGER NOT NULL DEFAULT 0,
      cloud_updated_at TEXT
  );

  -- An exercise is looked up in the catalog by name without regard to case
  -- (name = ? COLLATE NOCASE), in the repository and in every join from an
  -- exercise instance. The UNIQUE index on name compares exactly, and SQLite
  -- cannot use it for such a lookup, so each one read the whole catalog. With
  -- this one it is a search. db.js runs this file on every start, after it
  -- has rebuilt an old Exercise table, so an existing install gets it too.
  CREATE INDEX IF NOT EXISTS exercise_name_nocase_idx
  ON Exercise(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS Exercise_Column_Preference (
      exercise_column_preference_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      cloud_exercise_id INTEGER,
      exercise_name TEXT NOT NULL,
      visible_columns TEXT NOT NULL,
      -- 'total' | 'per_side': how this user writes a catalog exercise's
      -- weight, so the choice follows them to a new phone. NULL when never
      -- chosen. A custom exercise keeps it in Exercise.weight_mode instead.
      weight_mode TEXT,
      needs_sync INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, exercise_name)
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
      -- 'total' | 'per_side': how this workout's weights for the exercise are
      -- written (@utils/weightMode). Copied from Exercise.weight_mode when the
      -- exercise is added; NULL, from before the column, means total.
      weight_mode TEXT,
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
      -- 'warmup' | 'working' | 'drop' | 'amrap'. The one truth for what kind of
      -- set this is; amrap above is kept as its mirror for older app versions.
      set_type TEXT NOT NULL DEFAULT 'working',
      amrap_target INTEGER,
      note TEXT,
      -- 1 when pause is the rest the app counted after the set was ticked off
      -- (none was written), not a rest somebody planned. It is a record only:
      -- never counted down, never carried to a new set (Utils/restCountUp.js).
      rest_counted INTEGER NOT NULL DEFAULT 0,
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
  const defaultVisibleColumns = JSON.stringify({
    note: false,
    rest: true,
    set: true,
    reps: true,
    rpe: false,
    rm_percentage: false,
    weight: true,
    done: true,
  });

  const checkExercisesInit = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM Exercise;`
  );

  if (checkExercisesInit.count === 0) {
    const placeholders = standardExercises.map(() => '(?, ?)').join(', ');
    const values = standardExercises.flatMap((exerciseName) => [
      exerciseName,
      defaultVisibleColumns,
    ]);

    await db.runAsync(
      `INSERT INTO Exercise (name, default_visible_columns) VALUES ${placeholders};`,
      values
    );
  }
}
