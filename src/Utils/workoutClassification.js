export const WORKOUT_CLASSIFICATION_LABELS = [
  "Push",
  "Pull",
  "Legs",
  "Core",
  "Mobility",
  "Upperbody",
  "Lowerbody",
];

export const PRIMARY_MUSCLE_WEIGHT = 2;
export const SECONDARY_MUSCLE_WEIGHT = 1;

const MOVEMENT_LABELS = ["Push", "Pull", "Legs", "Core", "Mobility"];
const REGION_LABELS = ["Upperbody", "Lowerbody"];
const LABEL_PRIORITY = [...MOVEMENT_LABELS, ...REGION_LABELS];
const AUTO_ASSIGNABLE_LEGACY_LABELS = [
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Legs",
];

const DIRECT_LABEL_BY_KEY = new Map(
  WORKOUT_CLASSIFICATION_LABELS.map((label) => [
    normalizeClassificationKey(label),
    label,
  ])
);

const GROUP_CATEGORY_MAP = {
  chest: ["Push", "Upperbody"],
  shoulders: ["Push", "Upperbody"],
  triceps: ["Push", "Upperbody"],
  lats: ["Pull", "Upperbody"],
  traps: ["Pull", "Upperbody"],
  biceps: ["Pull", "Upperbody"],
  forearms: ["Pull", "Upperbody"],
  glutes: ["Legs", "Lowerbody"],
  quads: ["Legs", "Lowerbody"],
  hamstrings: ["Legs", "Lowerbody"],
  calves: ["Legs", "Lowerbody"],
  adductors: ["Legs", "Lowerbody"],
  abs: ["Core"],
  obliques: ["Core"],
  "lower-back": ["Core", "Lowerbody"],
  lower_back: ["Core", "Lowerbody"],
  mobility: ["Mobility"],
};

function normalizeClassificationKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "";
}

function normalizeLabelKey(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function getCategoriesForGroupKey(groupKey) {
  const normalizedKey = normalizeClassificationKey(groupKey);

  if (!normalizedKey) {
    return [];
  }

  if (GROUP_CATEGORY_MAP[normalizedKey]) {
    return GROUP_CATEGORY_MAP[normalizedKey];
  }

  const directLabel = DIRECT_LABEL_BY_KEY.get(normalizedKey);
  return directLabel ? [directLabel] : [];
}

function getPlannedSetCount(value) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function addScore(scores, groupKeys, muscleWeight, setMultiplier) {
  const seenKeys = new Set();
  let didScore = false;

  for (const groupKey of groupKeys ?? []) {
    const normalizedKey = normalizeClassificationKey(groupKey);

    if (!normalizedKey || seenKeys.has(normalizedKey)) {
      continue;
    }

    seenKeys.add(normalizedKey);

    for (const label of getCategoriesForGroupKey(normalizedKey)) {
      scores[label] += muscleWeight * setMultiplier;
      didScore = true;
    }
  }

  return didScore;
}

function getHighestLabelByPriority(scores, labels) {
  let selectedLabel = null;
  let selectedScore = 0;

  for (const label of labels) {
    const score = scores[label] ?? 0;

    if (score > selectedScore) {
      selectedLabel = label;
      selectedScore = score;
    }
  }

  return {
    label: selectedLabel,
    score: selectedScore,
  };
}

export function isAutoWorkoutClassificationLabel(label) {
  const normalizedLabel = normalizeLabelKey(label);
  return WORKOUT_CLASSIFICATION_LABELS.some(
    (autoLabel) => normalizeLabelKey(autoLabel) === normalizedLabel
  );
}

export function isWorkoutLabelAutoAssignable({ label, workoutType } = {}) {
  if (label === null || label === undefined) {
    return true;
  }

  const normalizedLabel = normalizeLabelKey(label);

  if (!normalizedLabel) {
    return true;
  }

  if (normalizedLabel === normalizeLabelKey(workoutType)) {
    return true;
  }

  if (
    AUTO_ASSIGNABLE_LEGACY_LABELS.some(
      (legacyLabel) => normalizeLabelKey(legacyLabel) === normalizedLabel
    )
  ) {
    return true;
  }

  return isAutoWorkoutClassificationLabel(label);
}

export function classifyWorkoutFromMuscleGroups(exercises = []) {
  const scores = WORKOUT_CLASSIFICATION_LABELS.reduce(
    (accumulator, label) => ({
      ...accumulator,
      [label]: 0,
    }),
    {}
  );
  let didFindMetadata = false;

  for (const exercise of exercises ?? []) {
    const setMultiplier = getPlannedSetCount(exercise?.plannedSetCount);

    didFindMetadata =
      addScore(
        scores,
        exercise?.primaryGroupKeys,
        PRIMARY_MUSCLE_WEIGHT,
        setMultiplier
      ) || didFindMetadata;
    didFindMetadata =
      addScore(
        scores,
        exercise?.secondaryGroupKeys,
        SECONDARY_MUSCLE_WEIGHT,
        setMultiplier
      ) || didFindMetadata;
  }

  if (!didFindMetadata) {
    return {
      label: null,
      scores,
      skippedReason: "missing_metadata",
    };
  }

  const bestMovement = getHighestLabelByPriority(scores, MOVEMENT_LABELS);
  const bestRegion = getHighestLabelByPriority(scores, REGION_LABELS);
  const bestScore = Math.max(bestMovement.score, bestRegion.score);

  if (bestScore <= 0) {
    return {
      label: null,
      scores,
      skippedReason: "missing_metadata",
    };
  }

  if (bestRegion.score > bestMovement.score) {
    return {
      label: bestRegion.label,
      scores,
    };
  }

  const tiedLabels = LABEL_PRIORITY.filter((label) => scores[label] === bestScore);

  return {
    label: tiedLabels[0] ?? bestMovement.label ?? bestRegion.label,
    scores,
  };
}
