import { createNextSyncVersion, SQLITE_UUID_SQL } from "../Utils/syncUtils";
import { normalizeIsoDateString } from "../Utils/dateUtils";

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

function workoutDisplayLabelSql(workoutAlias = "w", workoutTypeAlias = "wt") {
  return `COALESCE(
    NULLIF(${workoutAlias}.label, ${workoutAlias}.workout_type),
    NULLIF(${workoutTypeAlias}.display_name, ''),
    ${workoutAlias}.label,
    ${workoutAlias}.workout_type
  )`;
}

function localDateToIsoSql(dateExpression) {
  return `CASE
    WHEN ${dateExpression} LIKE '__.__.____'
    THEN substr(${dateExpression}, 7, 4) || '-' ||
         substr(${dateExpression}, 4, 2) || '-' ||
         substr(${dateExpression}, 1, 2)
    ELSE ${dateExpression}
  END`;
}

function localDateToIsoValue(value) {
  return normalizeIsoDateString(value) ?? value;
}

function workoutHasPersonalRecordSql(workoutAlias = "w") {
  return `EXISTS (
    SELECT 1
    FROM Exercise_Instance pr_e
    JOIN "Set" pr_s ON pr_s.exercise_instance_id = pr_e.exercise_instance_id
    WHERE pr_e.workout_type_instance_id = ${workoutAlias}.workout_id
      AND COALESCE(pr_s.personal_record, 0) = 1
      AND COALESCE(pr_s.done, 0) = 1
      AND COALESCE(pr_s.failed, 0) = 0
      AND COALESCE(pr_e.deleted_at, '') = ''
      AND COALESCE(pr_s.deleted_at, '') = ''
  )`;
}

export async function createProgram(db, { programName, startDate, status }) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Program (
      program_name,
      start_date,
      status,
      sync_id,
      sync_version
    )
     VALUES (?, ?, ?, ${SQLITE_UUID_SQL}, ?);`,
    [programName, startDate, status, syncVersion]
  );
}

export async function getAppMetadataValue(db, metadataKey) {
  const row = await db.getFirstAsync(
    `SELECT metadata_value
     FROM App_Metadata
     WHERE metadata_key = ?;`,
    [metadataKey]
  );

  return row?.metadata_value ?? null;
}

export async function setAppMetadataValue(db, metadataKey, metadataValue) {
  return db.runAsync(
    `INSERT INTO App_Metadata (metadata_key, metadata_value)
     VALUES (?, ?)
     ON CONFLICT(metadata_key)
     DO UPDATE SET metadata_value = excluded.metadata_value;`,
    [metadataKey, metadataValue]
  );
}

export async function getProgramsForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        program_id,
        cloud_id,
        cloud_program_id,
        remote_local_program_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        program_name,
        start_date,
        status,
        needs_sync
     FROM Program
     ORDER BY program_id ASC;`
  );
}

export async function createProgramFromCloud(
  db,
  {
    cloudProgramId,
    remoteLocalProgramId,
    syncId,
    syncVersion,
    deletedAt,
    programName,
    startDate,
    status,
  }
) {
  return db.runAsync(
    `INSERT INTO Program (
      cloud_program_id,
      remote_local_program_id,
      sync_id,
      sync_version,
      deleted_at,
      program_name,
      start_date,
      status,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      cloudProgramId,
      remoteLocalProgramId,
      syncId,
      syncVersion,
      deletedAt,
      programName,
      startDate,
      status,
    ]
  );
}

export async function updateProgramFromCloud(
  db,
  {
    programId,
    cloudProgramId,
    remoteLocalProgramId,
    syncId,
    syncVersion,
    deletedAt,
    programName,
    startDate,
    status,
  }
) {
  await db.runAsync(
    `UPDATE Program
     SET cloud_program_id = ?,
         remote_local_program_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         program_name = ?,
         start_date = ?,
         status = ?,
         needs_sync = 0
     WHERE program_id = ?;`,
    [
      cloudProgramId,
      remoteLocalProgramId,
      syncId,
      syncVersion,
      deletedAt,
      programName,
      startDate,
      status,
      programId,
    ]
  );
}

export async function markProgramSynced(
  db,
  {
    programId,
    cloudProgramId,
    remoteLocalProgramId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Program
     SET cloud_program_id = ?,
         remote_local_program_id = COALESCE(?, remote_local_program_id, program_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE program_id = ?;`,
    [
      cloudProgramId,
      remoteLocalProgramId,
      syncId,
      syncVersion,
      deletedAt,
      programId,
    ]
  );
}

export async function updateProgramCloudIdentity(
  db,
  {
    programId,
    cloudProgramId,
    remoteLocalProgramId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Program
     SET cloud_program_id = ?,
         remote_local_program_id = COALESCE(?, remote_local_program_id, program_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE program_id = ?;`,
    [
      cloudProgramId,
      remoteLocalProgramId,
      syncId,
      syncVersion,
      deletedAt,
      programId,
    ]
  );
}

export async function markProgramForCloudResync(db, { programId }) {
  await db.runAsync(
    `UPDATE Program
     SET cloud_id = NULL,
         cloud_program_id = NULL,
         needs_sync = 1
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getProgramSyncMetadata(db, programId) {
  return db.getFirstAsync(
    `SELECT
        program_id,
        cloud_id,
        cloud_program_id,
        remote_local_program_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Program
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getMesocyclesForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        mesocycle_id,
        cloud_id,
        cloud_mesocycle_id,
        remote_local_mesocycle_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        program_id,
        mesocycle_number,
        weeks,
        focus,
        done,
        needs_sync
     FROM Mesocycle
     ORDER BY mesocycle_id ASC;`
  );
}

export async function createMesocycleFromCloud(
  db,
  {
    localMesocycleId,
    cloudMesocycleId,
    remoteLocalMesocycleId,
    syncId,
    syncVersion,
    deletedAt,
    programId,
    mesocycleNumber,
    weeks,
    focus,
    done,
  }
) {
  return db.runAsync(
    `INSERT INTO Mesocycle (
      mesocycle_id,
      cloud_mesocycle_id,
      remote_local_mesocycle_id,
      sync_id,
      sync_version,
      deleted_at,
      program_id,
      mesocycle_number,
      weeks,
      focus,
      done,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      localMesocycleId,
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId,
      syncVersion,
      deletedAt,
      programId,
      mesocycleNumber,
      weeks,
      focus,
      done ? 1 : 0,
    ]
  );
}

export async function updateMesocycleFromCloud(
  db,
  {
    mesocycleId,
    cloudMesocycleId,
    remoteLocalMesocycleId,
    syncId,
    syncVersion,
    deletedAt,
    programId,
    mesocycleNumber,
    weeks,
    focus,
    done,
  }
) {
  await db.runAsync(
    `UPDATE Mesocycle
     SET cloud_mesocycle_id = ?,
         remote_local_mesocycle_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         program_id = ?,
         mesocycle_number = ?,
         weeks = ?,
         focus = ?,
         done = ?,
         needs_sync = 0
     WHERE mesocycle_id = ?;`,
    [
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId,
      syncVersion,
      deletedAt,
      programId,
      mesocycleNumber,
      weeks,
      focus,
      done ? 1 : 0,
      mesocycleId,
    ]
  );
}

export async function markMesocycleSynced(
  db,
  {
    mesocycleId,
    cloudMesocycleId,
    remoteLocalMesocycleId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Mesocycle
     SET cloud_mesocycle_id = ?,
         remote_local_mesocycle_id = COALESCE(?, remote_local_mesocycle_id, mesocycle_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE mesocycle_id = ?;`,
    [
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId,
      syncVersion,
      deletedAt,
      mesocycleId,
    ]
  );
}

export async function updateMesocycleCloudIdentity(
  db,
  {
    mesocycleId,
    cloudMesocycleId,
    remoteLocalMesocycleId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Mesocycle
     SET cloud_mesocycle_id = ?,
         remote_local_mesocycle_id = COALESCE(?, remote_local_mesocycle_id, mesocycle_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE mesocycle_id = ?;`,
    [
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId,
      syncVersion,
      deletedAt,
      mesocycleId,
    ]
  );
}

export async function markMesocycleForCloudResync(db, { mesocycleId }) {
  await db.runAsync(
    `UPDATE Mesocycle
     SET cloud_id = NULL,
         cloud_mesocycle_id = NULL,
         needs_sync = 1
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function getMesocycleSyncMetadata(db, mesocycleId) {
  return db.getFirstAsync(
    `SELECT
        mesocycle_id,
        cloud_id,
        cloud_mesocycle_id,
        remote_local_mesocycle_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Mesocycle
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function getMicrocyclesForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        microcycle_id,
        cloud_id,
        cloud_microcycle_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        mesocycle_id,
        microcycle_number,
        focus,
        done,
        needs_sync
     FROM Microcycle
     ORDER BY microcycle_id ASC;`
  );
}

export async function createMicrocycleFromCloud(
  db,
  {
    localMicrocycleId,
    cloudMicrocycleId,
    syncId,
    syncVersion,
    deletedAt,
    mesocycleId,
    microcycleNumber,
    focus,
    done,
  }
) {
  return db.runAsync(
    `INSERT INTO Microcycle (
      microcycle_id,
      cloud_microcycle_id,
      sync_id,
      sync_version,
      deleted_at,
      mesocycle_id,
      microcycle_number,
      focus,
      done,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      localMicrocycleId,
      cloudMicrocycleId,
      syncId,
      syncVersion,
      deletedAt,
      mesocycleId,
      microcycleNumber,
      focus,
      done ? 1 : 0,
    ]
  );
}

export async function updateMicrocycleFromCloud(
  db,
  {
    microcycleId,
    cloudMicrocycleId,
    syncId,
    syncVersion,
    deletedAt,
    mesocycleId,
    microcycleNumber,
    focus,
    done,
  }
) {
  await db.runAsync(
    `UPDATE Microcycle
     SET cloud_microcycle_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         mesocycle_id = ?,
         microcycle_number = ?,
         focus = ?,
         done = ?,
         needs_sync = 0
     WHERE microcycle_id = ?;`,
    [
      cloudMicrocycleId,
      syncId,
      syncVersion,
      deletedAt,
      mesocycleId,
      microcycleNumber,
      focus,
      done ? 1 : 0,
      microcycleId,
    ]
  );
}

export async function markMicrocycleSynced(
  db,
  { microcycleId, cloudMicrocycleId, syncId = null, syncVersion = null, deletedAt = null }
) {
  await db.runAsync(
    `UPDATE Microcycle
     SET cloud_microcycle_id = ?,
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE microcycle_id = ?;`,
    [cloudMicrocycleId, syncId, syncVersion, deletedAt, microcycleId]
  );
}

export async function updateMicrocycleCloudIdentity(
  db,
  { microcycleId, cloudMicrocycleId, syncId = null, syncVersion = null, deletedAt = null }
) {
  await db.runAsync(
    `UPDATE Microcycle
     SET cloud_microcycle_id = ?,
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE microcycle_id = ?;`,
    [cloudMicrocycleId, syncId, syncVersion, deletedAt, microcycleId]
  );
}

export async function markMicrocycleForCloudResync(db, { microcycleId }) {
  await db.runAsync(
    `UPDATE Microcycle
     SET cloud_id = NULL,
         cloud_microcycle_id = NULL,
         needs_sync = 1
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getMicrocycleSyncMetadata(db, microcycleId) {
  return db.getFirstAsync(
    `SELECT
        microcycle_id,
        cloud_id,
        cloud_microcycle_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Microcycle
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getQueuedMicrocycleDeletes(db) {
  return db.getAllAsync(
    `SELECT
        microcycle_sync_delete_id,
        cloud_microcycle_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Microcycle_Sync_Delete
     ORDER BY microcycle_sync_delete_id ASC;`
  );
}

export async function queueMicrocycleDeleteSync(
  db,
  { cloudMicrocycleId, syncId = null, syncVersion = 0, deletedAt }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Microcycle_Sync_Delete (
      cloud_microcycle_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?);`,
    [cloudMicrocycleId, syncId, syncVersion, deletedAt]
  );
}

export async function deleteQueuedMicrocycleDelete(db, queueId) {
  await db.runAsync(
    `DELETE FROM Microcycle_Sync_Delete
     WHERE microcycle_sync_delete_id = ?;`,
    [queueId]
  );
}

export async function getQueuedMesocycleDeletes(db) {
  return db.getAllAsync(
    `SELECT
        mesocycle_sync_delete_id,
        cloud_mesocycle_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Mesocycle_Sync_Delete
     ORDER BY mesocycle_sync_delete_id ASC;`
  );
}

export async function queueMesocycleDeleteSync(
  db,
  { cloudMesocycleId, syncId = null, syncVersion = 0, deletedAt }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Mesocycle_Sync_Delete (
      cloud_mesocycle_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?);`,
    [cloudMesocycleId, syncId, syncVersion, deletedAt]
  );
}

export async function deleteQueuedMesocycleDelete(db, queueId) {
  await db.runAsync(
    `DELETE FROM Mesocycle_Sync_Delete
     WHERE mesocycle_sync_delete_id = ?;`,
    [queueId]
  );
}

export async function getQueuedProgramDeletes(db) {
  return db.getAllAsync(
    `SELECT
        program_sync_delete_id,
        cloud_program_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Program_Sync_Delete
     ORDER BY program_sync_delete_id ASC;`
  );
}

export async function queueProgramDeleteSync(
  db,
  { cloudProgramId, syncId = null, syncVersion = 0, deletedAt }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Program_Sync_Delete (
      cloud_program_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?);`,
    [cloudProgramId, syncId, syncVersion, deletedAt]
  );
}

export async function deleteQueuedProgramDelete(db, queueId) {
  await db.runAsync(
    `DELETE FROM Program_Sync_Delete
     WHERE program_sync_delete_id = ?;`,
    [queueId]
  );
}

export async function getProgramsOverview(db) {
  return db.getAllAsync(
    `SELECT
        p.program_id,
        p.program_name,
        p.start_date,
        p.status,
        COALESCE(mesocycles.mesocycle_count, 0) AS mesocycle_count,
        COALESCE(microcycles.week_count, 0) AS week_count,
        COALESCE(days.day_count, 0) AS day_count,
        COALESCE(workouts.workout_count, 0) AS workout_count,
        COALESCE(workouts.completed_workout_count, 0) AS completed_workout_count,
        workouts.workout_types
     FROM Program p
     LEFT JOIN (
        SELECT
          program_id,
          COUNT(*) AS mesocycle_count
        FROM Mesocycle
        GROUP BY program_id
     ) mesocycles
       ON mesocycles.program_id = p.program_id
     LEFT JOIN (
        SELECT
          m.program_id,
          COUNT(*) AS week_count
        FROM Microcycle mc
        JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
        GROUP BY m.program_id
     ) microcycles
       ON microcycles.program_id = p.program_id
     LEFT JOIN (
        SELECT
          program_id,
          COUNT(*) AS day_count
        FROM Day
        GROUP BY program_id
     ) days
       ON days.program_id = p.program_id
     LEFT JOIN (
        SELECT
          d.program_id,
          COUNT(w.workout_id) AS workout_count,
          SUM(CASE WHEN w.done = 1 THEN 1 ELSE 0 END) AS completed_workout_count,
          GROUP_CONCAT(DISTINCT w.workout_type) AS workout_types
        FROM Day d
        LEFT JOIN Workout_Type_Instance w
          ON w.day_id = d.day_id
        GROUP BY d.program_id
     ) workouts
       ON workouts.program_id = p.program_id
     ORDER BY p.start_date DESC, p.program_id DESC;`
  );
}

export async function getActiveProgram(db) {
  const startIsoDateSql = localDateToIsoSql("start_date");

  return db.getFirstAsync(
    `SELECT program_id, program_name, start_date
     FROM Program
     WHERE status = 'ACTIVE'
       AND deleted_at IS NULL
     ORDER BY date(${startIsoDateSql}) DESC, program_id DESC
     LIMIT 1;`
  );
}

export async function getProgramStatus(db, programId) {
  return db.getFirstAsync(
    `SELECT status
     FROM Program
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getProgramName(db, programId) {
  return db.getFirstAsync(
    `SELECT program_name
     FROM Program
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getProgramBestExerciseSelections(db, programId) {
  return db.getAllAsync(
    `SELECT exercise_name, is_selected
     FROM Program_Best_Exercise
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function insertProgramBestExerciseSelection(
  db,
  { programId, exerciseName, isSelected = true }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Program_Best_Exercise (
      program_id,
      exercise_name,
      is_selected
    ) VALUES (?, ?, ?);`,
    [programId, exerciseName, isSelected ? 1 : 0]
  );
}

export async function upsertProgramBestExerciseSelection(
  db,
  { programId, exerciseName, isSelected }
) {
  await db.runAsync(
    `INSERT INTO Program_Best_Exercise (
      program_id,
      exercise_name,
      is_selected
    ) VALUES (?, ?, ?)
     ON CONFLICT(program_id, exercise_name)
     DO UPDATE SET is_selected = excluded.is_selected;`,
    [programId, exerciseName, isSelected ? 1 : 0]
  );
}

export async function updateProgramStatus(db, { programId, status }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Program
     SET status = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE program_id = ?;`,
    [status, syncVersion, programId]
  );
}

export async function updateProgramStartAndStatus(
  db,
  { programId, startDate, status }
) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Program
     SET start_date = ?,
         status = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE program_id = ?;`,
    [startDate, status, syncVersion, programId]
  );
}

export async function updateProgramName(db, { programId, programName }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Program
     SET program_name = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE program_id = ?;`,
    [programName, syncVersion, programId]
  );
}

export async function getProgramDayCount(db, programId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS total_days
     FROM Day
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function getProgramDaysForScheduleShift(db, programId) {
  return db.getAllAsync(
    `SELECT day_id, date
     FROM Day
     WHERE program_id = ?
     ORDER BY date ASC, day_id ASC;`,
    [programId]
  );
}

export async function updateProgramDayDate(db, { dayId, date }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Day
     SET date = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE day_id = ?;`,
    [date, syncVersion, dayId]
  );
}

export async function alignProgramWorkoutDates(db, programId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET date = (
           SELECT d.date
           FROM Day d
           WHERE d.day_id = Workout_Type_Instance.day_id
         ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE day_id IN (
       SELECT day_id
       FROM Day
       WHERE program_id = ?
     );`,
    [syncVersion, programId]
  );
}

export async function getDayByProgramAndDate(db, { programId, date }) {
  return db.getFirstAsync(
    `SELECT day_id, Weekday
     FROM Day
     WHERE program_id = ?
       AND date = ?;`,
    [programId, date]
  );
}

export async function getStandaloneDayByDate(db, { date }) {
  return db.getFirstAsync(
    `SELECT day_id, Weekday
     FROM Day
     WHERE program_id IS NULL
       AND microcycle_id IS NULL
       AND date = ?
       AND deleted_at IS NULL;`,
    [date]
  );
}

export async function getWorkoutsByDayId(db, dayId) {
  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.workout_type,
        ${workoutDisplayLabelSql("w", "wt")} AS label,
        w.done,
        w.day_id,
        w.is_active,
        w.original_start_time,
        w.timer_start,
        w.elapsed_time,
        ${workoutHasPersonalRecordSql("w")} AS has_personal_record
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.day_id = ?;`,
    [dayId]
  );
}

export async function getWorkoutOptions(db, programId) {
  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.workout_type,
        ${workoutDisplayLabelSql("w", "wt")} AS label,
        w.date
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     JOIN Day d ON d.day_id = w.day_id
     WHERE d.program_id = ?
     ORDER BY w.date;`,
    [programId]
  );
}

export async function getWorkoutsBetweenDates(db, { startIsoDate, endIsoDate }) {
  const workoutIsoDateSql = localDateToIsoSql("w.date");

  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.workout_type,
        ${workoutDisplayLabelSql("w", "wt")} AS label,
        w.date,
        ${workoutIsoDateSql} AS date_iso,
        w.done,
        w.day_id,
        w.is_active,
        w.original_start_time,
        w.timer_start,
        w.elapsed_time,
        d.Weekday AS weekday,
        d.program_id,
        p.program_name,
        ${workoutHasPersonalRecordSql("w")} AS has_personal_record
     FROM Workout_Type_Instance w
     JOIN Day d ON d.day_id = w.day_id
     LEFT JOIN Program p ON p.program_id = d.program_id
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.deleted_at IS NULL
       AND d.deleted_at IS NULL
       AND (
         p.program_id IS NULL OR (
           p.deleted_at IS NULL
           AND p.status != 'NOT_STARTED'
         )
       )
       AND date(${workoutIsoDateSql}) BETWEEN date(?) AND date(?)
      ORDER BY date_iso ASC, COALESCE(p.program_name, '') COLLATE NOCASE ASC, w.workout_id ASC;`,
    [startIsoDate, endIsoDate]
  );
}

export async function getRecentWorkouts(db, { maxIsoDate, limit = 2 }) {
  const workoutIsoDateSql = localDateToIsoSql("w.date");
  const normalizedLimit = Math.max(1, Math.trunc(Number(limit) || 2));

  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.workout_type,
        ${workoutDisplayLabelSql("w", "wt")} AS label,
        w.date,
        ${workoutIsoDateSql} AS date_iso,
        w.done,
        w.day_id,
        w.is_active,
        d.Weekday AS weekday,
        d.program_id,
        p.program_name,
        ${workoutHasPersonalRecordSql("w")} AS has_personal_record
     FROM Workout_Type_Instance w
     JOIN Day d ON d.day_id = w.day_id
     LEFT JOIN Program p ON p.program_id = d.program_id
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.deleted_at IS NULL
       AND d.deleted_at IS NULL
       AND (p.program_id IS NULL OR p.deleted_at IS NULL)
       AND COALESCE(w.done, 0) = 1
       AND date(${workoutIsoDateSql}) <= date(?)
     ORDER BY date_iso DESC, w.workout_id DESC
     LIMIT ?;`,
    [maxIsoDate, normalizedLimit]
  );
}

export async function getCompletedWorkoutExerciseHistory(
  db,
  { maxIsoDate, limit = 120 }
) {
  const workoutIsoDateSql = localDateToIsoSql("w.date");
  const normalizedLimit = Math.max(1, Math.trunc(Number(limit) || 120));

  return db.getAllAsync(
    `WITH recent_workouts AS (
       SELECT
          w.workout_id,
          w.workout_type,
          ${workoutDisplayLabelSql("w", "wt")} AS label,
          w.date,
          ${workoutIsoDateSql} AS date_iso,
          w.done,
          w.day_id,
          w.is_active,
          d.Weekday AS weekday,
          d.program_id,
          p.program_name,
          ${workoutHasPersonalRecordSql("w")} AS has_personal_record
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       LEFT JOIN Program p ON p.program_id = d.program_id
       LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
       WHERE w.deleted_at IS NULL
         AND d.deleted_at IS NULL
         AND (p.program_id IS NULL OR p.deleted_at IS NULL)
         AND COALESCE(w.done, 0) = 1
         AND date(${workoutIsoDateSql}) <= date(?)
       ORDER BY date_iso DESC, w.workout_id DESC
       LIMIT ?
     )
     SELECT
        rw.*,
        e.exercise_name,
        e.exercise_order
     FROM recent_workouts rw
     JOIN Exercise_Instance e
       ON e.workout_type_instance_id = rw.workout_id
     WHERE COALESCE(e.deleted_at, '') = ''
       AND TRIM(COALESCE(e.exercise_name, '')) <> ''
     ORDER BY
       rw.date_iso DESC,
       rw.workout_id DESC,
       e.exercise_order ASC,
       e.exercise_instance_id ASC;`,
    [maxIsoDate, normalizedLimit]
  );
}

export async function getProgramDaysBetweenDates(db, { startIsoDate, endIsoDate }) {
  const dayIsoDateSql = localDateToIsoSql("d.date");

  return db.getAllAsync(
    `SELECT
        d.day_id,
        d.date,
        ${dayIsoDateSql} AS date_iso,
        d.is_sick,
        d.Weekday AS weekday,
        d.program_id,
        p.program_name,
        p.start_date,
        p.status,
        mc.microcycle_number,
        m.mesocycle_number
     FROM Day d
     JOIN Program p ON p.program_id = d.program_id
     JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
     JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
     WHERE d.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND p.status != 'NOT_STARTED'
       AND mc.deleted_at IS NULL
       AND m.deleted_at IS NULL
       AND date(${dayIsoDateSql}) BETWEEN date(?) AND date(?)
     ORDER BY date_iso ASC, p.program_name COLLATE NOCASE ASC, d.day_id ASC;`,
    [startIsoDate, endIsoDate]
  );
}

export async function getSetDoneStatesByDayId(db, dayId) {
  return db.getAllAsync(
    `SELECT s.done
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     WHERE w.day_id = ?;`,
    [dayId]
  );
}

export async function getCompletedStrengthSetsByProgram(db, programId) {
  return db.getAllAsync(
    `SELECT
        e.exercise_name,
        s.weight,
        s.reps,
        d.date AS performed_date
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     WHERE d.program_id = ?
       AND s.done = 1
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
     ORDER BY e.exercise_name COLLATE NOCASE ASC;`,
    [programId]
  );
}

export async function deleteSetsByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE exercise_instance_id IN (
       SELECT e.exercise_instance_id
       FROM Exercise_Instance e
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
     );`,
    [programId]
  );
}

export async function deleteExercisesByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Exercise_Instance
     WHERE workout_type_instance_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
     );`,
    [programId]
  );
}

export async function deleteRunsByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Run
     WHERE workout_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
     );`,
    [programId]
  );
}

export async function deleteWorkoutsByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Workout_Type_Instance
     WHERE day_id IN (
       SELECT d.day_id
       FROM Day d
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
     );`,
    [programId]
  );
}

export async function deleteDaysByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Day
     WHERE microcycle_id IN (
       SELECT mc.microcycle_id
       FROM Microcycle mc
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
     );`,
    [programId]
  );
}

export async function deleteMicrocyclesByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Microcycle
     WHERE mesocycle_id IN (
       SELECT mesocycle_id
       FROM Mesocycle
       WHERE program_id = ?
     );`,
    [programId]
  );
}

export async function deleteEstimatedSetsByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Estimated_Set
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function deleteProgramBestExercisesByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Program_Best_Exercise
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function deleteMesocyclesByProgram(db, programId) {
  await db.runAsync(
    `DELETE FROM Mesocycle
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function deleteProgramById(db, programId) {
  await db.runAsync(
    `DELETE FROM Program
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function countMesocyclesByProgram(db, programId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM Mesocycle
     WHERE program_id = ?;`,
    [programId]
  );
}

export async function countMicrocyclesByProgram(db, programId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM Microcycle mc
     JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
     WHERE m.program_id = ?;`,
    [programId]
  );
}

export async function insertMesocycle(
  db,
  { programId, mesocycleNumber, weeks, focus }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Mesocycle (
      program_id,
      mesocycle_number,
      weeks,
      focus,
      sync_id,
      sync_version
    )
     VALUES (?, ?, ?, ?, ${SQLITE_UUID_SQL}, ?);`,
    [programId, mesocycleNumber, weeks, focus, syncVersion]
  );
}

export async function insertMicrocycle(
  db,
  { mesocycleId, microcycleNumber }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Microcycle (
      mesocycle_id,
      microcycle_number,
      needs_sync,
      sync_id,
      sync_version
    )
     VALUES (?, ?, 1, ${SQLITE_UUID_SQL}, ?);`,
    [mesocycleId, microcycleNumber, syncVersion]
  );
}

export async function insertDay(
  db,
  { microcycleId, programId, weekday, date }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Day (
      microcycle_id,
      program_id,
      Weekday,
      date,
      sync_id,
      sync_version
    )
     VALUES (?, ?, ?, ?, ${SQLITE_UUID_SQL}, ?);`,
    [microcycleId, programId, weekday, date, syncVersion]
  );
}

export async function getMesocyclesByProgram(db, programId) {
  return db.getAllAsync(
    `SELECT mesocycle_id, mesocycle_number, weeks, focus, done
     FROM Mesocycle
     WHERE program_id = ?
     ORDER BY mesocycle_number ASC;`,
    [programId]
  );
}

export async function getMesocycleWorkoutCountsByProgram(db, programId) {
  return db.getAllAsync(
    `SELECT
        m.mesocycle_id,
        COUNT(w.workout_id) AS workout_count,
        COALESCE(SUM(CASE WHEN w.done = 1 THEN 1 ELSE 0 END), 0) AS completed_workout_count
     FROM Mesocycle m
     LEFT JOIN Microcycle mc ON mc.mesocycle_id = m.mesocycle_id
     LEFT JOIN Day d ON d.microcycle_id = mc.microcycle_id
     LEFT JOIN Workout_Type_Instance w ON w.day_id = d.day_id
     WHERE m.program_id = ?
     GROUP BY m.mesocycle_id
     ORDER BY m.mesocycle_number ASC;`,
    [programId]
  );
}

export async function getProgramOverviewStats(db, programId) {
  return db.getFirstAsync(
    `SELECT
        COUNT(w.workout_id) AS total_workouts,
        COALESCE(SUM(CASE WHEN w.done = 1 THEN 1 ELSE 0 END), 0) AS completed_workouts,
        COALESCE(AVG(CASE
          WHEN w.done = 1 AND COALESCE(w.elapsed_time, 0) > 0
          THEN w.elapsed_time
          ELSE NULL
        END), 0) AS avg_session_seconds,
        COALESCE((
          SELECT SUM(COALESCE(s.weight, 0) * COALESCE(s.reps, 0))
          FROM "Set" s
          JOIN Exercise_Instance e
            ON e.exercise_instance_id = s.exercise_instance_id
          JOIN Workout_Type_Instance sw
            ON sw.workout_id = e.workout_type_instance_id
          JOIN Day sd
            ON sd.day_id = sw.day_id
          WHERE sd.program_id = ?
            AND s.done = 1
            AND s.weight IS NOT NULL
            AND s.reps IS NOT NULL
        ), 0) AS total_volume
     FROM Day d
     LEFT JOIN Workout_Type_Instance w
       ON w.day_id = d.day_id
     WHERE d.program_id = ?;`,
    [programId, programId]
  );
}

export async function getProgramWeekCompletionStats(db, programId) {
  return db.getAllAsync(
    `SELECT
        mc.microcycle_id,
        m.mesocycle_number,
        mc.microcycle_number,
        MIN(d.date) AS period_start,
        MAX(d.date) AS period_end,
        COUNT(w.workout_id) AS total_workouts,
        COALESCE(SUM(CASE WHEN w.done = 1 THEN 1 ELSE 0 END), 0) AS completed_workouts
     FROM Microcycle mc
     JOIN Mesocycle m
       ON m.mesocycle_id = mc.mesocycle_id
     LEFT JOIN Day d
       ON d.microcycle_id = mc.microcycle_id
     LEFT JOIN Workout_Type_Instance w
       ON w.day_id = d.day_id
     WHERE m.program_id = ?
     GROUP BY mc.microcycle_id
     ORDER BY m.mesocycle_number ASC, mc.microcycle_number ASC;`,
    [programId]
  );
}

export async function updateMesocycleFocus(db, { mesocycleId, focus }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Mesocycle
     SET focus = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE mesocycle_id = ?;`,
    [focus, syncVersion, mesocycleId]
  );
}

export async function getMicrocyclesByMesocycle(db, mesocycleId) {
  return db.getAllAsync(
    `SELECT
        mc.microcycle_id,
        mc.microcycle_number,
        m.program_id,
        mc.focus,
        mc.done
     FROM Microcycle mc
     JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
     WHERE mc.mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function getMicrocyclesByMesocycleForInsert(db, mesocycleId) {
  return db.getAllAsync(
    `SELECT microcycle_id, microcycle_number
     FROM Microcycle
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function getLastSundayByMicrocycle(db, microcycleId) {
  return db.getFirstAsync(
    `SELECT date
     FROM Day
     WHERE microcycle_id = ?
       AND Weekday = 'Sunday';`,
    [microcycleId]
  );
}

export async function incrementMesocycleWeeks(db, mesocycleId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Mesocycle
     SET weeks = weeks + 1,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE mesocycle_id = ?;`,
    [syncVersion, mesocycleId]
  );
}

export async function deleteSetsByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE exercise_instance_id IN (
       SELECT e.exercise_instance_id
       FROM Exercise_Instance e
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       WHERE mc.mesocycle_id = ?
     );`,
    [mesocycleId]
  );
}

export async function deleteExercisesByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Exercise_Instance
     WHERE workout_type_instance_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       WHERE mc.mesocycle_id = ?
     );`,
    [mesocycleId]
  );
}

export async function deleteRunsByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Run
     WHERE workout_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       WHERE mc.mesocycle_id = ?
     );`,
    [mesocycleId]
  );
}

export async function deleteWorkoutsByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Workout_Type_Instance
     WHERE day_id IN (
       SELECT d.day_id
       FROM Day d
       JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       WHERE mc.mesocycle_id = ?
     );`,
    [mesocycleId]
  );
}

export async function deleteDaysByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Day
     WHERE microcycle_id IN (
       SELECT microcycle_id
       FROM Microcycle
       WHERE mesocycle_id = ?
     );`,
    [mesocycleId]
  );
}

export async function deleteMicrocyclesByMesocycle(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Microcycle
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function deleteMesocycleById(db, mesocycleId) {
  await db.runAsync(
    `DELETE FROM Mesocycle
     WHERE mesocycle_id = ?;`,
    [mesocycleId]
  );
}

export async function getMesocycleOptions(db, programId) {
  return db.getAllAsync(
    `SELECT mesocycle_id, mesocycle_number
     FROM Mesocycle
     WHERE program_id = ?
     ORDER BY mesocycle_number;`,
    [programId]
  );
}

export async function getWeeksBeforeMesocycle(
  db,
  { programId, mesocycleNumber }
) {
  return db.getFirstAsync(
    `SELECT COALESCE(SUM(weeks), 0) AS total_weeks
     FROM Mesocycle
     WHERE program_id = ?
       AND mesocycle_number < ?;`,
    [programId, mesocycleNumber]
  );
}

export async function getMicrocycleNumberAndMesocycleNumber(
  db,
  { programId, microcycleId }
) {
  return db.getFirstAsync(
    `SELECT
        mc.microcycle_number,
        m.mesocycle_number
     FROM Microcycle mc
     JOIN Mesocycle m ON mc.mesocycle_id = m.mesocycle_id
     WHERE mc.microcycle_id = ?
       AND m.program_id = ?;`,
    [microcycleId, programId]
  );
}

export async function updateMicrocycleFocus(db, { microcycleId, focus }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Microcycle
     SET focus = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE microcycle_id = ?;`,
    [focus, syncVersion, microcycleId]
  );
}

export async function getTotalWorkoutCountByMicrocycle(db, microcycleId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM Workout_Type_Instance w
     JOIN Day d ON w.day_id = d.day_id
     WHERE d.microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getDoneWorkoutCountByMicrocycle(db, microcycleId) {
  return db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM Workout_Type_Instance w
     JOIN Day d ON w.day_id = d.day_id
     WHERE d.microcycle_id = ?
       AND w.done = 1;`,
    [microcycleId]
  );
}

export async function getDayByMicrocycleAndDate(
  db,
  { microcycleId, date }
) {
  return db.getFirstAsync(
    `SELECT day_id, is_sick
     FROM Day
     WHERE microcycle_id = ?
       AND date = ?;`,
    [microcycleId, date]
  );
}

export async function getWorkoutLabelsByDay(db, dayId) {
  return db.getAllAsync(
    `SELECT ${workoutDisplayLabelSql("w", "wt")} AS label
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.day_id = ?;`,
    [dayId]
  );
}

export async function getSelectableWorkoutTypes(db) {
  return db.getAllAsync(
    `SELECT
        workout_type_id,
        name,
        COALESCE(NULLIF(display_name, ''), name) AS display_name,
        COALESCE(is_active, 0) AS is_active
     FROM Workout_Type
     WHERE COALESCE(is_active, 0) = 1
     ORDER BY workout_type_id ASC, name ASC;`
  );
}

export async function markAllWorkoutTypesInactive(db) {
  await db.runAsync(`
    UPDATE Workout_Type
    SET is_active = 0;
  `);
}

export async function upsertWorkoutType(db, { name, displayName, isActive }) {
  await db.runAsync(
    `INSERT INTO Workout_Type (name, display_name, is_active)
     VALUES (?, ?, ?)
     ON CONFLICT(name)
     DO UPDATE SET
       display_name = excluded.display_name,
       is_active = excluded.is_active;`,
    [name, displayName, isActive ? 1 : 0]
  );
}

export async function getAllMicrocyclesByProgram(db, programId) {
  return db.getAllAsync(
    `SELECT
        mc.microcycle_id,
        mc.microcycle_number,
        mc.mesocycle_id
     FROM Microcycle mc
     JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
     WHERE m.program_id = ?
     ORDER BY mc.microcycle_number;`,
    [programId]
  );
}

export async function getDaysByMicrocycle(db, microcycleId) {
  return db.getAllAsync(
    `SELECT day_id, Weekday, date, is_sick
     FROM Day
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getDaysForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        day_id,
        cloud_id,
        cloud_day_id,
        remote_local_day_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        microcycle_id,
        program_id,
        Weekday AS weekday,
        date,
        done,
        is_sick,
        needs_sync
     FROM Day
     ORDER BY day_id ASC;`
  );
}

export async function createDayFromCloud(
  db,
  {
    cloudDayId,
    remoteLocalDayId,
    syncId,
    syncVersion,
    deletedAt,
    microcycleId,
    programId,
    weekday,
    date,
    done,
    isSick = false,
  }
) {
  return db.runAsync(
    `INSERT INTO Day (
      cloud_day_id,
      remote_local_day_id,
      sync_id,
      sync_version,
      deleted_at,
      microcycle_id,
      program_id,
      Weekday,
      date,
      done,
      is_sick,
      needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      cloudDayId,
      remoteLocalDayId,
      syncId,
      syncVersion,
      deletedAt,
      microcycleId,
      programId,
      weekday,
      date,
      done ? 1 : 0,
      isSick ? 1 : 0,
    ]
  );
}

export async function updateDayFromCloud(
  db,
  {
    dayId,
    cloudDayId,
    remoteLocalDayId,
    syncId,
    syncVersion,
    deletedAt,
    microcycleId,
    programId,
    weekday,
    date,
    done,
    isSick = false,
  }
) {
  await db.runAsync(
    `UPDATE Day
     SET cloud_day_id = ?,
         remote_local_day_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         microcycle_id = ?,
         program_id = ?,
         Weekday = ?,
         date = ?,
         done = ?,
         is_sick = ?,
         needs_sync = 0
     WHERE day_id = ?;`,
    [
      cloudDayId,
      remoteLocalDayId,
      syncId,
      syncVersion,
      deletedAt,
      microcycleId,
      programId,
      weekday,
      date,
      done ? 1 : 0,
      isSick ? 1 : 0,
      dayId,
    ]
  );
}

export async function markDaySynced(
  db,
  {
    dayId,
    cloudDayId,
    remoteLocalDayId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Day
     SET cloud_day_id = ?,
         remote_local_day_id = COALESCE(?, remote_local_day_id, day_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE day_id = ?;`,
    [cloudDayId, remoteLocalDayId, syncId, syncVersion, deletedAt, dayId]
  );
}

export async function updateDayCloudIdentity(
  db,
  {
    dayId,
    cloudDayId,
    remoteLocalDayId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Day
     SET cloud_day_id = ?,
         remote_local_day_id = COALESCE(?, remote_local_day_id, day_id),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE day_id = ?;`,
    [cloudDayId, remoteLocalDayId, syncId, syncVersion, deletedAt, dayId]
  );
}

export async function markDayForCloudResync(db, { dayId }) {
  await db.runAsync(
    `UPDATE Day
     SET cloud_id = NULL,
         cloud_day_id = NULL,
         needs_sync = 1
     WHERE day_id = ?;`,
    [dayId]
  );
}

export async function updateDaySick(db, { dayId, isSick }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Day
     SET is_sick = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE day_id = ?;`,
    [isSick ? 1 : 0, syncVersion, dayId]
  );
}

export async function updateDaysSickBetweenDates(
  db,
  { startDate, endDate = startDate, isSick }
) {
  const syncVersion = createNextSyncVersion();
  const startIsoDate = localDateToIsoValue(startDate);
  const endIsoDate = endDate ? localDateToIsoValue(endDate) : null;

  await db.runAsync(
    `UPDATE Day
     SET is_sick = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE COALESCE(deleted_at, '') = ''
       AND date(${localDateToIsoSql('"date"')}) >= date(?)
       AND (? IS NULL OR date(${localDateToIsoSql('"date"')}) <= date(?));`,
    [isSick ? 1 : 0, syncVersion, startIsoDate, endIsoDate, endIsoDate]
  );
}

export async function getSicknessPeriodEndingOnDate(db, { date }) {
  return db.getFirstAsync(
    `SELECT
        sickness_id,
        start_date,
        end_date,
        sickness_type,
        note
     FROM Sickness
     WHERE COALESCE(deleted_at, '') = ''
       AND (
         end_date = ?
         OR (end_date IS NULL AND start_date = ?)
       )
     ORDER BY sickness_id DESC
     LIMIT 1;`,
    [date, date]
  );
}

export async function getSicknessPeriodStartingOnDate(db, { date }) {
  return db.getFirstAsync(
    `SELECT
        sickness_id,
        start_date,
        end_date,
        sickness_type,
        note
     FROM Sickness
     WHERE COALESCE(deleted_at, '') = ''
       AND start_date = ?
     ORDER BY sickness_id DESC
     LIMIT 1;`,
    [date]
  );
}

export async function createSicknessPeriod(
  db,
  { startDate, endDate = null, sicknessType = null, note = null }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Sickness (
       start_date,
       end_date,
       sickness_type,
       note,
       needs_sync,
       sync_id,
       sync_version,
       deleted_at
     ) VALUES (?, ?, ?, ?, 1, ${SQLITE_UUID_SQL}, ?, NULL);`,
    sqliteParams([startDate, endDate, sicknessType, note, syncVersion])
  );
}

export async function updateSicknessPeriod(
  db,
  { sicknessId, startDate, endDate = null, sicknessType = null, note = null }
) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Sickness
     SET start_date = ?,
         end_date = ?,
         sickness_type = ?,
         note = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sickness_id = ?;`,
    sqliteParams([
      startDate,
      endDate,
      sicknessType,
      note,
      syncVersion,
      sicknessId,
    ])
  );
}

export async function extendSicknessPeriod(db, { sicknessId, endDate }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Sickness
     SET end_date = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sickness_id = ?;`,
    [endDate, syncVersion, sicknessId]
  );
}

export async function trimSicknessPeriodEndDate(db, { sicknessId, endDate }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Sickness
     SET end_date = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sickness_id = ?;`,
    [endDate, syncVersion, sicknessId]
  );
}

export async function updateSicknessPeriodStartDate(db, { sicknessId, startDate }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Sickness
     SET start_date = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE sickness_id = ?;`,
    [startDate, syncVersion, sicknessId]
  );
}

export async function markSicknessPeriodDeleted(
  db,
  { sicknessId, deletedAt }
) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Sickness
     SET deleted_at = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         needs_sync = 1
     WHERE sickness_id = ?;`,
    [deletedAt, syncVersion, sicknessId]
  );
}

export async function getSicknessPeriodCoveringDate(db, { date }) {
  const isoDate = localDateToIsoValue(date);

  return db.getFirstAsync(
    `SELECT
        sickness_id,
        start_date,
        end_date,
        sickness_type,
        note
     FROM Sickness
     WHERE COALESCE(deleted_at, '') = ''
       AND ${localDateToIsoSql("start_date")} <= ?
       AND (
         end_date IS NULL
         OR ${localDateToIsoSql("end_date")} >= ?
       )
     ORDER BY ${localDateToIsoSql("start_date")} DESC,
              sickness_id DESC
     LIMIT 1;`,
    [isoDate, isoDate]
  );
}

export async function getSicknessPeriodsCoveringDate(db, { date }) {
  const isoDate = localDateToIsoValue(date);

  return db.getAllAsync(
    `SELECT
        sickness_id,
        start_date,
        end_date,
        sickness_type,
        note
     FROM Sickness
     WHERE COALESCE(deleted_at, '') = ''
       AND ${localDateToIsoSql("start_date")} <= ?
       AND (
         end_date IS NULL
         OR ${localDateToIsoSql("end_date")} >= ?
       )
     ORDER BY ${localDateToIsoSql("start_date")} ASC,
              sickness_id ASC;`,
    [isoDate, isoDate]
  );
}

export async function getSicknessPeriods(db) {
  return db.getAllAsync(
    `SELECT
        sickness_id,
        start_date,
        end_date,
        sickness_type,
        note
     FROM Sickness
     WHERE COALESCE(deleted_at, '') = ''
     ORDER BY ${localDateToIsoSql("start_date")} DESC,
              sickness_id DESC;`
  );
}

export async function getDaySyncMetadata(db, dayId) {
  return db.getFirstAsync(
    `SELECT
        day_id,
        cloud_id,
        cloud_day_id,
        remote_local_day_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Day
     WHERE day_id = ?;`,
    [dayId]
  );
}

export async function getWorkoutsByDay(db, dayId) {
  return db.getAllAsync(
    `SELECT
        w.workout_id,
        w.cloud_workout_type_instance_id,
        w.remote_local_workout_type_instance_id,
        w.sync_id,
        w.sync_version,
        w.deleted_at,
        w.day_id,
        w.workout_type,
        w.date,
        ${workoutDisplayLabelSql("w", "wt")} AS label,
        w.done,
        w.is_active,
        w.original_start_time,
        w.timer_start,
        w.elapsed_time,
        w.needs_sync
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.day_id = ?;`,
    [dayId]
  );
}

export async function getWorkoutsForCloudSync(db) {
  return db.getAllAsync(
    `SELECT
        workout_id,
        cloud_id,
        cloud_workout_type_instance_id,
        remote_local_workout_type_instance_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        day_id,
        workout_type,
        date,
        label,
        done,
        is_active,
        original_start_time,
        timer_start,
        elapsed_time,
        needs_sync
     FROM Workout_Type_Instance
     ORDER BY workout_id ASC;`
  );
}

export async function createWorkoutFromCloud(
  db,
  {
    cloudWorkoutTypeInstanceId,
    remoteLocalWorkoutTypeInstanceId,
    syncId,
    syncVersion,
    deletedAt,
    dayId,
    workoutType,
    date,
    label,
    done,
    isActive,
    originalStartTime,
    timerStart,
    elapsedTime,
  }
) {
  return db.runAsync(
    `INSERT INTO Workout_Type_Instance (
      cloud_workout_type_instance_id,
      remote_local_workout_type_instance_id,
      sync_id,
      sync_version,
      deleted_at,
      day_id,
      workout_type,
      date,
      label,
      done,
      needs_sync,
      is_active,
      original_start_time,
      timer_start,
      elapsed_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?);`,
    sqliteParams([
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      dayId,
      workoutType,
      date,
      label,
      done ? 1 : 0,
      isActive ? 1 : 0,
      originalStartTime,
      timerStart,
      elapsedTime,
    ])
  );
}

export async function updateWorkoutFromCloud(
  db,
  {
    workoutId,
    cloudWorkoutTypeInstanceId,
    remoteLocalWorkoutTypeInstanceId,
    syncId,
    syncVersion,
    deletedAt,
    dayId,
    workoutType,
    date,
    label,
    done,
    isActive,
    originalStartTime,
    timerStart,
    elapsedTime,
  }
) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET cloud_workout_type_instance_id = ?,
         remote_local_workout_type_instance_id = ?,
         sync_id = ?,
         sync_version = ?,
         deleted_at = ?,
         day_id = ?,
         workout_type = ?,
         date = ?,
         label = ?,
         done = ?,
         is_active = ?,
         original_start_time = ?,
         timer_start = ?,
         elapsed_time = ?,
         needs_sync = 0
     WHERE workout_id = ?;`,
    sqliteParams([
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      dayId,
      workoutType,
      date,
      label,
      done ? 1 : 0,
      isActive ? 1 : 0,
      originalStartTime,
      timerStart,
      elapsedTime,
      workoutId,
    ])
  );
}

export async function markWorkoutSynced(
  db,
  {
    workoutId,
    cloudWorkoutTypeInstanceId,
    remoteLocalWorkoutTypeInstanceId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET cloud_workout_type_instance_id = ?,
         remote_local_workout_type_instance_id = COALESCE(
           ?,
           remote_local_workout_type_instance_id,
           workout_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = ?,
         needs_sync = 0
     WHERE workout_id = ?;`,
    sqliteParams([
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      workoutId,
    ])
  );
}

export async function updateWorkoutCloudIdentity(
  db,
  {
    workoutId,
    cloudWorkoutTypeInstanceId,
    remoteLocalWorkoutTypeInstanceId = null,
    syncId = null,
    syncVersion = null,
    deletedAt = null,
  }
) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET cloud_workout_type_instance_id = ?,
         remote_local_workout_type_instance_id = COALESCE(
           ?,
           remote_local_workout_type_instance_id,
           workout_id
         ),
         sync_id = COALESCE(?, sync_id),
         sync_version = COALESCE(?, sync_version),
         deleted_at = COALESCE(?, deleted_at)
     WHERE workout_id = ?;`,
    sqliteParams([
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId,
      syncVersion,
      deletedAt,
      workoutId,
    ])
  );
}

export async function markWorkoutForCloudResync(db, { workoutId }) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET cloud_id = NULL,
         cloud_workout_type_instance_id = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function getWorkoutSyncMetadata(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        workout_id,
        cloud_id,
        cloud_workout_type_instance_id,
        remote_local_workout_type_instance_id,
        sync_id,
        sync_version,
        last_updated,
        deleted_at,
        needs_sync
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function getQueuedWorkoutTypeInstanceDeletes(db) {
  return db.getAllAsync(
    `SELECT
        workout_type_instance_sync_delete_id,
        cloud_workout_type_instance_id,
        remote_local_workout_type_instance_id,
        sync_id,
        sync_version,
        deleted_at
     FROM Workout_Type_Instance_Sync_Delete
     ORDER BY workout_type_instance_sync_delete_id ASC;`
  );
}

export async function queueWorkoutTypeInstanceDeleteSync(
  db,
  {
    cloudWorkoutTypeInstanceId = null,
    remoteLocalWorkoutTypeInstanceId = null,
    syncId = null,
    syncVersion = 0,
    deletedAt,
  }
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Workout_Type_Instance_Sync_Delete (
      cloud_workout_type_instance_id,
      remote_local_workout_type_instance_id,
      sync_id,
      sync_version,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?);`,
    sqliteParams([
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId,
      syncVersion,
      deletedAt,
    ])
  );
}

export async function deleteQueuedWorkoutTypeInstanceDelete(db, queueId) {
  if (queueId === null || queueId === undefined) {
    return;
  }

  await db.runAsync(
    `DELETE FROM Workout_Type_Instance_Sync_Delete
     WHERE workout_type_instance_sync_delete_id = ?;`,
    sqliteParams([queueId])
  );
}

export async function deleteSetsByMicrocycle(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM "Set"
     WHERE exercise_instance_id IN (
       SELECT e.exercise_instance_id
       FROM Exercise_Instance e
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.microcycle_id = ?
     );`,
    [microcycleId]
  );
}

export async function deleteExercisesByMicrocycle(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM Exercise_Instance
     WHERE workout_type_instance_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.microcycle_id = ?
     );`,
    [microcycleId]
  );
}

export async function deleteRunsByMicrocycle(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM Run
     WHERE workout_id IN (
       SELECT w.workout_id
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.microcycle_id = ?
     );`,
    [microcycleId]
  );
}

export async function deleteWorkoutsByMicrocycle(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM Workout_Type_Instance
     WHERE day_id IN (
       SELECT day_id
       FROM Day
       WHERE microcycle_id = ?
     );`,
    [microcycleId]
  );
}

export async function deleteDaysByMicrocycle(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM Day
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function deleteDayById(db, dayId) {
  await db.runAsync(
    `DELETE FROM Day
     WHERE day_id = ?;`,
    [dayId]
  );
}

export async function deleteMicrocycleById(db, microcycleId) {
  await db.runAsync(
    `DELETE FROM Microcycle
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getDayByWeekdayAndMicrocycle(
  db,
  { weekday, microcycleId }
) {
  return db.getFirstAsync(
    `SELECT day_id, date, done, is_sick
     FROM Day
     WHERE Weekday = ?
       AND microcycle_id = ?;`,
    [weekday, microcycleId]
  );
}

export async function createWorkout(
  db,
  { date, dayId, workoutType = null, label = workoutType }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Workout_Type_Instance (
      date,
      day_id,
      workout_type,
      label,
      needs_sync,
      sync_id,
      sync_version
    )
     VALUES (?, ?, ?, ?, 1, ${SQLITE_UUID_SQL}, ?);`,
    [date, dayId, workoutType ?? label, label ?? workoutType, syncVersion]
  );
}

export async function copyWorkoutIntoDay(
  db,
  { date, dayId, workoutId }
) {
  const syncVersion = createNextSyncVersion();
  return db.runAsync(
    `INSERT INTO Workout_Type_Instance (
       date,
       day_id,
       workout_type,
       label,
       needs_sync,
       sync_id,
       sync_version
     )
     SELECT
       ?,
       ?,
       COALESCE(workout_type, label),
       NULLIF(label, workout_type),
       1,
       ${SQLITE_UUID_SQL},
       ?
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [date, dayId, syncVersion, workoutId]
  );
}

export async function getDayByDate(db, { programId, date }) {
  return db.getFirstAsync(
    `SELECT day_id, is_sick
     FROM Day
     WHERE date = ?
       AND program_id = ?;`,
    [date, programId]
  );
}

export async function deleteWorkoutById(db, workoutId) {
  await db.runAsync(
    `DELETE FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function getMicrocycleMetadata(db, microcycleId) {
  return db.getFirstAsync(
    `SELECT mesocycle_id, microcycle_number, focus, done
     FROM Microcycle
     WHERE microcycle_id = ?;`,
    [microcycleId]
  );
}

export async function getMesocycleMetadata(
  db,
  { mesocycleId, programId }
) {
  return db.getFirstAsync(
    `SELECT mesocycle_number
     FROM Mesocycle
     WHERE mesocycle_id = ?
       AND program_id = ?;`,
    [mesocycleId, programId]
  );
}

export async function getProgramMetadata(db, programId) {
  return db.getFirstAsync(
    `SELECT start_date, status
     FROM Program
     WHERE program_id = ?;`,
    [programId]
  );
}
