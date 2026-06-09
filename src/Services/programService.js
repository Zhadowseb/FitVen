import {
  formatDate,
  normalizeIsoDateString,
  normalizeLocalDateString,
  parseCustomDate,
} from "../Utils/dateUtils";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
  storedTimestampSecondsToMilliseconds,
} from "../Utils/timeUtils";
import { supabase } from "../Database/supaBaseClient";
import {
  programRepository,
  runningRepository,
  weightliftingRepository,
  workoutRepository,
} from "../Repository";
import * as workoutService from "./workoutService";
import { withTransaction } from "./shared";
import { startBackgroundSync } from "./syncScheduler";
import {
  createNextSyncVersion,
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "../Utils/syncUtils";
import { getStableSyncDeviceId } from "../Utils/deviceIdentity";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const PROGRAM_CLOUD_TABLE = "Program";
const PROGRAM_STATUS_VALUES = new Set(["COMPLETE", "ACTIVE", "NOT_STARTED"]);
const PROGRAM_CLOUD_SYNC_SELECT =
  "id, user_id, local_program_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, program_name, start_date, status";
const MESOCYCLE_CLOUD_TABLE = "Mesocycle";
const MESOCYCLE_CLOUD_SYNC_SELECT =
  "id, user_id, local_mesocycle_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_program_id, mesocycle_number, weeks, focus, done";
const MICROCYCLE_CLOUD_TABLE = "Microcycle";
const MICROCYCLE_CLOUD_SYNC_SELECT =
  "id, user_id, local_microcycle_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_mesocycle_id, microcycle_number, focus, done";
const DAY_CLOUD_TABLE = "Day";
const DAY_CLOUD_SYNC_SELECT =
  "id, user_id, local_day_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_microcycle_id, weekday, date, done, is_sick";
const WORKOUT_TYPE_CLOUD_TABLE = "workout_type";
const WORKOUT_TYPE_CLOUD_SELECT = "type, display_name, is_active";
const WORKOUT_TYPE_INSTANCE_CLOUD_TABLE = "workout_type_instance";
const WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT =
  "id, user_id, local_workout_type_instance_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_day_id, workout_type, date, label, done, is_active, original_start_time, timer_start, elapsed_time";
const EXERCISE_INSTANCE_CLOUD_TABLE = "exercise_instance";
const EXERCISE_INSTANCE_CLOUD_SYNC_SELECT =
  "id, user_id, local_exercise_instance_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_workout_type_instance_id, exercise_name, exercise_order, sets, visible_columns, note, done";
const SET_CLOUD_TABLE = "set";
const SET_CLOUD_SYNC_SELECT =
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

function formatDisplayNumber(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getWeekdayLabel(date) {
  return WEEK_DAYS[(date.getDay() + 6) % 7] ?? WEEK_DAYS[0];
}

function isWorkoutLive(workout) {
  const timerStartSeconds = normalizeStoredTimestampSeconds(workout?.timer_start);

  return (
    Number(workout?.done) !== 1 &&
    (Number(workout?.is_active) === 1 || timerStartSeconds !== null)
  );
}

function formatElapsedWorkoutDetail(workout) {
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

function normalizeProgramStatus(value) {
  const normalizedStatus =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return PROGRAM_STATUS_VALUES.has(normalizedStatus)
    ? normalizedStatus
    : "NOT_STARTED";
}

function resolveProgramCloudLocalId(program) {
  return normalizeOptionalInteger(
    program?.remote_local_program_id ??
      program?.local_program_id ??
      program?.program_id,
    null
  );
}

function getComparableProgramSnapshot(program) {
  return {
    local_program_id: normalizeOptionalInteger(program?.local_program_id, null),
    program_name: normalizeProgramName(program?.program_name),
    start_date: normalizeProgramStartDate(program?.start_date),
    status: normalizeProgramStatus(program?.status),
  };
}

function areComparableProgramsEqual(leftProgram, rightProgram) {
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

function buildCloudProgramPayload(localProgram, userId) {
  return {
    user_id: userId,
    local_program_id: resolveProgramCloudLocalId(localProgram),
    ...getCloudSyncMetadataPayload(localProgram),
    program_name: normalizeProgramName(localProgram.program_name),
    start_date: normalizeProgramStartDateForCloud(localProgram.start_date),
    status: normalizeProgramStatus(localProgram.status),
  };
}

function parseCloudProgramId(value) {
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

function normalizeOptionalInteger(value, fallbackValue = 0) {
  if (value === null || value === undefined || value === "") {
    return fallbackValue;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : fallbackValue;
}

function resolveSideBySideCloudId(entity, legacyCloudIdColumn) {
  return normalizeOptionalInteger(
    entity?.cloud_id ?? entity?.[legacyCloudIdColumn],
    null
  );
}

function normalizeBooleanFlag(value) {
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

function isCloudSnapshotDeleted(entity) {
  const syncState = getEntitySyncState(entity);
  return syncState.is_deleting || syncState.deleted_at !== null;
}

function resolveCloudDeleteRequestedAt(entity) {
  return (
    normalizeOptionalText(entity?.delete_requested_at) ??
    normalizeDeletedAt(entity?.deleted_at) ??
    normalizeOptionalText(entity?.last_updated) ??
    new Date().toISOString()
  );
}

function compareEntitySyncVersions(localEntity, cloudEntity) {
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

function parseCloudMesocycleId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveMesocycleCloudLocalId(mesocycle) {
  return normalizeOptionalInteger(
    mesocycle?.remote_local_mesocycle_id ??
      mesocycle?.local_mesocycle_id ??
      mesocycle?.mesocycle_id,
    null
  );
}

function parseCloudMicrocycleId(value) {
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

async function resolveDayDateFallback(
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

function parseCloudDayId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveDayCloudLocalId(day) {
  return normalizeOptionalInteger(
    day?.remote_local_day_id ?? day?.local_day_id ?? day?.day_id,
    null
  );
}

async function ensureProgramCloudIdentity(db, userId, localProgram) {
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

async function ensureMesocycleCloudIdentity(db, userId, localMesocycle) {
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

async function ensureMicrocycleCloudIdentity(db, userId, localMicrocycle) {
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

async function ensureDayCloudIdentity(db, userId, localDay) {
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

async function ensureWorkoutTypeInstanceCloudIdentity(db, userId, localWorkout) {
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

async function ensureExerciseInstanceCloudIdentity(db, userId, localExercise) {
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

function getComparableMesocycleSnapshot(mesocycle) {
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

function areComparableMesocyclesEqual(leftMesocycle, rightMesocycle) {
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

function buildCloudMesocyclePayload(localMesocycle, userId, cloudProgramId) {
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

function getComparableMicrocycleSnapshot(microcycle) {
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

function areComparableMicrocyclesEqual(leftMicrocycle, rightMicrocycle) {
  const leftSnapshot = getComparableMicrocycleSnapshot(leftMicrocycle);
  const rightSnapshot = getComparableMicrocycleSnapshot(rightMicrocycle);

  return (
    leftSnapshot.cloud_mesocycle_id === rightSnapshot.cloud_mesocycle_id &&
    leftSnapshot.microcycle_number === rightSnapshot.microcycle_number &&
    leftSnapshot.focus === rightSnapshot.focus &&
    leftSnapshot.done === rightSnapshot.done
  );
}

function buildCloudMicrocyclePayload(localMicrocycle, userId, cloudMesocycleId) {
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

function getComparableDaySnapshot(day) {
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

function areComparableDaysEqual(leftDay, rightDay) {
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

function buildCloudDayPayload(localDay, userId, cloudMicrocycleId) {
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

function getDayIdentityKey(microcycleId, weekday) {
  const normalizedMicrocycleId = normalizeOptionalInteger(microcycleId, null);
  const normalizedWeekday = normalizeWeekday(weekday);

  if (normalizedMicrocycleId === null || normalizedWeekday === null) {
    return null;
  }

  return `${normalizedMicrocycleId}:${normalizedWeekday.toLowerCase()}`;
}

function getStandaloneDayIdentityKey(date) {
  const normalizedDate = normalizeDayDate(date);

  return normalizedDate ? `standalone:${normalizedDate}` : null;
}

function parseCloudWorkoutTypeInstanceId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveWorkoutTypeInstanceCloudLocalId(workout) {
  return normalizeOptionalInteger(
    workout?.remote_local_workout_type_instance_id ??
      workout?.local_workout_type_instance_id ??
      workout?.workout_id,
    null
  );
}

function normalizeWorkoutType(value) {
  return normalizeOptionalText(value);
}

function normalizeWorkoutLabel(value) {
  return normalizeOptionalText(value);
}

function normalizeWorkoutTypeCatalogRow(row) {
  const name = normalizeWorkoutType(row?.type);

  if (!name) {
    return null;
  }

  return {
    name,
    displayName: normalizeWorkoutLabel(row?.display_name) ?? name,
    isActive: normalizeBooleanFlag(row?.is_active),
  };
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

function cloudTimeStringToLocalTimestamp(dateValue, timeValue) {
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

function getComparableWorkoutTypeInstanceSnapshot(workout) {
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

function areComparableWorkoutTypeInstancesEqual(leftWorkout, rightWorkout) {
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

function buildCloudWorkoutTypeInstancePayload(localWorkout, userId, cloudDayId) {
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

function parseCloudExerciseInstanceId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveExerciseInstanceCloudLocalId(exercise) {
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

function normalizeExerciseOrder(value) {
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

function serializeExerciseVisibleColumns(value) {
  const normalizedColumns = normalizeExerciseVisibleColumns(value);
  return normalizedColumns ? JSON.stringify(normalizedColumns) : null;
}

function getComparableExerciseInstanceSnapshot(exercise) {
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

function areComparableExerciseInstancesEqual(leftExercise, rightExercise) {
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

function buildCloudExerciseInstancePayload(
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

function parseCloudSetId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveSetCloudLocalId(set) {
  return normalizeOptionalInteger(
    set?.remote_local_set_id ?? set?.local_set_id ?? set?.sets_id,
    null
  );
}

function getComparableSetSnapshot(set) {
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

function areComparableSetsEqual(leftSet, rightSet) {
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

function buildCloudSetPayload(localSet, userId, cloudExerciseInstanceId) {
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

async function getAuthenticatedUserId() {
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

async function claimCloudWatchers({ userId, tableName, cloudRecords }) {
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

async function ackCloudDeletionCascade({
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

export async function getSelectableWorkoutTypes(db) {
  return programRepository.getSelectableWorkoutTypes(db);
}

export async function syncWorkoutTypesWithCloud(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return getSelectableWorkoutTypes(db);
  }

  const { data, error } = await supabase
    .from(WORKOUT_TYPE_CLOUD_TABLE)
    .select(WORKOUT_TYPE_CLOUD_SELECT)
    .order("is_active", { ascending: false })
    .order("type", { ascending: true });

  if (error) {
    throw error;
  }

  const workoutTypes = (data ?? [])
    .map(normalizeWorkoutTypeCatalogRow)
    .filter(Boolean);

  await withTransaction(db, async () => {
    await programRepository.markAllWorkoutTypesInactive(db);

    for (const workoutType of workoutTypes) {
      await programRepository.upsertWorkoutType(db, workoutType);
    }
  });

  return getSelectableWorkoutTypes(db);
}

async function pushDirtyProgramHierarchyWithCloudInternal(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  let deletedCount = 0;
  deletedCount += await processQueuedProgramDeletes(db, userId);
  deletedCount += await processQueuedMesocycleDeletes(db, userId);
  deletedCount += await processQueuedMicrocycleDeletes(db, userId);
  deletedCount += await processQueuedWorkoutTypeInstanceDeletes(db, userId);
  deletedCount += await processQueuedExerciseInstanceDeletes(db, userId);
  deletedCount += await processQueuedSetDeletes(db, userId);

  let uploadedCount = 0;
  uploadedCount += await uploadDirtyPrograms(db, userId);
  uploadedCount += await uploadDirtyMesocycles(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyMicrocycles(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyDays(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyWorkoutTypeInstances(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyExerciseInstances(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtySets(db, userId, {
    allowParentRepair: false,
  });

  return {
    changed: deletedCount > 0 || uploadedCount > 0,
    deletedCount,
    downloadedCount: 0,
    uploadedCount,
  };
}

export async function refreshSelectableWorkoutTypes(db) {
  try {
    return await syncWorkoutTypesWithCloud(db);
  } catch (error) {
    console.warn("Workout type catalog cloud sync failed:", error);
    return getSelectableWorkoutTypes(db);
  }
}

async function processQueuedProgramDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedProgramDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: PROGRAM_CLOUD_TABLE,
      selectColumns: PROGRAM_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudProgramId(queuedDelete.cloud_program_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedProgramDelete(
      db,
      queuedDelete.program_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtyPrograms(db, userId) {
  const localPrograms = await programRepository.getProgramsForCloudSync(db);
  let uploadedCount = 0;

  for (const localProgram of localPrograms) {
    if (Number(localProgram.needs_sync) !== 1) {
      continue;
    }

    const payload = buildCloudProgramPayload(localProgram, userId);

    if (payload.local_program_id === null || !payload.start_date) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: PROGRAM_CLOUD_TABLE,
      selectColumns: PROGRAM_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localProgram,
      payload,
      cloudId: parseCloudProgramId(
        resolveSideBySideCloudId(localProgram, "cloud_program_id")
      ),
      syncId: normalizeSyncId(localProgram.sync_id),
      legacyLocalId: payload.local_program_id,
      legacyLocalIdColumn: "local_program_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudProgramId = parseCloudProgramId(syncResult.cloudRecord?.id);

    if (cloudProgramId === null) {
      throw new Error("Could not resolve cloud program id after sync.");
    }

    const remoteLocalProgramId =
      resolveProgramCloudLocalId(syncResult.cloudRecord) ?? payload.local_program_id;

    await programRepository.markProgramSynced(db, {
      programId: localProgram.program_id,
      cloudProgramId,
      remoteLocalProgramId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  return uploadedCount;
}

async function reconcileProgramsFromCloud(db, userId) {
  const { data: cloudPrograms, error } = await supabase
    .from(PROGRAM_CLOUD_TABLE)
    .select(PROGRAM_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: PROGRAM_CLOUD_TABLE,
    cloudRecords: cloudPrograms,
  });

  const localPrograms = await programRepository.getProgramsForCloudSync(db);
  const localProgramsByCloudId = new Map();
  const localProgramsBySyncId = new Map();
  const localProgramsByRemoteLocalId = new Map();

  for (const localProgram of localPrograms) {
    const cloudProgramId = parseCloudProgramId(
      resolveSideBySideCloudId(localProgram, "cloud_program_id")
    );
    const syncId = normalizeSyncId(localProgram.sync_id);
    const remoteLocalProgramId = resolveProgramCloudLocalId(localProgram);

    if (cloudProgramId !== null) {
      localProgramsByCloudId.set(cloudProgramId, localProgram);
    }

    if (syncId) {
      localProgramsBySyncId.set(syncId, localProgram);
    }

    if (remoteLocalProgramId !== null) {
      localProgramsByRemoteLocalId.set(remoteLocalProgramId, localProgram);
    }
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudProgram of cloudPrograms ?? []) {
      const cloudProgramId = parseCloudProgramId(cloudProgram.id);
      const comparableCloudProgram = getComparableProgramSnapshot(cloudProgram);
      const cloudSyncId = normalizeSyncId(cloudProgram.sync_id);

      if (
        cloudProgramId === null ||
        comparableCloudProgram.local_program_id === null ||
        !comparableCloudProgram.start_date
      ) {
        continue;
      }

      const localProgram =
        localProgramsByCloudId.get(cloudProgramId) ??
        localProgramsBySyncId.get(cloudSyncId) ??
        localProgramsByRemoteLocalId.get(comparableCloudProgram.local_program_id) ??
        null;

      if (isCloudSnapshotDeleted(cloudProgram)) {
        pendingDeletionAcks.push({
          userId,
          tableName: PROGRAM_CLOUD_TABLE,
          cloudId: cloudProgramId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudProgram),
        });

        if (localProgram) {
          if (
            shouldKeepLocalEntityForCloudTombstone(localProgram, cloudProgram)
          ) {
            continue;
          }

          await programRepository.deleteSetsByProgram(db, localProgram.program_id);
          await programRepository.deleteExercisesByProgram(db, localProgram.program_id);
          await programRepository.deleteRunsByProgram(db, localProgram.program_id);
          await programRepository.deleteWorkoutsByProgram(db, localProgram.program_id);
          await programRepository.deleteDaysByProgram(db, localProgram.program_id);
          await programRepository.deleteMicrocyclesByProgram(db, localProgram.program_id);
          await programRepository.deleteEstimatedSetsByProgram(
            db,
            localProgram.program_id
          );
          await weightliftingRepository.deleteRmWeightProgressionsByProgram(
            db,
            localProgram.program_id
          );
          await programRepository.deleteProgramBestExercisesByProgram(
            db,
            localProgram.program_id
          );
          await programRepository.deleteMesocyclesByProgram(db, localProgram.program_id);
          await programRepository.deleteProgramById(db, localProgram.program_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localProgram) {
        const result = await programRepository.createProgramFromCloud(db, {
          cloudProgramId,
          remoteLocalProgramId: comparableCloudProgram.local_program_id,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
          programName: comparableCloudProgram.program_name,
          startDate: comparableCloudProgram.start_date,
          status: comparableCloudProgram.status,
        });

        const createdProgram = {
          program_id: result.lastInsertRowId,
          cloud_program_id: cloudProgramId,
          remote_local_program_id: comparableCloudProgram.local_program_id,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
          ...comparableCloudProgram,
          needs_sync: 0,
        };

        localProgramsByCloudId.set(cloudProgramId, createdProgram);
        if (cloudSyncId) {
          localProgramsBySyncId.set(cloudSyncId, createdProgram);
        }
        localProgramsByRemoteLocalId.set(
          comparableCloudProgram.local_program_id,
          createdProgram
        );
        downloadedCount += 1;
        continue;
      }

      if (Number(localProgram.needs_sync) === 1) {
        if (compareEntitySyncVersions(localProgram, cloudProgram) < 0) {
          await programRepository.updateProgramFromCloud(db, {
            programId: localProgram.program_id,
            cloudProgramId,
            remoteLocalProgramId: comparableCloudProgram.local_program_id,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
            programName: comparableCloudProgram.program_name,
            startDate: comparableCloudProgram.start_date,
            status: comparableCloudProgram.status,
          });
          downloadedCount += 1;
        }

        continue;
      }

      if (areComparableProgramsEqual(localProgram, comparableCloudProgram)) {
        if (
          resolveSideBySideCloudId(localProgram, "cloud_program_id") === null ||
          resolveProgramCloudLocalId(localProgram) !==
            comparableCloudProgram.local_program_id ||
          normalizeSyncId(localProgram.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localProgram.sync_version, 0) !==
            normalizeSyncVersion(cloudProgram.sync_version, 0) ||
          normalizeDeletedAt(localProgram.deleted_at) !==
            normalizeDeletedAt(cloudProgram.deleted_at)
        ) {
          await programRepository.markProgramSynced(db, {
            programId: localProgram.program_id,
            cloudProgramId,
            remoteLocalProgramId: comparableCloudProgram.local_program_id,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateProgramFromCloud(db, {
        programId: localProgram.program_id,
        cloudProgramId,
        remoteLocalProgramId: comparableCloudProgram.local_program_id,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
        programName: comparableCloudProgram.program_name,
        startDate: comparableCloudProgram.start_date,
        status: comparableCloudProgram.status,
      });

      localProgramsByCloudId.set(cloudProgramId, {
        ...localProgram,
        cloud_program_id: cloudProgramId,
        remote_local_program_id: comparableCloudProgram.local_program_id,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
        ...comparableCloudProgram,
        needs_sync: 0,
      });
      localProgramsByRemoteLocalId.set(comparableCloudProgram.local_program_id, {
        ...localProgram,
        cloud_program_id: cloudProgramId,
        remote_local_program_id: comparableCloudProgram.local_program_id,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
        ...comparableCloudProgram,
        needs_sync: 0,
      });
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncProgramsWithCloudInternal(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedProgramDeletes(db, userId);
  const uploadedCount = await uploadDirtyPrograms(db, userId);
  const downloadedCount = await reconcileProgramsFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

function syncProgramsInBackground(db) {
  startBackgroundSync(
    () => syncProgramsWithCloud(db),
    "Program cloud sync failed:"
  );
}

async function processQueuedMesocycleDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedMesocycleDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: MESOCYCLE_CLOUD_TABLE,
      selectColumns: MESOCYCLE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudMesocycleId(queuedDelete.cloud_mesocycle_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedMesocycleDelete(
      db,
      queuedDelete.mesocycle_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtyMesocycles(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  let uploadedCount = 0;
  let requiresProgramRepair = false;

  for (const localMesocycle of localMesocycles) {
    if (Number(localMesocycle.needs_sync) !== 1) {
      continue;
    }

    const parentProgram = localProgramsById.get(localMesocycle.program_id);
    const parentProgramCloudId = await ensureProgramCloudIdentity(
      db,
      userId,
      parentProgram
    );

    if (parentProgramCloudId === null) {
      requiresProgramRepair = true;
      continue;
    }

    const payload = buildCloudMesocyclePayload(
      localMesocycle,
      userId,
      parentProgramCloudId
    );

    if (payload.local_mesocycle_id === null) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: MESOCYCLE_CLOUD_TABLE,
      selectColumns: MESOCYCLE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localMesocycle,
      payload,
      cloudId: parseCloudMesocycleId(
        resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
      ),
      syncId: normalizeSyncId(localMesocycle.sync_id),
      legacyLocalId: payload.local_mesocycle_id,
      legacyLocalIdColumn: "local_mesocycle_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudMesocycleId = parseCloudMesocycleId(syncResult.cloudRecord?.id);

    if (cloudMesocycleId === null) {
      throw new Error("Could not resolve cloud mesocycle id after sync.");
    }

    const remoteLocalMesocycleId =
      resolveMesocycleCloudLocalId(syncResult.cloudRecord) ??
      payload.local_mesocycle_id;

    await programRepository.markMesocycleSynced(db, {
      mesocycleId: localMesocycle.mesocycle_id,
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresProgramRepair && allowParentRepair) {
    await syncProgramsWithCloud(db);
    uploadedCount += await uploadDirtyMesocycles(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileMesocyclesFromCloud(db, userId) {
  const { data: cloudMesocycles, error } = await supabase
    .from(MESOCYCLE_CLOUD_TABLE)
    .select(MESOCYCLE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_program_id", { ascending: true })
    .order("mesocycle_number", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: MESOCYCLE_CLOUD_TABLE,
    cloudRecords: cloudMesocycles,
  });

  const [localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localMesocyclesByCloudId = new Map();
  const localMesocyclesBySyncId = new Map();
  const localMesocyclesByRemoteLocalId = new Map();
  const localMesocyclesByLocalId = new Map();
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localProgramsByCloudId = new Map();

  for (const localProgram of localPrograms) {
    const cloudProgramId = parseCloudProgramId(
      resolveSideBySideCloudId(localProgram, "cloud_program_id")
    );

    if (cloudProgramId !== null) {
      localProgramsByCloudId.set(cloudProgramId, localProgram);
    }
  }

  for (const localMesocycle of localMesocycles) {
    const cloudMesocycleId = parseCloudMesocycleId(
      resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
    );
    const syncId = normalizeSyncId(localMesocycle.sync_id);
    const remoteLocalMesocycleId = resolveMesocycleCloudLocalId(localMesocycle);

    if (cloudMesocycleId !== null) {
      localMesocyclesByCloudId.set(cloudMesocycleId, localMesocycle);
    }

    if (syncId) {
      localMesocyclesBySyncId.set(syncId, localMesocycle);
    }

    if (remoteLocalMesocycleId !== null) {
      localMesocyclesByRemoteLocalId.set(remoteLocalMesocycleId, localMesocycle);
    }

    localMesocyclesByLocalId.set(localMesocycle.mesocycle_id, localMesocycle);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudMesocycle of cloudMesocycles ?? []) {
      const cloudMesocycleId = parseCloudMesocycleId(cloudMesocycle.id);
      const cloudSyncId = normalizeSyncId(cloudMesocycle.sync_id);
      const localMesocycleId = normalizeOptionalInteger(
        cloudMesocycle.local_mesocycle_id,
        null
      );
      const cloudProgramId = normalizeOptionalInteger(
        cloudMesocycle.cloud_program_id,
        null
      );
      const parentProgram = localProgramsByCloudId.get(cloudProgramId);
      const comparableCloudMesocycle = getComparableMesocycleSnapshot(
        cloudMesocycle
      );

      if (
        cloudMesocycleId === null ||
        localMesocycleId === null ||
        cloudProgramId === null ||
        !parentProgram
      ) {
        continue;
      }

      const localMesocycle =
        localMesocyclesByCloudId.get(cloudMesocycleId) ??
        localMesocyclesBySyncId.get(cloudSyncId) ??
        localMesocyclesByRemoteLocalId.get(localMesocycleId) ??
        localMesocyclesByLocalId.get(localMesocycleId) ??
        null;

      if (isCloudSnapshotDeleted(cloudMesocycle)) {
        pendingDeletionAcks.push({
          userId,
          tableName: MESOCYCLE_CLOUD_TABLE,
          cloudId: cloudMesocycleId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudMesocycle),
        });

        if (localMesocycle) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localMesocycle,
              cloudMesocycle
            )
          ) {
            continue;
          }

          await deleteLocalMesocycleHierarchy(db, localMesocycle.mesocycle_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localMesocycle) {
        await programRepository.createMesocycleFromCloud(db, {
          localMesocycleId,
          cloudMesocycleId,
          remoteLocalMesocycleId: localMesocycleId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          programId: parentProgram.program_id,
          mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
          weeks: comparableCloudMesocycle.weeks,
          focus: comparableCloudMesocycle.focus,
          done: comparableCloudMesocycle.done,
        });

        const createdMesocycle = {
          mesocycle_id: localMesocycleId,
          cloud_mesocycle_id: cloudMesocycleId,
          remote_local_mesocycle_id: localMesocycleId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudMesocycle.deleted_at),
          program_id: parentProgram.program_id,
          mesocycle_number: comparableCloudMesocycle.mesocycle_number,
          weeks: comparableCloudMesocycle.weeks,
          focus: comparableCloudMesocycle.focus,
          done: comparableCloudMesocycle.done ? 1 : 0,
          needs_sync: 0,
        };

        localMesocyclesByCloudId.set(cloudMesocycleId, createdMesocycle);
        if (cloudSyncId) {
          localMesocyclesBySyncId.set(cloudSyncId, createdMesocycle);
        }
        localMesocyclesByRemoteLocalId.set(localMesocycleId, createdMesocycle);
        localMesocyclesByLocalId.set(localMesocycleId, createdMesocycle);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalMesocycle = getComparableMesocycleSnapshot({
        ...localMesocycle,
        cloud_program_id: parseCloudProgramId(
          resolveSideBySideCloudId(
            localProgramsById.get(localMesocycle.program_id),
            "cloud_program_id"
          )
        ),
      });

      if (Number(localMesocycle.needs_sync) === 1) {
        if (compareEntitySyncVersions(localMesocycle, cloudMesocycle) < 0) {
          await programRepository.updateMesocycleFromCloud(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
            programId: parentProgram.program_id,
            mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
            weeks: comparableCloudMesocycle.weeks,
            focus: comparableCloudMesocycle.focus,
            done: comparableCloudMesocycle.done,
          });
          downloadedCount += 1;
        } else if (
          areComparableMesocyclesEqual(
            comparableLocalMesocycle,
            comparableCloudMesocycle
          )
        ) {
          await programRepository.markMesocycleSynced(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id") === null ||
          resolveMesocycleCloudLocalId(localMesocycle) !== localMesocycleId ||
          normalizeSyncId(localMesocycle.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateMesocycleCloudIdentity(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        }

        continue;
      }

      if (
        areComparableMesocyclesEqual(
          comparableLocalMesocycle,
          comparableCloudMesocycle
        )
      ) {
        if (
          resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id") === null ||
          resolveMesocycleCloudLocalId(localMesocycle) !== localMesocycleId ||
          normalizeSyncId(localMesocycle.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localMesocycle.sync_version, 0) !==
            normalizeSyncVersion(cloudMesocycle.sync_version, 0) ||
          normalizeDeletedAt(localMesocycle.deleted_at) !==
            normalizeDeletedAt(cloudMesocycle.deleted_at)
        ) {
          await programRepository.markMesocycleSynced(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateMesocycleFromCloud(db, {
        mesocycleId: localMesocycle.mesocycle_id,
        cloudMesocycleId,
        remoteLocalMesocycleId: localMesocycleId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
        programId: parentProgram.program_id,
        mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
        weeks: comparableCloudMesocycle.weeks,
        focus: comparableCloudMesocycle.focus,
        done: comparableCloudMesocycle.done,
      });

      const updatedMesocycle = {
        ...localMesocycle,
        cloud_mesocycle_id: cloudMesocycleId,
        remote_local_mesocycle_id: localMesocycleId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudMesocycle.deleted_at),
        program_id: parentProgram.program_id,
        mesocycle_number: comparableCloudMesocycle.mesocycle_number,
        weeks: comparableCloudMesocycle.weeks,
        focus: comparableCloudMesocycle.focus,
        done: comparableCloudMesocycle.done ? 1 : 0,
        needs_sync: 0,
      };

      localMesocyclesByCloudId.set(cloudMesocycleId, updatedMesocycle);
      if (cloudSyncId) {
        localMesocyclesBySyncId.set(cloudSyncId, updatedMesocycle);
      }
      localMesocyclesByRemoteLocalId.set(localMesocycleId, updatedMesocycle);
      localMesocyclesByLocalId.set(localMesocycle.mesocycle_id, updatedMesocycle);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncMesocyclesWithCloudInternal(db) {
  await syncProgramsWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedMesocycleDeletes(db, userId);
  const uploadedCount = await uploadDirtyMesocycles(db, userId);
  const downloadedCount = await reconcileMesocyclesFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

async function processQueuedMicrocycleDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedMicrocycleDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: MICROCYCLE_CLOUD_TABLE,
      selectColumns: MICROCYCLE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudMicrocycleId(queuedDelete.cloud_microcycle_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedMicrocycleDelete(
      db,
      queuedDelete.microcycle_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtyMicrocycles(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localMicrocycles, localMesocycles] = await Promise.all([
    programRepository.getMicrocyclesForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  let uploadedCount = 0;
  let requiresMesocycleRepair = false;

  for (const localMicrocycle of localMicrocycles) {
    if (Number(localMicrocycle.needs_sync) !== 1) {
      continue;
    }

    const parentMesocycle = localMesocyclesById.get(
      localMicrocycle.mesocycle_id
    );
    const parentMesocycleCloudId = await ensureMesocycleCloudIdentity(
      db,
      userId,
      parentMesocycle
    );

    if (parentMesocycleCloudId === null) {
      requiresMesocycleRepair = true;
      continue;
    }

    const payload = buildCloudMicrocyclePayload(
      localMicrocycle,
      userId,
      parentMesocycleCloudId
    );

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: MICROCYCLE_CLOUD_TABLE,
      selectColumns: MICROCYCLE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localMicrocycle,
      payload,
      cloudId: parseCloudMicrocycleId(
        resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
      ),
      syncId: normalizeSyncId(localMicrocycle.sync_id),
      legacyLocalId: payload.local_microcycle_id,
      legacyLocalIdColumn: "local_microcycle_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudMicrocycleId = parseCloudMicrocycleId(syncResult.cloudRecord?.id);

    if (cloudMicrocycleId === null) {
      throw new Error("Could not resolve cloud microcycle id after sync.");
    }

    await programRepository.markMicrocycleSynced(db, {
      microcycleId: localMicrocycle.microcycle_id,
      cloudMicrocycleId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresMesocycleRepair && allowParentRepair) {
    await syncMesocyclesWithCloud(db);
    uploadedCount += await uploadDirtyMicrocycles(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileMicrocyclesFromCloud(db, userId) {
  const { data: cloudMicrocycles, error } = await supabase
    .from(MICROCYCLE_CLOUD_TABLE)
    .select(MICROCYCLE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_mesocycle_id", { ascending: true })
    .order("microcycle_number", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: MICROCYCLE_CLOUD_TABLE,
    cloudRecords: cloudMicrocycles,
  });

  const [localMicrocycles, localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMicrocyclesForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localMicrocyclesByCloudId = new Map();
  const localMicrocyclesBySyncId = new Map();
  const localMicrocyclesByLocalId = new Map();
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localMesocyclesByCloudId = new Map();
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );

  for (const localMesocycle of localMesocycles) {
    const cloudMesocycleId = parseCloudMesocycleId(
      resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
    );

    if (cloudMesocycleId !== null) {
      localMesocyclesByCloudId.set(cloudMesocycleId, localMesocycle);
    }
  }

  for (const localMicrocycle of localMicrocycles) {
    const cloudMicrocycleId = parseCloudMicrocycleId(
      resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
    );
    const syncId = normalizeSyncId(localMicrocycle.sync_id);

    if (cloudMicrocycleId !== null) {
      localMicrocyclesByCloudId.set(cloudMicrocycleId, localMicrocycle);
    }

    if (syncId) {
      localMicrocyclesBySyncId.set(syncId, localMicrocycle);
    }

    localMicrocyclesByLocalId.set(localMicrocycle.microcycle_id, localMicrocycle);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudMicrocycle of cloudMicrocycles ?? []) {
      const cloudMicrocycleId = parseCloudMicrocycleId(cloudMicrocycle.id);
      const cloudSyncId = normalizeSyncId(cloudMicrocycle.sync_id);
      const localMicrocycleId = normalizeOptionalInteger(
        cloudMicrocycle.local_microcycle_id,
        null
      );
      const cloudMesocycleId = normalizeOptionalInteger(
        cloudMicrocycle.cloud_mesocycle_id,
        null
      );
      const parentMesocycle = localMesocyclesByCloudId.get(cloudMesocycleId);
      const parentProgram = localProgramsById.get(parentMesocycle?.program_id);
      const comparableCloudMicrocycle = getComparableMicrocycleSnapshot(
        cloudMicrocycle
      );

      if (
        cloudMicrocycleId === null ||
        localMicrocycleId === null ||
        cloudMesocycleId === null ||
        !parentMesocycle ||
        !parentProgram?.start_date
      ) {
        continue;
      }

      const localMicrocycle =
        localMicrocyclesByCloudId.get(cloudMicrocycleId) ??
        localMicrocyclesBySyncId.get(cloudSyncId) ??
        localMicrocyclesByLocalId.get(localMicrocycleId) ??
        null;

      if (isCloudSnapshotDeleted(cloudMicrocycle)) {
        pendingDeletionAcks.push({
          userId,
          tableName: MICROCYCLE_CLOUD_TABLE,
          cloudId: cloudMicrocycleId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudMicrocycle),
        });

        if (localMicrocycle) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localMicrocycle,
              cloudMicrocycle
            )
          ) {
            continue;
          }

          await deleteLocalMicrocycleHierarchy(db, localMicrocycle.microcycle_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localMicrocycle) {
        await programRepository.createMicrocycleFromCloud(db, {
          localMicrocycleId,
          cloudMicrocycleId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          mesocycleId: parentMesocycle.mesocycle_id,
          microcycleNumber: comparableCloudMicrocycle.microcycle_number,
          focus: comparableCloudMicrocycle.focus,
          done: comparableCloudMicrocycle.done,
        });

        await ensureDefaultDaysForMicrocycle(db, {
          microcycleId: localMicrocycleId,
          programId: parentProgram.program_id,
          mesocycleNumber: parentMesocycle.mesocycle_number,
          microcycleNumber: comparableCloudMicrocycle.microcycle_number,
          startDate: parentProgram.start_date,
        });

        const createdMicrocycle = {
          microcycle_id: localMicrocycleId,
          cloud_microcycle_id: cloudMicrocycleId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          mesocycle_id: parentMesocycle.mesocycle_id,
          microcycle_number: comparableCloudMicrocycle.microcycle_number,
          focus: comparableCloudMicrocycle.focus,
          done: comparableCloudMicrocycle.done ? 1 : 0,
          needs_sync: 0,
        };

        localMicrocyclesByCloudId.set(cloudMicrocycleId, createdMicrocycle);
        if (cloudSyncId) {
          localMicrocyclesBySyncId.set(cloudSyncId, createdMicrocycle);
        }
        localMicrocyclesByLocalId.set(localMicrocycleId, createdMicrocycle);
        downloadedCount += 1;
        continue;
      }

      await ensureDefaultDaysForMicrocycle(db, {
        microcycleId: localMicrocycle.microcycle_id,
        programId: parentProgram.program_id,
        mesocycleNumber: parentMesocycle.mesocycle_number,
        microcycleNumber: comparableCloudMicrocycle.microcycle_number,
        startDate: parentProgram.start_date,
      });

      const comparableLocalMicrocycle = getComparableMicrocycleSnapshot({
        ...localMicrocycle,
        cloud_mesocycle_id: parseCloudMesocycleId(
          resolveSideBySideCloudId(parentMesocycle, "cloud_mesocycle_id")
        ),
      });

      if (Number(localMicrocycle.needs_sync) === 1) {
        if (compareEntitySyncVersions(localMicrocycle, cloudMicrocycle) < 0) {
          await programRepository.updateMicrocycleFromCloud(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
            mesocycleId: parentMesocycle.mesocycle_id,
            microcycleNumber: comparableCloudMicrocycle.microcycle_number,
            focus: comparableCloudMicrocycle.focus,
            done: comparableCloudMicrocycle.done,
          });
          downloadedCount += 1;
        } else if (
          areComparableMicrocyclesEqual(
            comparableLocalMicrocycle,
            comparableCloudMicrocycle
          )
        ) {
          await programRepository.markMicrocycleSynced(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id") === null ||
          normalizeSyncId(localMicrocycle.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateMicrocycleCloudIdentity(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        }

        continue;
      }

      if (
        areComparableMicrocyclesEqual(
          comparableLocalMicrocycle,
          comparableCloudMicrocycle
        )
      ) {
        if (
          resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id") === null ||
          normalizeSyncId(localMicrocycle.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localMicrocycle.sync_version, 0) !==
            normalizeSyncVersion(cloudMicrocycle.sync_version, 0) ||
          normalizeDeletedAt(localMicrocycle.deleted_at) !==
            normalizeDeletedAt(cloudMicrocycle.deleted_at)
        ) {
          await programRepository.markMicrocycleSynced(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateMicrocycleFromCloud(db, {
        microcycleId: localMicrocycle.microcycle_id,
        cloudMicrocycleId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
        mesocycleId: parentMesocycle.mesocycle_id,
        microcycleNumber: comparableCloudMicrocycle.microcycle_number,
        focus: comparableCloudMicrocycle.focus,
        done: comparableCloudMicrocycle.done,
      });

      const updatedMicrocycle = {
        ...localMicrocycle,
        cloud_microcycle_id: cloudMicrocycleId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudMicrocycle.deleted_at),
        mesocycle_id: parentMesocycle.mesocycle_id,
        microcycle_number: comparableCloudMicrocycle.microcycle_number,
        focus: comparableCloudMicrocycle.focus,
        done: comparableCloudMicrocycle.done ? 1 : 0,
        needs_sync: 0,
      };

      localMicrocyclesByCloudId.set(cloudMicrocycleId, updatedMicrocycle);
      if (cloudSyncId) {
        localMicrocyclesBySyncId.set(cloudSyncId, updatedMicrocycle);
      }
      localMicrocyclesByLocalId.set(
        localMicrocycle.microcycle_id,
        updatedMicrocycle
      );
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncMicrocyclesWithCloudInternal(db) {
  await syncMesocyclesWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedMicrocycleDeletes(db, userId);
  const uploadedCount = await uploadDirtyMicrocycles(db, userId);
  const downloadedCount = await reconcileMicrocyclesFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

function syncMesocyclesInBackground(db) {
  startBackgroundSync(
    () => syncMesocyclesWithCloud(db),
    "Mesocycle cloud sync failed:"
  );
}

function syncMicrocyclesInBackground(db) {
  startBackgroundSync(
    () => syncMicrocyclesWithCloud(db),
    "Microcycle cloud sync failed:"
  );
}

async function uploadDirtyDays(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localDays, localMicrocycles] = await Promise.all([
    programRepository.getDaysForCloudSync(db),
    programRepository.getMicrocyclesForCloudSync(db),
  ]);
  const [localPrograms, localMesocycles] = await Promise.all([
    programRepository.getProgramsForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localMicrocyclesById = new Map(
    localMicrocycles.map((microcycle) => [microcycle.microcycle_id, microcycle])
  );
  let uploadedCount = 0;
  let requiresMicrocycleRepair = false;

  for (const localDay of localDays) {
    if (Number(localDay.needs_sync) !== 1) {
      continue;
    }

    const parentMicrocycleId = normalizeOptionalInteger(
      localDay.microcycle_id,
      null
    );
    const parentMicrocycle =
      parentMicrocycleId !== null
        ? localMicrocyclesById.get(parentMicrocycleId)
        : null;
    const parentMicrocycleCloudId =
      parentMicrocycleId !== null
        ? await ensureMicrocycleCloudIdentity(db, userId, parentMicrocycle)
        : null;

    if (parentMicrocycleId !== null && parentMicrocycleCloudId === null) {
      requiresMicrocycleRepair = true;
      continue;
    }

    const payload = buildCloudDayPayload(localDay, userId, parentMicrocycleCloudId);
    const resolvedPayloadDate =
      payload.date ??
      (await resolveDayDateFallback(db, {
        programId: localDay.program_id,
        programStartDate: localProgramsById.get(localDay.program_id)?.start_date,
        mesocycleNumber:
          localMesocyclesById.get(parentMicrocycle?.mesocycle_id)?.mesocycle_number,
        microcycleNumber: parentMicrocycle?.microcycle_number,
        weekday: localDay.weekday ?? localDay.Weekday,
      }));

    if (
      payload.local_day_id === null ||
      !payload.weekday ||
      !resolvedPayloadDate
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: DAY_CLOUD_TABLE,
      selectColumns: DAY_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localDay,
      payload: {
        ...payload,
        date: resolvedPayloadDate,
      },
      cloudId: parseCloudDayId(
        resolveSideBySideCloudId(localDay, "cloud_day_id")
      ),
      syncId: normalizeSyncId(localDay.sync_id),
      legacyLocalId: payload.local_day_id,
      legacyLocalIdColumn: "local_day_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudDayId = parseCloudDayId(syncResult.cloudRecord?.id);

    if (cloudDayId === null) {
      throw new Error("Could not resolve cloud day id after sync.");
    }

    const remoteLocalDayId =
      resolveDayCloudLocalId(syncResult.cloudRecord) ?? payload.local_day_id;

    await programRepository.markDaySynced(db, {
      dayId: localDay.day_id,
      cloudDayId,
      remoteLocalDayId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresMicrocycleRepair && allowParentRepair) {
    await syncMicrocyclesWithCloud(db);
    uploadedCount += await uploadDirtyDays(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileDaysFromCloud(db, userId) {
  const { data: cloudDays, error } = await supabase
    .from(DAY_CLOUD_TABLE)
    .select(DAY_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_microcycle_id", { ascending: true })
    .order("weekday", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: DAY_CLOUD_TABLE,
    cloudRecords: cloudDays,
  });

  const [localPrograms, localDays, localMicrocycles, localMesocycles] = await Promise.all([
    programRepository.getProgramsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
    programRepository.getMicrocyclesForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localMicrocyclesByCloudId = new Map();
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localDaysByCloudId = new Map();
  const localDaysBySyncId = new Map();
  const localDaysByRemoteLocalId = new Map();
  const localDaysByLocalId = new Map();
  const localDaysByIdentityKey = new Map();

  for (const localMicrocycle of localMicrocycles) {
    const cloudMicrocycleId = parseCloudMicrocycleId(
      resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
    );

    if (cloudMicrocycleId !== null) {
      localMicrocyclesByCloudId.set(cloudMicrocycleId, localMicrocycle);
    }
  }

  for (const localDay of localDays) {
    const cloudDayId = parseCloudDayId(
      resolveSideBySideCloudId(localDay, "cloud_day_id")
    );
    const syncId = normalizeSyncId(localDay.sync_id);
    const remoteLocalDayId = resolveDayCloudLocalId(localDay);
    const identityKey =
      normalizeOptionalInteger(localDay.microcycle_id, null) === null
        ? getStandaloneDayIdentityKey(localDay.date)
        : getDayIdentityKey(
            localDay.microcycle_id,
            localDay.weekday ?? localDay.Weekday
          );

    if (cloudDayId !== null) {
      localDaysByCloudId.set(cloudDayId, localDay);
    }

    if (syncId) {
      localDaysBySyncId.set(syncId, localDay);
    }

    if (remoteLocalDayId !== null) {
      localDaysByRemoteLocalId.set(remoteLocalDayId, localDay);
    }

    localDaysByLocalId.set(localDay.day_id, localDay);

    if (identityKey && !localDaysByIdentityKey.has(identityKey)) {
      localDaysByIdentityKey.set(identityKey, localDay);
    }
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudDay of cloudDays ?? []) {
      const cloudDayId = parseCloudDayId(cloudDay.id);
      const cloudSyncId = normalizeSyncId(cloudDay.sync_id);
      const localDayId = normalizeOptionalInteger(cloudDay.local_day_id, null);
      const cloudMicrocycleId = normalizeOptionalInteger(
        cloudDay.cloud_microcycle_id,
        null
      );
      const isStandaloneCloudDay = cloudMicrocycleId === null;
      const parentMicrocycle = isStandaloneCloudDay
        ? null
        : localMicrocyclesByCloudId.get(cloudMicrocycleId);
      const parentMesocycle = isStandaloneCloudDay
        ? null
        : localMesocyclesById.get(parentMicrocycle?.mesocycle_id);
      const comparableCloudDay = getComparableDaySnapshot(cloudDay);
      const parentProgram = localProgramsById.get(parentMesocycle?.program_id);
      const resolvedCloudDayDate =
        comparableCloudDay.date ??
        (await resolveDayDateFallback(db, {
          programId: parentMesocycle?.program_id,
          programStartDate: parentProgram?.start_date,
          mesocycleNumber: parentMesocycle?.mesocycle_number,
          microcycleNumber: parentMicrocycle?.microcycle_number,
          weekday: comparableCloudDay.weekday,
        }));
      const normalizedCloudDay = {
        ...comparableCloudDay,
        date: resolvedCloudDayDate,
      };
      const identityKey = isStandaloneCloudDay
        ? getStandaloneDayIdentityKey(normalizedCloudDay.date)
        : getDayIdentityKey(
            parentMicrocycle?.microcycle_id,
            normalizedCloudDay.weekday
          );

      if (
        cloudDayId === null ||
        localDayId === null ||
        !normalizedCloudDay.weekday ||
        !normalizedCloudDay.date ||
        (!isStandaloneCloudDay && (!parentMicrocycle || !parentMesocycle))
      ) {
        continue;
      }

      const localDay =
        localDaysByCloudId.get(cloudDayId) ??
        localDaysBySyncId.get(cloudSyncId) ??
        localDaysByRemoteLocalId.get(localDayId) ??
        localDaysByLocalId.get(localDayId) ??
        (identityKey ? localDaysByIdentityKey.get(identityKey) : null) ??
        null;

      if (isCloudSnapshotDeleted(cloudDay)) {
        pendingDeletionAcks.push({
          userId,
          tableName: DAY_CLOUD_TABLE,
          cloudId: cloudDayId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudDay),
        });

        if (localDay) {
          if (shouldKeepLocalEntityForCloudTombstone(localDay, cloudDay)) {
            continue;
          }

          await deleteLocalDayHierarchy(db, localDay.day_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localDay) {
        const result = await programRepository.createDayFromCloud(db, {
          cloudDayId,
          remoteLocalDayId: localDayId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          microcycleId: parentMicrocycle?.microcycle_id ?? null,
          programId: parentMesocycle?.program_id ?? null,
          weekday: normalizedCloudDay.weekday,
          date: normalizedCloudDay.date,
          done: normalizedCloudDay.done,
          isSick: normalizedCloudDay.is_sick,
        });

        const createdDay = {
          day_id: result.lastInsertRowId,
          cloud_day_id: cloudDayId,
          remote_local_day_id: localDayId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudDay.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudDay.deleted_at),
          microcycle_id: parentMicrocycle?.microcycle_id ?? null,
          program_id: parentMesocycle?.program_id ?? null,
          weekday: normalizedCloudDay.weekday,
          date: normalizedCloudDay.date,
          done: normalizedCloudDay.done ? 1 : 0,
          is_sick: normalizedCloudDay.is_sick ? 1 : 0,
          needs_sync: 0,
        };

        localDaysByCloudId.set(cloudDayId, createdDay);
        if (cloudSyncId) {
          localDaysBySyncId.set(cloudSyncId, createdDay);
        }
        localDaysByRemoteLocalId.set(localDayId, createdDay);
        localDaysByLocalId.set(createdDay.day_id, createdDay);
        if (identityKey) {
          localDaysByIdentityKey.set(identityKey, createdDay);
        }
        downloadedCount += 1;
        continue;
      }

      const comparableLocalDay = getComparableDaySnapshot({
        ...localDay,
        cloud_microcycle_id: isStandaloneCloudDay
          ? null
          : parseCloudMicrocycleId(
              resolveSideBySideCloudId(parentMicrocycle, "cloud_microcycle_id")
            ),
      });

      if (Number(localDay.needs_sync) === 1) {
        if (compareEntitySyncVersions(localDay, cloudDay) < 0) {
          await programRepository.updateDayFromCloud(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
            microcycleId: parentMicrocycle?.microcycle_id ?? null,
            programId: parentMesocycle?.program_id ?? null,
            weekday: normalizedCloudDay.weekday,
            date: normalizedCloudDay.date,
            done: normalizedCloudDay.done,
            isSick: normalizedCloudDay.is_sick,
          });
          downloadedCount += 1;
        } else if (areComparableDaysEqual(comparableLocalDay, normalizedCloudDay)) {
          await programRepository.markDaySynced(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localDay, "cloud_day_id") === null ||
          resolveDayCloudLocalId(localDay) !== localDayId ||
          normalizeSyncId(localDay.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateDayCloudIdentity(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        }
        continue;
      }

      if (areComparableDaysEqual(comparableLocalDay, normalizedCloudDay)) {
        if (
          resolveSideBySideCloudId(localDay, "cloud_day_id") === null ||
          resolveDayCloudLocalId(localDay) !== localDayId ||
          normalizeSyncId(localDay.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localDay.sync_version, 0) !==
            normalizeSyncVersion(cloudDay.sync_version, 0) ||
          normalizeDeletedAt(localDay.deleted_at) !==
            normalizeDeletedAt(cloudDay.deleted_at)
        ) {
          await programRepository.markDaySynced(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateDayFromCloud(db, {
        dayId: localDay.day_id,
        cloudDayId,
        remoteLocalDayId: localDayId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
        microcycleId: parentMicrocycle?.microcycle_id ?? null,
        programId: parentMesocycle?.program_id ?? null,
        weekday: normalizedCloudDay.weekday,
        date: normalizedCloudDay.date,
        done: normalizedCloudDay.done,
        isSick: normalizedCloudDay.is_sick,
      });

      const updatedDay = {
        ...localDay,
        cloud_day_id: cloudDayId,
        remote_local_day_id: localDayId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudDay.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudDay.deleted_at),
        microcycle_id: parentMicrocycle?.microcycle_id ?? null,
        program_id: parentMesocycle?.program_id ?? null,
        weekday: normalizedCloudDay.weekday,
        date: normalizedCloudDay.date,
        done: normalizedCloudDay.done ? 1 : 0,
        is_sick: normalizedCloudDay.is_sick ? 1 : 0,
        needs_sync: 0,
      };

      localDaysByCloudId.set(cloudDayId, updatedDay);
      if (cloudSyncId) {
        localDaysBySyncId.set(cloudSyncId, updatedDay);
      }
      localDaysByRemoteLocalId.set(localDayId, updatedDay);
      localDaysByLocalId.set(localDay.day_id, updatedDay);
      if (identityKey) {
        localDaysByIdentityKey.set(identityKey, updatedDay);
      }
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncDaysWithCloudInternal(db) {
  await syncMicrocyclesWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const initialDownloadedCount = await reconcileDaysFromCloud(db, userId);
  const uploadedCount = await uploadDirtyDays(db, userId);
  const finalDownloadedCount = await reconcileDaysFromCloud(db, userId);
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: uploadedCount > 0 || downloadedCount > 0,
    downloadedCount,
    uploadedCount,
  };
}

function syncDaysInBackground(db) {
  startBackgroundSync(
    () => syncDaysWithCloud(db),
    "Day cloud sync failed:"
  );
}

async function processQueuedWorkoutTypeInstanceDeletes(db, userId) {
  const queuedDeletes =
    await programRepository.getQueuedWorkoutTypeInstanceDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
      selectColumns: WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudWorkoutTypeInstanceId(
        queuedDelete.cloud_workout_type_instance_id
      ),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_workout_type_instance_id,
        null
      ),
      legacyLocalIdColumn: "local_workout_type_instance_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedWorkoutTypeInstanceDelete(
      db,
      queuedDelete.workout_type_instance_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtyWorkoutTypeInstances(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localWorkouts, localDays] = await Promise.all([
    programRepository.getWorkoutsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
  ]);
  const localDaysById = new Map(localDays.map((day) => [day.day_id, day]));
  let uploadedCount = 0;
  let requiresDayRepair = false;

  for (const localWorkout of localWorkouts) {
    if (Number(localWorkout.needs_sync) !== 1) {
      continue;
    }

    const parentDay = localDaysById.get(localWorkout.day_id);
    const parentDayCloudId = await ensureDayCloudIdentity(db, userId, parentDay);

    if (parentDayCloudId === null) {
      requiresDayRepair = true;
      continue;
    }

    const payload = buildCloudWorkoutTypeInstancePayload(
      localWorkout,
      userId,
      parentDayCloudId
    );

    if (
      payload.local_workout_type_instance_id === null ||
      !payload.date
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
      selectColumns: WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localWorkout,
      payload,
      cloudId: parseCloudWorkoutTypeInstanceId(
        resolveSideBySideCloudId(
          localWorkout,
          "cloud_workout_type_instance_id"
        )
      ),
      syncId: normalizeSyncId(localWorkout.sync_id),
      legacyLocalId: payload.local_workout_type_instance_id,
      legacyLocalIdColumn: "local_workout_type_instance_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      syncResult.cloudRecord?.id
    );

    if (cloudWorkoutTypeInstanceId === null) {
      throw new Error("Could not resolve cloud workout type instance id after sync.");
    }

    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(syncResult.cloudRecord) ??
      payload.local_workout_type_instance_id;

    await programRepository.markWorkoutSynced(db, {
      workoutId: localWorkout.workout_id,
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresDayRepair && allowParentRepair) {
    await syncDaysWithCloud(db);
    uploadedCount += await uploadDirtyWorkoutTypeInstances(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileWorkoutTypeInstancesFromCloud(db, userId) {
  const { data: cloudWorkouts, error } = await supabase
    .from(WORKOUT_TYPE_INSTANCE_CLOUD_TABLE)
    .select(WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_day_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
    cloudRecords: cloudWorkouts,
  });

  const [localWorkouts, localDays] = await Promise.all([
    programRepository.getWorkoutsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
  ]);
  const queuedDeletes =
    await programRepository.getQueuedWorkoutTypeInstanceDeletes(db);
  const localDaysByCloudId = new Map();
  const localWorkoutsByCloudId = new Map();
  const localWorkoutsBySyncId = new Map();
  const localWorkoutsByRemoteLocalId = new Map();
  const localWorkoutsByLocalId = new Map();
  const pendingDeletedWorkoutLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(
          queuedDelete.remote_local_workout_type_instance_id,
          null
        )
      )
      .filter((workoutLocalId) => workoutLocalId !== null)
  );

  for (const localDay of localDays) {
    const cloudDayId = parseCloudDayId(
      resolveSideBySideCloudId(localDay, "cloud_day_id")
    );

    if (cloudDayId !== null) {
      localDaysByCloudId.set(cloudDayId, localDay);
    }
  }

  for (const localWorkout of localWorkouts) {
    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      resolveSideBySideCloudId(
        localWorkout,
        "cloud_workout_type_instance_id"
      )
    );
    const syncId = normalizeSyncId(localWorkout.sync_id);
    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(localWorkout);

    if (cloudWorkoutTypeInstanceId !== null) {
      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, localWorkout);
    }

    if (syncId) {
      localWorkoutsBySyncId.set(syncId, localWorkout);
    }

    if (remoteLocalWorkoutTypeInstanceId !== null) {
      localWorkoutsByRemoteLocalId.set(
        remoteLocalWorkoutTypeInstanceId,
        localWorkout
      );
    }

    localWorkoutsByLocalId.set(localWorkout.workout_id, localWorkout);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudWorkout of cloudWorkouts ?? []) {
      const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
        cloudWorkout.id
      );
      const cloudSyncId = normalizeSyncId(cloudWorkout.sync_id);
      const localWorkoutTypeInstanceId = normalizeOptionalInteger(
        cloudWorkout.local_workout_type_instance_id,
        null
      );
      const cloudDayId = normalizeOptionalInteger(cloudWorkout.cloud_day_id, null);
      const parentDay = localDaysByCloudId.get(cloudDayId);
      const comparableCloudWorkout =
        getComparableWorkoutTypeInstanceSnapshot(cloudWorkout);

      if (
        cloudWorkoutTypeInstanceId === null ||
        localWorkoutTypeInstanceId === null ||
        cloudDayId === null ||
        !parentDay ||
        !comparableCloudWorkout.date
      ) {
        continue;
      }

      if (pendingDeletedWorkoutLocalIds.has(localWorkoutTypeInstanceId)) {
        continue;
      }

      const localWorkout =
        localWorkoutsByCloudId.get(cloudWorkoutTypeInstanceId) ??
        localWorkoutsBySyncId.get(cloudSyncId) ??
        localWorkoutsByRemoteLocalId.get(localWorkoutTypeInstanceId) ??
        localWorkoutsByLocalId.get(localWorkoutTypeInstanceId) ??
        null;

      if (isCloudSnapshotDeleted(cloudWorkout)) {
        pendingDeletionAcks.push({
          userId,
          tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
          cloudId: cloudWorkoutTypeInstanceId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudWorkout),
        });

        if (localWorkout) {
          if (
            shouldKeepLocalEntityForCloudTombstone(localWorkout, cloudWorkout)
          ) {
            continue;
          }

          await deleteLocalWorkoutHierarchy(db, localWorkout.workout_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localWorkout) {
        const result = await programRepository.createWorkoutFromCloud(db, {
          cloudWorkoutTypeInstanceId,
          remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          dayId: parentDay.day_id,
          workoutType: comparableCloudWorkout.workout_type,
          date: comparableCloudWorkout.date,
          label: comparableCloudWorkout.label,
          done: comparableCloudWorkout.done,
          isActive: comparableCloudWorkout.is_active,
          originalStartTime: cloudTimeStringToLocalTimestamp(
            comparableCloudWorkout.date,
            comparableCloudWorkout.original_start_time
          ),
          timerStart: cloudTimeStringToLocalTimestamp(
            comparableCloudWorkout.date,
            comparableCloudWorkout.timer_start
          ),
          elapsedTime: comparableCloudWorkout.elapsed_time,
        });

        const createdWorkout = {
          workout_id: result.lastInsertRowId,
          cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
          remote_local_workout_type_instance_id: localWorkoutTypeInstanceId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudWorkout.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudWorkout.deleted_at),
          day_id: parentDay.day_id,
          ...comparableCloudWorkout,
          needs_sync: 0,
        };

        localWorkoutsByCloudId.set(
          cloudWorkoutTypeInstanceId,
          createdWorkout
        );
        if (cloudSyncId) {
          localWorkoutsBySyncId.set(cloudSyncId, createdWorkout);
        }
        localWorkoutsByRemoteLocalId.set(
          localWorkoutTypeInstanceId,
          createdWorkout
        );
        localWorkoutsByLocalId.set(createdWorkout.workout_id, createdWorkout);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalWorkout = getComparableWorkoutTypeInstanceSnapshot({
        ...localWorkout,
        cloud_day_id: parseCloudDayId(
          resolveSideBySideCloudId(parentDay, "cloud_day_id")
        ),
      });

      if (Number(localWorkout.needs_sync) === 1) {
        if (compareEntitySyncVersions(localWorkout, cloudWorkout) < 0) {
          await programRepository.updateWorkoutFromCloud(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
            dayId: parentDay.day_id,
            workoutType: comparableCloudWorkout.workout_type,
            date: comparableCloudWorkout.date,
            label: comparableCloudWorkout.label,
            done: comparableCloudWorkout.done,
            isActive: comparableCloudWorkout.is_active,
            originalStartTime: cloudTimeStringToLocalTimestamp(
              comparableCloudWorkout.date,
              comparableCloudWorkout.original_start_time
            ),
            timerStart: cloudTimeStringToLocalTimestamp(
              comparableCloudWorkout.date,
              comparableCloudWorkout.timer_start
            ),
            elapsedTime: comparableCloudWorkout.elapsed_time,
          });
          downloadedCount += 1;
        } else if (
          areComparableWorkoutTypeInstancesEqual(
            comparableLocalWorkout,
            comparableCloudWorkout
          )
        ) {
          await programRepository.markWorkoutSynced(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(
            localWorkout,
            "cloud_workout_type_instance_id"
          ) === null ||
          resolveWorkoutTypeInstanceCloudLocalId(localWorkout) !==
            localWorkoutTypeInstanceId ||
          normalizeSyncId(localWorkout.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateWorkoutCloudIdentity(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        }
        continue;
      }

      if (
        areComparableWorkoutTypeInstancesEqual(
          comparableLocalWorkout,
          comparableCloudWorkout
        )
      ) {
        if (
          resolveSideBySideCloudId(
            localWorkout,
            "cloud_workout_type_instance_id"
          ) === null ||
          resolveWorkoutTypeInstanceCloudLocalId(localWorkout) !==
            localWorkoutTypeInstanceId ||
          normalizeSyncId(localWorkout.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localWorkout.sync_version, 0) !==
            normalizeSyncVersion(cloudWorkout.sync_version, 0) ||
          normalizeDeletedAt(localWorkout.deleted_at) !==
            normalizeDeletedAt(cloudWorkout.deleted_at)
        ) {
          await programRepository.markWorkoutSynced(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateWorkoutFromCloud(db, {
        workoutId: localWorkout.workout_id,
        cloudWorkoutTypeInstanceId,
        remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
        dayId: parentDay.day_id,
        workoutType: comparableCloudWorkout.workout_type,
        date: comparableCloudWorkout.date,
        label: comparableCloudWorkout.label,
        done: comparableCloudWorkout.done,
        isActive: comparableCloudWorkout.is_active,
        originalStartTime: cloudTimeStringToLocalTimestamp(
          comparableCloudWorkout.date,
          comparableCloudWorkout.original_start_time
        ),
        timerStart: cloudTimeStringToLocalTimestamp(
          comparableCloudWorkout.date,
          comparableCloudWorkout.timer_start
        ),
        elapsedTime: comparableCloudWorkout.elapsed_time,
      });

      const updatedWorkout = {
        ...localWorkout,
        cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
        remote_local_workout_type_instance_id: localWorkoutTypeInstanceId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudWorkout.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudWorkout.deleted_at),
        day_id: parentDay.day_id,
        ...comparableCloudWorkout,
        needs_sync: 0,
      };

      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, updatedWorkout);
      if (cloudSyncId) {
        localWorkoutsBySyncId.set(cloudSyncId, updatedWorkout);
      }
      localWorkoutsByRemoteLocalId.set(
        localWorkoutTypeInstanceId,
        updatedWorkout
      );
      localWorkoutsByLocalId.set(localWorkout.workout_id, updatedWorkout);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncWorkoutTypeInstancesWithCloudInternal(db) {
  await syncDaysWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedWorkoutTypeInstanceDeletes(db, userId);
  const initialDownloadedCount = await reconcileWorkoutTypeInstancesFromCloud(
    db,
    userId
  );
  const uploadedCount = await uploadDirtyWorkoutTypeInstances(db, userId);
  const finalDownloadedCount = await reconcileWorkoutTypeInstancesFromCloud(
    db,
    userId
  );
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

function syncWorkoutTypeInstancesInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncWorkoutTypeInstancesWithCloud(db);
    },
    "Workout type instance cloud sync failed:"
  );
}

async function processQueuedExerciseInstanceDeletes(db, userId) {
  const queuedDeletes =
    await weightliftingRepository.getQueuedExerciseInstanceDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
      selectColumns: EXERCISE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudExerciseInstanceId(
        queuedDelete.cloud_exercise_instance_id
      ),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_exercise_instance_id,
        null
      ),
      legacyLocalIdColumn: "local_exercise_instance_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await weightliftingRepository.deleteQueuedExerciseInstanceDelete(
      db,
      queuedDelete.exercise_instance_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtyExerciseInstances(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localExercises, localWorkouts] = await Promise.all([
    weightliftingRepository.getExercisesForCloudSync(db),
    programRepository.getWorkoutsForCloudSync(db),
  ]);
  const localWorkoutsById = new Map(
    localWorkouts.map((workout) => [workout.workout_id, workout])
  );
  let uploadedCount = 0;
  let requiresWorkoutRepair = false;

  for (const localExercise of localExercises) {
    if (Number(localExercise.needs_sync) !== 1) {
      continue;
    }

    const parentWorkout = localWorkoutsById.get(
      localExercise.workout_type_instance_id
    );
    const parentWorkoutCloudId = await ensureWorkoutTypeInstanceCloudIdentity(
      db,
      userId,
      parentWorkout
    );

    if (parentWorkoutCloudId === null) {
      requiresWorkoutRepair = true;
      continue;
    }

    const payload = buildCloudExerciseInstancePayload(
      localExercise,
      userId,
      parentWorkoutCloudId
    );

    if (
      payload.local_exercise_instance_id === null ||
      !payload.exercise_name
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
      selectColumns: EXERCISE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localExercise,
      payload,
      cloudId: parseCloudExerciseInstanceId(
        resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
      ),
      syncId: normalizeSyncId(localExercise.sync_id),
      legacyLocalId: payload.local_exercise_instance_id,
      legacyLocalIdColumn: "local_exercise_instance_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      syncResult.cloudRecord?.id
    );

    if (cloudExerciseInstanceId === null) {
      throw new Error(
        "Could not resolve cloud exercise instance id after sync."
      );
    }

    const remoteLocalExerciseInstanceId =
      resolveExerciseInstanceCloudLocalId(syncResult.cloudRecord) ??
      payload.local_exercise_instance_id;

    await weightliftingRepository.markExerciseSynced(db, {
      exerciseId: localExercise.exercise_instance_id,
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresWorkoutRepair && allowParentRepair) {
    await syncWorkoutTypeInstancesWithCloud(db);
    uploadedCount += await uploadDirtyExerciseInstances(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileExerciseInstancesFromCloud(db, userId) {
  const { data: cloudExercises, error } = await supabase
    .from(EXERCISE_INSTANCE_CLOUD_TABLE)
    .select(EXERCISE_INSTANCE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_workout_type_instance_id", { ascending: true })
    .order("exercise_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
    cloudRecords: cloudExercises,
  });

  const [localExercises, localWorkouts] = await Promise.all([
    weightliftingRepository.getExercisesForCloudSync(db),
    programRepository.getWorkoutsForCloudSync(db),
  ]);
  const queuedDeletes =
    await weightliftingRepository.getQueuedExerciseInstanceDeletes(db);
  const localWorkoutsByCloudId = new Map();
  const localExercisesByCloudId = new Map();
  const localExercisesBySyncId = new Map();
  const localExercisesByRemoteLocalId = new Map();
  const localExercisesByLocalId = new Map();
  const pendingDeletedExerciseLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(
          queuedDelete.remote_local_exercise_instance_id,
          null
        )
      )
      .filter((exerciseLocalId) => exerciseLocalId !== null)
  );

  for (const localWorkout of localWorkouts) {
    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      resolveSideBySideCloudId(
        localWorkout,
        "cloud_workout_type_instance_id"
      )
    );

    if (cloudWorkoutTypeInstanceId !== null) {
      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, localWorkout);
    }
  }

  for (const localExercise of localExercises) {
    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
    );
    const syncId = normalizeSyncId(localExercise.sync_id);
    const remoteLocalExerciseInstanceId =
      resolveExerciseInstanceCloudLocalId(localExercise);

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudId.set(cloudExerciseInstanceId, localExercise);
    }

    if (syncId) {
      localExercisesBySyncId.set(syncId, localExercise);
    }

    if (remoteLocalExerciseInstanceId !== null) {
      localExercisesByRemoteLocalId.set(
        remoteLocalExerciseInstanceId,
        localExercise
      );
    }

    localExercisesByLocalId.set(
      localExercise.exercise_instance_id,
      localExercise
    );
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudExercise of cloudExercises ?? []) {
      const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
        cloudExercise.id
      );
      const cloudSyncId = normalizeSyncId(cloudExercise.sync_id);
      const localExerciseInstanceId = normalizeOptionalInteger(
        cloudExercise.local_exercise_instance_id,
        null
      );
      const cloudWorkoutTypeInstanceId = normalizeOptionalInteger(
        cloudExercise.cloud_workout_type_instance_id,
        null
      );
      const parentWorkout = localWorkoutsByCloudId.get(cloudWorkoutTypeInstanceId);
      const comparableCloudExercise =
        getComparableExerciseInstanceSnapshot(cloudExercise);

      if (
        cloudExerciseInstanceId === null ||
        cloudWorkoutTypeInstanceId === null ||
        !parentWorkout ||
        !comparableCloudExercise.exercise_name
      ) {
        continue;
      }

      if (pendingDeletedExerciseLocalIds.has(localExerciseInstanceId)) {
        continue;
      }

      const localExercise =
        localExercisesByCloudId.get(cloudExerciseInstanceId) ??
        localExercisesBySyncId.get(cloudSyncId) ??
        localExercisesByRemoteLocalId.get(localExerciseInstanceId) ??
        localExercisesByLocalId.get(localExerciseInstanceId) ??
        null;

      if (isCloudSnapshotDeleted(cloudExercise)) {
        pendingDeletionAcks.push({
          userId,
          tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
          cloudId: cloudExerciseInstanceId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudExercise),
        });

        if (localExercise) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localExercise,
              cloudExercise
            )
          ) {
            continue;
          }

          await weightliftingRepository.deleteSetsByExercise(
            db,
            localExercise.exercise_instance_id
          );
          await weightliftingRepository.deleteExerciseById(
            db,
            localExercise.exercise_instance_id
          );
          downloadedCount += 1;
        }

        continue;
      }

      if (!localExercise) {
        const result = await weightliftingRepository.createExerciseFromCloud(db, {
          cloudExerciseInstanceId,
          remoteLocalExerciseInstanceId: localExerciseInstanceId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
          workoutId: parentWorkout.workout_id,
          exerciseName: comparableCloudExercise.exercise_name,
          exerciseOrder: comparableCloudExercise.exercise_order,
          sets: comparableCloudExercise.sets,
          visibleColumns: serializeExerciseVisibleColumns(
            comparableCloudExercise.visible_columns
          ),
          note: comparableCloudExercise.note,
          done: comparableCloudExercise.done,
        });

        const createdExercise = {
          exercise_instance_id: result.lastInsertRowId,
          cloud_exercise_instance_id: cloudExerciseInstanceId,
          remote_local_exercise_instance_id: localExerciseInstanceId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudExercise.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudExercise.deleted_at),
          workout_type_instance_id: parentWorkout.workout_id,
          exercise_name: comparableCloudExercise.exercise_name,
          exercise_order: comparableCloudExercise.exercise_order,
          sets: comparableCloudExercise.sets,
          visible_columns: serializeExerciseVisibleColumns(
            comparableCloudExercise.visible_columns
          ),
          note: comparableCloudExercise.note,
          done: comparableCloudExercise.done ? 1 : 0,
          needs_sync: 0,
        };

        localExercisesByCloudId.set(
          cloudExerciseInstanceId,
          createdExercise
        );
        if (cloudSyncId) {
          localExercisesBySyncId.set(cloudSyncId, createdExercise);
        }
        localExercisesByRemoteLocalId.set(
          localExerciseInstanceId,
          createdExercise
        );
        localExercisesByLocalId.set(
          createdExercise.exercise_instance_id,
          createdExercise
        );
        downloadedCount += 1;
        continue;
      }

      const comparableLocalExercise = getComparableExerciseInstanceSnapshot({
        ...localExercise,
        cloud_workout_type_instance_id: parseCloudWorkoutTypeInstanceId(
          resolveSideBySideCloudId(
            parentWorkout,
            "cloud_workout_type_instance_id"
          )
        ),
      });

      if (Number(localExercise.needs_sync) === 1) {
        if (compareEntitySyncVersions(localExercise, cloudExercise) < 0) {
          await weightliftingRepository.updateExerciseFromCloud(db, {
            exerciseId: localExercise.exercise_instance_id,
            cloudExerciseInstanceId,
            remoteLocalExerciseInstanceId: localExerciseInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
            workoutId: parentWorkout.workout_id,
            exerciseName: comparableCloudExercise.exercise_name,
            exerciseOrder: comparableCloudExercise.exercise_order,
            sets: comparableCloudExercise.sets,
            visibleColumns: serializeExerciseVisibleColumns(
              comparableCloudExercise.visible_columns
            ),
            note: comparableCloudExercise.note,
            done: comparableCloudExercise.done,
          });
          downloadedCount += 1;
        }

        continue;
      }

      if (
        areComparableExerciseInstancesEqual(
          comparableLocalExercise,
          comparableCloudExercise
        )
      ) {
        if (
          resolveSideBySideCloudId(
            localExercise,
            "cloud_exercise_instance_id"
          ) === null ||
          resolveExerciseInstanceCloudLocalId(localExercise) !==
            localExerciseInstanceId ||
          normalizeSyncId(localExercise.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localExercise.sync_version, 0) !==
            normalizeSyncVersion(cloudExercise.sync_version, 0) ||
          normalizeDeletedAt(localExercise.deleted_at) !==
            normalizeDeletedAt(cloudExercise.deleted_at)
        ) {
          await weightliftingRepository.markExerciseSynced(db, {
            exerciseId: localExercise.exercise_instance_id,
            cloudExerciseInstanceId,
            remoteLocalExerciseInstanceId: localExerciseInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
          });
        }
        if (
          compareEntitySyncVersions(localExercise, cloudExercise) > 0
        ) {
          continue;
        }

        continue;
      }

      await weightliftingRepository.updateExerciseFromCloud(db, {
        exerciseId: localExercise.exercise_instance_id,
        cloudExerciseInstanceId,
        remoteLocalExerciseInstanceId: localExerciseInstanceId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
        workoutId: parentWorkout.workout_id,
        exerciseName: comparableCloudExercise.exercise_name,
        exerciseOrder: comparableCloudExercise.exercise_order,
        sets: comparableCloudExercise.sets,
        visibleColumns: serializeExerciseVisibleColumns(
          comparableCloudExercise.visible_columns
        ),
        note: comparableCloudExercise.note,
        done: comparableCloudExercise.done,
      });

      const updatedExercise = {
        ...localExercise,
        cloud_exercise_instance_id: cloudExerciseInstanceId,
        remote_local_exercise_instance_id: localExerciseInstanceId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudExercise.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudExercise.deleted_at),
        workout_type_instance_id: parentWorkout.workout_id,
        exercise_name: comparableCloudExercise.exercise_name,
        exercise_order: comparableCloudExercise.exercise_order,
        sets: comparableCloudExercise.sets,
        visible_columns: serializeExerciseVisibleColumns(
          comparableCloudExercise.visible_columns
        ),
        note: comparableCloudExercise.note,
        done: comparableCloudExercise.done ? 1 : 0,
        needs_sync: 0,
      };

      localExercisesByCloudId.set(cloudExerciseInstanceId, updatedExercise);
      if (cloudSyncId) {
        localExercisesBySyncId.set(cloudSyncId, updatedExercise);
      }
      localExercisesByRemoteLocalId.set(
        localExerciseInstanceId,
        updatedExercise
      );
      localExercisesByLocalId.set(
        localExercise.exercise_instance_id,
        updatedExercise
      );
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncExerciseInstancesWithCloudInternal(db) {
  try {
    await syncWorkoutTypeInstancesWithCloud(db);
  } catch (error) {
    throw new Error(
      `Exercise sync prerequisite failed while syncing workouts: ${error?.message ?? error}`
    );
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  let deletedCount = 0;
  let initialDownloadedCount = 0;
  let uploadedCount = 0;
  let finalDownloadedCount = 0;

  try {
    deletedCount = await processQueuedExerciseInstanceDeletes(db, userId);
  } catch (error) {
    throw new Error(
      `Exercise sync failed while applying queued deletes: ${error?.message ?? error}`
    );
  }

  try {
    initialDownloadedCount = await reconcileExerciseInstancesFromCloud(
      db,
      userId
    );
  } catch (error) {
    throw new Error(
      `Exercise sync failed while downloading cloud exercises: ${error?.message ?? error}`
    );
  }

  try {
    uploadedCount = await uploadDirtyExerciseInstances(db, userId);
  } catch (error) {
    throw new Error(
      `Exercise sync failed while uploading local exercises: ${error?.message ?? error}`
    );
  }

  try {
    finalDownloadedCount = await reconcileExerciseInstancesFromCloud(
      db,
      userId
    );
  } catch (error) {
    throw new Error(
      `Exercise sync failed while reconciling cloud exercises: ${error?.message ?? error}`
    );
  }
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

function syncExerciseInstancesInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncExerciseInstancesWithCloud(db);
    },
    "Exercise instance cloud sync failed:"
  );
}

async function processQueuedSetDeletes(db, userId) {
  const queuedDeletes = await weightliftingRepository.getQueuedSetDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: SET_CLOUD_TABLE,
      selectColumns: SET_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudSetId(queuedDelete.cloud_set_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_set_id,
        null
      ),
      legacyLocalIdColumn: "local_set_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await weightliftingRepository.deleteQueuedSetDelete(
      db,
      queuedDelete.set_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

async function uploadDirtySets(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localSets, localExercises] = await Promise.all([
    weightliftingRepository.getSetsForCloudSync(db),
    weightliftingRepository.getExercisesForCloudSync(db),
  ]);
  const localExercisesById = new Map(
    localExercises.map((exercise) => [exercise.exercise_instance_id, exercise])
  );
  let uploadedCount = 0;
  let requiresExerciseRepair = false;

  for (const localSet of localSets) {
    if (Number(localSet.needs_sync) !== 1) {
      continue;
    }

    const parentExercise = localExercisesById.get(localSet.exercise_instance_id);
    const parentExerciseCloudId = await ensureExerciseInstanceCloudIdentity(
      db,
      userId,
      parentExercise
    );

    if (parentExerciseCloudId === null) {
      requiresExerciseRepair = true;
      continue;
    }

    const payload = buildCloudSetPayload(localSet, userId, parentExerciseCloudId);

    if (payload.local_set_id === null) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: SET_CLOUD_TABLE,
      selectColumns: SET_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localSet,
      payload,
      cloudId: parseCloudSetId(
        resolveSideBySideCloudId(localSet, "cloud_set_id")
      ),
      syncId: normalizeSyncId(localSet.sync_id),
      legacyLocalId: payload.local_set_id,
      legacyLocalIdColumn: "local_set_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudSetId = parseCloudSetId(syncResult.cloudRecord?.id);

    if (cloudSetId === null) {
      throw new Error("Could not resolve cloud set id after sync.");
    }

    const remoteLocalSetId =
      resolveSetCloudLocalId(syncResult.cloudRecord) ?? payload.local_set_id;

    await weightliftingRepository.markSetSynced(db, {
      setId: localSet.sets_id,
      cloudSetId,
      remoteLocalSetId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresExerciseRepair && allowParentRepair) {
    await syncExerciseInstancesWithCloud(db);
    uploadedCount += await uploadDirtySets(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileSetsFromCloud(db, userId) {
  const { data: cloudSets, error } = await supabase
    .from(SET_CLOUD_TABLE)
    .select(SET_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_exercise_instance_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: SET_CLOUD_TABLE,
    cloudRecords: cloudSets,
  });

  const [localSets, localExercises] = await Promise.all([
    weightliftingRepository.getSetsForCloudSync(db),
    weightliftingRepository.getExercisesForCloudSync(db),
  ]);
  const queuedDeletes = await weightliftingRepository.getQueuedSetDeletes(db);
  const localExercisesByCloudId = new Map();
  const localSetsByCloudId = new Map();
  const localSetsBySyncId = new Map();
  const localSetsByRemoteLocalId = new Map();
  const localSetsByLocalId = new Map();
  const pendingDeletedSetLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(queuedDelete.remote_local_set_id, null)
      )
      .filter((setLocalId) => setLocalId !== null)
  );

  for (const localExercise of localExercises) {
    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
    );

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudId.set(cloudExerciseInstanceId, localExercise);
    }
  }

  for (const localSet of localSets) {
    const cloudSetId = parseCloudSetId(
      resolveSideBySideCloudId(localSet, "cloud_set_id")
    );
    const syncId = normalizeSyncId(localSet.sync_id);
    const remoteLocalSetId = resolveSetCloudLocalId(localSet);

    if (cloudSetId !== null) {
      localSetsByCloudId.set(cloudSetId, localSet);
    }

    if (syncId) {
      localSetsBySyncId.set(syncId, localSet);
    }

    if (remoteLocalSetId !== null) {
      localSetsByRemoteLocalId.set(remoteLocalSetId, localSet);
    }

    localSetsByLocalId.set(localSet.sets_id, localSet);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudSet of cloudSets ?? []) {
      const cloudSetId = parseCloudSetId(cloudSet.id);
      const cloudSyncId = normalizeSyncId(cloudSet.sync_id);
      const localSetId = normalizeOptionalInteger(cloudSet.local_set_id, null);
      const cloudExerciseInstanceId = normalizeOptionalInteger(
        cloudSet.cloud_exercise_instance_id,
        null
      );
      const parentExercise = localExercisesByCloudId.get(cloudExerciseInstanceId);
      const comparableCloudSet = getComparableSetSnapshot(cloudSet);

      if (
        cloudSetId === null ||
        cloudExerciseInstanceId === null ||
        !parentExercise
      ) {
        continue;
      }

      if (pendingDeletedSetLocalIds.has(localSetId)) {
        continue;
      }

      const localSet =
        localSetsByCloudId.get(cloudSetId) ??
        localSetsBySyncId.get(cloudSyncId) ??
        localSetsByRemoteLocalId.get(localSetId) ??
        localSetsByLocalId.get(localSetId) ??
        null;

      if (isCloudSnapshotDeleted(cloudSet)) {
        pendingDeletionAcks.push({
          userId,
          tableName: SET_CLOUD_TABLE,
          cloudId: cloudSetId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudSet),
        });

        if (localSet) {
          if (shouldKeepLocalEntityForCloudTombstone(localSet, cloudSet)) {
            continue;
          }

          await weightliftingRepository.deleteSetById(db, localSet.sets_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localSet) {
        const result = await weightliftingRepository.createSetFromCloud(db, {
          cloudSetId,
          remoteLocalSetId: localSetId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          exerciseId: parentExercise.exercise_instance_id,
          setNumber: comparableCloudSet.set_number,
          personalRecord: comparableCloudSet.personal_record,
          pause: comparableCloudSet.pause,
          rpe: comparableCloudSet.rpe,
          weight: comparableCloudSet.weight,
          rmPercentage: comparableCloudSet.rm_percentage,
          reps: comparableCloudSet.reps,
          done: comparableCloudSet.done,
          failed: comparableCloudSet.failed,
          amrap: comparableCloudSet.amrap,
          note: comparableCloudSet.note,
        });

        const createdSet = {
          sets_id: result.lastInsertRowId,
          cloud_set_id: cloudSetId,
          remote_local_set_id: localSetId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudSet.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudSet.deleted_at),
          exercise_instance_id: parentExercise.exercise_instance_id,
          ...comparableCloudSet,
          needs_sync: 0,
        };

        localSetsByCloudId.set(cloudSetId, createdSet);
        if (cloudSyncId) {
          localSetsBySyncId.set(cloudSyncId, createdSet);
        }
        localSetsByRemoteLocalId.set(localSetId, createdSet);
        localSetsByLocalId.set(createdSet.sets_id, createdSet);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalSet = getComparableSetSnapshot({
        ...localSet,
        cloud_exercise_instance_id: parseCloudExerciseInstanceId(
          resolveSideBySideCloudId(
            parentExercise,
            "cloud_exercise_instance_id"
          )
        ),
      });

      if (Number(localSet.needs_sync) === 1) {
        if (compareEntitySyncVersions(localSet, cloudSet) < 0) {
          await weightliftingRepository.updateSetFromCloud(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
            exerciseId: parentExercise.exercise_instance_id,
            setNumber: comparableCloudSet.set_number,
            personalRecord: comparableCloudSet.personal_record,
            pause: comparableCloudSet.pause,
            rpe: comparableCloudSet.rpe,
            weight: comparableCloudSet.weight,
            rmPercentage: comparableCloudSet.rm_percentage,
            reps: comparableCloudSet.reps,
            done: comparableCloudSet.done,
            failed: comparableCloudSet.failed,
            amrap: comparableCloudSet.amrap,
            note: comparableCloudSet.note,
          });
          downloadedCount += 1;
        } else if (areComparableSetsEqual(comparableLocalSet, comparableCloudSet)) {
          await weightliftingRepository.markSetSynced(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localSet, "cloud_set_id") === null ||
          resolveSetCloudLocalId(localSet) !== localSetId ||
          normalizeSyncId(localSet.sync_id) !== cloudSyncId
        ) {
          await weightliftingRepository.updateSetCloudIdentity(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        }
        continue;
      }

      if (areComparableSetsEqual(comparableLocalSet, comparableCloudSet)) {
        if (
          resolveSideBySideCloudId(localSet, "cloud_set_id") === null ||
          resolveSetCloudLocalId(localSet) !== localSetId ||
          normalizeSyncId(localSet.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localSet.sync_version, 0) !==
            normalizeSyncVersion(cloudSet.sync_version, 0) ||
          normalizeDeletedAt(localSet.deleted_at) !==
            normalizeDeletedAt(cloudSet.deleted_at)
        ) {
          await weightliftingRepository.markSetSynced(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        }
        continue;
      }

      await weightliftingRepository.updateSetFromCloud(db, {
        setId: localSet.sets_id,
        cloudSetId,
        remoteLocalSetId: localSetId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
        exerciseId: parentExercise.exercise_instance_id,
        setNumber: comparableCloudSet.set_number,
        personalRecord: comparableCloudSet.personal_record,
        pause: comparableCloudSet.pause,
        rpe: comparableCloudSet.rpe,
        weight: comparableCloudSet.weight,
        rmPercentage: comparableCloudSet.rm_percentage,
        reps: comparableCloudSet.reps,
        done: comparableCloudSet.done,
        failed: comparableCloudSet.failed,
        amrap: comparableCloudSet.amrap,
        note: comparableCloudSet.note,
      });

      const updatedSet = {
        ...localSet,
        cloud_set_id: cloudSetId,
        remote_local_set_id: localSetId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudSet.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudSet.deleted_at),
        exercise_instance_id: parentExercise.exercise_instance_id,
        ...comparableCloudSet,
        needs_sync: 0,
      };

      localSetsByCloudId.set(cloudSetId, updatedSet);
      if (cloudSyncId) {
        localSetsBySyncId.set(cloudSyncId, updatedSet);
      }
      localSetsByRemoteLocalId.set(localSetId, updatedSet);
      localSetsByLocalId.set(localSet.sets_id, updatedSet);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncSetsWithCloudInternal(db) {
  try {
    await syncExerciseInstancesWithCloud(db);
  } catch (error) {
    throw new Error(
      `Set sync prerequisite failed while syncing exercises: ${error?.message ?? error}`
    );
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  let deletedCount = 0;
  let initialDownloadedCount = 0;
  let uploadedCount = 0;
  let finalDownloadedCount = 0;

  try {
    deletedCount = await processQueuedSetDeletes(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while applying queued deletes: ${error?.message ?? error}`
    );
  }

  try {
    initialDownloadedCount = await reconcileSetsFromCloud(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while downloading cloud sets: ${error?.message ?? error}`
    );
  }

  try {
    uploadedCount = await uploadDirtySets(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while uploading local sets: ${error?.message ?? error}`
    );
  }

  try {
    finalDownloadedCount = await reconcileSetsFromCloud(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while reconciling cloud sets: ${error?.message ?? error}`
    );
  }
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

function syncSetsInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncSetsWithCloud(db);
    },
    "Set cloud sync failed:"
  );
}

async function ensureDefaultDaysForMicrocycle(
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

function calculateBrzyckiOneRepMax(weight, reps) {
  const denominator = 1.0278 - 0.0278 * reps;

  if (denominator <= 0) {
    return null;
  }

  return weight / denominator;
}

function formatProgramBestDisplay({ weight, reps, estimatedOneRepMax }) {
  const setText = `${reps} x ${formatDisplayNumber(weight)} kg`;

  if (reps === 1) {
    return {
      setDisplayValue: setText,
      rmDisplayValue: `${formatDisplayNumber(weight)} kg`,
      isEstimated: false,
      estimatedLabel: null,
    };
  }

  return {
    setDisplayValue: setText,
    rmDisplayValue: `${formatDisplayNumber(Math.round(estimatedOneRepMax))} kg`,
    isEstimated: true,
    estimatedLabel: "estimated",
  };
}

async function cloneWorkoutContents(
  db,
  { sourceWorkoutId, targetWorkoutId, resetPersonalRecords = false }
) {
  const exercises = await weightliftingRepository.getExercisesByWorkoutId(
    db,
    sourceWorkoutId
  );

  for (const exercise of exercises) {
    const exerciseResult = await weightliftingRepository.createExercise(db, {
      workoutId: targetWorkoutId,
      exerciseName: exercise.exercise_name,
      sets: exercise.sets,
      visibleColumns: exercise.visible_columns,
      note: exercise.note,
      done: 0,
      exerciseOrder: normalizeExerciseOrder(exercise.exercise_order),
    });

    const sets = await weightliftingRepository.getSetsByExercise(
      db,
      exercise.exercise_id
    );

    for (const set of sets) {
      await weightliftingRepository.createSet(db, {
        setNumber: set.set_number,
        exerciseId: exerciseResult.lastInsertRowId,
        personalRecord: resetPersonalRecords ? 0 : set.personal_record,
        pause: set.pause,
        rpe: set.rpe,
        weight: set.weight,
        rmPercentage: set.rm_percentage,
        reps: set.reps,
        done: 0,
        failed: 0,
        amrap: set.amrap,
        note: set.note,
      });
    }
  }

  const runSets = await runningRepository.getOrderedRunSetsForWorkout(
    db,
    sourceWorkoutId
  );

  for (const runSet of runSets) {
    await runningRepository.createRunSet(db, {
      workoutId: targetWorkoutId,
      type: runSet.type,
      setNumber: runSet.set_number,
      isPause: runSet.is_pause,
      distance: runSet.distance,
      pace: runSet.pace,
      time: runSet.time,
      heartrate: runSet.heartrate,
      done: 0,
    });
  }
}

function formatSetCountLabel(count) {
  return count === 1 ? "1 set" : `${count} sets`;
}

function formatExerciseRepSummary(exercise, exerciseSets) {
  const numericSetCount = Number(exercise.sets);
  const setCount =
    Number.isFinite(numericSetCount) && numericSetCount > 0
      ? numericSetCount
      : exerciseSets.length;
  const validReps = exerciseSets
    .map((set) => Number(set.reps))
    .filter((reps) => Number.isFinite(reps) && reps > 0);

  if (validReps.length === 0) {
    return setCount > 0 ? formatSetCountLabel(setCount) : null;
  }

  const firstReps = validReps[0];
  const allSame = validReps.every((reps) => reps === firstReps);

  if (allSame && setCount > 0) {
    return `${setCount} x ${firstReps}`;
  }

  const preview = validReps.slice(0, 4).join("/");
  return validReps.length > 4 ? `${preview}/...` : preview;
}

function buildRunPreviewItems(runSets) {
  const activeCounts = {
    WARMUP: 0,
    WORKING_SET: 0,
    COOLDOWN: 0,
  };
  const activeDoneCounts = {
    WARMUP: 0,
    WORKING_SET: 0,
    COOLDOWN: 0,
  };

  for (const runSet of runSets) {
    if (Number(runSet.is_pause) === 1) {
      continue;
    }

    if (activeCounts[runSet.type] !== undefined) {
      activeCounts[runSet.type] += 1;
      if (Number(runSet.done) === 1) {
        activeDoneCounts[runSet.type] += 1;
      }
    }
  }

  const previewItems = [];

  if (activeCounts.WARMUP > 0) {
    previewItems.push({
      label: "Warmup",
      detail: formatSetCountLabel(activeCounts.WARMUP),
      done: activeDoneCounts.WARMUP === activeCounts.WARMUP,
    });
  }

  if (activeCounts.WORKING_SET > 0) {
    previewItems.push({
      label: "Working sets",
      detail: formatSetCountLabel(activeCounts.WORKING_SET),
      done: activeDoneCounts.WORKING_SET === activeCounts.WORKING_SET,
    });
  }

  if (activeCounts.COOLDOWN > 0) {
    previewItems.push({
      label: "Cooldown",
      detail: formatSetCountLabel(activeCounts.COOLDOWN),
      done: activeDoneCounts.COOLDOWN === activeCounts.COOLDOWN,
    });
  }

  if (previewItems.length > 0) {
    return previewItems;
  }

  if (runSets.length > 0) {
    return [
      {
        label: "Running session",
        detail: formatSetCountLabel(runSets.length),
        done: runSets.every((runSet) => Number(runSet.done) === 1),
      },
    ];
  }

  return [];
}

async function buildWorkoutPreview(db, workout) {
  const exercises = await weightliftingRepository.getExercisesByWorkout(
    db,
    workout.workout_id
  );

  if (exercises.length > 0) {
    const sets = await weightliftingRepository.getSetsByWorkout(db, workout.workout_id);
    const setsByExerciseId = {};

    for (const set of sets) {
      if (!setsByExerciseId[set.exercise_instance_id]) {
        setsByExerciseId[set.exercise_instance_id] = [];
      }

      setsByExerciseId[set.exercise_instance_id].push(set);
    }

    return {
      ...workout,
      previewItems: exercises.map((exercise) => ({
        label: exercise.exercise_name,
        detail: formatExerciseRepSummary(
          exercise,
          setsByExerciseId[exercise.exercise_id] ?? []
        ),
        done: Number(exercise.done) === 1,
      })),
    };
  }

  const runSets = await runningRepository.getOrderedRunSetsForWorkout(
    db,
    workout.workout_id
  );

  return {
    ...workout,
    previewItems: buildRunPreviewItems(runSets),
  };
}

export async function syncProgramsWithCloud(db) {
  return syncProgramsWithCloudInternal(db);
}

export async function syncMesocyclesWithCloud(db) {
  return syncMesocyclesWithCloudInternal(db);
}

export async function syncMicrocyclesWithCloud(db) {
  return syncMicrocyclesWithCloudInternal(db);
}

export async function syncDaysWithCloud(db) {
  return syncDaysWithCloudInternal(db);
}

export async function syncWorkoutTypeInstancesWithCloud(db) {
  return syncWorkoutTypeInstancesWithCloudInternal(db);
}

export async function syncExerciseInstancesWithCloud(db) {
  return syncExerciseInstancesWithCloudInternal(db);
}

export async function syncSetsWithCloud(db) {
  return syncSetsWithCloudInternal(db);
}

export async function pushDirtyStrengthHierarchyWithCloud(db) {
  return pushDirtyProgramHierarchyWithCloudInternal(db);
}

export async function createProgram(db, { programName, startDate, status }) {
  await programRepository.createProgram(db, { programName, startDate, status });
  syncProgramsInBackground(db);
}

export async function getProgramsOverview(db) {
  return programRepository.getProgramsOverview(db);
}

export async function getProgramStatus(db, programId) {
  return programRepository.getProgramStatus(db, programId);
}

export async function getProgramName(db, programId) {
  return programRepository.getProgramName(db, programId);
}

export async function getProgramBestExerciseOptions(db, programId) {
  const exercises = await weightliftingRepository.getProgramExerciseNames(
    db,
    programId
  );
  const selections = await programRepository.getProgramBestExerciseSelections(
    db,
    programId
  );
  const selectionMap = new Map(
    selections.map((selection) => [
      selection.exercise_name,
      Number(selection.is_selected) === 1,
    ])
  );

  for (const exercise of exercises) {
    if (!selectionMap.has(exercise.exercise_name)) {
      await programRepository.insertProgramBestExerciseSelection(db, {
        programId,
        exerciseName: exercise.exercise_name,
        isSelected: true,
      });
    }
  }

  return exercises.map((exercise) => ({
    exercise_name: exercise.exercise_name,
    is_selected: selectionMap.get(exercise.exercise_name) ?? true,
  }));
}

export async function setProgramBestExerciseSelection(
  db,
  { programId, exerciseName, isSelected }
) {
  await programRepository.upsertProgramBestExerciseSelection(db, {
    programId,
    exerciseName,
    isSelected,
  });
}

export async function updateProgramStatus(db, { programId, status }) {
  await programRepository.updateProgramStatus(db, { programId, status });
  syncProgramsInBackground(db);
}

export async function updateProgramName(db, { programId, programName }) {
  await programRepository.updateProgramName(db, { programId, programName });
  syncProgramsInBackground(db);
}

export async function getProgramDayCount(db, programId) {
  return programRepository.getProgramDayCount(db, programId);
}

export async function getTodayProgramSnapshot(db, { programId, date }) {
  const day = await programRepository.getDayByProgramAndDate(db, {
    programId,
    date,
  });

  if (!day) {
    return null;
  }

  const workouts = await programRepository.getWorkoutsByDayId(db, day.day_id);
  const sets = await programRepository.getSetDoneStatesByDayId(db, day.day_id);
  const workoutsWithPreview = await Promise.all(
    workouts.map((workout) => buildWorkoutPreview(db, workout))
  );

  return {
    day,
    workouts: workoutsWithPreview,
    counts: {
      total: sets.length,
      done: sets.filter((set) => set.done === 1).length,
    },
  };
}

export async function getTodayActivitySummary(db, { date }) {
  const todaySnapshots = await getTodayWorkoutSnapshots(db, { date });
  const todaysWorkouts = todaySnapshots.flatMap((snapshot) => snapshot.workouts);

  if (!todaysWorkouts.length) {
    return {
      activityState: "rest",
      detail: "Rest day",
      workoutType: null,
      workoutLabel: null,
    };
  }

  const liveWorkout = todaysWorkouts.find((workout) => isWorkoutLive(workout));

  if (liveWorkout) {
    return {
      activityState: "live",
      detail: formatElapsedWorkoutDetail(liveWorkout),
      workoutType: liveWorkout.workout_type ?? null,
      workoutLabel: liveWorkout.label ?? liveWorkout.workout_type ?? null,
    };
  }

  const plannedWorkouts = todaysWorkouts.filter(
    (workout) => Number(workout.done) !== 1
  );

  if (plannedWorkouts.length > 0) {
    const nextPlannedWorkout = plannedWorkouts[0];

    return {
      activityState: "planned",
      detail: plannedWorkouts.length > 1 ? `${plannedWorkouts.length} planned` : "Planned",
      workoutType: nextPlannedWorkout.workout_type ?? null,
      workoutLabel:
        nextPlannedWorkout.label ?? nextPlannedWorkout.workout_type ?? null,
    };
  }

  const completedWorkout = todaysWorkouts[todaysWorkouts.length - 1];

  return {
    activityState: "done",
    detail: todaysWorkouts.length > 1 ? `${todaysWorkouts.length} done` : "Done today",
    workoutType: completedWorkout?.workout_type ?? null,
    workoutLabel: completedWorkout?.label ?? completedWorkout?.workout_type ?? null,
  };
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

async function syncDirtyLocalRowToCloud({
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

async function applyQueuedCloudDelete({
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

function shouldKeepLocalEntityForCloudTombstone(localEntity, cloudEntity) {
  return (
    localEntity &&
    Number(localEntity.needs_sync) === 1 &&
    compareEntitySyncVersions(localEntity, cloudEntity) > 0
  );
}

async function deleteLocalMesocycleHierarchy(db, mesocycleId) {
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

async function deleteLocalMicrocycleHierarchy(db, microcycleId) {
  await programRepository.deleteSetsByMicrocycle(db, microcycleId);
  await programRepository.deleteExercisesByMicrocycle(db, microcycleId);
  await programRepository.deleteRunsByMicrocycle(db, microcycleId);
  await programRepository.deleteWorkoutsByMicrocycle(db, microcycleId);
  await programRepository.deleteDaysByMicrocycle(db, microcycleId);
  await programRepository.deleteMicrocycleById(db, microcycleId);
}

async function deleteLocalWorkoutHierarchy(db, workoutId) {
  await weightliftingRepository.deleteSetsByWorkout(db, workoutId);
  await weightliftingRepository.deleteExercisesByWorkout(db, workoutId);
  await runningRepository.deleteRunSetsByWorkout(db, workoutId);
  await programRepository.deleteWorkoutById(db, workoutId);
}

async function deleteLocalDayHierarchy(db, dayId) {
  const dayWorkouts = await programRepository.getWorkoutsByDayId(db, dayId);

  for (const dayWorkout of dayWorkouts) {
    await deleteLocalWorkoutHierarchy(db, dayWorkout.workout_id);
  }

  await programRepository.deleteDayById(db, dayId);
}

export async function getTodayProgramSnapshots(db, { date }) {
  const programs = await programRepository.getProgramsOverview(db);
  const snapshots = await Promise.all(
    programs.map(async (program) => {
      const snapshot = await getTodayProgramSnapshot(db, {
        programId: program.program_id,
        date,
      });

      if (!snapshot || snapshot.workouts.length === 0) {
        return null;
      }

      return {
        ...snapshot,
        program,
      };
    })
  );

  return snapshots.filter(Boolean);
}

export async function getTodayWorkoutSnapshots(db, { date }) {
  const programSnapshots = await getTodayProgramSnapshots(db, { date });
  const normalizedLocalDate = normalizeLocalDateString(date);
  const normalizedIsoDate = normalizeIsoDateString(date);

  if (!normalizedLocalDate || !normalizedIsoDate) {
    return programSnapshots;
  }

  const calendarWorkouts = await programRepository.getWorkoutsBetweenDates(db, {
    startIsoDate: normalizedIsoDate,
    endIsoDate: normalizedIsoDate,
  });
  const standaloneWorkouts = calendarWorkouts.filter(
    (workout) => workout.program_id == null
  );

  if (standaloneWorkouts.length === 0) {
    return programSnapshots;
  }

  const workoutsWithPreview = await Promise.all(
    standaloneWorkouts.map((workout) => buildWorkoutPreview(db, workout))
  );
  const standaloneDay = {
    day_id: standaloneWorkouts[0]?.day_id ?? null,
    date: normalizedLocalDate,
    Weekday: standaloneWorkouts[0]?.weekday ?? null,
    program_id: null,
  };

  return [
    ...programSnapshots,
    {
      day: standaloneDay,
      workouts: workoutsWithPreview,
      program: null,
    },
  ];
}

export async function getRecentWorkouts(
  db,
  { date = formatDate(new Date()), limit = 2 } = {}
) {
  const localDate = normalizeLocalDateString(date) ?? formatDate(new Date());
  const maxIsoDate =
    normalizeIsoDateString(localDate) ??
    normalizeIsoDateString(formatDate(new Date()));
  const workouts = await programRepository.getRecentWorkouts(db, {
    maxIsoDate,
    limit,
  });

  return Promise.all(workouts.map((workout) => buildWorkoutPreview(db, workout)));
}

function normalizeUsualExerciseName(exerciseName) {
  return String(exerciseName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function buildWorkoutTypeLabel(workoutType) {
  if (workoutType === "StrengthTraining") {
    return "Resistance";
  }

  return workoutType ?? "Workout";
}

function compareUsualWorkoutGroups(left, right, todayWeekday) {
  const leftMatchesToday = left.weekdays.has(todayWeekday) ? 1 : 0;
  const rightMatchesToday = right.weekdays.has(todayWeekday) ? 1 : 0;

  if (leftMatchesToday !== rightMatchesToday) {
    return rightMatchesToday - leftMatchesToday;
  }

  if (left.occurrenceCount !== right.occurrenceCount) {
    return right.occurrenceCount - left.occurrenceCount;
  }

  return right.latestWorkout.date_iso.localeCompare(left.latestWorkout.date_iso);
}

export async function getUsualWorkouts(
  db,
  {
    date = formatDate(new Date()),
    limit = 2,
    historyLimit = 120,
    minOccurrences = 2,
  } = {}
) {
  const localDate = normalizeLocalDateString(date) ?? formatDate(new Date());
  const maxIsoDate =
    normalizeIsoDateString(localDate) ??
    normalizeIsoDateString(formatDate(new Date()));
  const todayWeekday = getWeekdayLabel(parseCustomDate(localDate));
  const rows = await programRepository.getCompletedWorkoutExerciseHistory(db, {
    maxIsoDate,
    limit: historyLimit,
  });
  const workoutsById = new Map();

  for (const row of rows) {
    if (!workoutsById.has(row.workout_id)) {
      workoutsById.set(row.workout_id, {
        workout_id: row.workout_id,
        workout_type: row.workout_type,
        label: row.label,
        date: row.date,
        date_iso: row.date_iso,
        weekday: row.weekday,
        program_id: row.program_id,
        program_name: row.program_name,
        exerciseNames: new Map(),
      });
    }

    const workout = workoutsById.get(row.workout_id);
    const normalizedExerciseName = normalizeUsualExerciseName(row.exercise_name);

    if (normalizedExerciseName) {
      workout.exerciseNames.set(
        normalizedExerciseName,
        String(row.exercise_name).trim()
      );
    }
  }

  const groups = new Map();

  for (const workout of workoutsById.values()) {
    const exerciseSignature = [...workout.exerciseNames.keys()].sort();

    if (exerciseSignature.length === 0) {
      continue;
    }

    const signatureKey = `${workout.workout_type}::${exerciseSignature.join("|")}`;

    if (!groups.has(signatureKey)) {
      groups.set(signatureKey, {
        id: signatureKey,
        workoutType: workout.workout_type,
        title: workout.label ?? buildWorkoutTypeLabel(workout.workout_type),
        exerciseCount: exerciseSignature.length,
        occurrenceCount: 0,
        latestWorkout: workout,
        weekdays: new Set(),
      });
    }

    const group = groups.get(signatureKey);
    group.occurrenceCount += 1;
    group.weekdays.add(workout.weekday);

    if (workout.date_iso > group.latestWorkout.date_iso) {
      group.latestWorkout = workout;
      group.title = workout.label ?? buildWorkoutTypeLabel(workout.workout_type);
    }
  }

  return [...groups.values()]
    .filter((group) => group.occurrenceCount >= minOccurrences)
    .sort((left, right) => compareUsualWorkoutGroups(left, right, todayWeekday))
    .slice(0, limit)
    .map((group) => ({
      id: group.id,
      title: group.title,
      workout_type: group.workoutType,
      exerciseCount: group.exerciseCount,
      occurrenceCount: group.occurrenceCount,
      latestDate: group.latestWorkout.date,
      latestDateIso: group.latestWorkout.date_iso,
      suggested: group.weekdays.has(todayWeekday),
    }));
}

export async function getWorkoutCalendarWorkouts(
  db,
  { startIsoDate, endIsoDate }
) {
  const normalizedStartDate = normalizeIsoDateString(startIsoDate);
  const normalizedEndDate = normalizeIsoDateString(endIsoDate);

  if (!normalizedStartDate || !normalizedEndDate) {
    return [];
  }

  return programRepository.getWorkoutsBetweenDates(db, {
    startIsoDate: normalizedStartDate,
    endIsoDate: normalizedEndDate,
  });
}

export async function getWorkoutCalendarProgramDays(
  db,
  { startIsoDate, endIsoDate }
) {
  const normalizedStartDate = normalizeIsoDateString(startIsoDate);
  const normalizedEndDate = normalizeIsoDateString(endIsoDate);

  if (!normalizedStartDate || !normalizedEndDate) {
    return [];
  }

  return programRepository.getProgramDaysBetweenDates(db, {
    startIsoDate: normalizedStartDate,
    endIsoDate: normalizedEndDate,
  });
}

export async function getProgramExerciseBests(db, programId) {
  const sets = await programRepository.getCompletedStrengthSetsByProgram(
    db,
    programId
  );
  const bestsByExercise = {};

  for (const set of sets) {
    const weight = Number(set.weight);
    const reps = Number(set.reps);

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) {
      continue;
    }

    const estimatedOneRepMax = calculateBrzyckiOneRepMax(weight, reps);

    if (estimatedOneRepMax === null) {
      continue;
    }

    const currentBest = bestsByExercise[set.exercise_name];

    if (
      !currentBest ||
      estimatedOneRepMax > currentBest.estimatedOneRepMax
    ) {
      bestsByExercise[set.exercise_name] = {
        exercise_name: set.exercise_name,
        weight,
        reps,
        performedDate: set.performed_date ?? null,
        estimatedOneRepMax,
        ...formatProgramBestDisplay({
          weight,
          reps,
          estimatedOneRepMax,
        }),
      };
    }
  }

  return Object.values(bestsByExercise).sort((left, right) =>
    left.exercise_name.localeCompare(right.exercise_name)
  );
}

export async function deleteProgram(db, programId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getProgramSyncMetadata(
      db,
      programId
    );

    const cloudProgramId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_program_id"
    );

    if (cloudProgramId !== null) {
      await programRepository.queueProgramDeleteSync(db, {
        cloudProgramId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await programRepository.deleteSetsByProgram(db, programId);
    await programRepository.deleteExercisesByProgram(db, programId);
    await programRepository.deleteRunsByProgram(db, programId);
    await programRepository.deleteWorkoutsByProgram(db, programId);
    await programRepository.deleteDaysByProgram(db, programId);
    await programRepository.deleteMicrocyclesByProgram(db, programId);
    await programRepository.deleteEstimatedSetsByProgram(db, programId);
    await weightliftingRepository.deleteRmWeightProgressionsByProgram(
      db,
      programId
    );
    await programRepository.deleteProgramBestExercisesByProgram(db, programId);
    await programRepository.deleteMesocyclesByProgram(db, programId);
    await programRepository.deleteProgramById(db, programId);
  });

  try {
    await syncProgramsWithCloud(db);
  } catch (error) {
    console.error(
      "Program cloud delete sync failed after local delete; the delete remains queued for retry:",
      error
    );
  }
}

export async function createMesocycle(
  db,
  { programId, startDate, weeks = 0, focus }
) {
  const mesocycleId = await withTransaction(db, async () => {
    const weekTotal = Math.max(0, Number(weeks) || 0);
    const mesocycleCount = await programRepository.countMesocyclesByProgram(
      db,
      programId
    );
    const weekCount = await programRepository.countMicrocyclesByProgram(
      db,
      programId
    );

    const mesocycleResult = await programRepository.insertMesocycle(db, {
      programId,
      mesocycleNumber: (mesocycleCount?.count ?? 0) + 1,
      weeks: weekTotal,
      focus,
    });
    const mesocycleNumber = (mesocycleCount?.count ?? 0) + 1;
    const estimatedSets = await weightliftingRepository.getEstimatedSets(
      db,
      programId
    );

    for (const estimatedSet of estimatedSets) {
      const previousProgression =
        await weightliftingRepository.getLatestRmProgressionWeightBeforeMesocycle(
          db,
          {
            programId,
            exerciseName: estimatedSet.exercise_name,
            mesocycleNumber,
          }
        );

      await weightliftingRepository.insertRmWeightProgression(db, {
        mesocycleId: mesocycleResult.lastInsertRowId,
        exerciseName: estimatedSet.exercise_name,
        progressionWeight:
          mesocycleNumber > 1
            ? Number(previousProgression?.progression_weight || 0) + 2.5
            : 0,
      });
    }

    for (let week = 1; week <= weekTotal; week += 1) {
      const microcycleResult = await programRepository.insertMicrocycle(db, {
        mesocycleId: mesocycleResult.lastInsertRowId,
        microcycleNumber: week,
      });

      for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
        const currentDay =
          (weekCount?.count ?? 0) * 7 +
          (week * 7 - 7) +
          dayIndex;

        const date = parseCustomDate(startDate);
        date.setDate(date.getDate() + currentDay);

        await programRepository.insertDay(db, {
          microcycleId: microcycleResult.lastInsertRowId,
          programId,
          weekday: WEEK_DAYS[dayIndex],
          date: formatDate(date),
        });
      }
    }

    return mesocycleResult.lastInsertRowId;
  });

  syncMesocyclesInBackground(db);
  syncMicrocyclesInBackground(db);
  syncDaysInBackground(db);
  return mesocycleId;
}

export async function getMesocyclesByProgram(db, programId) {
  return programRepository.getMesocyclesByProgram(db, programId);
}

export async function getMesocycleWorkoutCountsByProgram(db, programId) {
  return programRepository.getMesocycleWorkoutCountsByProgram(db, programId);
}

export async function getProgramStats(db, programId) {
  const [overview, weekRows] = await Promise.all([
    programRepository.getProgramOverviewStats(db, programId),
    programRepository.getProgramWeekCompletionStats(db, programId),
  ]);
  const totalWorkouts = Number(overview?.total_workouts) || 0;
  const completedWorkouts = Number(overview?.completed_workouts) || 0;
  const today = parseCustomDate(formatDate(new Date()));
  let streakWeeks = 0;

  const activeWeekRows = weekRows.filter((week) => {
    if (!week.period_start) {
      return false;
    }

    const weekStart = parseCustomDate(week.period_start);
    return !Number.isNaN(weekStart.getTime()) && weekStart <= today;
  });

  for (let index = activeWeekRows.length - 1; index >= 0; index -= 1) {
    const week = activeWeekRows[index];
    const weekWorkoutCount = Number(week.total_workouts) || 0;
    const weekCompletedWorkoutCount = Number(week.completed_workouts) || 0;
    const maintainsStreak =
      weekWorkoutCount === 0 || weekCompletedWorkoutCount >= weekWorkoutCount;

    if (!maintainsStreak) {
      break;
    }

    streakWeeks += 1;
  }

  return {
    totalVolume: Math.round(Number(overview?.total_volume) || 0),
    avgSessionMinutes: Math.round(
      (Number(overview?.avg_session_seconds) || 0) / 60
    ),
    completionPercent:
      totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0,
    completedWorkouts,
    totalWorkouts,
    streakWeeks,
  };
}

export async function updateMesocycleFocus(db, { mesocycleId, focus }) {
  await programRepository.updateMesocycleFocus(db, { mesocycleId, focus });
  syncMesocyclesInBackground(db);
}

export async function addWeekToMesocycle(db, { mesocycleId, programId }) {
  const insertedMicrocycleId = await withTransaction(db, async () => {
    const weeks = await programRepository.getMicrocyclesByMesocycleForInsert(
      db,
      mesocycleId
    );
    const lastWeek = weeks[weeks.length - 1];
    const lastDay = lastWeek
      ? await programRepository.getLastSundayByMicrocycle(
          db,
          lastWeek.microcycle_id
        )
      : null;
    const mesocycleMetadata =
      !lastDay?.date
        ? await programRepository.getMesocycleMetadata(db, {
            mesocycleId,
            programId,
          })
        : null;
    const programMetadata =
      !lastDay?.date
        ? await programRepository.getProgramMetadata(db, programId)
        : null;
    const weeksBefore =
      !lastDay?.date && mesocycleMetadata
        ? await getWeeksBeforeMesocycle(db, {
            programId,
            mesocycleNumber: mesocycleMetadata.mesocycle_number,
          })
        : 0;

    if (!lastDay?.date && !mesocycleMetadata) {
      throw new Error("Block not found for new week.");
    }

    if (!lastDay?.date && !programMetadata?.start_date) {
      throw new Error("Program start date not found for new block week.");
    }

    const microcycleResult = await programRepository.insertMicrocycle(db, {
      mesocycleId,
      microcycleNumber: weeks.length + 1,
    });

    for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
      const date = parseCustomDate(lastDay?.date ?? programMetadata?.start_date);

      if (!lastDay?.date) {
        date.setDate(
          date.getDate() + (weeksBefore + weeks.length) * 7 + dayIndex
        );
      } else {
        date.setDate(date.getDate() + dayIndex + 1);
      }

      await programRepository.insertDay(db, {
        microcycleId: microcycleResult.lastInsertRowId,
        programId,
        weekday: WEEK_DAYS[dayIndex],
        date: formatDate(date),
      });
    }

    await programRepository.incrementMesocycleWeeks(db, mesocycleId);

    return microcycleResult.lastInsertRowId;
  });

  syncMesocyclesInBackground(db);
  syncMicrocyclesInBackground(db);
  syncDaysInBackground(db);
  return insertedMicrocycleId;
}

export async function deleteMesocycle(db, mesocycleId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getMesocycleSyncMetadata(
      db,
      mesocycleId
    );

    const cloudMesocycleId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_mesocycle_id"
    );

    if (cloudMesocycleId !== null) {
      await programRepository.queueMesocycleDeleteSync(db, {
        cloudMesocycleId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

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
  });

  syncMesocyclesInBackground(db);
}

export async function getMesocycleOptions(db, programId) {
  return programRepository.getMesocycleOptions(db, programId);
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

export async function getGlobalWeekIndexFromMicrocycle(
  db,
  { programId, microcycleId }
) {
  const microcycle = await programRepository.getMicrocycleNumberAndMesocycleNumber(
    db,
    {
      programId,
      microcycleId,
    }
  );

  if (!microcycle) {
    throw new Error("Microcycle not found");
  }

  const weeksBefore = await getWeeksBeforeMesocycle(db, {
    programId,
    mesocycleNumber: microcycle.mesocycle_number,
  });

  return weeksBefore + (microcycle.microcycle_number - 1);
}

export async function getMicrocyclesByMesocycle(db, mesocycleId) {
  return programRepository.getMicrocyclesByMesocycle(db, mesocycleId);
}

export async function updateMicrocycleFocus(db, { microcycleId, focus }) {
  await programRepository.updateMicrocycleFocus(db, { microcycleId, focus });
  syncMicrocyclesInBackground(db);
}

export async function getMicrocycleWorkoutCounts(db, microcycleId) {
  const total = await programRepository.getTotalWorkoutCountByMicrocycle(
    db,
    microcycleId
  );
  const done = await programRepository.getDoneWorkoutCountByMicrocycle(
    db,
    microcycleId
  );

  return {
    total: total?.count ?? 0,
    done: done?.count ?? 0,
  };
}

export async function getDayByMicrocycleAndDate(
  db,
  { microcycleId, date }
) {
  return programRepository.getDayByMicrocycleAndDate(db, {
    microcycleId,
    date,
  });
}

export async function getWorkoutLabelsByDay(db, dayId) {
  return programRepository.getWorkoutLabelsByDay(db, dayId);
}

export async function getMicrocycleOptions(db, programId) {
  const mesocycles = await programRepository.getMesocycleOptions(db, programId);
  const microcycles = await programRepository.getAllMicrocyclesByProgram(
    db,
    programId
  );

  return { mesocycles, microcycles };
}

export async function copyMicrocycleWorkouts(
  db,
  { sourceMicrocycleId, targetMicrocycleId }
) {
  await withTransaction(db, async () => {
    const sourceDays = await programRepository.getDaysByMicrocycle(
      db,
      sourceMicrocycleId
    );
    const targetDays = await programRepository.getDaysByMicrocycle(
      db,
      targetMicrocycleId
    );

    const targetDayMap = {};
    for (const day of targetDays) {
      targetDayMap[day.Weekday] = day;
    }

    for (const sourceDay of sourceDays) {
      const targetDay = targetDayMap[sourceDay.Weekday];
      if (!targetDay) {
        continue;
      }

      const workouts = await programRepository.getWorkoutsByDay(
        db,
        sourceDay.day_id
      );

      for (const workout of workouts) {
        const workoutResult = await programRepository.createWorkout(db, {
          date: targetDay.date,
          dayId: targetDay.day_id,
          workoutType: workout.workout_type,
          label: workout.label,
        });

        await cloneWorkoutContents(db, {
          sourceWorkoutId: workout.workout_id,
          targetWorkoutId: workoutResult.lastInsertRowId,
        });
      }

      const hierarchy = await workoutRepository.getDayHierarchyIds(
        db,
        targetDay.day_id
      );
      await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
        dayId: hierarchy?.day_id,
        microcycleId: hierarchy?.microcycle_id,
        mesocycleId: hierarchy?.mesocycle_id,
      });
    }
  });

  syncWorkoutTypeInstancesInBackground(db);
  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function deleteMicrocycle(db, microcycleId) {
  let mesocycleId = null;

  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getMicrocycleSyncMetadata(
      db,
      microcycleId
    );
    const metadata = await programRepository.getMicrocycleMetadata(db, microcycleId);
    mesocycleId = metadata?.mesocycle_id ?? null;

    const cloudMicrocycleId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_microcycle_id"
    );

    if (cloudMicrocycleId !== null) {
      await programRepository.queueMicrocycleDeleteSync(db, {
        cloudMicrocycleId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await programRepository.deleteSetsByMicrocycle(db, microcycleId);
    await programRepository.deleteExercisesByMicrocycle(db, microcycleId);
    await programRepository.deleteRunsByMicrocycle(db, microcycleId);
    await programRepository.deleteWorkoutsByMicrocycle(db, microcycleId);
    await programRepository.deleteDaysByMicrocycle(db, microcycleId);
    await programRepository.deleteMicrocycleById(db, microcycleId);

    if (mesocycleId) {
      await workoutRepository.updateMesocycleDoneFromMicrocycles(db, mesocycleId);
    }
  });

  try {
    await syncMicrocyclesWithCloud(db);
  } catch (error) {
    console.error(
      "Microcycle cloud delete sync failed after local delete; the delete remains queued for retry:",
      error
    );
  }
}

export async function getDayDetails(db, { microcycleId, weekday }) {
  const day = await programRepository.getDayByWeekdayAndMicrocycle(db, {
    weekday,
    microcycleId,
  });

  if (!day?.day_id) {
    return null;
  }

  const workouts = await programRepository.getWorkoutsByDayId(db, day.day_id);
  const workoutExercises = [];

  for (const workout of workouts) {
    const exercises = await weightliftingRepository.getExerciseSummariesByWorkout(
      db,
      workout.workout_id
    );

    workoutExercises.push({
      workout_id: workout.workout_id,
      label: workout.label,
      exercises,
    });
  }

  return {
    ...day,
    workouts,
    workoutExercises,
    workoutsDone: day.done === 1,
  };
}

async function persistSicknessPeriodForDay(
  db,
  {
    date,
    previousDate = null,
    continuesPrevious = false,
    sicknessType = null,
    note = null,
  }
) {
  if (!date) {
    return;
  }

  if (!continuesPrevious && previousDate) {
    const previousPeriod =
      await programRepository.getSicknessPeriodCoveringDate(db, {
        date: previousDate,
      });
    const previousPeriodEndDate =
      previousPeriod?.end_date ?? previousPeriod?.start_date ?? null;
    const previousPeriodAlreadyCoversDate =
      !previousPeriod?.end_date ||
      (previousPeriodEndDate &&
        parseCustomDate(previousPeriodEndDate) >= parseCustomDate(date));

    if (previousPeriod?.sickness_id && previousPeriodAlreadyCoversDate) {
      await programRepository.trimSicknessPeriodEndDate(db, {
        sicknessId: previousPeriod.sickness_id,
        endDate: previousDate,
      });
    }
  }

  if (continuesPrevious && previousDate) {
    let previousPeriod =
      await programRepository.getSicknessPeriodEndingOnDate(db, {
        date: previousDate,
      });

    if (!previousPeriod?.sickness_id) {
      previousPeriod =
        await programRepository.getSicknessPeriodCoveringDate(db, {
          date: previousDate,
        });
    }

    if (previousPeriod?.sickness_id) {
      if (
        !previousPeriod.end_date ||
        parseCustomDate(previousPeriod.end_date) >= parseCustomDate(date)
      ) {
        return;
      }

      await programRepository.extendSicknessPeriod(db, {
        sicknessId: previousPeriod.sickness_id,
        endDate: date,
      });
      return;
    }

    await programRepository.createSicknessPeriod(db, {
      startDate: previousDate,
      endDate: date,
    });
    return;
  }

  const existingPeriod =
    await programRepository.getSicknessPeriodStartingOnDate(db, { date });

  if (existingPeriod?.sickness_id) {
    return;
  }

  await programRepository.createSicknessPeriod(db, {
    startDate: date,
    endDate: date,
    sicknessType,
    note,
  });
}

export async function markDaySick(
  db,
  {
    dayId,
    isSick,
    date = null,
    previousDate = null,
    continuesPrevious = false,
    sicknessType = null,
    note = null,
  }
) {
  if (!dayId) {
    return;
  }

  await withTransaction(db, async () => {
    await programRepository.updateDaySick(db, { dayId, isSick });

    if (isSick) {
      await persistSicknessPeriodForDay(db, {
        date,
        previousDate,
        continuesPrevious,
        sicknessType,
        note,
      });
    } else {
      await removeDateFromSicknessPeriods(db, { date });
    }
  });

  syncDaysInBackground(db);
}

function getNextLocalDate(date) {
  const nextDate = parseCustomDate(date);
  nextDate.setDate(nextDate.getDate() + 1);
  return formatDate(nextDate);
}

function getPreviousLocalDate(date) {
  const previousDate = parseCustomDate(date);
  previousDate.setDate(previousDate.getDate() - 1);
  return formatDate(previousDate);
}

function compareLocalDates(leftDate, rightDate) {
  return parseCustomDate(leftDate) - parseCustomDate(rightDate);
}

function getSicknessPeriodRebuildRange(periods) {
  let startDate = null;
  let endDate = null;
  let hasOpenEnd = false;

  for (const period of periods) {
    if (!period?.start_date) {
      continue;
    }

    if (!startDate || compareLocalDates(period.start_date, startDate) < 0) {
      startDate = period.start_date;
    }

    if (!period.end_date) {
      hasOpenEnd = true;
      continue;
    }

    if (!endDate || compareLocalDates(period.end_date, endDate) > 0) {
      endDate = period.end_date;
    }
  }

  if (!startDate) {
    return null;
  }

  return {
    startDate,
    endDate: hasOpenEnd ? null : endDate ?? startDate,
  };
}

async function rebuildDaySicknessFlags(db, { previousPeriods = [] } = {}) {
  const activePeriods = await programRepository.getSicknessPeriods(db);
  const rebuildRange = getSicknessPeriodRebuildRange([
    ...previousPeriods,
    ...activePeriods,
  ]);

  if (!rebuildRange) {
    return;
  }

  await programRepository.updateDaysSickBetweenDates(db, {
    startDate: rebuildRange.startDate,
    endDate: rebuildRange.endDate,
    isSick: false,
  });

  for (const period of activePeriods) {
    await programRepository.updateDaysSickBetweenDates(db, {
      startDate: period.start_date,
      endDate: period.end_date,
      isSick: true,
    });
  }
}

async function removeDateFromSicknessPeriods(db, { date }) {
  if (!date) {
    return;
  }

  const sicknessPeriods =
    await programRepository.getSicknessPeriodsCoveringDate(db, { date });

  for (const period of sicknessPeriods) {
    const startsOnDate = compareLocalDates(period.start_date, date) === 0;
    const endsOnDate = period.end_date
      ? compareLocalDates(period.end_date, date) === 0
      : false;
    const singleDayPeriod =
      startsOnDate &&
      (endsOnDate || (!period.end_date && period.start_date === date));

    if (singleDayPeriod) {
      await programRepository.markSicknessPeriodDeleted(db, {
        sicknessId: period.sickness_id,
        deletedAt: new Date().toISOString(),
      });
      continue;
    }

    if (startsOnDate) {
      await programRepository.updateSicknessPeriodStartDate(db, {
        sicknessId: period.sickness_id,
        startDate: getNextLocalDate(date),
      });
      continue;
    }

    if (endsOnDate) {
      await programRepository.trimSicknessPeriodEndDate(db, {
        sicknessId: period.sickness_id,
        endDate: getPreviousLocalDate(date),
      });
      continue;
    }

    await programRepository.trimSicknessPeriodEndDate(db, {
      sicknessId: period.sickness_id,
      endDate: getPreviousLocalDate(date),
    });
    await programRepository.createSicknessPeriod(db, {
      startDate: getNextLocalDate(date),
      endDate: period.end_date,
      sicknessType: period.sickness_type,
      note: period.note,
    });
  }
}

async function trimOverlappingSicknessPeriods(db) {
  const sicknessPeriods = await programRepository.getSicknessPeriods(db);
  const sortedPeriods = [...sicknessPeriods].sort((leftPeriod, rightPeriod) => {
    const dateComparison = compareLocalDates(
      leftPeriod.start_date,
      rightPeriod.start_date
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return leftPeriod.sickness_id - rightPeriod.sickness_id;
  });

  for (const period of sortedPeriods) {
    const overlappingNextPeriod = sortedPeriods.find((candidatePeriod) => {
      if (candidatePeriod.sickness_id === period.sickness_id) {
        return false;
      }

      if (compareLocalDates(candidatePeriod.start_date, period.start_date) <= 0) {
        return false;
      }

      return (
        !period.end_date ||
        compareLocalDates(candidatePeriod.start_date, period.end_date) <= 0
      );
    });

    if (!overlappingNextPeriod) {
      continue;
    }

    await programRepository.trimSicknessPeriodEndDate(db, {
      sicknessId: period.sickness_id,
      endDate: getPreviousLocalDate(overlappingNextPeriod.start_date),
    });
  }
}

export async function createSicknessPeriod(
  db,
  { startDate, endDate = null, sicknessType = null, note = null }
) {
  const sicknessPeriod = await withTransaction(db, async () => {
    const createdSicknessPeriod = await programRepository.createSicknessPeriod(db, {
      startDate,
      endDate,
      sicknessType,
      note,
    });

    await programRepository.updateDaysSickBetweenDates(db, {
      startDate,
      endDate,
      isSick: true,
    });

    return createdSicknessPeriod;
  });

  syncDaysInBackground(db);
  return sicknessPeriod;
}

export async function updateSicknessPeriod(
  db,
  { sicknessId, startDate, endDate = null, sicknessType = null, note = null }
) {
  let didUpdate = false;

  await withTransaction(db, async () => {
    const previousPeriods = await programRepository.getSicknessPeriods(db);
    const previousPeriod = previousPeriods.find(
      (period) => Number(period.sickness_id) === Number(sicknessId)
    );

    if (!previousPeriod?.sickness_id) {
      return;
    }

    await programRepository.updateSicknessPeriod(db, {
      sicknessId,
      startDate,
      endDate,
      sicknessType,
      note,
    });
    await trimOverlappingSicknessPeriods(db);
    await rebuildDaySicknessFlags(db, {
      previousPeriods,
    });
    didUpdate = true;
  });

  if (didUpdate) {
    syncDaysInBackground(db);
  }
}

export async function deleteSicknessPeriod(db, { sicknessId }) {
  let didDelete = false;

  await withTransaction(db, async () => {
    const previousPeriods = await programRepository.getSicknessPeriods(db);
    const previousPeriod = previousPeriods.find(
      (period) => Number(period.sickness_id) === Number(sicknessId)
    );

    if (!previousPeriod?.sickness_id) {
      return;
    }

    await programRepository.markSicknessPeriodDeleted(db, {
      sicknessId,
      deletedAt: new Date().toISOString(),
    });
    await rebuildDaySicknessFlags(db, {
      previousPeriods,
    });
    didDelete = true;
  });

  if (didDelete) {
    syncDaysInBackground(db);
  }
}

export async function getSicknessPeriods(db) {
  await withTransaction(db, async () => {
    await trimOverlappingSicknessPeriods(db);
  });

  return programRepository.getSicknessPeriods(db);
}

export async function getDayByDate(db, { programId, date }) {
  return programRepository.getDayByDate(db, { programId, date });
}

export async function createWorkoutForDay(
  db,
  { date, dayId, workoutType, label }
) {
  const workout = await withTransaction(db, async () => {
    const workout = await programRepository.createWorkout(db, {
      date,
      dayId,
      workoutType,
      label,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return workout;
  });

  syncWorkoutTypeInstancesInBackground(db);
  return workout;
}

export async function createQuickWorkout(
  db,
  { date = new Date(), workoutType, label }
) {
  const workoutDate = date instanceof Date ? date : parseCustomDate(date);
  const normalizedDate = formatDate(workoutDate);
  const weekday = getWeekdayLabel(workoutDate);

  const createdWorkout = await withTransaction(db, async () => {
    const existingDay = await programRepository.getStandaloneDayByDate(db, {
      date: normalizedDate,
    });
    let dayId = existingDay?.day_id ?? null;

    if (!dayId) {
      const dayResult = await programRepository.insertDay(db, {
        microcycleId: null,
        programId: null,
        weekday,
        date: normalizedDate,
      });

      dayId = dayResult.lastInsertRowId;
    }

    const workoutResult = await programRepository.createWorkout(db, {
      date: normalizedDate,
      dayId,
      workoutType,
      label,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return {
      workout_id: workoutResult.lastInsertRowId,
      workout_type: workoutType,
      workout_label: label ?? workoutType,
      date: normalizedDate,
      day: weekday,
      program_id: null,
      program_name: null,
    };
  });

  syncDaysInBackground(db);
  syncWorkoutTypeInstancesInBackground(db);

  return createdWorkout;
}

export async function copyWorkoutToDate(
  db,
  { workoutId, programId, date }
) {
  const copiedWorkoutId = await withTransaction(db, async () => {
    const targetDay = await programRepository.getDayByDate(db, {
      programId,
      date: formatDate(date),
    });

    if (!targetDay?.day_id) {
      return null;
    }

    const workoutResult = await programRepository.copyWorkoutIntoDay(db, {
      date: formatDate(date),
      dayId: targetDay.day_id,
      workoutId,
    });

    await cloneWorkoutContents(db, {
      sourceWorkoutId: workoutId,
      targetWorkoutId: workoutResult.lastInsertRowId,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(
      db,
      targetDay.day_id
    );
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return workoutResult.lastInsertRowId;
  });

  if (copiedWorkoutId) {
    syncWorkoutTypeInstancesInBackground(db);
    syncExerciseInstancesInBackground(db);
    syncSetsInBackground(db);
  }

  return copiedWorkoutId;
}

export async function copyWorkoutToStandaloneDate(
  db,
  { workoutId, date = new Date() }
) {
  const normalizedDate =
    date instanceof Date ? formatDate(date) : normalizeLocalDateString(date);

  if (!normalizedDate) {
    throw new Error("A valid workout date is required.");
  }

  const workoutDate = parseCustomDate(normalizedDate);
  const weekday = getWeekdayLabel(workoutDate);
  const sourceMetadata = await workoutRepository.getWorkoutPageMetadata(
    db,
    workoutId
  );

  if (!sourceMetadata) {
    throw new Error("The recent workout could not be found.");
  }

  if (sourceMetadata.workout_type !== "Run") {
    const localExercises =
      await weightliftingRepository.getExercisesByWorkoutId(db, workoutId);
    const localSetCountRow =
      await weightliftingRepository.getTotalPlannedSetsByWorkout(db, workoutId);
    const localSetCount = Number(localSetCountRow?.count) || 0;
    const plannedSetCount = localExercises.reduce(
      (total, exercise) => total + (Number(exercise.sets) || 0),
      0
    );
    const weightliftingServiceModule = await import("./weightliftingService");

    try {
      await weightliftingServiceModule.hydrateStrengthWorkoutDataForWorkout(
        db,
        workoutId,
        { forceTargetedHydration: true }
      );
    } catch (error) {
      if (localSetCount < plannedSetCount) {
        throw error;
      }

      console.warn(
        "Could not refresh recent workout sets before copying; using complete local data:",
        error
      );
    }
  }

  const sourceSetCountRow =
    await weightliftingRepository.getTotalPlannedSetsByWorkout(db, workoutId);
  const sourceSetCount = Number(sourceSetCountRow?.count) || 0;

  const copiedWorkout = await withTransaction(db, async () => {
    const existingDay = await programRepository.getStandaloneDayByDate(db, {
      date: normalizedDate,
    });
    let dayId = existingDay?.day_id ?? null;

    if (!dayId) {
      const dayResult = await programRepository.insertDay(db, {
        microcycleId: null,
        programId: null,
        weekday,
        date: normalizedDate,
      });

      dayId = dayResult.lastInsertRowId;
    }

    const workoutResult = await programRepository.copyWorkoutIntoDay(db, {
      date: normalizedDate,
      dayId,
      workoutId,
    });

    if (!workoutResult.changes) {
      throw new Error("The recent workout could not be copied.");
    }

    await cloneWorkoutContents(db, {
      sourceWorkoutId: workoutId,
      targetWorkoutId: workoutResult.lastInsertRowId,
      resetPersonalRecords: true,
    });
    const copiedSetCountRow =
      await weightliftingRepository.getTotalPlannedSetsByWorkout(
        db,
        workoutResult.lastInsertRowId
      );
    const copiedSetCount = Number(copiedSetCountRow?.count) || 0;

    if (copiedSetCount !== sourceSetCount) {
      throw new Error("The recent workout sets could not be copied completely.");
    }

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return {
      workout_id: workoutResult.lastInsertRowId,
      workout_type: sourceMetadata.workout_type,
      workout_label: sourceMetadata.workout_label,
      date: normalizedDate,
      day: weekday,
      program_id: null,
      program_name: null,
    };
  });

  if (copiedWorkout) {
    syncDaysInBackground(db);
    syncWorkoutTypeInstancesInBackground(db);
    syncExerciseInstancesInBackground(db);
    syncSetsInBackground(db);
  }

  return copiedWorkout;
}

export async function deleteWorkout(db, workoutId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getWorkoutSyncMetadata(
      db,
      workoutId
    );
    const hierarchy = await workoutRepository.getWorkoutHierarchyIds(
      db,
      workoutId
    );
    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(syncMetadata) ??
      normalizeOptionalInteger(workoutId, null);

    const cloudWorkoutTypeInstanceId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_workout_type_instance_id"
    );

    if (
      cloudWorkoutTypeInstanceId !== null ||
      remoteLocalWorkoutTypeInstanceId !== null
    ) {
      await programRepository.queueWorkoutTypeInstanceDeleteSync(db, {
        cloudWorkoutTypeInstanceId,
        remoteLocalWorkoutTypeInstanceId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await weightliftingRepository.deleteSetsByWorkout(db, workoutId);
    await weightliftingRepository.deleteExercisesByWorkout(db, workoutId);
    await runningRepository.deleteRunSetsByWorkout(db, workoutId);
    await programRepository.deleteWorkoutById(db, workoutId);

    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function getWorkoutOptions(db, programId) {
  return programRepository.getWorkoutOptions(db, programId);
}

export async function getMicrocycleMetadata(db, microcycleId) {
  return programRepository.getMicrocycleMetadata(db, microcycleId);
}

export async function getMesocycleMetadata(
  db,
  { mesocycleId, programId }
) {
  return programRepository.getMesocycleMetadata(db, {
    mesocycleId,
    programId,
  });
}

export async function getProgramMetadata(db, programId) {
  return programRepository.getProgramMetadata(db, programId);
}
