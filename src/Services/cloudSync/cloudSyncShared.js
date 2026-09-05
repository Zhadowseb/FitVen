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
import {
  normalizeBooleanFlag,
  normalizeCloudTimeString,
  normalizeDayDate,
  normalizeExerciseVisibleColumns,
  normalizeLastUpdatedMs,
  normalizeOptionalInteger,
  normalizeOptionalText,
  normalizeWeekday,
  resolveDayCloudLocalId,
  resolveExerciseInstanceCloudLocalId,
  resolveMesocycleCloudLocalId,
  resolveProgramCloudLocalId,
  resolveWorkoutTypeInstanceCloudLocalId,
} from "./cloudSyncFields";
// Re-exported so the entity modules keep importing from one place.
export {
  areComparableDaysEqual,
  areComparableExerciseInstancesEqual,
  areComparableMesocyclesEqual,
  areComparableMicrocyclesEqual,
  areComparableProgramsEqual,
  areComparableSetsEqual,
  areComparableWorkoutTypeInstancesEqual,
  buildCloudDayPayload,
  buildCloudExerciseInstancePayload,
  buildCloudMesocyclePayload,
  buildCloudMicrocyclePayload,
  buildCloudProgramPayload,
  buildCloudSetPayload,
  buildCloudWorkoutTypeInstancePayload,
  getComparableDaySnapshot,
  getComparableExerciseInstanceSnapshot,
  getComparableMesocycleSnapshot,
  getComparableMicrocycleSnapshot,
  getComparableProgramSnapshot,
  getComparableSetSnapshot,
  getComparableWorkoutTypeInstanceSnapshot,
  normalizeBooleanFlag,
  normalizeExerciseOrder,
  normalizeOptionalInteger,
  normalizeProgramStatus,
  normalizeWorkoutLabel,
  normalizeWorkoutType,
  resolveDayCloudLocalId,
  resolveExerciseInstanceCloudLocalId,
  resolveMesocycleCloudLocalId,
  resolveProgramCloudLocalId,
  resolveSetCloudLocalId,
  resolveWorkoutTypeInstanceCloudLocalId,
} from "./cloudSyncFields";

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

export function parseCloudProgramId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveSideBySideCloudId(entity, legacyCloudIdColumn) {
  return normalizeOptionalInteger(
    entity?.cloud_id ?? entity?.[legacyCloudIdColumn],
    null
  );
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

export function parseCloudMicrocycleId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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

export function parseCloudExerciseInstanceId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function serializeExerciseVisibleColumns(value) {
  const normalizedColumns = normalizeExerciseVisibleColumns(value);
  return normalizedColumns ? JSON.stringify(normalizedColumns) : null;
}

export function parseCloudSetId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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
