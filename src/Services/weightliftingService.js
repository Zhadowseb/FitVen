import {
  programRepository,
  weightliftingRepository,
  workoutRepository,
} from "../Repository";
import { supabase } from "../Database/supaBaseClient";
import * as workoutService from "./workoutService";
import { withTransaction } from "./shared";
import { createNextSyncVersion, normalizeSyncId } from "../Utils/syncUtils";
import { enqueueSync, startBackgroundSync } from "./syncScheduler";

let dirtyStrengthHierarchyPushScheduled = false;
let dirtyStrengthHierarchyPushNeedsRerun = false;

function pushDirtyStrengthHierarchyInBackground(db) {
  if (dirtyStrengthHierarchyPushScheduled) {
    dirtyStrengthHierarchyPushNeedsRerun = true;
    return;
  }

  dirtyStrengthHierarchyPushScheduled = true;
  startBackgroundSync(
    async () => {
      try {
        do {
          dirtyStrengthHierarchyPushNeedsRerun = false;
          const programServiceModule = await import("./programService");
          await programServiceModule.pushDirtyStrengthHierarchyWithCloud(db);
        } while (dirtyStrengthHierarchyPushNeedsRerun);
      } finally {
        dirtyStrengthHierarchyPushScheduled = false;
      }
    },
    "Strength hierarchy cloud push failed:"
  );
}

function syncExerciseInstancesInBackground(db) {
  pushDirtyStrengthHierarchyInBackground(db);
}

function syncSetsInBackground(db) {
  pushDirtyStrengthHierarchyInBackground(db);
}

export const DEFAULT_VISIBLE_COLUMNS = {
  note: true,
  rest: true,
  set: true,
  reps: true,
  rpe: true,
  rm_percentage: true,
  weight: true,
  done: true,
};

const EXERCISE_LIBRARY_TABLE = "Exercise";
const EXERCISE_LIBRARY_NAME_COLUMN = "name";
const EXERCISE_LIBRARY_ID_COLUMN = "id";
const EXERCISE_LIBRARY_SELECT =
  `${EXERCISE_LIBRARY_ID_COLUMN}, ${EXERCISE_LIBRARY_NAME_COLUMN}, nickname, default_visible_columns`;
const EXERCISE_COLUMN_PREFERENCE_CLOUD_TABLE =
  "exercise_column_preferences";
const EXERCISE_COLUMN_PREFERENCE_CLOUD_SELECT =
  "user_id, exercise_id, visible_columns, updated_at";
const LOCAL_EXERCISE_COLUMN_PREFERENCE_USER_ID = "__local__";
const MUSCLE_ACTIVATION_TABLE = "Muscle_Activation";
const MUSCLE_GROUP_TABLE = "muscle_group";
const MUSCLE_GROUP_ASSIGNMENT_TABLE = "muscle_group_assignment";
const BODY_MAP_REGION_TABLE = "body_map_region";
const MUSCLE_BODY_MAP_REGION_TABLE = "muscle_body_map_region";
const FRONT_BODY_MAP_VIEW = "front";
const BACK_BODY_MAP_VIEW = "back";
const PRIMARY_ACTIVATION_LEVEL = "primary";
const SECONDARY_ACTIVATION_LEVEL = "secondary";
const EXERCISE_INSTANCE_CLOUD_TABLE = "exercise_instance";
const EXERCISE_INSTANCE_CLOUD_SELECT =
  "id, local_exercise_instance_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_workout_type_instance_id, exercise_name, exercise_order, sets, visible_columns, note, done";
const SET_CLOUD_TABLE = "set";
const SET_CLOUD_SELECT =
  "id, local_set_id, sync_id, sync_version, deleted_at, last_updated, is_deleting, delete_requested_at, local_watchers, cloud_exercise_instance_id, set_number, personal_record, pause, rpe, weight, rm_percentage, reps, done, failed, amrap, note";

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? value.trim().replace(",", ".").replace(/[^0-9.-]/g, "")
      : value;

  if (normalizedValue === "") {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatWeightDisplay(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatSignedWeightDisplay(value) {
  const parsedValue = Number(value) || 0;
  const sign = parsedValue >= 0 ? "+" : "-";

  return `${sign}${formatWeightDisplay(Math.abs(parsedValue))} kg`;
}

function normalizeOptionalInteger(value, fallbackValue = null) {
  if (value === "" || value === null || value === undefined) {
    return fallbackValue;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : fallbackValue;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes"].includes(value.trim().toLowerCase());
  }

  return false;
}

function resolveSideBySideCloudId(entity, legacyCloudIdColumn) {
  return normalizeOptionalInteger(
    entity?.cloud_id ?? entity?.[legacyCloudIdColumn],
    null
  );
}

function isCloudSnapshotDeleting(entity) {
  return (
    normalizeBooleanFlag(entity?.is_deleting) ||
    normalizeOptionalText(entity?.deleted_at) !== null
  );
}

const PERSONAL_RECORD_REPS = Array.from({ length: 10 }, (_, index) => index + 1);
const PERSONAL_RECORD_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatPersonalRecordNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1);
}

function calculatePersonalRecordOneRepMax(weight, reps) {
  const denominator = 1.0278 - 0.0278 * reps;

  if (denominator <= 0) {
    return null;
  }

  return weight / denominator;
}

function parsePersonalRecordSortDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}

function comparePersonalRecordDate(left, right) {
  const leftDate = left?.performed_date_sort ?? "";
  const rightDate = right?.performed_date_sort ?? "";

  if (leftDate === rightDate) {
    return Number(left?.sets_id ?? 0) - Number(right?.sets_id ?? 0);
  }

  return leftDate.localeCompare(rightDate);
}

function formatPersonalRecordDate(value) {
  if (typeof value !== "string") {
    return "--";
  }

  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return value;
  }

  const [, day, month, year] = match;
  const monthLabel = PERSONAL_RECORD_MONTHS[Number(month) - 1] ?? month;

  return `${day} ${monthLabel} '${year.slice(-2)}`;
}

function formatPersonalRecordRelativeDate(sortDateValue) {
  const date = parsePersonalRecordSortDate(sortDateValue);

  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Math.max(
    0,
    Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (days === 0) {
    return "today";
  }

  if (days < 30) {
    return `${days}d ago`;
  }

  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return `${months}mo ago`;
  }

  const years = Math.max(1, Math.floor(days / 365));
  return `${years}y ago`;
}

function normalizePersonalRecordSet(row) {
  const weight = normalizeOptionalNumber(row?.weight);
  const reps = normalizeOptionalInteger(row?.reps);

  return {
    sets_id: row?.sets_id,
    exercise_name: row?.exercise_name,
    weight,
    reps,
    personal_record: normalizeBooleanFlag(row?.personal_record),
    performed_date: row?.performed_date ?? null,
    performed_date_sort: row?.performed_date_sort ?? null,
    workout_id: row?.workout_id ?? null,
    workout_label: row?.workout_label ?? null,
    program_name: row?.program_name ?? null,
  };
}

function isBetterPersonalRecordSet(candidate, currentBest) {
  if (!currentBest) {
    return true;
  }

  if (candidate.weight > currentBest.weight) {
    return true;
  }

  if (candidate.weight < currentBest.weight) {
    return false;
  }

  return comparePersonalRecordDate(candidate, currentBest) < 0;
}

function getPersonalRecordPreviousBestWeight(sets, record) {
  let previousBest = null;

  for (const set of sets) {
    if (
      set.sets_id === record.sets_id ||
      set.reps !== record.reps ||
      comparePersonalRecordDate(set, record) >= 0
    ) {
      continue;
    }

    if (previousBest === null || set.weight > previousBest) {
      previousBest = set.weight;
    }
  }

  return previousBest;
}

function getIsRecentPersonalRecord(record) {
  const date = parsePersonalRecordSortDate(record?.performed_date_sort);

  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  return days >= 0 && days <= 14;
}

function isBetterPersonalRecordTrendSet(candidate, currentBest) {
  if (!currentBest) {
    return true;
  }

  if (candidate.estimatedOneRepMax !== currentBest.estimatedOneRepMax) {
    return candidate.estimatedOneRepMax > currentBest.estimatedOneRepMax;
  }

  if (candidate.weight !== currentBest.weight) {
    return candidate.weight > currentBest.weight;
  }

  return comparePersonalRecordDate(candidate, currentBest) > 0;
}

function buildPersonalRecordOneRepMaxTrend(sets) {
  const bestSetByWorkout = new Map();

  for (const set of sets) {
    const estimatedOneRepMax = calculatePersonalRecordOneRepMax(
      set.weight,
      set.reps
    );

    if (estimatedOneRepMax === null) {
      continue;
    }

    const workoutKey = set.workout_id ?? `set-${set.sets_id}`;
    const candidate = {
      ...set,
      workoutKey,
      estimatedOneRepMax,
    };
    const currentBest = bestSetByWorkout.get(workoutKey);

    if (isBetterPersonalRecordTrendSet(candidate, currentBest)) {
      bestSetByWorkout.set(workoutKey, candidate);
    }
  }

  const points = [...bestSetByWorkout.values()].sort((left, right) => {
    const dateComparison = comparePersonalRecordDate(left, right);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return String(left.workoutKey).localeCompare(String(right.workoutKey));
  });

  let bestPoint = null;
  let minEstimatedOneRepMax = null;
  let maxEstimatedOneRepMax = null;

  const formattedPoints = points.map((point, index) => {
    const roundedOneRepMax = Math.round(point.estimatedOneRepMax * 2) / 2;

    if (
      bestPoint === null ||
      point.estimatedOneRepMax > bestPoint.estimatedOneRepMax
    ) {
      bestPoint = point;
    }

    if (
      minEstimatedOneRepMax === null ||
      point.estimatedOneRepMax < minEstimatedOneRepMax
    ) {
      minEstimatedOneRepMax = point.estimatedOneRepMax;
    }

    if (
      maxEstimatedOneRepMax === null ||
      point.estimatedOneRepMax > maxEstimatedOneRepMax
    ) {
      maxEstimatedOneRepMax = point.estimatedOneRepMax;
    }

    return {
      id: `${point.workoutKey}-${point.sets_id}`,
      workoutIndex: index + 1,
      workoutId: point.workout_id,
      setId: point.sets_id,
      workoutLabel: point.workout_label,
      programName: point.program_name,
      weight: point.weight,
      reps: point.reps,
      setDisplay: `${point.reps} x ${formatPersonalRecordNumber(point.weight)} kg`,
      estimatedOneRepMax: point.estimatedOneRepMax,
      estimatedOneRepMaxDisplay: `${formatPersonalRecordNumber(
        roundedOneRepMax
      )} kg`,
      performedDate: point.performed_date,
      performedDateSort: point.performed_date_sort,
      dateDisplay: formatPersonalRecordDate(point.performed_date),
      relativeDateLabel: formatPersonalRecordRelativeDate(
        point.performed_date_sort
      ),
    };
  });

  const bestFormattedPoint = bestPoint
    ? formattedPoints.find(
        (point) => point.setId === bestPoint.sets_id
      ) ?? null
    : null;
  const latestPoint =
    formattedPoints.length > 0
      ? formattedPoints[formattedPoints.length - 1]
      : null;

  return {
    points: formattedPoints,
    pointCount: formattedPoints.length,
    bestPoint: bestFormattedPoint,
    latestPoint,
    minEstimatedOneRepMax,
    maxEstimatedOneRepMax,
  };
}

function buildPersonalRecordExerciseDetail(
  exerciseName,
  rows,
  { includeTrend = true } = {}
) {
  const sets = rows
    .map(normalizePersonalRecordSet)
    .filter(
      (set) =>
        set.exercise_name &&
        Number.isFinite(set.weight) &&
        Number.isFinite(set.reps) &&
        set.reps > 0
    );

  const setsForRecords = sets.filter(
    (set) => set.reps >= 1 && set.reps <= PERSONAL_RECORD_REPS.length
  );
  const recordsByRep = {};
  let bestEstimatedOneRepMax = null;
  let heaviestWeight = null;
  let latestSet = null;

  for (const set of sets) {
    if (heaviestWeight === null || set.weight > heaviestWeight) {
      heaviestWeight = set.weight;
    }

    if (!latestSet || comparePersonalRecordDate(set, latestSet) > 0) {
      latestSet = set;
    }

    const estimatedOneRepMax =
      set.reps <= PERSONAL_RECORD_REPS.length
        ? calculatePersonalRecordOneRepMax(set.weight, set.reps)
        : null;

    if (
      estimatedOneRepMax !== null &&
      (bestEstimatedOneRepMax === null ||
        estimatedOneRepMax > bestEstimatedOneRepMax)
    ) {
      bestEstimatedOneRepMax = estimatedOneRepMax;
    }
  }

  for (const set of setsForRecords) {
    const currentBest = recordsByRep[set.reps];

    if (isBetterPersonalRecordSet(set, currentBest)) {
      recordsByRep[set.reps] = set;
    }
  }

  const maxRecordWeight = Math.max(
    ...Object.values(recordsByRep).map((record) => Number(record.weight) || 0),
    0
  );
  const latestRecord = Object.values(recordsByRep).reduce(
    (latest, record) =>
      !latest || comparePersonalRecordDate(record, latest) > 0
        ? record
        : latest,
    null
  );
  const rowsByRep = PERSONAL_RECORD_REPS.map((reps) => {
    const record = recordsByRep[reps] ?? null;

    if (!record) {
      return {
        reps,
        hasRecord: false,
        weight: null,
        weightDisplay: "--",
        progressPercent: 0,
        performedDate: null,
        dateDisplay: "--",
        relativeDateLabel: null,
        isNew: false,
        gainDisplay: null,
      };
    }

    const previousBestWeight = getPersonalRecordPreviousBestWeight(
      setsForRecords,
      record
    );
    const gain =
      previousBestWeight !== null ? record.weight - previousBestWeight : null;

    return {
      reps,
      hasRecord: true,
      setId: record.sets_id,
      weight: record.weight,
      weightDisplay: formatPersonalRecordNumber(record.weight),
      progressPercent:
        maxRecordWeight > 0
          ? Math.max(8, Math.round((record.weight / maxRecordWeight) * 100))
          : 0,
      performedDate: record.performed_date,
      dateDisplay: formatPersonalRecordDate(record.performed_date),
      relativeDateLabel: formatPersonalRecordRelativeDate(
        record.performed_date_sort
      ),
      isNew: record.personal_record || getIsRecentPersonalRecord(record),
      gainDisplay:
        gain !== null && gain > 0
          ? `+${formatPersonalRecordNumber(gain)}`
          : null,
    };
  });
  const completedRecordCount = rowsByRep.filter((row) => row.hasRecord).length;
  const roundedOneRepMax =
    bestEstimatedOneRepMax === null
      ? null
      : Math.round(bestEstimatedOneRepMax * 2) / 2;

  return {
    exerciseName,
    rows: rowsByRep,
    setCount: sets.length,
    completedRecordCount,
    recordSlotCount: PERSONAL_RECORD_REPS.length,
    e1rm: roundedOneRepMax,
    e1rmDisplay:
      roundedOneRepMax === null
        ? "--"
        : `${formatPersonalRecordNumber(roundedOneRepMax)} kg`,
    heaviestWeight,
    heaviestWeightDisplay:
      heaviestWeight === null
        ? "--"
        : `${formatPersonalRecordNumber(heaviestWeight)} kg`,
    latestDateDisplay: latestSet
      ? formatPersonalRecordDate(latestSet.performed_date)
      : "--",
    latestRelativeDateLabel: latestSet
      ? formatPersonalRecordRelativeDate(latestSet.performed_date_sort)
      : null,
    latestRecordDateDisplay: latestRecord
      ? formatPersonalRecordDate(latestRecord.performed_date)
      : "--",
    latestRecordRelativeDateLabel: latestRecord
      ? formatPersonalRecordRelativeDate(latestRecord.performed_date_sort)
      : null,
    oneRepMaxTrend: includeTrend
      ? buildPersonalRecordOneRepMaxTrend(sets)
      : null,
  };
}

function getPersonalRecordSetIds(rows) {
  const sets = rows
    .map(normalizePersonalRecordSet)
    .filter(
      (set) =>
        set.exercise_name &&
        Number.isFinite(set.weight) &&
        Number.isFinite(set.reps) &&
        set.reps >= 1 &&
        set.reps <= PERSONAL_RECORD_REPS.length
    );
  const setsByRep = new Map();

  for (const set of sets) {
    const groupKey = `${set.exercise_name.trim().toLowerCase()}::${set.reps}`;
    const groupSets = setsByRep.get(groupKey) ?? [];

    groupSets.push(set);
    setsByRep.set(groupKey, groupSets);
  }

  const recordSetIds = new Set();

  for (const groupSets of setsByRep.values()) {
    const sortedSets = [...groupSets].sort(comparePersonalRecordDate);
    let bestWeight = null;

    for (const set of sortedSets) {
      if (bestWeight === null || set.weight > bestWeight) {
        const setId = Number(set.sets_id);

        if (Number.isFinite(setId)) {
          recordSetIds.add(setId);
        }

        bestWeight = set.weight;
      }
    }
  }

  return recordSetIds;
}

async function refreshPersonalRecordsForExerciseName(db, exerciseName) {
  const normalizedExerciseName =
    typeof exerciseName === "string" ? exerciseName.trim() : "";

  if (!normalizedExerciseName) {
    return [];
  }

  const rows =
    await weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db, {
      exerciseName: normalizedExerciseName,
    });
  const recordSetIds = getPersonalRecordSetIds(rows);
  const existingFlags =
    await weightliftingRepository.getPersonalRecordFlagsByExerciseName(
      db,
      normalizedExerciseName
    );

  for (const row of existingFlags) {
    const setId = Number(row?.sets_id);

    if (!Number.isFinite(setId)) {
      continue;
    }

    const nextPersonalRecord = recordSetIds.has(setId) ? 1 : 0;

    if (Number(row?.personal_record) === nextPersonalRecord) {
      continue;
    }

    await weightliftingRepository.updateSetPersonalRecord(db, {
      setId,
      personalRecord: nextPersonalRecord,
    });
  }

  return [...recordSetIds];
}

async function refreshPersonalRecordsForSet(db, setId) {
  const exercise = await weightliftingRepository.getExerciseNameBySetId(
    db,
    setId
  );

  return refreshPersonalRecordsForExerciseName(db, exercise?.exercise_name);
}

function formatExerciseHistoryRelativeDate(sortDateValue) {
  const date = parsePersonalRecordSortDate(sortDateValue);

  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Math.max(
    0,
    Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (days === 0) {
    return "today";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  if (days < 30) {
    return `${Math.max(1, Math.floor(days / 7))}w ago`;
  }

  if (days < 365) {
    return `${Math.max(1, Math.floor(days / 30))}mo ago`;
  }

  return `${Math.max(1, Math.floor(days / 365))}y ago`;
}

function formatExerciseHistoryDate(sortDateValue) {
  const date = parsePersonalRecordSortDate(sortDateValue);

  if (!date) {
    return "--";
  }

  const monthLabel = PERSONAL_RECORD_MONTHS[date.getMonth()] ?? "";
  return `${monthLabel.toUpperCase()} ${date.getDate()}`;
}

function formatExerciseHistoryNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1);
}

function formatExerciseHistoryWeight(value) {
  return `${formatExerciseHistoryNumber(value)} kg`;
}

function buildExerciseHistory(rows) {
  const sessionsById = new Map();

  for (const row of rows ?? []) {
    const sessionId = row?.exercise_instance_id;

    if (sessionId === null || sessionId === undefined) {
      continue;
    }

    if (!sessionsById.has(sessionId)) {
      sessionsById.set(sessionId, {
        id: sessionId,
        workoutId: row?.workout_id ?? null,
        performedDate: row?.performed_date ?? null,
        performedDateSort: row?.performed_date_sort ?? null,
        relativeDateLabel: formatExerciseHistoryRelativeDate(
          row?.performed_date_sort
        ),
        dateDisplay: formatExerciseHistoryDate(row?.performed_date_sort),
        topWeight: normalizeOptionalNumber(row?.top_weight),
        setCount: 0,
        sets: [],
      });
    }

    const session = sessionsById.get(sessionId);
    const reps = normalizeOptionalInteger(row?.reps);
    const weight = normalizeOptionalNumber(row?.weight);

    if (!Number.isFinite(reps) || !Number.isFinite(weight)) {
      continue;
    }

    const isAmrap = normalizeBooleanFlag(row?.amrap);
    const signature = [reps, weight, isAmrap ? "amrap" : "standard"].join(":");
    const existingSet = session.sets.find((set) => set.signature === signature);
    session.setCount += 1;

    if (existingSet) {
      existingSet.count += 1;
      existingSet.personalRecord =
        existingSet.personalRecord || normalizeBooleanFlag(row?.personal_record);
      continue;
    }

    session.sets.push({
      id: row?.sets_id,
      signature,
      setNumber: normalizeOptionalInteger(row?.set_number),
      reps,
      weight,
      weightDisplay: formatExerciseHistoryWeight(weight),
      isAmrap,
      personalRecord: normalizeBooleanFlag(row?.personal_record),
      count: 1,
      display: `${reps} x ${formatExerciseHistoryWeight(weight)}`,
    });
  }

  const sessions = [...sessionsById.values()];
  const latestSession = sessions[0] ?? null;
  const latestSetCount = latestSession?.setCount ?? 0;
  const latestSetCountLabel =
    latestSetCount === 1 ? "1 set" : `${latestSetCount} sets`;
  const latestTopWeightDisplay =
    latestSession?.topWeight === null || latestSession?.topWeight === undefined
      ? "--"
      : formatExerciseHistoryWeight(latestSession.topWeight);

  return {
    sessions,
    hasHistory: sessions.length > 0,
    sessionCount: sessions.length,
    latestSession,
    summaryText: latestSession
      ? `${latestSetCountLabel} - top ${latestTopWeightDisplay}`
      : "No previous sets",
    latestRelativeDateLabel: latestSession?.relativeDateLabel ?? null,
  };
}

function normalizeExerciseOrder(value, fallbackValue = 0) {
  const numericValue = normalizeOptionalInteger(value, fallbackValue);
  return Math.max(0, numericValue ?? fallbackValue);
}

function normalizeRequiredId(value, label) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} is required.`);
  }

  return Math.trunc(numericValue);
}

function parseVisibleColumns(value) {
  if (value === null || value === undefined || value === "") {
    return { ...DEFAULT_VISIBLE_COLUMNS };
  }

  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return { ...DEFAULT_VISIBLE_COLUMNS };
    }
  }

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return { ...DEFAULT_VISIBLE_COLUMNS };
  }

  const normalizedColumns = { ...DEFAULT_VISIBLE_COLUMNS };

  for (const key of Object.keys(DEFAULT_VISIBLE_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(parsedValue, key)) {
      normalizedColumns[key] = Boolean(parsedValue[key]);
    }
  }

  return normalizedColumns;
}

function parseOptionalVisibleColumns(value) {
  const serializedValue = serializeVisibleColumns(value);

  return serializedValue ? parseVisibleColumns(serializedValue) : null;
}

function resolveVisibleColumns(...columnCandidates) {
  for (const columnCandidate of columnCandidates) {
    const parsedColumns = parseOptionalVisibleColumns(columnCandidate);

    if (parsedColumns) {
      return parsedColumns;
    }
  }

  return { ...DEFAULT_VISIBLE_COLUMNS };
}

function areVisibleColumnsEqual(leftColumns, rightColumns) {
  return Object.keys(DEFAULT_VISIBLE_COLUMNS).every(
    (key) => Boolean(leftColumns?.[key]) === Boolean(rightColumns?.[key])
  );
}

function isAppDefaultVisibleColumns(value) {
  const parsedColumns = parseOptionalVisibleColumns(value);

  return parsedColumns
    ? areVisibleColumnsEqual(parsedColumns, DEFAULT_VISIBLE_COLUMNS)
    : false;
}

function serializeVisibleColumns(value) {
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

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return null;
  }

  const normalizedColumns = {};

  for (const key of Object.keys(DEFAULT_VISIBLE_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(parsedValue, key)) {
      normalizedColumns[key] = Boolean(parsedValue[key]);
    }
  }

  return Object.keys(normalizedColumns).length > 0
    ? JSON.stringify(normalizedColumns)
    : null;
}

function normalizeExerciseCatalogEntries(entries) {
  const exerciseMap = new Map();

  for (const entry of entries) {
    const rawName = entry?.name ?? entry?.exercise_name;
    const normalizedName =
      typeof rawName === "string" ? rawName.trim() : "";
    const normalizedNickname =
      typeof entry?.nickname === "string" && entry.nickname.trim() !== ""
        ? entry.nickname.trim()
        : null;
    const cloudExerciseId = normalizeOptionalInteger(
      entry?.cloud_exercise_id ?? entry?.id,
      null
    );
    const defaultVisibleColumns = serializeVisibleColumns(
      entry?.default_visible_columns
    );

    if (!normalizedName) {
      continue;
    }

    exerciseMap.set(normalizedName.toLocaleLowerCase(), {
      cloud_exercise_id: cloudExerciseId,
      name: normalizedName,
      nickname: normalizedNickname,
      default_visible_columns: defaultVisibleColumns,
    });
  }

  return [...exerciseMap.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    })
  );
}

function areExerciseCatalogEntriesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index].cloud_exercise_id !== right[index].cloud_exercise_id ||
      left[index].name !== right[index].name ||
      left[index].nickname !== right[index].nickname ||
      left[index].default_visible_columns !==
        right[index].default_visible_columns
    ) {
      return false;
    }
  }

  return true;
}

function normalizeActivationLevel(activationLevel) {
  return typeof activationLevel === "string"
    ? activationLevel.trim().toLocaleLowerCase()
    : "";
}

function buildExerciseMuscleRoleCounts(activationRows) {
  const exerciseBuckets = new Map();

  for (const activation of activationRows ?? []) {
    const exerciseId = activation?.exercise_id;
    const muscleId = activation?.muscle_id;

    if (!exerciseId || !muscleId) {
      continue;
    }

    const activationLevel = normalizeActivationLevel(activation.activation_level);
    const bucket = exerciseBuckets.get(exerciseId) ?? {
      primary: new Set(),
      secondary: new Set(),
    };

    if (activationLevel === PRIMARY_ACTIVATION_LEVEL) {
      bucket.primary.add(muscleId);
    }

    if (activationLevel === SECONDARY_ACTIVATION_LEVEL) {
      bucket.secondary.add(muscleId);
    }

    exerciseBuckets.set(exerciseId, bucket);
  }

  const countMap = new Map();

  for (const [exerciseId, bucket] of exerciseBuckets.entries()) {
    countMap.set(exerciseId, {
      primary_muscle_count: bucket.primary.size,
      secondary_muscle_count: bucket.secondary.size,
    });
  }

  return countMap;
}

function normalizeMuscleGroupKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "";
}

function buildExerciseGroupMetadata({
  groupRows,
  groupAssignmentRows,
  activationRows,
}) {
  const groupsById = new Map();
  const musclesToGroups = new Map();
  const exerciseBuckets = new Map();

  for (const group of groupRows ?? []) {
    const groupKey = normalizeMuscleGroupKey(group?.group_key);
    const groupName =
      typeof group?.name === "string" && group.name.trim() !== ""
        ? group.name.trim()
        : groupKey;

    if (!group?.id || !groupKey || !groupName) {
      continue;
    }

    groupsById.set(group.id, {
      id: group.id,
      key: groupKey,
      name: groupName,
      displayOrder: Number(group.display_order) || 0,
    });
  }

  for (const row of groupAssignmentRows ?? []) {
    const group = groupsById.get(row?.muscle_group_id);

    if (!group || !row?.muscle_id) {
      continue;
    }

    const existingGroups = musclesToGroups.get(row.muscle_id) ?? [];
    existingGroups.push(group);
    musclesToGroups.set(row.muscle_id, existingGroups);
  }

  for (const activation of activationRows ?? []) {
    const exerciseId = activation?.exercise_id;
    const muscleGroups = musclesToGroups.get(activation?.muscle_id) ?? [];

    if (!exerciseId || muscleGroups.length === 0) {
      continue;
    }

    const exerciseBucket = exerciseBuckets.get(exerciseId) ?? new Map();

    for (const group of muscleGroups) {
      const groupBucket = exerciseBucket.get(group.key) ?? {
        ...group,
        score: 0,
      };

      groupBucket.score += 1;
      exerciseBucket.set(group.key, groupBucket);
    }

    exerciseBuckets.set(exerciseId, exerciseBucket);
  }

  const exerciseGroupMap = new Map();

  for (const [exerciseId, bucket] of exerciseBuckets.entries()) {
    const groups = [...bucket.values()].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }

      return left.name.localeCompare(right.name);
    });

    exerciseGroupMap.set(exerciseId, {
      primary_group_key: groups[0]?.key ?? null,
      primary_group_name: groups[0]?.name ?? null,
      group_keys: groups.map((group) => group.key),
      group_names: groups.map((group) => group.name),
    });
  }

  return {
    exerciseGroupMap,
  };
}

async function getExerciseGroupMetadata({ exerciseIds, activationRows }) {
  if (exerciseIds.length === 0) {
    return { exerciseGroupMap: new Map() };
  }

  try {
    const { data: groupRows, error: groupError } = await supabase
      .from(MUSCLE_GROUP_TABLE)
      .select("id, group_key, name, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (groupError) {
      throw groupError;
    }

    const groupIds = (groupRows ?? [])
      .map((group) => group?.id)
      .filter((id) => id !== null && id !== undefined);

    if (groupIds.length === 0) {
      return { exerciseGroupMap: new Map() };
    }

    const { data: groupAssignmentRows, error: groupAssignmentError } =
      await supabase
        .from(MUSCLE_GROUP_ASSIGNMENT_TABLE)
        .select("muscle_group_id, muscle_id")
        .in("muscle_group_id", groupIds);

    if (groupAssignmentError) {
      throw groupAssignmentError;
    }

    return buildExerciseGroupMetadata({
      groupRows,
      groupAssignmentRows,
      activationRows,
    });
  } catch (_error) {
    return { exerciseGroupMap: new Map() };
  }
}

function normalizeBodyMapRegionKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_")
    : "";
}

function normalizeBodyMapView(value) {
  const normalizedView =
    typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  const isSupportedView =
    normalizedView === FRONT_BODY_MAP_VIEW ||
    normalizedView === BACK_BODY_MAP_VIEW;

  return isSupportedView ? normalizedView : "";
}

function sortBodyMapRegions(left, right) {
  if (left.bodyView !== right.bodyView) {
    return left.bodyView === FRONT_BODY_MAP_VIEW ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function countBodyMapViews(regions) {
  return (regions ?? []).reduce(
    (counts, region) => {
      if (region?.bodyView === FRONT_BODY_MAP_VIEW) {
        counts.front += 1;
      }

      if (region?.bodyView === BACK_BODY_MAP_VIEW) {
        counts.back += 1;
      }

      return counts;
    },
    { front: 0, back: 0 }
  );
}

function chooseBodyMapView({ primaryRegions, secondaryRegions }) {
  const primaryCounts = countBodyMapViews(primaryRegions);

  if (primaryCounts.back > primaryCounts.front) {
    return BACK_BODY_MAP_VIEW;
  }

  if (primaryCounts.front > primaryCounts.back) {
    return FRONT_BODY_MAP_VIEW;
  }

  const secondaryCounts = countBodyMapViews(secondaryRegions);
  const totalBack = primaryCounts.back + secondaryCounts.back;
  const totalFront = primaryCounts.front + secondaryCounts.front;

  return totalBack > totalFront ? BACK_BODY_MAP_VIEW : FRONT_BODY_MAP_VIEW;
}

function buildExerciseBodyMapRegionMetadata({
  regionRows,
  regionAssignmentRows,
  activationRows,
}) {
  const regionsById = new Map();
  const musclesToRegions = new Map();
  const exerciseBuckets = new Map();

  for (const region of regionRows ?? []) {
    const regionKey = normalizeBodyMapRegionKey(region?.region_key);
    const bodyView = normalizeBodyMapView(region?.body_view);
    const name =
      typeof region?.name === "string" && region.name.trim() !== ""
        ? region.name.trim()
        : regionKey;

    if (!region?.id || !regionKey || !bodyView || !name) {
      continue;
    }

    regionsById.set(region.id, {
      id: region.id,
      key: regionKey,
      bodyView,
      name,
    });
  }

  for (const row of regionAssignmentRows ?? []) {
    const region = regionsById.get(row?.body_map_region_id);

    if (!region || !row?.muscle_id) {
      continue;
    }

    const existingRegions = musclesToRegions.get(row.muscle_id) ?? [];
    existingRegions.push(region);
    musclesToRegions.set(row.muscle_id, existingRegions);
  }

  for (const activation of activationRows ?? []) {
    const exerciseId = activation?.exercise_id;
    const muscleRegions = musclesToRegions.get(activation?.muscle_id) ?? [];

    if (!exerciseId || muscleRegions.length === 0) {
      continue;
    }

    const activationLevel = normalizeActivationLevel(
      activation.activation_level
    );
    const bucket = exerciseBuckets.get(exerciseId) ?? {
      primary: new Map(),
      secondary: new Map(),
    };

    for (const region of muscleRegions) {
      const mapKey = `${region.bodyView}:${region.key}`;

      if (activationLevel === PRIMARY_ACTIVATION_LEVEL) {
        bucket.primary.set(mapKey, region);
      }

      if (activationLevel === SECONDARY_ACTIVATION_LEVEL) {
        bucket.secondary.set(mapKey, region);
      }
    }

    exerciseBuckets.set(exerciseId, bucket);
  }

  const exerciseBodyMapRegionMap = new Map();

  for (const [exerciseId, bucket] of exerciseBuckets.entries()) {
    const primaryRegionKeySet = new Set(bucket.primary.keys());
    const primaryRegions = [...bucket.primary.values()].sort(
      sortBodyMapRegions
    );
    const secondaryRegions = [...bucket.secondary.entries()]
      .filter(([regionKey]) => !primaryRegionKeySet.has(regionKey))
      .map(([, region]) => region)
      .sort(sortBodyMapRegions);
    const bodyMapView = chooseBodyMapView({
      primaryRegions,
      secondaryRegions,
    });
    const selectedPrimaryRegions = primaryRegions.filter(
      (region) => region.bodyView === bodyMapView
    );
    const selectedSecondaryRegions = secondaryRegions.filter(
      (region) => region.bodyView === bodyMapView
    );

    exerciseBodyMapRegionMap.set(exerciseId, {
      body_map_view: bodyMapView,
      primary_body_map_region_keys: selectedPrimaryRegions.map(
        (region) => region.key
      ),
      secondary_body_map_region_keys: selectedSecondaryRegions.map(
        (region) => region.key
      ),
      primary_body_map_regions: primaryRegions,
      secondary_body_map_regions: secondaryRegions,
    });
  }

  return {
    exerciseBodyMapRegionMap,
  };
}

async function getExerciseBodyMapRegionMetadata({
  exerciseIds,
  activationRows,
}) {
  if (exerciseIds.length === 0) {
    return { exerciseBodyMapRegionMap: new Map() };
  }

  try {
    const { data: regionRows, error: regionError } = await supabase
      .from(BODY_MAP_REGION_TABLE)
      .select("id, region_key, body_view, name")
      .order("body_view", { ascending: true })
      .order("name", { ascending: true });

    if (regionError) {
      throw regionError;
    }

    const regionIds = (regionRows ?? [])
      .map((region) => region?.id)
      .filter((id) => id !== null && id !== undefined);
    const muscleIds = [
      ...new Set(
        (activationRows ?? [])
          .map((activation) => activation?.muscle_id)
          .filter((id) => id !== null && id !== undefined)
      ),
    ];

    if (regionIds.length === 0 || muscleIds.length === 0) {
      return { exerciseBodyMapRegionMap: new Map() };
    }

    const { data: regionAssignmentRows, error: regionAssignmentError } =
      await supabase
        .from(MUSCLE_BODY_MAP_REGION_TABLE)
        .select("muscle_id, body_map_region_id")
        .in("body_map_region_id", regionIds)
        .in("muscle_id", muscleIds);

    if (regionAssignmentError) {
      throw regionAssignmentError;
    }

    return buildExerciseBodyMapRegionMetadata({
      regionRows,
      regionAssignmentRows,
      activationRows,
    });
  } catch (_error) {
    return { exerciseBodyMapRegionMap: new Map() };
  }
}

async function getDefaultMesocycleProgressionWeight(
  db,
  { programId, mesocycleNumber, exerciseName }
) {
  const parsedMesocycleNumber = Number(mesocycleNumber);

  if (!Number.isFinite(parsedMesocycleNumber) || parsedMesocycleNumber <= 1) {
    return 0;
  }

  const previousProgression =
    await weightliftingRepository.getLatestRmProgressionWeightBeforeMesocycle(
      db,
      {
        programId,
        exerciseName,
        mesocycleNumber: parsedMesocycleNumber,
      }
    );

  if (previousProgression?.progression_weight !== undefined) {
    return Number(previousProgression.progression_weight || 0) + 2.5;
  }

  return (parsedMesocycleNumber - 1) * 2.5;
}

async function getEstimatedWeightForSet(db, setId) {
  const estimatedSet = await weightliftingRepository.getEstimatedWeightBySetId(
    db,
    setId
  );
  const baseEstimatedWeight = normalizeOptionalNumber(
    estimatedSet?.estimated_weight
  );
  const progressionWeight =
    normalizeOptionalNumber(estimatedSet?.progression_weight) ?? 0;
  const adjustedEstimatedWeight = normalizeOptionalNumber(
    estimatedSet?.adjusted_estimated_weight
  );
  const estimatedWeight =
    adjustedEstimatedWeight ??
    (baseEstimatedWeight === null
      ? null
      : baseEstimatedWeight + progressionWeight);

  if (!Number.isFinite(estimatedWeight) || estimatedWeight <= 0) {
    return null;
  }

  return estimatedWeight;
}

async function ensureMesocycleProgressions(
  db,
  { mesocycleId, programId, mesocycleNumber }
) {
  const estimatedSets = await weightliftingRepository.getEstimatedSets(db, programId);
  const existingProgressions =
    await weightliftingRepository.getMesocycleRmProgressions(db, mesocycleId);
  const existingExerciseNames = new Set(
    existingProgressions.map((progression) => progression.exercise_name)
  );

  for (const estimatedSet of estimatedSets) {
    if (existingExerciseNames.has(estimatedSet.exercise_name)) {
      continue;
    }

    const defaultProgressionWeight =
      await getDefaultMesocycleProgressionWeight(db, {
        programId,
        mesocycleNumber,
        exerciseName: estimatedSet.exercise_name,
      });

    await weightliftingRepository.insertRmWeightProgression(db, {
      mesocycleId,
      exerciseName: estimatedSet.exercise_name,
      progressionWeight: defaultProgressionWeight,
    });
  }
}

async function ensureProgramMesocycleProgressions(db, programId) {
  const mesocycles = await programRepository.getMesocyclesByProgram(db, programId);

  for (const mesocycle of mesocycles) {
    await ensureMesocycleProgressions(db, {
      mesocycleId: mesocycle.mesocycle_id,
      programId,
      mesocycleNumber: mesocycle.mesocycle_number,
    });
  }

  return mesocycles;
}

function buildProgressionGroups(rows, selectedExerciseNames) {
  const rowsByExercise = new Map();

  for (const row of rows) {
    if (!selectedExerciseNames.has(row.exercise_name)) {
      continue;
    }

    const existingRows = rowsByExercise.get(row.exercise_name) ?? [];
    existingRows.push(row);
    rowsByExercise.set(row.exercise_name, existingRows);
  }

  const groupedProgressions = {};

  for (const [exerciseName, exerciseRows] of rowsByExercise.entries()) {
    const sortedRows = [...exerciseRows].sort(
      (left, right) => left.mesocycle_number - right.mesocycle_number
    );
    let previousProgressionWeight = 0;

    for (const row of sortedRows) {
      const estimatedWeight = Number(row.estimated_weight);

      if (!Number.isFinite(estimatedWeight)) {
        continue;
      }

      const progressionWeight = Number(row.progression_weight) || 0;
      const blockDelta = progressionWeight - previousProgressionWeight;
      const previousWeight = estimatedWeight + previousProgressionWeight;
      const currentWeight = estimatedWeight + progressionWeight;

      if (!groupedProgressions[row.mesocycle_id]) {
        groupedProgressions[row.mesocycle_id] = [];
      }

      groupedProgressions[row.mesocycle_id].push({
        exercise_name: exerciseName,
        estimated_weight: estimatedWeight,
        estimated_weight_display: `${formatWeightDisplay(estimatedWeight)} kg`,
        progression_weight: progressionWeight,
        previous_progression_weight: previousProgressionWeight,
        previous_weight: previousWeight,
        previous_weight_display: `${formatWeightDisplay(previousWeight)} kg`,
        current_weight: currentWeight,
        current_weight_display: `${formatWeightDisplay(currentWeight)} kg`,
        block_delta: blockDelta,
        block_delta_display: formatSignedWeightDisplay(blockDelta),
        progression_display: formatSignedWeightDisplay(blockDelta),
        is_base_mesocycle: row.mesocycle_number === 1,
        mesocycle_number: row.mesocycle_number,
      });

      previousProgressionWeight = progressionWeight;
    }
  }

  for (const mesocycleId of Object.keys(groupedProgressions)) {
    groupedProgressions[mesocycleId].sort((left, right) =>
      left.exercise_name.localeCompare(right.exercise_name)
    );
  }

  return groupedProgressions;
}

async function getSelectedProgramBestExerciseNames(db, programId) {
  const programExercises = await weightliftingRepository.getProgramExerciseNames(
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

  for (const exercise of programExercises) {
    if (!selectionMap.has(exercise.exercise_name)) {
      await programRepository.insertProgramBestExerciseSelection(db, {
        programId,
        exerciseName: exercise.exercise_name,
        isSelected: true,
      });
      selectionMap.set(exercise.exercise_name, true);
    }
  }

  return new Set(
    programExercises
      .filter((exercise) => selectionMap.get(exercise.exercise_name) ?? true)
      .map((exercise) => exercise.exercise_name)
  );
}

function mapExerciseCatalogForDisplay(entries) {
  return entries.map((entry) => ({
    cloud_exercise_id: entry.cloud_exercise_id ?? entry.id ?? null,
    exercise_name: entry.name ?? entry.exercise_name,
    nickname: entry.nickname ?? null,
    default_visible_columns: entry.default_visible_columns ?? null,
    primary_muscle_count: Number(entry.primary_muscle_count) || 0,
    secondary_muscle_count: Number(entry.secondary_muscle_count) || 0,
    primary_group_key: entry.primary_group_key ?? null,
    primary_group_name: entry.primary_group_name ?? null,
    group_keys: Array.isArray(entry.group_keys) ? entry.group_keys : [],
    group_names: Array.isArray(entry.group_names) ? entry.group_names : [],
    body_map_view:
      normalizeBodyMapView(entry.body_map_view) || FRONT_BODY_MAP_VIEW,
    primary_body_map_region_keys: Array.isArray(
      entry.primary_body_map_region_keys
    )
      ? entry.primary_body_map_region_keys
      : [],
    secondary_body_map_region_keys: Array.isArray(
      entry.secondary_body_map_region_keys
    )
      ? entry.secondary_body_map_region_keys
      : [],
  }));
}

export async function getExerciseStorage(db) {
  return weightliftingRepository.getExerciseStorage(db);
}

export async function createExerciseStorage(db, exerciseName) {
  await weightliftingRepository.createExerciseStorage(db, exerciseName);
}

export async function getPersonalRecordExerciseSummaries(db) {
  const rows =
    await weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db);
  const rowsByExercise = new Map();

  for (const row of rows) {
    const exerciseName =
      typeof row?.exercise_name === "string" ? row.exercise_name.trim() : "";

    if (!exerciseName) {
      continue;
    }

    const exerciseRows = rowsByExercise.get(exerciseName) ?? [];
    exerciseRows.push(row);
    rowsByExercise.set(exerciseName, exerciseRows);
  }

  return [...rowsByExercise.entries()]
    .map(([exerciseName, exerciseRows]) =>
      buildPersonalRecordExerciseDetail(exerciseName, exerciseRows, {
        includeTrend: false,
      })
    )
    .sort((left, right) =>
      left.exerciseName.localeCompare(right.exerciseName, undefined, {
        sensitivity: "base",
      })
    );
}

export async function getPersonalRecordExerciseDetail(db, exerciseName) {
  const normalizedExerciseName =
    typeof exerciseName === "string" ? exerciseName.trim() : "";

  if (!normalizedExerciseName) {
    return null;
  }

  const rows =
    await weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db, {
      exerciseName: normalizedExerciseName,
    });

  if (rows.length === 0) {
    return null;
  }

  return buildPersonalRecordExerciseDetail(normalizedExerciseName, rows);
}

export async function getExerciseHistory(
  db,
  { exerciseId, exerciseName, limit = 3 }
) {
  const normalizedExerciseName =
    typeof exerciseName === "string" ? exerciseName.trim() : "";
  const normalizedExerciseId = normalizeOptionalInteger(exerciseId);
  const normalizedLimit = Math.max(1, normalizeOptionalInteger(limit, 3));

  if (!normalizedExerciseName || normalizedExerciseId === null) {
    return buildExerciseHistory([]);
  }

  const rows = await weightliftingRepository.getCompletedExerciseHistorySets(
    db,
    {
      exerciseId: normalizedExerciseId,
      exerciseName: normalizedExerciseName,
      limit: normalizedLimit,
    }
  );

  return buildExerciseHistory(rows);
}

export async function getExerciseLibraryEntries(db) {
  const localExerciseRows = await weightliftingRepository.getExerciseStorage(db);
  const localExercises = normalizeExerciseCatalogEntries(localExerciseRows);

  if (localExercises.length === 0) {
    return [];
  }

  try {
    const { data: exerciseRows, error: exerciseError } = await supabase
      .from(EXERCISE_LIBRARY_TABLE)
      .select(EXERCISE_LIBRARY_SELECT)
      .in(
        EXERCISE_LIBRARY_NAME_COLUMN,
        localExercises.map((exercise) => exercise.name)
      )
      .order(EXERCISE_LIBRARY_NAME_COLUMN, { ascending: true });

    if (exerciseError) {
      throw exerciseError;
    }

    const exerciseIds = (exerciseRows ?? [])
      .map((row) => row?.[EXERCISE_LIBRARY_ID_COLUMN])
      .filter((id) => id !== null && id !== undefined);
    let activationRows = [];

    if (exerciseIds.length > 0) {
      const { data, error } = await supabase
        .from(MUSCLE_ACTIVATION_TABLE)
        .select("exercise_id, muscle_id, activation_level")
        .in("exercise_id", exerciseIds);

      if (error) {
        throw error;
      }

      activationRows = data ?? [];
    }

    const [groupMetadata, bodyMapRegionMetadata] = await Promise.all([
      getExerciseGroupMetadata({
        exerciseIds,
        activationRows,
      }),
      getExerciseBodyMapRegionMetadata({
        exerciseIds,
        activationRows,
      }),
    ]);
    const roleCountMap = buildExerciseMuscleRoleCounts(activationRows);
    const cloudExerciseMap = new Map(
      (exerciseRows ?? []).map((exercise) => {
        const rawName = exercise?.[EXERCISE_LIBRARY_NAME_COLUMN];
        const name = typeof rawName === "string" ? rawName.trim() : "";
        const nickname =
          typeof exercise?.nickname === "string" &&
          exercise.nickname.trim() !== ""
            ? exercise.nickname.trim()
            : null;
        const groupData =
          groupMetadata.exerciseGroupMap.get(exercise.id) ?? {};
        const bodyMapRegionData =
          bodyMapRegionMetadata.exerciseBodyMapRegionMap.get(exercise.id) ??
          {};
        const roleCountData = roleCountMap.get(exercise.id) ?? {};

        return [
          name.toLocaleLowerCase(),
          {
            ...exercise,
            cloud_exercise_id: normalizeOptionalInteger(
              exercise?.[EXERCISE_LIBRARY_ID_COLUMN],
              null
            ),
            name,
            nickname,
            default_visible_columns: serializeVisibleColumns(
              exercise?.default_visible_columns
            ),
            ...groupData,
            ...bodyMapRegionData,
            ...roleCountData,
          },
        ];
      }).filter(([name]) => name)
    );

    return mapExerciseCatalogForDisplay(
      localExercises.map((exercise) => ({
        ...exercise,
        ...(cloudExerciseMap.get(exercise.name.toLocaleLowerCase()) ?? {}),
      }))
    );
  } catch (_error) {
    return mapExerciseCatalogForDisplay(localExercises);
  }
}

export async function syncExerciseLibraryFromCloud(db) {
  const { data: exerciseRows, error: exerciseError } = await supabase
    .from(EXERCISE_LIBRARY_TABLE)
    .select(EXERCISE_LIBRARY_SELECT)
    .order(EXERCISE_LIBRARY_NAME_COLUMN, { ascending: true });

  if (exerciseError) {
    throw exerciseError;
  }

  const cloudExercises = normalizeExerciseCatalogEntries(exerciseRows ?? []);
  const localExerciseRows = await weightliftingRepository.getExerciseStorage(db);
  const localExercises = normalizeExerciseCatalogEntries(localExerciseRows);
  let catalogChanged = false;

  if (!areExerciseCatalogEntriesEqual(localExercises, cloudExercises)) {
    await weightliftingRepository.replaceExerciseCatalog(db, cloudExercises);
    catalogChanged = true;
  }

  let preferenceSyncResult = {
    changed: false,
  };

  try {
    preferenceSyncResult = await syncExerciseColumnPreferencesWithCloud(db);
  } catch (error) {
    console.warn("Exercise column preference cloud sync failed:", error);
  }

  return {
    changed: catalogChanged || Boolean(preferenceSyncResult.changed),
    exerciseCount: cloudExercises.length,
  };
}

export async function getEstimatedSets(db, programId) {
  return weightliftingRepository.getEstimatedSets(db, programId);
}

export async function createEstimatedSet(
  db,
  { programId, exerciseName, estimatedWeight }
) {
  await withTransaction(db, async () => {
    await weightliftingRepository.createEstimatedSet(db, {
      programId,
      exerciseName,
      estimatedWeight,
    });

    const mesocycles = await programRepository.getMesocyclesByProgram(db, programId);

    for (const mesocycle of mesocycles) {
      const progressionWeight = await getDefaultMesocycleProgressionWeight(db, {
        programId,
        mesocycleNumber: mesocycle.mesocycle_number,
        exerciseName,
      });

      await weightliftingRepository.insertRmWeightProgression(db, {
        mesocycleId: mesocycle.mesocycle_id,
        exerciseName,
        progressionWeight,
      });
    }
  });
}

export async function updateEstimatedSetWeight(
  db,
  { estimatedSetId, estimatedWeight }
) {
  await weightliftingRepository.updateEstimatedSetWeight(db, {
    estimatedSetId,
    estimatedWeight,
  });
}

export async function deleteEstimatedSet(db, estimatedSetId) {
  await withTransaction(db, async () => {
    const estimatedSet = await weightliftingRepository.getEstimatedSetById(
      db,
      estimatedSetId
    );

    if (!estimatedSet) {
      return;
    }

    await weightliftingRepository.deleteEstimatedSet(db, estimatedSetId);
    await weightliftingRepository.deleteRmWeightProgressionsByProgramExercise(db, {
      programId: estimatedSet.program_id,
      exerciseName: estimatedSet.exercise_name,
    });
  });
}

export async function getMesocycleProgressiveOverload(
  db,
  { mesocycleId, programId, mesocycleNumber }
) {
  await ensureMesocycleProgressions(db, {
    mesocycleId,
    programId,
    mesocycleNumber,
  });

  const rows =
    await weightliftingRepository.getMesocycleEstimatedSetProgressionsByProgram(
      db,
      programId
    );
  const selectedExerciseNames = await getSelectedProgramBestExerciseNames(
    db,
    programId
  );
  const groupedProgressions = buildProgressionGroups(rows, selectedExerciseNames);
  const progressions = groupedProgressions[mesocycleId] ?? [];

  const uniformBlockDelta =
    progressions.length > 0 &&
    progressions.every(
      (progression) =>
        progression.block_delta === progressions[0].block_delta
    )
      ? progressions[0].block_delta
      : null;

  return {
    summary:
      rows.length === 0
        ? "No 1 RM values yet."
        : progressions.length === 0
          ? "No Program bests selected."
        : mesocycleNumber === 1 && uniformBlockDelta === 0
          ? "Base 1 RM values"
        : uniformBlockDelta !== null
          ? `This block: ${formatSignedWeightDisplay(uniformBlockDelta)}`
          : "Custom progression",
    progressions,
  };
}

export async function getMesocycleProgressiveOverloadByProgram(db, programId) {
  await ensureProgramMesocycleProgressions(db, programId);

  const rows =
    await weightliftingRepository.getMesocycleEstimatedSetProgressionsByProgram(
      db,
      programId
    );
  const selectedExerciseNames = await getSelectedProgramBestExerciseNames(
    db,
    programId
  );

  return buildProgressionGroups(rows, selectedExerciseNames);
}

export async function adjustMesocycleProgressionByDelta(
  db,
  { programId, mesocycleId, exerciseName, delta }
) {
  const numericDelta = Number(delta);

  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    return;
  }

  const mesocycles = await ensureProgramMesocycleProgressions(db, programId);
  const currentMesocycle = mesocycles.find(
    (mesocycle) => mesocycle.mesocycle_id === mesocycleId
  );

  if (!currentMesocycle) {
    throw new Error("Mesocycle not found");
  }

  await withTransaction(db, async () => {
    await weightliftingRepository.incrementRmWeightProgressionsFromMesocycle(
      db,
      {
        programId,
        exerciseName,
        mesocycleNumber: currentMesocycle.mesocycle_number,
        delta: numericDelta,
      }
    );
  });
}

export async function getStrengthWorkoutSummary(db, workoutId) {
  const total = await weightliftingRepository.getTotalPlannedSetsByWorkout(
    db,
    workoutId
  );
  const done = await weightliftingRepository.getDoneSetCountByWorkout(
    db,
    workoutId
  );

  return {
    totalSets: total?.count ?? 0,
    doneSets: done?.done_sets ?? 0,
  };
}

export async function getProgramExerciseNames(db, programId) {
  return weightliftingRepository.getProgramExerciseNames(db, programId);
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    const errorMessage = String(error?.message ?? "");

    if (errorMessage.toLowerCase().includes("auth session missing")) {
      return null;
    }

    throw error;
  }

  return data.user?.id ?? null;
}

function getExerciseColumnPreferenceUserId(userId) {
  return userId ?? LOCAL_EXERCISE_COLUMN_PREFERENCE_USER_ID;
}

async function getCurrentExerciseColumnPreferenceUserId() {
  try {
    return getExerciseColumnPreferenceUserId(await getAuthenticatedUserId());
  } catch (error) {
    console.warn("Unable to resolve authenticated exercise preferences:", error);
    return LOCAL_EXERCISE_COLUMN_PREFERENCE_USER_ID;
  }
}

function deserializeVisibleColumns(value) {
  const serializedValue = serializeVisibleColumns(value);

  if (!serializedValue) {
    return null;
  }

  try {
    return JSON.parse(serializedValue);
  } catch {
    return null;
  }
}

function getSerializedDefaultVisibleColumns() {
  return JSON.stringify(DEFAULT_VISIBLE_COLUMNS);
}

async function resolveExerciseVisibleColumnsForNewExercise(db, exerciseName) {
  const normalizedExerciseName = normalizeOptionalText(exerciseName);

  if (!normalizedExerciseName) {
    return getSerializedDefaultVisibleColumns();
  }

  const preferenceUserId = await getCurrentExerciseColumnPreferenceUserId();
  const preference = await weightliftingRepository.getExerciseColumnPreference(
    db,
    {
      userId: preferenceUserId,
      exerciseName: normalizedExerciseName,
    }
  );
  const preferredVisibleColumns = serializeVisibleColumns(
    preference?.visible_columns
  );

  if (preferredVisibleColumns) {
    return preferredVisibleColumns;
  }

  const exerciseCatalogEntry =
    await weightliftingRepository.getExerciseCatalogEntryByName(
      db,
      normalizedExerciseName
    );
  const defaultVisibleColumns = serializeVisibleColumns(
    exerciseCatalogEntry?.default_visible_columns
  );

  return defaultVisibleColumns ?? getSerializedDefaultVisibleColumns();
}

async function saveExerciseColumnPreference(
  db,
  { exerciseName, columns, needsSync = 1 }
) {
  const normalizedExerciseName = normalizeOptionalText(exerciseName);
  const visibleColumns =
    serializeVisibleColumns(columns) ?? getSerializedDefaultVisibleColumns();

  if (!normalizedExerciseName) {
    return null;
  }

  const [preferenceUserId, exerciseCatalogEntry] = await Promise.all([
    getCurrentExerciseColumnPreferenceUserId(),
    weightliftingRepository.getExerciseCatalogEntryByName(
      db,
      normalizedExerciseName
    ),
  ]);
  const updatedAt = new Date().toISOString();

  await weightliftingRepository.upsertExerciseColumnPreference(db, {
    userId: preferenceUserId,
    cloudExerciseId: normalizeOptionalInteger(
      exerciseCatalogEntry?.cloud_exercise_id,
      null
    ),
    exerciseName: normalizedExerciseName,
    visibleColumns,
    needsSync,
    updatedAt,
  });

  return {
    preferenceUserId,
    exerciseName: normalizedExerciseName,
    updatedAt,
  };
}

function syncExerciseColumnPreferencesInBackground(db) {
  startBackgroundSync(
    () => syncExerciseColumnPreferencesWithCloud(db),
    "Exercise column preference cloud sync failed:"
  );
}

export async function syncExerciseColumnPreferencesWithCloud(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const preferenceUserId = getExerciseColumnPreferenceUserId(userId);
  const localExerciseRows = await weightliftingRepository.getExerciseStorage(db);
  const localExercises = normalizeExerciseCatalogEntries(localExerciseRows);
  const localExercisesByName = new Map(
    localExercises.map((exercise) => [
      exercise.name.toLocaleLowerCase(),
      exercise,
    ])
  );
  const localExercisesByCloudId = new Map(
    localExercises
      .filter((exercise) => exercise.cloud_exercise_id !== null)
      .map((exercise) => [Number(exercise.cloud_exercise_id), exercise])
  );
  const dirtyPreferences =
    await weightliftingRepository.getDirtyExerciseColumnPreferences(
      db,
      preferenceUserId
    );
  let uploadedCount = 0;
  let downloadedCount = 0;

  for (const preference of dirtyPreferences) {
    const localExercise =
      localExercisesByCloudId.get(Number(preference.cloud_exercise_id)) ??
      localExercisesByName.get(
        String(preference.exercise_name ?? "").toLocaleLowerCase()
      );
    const cloudExerciseId = normalizeOptionalInteger(
      localExercise?.cloud_exercise_id ?? preference.cloud_exercise_id,
      null
    );
    const visibleColumns = deserializeVisibleColumns(
      preference.visible_columns
    );

    if (cloudExerciseId === null || !visibleColumns) {
      continue;
    }

    const { error } = await supabase
      .from(EXERCISE_COLUMN_PREFERENCE_CLOUD_TABLE)
      .upsert(
        {
          user_id: userId,
          exercise_id: cloudExerciseId,
          visible_columns: visibleColumns,
          updated_at: preference.updated_at ?? new Date().toISOString(),
        },
        { onConflict: "user_id,exercise_id" }
      );

    if (error) {
      throw error;
    }

    await weightliftingRepository.markExerciseColumnPreferenceSynced(db, {
      userId: preferenceUserId,
      exerciseName: preference.exercise_name,
      updatedAt: preference.updated_at,
    });
    uploadedCount += 1;
  }

  const cloudExerciseIds = [...localExercisesByCloudId.keys()];

  if (cloudExerciseIds.length === 0) {
    return {
      changed: uploadedCount > 0,
      downloadedCount,
      uploadedCount,
    };
  }

  const { data: cloudPreferences, error: cloudPreferencesError } =
    await supabase
      .from(EXERCISE_COLUMN_PREFERENCE_CLOUD_TABLE)
      .select(EXERCISE_COLUMN_PREFERENCE_CLOUD_SELECT)
      .eq("user_id", userId)
      .in("exercise_id", cloudExerciseIds);

  if (cloudPreferencesError) {
    throw cloudPreferencesError;
  }

  for (const cloudPreference of cloudPreferences ?? []) {
    const cloudExerciseId = normalizeOptionalInteger(
      cloudPreference?.exercise_id,
      null
    );
    const localExercise = localExercisesByCloudId.get(Number(cloudExerciseId));
    const visibleColumns = serializeVisibleColumns(
      cloudPreference?.visible_columns
    );

    if (!localExercise || !visibleColumns) {
      continue;
    }

    await weightliftingRepository.upsertExerciseColumnPreference(db, {
      userId: preferenceUserId,
      cloudExerciseId,
      exerciseName: localExercise.name,
      visibleColumns,
      needsSync: 0,
      updatedAt:
        normalizeOptionalText(cloudPreference?.updated_at) ??
        new Date().toISOString(),
    });
    downloadedCount += 1;
  }

  return {
    changed: uploadedCount > 0 || downloadedCount > 0,
    downloadedCount,
    uploadedCount,
  };
}

async function loadWorkoutExercisesFromLocal(db, workoutId) {
  const resolvedWorkoutId = normalizeRequiredId(workoutId, "workoutId");
  const preferenceUserId = await getCurrentExerciseColumnPreferenceUserId();
  const exercises = await weightliftingRepository.getExercisesByWorkout(
    db,
    resolvedWorkoutId
  );
  const [sets, preferences] = await Promise.all([
    weightliftingRepository.getSetsByWorkout(db, resolvedWorkoutId),
    weightliftingRepository.getExerciseColumnPreferencesForUser(
      db,
      preferenceUserId
    ),
  ]);
  const preferencesByExerciseName = new Map(
    preferences.map((preference) => [
      String(preference.exercise_name ?? "").toLocaleLowerCase(),
      preference,
    ])
  );

  const setsByExercise = {};
  for (const set of sets) {
    if (!setsByExercise[set.exercise_instance_id]) {
      setsByExercise[set.exercise_instance_id] = [];
    }
    setsByExercise[set.exercise_instance_id].push(set);
  }

  return exercises.map((exercise) => {
    const exerciseSets = setsByExercise[exercise.exercise_id] ?? [];
    const preference = preferencesByExerciseName.get(
      String(exercise.exercise_name ?? "").toLocaleLowerCase()
    );
    const instanceVisibleColumns = isAppDefaultVisibleColumns(
      exercise.visible_columns
    )
      ? null
      : exercise.visible_columns;
    const plannedSetCount = Number(exercise.sets) || 0;
    const hasPersonalRecord = exerciseSets.some(
      (set) =>
        normalizeBooleanFlag(set?.personal_record) &&
        normalizeBooleanFlag(set?.done) &&
        !normalizeBooleanFlag(set?.failed)
    );

    return {
      ...exercise,
      hasPersonalRecord,
      plannedSetCount,
      sets: exerciseSets,
      setCount: exerciseSets.length,
      visibleColumns: resolveVisibleColumns(
        preference?.visible_columns,
        instanceVisibleColumns,
        exercise.default_visible_columns
      ),
    };
  });
}

function shouldHydrateWorkoutExerciseData(exercises) {
  if (exercises.length === 0) {
    return true;
  }

  return exercises.some((exercise) => {
    const expectedSetCount = Number(exercise.plannedSetCount) || 0;
    return expectedSetCount > 0 && exercise.setCount === 0;
  });
}

async function hydrateWorkoutStrengthDataFromCloud(db, workoutId) {
  const [userId, workoutSyncMetadata, localExercises] = await Promise.all([
    getAuthenticatedUserId(),
    programRepository.getWorkoutSyncMetadata(db, workoutId),
    weightliftingRepository.getExercisesForCloudSync(db),
  ]);
  const cloudWorkoutTypeInstanceId = normalizeOptionalInteger(
    resolveSideBySideCloudId(
      workoutSyncMetadata,
      "cloud_workout_type_instance_id"
    ),
    null
  );

  if (!userId || cloudWorkoutTypeInstanceId === null) {
    return false;
  }

  const { data: cloudExercises, error: cloudExercisesError } = await supabase
    .from(EXERCISE_INSTANCE_CLOUD_TABLE)
    .select(EXERCISE_INSTANCE_CLOUD_SELECT)
    .eq("user_id", userId)
    .eq("cloud_workout_type_instance_id", cloudWorkoutTypeInstanceId)
    .order("exercise_order", { ascending: true })
    .order("id", { ascending: true });

  if (cloudExercisesError) {
    throw cloudExercisesError;
  }

  const localExercisesForWorkout = localExercises.filter(
    (exercise) => Number(exercise.workout_type_instance_id) === Number(workoutId)
  );
  const localExercisesByCloudId = new Map();
  const localExercisesByRemoteLocalId = new Map();
  const localExercisesByLocalId = new Map();

  for (const exercise of localExercisesForWorkout) {
    const cloudExerciseInstanceId = normalizeOptionalInteger(
      resolveSideBySideCloudId(exercise, "cloud_exercise_instance_id"),
      null
    );
    const remoteLocalExerciseInstanceId = normalizeOptionalInteger(
      exercise.remote_local_exercise_instance_id,
      null
    );

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudId.set(cloudExerciseInstanceId, exercise);
    }

    if (remoteLocalExerciseInstanceId !== null) {
      localExercisesByRemoteLocalId.set(remoteLocalExerciseInstanceId, exercise);
    }

    localExercisesByLocalId.set(exercise.exercise_instance_id, exercise);
  }

  let didHydrate = false;

  await withTransaction(db, async () => {
    for (const cloudExercise of cloudExercises ?? []) {
      const cloudExerciseInstanceId = normalizeOptionalInteger(
        cloudExercise?.id,
        null
      );
      const remoteLocalExerciseInstanceId = normalizeOptionalInteger(
        cloudExercise?.local_exercise_instance_id,
        null
      );
      const exerciseName = normalizeOptionalText(cloudExercise?.exercise_name);

      if (cloudExerciseInstanceId === null || !exerciseName) {
        continue;
      }

      const localExercise =
        localExercisesByCloudId.get(cloudExerciseInstanceId) ??
        localExercisesByRemoteLocalId.get(remoteLocalExerciseInstanceId) ??
        localExercisesByLocalId.get(remoteLocalExerciseInstanceId) ??
        null;

      if (isCloudSnapshotDeleting(cloudExercise)) {
        if (!localExercise) {
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
        didHydrate = true;
        continue;
      }

      const exercisePayload = {
        cloudExerciseInstanceId,
        remoteLocalExerciseInstanceId,
        syncId: normalizeSyncId(cloudExercise?.sync_id),
        syncVersion: normalizeOptionalInteger(cloudExercise?.sync_version, 0),
        deletedAt: normalizeOptionalText(cloudExercise?.deleted_at),
        workoutId,
        exerciseName,
        exerciseOrder: normalizeExerciseOrder(cloudExercise?.exercise_order),
        sets: Math.max(0, normalizeOptionalInteger(cloudExercise?.sets, 0) ?? 0),
        visibleColumns: serializeVisibleColumns(cloudExercise?.visible_columns),
        note: normalizeOptionalText(cloudExercise?.note),
        done: normalizeBooleanFlag(cloudExercise?.done),
      };

      if (!localExercise) {
        const createdExerciseResult =
          await weightliftingRepository.createExerciseFromCloud(
            db,
            exercisePayload
          );
        const createdExercise = {
          exercise_instance_id: createdExerciseResult.lastInsertRowId,
          cloud_exercise_instance_id: cloudExerciseInstanceId,
          remote_local_exercise_instance_id: remoteLocalExerciseInstanceId,
          workout_type_instance_id: workoutId,
        };

        localExercisesByCloudId.set(cloudExerciseInstanceId, createdExercise);
        if (remoteLocalExerciseInstanceId !== null) {
          localExercisesByRemoteLocalId.set(
            remoteLocalExerciseInstanceId,
            createdExercise
          );
          localExercisesByLocalId.set(
            remoteLocalExerciseInstanceId,
            createdExercise
          );
        }
        localExercisesByLocalId.set(
          createdExercise.exercise_instance_id,
          createdExercise
        );
        didHydrate = true;
        continue;
      }

      await weightliftingRepository.updateExerciseFromCloud(db, {
        exerciseId: localExercise.exercise_instance_id,
        ...exercisePayload,
      });
      didHydrate = true;
    }
  });

  const refreshedExercises = (
    await weightliftingRepository.getExercisesForCloudSync(db)
  ).filter(
    (exercise) => Number(exercise.workout_type_instance_id) === Number(workoutId)
  );
  const localExerciseIds = new Set(
    refreshedExercises.map((exercise) => exercise.exercise_instance_id)
  );
  const localExercisesByCloudExerciseId = new Map();

  for (const exercise of refreshedExercises) {
    const cloudExerciseInstanceId = normalizeOptionalInteger(
      resolveSideBySideCloudId(exercise, "cloud_exercise_instance_id"),
      null
    );

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudExerciseId.set(cloudExerciseInstanceId, exercise);
    }
  }

  const cloudExerciseIds = [...localExercisesByCloudExerciseId.keys()];

  if (cloudExerciseIds.length === 0) {
    return didHydrate;
  }

  const { data: cloudSets, error: cloudSetsError } = await supabase
    .from(SET_CLOUD_TABLE)
    .select(SET_CLOUD_SELECT)
    .eq("user_id", userId)
    .in("cloud_exercise_instance_id", cloudExerciseIds)
    .order("cloud_exercise_instance_id", { ascending: true })
    .order("id", { ascending: true });

  if (cloudSetsError) {
    throw cloudSetsError;
  }

  const localSets = (await weightliftingRepository.getSetsForCloudSync(db)).filter(
    (set) => localExerciseIds.has(set.exercise_instance_id)
  );
  const localSetsByCloudId = new Map();
  const localSetsByRemoteLocalId = new Map();
  const localSetsByLocalId = new Map();

  for (const localSet of localSets) {
    const cloudSetId = normalizeOptionalInteger(
      resolveSideBySideCloudId(localSet, "cloud_set_id"),
      null
    );
    const remoteLocalSetId = normalizeOptionalInteger(
      localSet.remote_local_set_id,
      null
    );

    if (cloudSetId !== null) {
      localSetsByCloudId.set(cloudSetId, localSet);
    }

    if (remoteLocalSetId !== null) {
      localSetsByRemoteLocalId.set(remoteLocalSetId, localSet);
    }

    localSetsByLocalId.set(localSet.sets_id, localSet);
  }

  await withTransaction(db, async () => {
    for (const cloudSet of cloudSets ?? []) {
      const cloudSetId = normalizeOptionalInteger(cloudSet?.id, null);
      const remoteLocalSetId = normalizeOptionalInteger(
        cloudSet?.local_set_id,
        null
      );
      const cloudExerciseInstanceId = normalizeOptionalInteger(
        cloudSet?.cloud_exercise_instance_id,
        null
      );
      const parentExercise =
        localExercisesByCloudExerciseId.get(cloudExerciseInstanceId) ?? null;

      if (
        cloudSetId === null ||
        cloudExerciseInstanceId === null ||
        !parentExercise
      ) {
        continue;
      }

      const localSet =
        localSetsByCloudId.get(cloudSetId) ??
        localSetsByRemoteLocalId.get(remoteLocalSetId) ??
        localSetsByLocalId.get(remoteLocalSetId) ??
        null;

      if (isCloudSnapshotDeleting(cloudSet)) {
        if (!localSet) {
          continue;
        }

        await weightliftingRepository.deleteSetById(db, localSet.sets_id);
        didHydrate = true;
        continue;
      }

      const setPayload = {
        cloudSetId,
        remoteLocalSetId,
        syncId: normalizeSyncId(cloudSet?.sync_id),
        syncVersion: normalizeOptionalInteger(cloudSet?.sync_version, 0),
        deletedAt: normalizeOptionalText(cloudSet?.deleted_at),
        exerciseId: parentExercise.exercise_instance_id,
        setNumber: normalizeOptionalInteger(cloudSet?.set_number, 1),
        personalRecord: normalizeBooleanFlag(cloudSet?.personal_record),
        pause: normalizeOptionalInteger(cloudSet?.pause, null),
        rpe: normalizeOptionalInteger(cloudSet?.rpe, null),
        weight: normalizeOptionalInteger(cloudSet?.weight, null),
        rmPercentage: normalizeOptionalInteger(cloudSet?.rm_percentage, null),
        reps: normalizeOptionalInteger(cloudSet?.reps, null),
        done: normalizeBooleanFlag(cloudSet?.done),
        failed: normalizeBooleanFlag(cloudSet?.failed),
        amrap: normalizeBooleanFlag(cloudSet?.amrap),
        note: normalizeOptionalText(cloudSet?.note),
      };

      if (!localSet) {
        await weightliftingRepository.createSetFromCloud(db, setPayload);
        didHydrate = true;
        continue;
      }

      await weightliftingRepository.updateSetFromCloud(db, {
        setId: localSet.sets_id,
        ...setPayload,
      });
      didHydrate = true;
    }

    await weightliftingRepository.refreshExerciseDerivedFieldsFromSets(db);
  });

  return didHydrate;
}

export async function syncStrengthWorkoutDataFromCloud(db) {
  const programServiceModule = await import("./programService");
  return enqueueSync(() => programServiceModule.syncSetsWithCloud(db));
}

export async function hydrateStrengthWorkoutDataForWorkout(db, workoutId) {
  let exercises = await loadWorkoutExercisesFromLocal(db, workoutId);

  if (!shouldHydrateWorkoutExerciseData(exercises)) {
    return exercises;
  }

  let targetedHydrationError = null;

  try {
    await hydrateWorkoutStrengthDataFromCloud(db, workoutId);
    exercises = await loadWorkoutExercisesFromLocal(db, workoutId);
  } catch (hydrateError) {
    targetedHydrationError = hydrateError;
  }

  if (!shouldHydrateWorkoutExerciseData(exercises)) {
    return exercises;
  }

  let syncError = null;

  try {
    await syncStrengthWorkoutDataFromCloud(db);
    exercises = await loadWorkoutExercisesFromLocal(db, workoutId);
  } catch (error) {
    syncError = error;
  }

  if (shouldHydrateWorkoutExerciseData(exercises)) {
    if (targetedHydrationError || syncError) {
      throw new Error(
        `Targeted workout hydration failed: ${
          targetedHydrationError?.message ?? "unknown targeted hydration error"
        }. Global strength sync failed: ${
          syncError?.message ?? "unknown global sync error"
        }.`
      );
    }

    console.warn(
      "Workout hydration completed, but the workout is still missing exercise or set data.",
      { workoutId }
    );
  }

  return exercises;
}

export async function getWorkoutExercises(
  db,
  workoutId,
  { ensureHydrated = false } = {}
) {
  let exercises = await loadWorkoutExercisesFromLocal(db, workoutId);

  if (ensureHydrated && shouldHydrateWorkoutExerciseData(exercises)) {
    try {
      exercises = await hydrateStrengthWorkoutDataForWorkout(db, workoutId);
    } catch (error) {
      console.warn(
        "Unable to hydrate strength workout exercises from cloud:",
        error
      );
    }
  }

  return exercises;
}

export async function addExerciseToWorkout(db, { workoutId, exerciseName }) {
  const visibleColumns = await resolveExerciseVisibleColumnsForNewExercise(
    db,
    exerciseName
  );

  await withTransaction(db, async () => {
    const nextExerciseOrder =
      await weightliftingRepository.getNextExerciseOrderForWorkout(
        db,
        workoutId
      );

    await weightliftingRepository.createExercise(db, {
      workoutId,
      exerciseName,
      sets: 0,
      visibleColumns,
      exerciseOrder: normalizeExerciseOrder(
        nextExerciseOrder?.exercise_order,
        1
      ),
    });

    await workoutRepository.updateWorkoutDone(db, {
      workoutId,
      done: false,
    });

    await workoutService.refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  syncExerciseInstancesInBackground(db);
}

async function resequenceWorkoutExerciseOrder(db, workoutId) {
  const exercises = await weightliftingRepository.getExerciseOrderByWorkout(
    db,
    workoutId
  );
  let didChange = false;

  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index];
    const exerciseOrder = index + 1;

    if (Number(exercise.exercise_order) === exerciseOrder) {
      continue;
    }

    await weightliftingRepository.updateExerciseOrder(db, {
      exerciseId: exercise.exercise_instance_id,
      exerciseOrder,
    });
    didChange = true;
  }

  return didChange;
}

export async function reorderWorkoutExercises(db, { workoutId, exerciseIds }) {
  const resolvedWorkoutId = normalizeRequiredId(workoutId, "workoutId");
  const orderedExerciseIds = [...new Set(
    (exerciseIds ?? [])
      .map((exerciseId) => Number(exerciseId))
      .filter((exerciseId) => Number.isFinite(exerciseId))
  )];
  let didChange = false;

  if (orderedExerciseIds.length !== (exerciseIds ?? []).length) {
    throw new Error("Exercise reorder payload contains an invalid exercise id.");
  }

  await withTransaction(db, async () => {
    const currentExercises =
      await weightliftingRepository.getExerciseOrderByWorkout(
        db,
        resolvedWorkoutId
      );
    const currentExerciseIds = currentExercises.map((exercise) =>
      Number(exercise.exercise_instance_id)
    );
    const currentExerciseIdSet = new Set(currentExerciseIds);

    if (
      orderedExerciseIds.length !== currentExerciseIds.length ||
      orderedExerciseIds.some(
        (exerciseId) => !currentExerciseIdSet.has(exerciseId)
      )
    ) {
      throw new Error("Exercise reorder payload does not match this workout.");
    }

    const currentOrdersById = new Map(
      currentExercises.map((exercise) => [
        Number(exercise.exercise_instance_id),
        Number(exercise.exercise_order),
      ])
    );

    for (let index = 0; index < orderedExerciseIds.length; index += 1) {
      const exerciseId = orderedExerciseIds[index];
      const exerciseOrder = index + 1;

      if (currentOrdersById.get(exerciseId) === exerciseOrder) {
        continue;
      }

      await weightliftingRepository.updateExerciseOrder(db, {
        exerciseId,
        exerciseOrder,
      });
      didChange = true;
    }
  });

  if (didChange) {
    syncExerciseInstancesInBackground(db);
  }

  return didChange;
}

export async function deleteExercise(db, exerciseId) {
  await withTransaction(db, async () => {
    const exercise = await weightliftingRepository.getWorkoutIdByExercise(
      db,
      exerciseId
    );
    const syncMetadata = await weightliftingRepository.getExerciseSyncMetadata(
      db,
      exerciseId
    );
    const remoteLocalExerciseInstanceId =
      Number(syncMetadata?.remote_local_exercise_instance_id) ||
      Number(syncMetadata?.exercise_instance_id) ||
      Number(exerciseId) ||
      null;
    const deleteSyncVersion = createNextSyncVersion(syncMetadata?.sync_version);

    const cloudExerciseInstanceId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_exercise_instance_id"
    );

    if (cloudExerciseInstanceId !== null || remoteLocalExerciseInstanceId !== null) {
      await weightliftingRepository.queueExerciseInstanceDeleteSync(db, {
        cloudExerciseInstanceId,
        remoteLocalExerciseInstanceId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: deleteSyncVersion,
        deletedAt: new Date().toISOString(),
      });
    }

    await weightliftingRepository.deleteSetsByExercise(db, exerciseId);
    await weightliftingRepository.deleteExerciseById(db, exerciseId);

    if (exercise?.workout_id) {
      await resequenceWorkoutExerciseOrder(db, exercise.workout_id);
      await weightliftingRepository.updateWorkoutDoneFromExercises(
        db,
        exercise.workout_id
      );
      await workoutService.refreshWorkoutHierarchyCompletion(
        db,
        exercise.workout_id
      );
    }
  });

  syncExerciseInstancesInBackground(db);
}

export async function addSetToExercise(db, exerciseId) {
  await withTransaction(db, async () => {
    const exercise = await weightliftingRepository.getWorkoutIdByExercise(
      db,
      exerciseId
    );
    const row = await weightliftingRepository.countSetsByExercise(db, exerciseId);

    await weightliftingRepository.createSet(db, {
      setNumber: (row?.count ?? 0) + 1,
      exerciseId,
    });

    await weightliftingRepository.updateExerciseSetCount(db, exerciseId);
    await weightliftingRepository.updateExerciseDoneFromSets(db, exerciseId);

    if (exercise?.workout_id) {
      await weightliftingRepository.updateWorkoutDoneFromExercises(
        db,
        exercise.workout_id
      );
      await workoutService.refreshWorkoutHierarchyCompletion(
        db,
        exercise.workout_id
      );
    }
  });

  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function updateExerciseVisibleColumns(
  db,
  { exerciseId, columns }
) {
  const exercise = await weightliftingRepository.getExerciseInstanceById(
    db,
    exerciseId
  );

  await weightliftingRepository.updateExerciseVisibleColumns(db, {
    exerciseId,
    columns,
  });

  if (exercise?.exercise_name) {
    await saveExerciseColumnPreference(db, {
      exerciseName: exercise.exercise_name,
      columns,
    });
    syncExerciseColumnPreferencesInBackground(db);
  }

  syncExerciseInstancesInBackground(db);
}

export async function updateExerciseNote(db, { exerciseId, note }) {
  await weightliftingRepository.updateExerciseNote(db, {
    exerciseId,
    note,
  });
  syncExerciseInstancesInBackground(db);
}

export async function updateStrengthSetDone(
  db,
  { workoutId, setId, done, failed = 0 }
) {
  let personalRecordSetIds = [];

  await withTransaction(db, async () => {
    await weightliftingRepository.updateSetDone(db, { setId, done, failed });
    personalRecordSetIds = await refreshPersonalRecordsForSet(db, setId);
    await weightliftingRepository.updateExerciseDoneBySet(db, setId);
    await weightliftingRepository.updateWorkoutDoneFromExercises(db, workoutId);
    await workoutService.refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);

  return { personalRecordSetIds };
}

export async function deleteSet(db, setId) {
  await withTransaction(db, async () => {
    const set = await weightliftingRepository.getExerciseAndWorkoutBySetId(
      db,
      setId
    );

    if (!set) {
      return;
    }

    const syncMetadata = await weightliftingRepository.getSetSyncMetadata(
      db,
      setId
    );
    const remoteLocalSetId =
      Number(syncMetadata?.remote_local_set_id) ||
      Number(syncMetadata?.sets_id) ||
      Number(setId) ||
      null;
    const deleteSyncVersion = createNextSyncVersion(syncMetadata?.sync_version);

    const cloudSetId = resolveSideBySideCloudId(syncMetadata, "cloud_set_id");

    if (cloudSetId !== null || remoteLocalSetId !== null) {
      await weightliftingRepository.queueSetDeleteSync(db, {
        cloudSetId,
        remoteLocalSetId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: deleteSyncVersion,
        deletedAt: new Date().toISOString(),
      });
    }

    await weightliftingRepository.deleteSetById(db, setId);
    await refreshPersonalRecordsForExerciseName(db, set.exercise_name);

    const sets = await weightliftingRepository.getSetIdsByExercise(
      db,
      set.exercise_instance_id
    );
    let setNumber = 1;
    for (const row of sets) {
      await weightliftingRepository.updateSetNumber(db, {
        setId: row.sets_id,
        setNumber,
      });
      setNumber += 1;
    }

    await weightliftingRepository.updateExerciseSetCount(db, set.exercise_instance_id);
    await weightliftingRepository.updateExerciseDoneFromSets(db, set.exercise_instance_id);
    await weightliftingRepository.updateWorkoutDoneFromExercises(
      db,
      set.workout_id
    );
    await workoutService.refreshWorkoutHierarchyCompletion(db, set.workout_id);
  });

  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function updateSetField(db, { field, value, setId }) {
  const result = await withTransaction(db, async () => {
    await weightliftingRepository.updateSetField(db, { field, value, setId });

    if (field !== "weight" && field !== "reps") {
      return null;
    }

    return {
      personalRecordSetIds: await refreshPersonalRecordsForSet(db, setId),
    };
  });

  syncSetsInBackground(db);
  return result;
}

export async function updateSetRmPercentage(db, { setId, rmPercentage }) {
  const nextRmPercentage = normalizeOptionalNumber(rmPercentage);

  const result = await withTransaction(db, async () => {
    await weightliftingRepository.updateSetField(db, {
      field: "rm_percentage",
      value: nextRmPercentage,
      setId,
    });

    if (nextRmPercentage === null) {
      return {
        rmPercentage: null,
        weightUpdated: false,
        weight: null,
      };
    }

    const estimatedWeight = await getEstimatedWeightForSet(db, setId);

    if (estimatedWeight === null) {
      return {
        rmPercentage: nextRmPercentage,
        weightUpdated: false,
        weight: null,
      };
    }

    const calculatedWeight = Math.round(
      estimatedWeight * (nextRmPercentage / 100)
    );

    await weightliftingRepository.updateSetField(db, {
      field: "weight",
      value: calculatedWeight,
      setId,
    });

    return {
      rmPercentage: nextRmPercentage,
      weightUpdated: true,
      weight: calculatedWeight,
      personalRecordSetIds: await refreshPersonalRecordsForSet(db, setId),
    };
  });

  syncSetsInBackground(db);
  return result;
}

export async function updateSetWeight(db, { setId, weight }) {
  const nextWeight = normalizeOptionalNumber(weight);

  const result = await withTransaction(db, async () => {
    await weightliftingRepository.updateSetField(db, {
      field: "weight",
      value: nextWeight,
      setId,
    });

    if (nextWeight === null) {
      await weightliftingRepository.updateSetField(db, {
        field: "rm_percentage",
        value: null,
        setId,
      });

      return {
        weight: null,
        rmPercentage: null,
        personalRecordSetIds: await refreshPersonalRecordsForSet(db, setId),
      };
    }

    const estimatedWeight = await getEstimatedWeightForSet(db, setId);

    if (estimatedWeight === null) {
      await weightliftingRepository.updateSetField(db, {
        field: "rm_percentage",
        value: null,
        setId,
      });

      return {
        weight: nextWeight,
        rmPercentage: null,
        personalRecordSetIds: await refreshPersonalRecordsForSet(db, setId),
      };
    }

    const nextRmPercentage = Math.round((nextWeight / estimatedWeight) * 100);

    await weightliftingRepository.updateSetField(db, {
      field: "rm_percentage",
      value: nextRmPercentage,
      setId,
    });

    return {
      weight: nextWeight,
      rmPercentage: nextRmPercentage,
      personalRecordSetIds: await refreshPersonalRecordsForSet(db, setId),
    };
  });

  syncSetsInBackground(db);
  return result;
}

export async function getExerciseSets(db, exerciseId) {
  return weightliftingRepository.getExerciseSets(db, exerciseId);
}

export async function getExerciseSetCount(db, exerciseId) {
  return weightliftingRepository.getExerciseSetCount(db, exerciseId);
}

export async function initializeExerciseSets(db, { exerciseId, count }) {
  await withTransaction(db, async () => {
    for (let index = 1; index <= count; index += 1) {
      await weightliftingRepository.createSet(db, {
        setNumber: index,
        exerciseId,
      });
    }

    await weightliftingRepository.updateExerciseSetCount(db, exerciseId);
  });

  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function saveExerciseSets(db, { exerciseId, sets }) {
  await withTransaction(db, async () => {
    const exercise = await weightliftingRepository.getWorkoutIdByExercise(
      db,
      exerciseId
    );
    const exerciseRecord =
      await weightliftingRepository.getExerciseNameByExerciseId(db, exerciseId);

    for (const set of sets) {
      await weightliftingRepository.updateSetByExerciseAndNumber(db, {
        exerciseId,
        setNumber: set.set_number,
        pause: set.pause,
        rpe: set.rpe,
        weight: set.weight,
        rmPercentage: set.rm_percentage,
        reps: set.reps,
        done: set.done ? 1 : 0,
        failed: set.failed ? 1 : 0,
        amrap: set.amrap ? 1 : 0,
        note: set.note,
      });
    }

    await refreshPersonalRecordsForExerciseName(
      db,
      exerciseRecord?.exercise_name
    );
    await weightliftingRepository.updateExerciseDoneFromSets(db, exerciseId);

    if (exercise?.workout_id) {
      await weightliftingRepository.updateWorkoutDoneFromExercises(
        db,
        exercise.workout_id
      );
      await workoutService.refreshWorkoutHierarchyCompletion(
        db,
        exercise.workout_id
      );
    }
  });

  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function updateExerciseDone(db, { exerciseId, done }) {
  await withTransaction(db, async () => {
    const exercise = await weightliftingRepository.getWorkoutIdByExercise(
      db,
      exerciseId
    );

    await weightliftingRepository.updateExerciseDone(db, { exerciseId, done });

    if (exercise?.workout_id) {
      await weightliftingRepository.updateWorkoutDoneFromExercises(
        db,
        exercise.workout_id
      );
      await workoutService.refreshWorkoutHierarchyCompletion(
        db,
        exercise.workout_id
      );
    }
  });

  syncExerciseInstancesInBackground(db);
}
