// Your custom exercises on the phone: the rows in Exercise with is_custom = 1,
// and what they know about their cloud half, public.custom_exercise.
//
// Everything links to an exercise by its name (Exercise_Instance.exercise_name
// and the rest), so a custom exercise keeps the name it was created with and
// nothing here renames one. Names are looked up case-blind, the way
// getExerciseCatalogEntryByName does it.
//
// There is no owner column: the database belongs to one user. A copy of
// somebody else's exercise is a custom row with source_exercise_id set.
//
// custom_needs_upload is the dirty flag: an edit made on this phone that the
// cloud does not have yet. The writes that clear it only do so while the row
// still holds what was uploaded, so an edit made during an upload is not
// marked as sent.

const CUSTOM_EXERCISE_COLUMNS = `
  exercise_id,
  name,
  official,
  is_custom,
  custom_muscle_group_keys,
  cloud_custom_exercise_id,
  is_public,
  source_exercise_id,
  description,
  steps,
  equipment,
  weight_mode,
  video_path,
  poster_path,
  video_duration_ms,
  custom_needs_upload,
  cloud_updated_at
`;

function param(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function params(values) {
  return values.map(param);
}

/** Your custom exercise by name, or null. */
export async function getCustomExerciseByName(db, exerciseName) {
  return db.getFirstAsync(
    `SELECT ${CUSTOM_EXERCISE_COLUMNS}
     FROM Exercise
     WHERE is_custom = 1
       AND name = ? COLLATE NOCASE
     LIMIT 1;`,
    params([exerciseName])
  );
}

/** Any exercise with that name - custom or from the catalog - or null. */
export async function getExerciseByName(db, exerciseName) {
  return db.getFirstAsync(
    `SELECT ${CUSTOM_EXERCISE_COLUMNS}
     FROM Exercise
     WHERE name = ? COLLATE NOCASE
     LIMIT 1;`,
    params([exerciseName])
  );
}

/** Your copy of somebody else's exercise, by the original's cloud id. */
export async function getCustomExerciseBySourceId(db, sourceExerciseId) {
  return db.getFirstAsync(
    `SELECT ${CUSTOM_EXERCISE_COLUMNS}
     FROM Exercise
     WHERE is_custom = 1
       AND source_exercise_id = ?
     ORDER BY exercise_id ASC
     LIMIT 1;`,
    params([sourceExerciseId])
  );
}

/** The custom row linked to a cloud row, or null. */
export async function getCustomExerciseByCloudId(db, cloudCustomExerciseId) {
  return db.getFirstAsync(
    `SELECT ${CUSTOM_EXERCISE_COLUMNS}
     FROM Exercise
     WHERE is_custom = 1
       AND cloud_custom_exercise_id = ?
     LIMIT 1;`,
    params([cloudCustomExerciseId])
  );
}

/**
 * Every exercise on the phone, catalog included: the sync plans with the
 * custom ones and needs the rest to see a name that is already taken.
 */
export async function getExercisesForCustomSync(db) {
  return db.getAllAsync(
    `SELECT ${CUSTOM_EXERCISE_COLUMNS}
     FROM Exercise
     ORDER BY exercise_id ASC;`
  );
}

/**
 * A custom exercise that exists in the cloud and not on this phone: restored
 * after a reinstall, or a copy just added. `INSERT OR IGNORE`, so a name that
 * turned up in the meantime is left alone. -> whether it was inserted
 */
export async function insertCustomExerciseFromCloud(db, fields) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO Exercise (
       name,
       nickname,
       default_visible_columns,
       official,
       is_custom,
       custom_muscle_group_keys,
       cloud_custom_exercise_id,
       is_public,
       source_exercise_id,
       description,
       steps,
       equipment,
       weight_mode,
       video_path,
       poster_path,
       video_duration_ms,
       custom_needs_upload,
       cloud_updated_at
     )
     VALUES (?, NULL, NULL, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?);`,
    params([
      fields.name,
      fields.custom_muscle_group_keys,
      fields.cloud_custom_exercise_id,
      fields.is_public ? 1 : 0,
      fields.source_exercise_id,
      fields.description,
      fields.steps,
      fields.equipment,
      fields.weight_mode ?? "total",
      fields.video_path,
      fields.poster_path,
      fields.video_duration_ms,
      fields.cloud_updated_at,
    ])
  );

  return Number(result?.changes ?? 0) > 0;
}

/** Points a custom row at its cloud row, without touching its content. */
export async function linkCustomExerciseToCloud(
  db,
  { exerciseName, cloudId, cloudUpdatedAt = null }
) {
  await db.runAsync(
    `UPDATE Exercise
     SET cloud_custom_exercise_id = ?,
         cloud_updated_at = COALESCE(?, cloud_updated_at)
     WHERE is_custom = 1
       AND name = ?;`,
    params([cloudId, cloudUpdatedAt, exerciseName])
  );
}

/** Forgets a cloud id the cloud no longer has, so the next sync uploads it again. */
export async function clearCustomExerciseCloudId(db, exerciseName) {
  await db.runAsync(
    `UPDATE Exercise
     SET cloud_custom_exercise_id = NULL,
         cloud_updated_at = NULL
     WHERE is_custom = 1
       AND name = ?;`,
    params([exerciseName])
  );
}

/**
 * After an upload of `uploadedRow` (the row as it was read before the
 * upload): the cloud id and its updated_at, and the dirty flag cleared - but
 * only if the content is still what was uploaded.
 */
export async function markCustomExerciseUploaded(
  db,
  { uploadedRow, cloudId, cloudUpdatedAt = null }
) {
  await db.runAsync(
    `UPDATE Exercise
     SET cloud_custom_exercise_id = ?,
         cloud_updated_at = COALESCE(?, cloud_updated_at),
         custom_needs_upload = CASE
           WHEN description IS ?
            AND steps IS ?
            AND equipment IS ?
            AND weight_mode IS ?
            AND custom_muscle_group_keys IS ?
           THEN 0
           ELSE custom_needs_upload
         END
     WHERE is_custom = 1
       AND name = ?;`,
    params([
      cloudId,
      cloudUpdatedAt,
      uploadedRow.description,
      uploadedRow.steps,
      uploadedRow.equipment,
      uploadedRow.weight_mode,
      uploadedRow.custom_muscle_group_keys,
      uploadedRow.name,
    ])
  );
}

/**
 * What the owner edits on the phone: saved here at once and marked for
 * upload. `steps` arrives JSON-encoded.
 */
export async function updateCustomExerciseDetails(
  db,
  exerciseName,
  { description, steps, equipment, weightMode }
) {
  await db.runAsync(
    `UPDATE Exercise
     SET description = ?,
         steps = ?,
         equipment = ?,
         weight_mode = ?,
         custom_needs_upload = 1
     WHERE is_custom = 1
       AND name = ?;`,
    params([description, steps, equipment, weightMode ?? "total", exerciseName])
  );
}

/**
 * The cloud's version of a custom exercise, taken over a clean row - never
 * over an edit this phone has not uploaded yet.
 */
export async function applyCloudCustomExercise(db, exerciseName, fields) {
  const result = await db.runAsync(
    `UPDATE Exercise
     SET custom_muscle_group_keys = ?,
         cloud_custom_exercise_id = ?,
         is_public = ?,
         source_exercise_id = ?,
         description = ?,
         steps = ?,
         equipment = ?,
         weight_mode = ?,
         video_path = ?,
         poster_path = ?,
         video_duration_ms = ?,
         cloud_updated_at = ?
     WHERE is_custom = 1
       AND name = ?
       AND COALESCE(custom_needs_upload, 0) = 0;`,
    params([
      fields.custom_muscle_group_keys,
      fields.cloud_custom_exercise_id,
      fields.is_public ? 1 : 0,
      fields.source_exercise_id,
      fields.description,
      fields.steps,
      fields.equipment,
      fields.weight_mode ?? "total",
      fields.video_path,
      fields.poster_path,
      fields.video_duration_ms,
      fields.cloud_updated_at,
      exerciseName,
    ])
  );

  return Number(result?.changes ?? 0) > 0;
}

/** Shared or not, as the cloud now has it. */
export async function setCustomExercisePublicState(
  db,
  { exerciseName, isPublic, cloudUpdatedAt = null }
) {
  await db.runAsync(
    `UPDATE Exercise
     SET is_public = ?,
         cloud_updated_at = COALESCE(?, cloud_updated_at)
     WHERE is_custom = 1
       AND name = ?;`,
    params([isPublic ? 1 : 0, cloudUpdatedAt, exerciseName])
  );
}

/** The clip and its poster, as the cloud now has them - or none. */
export async function setCustomExerciseVideo(
  db,
  { exerciseName, videoPath = null, posterPath = null, videoDurationMs = null, cloudUpdatedAt = null }
) {
  await db.runAsync(
    `UPDATE Exercise
     SET video_path = ?,
         poster_path = ?,
         video_duration_ms = ?,
         cloud_updated_at = COALESCE(?, cloud_updated_at)
     WHERE is_custom = 1
       AND name = ?;`,
    params([videoPath, posterPath, videoDurationMs, cloudUpdatedAt, exerciseName])
  );
}
