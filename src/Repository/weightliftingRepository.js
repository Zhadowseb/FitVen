import { withTransaction } from "../Database/transaction";
import { createNextSyncVersion, SQLITE_UUID_SQL } from "../Utils/syncUtils";

const exerciseOrderColumnReadyByDatabase = new Map();

function normalizeSqliteParam(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function sqliteParams(values) {
  return values.map(normalizeSqliteParam);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getDatabaseStateKey(db) {
  return db?.databasePath ?? db;
}

async function ensureExerciseOrderColumn(db) {
  const databaseKey = getDatabaseStateKey(db);

  if (exerciseOrderColumnReadyByDatabase.get(databaseKey)) {
    return;
  }

  const columns = await db.getAllAsync(
    `PRAGMA table_info(${quoteIdentifier("Exercise_Instance")});`
  );
  const hasExerciseOrderColumn = columns.some(
    (column) => column.name === "exercise_order"
  );

  if (!hasExerciseOrderColumn) {
    await db.execAsync(`
      ALTER TABLE Exercise_Instance
      ADD COLUMN exercise_order INTEGER NOT NULL DEFAULT 0;
    `);
  }

  await db.execAsync(`
    UPDATE Exercise_Instance
    SET exercise_order = exercise_instance_id
    WHERE COALESCE(exercise_order, 0) <= 0;
  `);

  exerciseOrderColumnReadyByDatabase.set(databaseKey, true);
}

export async function getExerciseStorage(db) {
  return db.getAllAsync(
    `SELECT
        cloud_exercise_id,
        name AS exercise_name,
        nickname,
        default_visible_columns,
        official,
        is_custom,
        custom_muscle_group_keys
     FROM Exercise
     ORDER BY name COLLATE NOCASE ASC;`
  );
}

export async function getExerciseCatalogEntryByName(db, exerciseName) {
  return db.getFirstAsync(
    `SELECT
        cloud_exercise_id,
        name AS exercise_name,
        nickname,
        default_visible_columns,
        official,
        is_custom,
        custom_muscle_group_keys
     FROM Exercise
     WHERE name = ? COLLATE NOCASE
     LIMIT 1;`,
    [exerciseName]
  );
}

export async function getCompletedStrengthSetsForPersonalRecords(
  db,
  { exerciseName = null } = {}
) {
  const params = [];
  const exerciseFilter =
    exerciseName === null || exerciseName === undefined
      ? ""
      : "AND e.exercise_name = ?";

  if (exerciseFilter) {
    params.push(exerciseName);
  }

  return db.getAllAsync(
    `SELECT
        s.sets_id,
        s.weight,
        s.reps,
        s.personal_record,
        e.exercise_name,
        w.workout_id,
        w.label AS workout_label,
        d.date AS performed_date,
        CASE
          WHEN d.date LIKE '__.__.____'
          THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
          ELSE d.date
        END AS performed_date_sort,
        p.program_name
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     LEFT JOIN Program p ON p.program_id = d.program_id
     WHERE s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       ${exerciseFilter}
     ORDER BY
       e.exercise_name COLLATE NOCASE ASC,
       CAST(s.reps AS INTEGER) ASC,
       CAST(s.weight AS REAL) DESC,
       performed_date_sort DESC,
       s.sets_id DESC;`,
    params
  );
}

export async function getCompletedExerciseHistorySets(
  db,
  { exerciseId, exerciseName, limit = 3 }
) {
  return db.getAllAsync(
    `WITH current_exercise AS (
        SELECT workout_type_instance_id AS current_workout_id
        FROM Exercise_Instance
        WHERE exercise_instance_id = ?
      ),
      history_exercises AS (
        SELECT
          e.exercise_instance_id,
          e.workout_type_instance_id AS workout_id,
          COALESCE(d.date, w.date) AS performed_date,
          CASE
            WHEN COALESCE(d.date, w.date) LIKE '__.__.____'
            THEN substr(COALESCE(d.date, w.date), 7, 4) || '-' ||
                 substr(COALESCE(d.date, w.date), 4, 2) || '-' ||
                 substr(COALESCE(d.date, w.date), 1, 2)
            ELSE COALESCE(d.date, w.date)
          END AS performed_date_sort,
          MAX(CAST(s.weight AS REAL)) AS top_weight
        FROM Exercise_Instance e
        JOIN Workout_Type_Instance w
          ON w.workout_id = e.workout_type_instance_id
        LEFT JOIN Day d
          ON d.day_id = w.day_id
        JOIN "Set" s
          ON s.exercise_instance_id = e.exercise_instance_id
        WHERE e.exercise_name = ? COLLATE NOCASE
          AND e.exercise_instance_id <> ?
          AND e.workout_type_instance_id <> COALESCE(
            (SELECT current_workout_id FROM current_exercise),
            -1
          )
          AND s.done = 1
          AND COALESCE(s.failed, 0) = 0
          AND s.weight IS NOT NULL
          AND s.reps IS NOT NULL
          AND CAST(s.weight AS REAL) > 0
          AND CAST(s.reps AS INTEGER) > 0
          AND COALESCE(s.deleted_at, '') = ''
          AND COALESCE(e.deleted_at, '') = ''
          AND COALESCE(w.deleted_at, '') = ''
          AND COALESCE(d.deleted_at, '') = ''
        GROUP BY
          e.exercise_instance_id,
          e.workout_type_instance_id,
          COALESCE(d.date, w.date)
        ORDER BY performed_date_sort DESC, e.exercise_instance_id DESC
        LIMIT ?
      )
     SELECT
        he.exercise_instance_id,
        he.workout_id,
        he.performed_date,
        he.performed_date_sort,
        he.top_weight,
        s.sets_id,
        s.set_number,
        s.reps,
        s.weight,
        s.amrap,
        s.personal_record
     FROM history_exercises he
     JOIN "Set" s
       ON s.exercise_instance_id = he.exercise_instance_id
     WHERE s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
     ORDER BY
       he.performed_date_sort DESC,
       he.exercise_instance_id DESC,
       s.set_number ASC,
       s.sets_id ASC;`,
    [exerciseId, exerciseName, exerciseId, limit]
  );
}

export async function createExerciseStorage(db, exerciseName) {
  await db.runAsync(
    `INSERT INTO Exercise (name, nickname, default_visible_columns)
     VALUES (?, NULL, NULL);`,
    [exerciseName]
  );
}

export async function createCustomExerciseStorage(
  db,
  { exerciseName, muscleGroupKeys }
) {
  await db.runAsync(
    `INSERT INTO Exercise (
       name,
       nickname,
       default_visible_columns,
       official,
       is_custom,
       custom_muscle_group_keys
     )
     VALUES (?, NULL, NULL, 0, 1, ?);`,
    [exerciseName, JSON.stringify(muscleGroupKeys)]
  );

  return getExerciseCatalogEntryByName(db, exerciseName);
}

export async function replaceExerciseCatalog(db, exercises) {
  await withTransaction(db, async () => {
    await db.runAsync(`DELETE FROM Exercise WHERE COALESCE(is_custom, 0) = 0;`);

    if (exercises.length > 0) {
      const placeholders = exercises.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const values = exercises.flatMap((exercise) => [
        exercise.cloud_exercise_id ?? null,
        exercise.name ?? exercise.exercise_name,
        exercise.nickname ?? null,
        exercise.default_visible_columns ?? null,
        exercise.official ? 1 : 0,
      ]);

      await db.runAsync(
        `INSERT OR IGNORE INTO Exercise (
          cloud_exercise_id,
          name,
          nickname,
          default_visible_columns,
          official
        ) VALUES ${placeholders};`,
        values
      );
    }
  });
}

export async function getExerciseColumnPreference(
  db,
  { userId, exerciseName }
) {
  return db.getFirstAsync(
    `SELECT
        exercise_column_preference_id,
        user_id,
        cloud_exercise_id,
        exercise_name,
        visible_columns,
        needs_sync,
        updated_at
     FROM Exercise_Column_Preference
     WHERE user_id = ?
       AND exercise_name = ? COLLATE NOCASE
     LIMIT 1;`,
    [userId, exerciseName]
  );
}

export async function getExerciseColumnPreferencesForUser(db, userId) {
  return db.getAllAsync(
    `SELECT
        exercise_column_preference_id,
        user_id,
        cloud_exercise_id,
        exercise_name,
        visible_columns,
        needs_sync,
        updated_at
     FROM Exercise_Column_Preference
     WHERE user_id = ?
     ORDER BY exercise_name COLLATE NOCASE ASC;`,
    [userId]
  );
}

export async function getDirtyExerciseColumnPreferences(db, userId) {
  return db.getAllAsync(
    `SELECT
        p.exercise_column_preference_id,
        p.user_id,
        COALESCE(p.cloud_exercise_id, e.cloud_exercise_id) AS cloud_exercise_id,
        p.exercise_name,
        p.visible_columns,
        p.updated_at
     FROM Exercise_Column_Preference p
     LEFT JOIN Exercise e
       ON e.name = p.exercise_name COLLATE NOCASE
     WHERE p.user_id = ?
       AND p.needs_sync = 1
     ORDER BY p.updated_at ASC, p.exercise_column_preference_id ASC;`,
    [userId]
  );
}

export async function upsertExerciseColumnPreference(
  db,
  {
    userId,
    cloudExerciseId = null,
    exerciseName,
    visibleColumns,
    needsSync = 1,
    updatedAt = new Date().toISOString(),
  }
) {
  await db.runAsync(
    `INSERT INTO Exercise_Column_Preference (
        user_id,
        cloud_exercise_id,
        exercise_name,
        visible_columns,
        needs_sync,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, exercise_name)
      DO UPDATE SET
        cloud_exercise_id = excluded.cloud_exercise_id,
        visible_columns = excluded.visible_columns,
        needs_sync = excluded.needs_sync,
        updated_at = excluded.updated_at;`,
    [
      userId,
      cloudExerciseId,
      exerciseName,
      visibleColumns,
      needsSync ? 1 : 0,
      updatedAt,
    ]
  );
}

export async function markExerciseColumnPreferenceSynced(
  db,
  { userId, exerciseName, updatedAt = null }
) {
  const params = [userId, exerciseName];
  const updatedAtFilter = updatedAt ? "AND updated_at = ?" : "";

  if (updatedAt) {
    params.push(updatedAt);
  }

  await db.runAsync(
    `UPDATE Exercise_Column_Preference
     SET needs_sync = 0
     WHERE user_id = ?
       AND exercise_name = ? COLLATE NOCASE
       ${updatedAtFilter};`,
    params
  );
}

export async function getEstimatedSets(db, programId) {
  return db.getAllAsync(
    `SELECT estimated_set_id, estimated_weight, exercise_name
     FROM Estimated_Set
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getEstimatedSetById(db, estimatedSetId) {
  return db.getFirstAsync(
    `SELECT estimated_set_id, program_id, exercise_name, estimated_weight
     FROM Estimated_Set
     WHERE estimated_set_id = ?;`,
    [estimatedSetId]
  );
}

export async function createEstimatedSet(
  db,
  { programId, exerciseName, estimatedWeight }
) {
  await db.runAsync(
    `INSERT INTO Estimated_Set (program_id, exercise_name, estimated_weight)
     VALUES (?, ?, ?);`,
    [programId, exerciseName, estimatedWeight]
  );
}

export async function updateEstimatedSetWeight(
  db,
  { estimatedSetId, estimatedWeight }
) {
  await db.runAsync(
    `UPDATE Estimated_Set
     SET estimated_weight = ?
     WHERE estimated_set_id = ?;`,
    [estimatedWeight, estimatedSetId]
  );
}

export async function deleteEstimatedSet(db, estimatedSetId) {
  await db.runAsync(
    `DELETE FROM Estimated_Set
     WHERE estimated_set_id = ?;`,
    [estimatedSetId]
  );
}

export async function getMesocycleRmProgressions(db, mesocycleId) {
  return db.getAllAsync(
    `SELECT exercise_name, progression_weight
     FROM RMWeightProgression
     WHERE mesocycle_id = ?
     ORDER BY exercise_name COLLATE NOCASE ASC;`,
    [mesocycleId]
  );
}

export async function insertRmWeightProgression(
  db,
  { mesocycleId, exerciseName, progressionWeight }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO RMWeightProgression (
      mesocycle_id,
      exercise_name,
      progression_weight
    ) VALUES (?, ?, ?);`,
    [mesocycleId, exerciseName, progressionWeight]
  );
}

export async function getLatestRmProgressionWeightBeforeMesocycle(
  db,
  { programId, exerciseName, mesocycleNumber }
) {
  return db.getFirstAsync(
    `SELECT rmp.progression_weight
     FROM RMWeightProgression rmp
     JOIN Mesocycle m ON m.mesocycle_id = rmp.mesocycle_id
     WHERE m.program_id = ?
       AND rmp.exercise_name = ?
       AND m.mesocycle_number < ?
     ORDER BY m.mesocycle_number DESC
     LIMIT 1;`,
    [programId, exerciseName, mesocycleNumber]
  );
}

export async function incrementRmWeightProgressionsFromMesocycle(
  db,
  { programId, exerciseName, mesocycleNumber, delta }
) {
  await db.runAsync(
    `UPDATE RMWeightProgression
     SET progression_weight = progression_weight + ?
     WHERE exercise_name = ?
       AND mesocycle_id IN (
         SELECT mesocycle_id
         FROM Mesocycle
         WHERE program_id = ?
           AND mesocycle_number >= ?
       );`,
    [delta, exerciseName, programId, mesocycleNumber]
  );
}

export async function getMesocycleEstimatedSetProgressions(db, mesocycleId) {
  return db.getAllAsync(
    `SELECT
        m.mesocycle_id,
        m.mesocycle_number,
        es.exercise_name,
        es.estimated_weight,
        COALESCE(
          rmp.progression_weight,
          CASE
            WHEN m.mesocycle_number > 1
              THEN (m.mesocycle_number - 1) * 2.5
            ELSE 0
          END
        ) AS progression_weight
     FROM Mesocycle m
     LEFT JOIN Estimated_Set es
       ON es.program_id = m.program_id
     LEFT JOIN RMWeightProgression rmp
       ON rmp.mesocycle_id = m.mesocycle_id
      AND rmp.exercise_name = es.exercise_name
     WHERE m.mesocycle_id = ?
       AND es.exercise_name IS NOT NULL
     ORDER BY es.exercise_name COLLATE NOCASE ASC;`,
    [mesocycleId]
  );
}

export async function getMesocycleEstimatedSetProgressionsByProgram(db, programId) {
  return db.getAllAsync(
    `SELECT
        m.mesocycle_id,
        m.mesocycle_number,
        es.exercise_name,
        es.estimated_weight,
        COALESCE(
          rmp.progression_weight,
          CASE
            WHEN m.mesocycle_number > 1
              THEN (m.mesocycle_number - 1) * 2.5
            ELSE 0
          END
        ) AS progression_weight
     FROM Mesocycle m
     LEFT JOIN Estimated_Set es
       ON es.program_id = m.program_id
     LEFT JOIN RMWeightProgression rmp
       ON rmp.mesocycle_id = m.mesocycle_id
      AND rmp.exercise_name = es.exercise_name
     WHERE m.program_id = ?
       AND es.exercise_name IS NOT NULL
     ORDER BY m.mesocycle_number ASC, es.exercise_name COLLATE NOCASE ASC;`,
    [programId]
  );
}

export async function deleteRmWeightProgressionsByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM RMWeightProgression
     WHERE mesocycle_id IN (
       SELECT mesocycle_id
       FROM Mesocycle
       WHERE program_id = ?
     );`,
    [programId]
  );
}

export async function deleteRmWeightProgressionsByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM RMWeightProgression
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function deleteRmWeightProgressionsByProgramExercise(
  db,
  { programId, exerciseName }
) {
  await db.runAsync(
    `DELETE FROM RMWeightProgression
     WHERE exercise_name = ?
       AND mesocycle_id IN (
         SELECT mesocycle_id
         FROM Mesocycle
         WHERE program_id = ?
       );`,
    [exerciseName, programId]
  );
}

export async function getEstimatedWeightBySetId(db, setId) {
  return db.getFirstAsync(
    `SELECT
        es.estimated_weight,
        COALESCE(
          rmp.progression_weight,
          CASE
            WHEN m.mesocycle_number > 1
              THEN (m.mesocycle_number - 1) * 2.5
            ELSE 0
          END
        ) AS progression_weight,
        es.estimated_weight + COALESCE(
          rmp.progression_weight,
          CASE
            WHEN m.mesocycle_number > 1
              THEN (m.mesocycle_number - 1) * 2.5
            ELSE 0
          END
        ) AS adjusted_estimated_weight
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
     JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
     LEFT JOIN Estimated_Set es
       ON es.program_id = d.program_id
      AND es.exercise_name = e.exercise_name
     LEFT JOIN RMWeightProgression rmp
       ON rmp.mesocycle_id = m.mesocycle_id
      AND rmp.exercise_name = e.exercise_name
     WHERE s.sets_id = ?;`,
    [setId]
  );
}

export async function getTotalPlannedSetsByWorkout(db, workoutId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE e.workout_type_instance_id = ?;`,
    [workoutId]
  );
}

export async function getDoneSetCountByWorkout(db, workoutId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS done_sets
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE e.workout_type_instance_id = ?
       AND s.done = 1;`,
    [workoutId]
  );
}

export async function getExercisesByWorkout(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        ei.exercise_instance_id AS exercise_id,
        ei.workout_type_instance_id AS workout_id,
        ei.exercise_name,
        ei.exercise_order,
        ei.sets,
        ei.done,
        ei.visible_columns,
        ei.note,
        e.cloud_exercise_id,
        e.default_visible_columns
     FROM Exercise_Instance ei
     LEFT JOIN Exercise e
       ON e.name = ei.exercise_name COLLATE NOCASE
     WHERE ei.workout_type_instance_id = ?
     ORDER BY ei.exercise_order ASC, ei.exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getProgramExerciseNames(db, programId) {
  return db.getAllAsync(
    `SELECT DISTINCT e.exercise_name
     FROM Exercise_Instance e
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE d.program_id = ?
     ORDER BY e.exercise_name COLLATE NOCASE ASC;`,
    [programId]
  );
}

export async function getExerciseSummariesByWorkout(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT exercise_name, sets
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?
     ORDER BY exercise_order ASC, exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getSetsByWorkout(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT s.*
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE e.workout_type_instance_id = ?
     ORDER BY e.exercise_order ASC, e.exercise_instance_id ASC, s.set_number ASC, s.sets_id ASC;`,
    [workoutId]
  );
}

export async function getExercisesByWorkoutId(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        exercise_instance_id AS exercise_id,
        workout_type_instance_id AS workout_id,
        exercise_name,
        exercise_order,
        sets,
        visible_columns,
        note,
        done
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?
     ORDER BY exercise_order ASC, exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getExercisesForCloudSync(db) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        exercise_instance_id,
        cloud_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        workout_type_instance_id,
        exercise_name,
        exercise_order,
        sets,
        visible_columns,
        note,
        done,
        needs_sync
     FROM Exercise_Instance
     ORDER BY workout_type_instance_id ASC, exercise_order ASC, exercise_instance_id ASC;`
  );
}

export async function getExerciseOrderByWorkout(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT exercise_instance_id, exercise_order
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?
     ORDER BY exercise_order ASC, exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getNextExerciseOrderForWorkout(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getFirstAsync(
    `SELECT
        COALESCE(
          MAX(CASE WHEN exercise_order > 0 THEN exercise_order END),
          COUNT(*)
        ) + 1 AS exercise_order
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?;`,
    [workoutId]
  );
}

export async function createExercise(
  db,
  {
    workoutId,
    exerciseName,
    sets = 0,
    visibleColumns = null,
    note = null,
    done = 0,
    exerciseOrder = 0,
  }
) {
  await ensureExerciseOrderColumn(db);

  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Exercise_Instance (
      workout_type_instance_id,
      exercise_name,
      exercise_order,
      sets,
      visible_columns,
      note,
      done,
      needs_sync,
      sync_id,
      sync_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ${SQLITE_UUID_SQL}, ?);`,
    [
      workoutId,
      exerciseName,
      exerciseOrder,
      sets,
      visibleColumns,
      note,
      done,
      syncVersion,
    ]
  );
}

export async function createExerciseFromCloud(
  db,
  {
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId,
    syncId,
    syncVersion,
    deletedAt,
    workoutId,
    exerciseName,
    exerciseOrder = 0,
    sets,
    visibleColumns,
    note,
    done,
  }
) {
  await ensureExerciseOrderColumn(db);

  return db.runAsync(
    `INSERT INTO Exercise_Instance (
      cloud_exercise_instance_id,
      remote_local_exercise_instance_id,
      sync_id,
      sync_version,
      deleted_at,
      workout_type_instance_id,
      exercise_name,
      exercise_order,
      sets,
      visible_columns,
      note,
      done,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      workoutId,
      exerciseName,
      exerciseOrder,
      sets,
      visibleColumns,
      note,
      done ? 1 : 0,
    ])
  );
}

export async function updateExerciseFromCloud(
  db,
  {
    exerciseId,
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId,
    syncId,
    syncVersion,
    deletedAt,
    workoutId,
    exerciseName,
    exerciseOrder = 0,
    sets,
    visibleColumns,
    note,
    done,
  }
) {
  await ensureExerciseOrderColumn(db);

  await db.runAsync(
    `UPDATE Exercise_Instance
     SET cloud_exercise_instance_id = ?,
         remote_local_exercise_instance_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         workout_type_instance_id = ?,
         exercise_name = ?,
         exercise_order = ?,
         sets = ?,
         visible_columns = ?,
         note = ?,
         done = ?,
         needs_sync = 0
     WHERE exercise_instance_id = ?;`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      workoutId,
      exerciseName,
      exerciseOrder,
      sets,
      visibleColumns,
      note,
      done ? 1 : 0,
      exerciseId,
    ])
  );
}

export async function markExerciseSynced(
  db,
  {
    exerciseId,
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET cloud_exercise_instance_id = ?,
         remote_local_exercise_instance_id = COALESCE(
           ?,
           remote_local_exercise_instance_id,
           exercise_instance_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE exercise_instance_id = ?;`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      exerciseId,
    ])
  );
}

export async function updateExerciseCloudIdentity(
  db,
  {
    exerciseId,
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET cloud_exercise_instance_id = ?,
         remote_local_exercise_instance_id = COALESCE(
           ?,
           remote_local_exercise_instance_id,
           exercise_instance_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE exercise_instance_id = ?;`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      exerciseId,
    ])
  );
}

export async function markExerciseForCloudResync(db, { exerciseId }) {
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET cloud_id = NULL,
         cloud_exercise_instance_id = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function getExerciseSyncMetadata(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT
        exercise_instance_id,
        cloud_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Exercise_Instance
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function getQueuedExerciseInstanceDeletes(db) {
  return db.getAllAsync(
    `SELECT
        exercise_instance_sync_delete_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Exercise_Instance_Sync_Delete
     ORDER BY exercise_instance_sync_delete_id ASC;`
  );
}

export async function queueExerciseInstanceDeleteSync(
  db,
  {
    cloudExerciseInstanceId = null,
    remoteLocalExerciseInstanceId = null,
    syncId = null,
    syncVersion = 0,
    deletedAt,
  }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Exercise_Instance_Sync_Delete (
      cloud_exercise_instance_id,
      remote_local_exercise_instance_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?);`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
    ])
  );
}

export async function deleteQueuedExerciseInstanceDelete(db, queueId) {
  if (queueId === null || queueId === undefined) {
    return;
  }

  await db.runAsync(
    `DELETE FROM Exercise_Instance_Sync_Delete
     WHERE exercise_instance_sync_delete_id = ?;`,
    sqliteParams([queueId])
  );
}

export async function getWorkoutIdByExercise(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT workout_type_instance_id AS workout_id
     FROM Exercise_Instance
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function getExerciseInstanceById(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT
        exercise_instance_id,
        workout_type_instance_id AS workout_id,
        exercise_name,
        visible_columns
     FROM Exercise_Instance
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function deleteSetsByExercise(db, exerciseId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function deleteExerciseById(db, exerciseId) {
  await db.runAsync(
    `DELETE FROM Exercise_Instance
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function countSetsByExercise(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM "Set"
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function createSet(
  db,
  {
    setNumber,
    exerciseId,
    personalRecord = 0,
    pause = null,
    rpe = null,
    weight = null,
    rmPercentage = null,
    reps = null,
    done = 0,
    failed = 0,
    amrap = 0,
    note = null,
  }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO "Set" (
      set_number,
      exercise_instance_id,
      sync_id,
      sync_version,
      personal_record,
      pause,
      rpe,
      weight,
      rm_percentage,
      reps,
      done,
      failed,
      amrap,
      note,
      needs_sync
    ) VALUES (?, ?, ${SQLITE_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
    [
      setNumber,
      exerciseId,
      syncVersion,
      personalRecord,
      pause,
      rpe,
      weight,
      rmPercentage,
      reps,
      done,
      failed,
      amrap,
      note,
    ]
  );
}

export async function getSetsForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        sets_id,
        cloud_id,
        cloud_set_id,
        remote_local_set_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        set_number,
        exercise_instance_id,
        personal_record,
        pause,
        rpe,
        weight,
        rm_percentage,
        reps,
        done,
        failed,
        amrap,
        note,
        needs_sync
     FROM "Set"
     ORDER BY sets_id ASC;`
  );
}

export async function createSetFromCloud(
  db,
  {
    cloudSetId,
    remoteLocalSetId,
    syncId,
    syncVersion,
    deletedAt,
    exerciseId,
    setNumber,
    personalRecord,
    pause,
    rpe,
    weight,
    rmPercentage,
    reps,
    done,
    failed,
    amrap,
    note,
  }
) {
  return db.runAsync(
    `INSERT INTO "Set" (
      cloud_set_id,
      remote_local_set_id,
      sync_id,
      sync_version,
      deleted_at,
      set_number,
      exercise_instance_id,
      personal_record,
      pause,
      rpe,
      weight,
      rm_percentage,
      reps,
      done,
      failed,
      amrap,
      note,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    sqliteParams([
      cloudSetId,
      remoteLocalSetId,
      syncId,
      syncVersion,
      deletedAt,
      setNumber,
      exerciseId,
      personalRecord ? 1 : 0,
      pause,
      rpe,
      weight,
      rmPercentage,
      reps,
      done ? 1 : 0,
      failed ? 1 : 0,
      amrap ? 1 : 0,
      note,
    ])
  );
}

export async function updateSetFromCloud(
  db,
  {
    setId,
    cloudSetId,
    remoteLocalSetId,
    syncId,
    syncVersion,
    deletedAt,
    exerciseId,
    setNumber,
    personalRecord,
    pause,
    rpe,
    weight,
    rmPercentage,
    reps,
    done,
    failed,
    amrap,
    note,
  }
) {
  await db.runAsync(
    `UPDATE "Set"
     SET cloud_set_id = ?,
         remote_local_set_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         set_number = ?,
         exercise_instance_id = ?,
         personal_record = ?,
         pause = ?,
         rpe = ?,
         weight = ?,
         rm_percentage = ?,
         reps = ?,
         done = ?,
         failed = ?,
         amrap = ?,
         note = ?,
         needs_sync = 0
     WHERE sets_id = ?;`,
    sqliteParams([
      cloudSetId,
      remoteLocalSetId,
      syncId,
      syncVersion,
      deletedAt,
      setNumber,
      exerciseId,
      personalRecord ? 1 : 0,
      pause,
      rpe,
      weight,
      rmPercentage,
      reps,
      done ? 1 : 0,
      failed ? 1 : 0,
      amrap ? 1 : 0,
      note,
      setId,
    ])
  );
}

export async function markSetSynced(
  db,
  {
    setId,
    cloudSetId,
    remoteLocalSetId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE "Set"
     SET cloud_set_id = ?,
         remote_local_set_id = COALESCE(
           ?,
           remote_local_set_id,
           sets_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE sets_id = ?;`,
    sqliteParams([
      cloudSetId,
      remoteLocalSetId,
      syncId,
      syncVersion,
      deletedAt,
      setId,
    ])
  );
}

export async function updateSetCloudIdentity(
  db,
  {
    setId,
    cloudSetId,
    remoteLocalSetId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE "Set"
     SET cloud_set_id = ?,
         remote_local_set_id = COALESCE(
           ?,
           remote_local_set_id,
           sets_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE sets_id = ?;`,
    sqliteParams([
      cloudSetId,
      remoteLocalSetId,
      syncId,
      syncVersion,
      deletedAt,
      setId,
    ])
  );
}

export async function markSetForCloudResync(db, { setId }) {
  await db.runAsync(
    `UPDATE "Set"
     SET cloud_id = NULL,
         cloud_set_id = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [setId]
  );
}

export async function getSetSyncMetadata(db, setId) {
  return db.getFirstAsync(
    `SELECT
        sets_id,
        cloud_id,
        cloud_set_id,
        remote_local_set_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM "Set"
     WHERE sets_id = ?;`,
    [setId]
  );
}

export async function getQueuedSetDeletes(db) {
  return db.getAllAsync(
    `SELECT
        set_sync_delete_id,
        cloud_set_id,
        remote_local_set_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Set_Sync_Delete
     ORDER BY set_sync_delete_id ASC;`
  );
}

export async function queueSetDeleteSync(
  db,
  {
    cloudSetId = null,
    remoteLocalSetId = null,
    syncId = null,
    syncVersion = 0,
    deletedAt,
  }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Set_Sync_Delete (
      cloud_set_id,
      remote_local_set_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?);`,
    sqliteParams([cloudSetId, remoteLocalSetId, syncId, syncVersion, deletedAt])
  );
}

export async function deleteQueuedSetDelete(db, queueId) {
  if (queueId === null || queueId === undefined) {
    return;
  }

  await db.runAsync(
    `DELETE FROM Set_Sync_Delete
     WHERE set_sync_delete_id = ?;`,
    sqliteParams([queueId])
  );
}

export async function clearQueuedSetDeletes(db) {
  await db.runAsync(`DELETE FROM Set_Sync_Delete;`);
}

export async function refreshExerciseDerivedFieldsFromSets(db) {
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET needs_sync = CASE
           WHEN COALESCE(sets, 0) <> (
             SELECT COUNT(*)
             FROM "Set"
             WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
           )
           OR COALESCE(done, 0) <> (
             CASE
               WHEN EXISTS (
                 SELECT 1
                 FROM "Set"
                 WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
                   AND "Set".done = 0
               )
               THEN 0
               ELSE 1
             END
           )
           THEN 1
           ELSE needs_sync
         END,
         sets = (
           SELECT COUNT(*)
           FROM "Set"
           WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
         ),
         done = CASE
           WHEN EXISTS (
             SELECT 1
             FROM "Set"
             WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
               AND "Set".done = 0
           )
           THEN 0
           ELSE 1
         END;`
  );
}

export async function updateExerciseSetCount(db, exerciseId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET sets = (
       SELECT COUNT(*)
       FROM "Set"
       WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [syncVersion, exerciseId]
  );
}

export async function updateExerciseDoneFromSets(db, exerciseId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM "Set"
         WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
           AND "Set".done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [syncVersion, exerciseId]
  );
}

export async function updateExerciseVisibleColumns(
  db,
  { exerciseId, columns }
) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET visible_columns = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [JSON.stringify(columns), syncVersion, exerciseId]
  );
}

export async function updateExerciseNote(db, { exerciseId, note }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET note = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [note, syncVersion, exerciseId]
  );
}

export async function updateExerciseOrder(
  db,
  { exerciseId, exerciseOrder }
) {
  await ensureExerciseOrderColumn(db);

  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET exercise_order = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [exerciseOrder, syncVersion, exerciseId]
  );
}

export async function updateSetDone(db, { setId, done, failed = 0 }) {
  const syncVersion = createNextSyncVersion();
  const doneValue = done ? 1 : 0;
  const failedValue = doneValue === 1 && failed ? 1 : 0;

  await db.runAsync(
    `UPDATE "Set"
     SET done = ?,
         failed = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [doneValue, failedValue, syncVersion, setId]
  );
}

export async function updateExerciseDoneBySet(db, setId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM "Set"
         WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
           AND "Set".done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = (
       SELECT exercise_instance_id
       FROM "Set"
       WHERE sets_id = ?
     );`,
    [syncVersion, setId]
  );
}

export async function updateWorkoutDoneFromExercises(db, workoutId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM Exercise_Instance
         WHERE Exercise_Instance.workout_type_instance_id = Workout_Type_Instance.workout_id
           AND Exercise_Instance.done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [syncVersion, workoutId]
  );
}

export async function getExerciseAndWorkoutBySetId(db, setId) {
  return db.getFirstAsync(
    `SELECT
        s.exercise_instance_id,
        e.exercise_name,
        e.workout_type_instance_id AS workout_id
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE s.sets_id = ?;`,
    [setId]
  );
}

export async function getExerciseNameBySetId(db, setId) {
  return db.getFirstAsync(
    `SELECT e.exercise_name
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE s.sets_id = ?;`,
    [setId]
  );
}

export async function getExerciseNameByExerciseId(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT exercise_name
     FROM Exercise_Instance
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function deleteSetById(db, setId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE sets_id = ?;`,
    [setId]
  );
}

export async function getSetIdsByExercise(db, exerciseId) {
  return db.getAllAsync(
    `SELECT sets_id
     FROM "Set"
     WHERE exercise_instance_id = ?
     ORDER BY set_number ASC, sets_id ASC;`,
    [exerciseId]
  );
}

export async function updateSetNumber(db, { setId, setNumber }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE "Set"
     SET set_number = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [setNumber, syncVersion, setId]
  );
}

export async function updateSetField(db, { field, value, setId }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE "Set"
     SET ${field} = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [value, syncVersion, setId]
  );
}

export async function getPersonalRecordFlagsByExerciseName(db, exerciseName) {
  return db.getAllAsync(
    `SELECT s.sets_id, COALESCE(s.personal_record, 0) AS personal_record
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE e.exercise_name = ?
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = '';`,
    [exerciseName]
  );
}

export async function updateSetPersonalRecord(db, { setId, personalRecord }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE "Set"
     SET personal_record = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [personalRecord ? 1 : 0, syncVersion, setId]
  );
}

export async function getExerciseSets(db, exerciseId) {
  return db.getAllAsync(
    `SELECT set_number, exercise_instance_id, pause, rpe, weight, rm_percentage, reps, done, failed, amrap, note
     FROM "Set"
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function getExerciseSetCount(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM "Set"
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}

export async function updateSetByExerciseAndNumber(
  db,
  {
    exerciseId,
    setNumber,
    pause,
    rpe,
    weight,
    rmPercentage,
    reps,
    done,
    failed,
    amrap,
    note,
  }
) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE "Set"
     SET pause = ?,
         rpe = ?,
         weight = ?,
         rm_percentage = ?,
         reps = ?,
         done = ?,
         failed = ?,
         amrap = ?,
         note = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?
       AND set_number = ?;`,
    [
      pause,
      rpe,
      weight,
      rmPercentage,
      reps,
      done,
      failed,
      amrap,
      note,
      syncVersion,
      exerciseId,
      setNumber,
    ]
  );
}

export async function updateExerciseDone(db, { exerciseId, done }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET done = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    [done ? 1 : 0, syncVersion, exerciseId]
  );
}

export async function deleteSetsByWorkout(db, workoutId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE exercise_instance_id IN (
       SELECT exercise_instance_id
       FROM Exercise_Instance
       WHERE workout_type_instance_id = ?
     );`,
    [workoutId]
  );
}

export async function deleteExercisesByWorkout(db, workoutId) {
  await db.runAsync(
    `DELETE FROM Exercise_Instance
     WHERE workout_type_instance_id = ?;`,
    [workoutId]
  );
}

export async function getSetsByExercise(db, exerciseId) {
  return db.getAllAsync(
    `SELECT *
     FROM "Set"
     WHERE exercise_instance_id = ?;`,
    [exerciseId]
  );
}
