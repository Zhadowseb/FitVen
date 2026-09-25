// Exercises people have made and shared: the rules and the formatting that the
// library, the exercise page, your own exercise and the service all share.
//
// Pure - no React Native, no supabase - so scripts/test-shared-exercises.js
// loads it on its own. The limits here are the same ones the migration checks
// (supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql); a
// limit changed in one place and not the other is a save that fails in the
// cloud after it succeeded on the phone.
import {
  EXERCISE_MUSCLE_GROUPS,
  normalizeExerciseMuscleSelection,
  serializeExerciseMuscleSelection,
} from "./exerciseMuscleGroups";

/* ---------------------------------------------------------------- limits -- */

export const CUSTOM_EXERCISE_PAGE_SIZE = 30;
export const DESCRIPTION_MAX_LENGTH = 120;
export const STEP_MAX_LENGTH = 140;
export const MAX_STEPS = 5;
export const REPORT_NOTE_MAX_LENGTH = 500;
export const VIDEO_MAX_DURATION_MS = 20000;
export const VIDEO_MAX_BYTES = 30 * 1024 * 1024;
// A distribution drawn from fewer sets than this is a guess, not a fact.
export const DISTRIBUTION_MIN_SETS = 20;

/* ------------------------------------------------------------ the values -- */

// The order is the order on screen: the sort sheet and the chips both read it.
// Three are orders and three are filters that then order by use, which is why
// they share one control.
export const CUSTOM_EXERCISE_SORTS = ["popular", "newest", "gym", "following", "video", "saved"];
export const DEFAULT_CUSTOM_EXERCISE_SORT = "popular";

export const EQUIPMENT_KEYS = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "kettlebell",
  "band",
  "none",
  "other",
];

export const WEIGHT_MODES = ["total", "per_side", "bodyweight"];
export const DEFAULT_WEIGHT_MODE = "total";

export const REPORT_REASONS = ["wrong", "offensive", "duplicate", "other"];

export function normalizeCustomExerciseSort(value) {
  return CUSTOM_EXERCISE_SORTS.includes(value) ? value : DEFAULT_CUSTOM_EXERCISE_SORT;
}

export function normalizeEquipment(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";

  return EQUIPMENT_KEYS.includes(key) ? key : null;
}

export function normalizeWeightMode(value) {
  const mode = typeof value === "string" ? value.trim().toLowerCase() : "";

  return WEIGHT_MODES.includes(mode) ? mode : DEFAULT_WEIGHT_MODE;
}

export function normalizeReportReason(value) {
  return REPORT_REASONS.includes(value) ? value : null;
}

// Whitespace runs collapse to one space, so a pasted line break does not
// survive into a one-line description.
function collapse(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** The one line that says what the exercise is; null when there is none. */
export function normalizeDescription(value) {
  const text = collapse(value).slice(0, DESCRIPTION_MAX_LENGTH).trim();

  return text.length > 0 ? text : null;
}

/**
 * The owner's steps: at most five, each at most 140 characters, blanks
 * dropped. Arrives as an array, or JSON-encoded from SQLite.
 */
export function normalizeSteps(value) {
  let list = value;

  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((step) => collapse(step).slice(0, STEP_MAX_LENGTH).trim())
    .filter((step) => step.length > 0)
    .slice(0, MAX_STEPS);
}

/**
 * { primary, secondary } muscle group keys, from any stored shape: the cloud's
 * object, SQLite's JSON, or the legacy plain array where every key is primary.
 */
export function normalizeCustomExerciseMuscles(value) {
  const { primaryKeys, secondaryKeys } = normalizeExerciseMuscleSelection(value);

  return { primary: primaryKeys, secondary: secondaryKeys };
}

export function primaryMuscleKey(muscles) {
  return normalizeCustomExerciseMuscles(muscles).primary[0] ?? null;
}

/* -------------------------------------------------------------- the tags -- */

const TRAINING_GROUP_BY_MUSCLE = new Map(
  EXERCISE_MUSCLE_GROUPS.map((group) => [group.key, group.trainingGroupKey])
);

const TONE_TOKEN_BY_TRAINING_GROUP = {
  push: "musclePush",
  pull: "musclePull",
  legs: "muscleLegs",
  core: "muscleCore",
};

/**
 * The theme token a muscle group's tag is drawn in - its training group's
 * colour. The screen does `theme[muscleToneToken(key)]`; tokens rather than
 * colours so the light theme gets its darker variants.
 */
export function muscleToneToken(muscleKey) {
  return TONE_TOKEN_BY_TRAINING_GROUP[TRAINING_GROUP_BY_MUSCLE.get(muscleKey)] ?? "musclePush";
}

/* ------------------------------------------------------------ the labels -- */

// Translation keys, so every screen names a value the same way. The values
// are the cloud's; the keys are camelCase.
export function equipmentLabelKey(equipment) {
  const key = normalizeEquipment(equipment);

  return key ? `customExercises.equipment.${key}` : null;
}

export function weightModeLabelKey(weightMode) {
  const mode = normalizeWeightMode(weightMode);

  return `customExercises.weightMode.${mode === "per_side" ? "perSide" : mode}`;
}

export function sortLabelKey(sort) {
  return `customExercises.sorts.${normalizeCustomExerciseSort(sort)}`;
}

/* ------------------------------------------------------------ formatting -- */

/** 12 400 ms -> "0:12". Null for no duration. */
export function formatVideoDuration(durationMs) {
  const ms = Number(durationMs);

  if (!Number.isFinite(ms) || ms <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "3 × 10", or null when either half is unknown. */
export function formatTypicalSetsReps(sets, reps) {
  const s = Number(sets);
  const r = Number(reps);

  if (!Number.isFinite(s) || !Number.isFinite(r) || s <= 0 || r <= 0) {
    return null;
  }

  return `${Math.round(s)} × ${Math.round(r)}`;
}

/**
 * A weight bucket's name under its bar: "–50" for the first, "90+" for the
 * last, "50–60" between. `format` formats a number for the reader's locale.
 */
export function formatBucketLabel(bucket, format = (value) => String(value)) {
  const from = bucket?.from ?? null;
  const to = bucket?.to ?? null;

  if (from === null && to !== null) {
    return `–${format(to)}`;
  }

  if (to === null && from !== null) {
    return `${format(from)}+`;
  }

  if (from !== null && to !== null) {
    return `${format(from)}–${format(to)}`;
  }

  return "";
}

/** The index of the bucket most sets fall in; the first on a tie, -1 for none. */
export function mostCommonBucketIndex(buckets) {
  let best = -1;
  let bestCount = 0;

  (Array.isArray(buckets) ? buckets : []).forEach((bucket, index) => {
    const count = Number(bucket?.count) || 0;

    if (count > bestCount) {
      best = index;
      bestCount = count;
    }
  });

  return best;
}

/* ------------------------------------------------------------ the shapes -- */

// What the server hands out, as the screens read it: camelCase, normalised,
// never a raw row. The service signs the URLs afterwards; these only carry what
// was in the answer.

function toId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function toCount(value) {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toPositiveNumberOrNull(value) {
  const number = toNumberOrNull(value);

  return number !== null && number > 0 ? number : null;
}

function toDurationOrNull(value) {
  const duration = toPositiveNumberOrNull(value);

  return duration === null ? null : Math.round(duration);
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTimestampOrNull(value) {
  return toText(value) || null;
}

function toFlag(value) {
  return value === true || Number(value) === 1;
}

/** A row of browse_custom_exercises as a CustomExerciseSummary, or null. */
export function mapCustomExerciseSummaryRow(row) {
  const id = toId(row?.id);

  if (id === null) {
    return null;
  }

  const owner = row.owner && typeof row.owner === "object" ? row.owner : {};
  const username = toText(owner.username) || null;

  return {
    id,
    name: toText(row.name),
    description: normalizeDescription(row.description),
    muscles: normalizeCustomExerciseMuscles(row.muscle_group_keys),
    equipment: normalizeEquipment(row.equipment),
    weightMode: normalizeWeightMode(row.weight_mode),
    hasVideo: row.has_video === true,
    videoDurationMs: toDurationOrNull(row.video_duration_ms),
    posterUrl: null,
    // The owner is always one of them.
    users: Math.max(1, toCount(row.users)),
    sharedAt: toTimestampOrNull(row.shared_at),
    owner: {
      id: owner.id ? String(owner.id) : null,
      // base#code; somebody without a display name goes by the base, as on
      // their profile.
      displayName: toText(owner.display_name) || (username ? username.split("#")[0] : ""),
      username,
      avatarUrl: null,
      inYourGym: row.owner_in_your_gym === true,
    },
    isMine: row.is_mine === true,
    isAdded: row.is_added === true,
    isSaved: row.is_saved === true,
  };
}

/**
 * The weight distribution: six bars, or null - for anything else, and for
 * fewer than DISTRIBUTION_MIN_SETS sets, which the server already withholds.
 */
export function normalizeWeightBuckets(value) {
  if (!Array.isArray(value) || value.length !== 6) {
    return null;
  }

  const buckets = value.map((bucket) => ({
    from: toNumberOrNull(bucket?.from),
    to: toNumberOrNull(bucket?.to),
    count: toCount(bucket?.count),
  }));
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return total >= DISTRIBUTION_MIN_SETS ? buckets : null;
}

/** The answer of custom_exercise_detail as a CustomExerciseDetail, or null. */
export function mapCustomExerciseDetailRow(row) {
  const summary = mapCustomExerciseSummaryRow(row);

  if (!summary) {
    return null;
  }

  const stats = row.stats && typeof row.stats === "object" ? row.stats : {};
  const viewerHasGym = row.viewer_has_gym === true;
  const hasGymUsers = stats.gym_users !== null && stats.gym_users !== undefined;

  return {
    ...summary,
    steps: normalizeSteps(row.steps),
    videoUrl: null,
    createdAt: toTimestampOrNull(row.created_at),
    ownerGymName: toText(row.owner_gym_name) || null,
    viewerHasGym,
    stats: {
      users: Math.max(1, toCount(stats.users ?? row.users)),
      gymUsers: viewerHasGym && hasGymUsers ? toCount(stats.gym_users) : null,
      typicalSets: toPositiveNumberOrNull(stats.typical_sets),
      typicalReps: toPositiveNumberOrNull(stats.typical_reps),
      typicalWeightKg: toPositiveNumberOrNull(stats.typical_weight_kg),
      setCount: toCount(stats.set_count),
      buckets: normalizeWeightBuckets(stats.buckets),
    },
  };
}

/** A custom row of the phone's Exercise table as a MyCustomExercise, or null. */
export function mapMyCustomExerciseRow(row) {
  // The name exactly as stored: every other table links to it by that text.
  const name = typeof row?.name === "string" ? row.name : "";

  if (!name.trim()) {
    return null;
  }

  return {
    name,
    muscles: normalizeCustomExerciseMuscles(row.custom_muscle_group_keys),
    description: normalizeDescription(row.description),
    steps: normalizeSteps(row.steps),
    equipment: normalizeEquipment(row.equipment),
    weightMode: normalizeWeightMode(row.weight_mode),
    isPublic: toFlag(row.is_public),
    cloudId: toId(row.cloud_custom_exercise_id),
    sourceExerciseId: toId(row.source_exercise_id),
    hasVideo: Boolean(toText(row.video_path)),
    videoDurationMs: toDurationOrNull(row.video_duration_ms),
    posterUrl: null,
    users: null,
  };
}

/* ---------------------------------------------------- the two halves -- */

/**
 * The columns of public.custom_exercise the client writes, from a local custom
 * row - normalised the way the migration checks them. The name goes in with
 * the insert and never after.
 */
export function buildCustomExerciseCloudFields(row) {
  const muscles = normalizeCustomExerciseMuscles(row?.custom_muscle_group_keys);

  return {
    description: normalizeDescription(row?.description),
    muscle_group_keys: { primary: muscles.primary, secondary: muscles.secondary },
    equipment: normalizeEquipment(row?.equipment),
    weight_mode: normalizeWeightMode(row?.weight_mode),
    steps: normalizeSteps(row?.steps),
  };
}

/**
 * A cloud row as the columns of a local custom row. The muscles go the way
 * createCustomExercise stores them - serializeExerciseMuscleSelection, so a
 * row without secondary muscles stays the legacy plain array - and the steps
 * JSON-encoded.
 */
export function buildLocalCustomExerciseFields(cloudRow) {
  return {
    name: toText(cloudRow?.name),
    custom_muscle_group_keys: JSON.stringify(
      serializeExerciseMuscleSelection(cloudRow?.muscle_group_keys)
    ),
    cloud_custom_exercise_id: toId(cloudRow?.id),
    is_public: cloudRow?.is_public === true,
    source_exercise_id: toId(cloudRow?.source_exercise_id),
    description: normalizeDescription(cloudRow?.description),
    steps: JSON.stringify(normalizeSteps(cloudRow?.steps)),
    equipment: normalizeEquipment(cloudRow?.equipment),
    weight_mode: normalizeWeightMode(cloudRow?.weight_mode),
    video_path: toText(cloudRow?.video_path) || null,
    poster_path: toText(cloudRow?.poster_path) || null,
    video_duration_ms: toDurationOrNull(cloudRow?.video_duration_ms),
    cloud_updated_at: toTimestampOrNull(cloudRow?.updated_at),
  };
}

/**
 * Whether the cloud's updated_at is later than the one this phone last saw.
 * Both come from the server in one format; Date.parse compares them when it
 * can (Hermes may not read six fractional digits), the text when it cannot.
 */
export function isNewerCloudTimestamp(cloudValue, localValue) {
  const cloudText = toText(cloudValue);
  const localText = toText(localValue);

  if (!cloudText) {
    return false;
  }

  if (!localText) {
    return true;
  }

  if (cloudText === localText) {
    return false;
  }

  const cloudMs = Date.parse(cloudText);
  const localMs = Date.parse(localText);

  if (Number.isFinite(cloudMs) && Number.isFinite(localMs) && cloudMs !== localMs) {
    return cloudMs > localMs;
  }

  return cloudText > localText;
}

/* ---------------------------------------------------------- the sync plan -- */

function exerciseNameKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

/**
 * What one sync of your custom exercises has to do, from the phone's Exercise
 * rows - all of them, the catalog too, for the names it already uses - and
 * your own rows of public.custom_exercise. Pure, so every case has a test;
 * the service carries the plan out. Nothing in it deletes anything, on either
 * side.
 *
 *   upload   a custom row the cloud does not have: insert it
 *   link     a custom row without a cloud id whose name the cloud already
 *            has - an upload whose answer never arrived - then `then`: push
 *            the phone's edit, or take the cloud's version
 *   push     an edit made here that the cloud does not have. The phone wins
 *            even over a newer cloud row: the edit is the later intent
 *   pull     a clean row whose cloud row changed since this phone last saw it
 *   restore  a cloud row this phone does not have - a reinstall, a new phone,
 *            or a copy added on another one
 *   skip     a cloud row whose name this phone already uses for something
 *            else ("name_taken"), or a second custom row whose name differs
 *            from another only in case ("duplicate_name"): the cloud keeps one
 *            per name
 */
export function planCustomExerciseSync(localRows, cloudRows) {
  const plan = { upload: [], link: [], push: [], pull: [], restore: [], skip: [] };
  const locals = (Array.isArray(localRows) ? localRows : []).filter((row) =>
    exerciseNameKey(row?.name)
  );
  const clouds = (Array.isArray(cloudRows) ? cloudRows : []).filter(
    (row) => toId(row?.id) !== null && exerciseNameKey(row?.name)
  );
  const cloudById = new Map(clouds.map((row) => [toId(row.id), row]));
  const cloudByName = new Map();

  for (const row of clouds) {
    const key = exerciseNameKey(row.name);

    if (!cloudByName.has(key)) {
      cloudByName.set(key, row);
    }
  }

  const claimedCloudIds = new Set();
  const claimedNames = new Set();
  const unlinked = [];

  // The rows that know their cloud row go first, so a link by name below can
  // never take a cloud row one of them already points at.
  for (const row of locals.filter((local) => toFlag(local.is_custom))) {
    const cloudId = toId(row.cloud_custom_exercise_id);
    const cloudRow = cloudId === null ? null : cloudById.get(cloudId);

    // No cloud id, or one the cloud no longer has: found by name below, or
    // uploaded again - never dropped.
    if (!cloudRow || claimedCloudIds.has(cloudId)) {
      unlinked.push(row);
      continue;
    }

    claimedCloudIds.add(cloudId);
    claimedNames.add(exerciseNameKey(row.name));

    if (toFlag(row.custom_needs_upload)) {
      plan.push.push({ name: row.name, cloudId });
    } else if (isNewerCloudTimestamp(cloudRow.updated_at, row.cloud_updated_at)) {
      plan.pull.push({ name: row.name, cloudId, cloudRow });
    }
  }

  for (const row of unlinked) {
    const key = exerciseNameKey(row.name);
    const cloudRow = cloudByName.get(key) ?? null;
    const cloudId = cloudRow ? toId(cloudRow.id) : null;

    if (claimedNames.has(key) || (cloudId !== null && claimedCloudIds.has(cloudId))) {
      plan.skip.push({ name: row.name, cloudId: null, reason: "duplicate_name" });
      continue;
    }

    claimedNames.add(key);

    if (cloudRow) {
      claimedCloudIds.add(cloudId);
      plan.link.push({
        name: row.name,
        cloudId,
        cloudRow,
        then: toFlag(row.custom_needs_upload) ? "push" : "pull",
      });
    } else {
      plan.upload.push({ name: row.name, staleCloudId: toId(row.cloud_custom_exercise_id) });
    }
  }

  const localNames = new Set(locals.map((row) => exerciseNameKey(row.name)));

  for (const cloudRow of clouds) {
    const cloudId = toId(cloudRow.id);

    if (claimedCloudIds.has(cloudId)) {
      continue;
    }

    const key = exerciseNameKey(cloudRow.name);

    if (localNames.has(key)) {
      plan.skip.push({ name: cloudRow.name, cloudId, reason: "name_taken" });
      continue;
    }

    localNames.add(key);
    plan.restore.push({ name: cloudRow.name, cloudId, cloudRow });
  }

  return plan;
}
