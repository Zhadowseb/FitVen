import { amrapFlagFor, normalizeSetType, resolveSetType } from "@utils/setTypes";
import {
  CURRENT_WEIGHT_MODES_SQL,
  convertWeightSql,
  currentWeightModeSql,
  totalLoadSql,
} from "@utils/weightMode";
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
        custom_muscle_group_keys,
        equipment,
        weight_mode
     FROM Exercise
     WHERE name = ? COLLATE NOCASE
     LIMIT 1;`,
    [exerciseName]
  );
}

/**
 * The catalog's weight mode for each of `exerciseNames`, in one query: a row
 * per distinct name, `{ exercise_name, weight_mode }`, with the name as it
 * was asked for and a null weight_mode for one the catalog does not have.
 * Matched as getExerciseCatalogEntryByName matches one name - without regard
 * to case, the first catalog row - for a caller that would otherwise ask once
 * per exercise, like copying a week.
 */
export async function getExerciseCatalogWeightModes(db, exerciseNames) {
  const names = [
    ...new Set((exerciseNames ?? []).filter((name) => typeof name === "string")),
  ];

  if (names.length === 0) {
    return [];
  }

  return db.getAllAsync(
    `WITH requested(name) AS (VALUES ${names.map(() => "(?)").join(", ")})
     SELECT
        requested.name AS exercise_name,
        (
          SELECT catalog.weight_mode
          FROM Exercise catalog
          WHERE catalog.name = requested.name COLLATE NOCASE
          ORDER BY catalog.exercise_id ASC
          LIMIT 1
        ) AS weight_mode
     FROM requested;`,
    names
  );
}

// The sets Records and an exercise's statistics page are made of: ticked off,
// not failed, with a weight and reps, nothing deleted on the way up, and no
// warm-ups. One string for both queries below, so the "See statistics"
// button in the exercise library cannot promise a page that turns out empty.
const COMPLETED_STRENGTH_SET_CONDITIONS = `s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       -- A warm-up is preparation: it is in no record, no volume, no trend.
       -- Drop sets stay - they count toward volume - and are held back from
       -- the record calculations by the service instead.
       AND COALESCE(s.set_type, 'working') <> 'warmup'`;

export async function getCompletedStrengthSetsForPersonalRecords(
  db,
  { exerciseName = null, sinceIsoDate = null } = {}
) {
  const params = [];
  const exerciseFilter =
    exerciseName === null || exerciseName === undefined
      ? ""
      : "AND e.exercise_name = ?";

  if (exerciseFilter) {
    params.push(exerciseName);
  }

  // Records wants every set there has ever been. Home's muscle glance wants
  // the last sixty days, and was reading the whole history on every return to
  // the screen to throw nine tenths of it away in JavaScript. Optional, so no
  // other caller changes.
  const sinceFilter = sinceIsoDate
    ? `AND (CASE
         WHEN d.date LIKE '__.__.____'
         THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
         ELSE d.date
       END) >= ?`
    : "";

  if (sinceFilter) {
    params.push(sinceIsoDate);
  }

  // Weight per side or for both (4d). `weight` is in the exercise's current
  // mode - every older set converted, exactly, before anything compares it -
  // so a record, an e1RM and a best never move because somebody switched.
  // `total_weight` is what was lifted, for volume. `logged_weight` and
  // `logged_weight_mode` are the set as it was written.
  const loggedMode = "COALESCE(e.weight_mode, 'total')";
  const currentMode = currentWeightModeSql("current_mode");
  const weightInCurrentMode = convertWeightSql("s.weight", loggedMode, currentMode);

  return db.getAllAsync(
    `WITH current_modes AS (${CURRENT_WEIGHT_MODES_SQL})
     SELECT
        s.sets_id,
        ${weightInCurrentMode} AS weight,
        ${currentMode} AS weight_mode,
        s.weight AS logged_weight,
        ${loggedMode} AS logged_weight_mode,
        ${totalLoadSql("s.weight", loggedMode)} AS total_weight,
        s.reps,
        s.personal_record,
        s.set_type,
        s.amrap,
        s.rpe,
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
     LEFT JOIN current_modes current_mode
       ON current_mode.name_key = lower(e.exercise_name)
     WHERE ${COMPLETED_STRENGTH_SET_CONDITIONS}
       ${exerciseFilter}
       ${sinceFilter}
     ORDER BY
       e.exercise_name COLLATE NOCASE ASC,
       CAST(s.reps AS INTEGER) ASC,
       ${weightInCurrentMode} DESC,
       performed_date_sort DESC,
       s.sets_id DESC;`,
    params
  );
}

/**
 * Whether there is at least one set of this exercise that its statistics page
 * would show - the same sets as the query above. One row at most, found
 * through exercise_instance_name_idx, so the exercise library can ask each
 * time a muscle view opens.
 */
export async function hasCompletedStrengthSetForExercise(db, exerciseName) {
  const row = await db.getFirstAsync(
    `SELECT 1 AS found
     FROM Exercise_Instance e
     JOIN "Set" s ON s.exercise_instance_id = e.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE e.exercise_name = ?
       AND ${COMPLETED_STRENGTH_SET_CONDITIONS}
     LIMIT 1;`,
    [exerciseName]
  );

  return Boolean(row);
}

/**
 * Every finished set's type, warm-ups included - the records query leaves
 * warm-ups out, and the statistics want to show how much of the training
 * they are. Nothing but the type, the AMRAP target and reps, and the day -
 * plus the `amrap` mirror, which is all an older app version sets on an
 * AMRAP set (resolveSetType in Utils/setTypes.js reads both).
 */
export async function getCompletedSetTypesForStatistics(db) {
  return db.getAllAsync(
    `SELECT
        COALESCE(s.set_type, 'working') AS set_type,
        s.amrap,
        s.amrap_target,
        s.reps,
        w.workout_id,
        d.date AS performed_date,
        CASE
          WHEN d.date LIKE '__.__.____'
          THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
          ELSE d.date
        END AS performed_date_sort
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
     ORDER BY performed_date_sort ASC;`
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
          MAX(CAST(s.weight AS REAL)) AS top_weight,
          -- As the session was written (4d): the panel shows it that way.
          COALESCE(e.weight_mode, 'total') AS weight_mode
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
        he.weight_mode,
        s.sets_id,
        s.set_number,
        s.reps,
        s.weight,
        s.amrap,
        s.set_type,
        s.amrap_target,
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

/**
 * The note on the previous session of this exercise, for the "last time" box.
 *
 * The previous session, not the most recent one that happens to have a note:
 * a note from three sessions back, shown as "last time", would be something
 * the person wrote about a different day. So this returns that one session
 * and the caller shows the box only when it has something in it.
 *
 * "Previous" is relative to the workout being looked at, so opening an old
 * workout shows what came before it rather than what came after.
 */
export async function getPreviousExerciseSession(
  db,
  { exerciseName, beforeWorkoutId }
) {
  const isoDateSql = (column) => `
    CASE
      WHEN ${column} LIKE '__.__.____'
      THEN substr(${column}, 7, 4) || '-' || substr(${column}, 4, 2) || '-' || substr(${column}, 1, 2)
      ELSE ${column}
    END`;

  return db.getFirstAsync(
    `WITH current_workout AS (
        SELECT ${isoDateSql("COALESCE(cd.date, cw.date)")} AS current_date_sort
        FROM Workout_Type_Instance cw
        LEFT JOIN Day cd ON cd.day_id = cw.day_id
        WHERE cw.workout_id = ?
      )
     SELECT
        e.exercise_instance_id,
        e.note,
        COALESCE(d.date, w.date) AS performed_date,
        ${isoDateSql("COALESCE(d.date, w.date)")} AS performed_date_sort
     FROM Exercise_Instance e
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     LEFT JOIN Day d ON d.day_id = w.day_id
     WHERE e.exercise_name = ? COLLATE NOCASE
       AND e.workout_type_instance_id <> ?
       AND COALESCE(w.done, 0) = 1
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND ${isoDateSql("COALESCE(d.date, w.date)")} <= COALESCE(
         (SELECT current_date_sort FROM current_workout),
         '9999-12-31'
       )
     ORDER BY performed_date_sort DESC, e.exercise_instance_id DESC
     LIMIT 1;`,
    [beforeWorkoutId ?? -1, exerciseName, beforeWorkoutId ?? -1]
  );
}

/**
 * The heaviest set ever done of an exercise, for the records shortcut.
 *
 * Only what may hold a record: working and AMRAP sets. On a tie in weight the
 * one with more reps, which is the better lift of the two.
 *
 * In the exercise's current mode (4d), `weight_mode`: a set written the other
 * way is converted first, so a switch never changes which set it is.
 */
export async function getHeaviestLiftForExercise(db, exerciseName) {
  const loggedMode = "COALESCE(e.weight_mode, 'total')";
  const currentMode = currentWeightModeSql("current_mode");

  return db.getFirstAsync(
    `WITH current_modes AS (${CURRENT_WEIGHT_MODES_SQL})
     SELECT
        ${convertWeightSql("s.weight", loggedMode, currentMode)} AS weight,
        ${currentMode} AS weight_mode,
        CAST(s.reps AS INTEGER) AS reps
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     LEFT JOIN current_modes current_mode
       ON current_mode.name_key = lower(e.exercise_name)
     WHERE e.exercise_name = ? COLLATE NOCASE
       AND s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.set_type, 'working') IN ('working', 'amrap')
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
     ORDER BY ${totalLoadSql("s.weight", loggedMode)} DESC, CAST(s.reps AS INTEGER) DESC
     LIMIT 1;`,
    [exerciseName]
  );
}

/**
 * The last set already logged against this exercise instance, so the next one
 * can start from it instead of from four empty fields.
 */
// A warm-up is not where the work left off, so neither of these copies one:
// a set added after two warm-ups starts empty rather than at warm-up weight.
export async function getLastSetValuesForExercise(db, exerciseId) {
  return db.getFirstAsync(
    `SELECT pause, reps, weight
     FROM "Set"
     WHERE exercise_instance_id = ?
       AND COALESCE(deleted_at, '') = ''
       AND COALESCE(set_type, 'working') <> 'warmup'
     ORDER BY set_number DESC, sets_id DESC
     LIMIT 1;`,
    [exerciseId]
  );
}

/**
 * The last set of the last time this exercise was done, by name, in any earlier
 * workout. Seeds the first set of a newly added exercise.
 *
 * Not restricted to completed sets. Somebody who wrote down 80 kg for 8 and
 * never ticked the box still lifted 80 for 8, and reaching further back for a
 * "done" set would offer weights older than the ones they are working from.
 * A row with nothing in it is skipped, which is what the last condition does.
 */
export async function getLastSetValuesForExerciseName(
  db,
  { exerciseName, excludeExerciseId = null }
) {
  return db.getFirstAsync(
    `SELECT
        s.pause,
        s.reps,
        s.weight,
        -- How that weight was written (4d), so the new exercise can carry it
        -- over in its own mode.
        COALESCE(e.weight_mode, 'total') AS weight_mode,
        CASE
          WHEN COALESCE(d.date, w.date) LIKE '__.__.____'
          THEN substr(COALESCE(d.date, w.date), 7, 4) || '-' ||
               substr(COALESCE(d.date, w.date), 4, 2) || '-' ||
               substr(COALESCE(d.date, w.date), 1, 2)
          ELSE COALESCE(d.date, w.date)
        END AS performed_date_sort
     FROM Exercise_Instance e
     JOIN Workout_Type_Instance w
       ON w.workout_id = e.workout_type_instance_id
     LEFT JOIN Day d
       ON d.day_id = w.day_id
     JOIN "Set" s
       ON s.exercise_instance_id = e.exercise_instance_id
     WHERE e.exercise_name = ? COLLATE NOCASE
       AND e.exercise_instance_id <> COALESCE(?, -1)
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND COALESCE(s.set_type, 'working') <> 'warmup'
       AND (s.pause IS NOT NULL OR s.reps IS NOT NULL OR s.weight IS NOT NULL)
     ORDER BY
       performed_date_sort DESC,
       e.exercise_instance_id DESC,
       s.set_number DESC,
       s.sets_id DESC
     LIMIT 1;`,
    [exerciseName, excludeExerciseId]
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

    // The rows just went and came back as total. A catalog exercise's weight
    // mode (4d) is kept in the column preference - the part that syncs - so
    // it is put back from there.
    await db.runAsync(
      `UPDATE Exercise
       SET weight_mode = (
         SELECT p.weight_mode
         FROM Exercise_Column_Preference p
         WHERE p.exercise_name = Exercise.name COLLATE NOCASE
           AND p.weight_mode IN ('total', 'per_side')
         ORDER BY p.updated_at DESC
         LIMIT 1
       )
       WHERE COALESCE(is_custom, 0) = 0
         AND EXISTS (
           SELECT 1
           FROM Exercise_Column_Preference p
           WHERE p.exercise_name = Exercise.name COLLATE NOCASE
             AND p.weight_mode IN ('total', 'per_side')
         );`
    );
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
        weight_mode,
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
        weight_mode,
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
        p.weight_mode,
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

/**
 * `weightMode` (4d) is optional: left out or null, the stored one stays - a
 * column change says nothing about it, and a cloud row from an older app
 * does not know it.
 */
export async function upsertExerciseColumnPreference(
  db,
  {
    userId,
    cloudExerciseId = null,
    exerciseName,
    visibleColumns,
    weightMode = null,
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
        weight_mode,
        needs_sync,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, exercise_name)
      DO UPDATE SET
        cloud_exercise_id = excluded.cloud_exercise_id,
        visible_columns = excluded.visible_columns,
        weight_mode = COALESCE(
          excluded.weight_mode,
          Exercise_Column_Preference.weight_mode
        ),
        needs_sync = excluded.needs_sync,
        updated_at = excluded.updated_at;`,
    sqliteParams([
      userId,
      cloudExerciseId,
      exerciseName,
      visibleColumns,
      weightMode,
      needsSync ? 1 : 0,
      updatedAt,
    ])
  );
}

/**
 * A catalog exercise's weight mode, chosen on the card (4d), marked for
 * upload. The columns stay as they are; `visibleColumns` is only what a new
 * row starts with, since the column is required.
 */
export async function upsertExerciseWeightModePreference(
  db,
  {
    userId,
    cloudExerciseId = null,
    exerciseName,
    weightMode,
    visibleColumns,
    updatedAt = new Date().toISOString(),
  }
) {
  await db.runAsync(
    `INSERT INTO Exercise_Column_Preference (
        user_id,
        cloud_exercise_id,
        exercise_name,
        visible_columns,
        weight_mode,
        needs_sync,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, exercise_name)
      DO UPDATE SET
        cloud_exercise_id = COALESCE(
          excluded.cloud_exercise_id,
          Exercise_Column_Preference.cloud_exercise_id
        ),
        weight_mode = excluded.weight_mode,
        needs_sync = 1,
        updated_at = excluded.updated_at;`,
    sqliteParams([
      userId,
      cloudExerciseId,
      exerciseName,
      visibleColumns,
      weightMode,
      updatedAt,
    ])
  );
}

/**
 * The exercise's own current mode, which the next workout copies (4d). A
 * custom exercise's is its owner's setting and syncs through
 * public.custom_exercise, so it is marked for that upload too.
 */
export async function updateExerciseWeightMode(db, { exerciseName, weightMode }) {
  await db.runAsync(
    `UPDATE Exercise
     SET weight_mode = ?,
         custom_needs_upload = CASE
           WHEN COALESCE(is_custom, 0) = 1 AND weight_mode IS NOT ? THEN 1
           ELSE custom_needs_upload
         END
     WHERE name = ? COLLATE NOCASE;`,
    sqliteParams([weightMode, weightMode, exerciseName])
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

/** The exercise names this user has starred, lower-cased for lookup. */
export async function getExerciseFavouriteNames(db, userId) {
  const rows = await db.getAllAsync(
    `SELECT exercise_name
     FROM Exercise_Favourite
     WHERE user_id = ?
       AND is_favourite = 1
     ORDER BY exercise_name COLLATE NOCASE ASC;`,
    [userId]
  );

  return rows.map((row) => row.exercise_name);
}

export async function getDirtyExerciseFavourites(db, userId) {
  return db.getAllAsync(
    `SELECT
        f.exercise_favourite_id,
        f.user_id,
        COALESCE(f.cloud_exercise_id, e.cloud_exercise_id) AS cloud_exercise_id,
        f.exercise_name,
        f.is_favourite,
        f.updated_at
     FROM Exercise_Favourite f
     LEFT JOIN Exercise e
       ON e.name = f.exercise_name COLLATE NOCASE
     WHERE f.user_id = ?
       AND f.needs_sync = 1
     ORDER BY f.updated_at ASC, f.exercise_favourite_id ASC;`,
    [userId]
  );
}

export async function upsertExerciseFavourite(
  db,
  {
    userId,
    cloudExerciseId = null,
    exerciseName,
    isFavourite,
    needsSync = 1,
    updatedAt = new Date().toISOString(),
  }
) {
  await db.runAsync(
    `INSERT INTO Exercise_Favourite (
        user_id,
        cloud_exercise_id,
        exercise_name,
        is_favourite,
        needs_sync,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, exercise_name)
      DO UPDATE SET
        cloud_exercise_id = COALESCE(
          excluded.cloud_exercise_id,
          Exercise_Favourite.cloud_exercise_id
        ),
        is_favourite = excluded.is_favourite,
        needs_sync = excluded.needs_sync,
        updated_at = excluded.updated_at;`,
    [
      userId,
      cloudExerciseId,
      exerciseName,
      isFavourite ? 1 : 0,
      needsSync ? 1 : 0,
      updatedAt,
    ]
  );
}

export async function markExerciseFavouriteSynced(
  db,
  { userId, exerciseName, updatedAt = null }
) {
  const params = [userId, exerciseName];
  const updatedAtFilter = updatedAt ? "AND updated_at = ?" : "";

  if (updatedAt) {
    params.push(updatedAt);
  }

  await db.runAsync(
    `UPDATE Exercise_Favourite
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
        ei.weight_mode,
        e.cloud_exercise_id,
        e.default_visible_columns,
        -- What decides whether the card offers per side (4d).
        e.weight_mode AS exercise_weight_mode,
        e.equipment AS exercise_equipment
     FROM Exercise_Instance ei
     LEFT JOIN Exercise e
       ON e.name = ei.exercise_name COLLATE NOCASE
     WHERE ei.workout_type_instance_id = ?
     ORDER BY ei.exercise_order ASC, ei.exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getWorkoutClassificationExercises(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        ei.exercise_instance_id,
        ei.exercise_name,
        ei.sets AS planned_set_count,
        COUNT(s.sets_id) AS actual_set_count,
        e.cloud_exercise_id,
        e.official,
        e.is_custom,
        e.custom_muscle_group_keys
     FROM Exercise_Instance ei
     LEFT JOIN "Set" s
       ON s.exercise_instance_id = ei.exercise_instance_id
      AND s.deleted_at IS NULL
     LEFT JOIN Exercise e
       ON e.name = ei.exercise_name COLLATE NOCASE
     WHERE ei.workout_type_instance_id = ?
       AND ei.deleted_at IS NULL
     GROUP BY
        ei.exercise_instance_id,
        ei.exercise_name,
        ei.sets,
        e.cloud_exercise_id,
        e.official,
        e.is_custom,
        e.custom_muscle_group_keys
     ORDER BY ei.exercise_order ASC, ei.exercise_instance_id ASC;`,
    [workoutId]
  );
}

export async function getProgramMuscleLoadExercises(db, programId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        COALESCE(mc.microcycle_id, d.day_id) AS muscle_load_week_id,
        ei.exercise_instance_id,
        ei.exercise_name,
        ei.sets AS planned_set_count,
        COUNT(s.sets_id) AS actual_set_count,
        e.cloud_exercise_id,
        e.official,
        e.is_custom,
        e.custom_muscle_group_keys
     FROM Exercise_Instance ei
     JOIN Workout_Type_Instance w
       ON w.workout_id = ei.workout_type_instance_id
     JOIN Day d
       ON d.day_id = w.day_id
     LEFT JOIN Microcycle mc
       ON mc.microcycle_id = d.microcycle_id
     LEFT JOIN Mesocycle m
       ON m.mesocycle_id = mc.mesocycle_id
     LEFT JOIN "Set" s
       ON s.exercise_instance_id = ei.exercise_instance_id
      AND COALESCE(s.deleted_at, '') = ''
     LEFT JOIN Exercise e
       ON e.name = ei.exercise_name COLLATE NOCASE
     WHERE d.program_id = ?
       AND COALESCE(ei.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND COALESCE(mc.deleted_at, '') = ''
       AND COALESCE(m.deleted_at, '') = ''
     GROUP BY
        COALESCE(mc.microcycle_id, d.day_id),
        ei.exercise_instance_id,
        ei.exercise_name,
        ei.sets,
        e.cloud_exercise_id,
        e.official,
        e.is_custom,
        e.custom_muscle_group_keys
     ORDER BY
        COALESCE(m.mesocycle_number, 0) ASC,
        COALESCE(mc.microcycle_number, 0) ASC,
        d.day_id ASC,
        w.workout_id ASC,
        ei.exercise_order ASC,
        ei.exercise_instance_id ASC;`,
    [programId]
  );
}

export async function getProgramMuscleLoadWeekCount(db, programId) {
  return db.getFirstAsync(
    `SELECT
        CASE
          WHEN COUNT(DISTINCT mc.microcycle_id) > 0
          THEN COUNT(DISTINCT mc.microcycle_id)
          ELSE (COUNT(DISTINCT d.day_id) + 6) / 7
        END AS week_count
     FROM Day d
     LEFT JOIN Microcycle mc
       ON mc.microcycle_id = d.microcycle_id
     LEFT JOIN Mesocycle m
       ON m.mesocycle_id = mc.mesocycle_id
     WHERE d.program_id = ?
       AND COALESCE(d.deleted_at, '') = ''
       AND COALESCE(mc.deleted_at, '') = ''
       AND COALESCE(m.deleted_at, '') = '';`,
    [programId]
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

// The plural form, so a screen showing many workouts asks once rather than
// once per workout. workout_type_instance_id comes back so the caller can
// group the rows again.
export async function getExerciseSummariesByWorkoutIds(db, workoutIds) {
  if (!workoutIds.length) {
    return [];
  }

  await ensureExerciseOrderColumn(db);

  const placeholders = workoutIds.map(() => "?").join(", ");

  return db.getAllAsync(
    `SELECT workout_type_instance_id, exercise_name, sets
     FROM Exercise_Instance
     WHERE workout_type_instance_id IN (${placeholders})
     ORDER BY exercise_order ASC, exercise_instance_id ASC;`,
    workoutIds
  );
}

/** Every exercise of a workout, with what the cloud knows it by. */
export async function getExerciseSyncMetadataByWorkout(db, workoutId) {
  return db.getAllAsync(
    `SELECT
        exercise_instance_id,
        cloud_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        sync_id,
        sync_version
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?;`,
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

/**
 * The running workout as the Quick start panel on Home and the lock-screen
 * card read it: every exercise in the workout screen's order with each of its
 * sets, one row per set - and one with no set for an exercise that has none,
 * so its name is still there. Only what the two show or decide with: the
 * catalog's equipment picks the card's weight step, and the set's sync
 * version tells a tap on the card from an edit made after it.
 */
export async function getLiveWorkoutSets(db, workoutId) {
  await ensureExerciseOrderColumn(db);

  return db.getAllAsync(
    `SELECT
        e.exercise_instance_id,
        e.exercise_name,
        -- 'total' | 'per_side' (4d), for the lock-screen card's "pr. side".
        COALESCE(e.weight_mode, 'total') AS weight_mode,
        s.sets_id,
        s.set_number,
        s.reps,
        s.weight,
        s.done,
        s.failed,
        s.personal_record,
        s.set_type,
        s.amrap,
        s.amrap_target,
        s.pause,
        s.sync_version,
        -- Matched without regard to case, like every other lookup of the
        -- catalog by name, and one row at most: a join would repeat every set
        -- for two catalog names that differ only in case.
        (
          SELECT catalog.equipment
          FROM Exercise catalog
          WHERE catalog.name = e.exercise_name COLLATE NOCASE
          ORDER BY catalog.exercise_id ASC
          LIMIT 1
        ) AS exercise_equipment
     FROM Exercise_Instance e
     LEFT JOIN "Set" s ON s.exercise_instance_id = e.exercise_instance_id
     WHERE e.workout_type_instance_id = ?
     ORDER BY e.exercise_order ASC, e.exercise_instance_id ASC, s.set_number ASC, s.sets_id ASC;`,
    [workoutId]
  );
}

// Every completed, non-failed set with a weight and reps, joined to the shared
// catalog so the centre leaderboard gets the cloud exercise id. Which set is
// "best" is decided in Utils/gymUtils.js, where it can be tested.
export async function getCompletedSetsForGymLifts(db, workoutId) {
  return db.getAllAsync(
    `SELECT
        s.sets_id,
        s.sync_id,
        s.weight,
        s.reps,
        e.exercise_instance_id,
        e.exercise_name,
        catalog.cloud_exercise_id
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     LEFT JOIN Exercise catalog
       ON catalog.name = e.exercise_name COLLATE NOCASE
     WHERE e.workout_type_instance_id = ?
       AND s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       -- A leaderboard row is a public record, so it takes only what a record
       -- may: working and AMRAP sets. Heaviest-wins would usually keep a
       -- warm-up out on its own, but not on a day nothing else was done.
       AND COALESCE(s.set_type, 'working') IN ('working', 'amrap')
     ORDER BY e.exercise_instance_id ASC, s.set_number ASC, s.sets_id ASC;`,
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
        done,
        weight_mode
     FROM Exercise_Instance
     WHERE workout_type_instance_id = ?
     ORDER BY exercise_order ASC, exercise_instance_id ASC;`,
    [workoutId]
  );
}

/**
 * @param dirtyOnly Only the rows waiting to be uploaded. The upload path used
 *   to read the whole table across the bridge and drop the clean rows in JS,
 *   which on a full history is every row to find the handful that changed.
 *   Reconcile still wants them all - it matches cloud rows against local ones.
 */
export async function getExercisesForCloudSync(db, { dirtyOnly = false } = {}) {
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
        weight_mode,
        needs_sync
     FROM Exercise_Instance
     ${dirtyOnly ? "WHERE needs_sync = 1" : ""}
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
    // 'total' | 'per_side' (4d): the exercise's mode, or the copied
    // workout's. Total when the caller does not say.
    weightMode = null,
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
      weight_mode,
      needs_sync,
      sync_id,
      sync_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'total'), 1, ${SQLITE_UUID_SQL}, ?);`,
    sqliteParams([
      workoutId,
      exerciseName,
      exerciseOrder,
      sets,
      visibleColumns,
      note,
      done,
      weightMode,
      syncVersion,
    ])
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
    // Null from the cloud - an older app wrote the row - is total (4d).
    weightMode = null,
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
      weight_mode,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'total'), 0);`,
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
      weightMode,
    ])
  );
}

// Writes only while the row is still at `expectedSyncVersion`, and says whether
// it did. See updateWorkoutFromCloud in programRepository, which this mirrors.
export async function updateExerciseFromCloud(
  db,
  {
    exerciseId,
    expectedSyncVersion,
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
    // A null keeps what the phone has (4d): the cloud has no column yet, or
    // an older app wrote the row and never knew it.
    weightMode = null,
  }
) {
  if (expectedSyncVersion === undefined) {
    throw new Error("updateExerciseFromCloud needs the expectedSyncVersion it read.");
  }

  await ensureExerciseOrderColumn(db);

  const result = await db.runAsync(
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
         weight_mode = COALESCE(?, weight_mode, 'total'),
         needs_sync = 0
     WHERE exercise_instance_id = ?
       AND sync_version IS ?;`,
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
      weightMode,
      exerciseId,
      expectedSyncVersion,
    ])
  );

  return result.changes > 0;
}

// Clears needs_sync only while the row is still at `expectedSyncVersion`. See
// markWorkoutSynced in programRepository, which this mirrors.
export async function markExerciseSynced(
  db,
  {
    exerciseId,
    expectedSyncVersion,
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  if (expectedSyncVersion === undefined) {
    throw new Error("markExerciseSynced needs the expectedSyncVersion it read.");
  }

  const result = await db.runAsync(
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
     WHERE exercise_instance_id = ?
       AND sync_version IS ?;`,
    sqliteParams([
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      exerciseId,
      expectedSyncVersion,
    ])
  );

  if (result.changes > 0) {
    return;
  }

  await updateExerciseCloudIdentity(db, {
    exerciseId,
    cloudExerciseInstanceId,
    remoteLocalExerciseInstanceId,
    syncId,
  });
}

// A row waiting to upload keeps its own version and deletion: they are its
// edit's, and its upload compares them with the cloud's. See
// updateProgramCloudIdentity in programRepository.
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
         sync_version = CASE WHEN needs_sync = 1 THEN sync_version ELSE COALESCE(?, sync_version) END,
         deleted_at = CASE WHEN needs_sync = 1 THEN deleted_at ELSE COALESCE(?, deleted_at) END
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

/**
 * Everything a switch between per side and both sides (4d) starts from: the
 * workout's exercise and its mode, the exercise's own mode, and the user's
 * preference row for it, if there is one. `preferenceUserId` is the one the
 * column preferences are kept under.
 */
export async function getExerciseWeightModeContext(db, { exerciseId, preferenceUserId }) {
  return db.getFirstAsync(
    `SELECT
        ei.exercise_instance_id,
        ei.workout_type_instance_id AS workout_id,
        ei.exercise_name,
        ei.visible_columns,
        ei.weight_mode,
        e.weight_mode AS exercise_weight_mode,
        e.is_custom,
        e.cloud_exercise_id,
        e.default_visible_columns,
        p.exercise_column_preference_id AS preference_id,
        p.visible_columns AS preference_visible_columns,
        p.weight_mode AS preference_weight_mode
     FROM Exercise_Instance ei
     LEFT JOIN Exercise e
       ON e.exercise_id = (
         SELECT candidate.exercise_id
         FROM Exercise candidate
         WHERE candidate.name = ei.exercise_name COLLATE NOCASE
         ORDER BY candidate.exercise_id ASC
         LIMIT 1
       )
     LEFT JOIN Exercise_Column_Preference p
       ON p.user_id = ?
      AND p.exercise_name = ei.exercise_name COLLATE NOCASE
     WHERE ei.exercise_instance_id = ?
     LIMIT 1;`,
    sqliteParams([preferenceUserId, exerciseId])
  );
}

/** How one workout's exercise is written, marked for upload (4d). */
export async function updateExerciseInstanceWeightMode(db, { exerciseId, weightMode }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Exercise_Instance
     SET weight_mode = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE exercise_instance_id = ?;`,
    sqliteParams([weightMode, syncVersion, exerciseId])
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
    setType = null,
    amrapTarget = null,
    note = null,
  }
) {
  // set_type is the truth and amrap its mirror. A caller that only knows the
  // old flag - a copy, an import - still gets a correct type from it.
  const resolvedType = resolveSetType({ set_type: setType, amrap });
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
      set_type,
      amrap_target,
      note,
      needs_sync
    ) VALUES (?, ?, ${SQLITE_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
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
      amrapFlagFor(resolvedType),
      resolvedType,
      resolvedType === "amrap" ? amrapTarget : null,
      note,
    ]
  );
}

/**
 * @param dirtyOnly Only the rows waiting to be uploaded. The upload path used
 *   to read the whole table across the bridge and drop the clean rows in JS,
 *   which on a full history is every row to find the handful that changed.
 *   Reconcile still wants them all - it matches cloud rows against local ones.
 */
export async function getSetsForCloudSync(db, { dirtyOnly = false } = {}) {
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
        set_type,
        amrap_target,
        note,
        needs_sync
     FROM "Set"
     ${dirtyOnly ? "WHERE needs_sync = 1" : ""}
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
    setType,
    amrapTarget,
    note,
  }
) {
  const resolvedType = resolveSetType({ set_type: setType, amrap });
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
      set_type,
      amrap_target,
      note,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
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
      amrapFlagFor(resolvedType),
      resolvedType,
      resolvedType === "amrap" ? amrapTarget ?? null : null,
      note,
    ])
  );
}

// Writes only while the row is still at `expectedSyncVersion`, and says whether
// it did. See updateWorkoutFromCloud in programRepository, which this mirrors.
export async function updateSetFromCloud(
  db,
  {
    setId,
    expectedSyncVersion,
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
    setType,
    amrapTarget,
    note,
  }
) {
  if (expectedSyncVersion === undefined) {
    throw new Error("updateSetFromCloud needs the expectedSyncVersion it read.");
  }

  const resolvedType = resolveSetType({ set_type: setType, amrap });
  const result = await db.runAsync(
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
         set_type = ?,
         amrap_target = ?,
         note = ?,
         needs_sync = 0
     WHERE sets_id = ?
       AND sync_version IS ?;`,
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
      amrapFlagFor(resolvedType),
      resolvedType,
      resolvedType === "amrap" ? amrapTarget ?? null : null,
      note,
      setId,
      expectedSyncVersion,
    ])
  );

  return result.changes > 0;
}

// Clears needs_sync only while the row is still at `expectedSyncVersion`. See
// markWorkoutSynced in programRepository, which this mirrors.
export async function markSetSynced(
  db,
  {
    setId,
    expectedSyncVersion,
    cloudSetId,
    remoteLocalSetId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  if (expectedSyncVersion === undefined) {
    throw new Error("markSetSynced needs the expectedSyncVersion it read.");
  }

  const result = await db.runAsync(
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
     WHERE sets_id = ?
       AND sync_version IS ?;`,
    sqliteParams([
      cloudSetId,
      remoteLocalSetId,
      syncId,
      syncVersion,
      deletedAt,
      setId,
      expectedSyncVersion,
    ])
  );

  if (result.changes > 0) {
    return;
  }

  await updateSetCloudIdentity(db, {
    setId,
    cloudSetId,
    remoteLocalSetId,
    syncId,
  });
}

// A row waiting to upload keeps its own version and deletion. See
// updateProgramCloudIdentity in programRepository.
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
         sync_version = CASE WHEN needs_sync = 1 THEN sync_version ELSE COALESCE(?, sync_version) END,
         deleted_at = CASE WHEN needs_sync = 1 THEN deleted_at ELSE COALESCE(?, deleted_at) END
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

/**
 * Queues a set to be uploaded again, unchanged. Sync bookkeeping, not an edit:
 * no new sync_version, so it is the same edit sent once more, and the cloud
 * ids stay so it updates its own row. The set sync uses it when the cloud
 * holds a set's weight or RPE cut off from before the column kept decimals
 * (resolveCloudSetDecimals in Utils/setDecimals.js).
 */
export async function markSetForUpload(db, { setId }) {
  await db.runAsync(
    `UPDATE "Set"
     SET needs_sync = 1
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

/**
 * A set's type, with its mirror and its target in the same statement.
 *
 * Separate from updateSetField on purpose. That one writes a single column,
 * and set_type and amrap written apart are two truths the moment one of them
 * changes alone. The target only means anything on an AMRAP set, so it is
 * cleared whenever the set becomes anything else.
 *
 * `clearUnfinishedLoad` empties reps, weight and 1RM % in the same statement,
 * but only on a set that is not ticked off: an unticked set's numbers were
 * copied forward from the set above, a ticked one's are what was lifted.
 */
export async function updateSetType(
  db,
  { setId, setType, amrapTarget = null, clearUnfinishedLoad = false }
) {
  const resolvedType = normalizeSetType(setType);
  const syncVersion = createNextSyncVersion();
  const clear = clearUnfinishedLoad ? 1 : 0;

  await db.runAsync(
    `UPDATE "Set"
     SET set_type = ?,
         amrap = ?,
         amrap_target = ?,
         reps = CASE WHEN ? = 1 AND COALESCE(done, 0) <> 1 THEN NULL ELSE reps END,
         weight = CASE WHEN ? = 1 AND COALESCE(done, 0) <> 1 THEN NULL ELSE weight END,
         rm_percentage = CASE WHEN ? = 1 AND COALESCE(done, 0) <> 1 THEN NULL ELSE rm_percentage END,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sets_id = ?;`,
    [
      resolvedType,
      amrapFlagFor(resolvedType),
      resolvedType === "amrap" ? amrapTarget : null,
      clear,
      clear,
      clear,
      syncVersion,
      setId,
    ]
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
    `SELECT set_number, exercise_instance_id, pause, rpe, weight, rm_percentage, reps, done, failed, amrap, set_type, amrap_target, note
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
    setType = null,
    amrapTarget = null,
    note,
  }
) {
  // Written together, or the flag and the type disagree the moment either
  // changes on its own.
  const resolvedType = resolveSetType({ set_type: setType, amrap });
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
         set_type = ?,
         amrap_target = ?,
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
      amrapFlagFor(resolvedType),
      resolvedType,
      resolvedType === "amrap" ? amrapTarget : null,
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

/**
 * Finished strength workouts with the exercises they contained, for the split
 * guess on Home.
 *
 * One row per workout. The exercises come back as a lowercased,
 * newline-separated list rather than a join, because the caller compares whole
 * sets of them against each other and a row per exercise would mean stitching
 * them back together in JavaScript.
 *
 * The identity is the exercise name: `Exercise_Instance` carries no reference
 * to the catalog, so the name is the only thing two workouts can be compared
 * on. The design document asked for `exercise_id`; there is not one to use.
 */
export async function getCompletedStrengthWorkoutsWithExercises(
  db,
  { sinceIsoDate, workoutTypes = [], limit = 200 }
) {
  if (!workoutTypes.length) {
    return [];
  }

  const typePlaceholders = workoutTypes.map(() => "?").join(", ");
  const workoutIsoDateSql = `
    CASE
      WHEN w.date LIKE '__.__.____'
      THEN substr(w.date, 7, 4) || '-' || substr(w.date, 4, 2) || '-' || substr(w.date, 1, 2)
      ELSE w.date
    END`;

  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.label,
        w.workout_type,
        ${workoutIsoDateSql} AS performed_date_sort,
        COUNT(DISTINCT e.exercise_instance_id) AS exercise_count,
        COALESCE(SUM(e.sets), 0) AS set_count,
        group_concat(DISTINCT lower(trim(e.exercise_name))) AS exercise_names
     FROM Workout_Type_Instance w
     JOIN Exercise_Instance e ON e.workout_type_instance_id = w.workout_id
     WHERE COALESCE(w.done, 0) = 1
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND w.workout_type IN (${typePlaceholders})
       AND ${workoutIsoDateSql} >= ?
     GROUP BY w.workout_id
     HAVING exercise_count > 0
     ORDER BY performed_date_sort DESC, w.workout_id DESC
     LIMIT ?;`,
    [...workoutTypes, sinceIsoDate, Math.max(1, Math.trunc(Number(limit) || 200))]
  );
}

/**
 * How many personal records were set on one day (`isoDate`, yyyy-mm-dd), in
 * sets that were done and not failed. The day is read in both spellings the
 * schema holds, dd.mm.yyyy and ISO, from the workout's day where it has one.
 */
export async function countPersonalRecordsOnDate(db, isoDate) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS records
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     LEFT JOIN Day d ON d.day_id = w.day_id
     WHERE COALESCE(s.personal_record, 0) = 1
       AND COALESCE(s.done, 0) = 1
       AND COALESCE(s.failed, 0) <> 1
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND (
         CASE
           WHEN COALESCE(d.date, w.date) LIKE '__.__.____'
           THEN substr(COALESCE(d.date, w.date), 7, 4) || '-' ||
                substr(COALESCE(d.date, w.date), 4, 2) || '-' ||
                substr(COALESCE(d.date, w.date), 1, 2)
           ELSE COALESCE(d.date, w.date)
         END
       ) = ?;`,
    [isoDate]
  );

  return Number(row?.records) || 0;
}

/** The most recent day any workout was finished, as an ISO date, or null. */
export async function getLastCompletedWorkoutDate(db) {
  const row = await db.getFirstAsync(
    `SELECT MAX(
        CASE
          WHEN w.date LIKE '__.__.____'
          THEN substr(w.date, 7, 4) || '-' || substr(w.date, 4, 2) || '-' || substr(w.date, 1, 2)
          ELSE w.date
        END
     ) AS last_date
     FROM Workout_Type_Instance w
     WHERE COALESCE(w.done, 0) = 1
       AND COALESCE(w.deleted_at, '') = '';`
  );

  return row?.last_date ?? null;
}

/**
 * The first day any workout was finished, as an ISO date, or null. The same
 * rows and both date spellings as getLastCompletedWorkoutDate, with one guard
 * a MAX does not need: a date in neither spelling - an empty one, say - can
 * sort before every real one, and as the first day it would read as no
 * finished workout at all, on an account with months of them.
 */
export async function getFirstCompletedWorkoutDate(db) {
  const row = await db.getFirstAsync(
    `SELECT MIN(performed_date) AS first_date
     FROM (
       SELECT
         CASE
           WHEN w.date LIKE '__.__.____'
           THEN substr(w.date, 7, 4) || '-' || substr(w.date, 4, 2) || '-' || substr(w.date, 1, 2)
           ELSE w.date
         END AS performed_date
       FROM Workout_Type_Instance w
       WHERE COALESCE(w.done, 0) = 1
         AND COALESCE(w.deleted_at, '') = ''
     )
     WHERE performed_date LIKE '____-__-__';`
  );

  return row?.first_date ?? null;
}

/**
 * Marks for upload the exercises and sets that the cloud never received.
 *
 * An exercise whose workout has a cloud id but which has none of its own was
 * skipped by an upload pass and never picked up again: the only code that
 * recovers from that sits behind `allowParentRepair`, which the pass SetSync
 * runs turns off. One skipped pass and the row stays on the device for good,
 * while its workout syncs on as an empty shell - which is what happened to
 * three months of training on at least one install.
 *
 * Returns how many rows were re-marked, so a caller can say whether there was
 * anything to repair.
 */
export async function markUnsyncedStrengthDataForRetry(db) {
  // Both cloud id columns are asked about on every level. resolveSideBySideCloudId
  // reads cloud_id first and falls back to the named column, so a row carrying
  // only one of the two is synced - and a repair that looked at one column
  // alone would re-mark half the table on every pass, forever.
  const exercises = await db.runAsync(
    `UPDATE Exercise_Instance
        SET needs_sync = 1
      WHERE needs_sync <> 1
        AND cloud_id IS NULL
        AND cloud_exercise_instance_id IS NULL
        AND COALESCE(deleted_at, '') = ''
        AND workout_type_instance_id IN (
          SELECT workout_id
          FROM Workout_Type_Instance
          WHERE (
              cloud_id IS NOT NULL
              OR cloud_workout_type_instance_id IS NOT NULL
            )
            AND COALESCE(deleted_at, '') = ''
        );`
  );

  // Same shape one level down: a set whose exercise made it up but which did
  // not. Left behind, its reps and weight are only on the device.
  const sets = await db.runAsync(
    `UPDATE "Set"
        SET needs_sync = 1
      WHERE needs_sync <> 1
        AND cloud_id IS NULL
        AND cloud_set_id IS NULL
        AND COALESCE(deleted_at, '') = ''
        AND exercise_instance_id IN (
          SELECT exercise_instance_id
          FROM Exercise_Instance
          WHERE COALESCE(deleted_at, '') = ''
        );`
  );

  return {
    exercises: exercises?.changes ?? 0,
    sets: sets?.changes ?? 0,
  };}
