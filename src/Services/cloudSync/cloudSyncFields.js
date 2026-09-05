// The field-level half of the sync engine: how a row is normalised, compared
// and turned into a cloud payload.
//
// It is deliberately pure - no supabase, no repositories, nothing async - so it
// can be loaded and tested on its own. scripts/test-cloud-sync-fields.js does
// exactly that, which is the only automated coverage the sync engine has.
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
import {
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "@utils/syncUtils";

export const PROGRAM_STATUS_VALUES = new Set(["COMPLETE", "ACTIVE", "NOT_STARTED"]);

export const EXERCISE_VISIBLE_COLUMN_KEYS = [
  "note",
  "rest",
  "set",
  "reps",
  "rpe",
  "rm_percentage",
  "weight",
  "done",
];

export function normalizeProgramName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeProgramStartDate(value) {
  return normalizeLocalDateString(value);
}

export function normalizeProgramStartDateForCloud(value) {
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

/* ========================= THE FIELD TABLES =========================
 *
 * A synced field used to be written out three times per entity: once in the
 * snapshot, once in the equality check, once in the payload. Miss the third
 * and the field works on the phone you tested and vanishes on the next one,
 * silently, after the cloud answers. That is the failure the structure review
 * called the most common one here.
 *
 * One row per field now, and the three functions are derived from it.
 *
 *   key        the column, local and cloud
 *   read       where the value comes from, when it is not just row[key]
 *   local      how it is normalised for the snapshot and the comparison
 *   cloud      how it is normalised for the payload, when that differs
 *   cloudRead  where the payload reads from, when that differs too
 *   compare    false for a field that is in the snapshot but not compared
 *   payload    "head" when the payload builder sets it from an argument
 *              rather than from the row, false when it is not uploaded at all
 */

const int = (fallback = null) => (value) => normalizeOptionalInteger(value, fallback);
const flag = () => normalizeBooleanFlag;
const text = () => normalizeOptionalText;

function field(key, local, options = {}) {
  const read = options.read ?? ((row) => row?.[key]);

  return {
    key,
    read,
    local,
    cloud: options.cloud ?? local,
    cloudRead: options.cloudRead ?? read,
    compare: options.compare !== false,
    inSnapshot: options.inSnapshot !== false,
    inPayload: options.payload !== false && options.payload !== "head",
    // Still uploaded, just by the payload builder from one of its arguments.
    fromPayloadHead: options.payload === "head",
  };
}

export const SYNCED_FIELDS = {
  Program: [
    field("local_program_id", int(), { compare: false, payload: "head" }),
    field("program_name", normalizeProgramName),
    field("start_date", normalizeProgramStartDate, {
      cloud: normalizeProgramStartDateForCloud,
    }),
    field("status", normalizeProgramStatus),
  ],
  Mesocycle: [
    field("cloud_program_id", int(), { payload: "head" }),
    field("mesocycle_number", int(0)),
    field("weeks", int(0)),
    field("focus", text()),
    field("done", flag()),
  ],
  Microcycle: [
    field("cloud_mesocycle_id", int(), { payload: "head" }),
    field("microcycle_number", int(0)),
    field("focus", text()),
    field("done", flag()),
  ],
  Day: [
    field("local_day_id", int(), { compare: false, payload: "head" }),
    field("cloud_microcycle_id", int(), { payload: "head" }),
    field("weekday", normalizeWeekday, {
      read: (row) => row?.weekday ?? row?.Weekday,
    }),
    field("date", normalizeDayDate, { cloud: normalizeDayDateForCloud }),
    field("done", flag()),
    field("is_sick", flag()),
  ],
  WorkoutTypeInstance: [
    field("local_workout_type_instance_id", int(), {
      compare: false,
      payload: "head",
    }),
    field("cloud_day_id", int(), { payload: "head" }),
    field("workout_type", normalizeWorkoutType),
    field("date", normalizeWorkoutDate, { cloud: normalizeWorkoutDateForCloud }),
    field("label", normalizeWorkoutLabel),
    field("done", flag()),
    field("is_active", flag()),
    // Asymmetric on purpose, preserved from the original: the snapshot accepts
    // an already-formatted string, the payload always re-derives from a
    // timestamp and so drops a string. Worth revisiting, but not here.
    field("original_start_time", normalizeCloudTimeString, {
      read: (row) => asCloudTime(row?.original_start_time),
      cloud: timestampToCloudTimeString,
      cloudRead: (row) => row?.original_start_time,
    }),
    field("timer_start", normalizeCloudTimeString, {
      read: (row) => asCloudTime(row?.timer_start),
      cloud: timestampToCloudTimeString,
      cloudRead: (row) => row?.timer_start,
    }),
    field("elapsed_time", (value) => normalizeElapsedDurationSeconds(value, 0)),
  ],
  ExerciseInstance: [
    field("local_exercise_instance_id", int(), {
      compare: false,
      payload: "head",
    }),
    field("cloud_workout_type_instance_id", int(), { payload: "head" }),
    field("exercise_name", normalizeExerciseName),
    field("exercise_order", normalizeExerciseOrder),
    field("sets", int(0)),
    field("visible_columns", normalizeExerciseVisibleColumns),
    field("note", text()),
    field("done", flag()),
  ],
  Set: [
    field("local_set_id", int(), { compare: false, payload: "head" }),
    field("cloud_exercise_instance_id", int(), { payload: "head" }),
    field("set_number", int()),
    field("personal_record", flag()),
    field("pause", int()),
    field("rpe", int()),
    field("weight", int()),
    field("rm_percentage", int()),
    field("reps", int()),
    field("done", flag()),
    field("failed", flag()),
    field("amrap", flag()),
    field("note", text()),
  ],
};

// A workout timestamp arrives either already formatted or as a number.
function asCloudTime(value) {
  return typeof value === "string" ? value : timestampToCloudTimeString(value);
}

/** The snapshot a comparison and a reconcile both work from. */
export function buildSnapshot(entity, row) {
  const snapshot = {};

  for (const f of SYNCED_FIELDS[entity]) {
    if (f.inSnapshot) snapshot[f.key] = f.local(f.read(row));
  }

  return snapshot;
}

/** Equal on every field that counts as a change. */
export function snapshotsEqual(entity, left, right) {
  const leftSnapshot = buildSnapshot(entity, left);
  const rightSnapshot = buildSnapshot(entity, right);

  return SYNCED_FIELDS[entity]
    .filter((f) => f.compare && f.inSnapshot)
    .every((f) => leftSnapshot[f.key] === rightSnapshot[f.key]);
}

/** The field half of a cloud payload; the caller supplies ids and metadata. */
export function buildPayloadFields(entity, row) {
  const payload = {};

  for (const f of SYNCED_FIELDS[entity]) {
    if (f.inPayload) payload[f.key] = f.cloud(f.cloudRead(row));
  }

  return payload;
}

/* The 21 functions the rest of the engine calls, all derived from the tables
 * above. Each entity's payload still names its own ids and metadata, because
 * that part genuinely differs; everything field-shaped comes from one row. */

export function getComparableProgramSnapshot(row) {
  return buildSnapshot("Program", row);
}

export function areComparableProgramsEqual(left, right) {
  return snapshotsEqual("Program", left, right);
}

export function buildCloudProgramPayload(row, userId) {
  return {
    user_id: userId,
    local_program_id: resolveProgramCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    ...buildPayloadFields("Program", row),
  };
}

export function getComparableMesocycleSnapshot(row) {
  return buildSnapshot("Mesocycle", row);
}

export function areComparableMesocyclesEqual(left, right) {
  return snapshotsEqual("Mesocycle", left, right);
}

export function buildCloudMesocyclePayload(row, userId, cloudProgramId) {
  return {
    user_id: userId,
    local_mesocycle_id: resolveMesocycleCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    cloud_program_id: cloudProgramId,
    ...buildPayloadFields("Mesocycle", row),
  };
}

export function getComparableMicrocycleSnapshot(row) {
  return buildSnapshot("Microcycle", row);
}

export function areComparableMicrocyclesEqual(left, right) {
  return snapshotsEqual("Microcycle", left, right);
}

export function buildCloudMicrocyclePayload(row, userId, cloudMesocycleId) {
  return {
    user_id: userId,
    local_microcycle_id: row.microcycle_id,
    ...getCloudSyncMetadataPayload(row),
    cloud_mesocycle_id: cloudMesocycleId,
    ...buildPayloadFields("Microcycle", row),
  };
}

export function getComparableDaySnapshot(row) {
  return buildSnapshot("Day", row);
}

export function areComparableDaysEqual(left, right) {
  return snapshotsEqual("Day", left, right);
}

export function buildCloudDayPayload(row, userId, cloudMicrocycleId) {
  return {
    user_id: userId,
    local_day_id: resolveDayCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    cloud_microcycle_id: cloudMicrocycleId,
    ...buildPayloadFields("Day", row),
  };
}

export function getComparableWorkoutTypeInstanceSnapshot(row) {
  return buildSnapshot("WorkoutTypeInstance", row);
}

export function areComparableWorkoutTypeInstancesEqual(left, right) {
  return snapshotsEqual("WorkoutTypeInstance", left, right);
}

export function buildCloudWorkoutTypeInstancePayload(row, userId, cloudDayId) {
  return {
    user_id: userId,
    local_workout_type_instance_id: resolveWorkoutTypeInstanceCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    cloud_day_id: cloudDayId,
    ...buildPayloadFields("WorkoutTypeInstance", row),
  };
}

export function getComparableExerciseInstanceSnapshot(row) {
  return buildSnapshot("ExerciseInstance", row);
}

export function areComparableExerciseInstancesEqual(left, right) {
  return snapshotsEqual("ExerciseInstance", left, right);
}

export function buildCloudExerciseInstancePayload(row, userId, cloudWorkoutTypeInstanceId) {
  return {
    user_id: userId,
    local_exercise_instance_id: resolveExerciseInstanceCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
    ...buildPayloadFields("ExerciseInstance", row),
  };
}

export function getComparableSetSnapshot(row) {
  return buildSnapshot("Set", row);
}

export function areComparableSetsEqual(left, right) {
  return snapshotsEqual("Set", left, right);
}

export function buildCloudSetPayload(row, userId, cloudExerciseInstanceId) {
  return {
    user_id: userId,
    local_set_id: resolveSetCloudLocalId(row),
    ...getCloudSyncMetadataPayload(row),
    cloud_exercise_instance_id: cloudExerciseInstanceId,
    ...buildPayloadFields("Set", row),
  };
}



export function getCloudSyncMetadataPayload(entity) {
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


export function normalizeOptionalText(value) {
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

export function normalizeLastUpdatedMs(value, fallbackSyncVersion = null) {
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

export function normalizeLastUpdatedForCloud(entity) {
  const lastUpdatedMs = normalizeLastUpdatedMs(
    entity?.last_updated,
    entity?.sync_version
  );

  if (lastUpdatedMs === null) {
    return new Date().toISOString();
  }

  return new Date(lastUpdatedMs).toISOString();
}

export function resolveMesocycleCloudLocalId(mesocycle) {
  return normalizeOptionalInteger(
    mesocycle?.remote_local_mesocycle_id ??
      mesocycle?.local_mesocycle_id ??
      mesocycle?.mesocycle_id,
    null
  );
}

export function normalizeWeekday(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeDayDate(value) {
  return normalizeLocalDateString(value);
}

export function normalizeDayDateForCloud(value) {
  return normalizeIsoDateString(value);
}

export function resolveDayCloudLocalId(day) {
  return normalizeOptionalInteger(
    day?.remote_local_day_id ?? day?.local_day_id ?? day?.day_id,
    null
  );
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

export function normalizeWorkoutDate(value) {
  return normalizeLocalDateString(value);
}

export function normalizeWorkoutDateForCloud(value) {
  return normalizeIsoDateString(value);
}

export function normalizeCloudTimeString(value) {
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

export function timestampToCloudTimeString(value) {
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




export function resolveExerciseInstanceCloudLocalId(exercise) {
  return normalizeOptionalInteger(
    exercise?.remote_local_exercise_instance_id ??
      exercise?.local_exercise_instance_id ??
      exercise?.exercise_instance_id,
    null
  );
}

export function normalizeExerciseName(value) {
  return normalizeOptionalText(value);
}

export function normalizeExerciseOrder(value) {
  return Math.max(0, normalizeOptionalInteger(value, 0) ?? 0);
}

export function normalizeExerciseVisibleColumns(value) {
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




export function resolveSetCloudLocalId(set) {
  return normalizeOptionalInteger(
    set?.remote_local_set_id ?? set?.local_set_id ?? set?.sets_id,
    null
  );
}



