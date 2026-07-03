import { createNextSyncVersion, SQLITE_UUID_SQL } from "../Utils/syncUtils";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../Utils/timeUtils";

function workoutDisplayLabelSql(workoutAlias = "w", workoutTypeAlias = "wt") {
  return `COALESCE(
    NULLIF(${workoutAlias}.label, ${workoutAlias}.workout_type),
    NULLIF(${workoutTypeAlias}.display_name, ''),
    ${workoutAlias}.label,
    ${workoutAlias}.workout_type
  )`;
}

export async function getWorkoutHierarchyIds(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        d.day_id,
        d.microcycle_id,
        mc.mesocycle_id
     FROM Workout_Type_Instance w
     JOIN Day d ON d.day_id = w.day_id
     LEFT JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
     WHERE w.workout_id = ?;`,
    [workoutId]
  );
}

export async function getWorkoutPageMetadata(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        d.program_id,
        d.Weekday AS day,
        w.date,
        w.workout_type,
        w.label AS workout_instance_label,
        ${workoutDisplayLabelSql("w", "wt")} AS workout_label
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     JOIN Day d ON d.day_id = w.day_id
     WHERE w.workout_id = ?;`,
    [workoutId]
  );
}

export async function getDayHierarchyIds(db, dayId) {
  return db.getFirstAsync(
    `SELECT
        d.day_id,
        d.microcycle_id,
        mc.mesocycle_id
     FROM Day d
     LEFT JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
     WHERE d.day_id = ?;`,
    [dayId]
  );
}

export async function getWorkoutTimerState(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        done,
        original_start_time,
        timer_start,
        elapsed_time,
        run_focus_type
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function updateWorkoutRunFocusType(
  db,
  { workoutId, runFocusType }
) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET run_focus_type = ?
     WHERE workout_id = ?;`,
    [runFocusType ?? null, workoutId]
  );
}

export async function getWorkoutStartNotificationDetails(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        workout_id,
        cloud_id,
        cloud_workout_type_instance_id,
        sync_id,
        workout_type,
        label,
        date,
        done,
        is_active,
        original_start_time,
        timer_start,
        elapsed_time
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function getActiveWorkoutTimer(db) {
  return db.getFirstAsync(
    `SELECT
        w.workout_id,
        w.workout_type,
        w.label,
        w.date,
        w.original_start_time,
        w.timer_start,
        w.elapsed_time,
        d.program_id,
        d.Weekday AS day
     FROM Workout_Type_Instance w
     LEFT JOIN Day d ON d.day_id = w.day_id
     WHERE w.done = 0
       AND w.is_active = 1
       AND w.timer_start IS NOT NULL
       AND w.deleted_at IS NULL
     ORDER BY w.timer_start DESC, w.workout_id DESC
     LIMIT 1;`
  );
}

export async function updateWorkoutLabel(db, { workoutId, label }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET label = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [label, syncVersion, workoutId]
  );
}

export async function clearActiveWorkoutFlags(db) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET is_active = 0,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE is_active != 0;`
    ,
    [syncVersion]
  );
}

export async function normalizeActiveWorkoutFlags(db) {
  const resetSyncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET is_active = 0,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE is_active = 1
       AND (timer_start IS NULL OR done = 1);`,
    [resetSyncVersion]
  );

  const activeWorkouts = await db.getAllAsync(
    `SELECT workout_id
     FROM Workout_Type_Instance
     WHERE is_active = 1
       AND timer_start IS NOT NULL
       AND done = 0
     ORDER BY timer_start DESC, workout_id DESC;`
  );

  if (activeWorkouts.length <= 1) {
    return;
  }

  const [workoutToKeep, ...staleWorkouts] = activeWorkouts;

  for (const staleWorkout of staleWorkouts) {
    const syncVersion = createNextSyncVersion();
    await db.runAsync(
      `UPDATE Workout_Type_Instance
       SET is_active = 0,
           sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
           sync_version = ?,
           deleted_at = NULL,
           needs_sync = 1
       WHERE workout_id = ?;`,
      [syncVersion, staleWorkout.workout_id]
    );
  }
}

export async function setWorkoutActiveFlag(db, { workoutId, isActive }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET is_active = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [isActive ? 1 : 0, syncVersion, workoutId]
  );
}

export async function getActiveWorkoutForTracking(db) {
  return db.getFirstAsync(
    `SELECT workout_id
     FROM Workout_Type_Instance
     WHERE is_active = 1
       AND timer_start IS NOT NULL
       AND done = 0
     LIMIT 1;`
  );
}

export async function persistWorkoutTimerState(
  db,
  { workoutId, timerStart, elapsedTime }
) {
  const normalizedTimerStart = normalizeStoredTimestampSeconds(timerStart);
  const normalizedElapsedTime = normalizeElapsedDurationSeconds(elapsedTime, 0);
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET timer_start = ?,
         elapsed_time = ?,
         is_active = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [
      normalizedTimerStart,
      normalizedElapsedTime,
      normalizedTimerStart === null ? 0 : 1,
      syncVersion,
      workoutId,
    ]
  );
}

export async function updateWorkoutElapsedTime(db, { workoutId, elapsedTime }) {
  const normalizedElapsedTime = normalizeElapsedDurationSeconds(elapsedTime, 0);
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET elapsed_time = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [normalizedElapsedTime, syncVersion, workoutId]
  );
}

export async function getWorkoutOriginalStartTime(db, workoutId) {
  return db.getFirstAsync(
    `SELECT original_start_time
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function setWorkoutOriginalStartTime(db, { workoutId, startTime }) {
  const normalizedStartTime = normalizeStoredTimestampSeconds(startTime);
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET original_start_time = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [normalizedStartTime, syncVersion, workoutId]
  );
}

export async function getWorkoutStartTimestamp(db, workoutId) {
  return db.getFirstAsync(
    `SELECT start_ts
     FROM Workout_Type_Instance
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function setWorkoutStartTimestamp(db, { workoutId, startTs }) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET start_ts = ?
     WHERE workout_id = ?;`,
    [startTs, workoutId]
  );
}

export async function stopWorkoutStopwatch(
  db,
  { workoutId, durationSeconds }
) {
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET start_ts = NULL,
         duration_seconds = ?
     WHERE workout_id = ?;`,
    [durationSeconds, workoutId]
  );
}

export async function updateWorkoutDone(db, { workoutId, done }) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET done = ?,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [done ? 1 : 0, syncVersion, workoutId]
  );
}

export async function resetWorkoutStateFields(db, workoutId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Workout_Type_Instance
     SET done = 0,
         is_active = 0,
         original_start_time = NULL,
         timer_start = NULL,
         elapsed_time = 0,
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE workout_id = ?;`,
    [syncVersion, workoutId]
  );
}

export async function updateDayDoneFromWorkouts(db, dayId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Day
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM Workout_Type_Instance
         WHERE Workout_Type_Instance.day_id = Day.day_id
           AND Workout_Type_Instance.done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE day_id = ?;`,
    [syncVersion, dayId]
  );
}

export async function updateMicrocycleDoneFromWorkouts(db, microcycleId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Microcycle
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM Workout_Type_Instance
         JOIN Day ON Day.day_id = Workout_Type_Instance.day_id
         WHERE Day.microcycle_id = Microcycle.microcycle_id
           AND Workout_Type_Instance.done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE microcycle_id = ?;`,
    [syncVersion, microcycleId]
  );
}

export async function updateMesocycleDoneFromMicrocycles(db, mesocycleId) {
  const syncVersion = createNextSyncVersion();
  await db.runAsync(
    `UPDATE Mesocycle
     SET done = (
       NOT EXISTS (
         SELECT 1
         FROM Microcycle
         WHERE Microcycle.mesocycle_id = Mesocycle.mesocycle_id
           AND Microcycle.done = 0
       )
     ),
         sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
         sync_version = ?,
         deleted_at = NULL,
         needs_sync = 1
     WHERE mesocycle_id = ?;`,
    [syncVersion, mesocycleId]
  );
}
