// Shared plumbing for the cloud sync engine: identity, normalisation, payload
// building and the watcher/cascade bookkeeping every entity needs.
//
// Nothing here calls a sync pipeline, which is what keeps the modules acyclic.
import {
  formatDate,
  normalizeIsoDateString,
  normalizeLocalDateString,
  parseCustomDate,
} from "@utils/dateUtils";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
  storedTimestampSecondsToMilliseconds,
} from "@utils/timeUtils";
import { supabase } from "@database/supaBaseClient";
import {
  programRepository,
  runningRepository,
  weightliftingRepository,
} from "@repository";
import {
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "@utils/syncUtils";
import { getStableSyncDeviceId } from "@utils/deviceIdentity";

export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const PROGRAM_CLOUD_TABLE = "Program";

const PROGRAM_STATUS_VALUES = new Set(["COMPLETE", "ACTIVE", "NOT_STARTED"]);

export const PROGRAM_CLOUD_SYNC_SELECT =
  "id, user_id, local_program_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, program_name, start_date, status";

export const MESOCYCLE_CLOUD_TABLE = "Mesocycle";

export const MESOCYCLE_CLOUD_SYNC_SELECT =
  "id, user_id, local_mesocycle_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_program_id, mesocycle_number, weeks, focus, done";

export const MICROCYCLE_CLOUD_TABLE = "Microcycle";

export const MICROCYCLE_CLOUD_SYNC_SELECT =
  "id, user_id, local_microcycle_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_mesocycle_id, microcycle_number, focus, done";

export const DAY_CLOUD_TABLE = "Day";

export const DAY_CLOUD_SYNC_SELECT =
  "id, user_id, local_day_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_microcycle_id, weekday, date, done, is_sick";

export const WORKOUT_TYPE_INSTANCE_CLOUD_TABLE = "workout_type_instance";

export const WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT =
  "id, user_id, local_workout_type_instance_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_day_id, workout_type, date, label, done, is_active, original_start_time, timer_start, elapsed_time";

export const EXERCISE_INSTANCE_CLOUD_TABLE = "exercise_instance";

export const EXERCISE_INSTANCE_CLOUD_SYNC_SELECT =
  "id, user_id, local_exercise_instance_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_workout_type_instance_id, exercise_name, exercise_order, sets, visible_columns, note, done";

export const SET_CLOUD_TABLE = "set";

export const SET_CLOUD_SYNC_SELECT =
  "id, user_id, local_set_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_exercise_instance_id, set_number, personal_record, pause, rpe, weight, rm_percentage, reps, done, failed, amrap, note";

const SYNC_WATCHERS_CLOUD_TABLE = "sync_local_watchers";

const CLOUD_CHILD_RELATIONSHIPS = {
  [PROGRAM_CLOUD_TABLE]: {
    tableName: MESOCYCLE_CLOUD_TABLE,
    foreignKey: "cloud_program_id",
  },
  [MESOCYCLE_CLOUD_TABLE]: {
    tableName: MICROCYCLE_CLOUD_TABLE,
    foreignKey: "cloud_mesocycle_id",
  },
  [MICROCYCLE_CLOUD_TABLE]: {
    tableName: DAY_CLOUD_TABLE,
    foreignKey: "cloud_microcycle_id",
  },
  [DAY_CLOUD_TABLE]: {
    tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
    foreignKey: "cloud_day_id",
  },
  [WORKOUT_TYPE_INSTANCE_CLOUD_TABLE]: {
    tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
    foreignKey: "cloud_workout_type_instance_id",
  },
  [EXERCISE_INSTANCE_CLOUD_TABLE]: {
    tableName: SET_CLOUD_TABLE,
    foreignKey: "cloud_exercise_instance_id",
  },
};

const EXERCISE_VISIBLE_COLUMN_KEYS = [
  "note",
  "rest",
  "set",
  "reps",
  "rpe",
  "rm_percentage",
  "weight",
  "done",
];

export function getWeekdayLabel(date) {
  return WEEK_DAYS[(date.getDay() + 6) % 7] ?? WEEK_DAYS[0];
}

export function isWorkoutLive(workout) {
  const timerStartSeconds = normalizeStoredTimestampSeconds(workout?.timer_start);

  return (
    Number(workout?.done) !== 1 &&
    (Number(workout?.is_active) === 1 || timerStartSeconds !== null)
  );
}

export function formatElapsedWorkoutDetail(workout) {
  const storedElapsedSeconds = normalizeElapsedDurationSeconds(
    workout?.elapsed_time,
    0
  );
  const timerStartSeconds = normalizeStoredTimestampSeconds(workout?.timer_start);
  const runningElapsedSeconds =
    timerStartSeconds !== null
      ? Math.max(0, Math.trunc(Date.now() / 1000) - timerStartSeconds)
      : 0;
  const totalElapsedSeconds = storedElapsedSeconds + runningElapsedSeconds;
  const totalElapsedMinutes = Math.max(1, Math.floor(totalElapsedSeconds / 60));

  return `${totalElapsedMinutes} min in`;
}

function normalizeProgramName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeProgramStartDate(value) {
  return normalizeLocalDateString(value);
}

function normalizeProgramStartDateForCloud(value) {
  return normalizeIsoDateString(value);
}

export function normalizeProgramStatus(value) {
  const normalizedStatus =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return PROGRAM_STATUS_VALUES.has(normalizedStatus)
    ? normalizedStatus
    : "NOT_STARTED";
}

export function resolveProgramCloudLocalId(program) {
  return normalizeOptionalInteger(
    program?.remote_local_program_id ??
      program?.local_program_id ??
      program?.program_id,
    null
  );
}

export function getComparableProgramSnapshot(program) {
  return {
    local_program_id: normalizeOptionalInteger(program?.local_program_id, null),
    program_name: normalizeProgramName(program?.program_name),
    start_date: normalizeProgramStartDate(program?.start_date),
    status: normalizeProgramStatus(program?.status),
  };
}

export function areComparableProgramsEqual(leftProgram, rightProgram) {
  const leftSnapshot = getComparableProgramSnapshot(leftProgram);
  const rightSnapshot = getComparableProgramSnapshot(rightProgram);

  return (
    leftSnapshot.program_name === rightSnapshot.program_name &&
    leftSnapshot.start_date === rightSnapshot.start_date &&
    leftSnapshot.status === rightSnapshot.status
  );
}

function getCloudSyncMetadataPayload(entity) {
  const deletedAt = normalizeDeletedAt(entity?.deleted_at);

  return {
    sync_id: normalizeSyncId(entity?.sync_id),
    sync_version: normalizeSyncVersion(entity?.sync_version, 0),
    deleted_at: deletedAt,
    last_updated: normalizeLastUpdatedForCloud(entity),
    is_deleting: normalizeBooleanFlag(entity?.is_deleting) || deletedAt !== null,
    delete_requested_at:
      normalizeOptionalText(entity?.delete_requested_at) ??
      (deletedAt !== null ? deletedAt : null),
  };
}

export function buildCloudProgramPayload(localProgram, userId) {
  return {
    user_id: userId,
    local_program_id: resolveProgramCloudLocalId(localProgram),
    ...getCloudSyncMetadataPayload(localProgram),
    program_name: normalizeProgramName(localProgram.program_name),
    start_date: normalizeProgramStartDateForCloud(localProgram.start_date),
    status: normalizeProgramStatus(localProgram.status),
  };
}

export function parseCloudProgramId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeOptionalInteger(value, fallbackValue = 0) {
  if (value === null || value === undefined || value === "") {
    return fallbackValue;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : fallbackValue;
}

export function resolveSideBySideCloudId(entity, legacyCloudIdColumn) {
  return normalizeOptionalInteger(
    entity?.cloud_id ?? entity?.[legacyCloudIdColumn],
    null
  );
}

export function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    return ["1", "true", "yes"].includes(normalizedValue);
  }

  return false;
}

function normalizeLastUpdatedMs(value, fallbackSyncVersion = null) {
  if (value === null || value === undefined || value === "") {
    const fallbackVersion = normalizeSyncVersion(fallbackSyncVersion, 0);
    return fallbackVersion > 0 ? fallbackVersion * 1000 : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return normalizeLastUpdatedMs(null, fallbackSyncVersion);
    }

    return value >= 100000000000
      ? Math.trunc(value)
      : Math.trunc(value * 1000);
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return normalizeLastUpdatedMs(numericValue, fallbackSyncVersion);
  }

  const parsedTime = Date.parse(value);
  return Number.isFinite(parsedTime)
    ? parsedTime
    : normalizeLastUpdatedMs(null, fallbackSyncVersion);
}

function normalizeLastUpdatedForCloud(entity) {
  const lastUpdatedMs = normalizeLastUpdatedMs(
    entity?.last_updated,
    entity?.sync_version
  );

  if (lastUpdatedMs === null) {
    return new Date().toISOString();
  }

  return new Date(lastUpdatedMs).toISOString();
}

function getEntitySyncState(entity) {
  return {
    sync_id: normalizeSyncId(entity?.sync_id),
    sync_version: normalizeSyncVersion(entity?.sync_version, 0),
    deleted_at: normalizeDeletedAt(entity?.deleted_at),
    last_updated_ms: normalizeLastUpdatedMs(
      entity?.last_updated,
      entity?.sync_version
    ),
    is_deleting: normalizeBooleanFlag(entity?.is_deleting),
  };
}

export function isCloudSnapshotDeleted(entity) {
  const syncState = getEntitySyncState(entity);
  return syncState.is_deleting || syncState.deleted_at !== null;
}

export function resolveCloudDeleteRequestedAt(entity) {
  return (
    normalizeOptionalText(entity?.delete_requested_at) ??
    normalizeDeletedAt(entity?.deleted_at) ??
    normalizeOptionalText(entity?.last_updated) ??
    new Date().toISOString()
  );
}

export function compareEntitySyncVersions(localEntity, cloudEntity) {
  const localSyncState = getEntitySyncState(localEntity);
  const cloudSyncState = getEntitySyncState(cloudEntity);
  const localLastUpdated = localSyncState.last_updated_ms;
  const cloudLastUpdated = cloudSyncState.last_updated_ms;

  if (localLastUpdated !== null && cloudLastUpdated !== null) {
    if (localLastUpdated === cloudLastUpdated) {
      return 0;
    }

    return localLastUpdated > cloudLastUpdated ? 1 : -1;
  }

  const localSyncVersion = localSyncState.sync_version;
  const cloudSyncVersion = cloudSyncState.sync_version;

  if (localSyncVersion === cloudSyncVersion) {
    return 0;
  }

  return localSyncVersion > cloudSyncVersion ? 1 : -1;
}

export function parseCloudMesocycleId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveMesocycleCloudLocalId(mesocycle) {
  return normalizeOptionalInteger(
    mesocycle?.remote_local_mesocycle_id ??
      mesocycle?.local_mesocycle_id ??
      mesocycle?.mesocycle_id,
    null
  );
}

export function parseCloudMicrocycleId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeWeekday(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeDayDate(value) {
  return normalizeLocalDateString(value);
}

function normalizeDayDateForCloud(value) {
  return normalizeIsoDateString(value);
}

export async function resolveDayDateFallback(
  db,
  { programId, programStartDate, mesocycleNumber, microcycleNumber, weekday }
) {
  const normalizedStartDate = normalizeLocalDateString(programStartDate);
  const normalizedWeekday = normalizeWeekday(weekday);
  const weekdayIndex = WEEK_DAYS.indexOf(normalizedWeekday);

  if (
    !normalizedStartDate ||
    weekdayIndex < 0 ||
    !Number.isFinite(Number(programId)) ||
    !Number.isFinite(Number(mesocycleNumber)) ||
    !Number.isFinite(Number(microcycleNumber))
  ) {
    return null;
  }

  const weeksBeforeResult = await getWeeksBeforeMesocycle(db, {
    programId,
    mesocycleNumber,
  });
  const weeksBefore = Number(weeksBeforeResult?.total_weeks) || 0;
  const date = parseCustomDate(normalizedStartDate);
  const daysOffset =
    (weeksBefore + Number(microcycleNumber) - 1) * 7 + weekdayIndex;

  date.setDate(date.getDate() + daysOffset);
  return formatDate(date);
}

export function parseCloudDayId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveDayCloudLocalId(day) {
  return normalizeOptionalInteger(
    day?.remote_local_day_id ?? day?.local_day_id ?? day?.day_id,
    null
  );
}

export async function ensureProgramCloudIdentity(db, userId, localProgram) {
  const remoteLocalProgramId = resolveProgramCloudLocalId(localProgram);
  const syncId = normalizeSyncId(localProgram?.sync_id);
  const currentCloudProgramId = parseCloudProgramId(
    resolveSideBySideCloudId(localProgram, "cloud_program_id")
  );

  if (!localProgram) {
    return null;
  }

  const cloudProgram = await findCloudRecordByIdentity({
    tableName: PROGRAM_CLOUD_TABLE,
    selectColumns: "id, local_program_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudProgramId,
    syncId,
    legacyLocalId: remoteLocalProgramId,
    legacyLocalIdColumn: "local_program_id",
  });

  const cloudProgramId = parseCloudProgramId(cloudProgram?.id);

  if (cloudProgramId !== null) {
    const syncedRemoteLocalProgramId =
      normalizeOptionalInteger(cloudProgram?.local_program_id, null) ??
      remoteLocalProgramId;

    if (
      currentCloudProgramId !== cloudProgramId ||
      resolveProgramCloudLocalId(localProgram) !== syncedRemoteLocalProgramId ||
      syncId !== normalizeSyncId(cloudProgram?.sync_id) ||
      normalizeSyncVersion(localProgram?.sync_version, 0) !==
        normalizeSyncVersion(cloudProgram?.sync_version, 0) ||
      normalizeDeletedAt(localProgram?.deleted_at) !==
        normalizeDeletedAt(cloudProgram?.deleted_at)
    ) {
      await programRepository.updateProgramCloudIdentity(db, {
        programId: localProgram.program_id,
        cloudProgramId,
        remoteLocalProgramId: syncedRemoteLocalProgramId,
        syncId: normalizeSyncId(cloudProgram?.sync_id),
        syncVersion: normalizeSyncVersion(cloudProgram?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudProgram?.deleted_at),
      });
    }

    return cloudProgramId;
  }

  if (
    resolveSideBySideCloudId(localProgram, "cloud_program_id") !== null ||
    Number(localProgram.needs_sync) !== 1
  ) {
    await programRepository.markProgramForCloudResync(db, {
      programId: localProgram.program_id,
    });
  }

  return null;
}

export async function ensureMesocycleCloudIdentity(db, userId, localMesocycle) {
  const remoteLocalMesocycleId = resolveMesocycleCloudLocalId(localMesocycle);
  const syncId = normalizeSyncId(localMesocycle?.sync_id);
  const currentCloudMesocycleId = parseCloudMesocycleId(
    resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
  );

  if (!localMesocycle) {
    return null;
  }

  const cloudMesocycle = await findCloudRecordByIdentity({
    tableName: MESOCYCLE_CLOUD_TABLE,
    selectColumns: "id, local_mesocycle_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudMesocycleId,
    syncId,
    legacyLocalId: remoteLocalMesocycleId,
    legacyLocalIdColumn: "local_mesocycle_id",
  });

  const cloudMesocycleId = parseCloudMesocycleId(cloudMesocycle?.id);

  if (cloudMesocycleId !== null) {
    const syncedRemoteLocalMesocycleId =
      normalizeOptionalInteger(cloudMesocycle?.local_mesocycle_id, null) ??
      remoteLocalMesocycleId;

    if (
      currentCloudMesocycleId !== cloudMesocycleId ||
      resolveMesocycleCloudLocalId(localMesocycle) !==
        syncedRemoteLocalMesocycleId ||
      syncId !== normalizeSyncId(cloudMesocycle?.sync_id) ||
      normalizeSyncVersion(localMesocycle?.sync_version, 0) !==
        normalizeSyncVersion(cloudMesocycle?.sync_version, 0) ||
      normalizeDeletedAt(localMesocycle?.deleted_at) !==
        normalizeDeletedAt(cloudMesocycle?.deleted_at)
    ) {
      await programRepository.updateMesocycleCloudIdentity(db, {
        mesocycleId: localMesocycle.mesocycle_id,
        cloudMesocycleId,
        remoteLocalMesocycleId: syncedRemoteLocalMesocycleId,
        syncId: normalizeSyncId(cloudMesocycle?.sync_id),
        syncVersion: normalizeSyncVersion(cloudMesocycle?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMesocycle?.deleted_at),
      });
    }

    return cloudMesocycleId;
  }

  if (
    resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id") !== null ||
    Number(localMesocycle.needs_sync) !== 1
  ) {
    await programRepository.markMesocycleForCloudResync(db, {
      mesocycleId: localMesocycle.mesocycle_id,
    });
  }

  return null;
}

export async function ensureMicrocycleCloudIdentity(db, userId, localMicrocycle) {
  const localMicrocycleId = normalizeOptionalInteger(
    localMicrocycle?.microcycle_id,
    null
  );
  const syncId = normalizeSyncId(localMicrocycle?.sync_id);
  const currentCloudMicrocycleId = parseCloudMicrocycleId(
    resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
  );

  if (!localMicrocycle) {
    return null;
  }

  const cloudMicrocycle = await findCloudRecordByIdentity({
    tableName: MICROCYCLE_CLOUD_TABLE,
    selectColumns: "id, local_microcycle_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudMicrocycleId,
    syncId,
    legacyLocalId: localMicrocycleId,
    legacyLocalIdColumn: "local_microcycle_id",
  });

  const cloudMicrocycleId = parseCloudMicrocycleId(cloudMicrocycle?.id);

  if (cloudMicrocycleId !== null) {
    if (
      currentCloudMicrocycleId !== cloudMicrocycleId ||
      syncId !== normalizeSyncId(cloudMicrocycle?.sync_id) ||
      normalizeSyncVersion(localMicrocycle?.sync_version, 0) !==
        normalizeSyncVersion(cloudMicrocycle?.sync_version, 0) ||
      normalizeDeletedAt(localMicrocycle?.deleted_at) !==
        normalizeDeletedAt(cloudMicrocycle?.deleted_at)
    ) {
      await programRepository.updateMicrocycleCloudIdentity(db, {
        microcycleId: localMicrocycle.microcycle_id,
        cloudMicrocycleId,
        syncId: normalizeSyncId(cloudMicrocycle?.sync_id),
        syncVersion: normalizeSyncVersion(cloudMicrocycle?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMicrocycle?.deleted_at),
      });
    }

    return cloudMicrocycleId;
  }

  if (
    resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id") !== null ||
    Number(localMicrocycle.needs_sync) !== 1
  ) {
    await programRepository.markMicrocycleForCloudResync(db, {
      microcycleId: localMicrocycle.microcycle_id,
    });
  }

  return null;
}

export async function ensureDayCloudIdentity(db, userId, localDay) {
  const remoteLocalDayId = resolveDayCloudLocalId(localDay);
  const syncId = normalizeSyncId(localDay?.sync_id);
  const currentCloudDayId = parseCloudDayId(
    resolveSideBySideCloudId(localDay, "cloud_day_id")
  );

  if (!localDay) {
    return null;
  }

  const cloudDay = await findCloudRecordByIdentity({
    tableName: DAY_CLOUD_TABLE,
    selectColumns: "id, local_day_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudDayId,
    syncId,
    legacyLocalId: remoteLocalDayId,
    legacyLocalIdColumn: "local_day_id",
  });

  const cloudDayId = parseCloudDayId(cloudDay?.id);

  if (cloudDayId !== null) {
    const syncedRemoteLocalDayId =
      normalizeOptionalInteger(cloudDay?.local_day_id, null) ??
      remoteLocalDayId;

    if (
      currentCloudDayId !== cloudDayId ||
      resolveDayCloudLocalId(localDay) !== syncedRemoteLocalDayId ||
      syncId !== normalizeSyncId(cloudDay?.sync_id) ||
      normalizeSyncVersion(localDay?.sync_version, 0) !==
        normalizeSyncVersion(cloudDay?.sync_version, 0) ||
      normalizeDeletedAt(localDay?.deleted_at) !==
        normalizeDeletedAt(cloudDay?.deleted_at)
    ) {
      await programRepository.updateDayCloudIdentity(db, {
        dayId: localDay.day_id,
        cloudDayId,
        remoteLocalDayId: syncedRemoteLocalDayId,
        syncId: normalizeSyncId(cloudDay?.sync_id),
        syncVersion: normalizeSyncVersion(cloudDay?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudDay?.deleted_at),
      });
    }

    return cloudDayId;
  }

  if (
    resolveSideBySideCloudId(localDay, "cloud_day_id") !== null ||
    Number(localDay.needs_sync) !== 1
  ) {
    await programRepository.markDayForCloudResync(db, {
      dayId: localDay.day_id,
    });
  }

  return null;
}

export async function ensureWorkoutTypeInstanceCloudIdentity(db, userId, localWorkout) {
  const remoteLocalWorkoutTypeInstanceId =
    resolveWorkoutTypeInstanceCloudLocalId(localWorkout);
  const syncId = normalizeSyncId(localWorkout?.sync_id);
  const currentCloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
    resolveSideBySideCloudId(
      localWorkout,
      "cloud_workout_type_instance_id"
    )
  );

  if (!localWorkout) {
    return null;
  }

  const cloudWorkout = await findCloudRecordByIdentity({
    tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
    selectColumns:
      "id, local_workout_type_instance_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudWorkoutTypeInstanceId,
    syncId,
    legacyLocalId: remoteLocalWorkoutTypeInstanceId,
    legacyLocalIdColumn: "local_workout_type_instance_id",
  });

  const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
    cloudWorkout?.id
  );

  if (cloudWorkoutTypeInstanceId !== null) {
    const syncedRemoteLocalWorkoutTypeInstanceId =
      normalizeOptionalInteger(
        cloudWorkout?.local_workout_type_instance_id,
        null
      ) ?? remoteLocalWorkoutTypeInstanceId;

    if (
      currentCloudWorkoutTypeInstanceId !== cloudWorkoutTypeInstanceId ||
      resolveWorkoutTypeInstanceCloudLocalId(localWorkout) !==
        syncedRemoteLocalWorkoutTypeInstanceId ||
      syncId !== normalizeSyncId(cloudWorkout?.sync_id) ||
      normalizeSyncVersion(localWorkout?.sync_version, 0) !==
        normalizeSyncVersion(cloudWorkout?.sync_version, 0) ||
      normalizeDeletedAt(localWorkout?.deleted_at) !==
        normalizeDeletedAt(cloudWorkout?.deleted_at)
    ) {
      await programRepository.updateWorkoutCloudIdentity(db, {
        workoutId: localWorkout.workout_id,
        cloudWorkoutTypeInstanceId,
        remoteLocalWorkoutTypeInstanceId:
          syncedRemoteLocalWorkoutTypeInstanceId,
        syncId: normalizeSyncId(cloudWorkout?.sync_id),
        syncVersion: normalizeSyncVersion(cloudWorkout?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudWorkout?.deleted_at),
      });
    }

    return cloudWorkoutTypeInstanceId;
  }

  if (
    parseCloudWorkoutTypeInstanceId(
      resolveSideBySideCloudId(
        localWorkout,
        "cloud_workout_type_instance_id"
      )
    ) !== null ||
    Number(localWorkout.needs_sync) !== 1
  ) {
    await programRepository.markWorkoutForCloudResync(db, {
      workoutId: localWorkout.workout_id,
    });
  }

  return null;
}

export async function ensureExerciseInstanceCloudIdentity(db, userId, localExercise) {
  const remoteLocalExerciseInstanceId =
    resolveExerciseInstanceCloudLocalId(localExercise);
  const syncId = normalizeSyncId(localExercise?.sync_id);
  const currentCloudExerciseInstanceId = parseCloudExerciseInstanceId(
    resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
  );

  if (!localExercise) {
    return null;
  }

  const cloudExercise = await findCloudRecordByIdentity({
    tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
    selectColumns:
      "id, local_exercise_instance_id, sync_id, sync_version, deleted_at",
    userId,
    cloudId: currentCloudExerciseInstanceId,
    syncId,
    legacyLocalId: remoteLocalExerciseInstanceId,
    legacyLocalIdColumn: "local_exercise_instance_id",
  });
  const cloudExerciseInstanceId = parseCloudExerciseInstanceId(cloudExercise?.id);

  if (cloudExerciseInstanceId !== null) {
    const syncedRemoteLocalExerciseInstanceId =
      normalizeOptionalInteger(cloudExercise?.local_exercise_instance_id, null) ??
      remoteLocalExerciseInstanceId;

    if (
      currentCloudExerciseInstanceId !== cloudExerciseInstanceId ||
      resolveExerciseInstanceCloudLocalId(localExercise) !==
        syncedRemoteLocalExerciseInstanceId ||
      syncId !== normalizeSyncId(cloudExercise?.sync_id) ||
      normalizeSyncVersion(localExercise?.sync_version, 0) !==
        normalizeSyncVersion(cloudExercise?.sync_version, 0) ||
      normalizeDeletedAt(localExercise?.deleted_at) !==
        normalizeDeletedAt(cloudExercise?.deleted_at)
    ) {
      await weightliftingRepository.updateExerciseCloudIdentity(db, {
        exerciseId: localExercise.exercise_instance_id,
        cloudExerciseInstanceId,
        remoteLocalExerciseInstanceId: syncedRemoteLocalExerciseInstanceId,
        syncId: normalizeSyncId(cloudExercise?.sync_id),
        syncVersion: normalizeSyncVersion(cloudExercise?.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudExercise?.deleted_at),
      });
    }

    return cloudExerciseInstanceId;
  }

  if (
    resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id") !==
      null ||
    Number(localExercise.needs_sync) !== 1
  ) {
    await weightliftingRepository.markExerciseForCloudResync(db, {
      exerciseId: localExercise.exercise_instance_id,
    });
  }

  return null;
}

export function getComparableMesocycleSnapshot(mesocycle) {
  return {
    cloud_program_id: normalizeOptionalInteger(
      mesocycle?.cloud_program_id,
      null
    ),
    mesocycle_number: normalizeOptionalInteger(mesocycle?.mesocycle_number, 0),
    weeks: normalizeOptionalInteger(mesocycle?.weeks, 0),
    focus: normalizeOptionalText(mesocycle?.focus),
    done: normalizeBooleanFlag(mesocycle?.done),
  };
}

export function areComparableMesocyclesEqual(leftMesocycle, rightMesocycle) {
  const leftSnapshot = getComparableMesocycleSnapshot(leftMesocycle);
  const rightSnapshot = getComparableMesocycleSnapshot(rightMesocycle);

  return (
    leftSnapshot.cloud_program_id === rightSnapshot.cloud_program_id &&
    leftSnapshot.mesocycle_number === rightSnapshot.mesocycle_number &&
    leftSnapshot.weeks === rightSnapshot.weeks &&
    leftSnapshot.focus === rightSnapshot.focus &&
    leftSnapshot.done === rightSnapshot.done
  );
}

export function buildCloudMesocyclePayload(localMesocycle, userId, cloudProgramId) {
  return {
    user_id: userId,
    local_mesocycle_id: resolveMesocycleCloudLocalId(localMesocycle),
    ...getCloudSyncMetadataPayload(localMesocycle),
    cloud_program_id: cloudProgramId,
    mesocycle_number: normalizeOptionalInteger(localMesocycle.mesocycle_number, 0),
    weeks: normalizeOptionalInteger(localMesocycle.weeks, 0),
    focus: normalizeOptionalText(localMesocycle.focus),
    done: normalizeBooleanFlag(localMesocycle.done),
  };
}

export function getComparableMicrocycleSnapshot(microcycle) {
  return {
    cloud_mesocycle_id: normalizeOptionalInteger(
      microcycle?.cloud_mesocycle_id,
      null
    ),
    microcycle_number: normalizeOptionalInteger(
      microcycle?.microcycle_number,
      0
    ),
    focus: normalizeOptionalText(microcycle?.focus),
    done: normalizeBooleanFlag(microcycle?.done),
  };
}

export function areComparableMicrocyclesEqual(leftMicrocycle, rightMicrocycle) {
  const leftSnapshot = getComparableMicrocycleSnapshot(leftMicrocycle);
  const rightSnapshot = getComparableMicrocycleSnapshot(rightMicrocycle);

  return (
    leftSnapshot.cloud_mesocycle_id === rightSnapshot.cloud_mesocycle_id &&
    leftSnapshot.microcycle_number === rightSnapshot.microcycle_number &&
    leftSnapshot.focus === rightSnapshot.focus &&
    leftSnapshot.done === rightSnapshot.done
  );
}

export function buildCloudMicrocyclePayload(localMicrocycle, userId, cloudMesocycleId) {
  return {
    user_id: userId,
    local_microcycle_id: localMicrocycle.microcycle_id,
    ...getCloudSyncMetadataPayload(localMicrocycle),
    cloud_mesocycle_id: cloudMesocycleId,
    microcycle_number: normalizeOptionalInteger(
      localMicrocycle.microcycle_number,
      0
    ),
    focus: normalizeOptionalText(localMicrocycle.focus),
    done: normalizeBooleanFlag(localMicrocycle.done),
  };
}

export function getComparableDaySnapshot(day) {
  return {
    local_day_id: normalizeOptionalInteger(day?.local_day_id, null),
    cloud_microcycle_id: normalizeOptionalInteger(
      day?.cloud_microcycle_id,
      null
    ),
    weekday: normalizeWeekday(day?.weekday ?? day?.Weekday),
    date: normalizeDayDate(day?.date),
    done: normalizeBooleanFlag(day?.done),
    is_sick: normalizeBooleanFlag(day?.is_sick),
  };
}

export function areComparableDaysEqual(leftDay, rightDay) {
  const leftSnapshot = getComparableDaySnapshot(leftDay);
  const rightSnapshot = getComparableDaySnapshot(rightDay);

  return (
    leftSnapshot.cloud_microcycle_id === rightSnapshot.cloud_microcycle_id &&
    leftSnapshot.weekday === rightSnapshot.weekday &&
    leftSnapshot.date === rightSnapshot.date &&
    leftSnapshot.done === rightSnapshot.done &&
    leftSnapshot.is_sick === rightSnapshot.is_sick
  );
}

export function buildCloudDayPayload(localDay, userId, cloudMicrocycleId) {
  return {
    user_id: userId,
    local_day_id: resolveDayCloudLocalId(localDay),
    ...getCloudSyncMetadataPayload(localDay),
    cloud_microcycle_id: cloudMicrocycleId,
    weekday: normalizeWeekday(localDay.weekday ?? localDay.Weekday),
    date: normalizeDayDateForCloud(localDay.date),
    done: normalizeBooleanFlag(localDay.done),
    is_sick: normalizeBooleanFlag(localDay.is_sick),
  };
}

export function getDayIdentityKey(microcycleId, weekday) {
  const normalizedMicrocycleId = normalizeOptionalInteger(microcycleId, null);
  const normalizedWeekday = normalizeWeekday(weekday);

  if (normalizedMicrocycleId === null || normalizedWeekday === null) {
    return null;
  }

  return `${normalizedMicrocycleId}:${normalizedWeekday.toLowerCase()}`;
}

export function getStandaloneDayIdentityKey(date) {
  const normalizedDate = normalizeDayDate(date);

  return normalizedDate ? `standalone:${normalizedDate}` : null;
}

export function parseCloudWorkoutTypeInstanceId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveWorkoutTypeInstanceCloudLocalId(workout) {
  return normalizeOptionalInteger(
    workout?.remote_local_workout_type_instance_id ??
      workout?.local_workout_type_instance_id ??
      workout?.workout_id,
    null
  );
}

export function normalizeWorkoutType(value) {
  return normalizeOptionalText(value);
}

export function normalizeWorkoutLabel(value) {
  return normalizeOptionalText(value);
}

function normalizeWorkoutDate(value) {
  return normalizeLocalDateString(value);
}

function normalizeWorkoutDateForCloud(value) {
  return normalizeIsoDateString(value);
}

function normalizeCloudTimeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "00");

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function timestampToCloudTimeString(value) {
  const normalizedTimestampMs = storedTimestampSecondsToMilliseconds(value);

  if (normalizedTimestampMs === null) {
    return null;
  }

  const date = new Date(normalizedTimestampMs);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function cloudTimeStringToLocalTimestamp(dateValue, timeValue) {
  const normalizedDate = normalizeLocalDateString(dateValue);
  const normalizedTime = normalizeCloudTimeString(timeValue);

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  const [day, month, year] = normalizedDate.split(".").map(Number);
  const [hours, minutes, seconds] = normalizedTime.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  const timestampMs = date.getTime();

  return Number.isNaN(timestampMs) ? null : Math.trunc(timestampMs / 1000);
}

export function getComparableWorkoutTypeInstanceSnapshot(workout) {
  return {
    local_workout_type_instance_id: normalizeOptionalInteger(
      workout?.local_workout_type_instance_id,
      null
    ),
    cloud_day_id: normalizeOptionalInteger(workout?.cloud_day_id, null),
    workout_type: normalizeWorkoutType(workout?.workout_type),
    date: normalizeWorkoutDate(workout?.date),
    label: normalizeWorkoutLabel(workout?.label),
    done: normalizeBooleanFlag(workout?.done),
    is_active: normalizeBooleanFlag(workout?.is_active),
    original_start_time: normalizeCloudTimeString(
      typeof workout?.original_start_time === "string"
        ? workout?.original_start_time
        : timestampToCloudTimeString(workout?.original_start_time)
    ),
    timer_start: normalizeCloudTimeString(
      typeof workout?.timer_start === "string"
        ? workout?.timer_start
        : timestampToCloudTimeString(workout?.timer_start)
    ),
    elapsed_time: normalizeElapsedDurationSeconds(workout?.elapsed_time, 0),
  };
}

export function areComparableWorkoutTypeInstancesEqual(leftWorkout, rightWorkout) {
  const leftSnapshot = getComparableWorkoutTypeInstanceSnapshot(leftWorkout);
  const rightSnapshot = getComparableWorkoutTypeInstanceSnapshot(rightWorkout);

  return (
    leftSnapshot.cloud_day_id === rightSnapshot.cloud_day_id &&
    leftSnapshot.workout_type === rightSnapshot.workout_type &&
    leftSnapshot.date === rightSnapshot.date &&
    leftSnapshot.label === rightSnapshot.label &&
    leftSnapshot.done === rightSnapshot.done &&
    leftSnapshot.is_active === rightSnapshot.is_active &&
    leftSnapshot.original_start_time === rightSnapshot.original_start_time &&
    leftSnapshot.timer_start === rightSnapshot.timer_start &&
    leftSnapshot.elapsed_time === rightSnapshot.elapsed_time
  );
}

export function buildCloudWorkoutTypeInstancePayload(localWorkout, userId, cloudDayId) {
  return {
    user_id: userId,
    local_workout_type_instance_id:
      resolveWorkoutTypeInstanceCloudLocalId(localWorkout),
    ...getCloudSyncMetadataPayload(localWorkout),
    cloud_day_id: cloudDayId,
    workout_type: normalizeWorkoutType(localWorkout.workout_type),
    date: normalizeWorkoutDateForCloud(localWorkout.date),
    label: normalizeWorkoutLabel(localWorkout.label),
    done: normalizeBooleanFlag(localWorkout.done),
    is_active: normalizeBooleanFlag(localWorkout.is_active),
    original_start_time: timestampToCloudTimeString(
      localWorkout.original_start_time
    ),
    timer_start: timestampToCloudTimeString(localWorkout.timer_start),
    elapsed_time: normalizeElapsedDurationSeconds(localWorkout.elapsed_time, 0),
  };
}

export function parseCloudExerciseInstanceId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveExerciseInstanceCloudLocalId(exercise) {
  return normalizeOptionalInteger(
    exercise?.remote_local_exercise_instance_id ??
      exercise?.local_exercise_instance_id ??
      exercise?.exercise_instance_id,
    null
  );
}

function normalizeExerciseName(value) {
  return normalizeOptionalText(value);
}

export function normalizeExerciseOrder(value) {
  return Math.max(0, normalizeOptionalInteger(value, 0) ?? 0);
}

function normalizeExerciseVisibleColumns(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (
    !parsedValue ||
    typeof parsedValue !== "object" ||
    Array.isArray(parsedValue)
  ) {
    return null;
  }

  const normalizedColumns = {};

  for (const key of EXERCISE_VISIBLE_COLUMN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsedValue, key)) {
      normalizedColumns[key] = Boolean(parsedValue[key]);
    }
  }

  return Object.keys(normalizedColumns).length > 0 ? normalizedColumns : null;
}

export function serializeExerciseVisibleColumns(value) {
  const normalizedColumns = normalizeExerciseVisibleColumns(value);
  return normalizedColumns ? JSON.stringify(normalizedColumns) : null;
}

export function getComparableExerciseInstanceSnapshot(exercise) {
  return {
    local_exercise_instance_id: normalizeOptionalInteger(
      exercise?.local_exercise_instance_id,
      null
    ),
    cloud_workout_type_instance_id: normalizeOptionalInteger(
      exercise?.cloud_workout_type_instance_id,
      null
    ),
    exercise_name: normalizeExerciseName(exercise?.exercise_name),
    exercise_order: normalizeExerciseOrder(exercise?.exercise_order),
    sets: normalizeOptionalInteger(exercise?.sets, 0),
    visible_columns: normalizeExerciseVisibleColumns(exercise?.visible_columns),
    note: normalizeOptionalText(exercise?.note),
    done: normalizeBooleanFlag(exercise?.done),
  };
}

export function areComparableExerciseInstancesEqual(leftExercise, rightExercise) {
  const leftSnapshot = getComparableExerciseInstanceSnapshot(leftExercise);
  const rightSnapshot = getComparableExerciseInstanceSnapshot(rightExercise);

  return (
    leftSnapshot.cloud_workout_type_instance_id ===
      rightSnapshot.cloud_workout_type_instance_id &&
    leftSnapshot.exercise_name === rightSnapshot.exercise_name &&
    leftSnapshot.exercise_order === rightSnapshot.exercise_order &&
    leftSnapshot.sets === rightSnapshot.sets &&
    JSON.stringify(leftSnapshot.visible_columns) ===
      JSON.stringify(rightSnapshot.visible_columns) &&
    leftSnapshot.note === rightSnapshot.note &&
    leftSnapshot.done === rightSnapshot.done
  );
}

export function buildCloudExerciseInstancePayload(
  localExercise,
  userId,
  cloudWorkoutTypeInstanceId
) {
  return {
    user_id: userId,
    local_exercise_instance_id:
      resolveExerciseInstanceCloudLocalId(localExercise),
    ...getCloudSyncMetadataPayload(localExercise),
    cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
    exercise_name: normalizeExerciseName(localExercise.exercise_name),
    exercise_order: normalizeExerciseOrder(localExercise.exercise_order),
    sets: normalizeOptionalInteger(localExercise.sets, 0),
    visible_columns: normalizeExerciseVisibleColumns(
      localExercise.visible_columns
    ),
    note: normalizeOptionalText(localExercise.note),
    done: normalizeBooleanFlag(localExercise.done),
  };
}

export function parseCloudSetId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveSetCloudLocalId(set) {
  return normalizeOptionalInteger(
    set?.remote_local_set_id ?? set?.local_set_id ?? set?.sets_id,
    null
  );
}

export function getComparableSetSnapshot(set) {
  return {
    local_set_id: normalizeOptionalInteger(set?.local_set_id, null),
    cloud_exercise_instance_id: normalizeOptionalInteger(
      set?.cloud_exercise_instance_id,
      null
    ),
    set_number: normalizeOptionalInteger(set?.set_number, null),
    personal_record: normalizeBooleanFlag(set?.personal_record),
    pause: normalizeOptionalInteger(set?.pause, null),
    rpe: normalizeOptionalInteger(set?.rpe, null),
    weight: normalizeOptionalInteger(set?.weight, null),
    rm_percentage: normalizeOptionalInteger(set?.rm_percentage, null),
    reps: normalizeOptionalInteger(set?.reps, null),
    done: normalizeBooleanFlag(set?.done),
    failed: normalizeBooleanFlag(set?.failed),
    amrap: normalizeBooleanFlag(set?.amrap),
    note: normalizeOptionalText(set?.note),
  };
}

export function areComparableSetsEqual(leftSet, rightSet) {
  const leftSnapshot = getComparableSetSnapshot(leftSet);
  const rightSnapshot = getComparableSetSnapshot(rightSet);

  return (
    leftSnapshot.cloud_exercise_instance_id ===
      rightSnapshot.cloud_exercise_instance_id &&
    leftSnapshot.set_number === rightSnapshot.set_number &&
    leftSnapshot.personal_record === rightSnapshot.personal_record &&
    leftSnapshot.pause === rightSnapshot.pause &&
    leftSnapshot.rpe === rightSnapshot.rpe &&
    leftSnapshot.weight === rightSnapshot.weight &&
    leftSnapshot.rm_percentage === rightSnapshot.rm_percentage &&
    leftSnapshot.reps === rightSnapshot.reps &&
    leftSnapshot.done === rightSnapshot.done &&
    leftSnapshot.failed === rightSnapshot.failed &&
    leftSnapshot.amrap === rightSnapshot.amrap &&
    leftSnapshot.note === rightSnapshot.note
  );
}

export function buildCloudSetPayload(localSet, userId, cloudExerciseInstanceId) {
  return {
    user_id: userId,
    local_set_id: resolveSetCloudLocalId(localSet),
    ...getCloudSyncMetadataPayload(localSet),
    cloud_exercise_instance_id: cloudExerciseInstanceId,
    set_number: normalizeOptionalInteger(localSet.set_number, null),
    personal_record: normalizeBooleanFlag(localSet.personal_record),
    pause: normalizeOptionalInteger(localSet.pause, null),
    rpe: normalizeOptionalInteger(localSet.rpe, null),
    weight: normalizeOptionalInteger(localSet.weight, null),
    rm_percentage: normalizeOptionalInteger(localSet.rm_percentage, null),
    reps: normalizeOptionalInteger(localSet.reps, null),
    done: normalizeBooleanFlag(localSet.done),
    failed: normalizeBooleanFlag(localSet.failed),
    amrap: normalizeBooleanFlag(localSet.amrap),
    note: normalizeOptionalText(localSet.note),
  };
}

export async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session?.user?.id ?? null;
}

async function claimCloudWatcher({ userId, tableName, cloudId, cloudRecord }) {
  const resolvedCloudId = normalizeOptionalInteger(cloudId, null);

  if (
    !userId ||
    !tableName ||
    resolvedCloudId === null ||
    isCloudSnapshotDeleted(cloudRecord)
  ) {
    return;
  }

  const deviceId = await getStableSyncDeviceId();
  const { error } = await supabase
    .from(SYNC_WATCHERS_CLOUD_TABLE)
    .upsert(
      {
        user_id: userId,
        entity_table: tableName,
        entity_id: resolvedCloudId,
        device_id: deviceId,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,entity_table,entity_id,device_id",
      }
    );

  if (error) {
    throw error;
  }
}

export async function claimCloudWatchers({ userId, tableName, cloudRecords }) {
  const claimableRecords = (cloudRecords ?? []).filter(
    (record) =>
      normalizeOptionalInteger(record?.id, null) !== null &&
      !isCloudSnapshotDeleted(record)
  );

  if (!claimableRecords.length) {
    return;
  }

  const deviceId = await getStableSyncDeviceId();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(SYNC_WATCHERS_CLOUD_TABLE)
    .upsert(
      claimableRecords.map((record) => ({
        user_id: userId,
        entity_table: tableName,
        entity_id: normalizeOptionalInteger(record.id, null),
        device_id: deviceId,
        last_seen_at: now,
      })),
      {
        onConflict: "user_id,entity_table,entity_id,device_id",
      }
    );

  if (error) {
    throw error;
  }
}

async function hasCloudChildren({ tableName, userId, cloudId }) {
  const childRelationship = CLOUD_CHILD_RELATIONSHIPS[tableName];

  if (!childRelationship) {
    return false;
  }

  const { count, error } = await supabase
    .from(childRelationship.tableName)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq(childRelationship.foreignKey, cloudId);

  if (error) {
    throw error;
  }

  return Number(count ?? 0) > 0;
}

async function hardDeleteCloudRecordIfReady({ tableName, userId, cloudId }) {
  const resolvedCloudId = normalizeOptionalInteger(cloudId, null);

  if (!userId || !tableName || resolvedCloudId === null) {
    return false;
  }

  const { data: record, error } = await supabase
    .from(tableName)
    .select("id, user_id, is_deleting, local_watchers")
    .eq("id", resolvedCloudId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !record ||
    !normalizeBooleanFlag(record.is_deleting) ||
    normalizeOptionalInteger(record.local_watchers, 0) > 0 ||
    (await hasCloudChildren({ tableName, userId, cloudId: resolvedCloudId }))
  ) {
    return false;
  }

  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .eq("id", resolvedCloudId)
    .eq("user_id", userId)
    .eq("is_deleting", true)
    .eq("local_watchers", 0);

  if (deleteError) {
    throw deleteError;
  }

  return true;
}

async function markCloudDescendantsDeleting({
  tableName,
  userId,
  cloudId,
  deleteRequestedAt,
}) {
  const resolvedCloudId = normalizeOptionalInteger(cloudId, null);
  const childRelationship = CLOUD_CHILD_RELATIONSHIPS[tableName];

  if (!userId || resolvedCloudId === null || !childRelationship) {
    return;
  }

  const { data: childRows, error } = await supabase
    .from(childRelationship.tableName)
    .select("id")
    .eq("user_id", userId)
    .eq(childRelationship.foreignKey, resolvedCloudId);

  if (error) {
    throw error;
  }

  for (const childRow of childRows ?? []) {
    const childCloudId = normalizeOptionalInteger(childRow?.id, null);

    if (childCloudId === null) {
      continue;
    }

    const { error: updateError } = await supabase
      .from(childRelationship.tableName)
      .update({
        deleted_at: deleteRequestedAt,
        last_updated: deleteRequestedAt,
        is_deleting: true,
        delete_requested_at: deleteRequestedAt,
      })
      .eq("id", childCloudId)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    await markCloudDescendantsDeleting({
      tableName: childRelationship.tableName,
      userId,
      cloudId: childCloudId,
      deleteRequestedAt,
    });
    await ackCloudWatcher({
      userId,
      tableName: childRelationship.tableName,
      cloudId: childCloudId,
    });
  }
}

export async function ackCloudDeletionCascade({
  userId,
  tableName,
  cloudId,
  deleteRequestedAt,
}) {
  const resolvedDeleteRequestedAt =
    normalizeOptionalText(deleteRequestedAt) ?? new Date().toISOString();

  await markCloudDescendantsDeleting({
    tableName,
    userId,
    cloudId,
    deleteRequestedAt: resolvedDeleteRequestedAt,
  });
  await ackCloudWatcher({ userId, tableName, cloudId });
}

async function ackCloudWatcher({ userId, tableName, cloudId }) {
  const resolvedCloudId = normalizeOptionalInteger(cloudId, null);

  if (!userId || !tableName || resolvedCloudId === null) {
    return;
  }

  const deviceId = await getStableSyncDeviceId();
  const { error } = await supabase
    .from(SYNC_WATCHERS_CLOUD_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("entity_table", tableName)
    .eq("entity_id", resolvedCloudId)
    .eq("device_id", deviceId);

  if (error) {
    throw error;
  }

  await hardDeleteCloudRecordIfReady({
    tableName,
    userId,
    cloudId: resolvedCloudId,
  });
}

export async function ensureDefaultDaysForMicrocycle(
  db,
  { microcycleId, programId, mesocycleNumber, microcycleNumber, startDate }
) {
  const existingDays = await programRepository.getDaysByMicrocycle(db, microcycleId);

  if (existingDays.length > 0) {
    return;
  }

  const weeksBefore = await getWeeksBeforeMesocycle(db, {
    programId,
    mesocycleNumber,
  });

  for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
    const currentDay = (weeksBefore + microcycleNumber - 1) * 7 + dayIndex;
    const date = parseCustomDate(startDate);

    date.setDate(date.getDate() + currentDay);

    await programRepository.insertDay(db, {
      microcycleId,
      programId,
      weekday: WEEK_DAYS[dayIndex],
      date: formatDate(date),
    });
  }
}

async function findCloudRecordByIdentity({
  tableName,
  selectColumns,
  userId,
  cloudId = null,
  syncId = null,
  legacyLocalId = null,
  legacyLocalIdColumn = null,
}) {
  if (cloudId !== null) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .eq("id", cloudId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (syncId) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .eq("user_id", userId)
      .eq("sync_id", syncId)
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.[0]) {
      return data[0];
    }
  }

  if (legacyLocalIdColumn && legacyLocalId !== null) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .eq("user_id", userId)
      .eq(legacyLocalIdColumn, legacyLocalId)
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.[0]) {
      return data[0];
    }
  }

  return null;
}

function getCloudMutationPayload(payload) {
  const { user_id: _userId, ...mutationPayload } = payload;
  return mutationPayload;
}

export async function syncDirtyLocalRowToCloud({
  tableName,
  selectColumns,
  userId,
  localEntity,
  payload,
  cloudId,
  syncId,
  legacyLocalId = null,
  legacyLocalIdColumn = null,
}) {
  const existingCloudRecord = await findCloudRecordByIdentity({
    tableName,
    selectColumns,
    userId,
    cloudId,
    syncId,
    legacyLocalId,
    legacyLocalIdColumn,
  });

  if (
    existingCloudRecord &&
    compareEntitySyncVersions(localEntity, existingCloudRecord) < 0
  ) {
    await claimCloudWatcher({
      userId,
      tableName,
      cloudId: existingCloudRecord.id,
      cloudRecord: existingCloudRecord,
    });

    return {
      uploaded: false,
      cloudWins: true,
      cloudRecord: existingCloudRecord,
    };
  }

  const mutationPayload = getCloudMutationPayload(payload);

  if (existingCloudRecord?.id) {
    const { data, error } = await supabase
      .from(tableName)
      .update(mutationPayload)
      .eq("id", existingCloudRecord.id)
      .eq("user_id", userId)
      .select(selectColumns)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      await claimCloudWatcher({
        userId,
        tableName,
        cloudId: data.id,
        cloudRecord: data,
      });

      return {
        uploaded: true,
        cloudWins: false,
        cloudRecord: data,
      };
    }
  }

  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select(selectColumns)
    .single();

  if (error) {
    throw error;
  }

  await claimCloudWatcher({
    userId,
    tableName,
    cloudId: data.id,
    cloudRecord: data,
  });

  return {
    uploaded: true,
    cloudWins: false,
    cloudRecord: data,
  };
}

export async function applyQueuedCloudDelete({
  tableName,
  selectColumns,
  userId,
  cloudId = null,
  syncId = null,
  legacyLocalId = null,
  legacyLocalIdColumn = null,
  deletedAt,
  syncVersion,
}) {
  const existingCloudRecord = await findCloudRecordByIdentity({
    tableName,
    selectColumns,
    userId,
    cloudId,
    syncId,
    legacyLocalId,
    legacyLocalIdColumn,
  });

  if (!existingCloudRecord?.id) {
    return false;
  }

  const existingSyncState = getEntitySyncState(existingCloudRecord);
  const queuedSyncVersion = normalizeSyncVersion(syncVersion, 0);
  const deleteRequestedAt =
    normalizeDeletedAt(deletedAt) ?? new Date().toISOString();

  if (existingSyncState.is_deleting || existingSyncState.deleted_at) {
    await ackCloudDeletionCascade({
      userId,
      tableName,
      cloudId: existingCloudRecord.id,
      deleteRequestedAt: resolveCloudDeleteRequestedAt(existingCloudRecord),
    });
    return false;
  }

  if (queuedSyncVersion <= existingSyncState.sync_version) {
    return false;
  }

  const { error } = await supabase
    .from(tableName)
    .update({
      sync_id: syncId ?? existingSyncState.sync_id,
      sync_version: queuedSyncVersion,
      deleted_at: deleteRequestedAt,
      last_updated: deleteRequestedAt,
      is_deleting: true,
      delete_requested_at: deleteRequestedAt,
    })
    .eq("id", existingCloudRecord.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  await ackCloudDeletionCascade({
    userId,
    tableName,
    cloudId: existingCloudRecord.id,
    deleteRequestedAt,
  });

  return true;
}

export function shouldKeepLocalEntityForCloudTombstone(localEntity, cloudEntity) {
  return (
    localEntity &&
    Number(localEntity.needs_sync) === 1 &&
    compareEntitySyncVersions(localEntity, cloudEntity) > 0
  );
}

export async function deleteLocalMesocycleHierarchy(db, mesocycleId) {
  await programRepository.deleteSetsByMesocycle(db, mesocycleId);
  await programRepository.deleteExercisesByMesocycle(db, mesocycleId);
  await programRepository.deleteRunsByMesocycle(db, mesocycleId);
  await programRepository.deleteWorkoutsByMesocycle(db, mesocycleId);
  await programRepository.deleteDaysByMesocycle(db, mesocycleId);
  await programRepository.deleteMicrocyclesByMesocycle(db, mesocycleId);
  await weightliftingRepository.deleteRmWeightProgressionsByMesocycle(
    db,
    mesocycleId
  );
  await programRepository.deleteMesocycleById(db, mesocycleId);
}

export async function deleteLocalMicrocycleHierarchy(db, microcycleId) {
  await programRepository.deleteSetsByMicrocycle(db, microcycleId);
  await programRepository.deleteExercisesByMicrocycle(db, microcycleId);
  await programRepository.deleteRunsByMicrocycle(db, microcycleId);
  await programRepository.deleteWorkoutsByMicrocycle(db, microcycleId);
  await programRepository.deleteDaysByMicrocycle(db, microcycleId);
  await programRepository.deleteMicrocycleById(db, microcycleId);
}

export async function deleteLocalWorkoutHierarchy(db, workoutId) {
  await weightliftingRepository.deleteSetsByWorkout(db, workoutId);
  await weightliftingRepository.deleteExercisesByWorkout(db, workoutId);
  await runningRepository.deleteRunSetsByWorkout(db, workoutId);
  await programRepository.deleteWorkoutById(db, workoutId);
}

export async function deleteLocalDayHierarchy(db, dayId) {
  const dayWorkouts = await programRepository.getWorkoutsByDayId(db, dayId);

  for (const dayWorkout of dayWorkouts) {
    await deleteLocalWorkoutHierarchy(db, dayWorkout.workout_id);
  }

  await programRepository.deleteDayById(db, dayId);
}

export async function getWeeksBeforeMesocycle(
  db,
  { programId, mesocycleNumber }
) {
  const row = await programRepository.getWeeksBeforeMesocycle(db, {
    programId,
    mesocycleNumber,
  });

  return row?.total_weeks ?? 0;
}
