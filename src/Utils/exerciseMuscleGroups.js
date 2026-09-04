export const EXERCISE_MUSCLE_GROUPS = [
  {
    key: "chest",
    label: "Chest",
    trainingGroupKey: "push",
    regions: [{ key: "pecs", view: "front", section: "upper" }],
  },
  {
    key: "shoulders",
    label: "Shoulders",
    trainingGroupKey: "push",
    regions: [
      { key: "front_delts", view: "front", section: "upper" },
      { key: "side_delts", view: "front", section: "upper" },
      { key: "side_delts", view: "back", section: "upper" },
      { key: "rear_delts", view: "back", section: "upper" },
    ],
  },
  {
    key: "rotator-cuff",
    label: "Rotator cuff",
    trainingGroupKey: "pull",
    regions: [
      { key: "infraspinatus", view: "back", section: "upper" },
      { key: "teres_major", view: "back", section: "upper" },
      { key: "teres_minor", view: "back", section: "upper" },
    ],
  },
  {
    key: "lats",
    label: "Lats",
    trainingGroupKey: "pull",
    regions: [{ key: "lats", view: "back", section: "upper" }],
  },
  {
    key: "traps",
    label: "Traps",
    trainingGroupKey: "pull",
    regions: [{ key: "upper_traps", view: "back", section: "upper" }],
  },
  {
    key: "biceps",
    label: "Biceps",
    trainingGroupKey: "pull",
    regions: [{ key: "biceps", view: "front", section: "upper" }],
  },
  {
    key: "triceps",
    label: "Triceps",
    trainingGroupKey: "push",
    regions: [{ key: "triceps", view: "back", section: "upper" }],
  },
  {
    key: "forearms",
    label: "Forearms",
    trainingGroupKey: "pull",
    regions: [{ key: "forearms", view: "front", section: "upper" }],
  },
  {
    key: "abs",
    label: "Abs",
    trainingGroupKey: "core",
    regions: [{ key: "abs", view: "front", section: "upper" }],
  },
  {
    key: "obliques",
    label: "Obliques",
    trainingGroupKey: "core",
    regions: [{ key: "obliques", view: "front", section: "upper" }],
  },
  {
    key: "glutes",
    label: "Glutes",
    trainingGroupKey: "legs",
    regions: [{ key: "glutes", view: "back", section: "lower" }],
  },
  {
    key: "quads",
    label: "Quads",
    trainingGroupKey: "legs",
    regions: [{ key: "quads", view: "front", section: "lower" }],
  },
  {
    key: "hamstrings",
    label: "Hamstrings",
    trainingGroupKey: "legs",
    regions: [{ key: "hamstrings", view: "back", section: "lower" }],
  },
  {
    key: "calves",
    label: "Calves",
    trainingGroupKey: "legs",
    regions: [{ key: "calves", view: "back", section: "lower" }],
  },
  {
    key: "adductors",
    label: "Adductors",
    trainingGroupKey: "legs",
    regions: [
      { key: "adductors", view: "front", section: "lower" },
      { key: "adductors", view: "back", section: "lower" },
    ],
  },
  {
    key: "lower-back",
    label: "Lower back",
    trainingGroupKey: "core",
    regions: [{ key: "lower_back", view: "back", section: "upper" }],
  },
];

export const EXERCISE_MUSCLE_FILTERS = [
  { key: "all", label: "All muscles", regionKeys: [] },
  ...EXERCISE_MUSCLE_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    regionKeys: [...new Set(group.regions.map((region) => region.key))],
  })),
];

const MUSCLE_GROUP_BY_KEY = new Map(
  EXERCISE_MUSCLE_GROUPS.map((group) => [group.key, group])
);

const TRAINING_GROUP_LABELS = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
};

function normalizeMuscleGroupKeyList(value) {
  const normalizedKeys = [];
  const seenKeys = new Set();

  for (const rawKey of Array.isArray(value) ? value : []) {
    const key = typeof rawKey === "string" ? rawKey.trim().toLowerCase() : "";

    if (!MUSCLE_GROUP_BY_KEY.has(key) || seenKeys.has(key)) {
      continue;
    }

    normalizedKeys.push(key);
    seenKeys.add(key);
  }

  return normalizedKeys;
}

// Stored selections come in two shapes: a plain array (legacy — every key is
// primary) or { primary: [], secondary: [] }. Both may arrive JSON-encoded.
function parseMuscleSelection(value) {
  if (Array.isArray(value)) {
    return { primary: value, secondary: [] };
  }

  if (value && typeof value === "object") {
    return {
      primary: Array.isArray(value.primary) ? value.primary : [],
      secondary: Array.isArray(value.secondary) ? value.secondary : [],
    };
  }

  if (typeof value !== "string" || value.trim() === "") {
    return { primary: [], secondary: [] };
  }

  try {
    return parseMuscleSelection(JSON.parse(value));
  } catch {
    return { primary: [], secondary: [] };
  }
}

export function normalizeExerciseMuscleSelection(value) {
  const parsed = parseMuscleSelection(value);
  const primaryKeys = normalizeMuscleGroupKeyList(parsed.primary);
  const primaryKeySet = new Set(primaryKeys);
  const secondaryKeys = normalizeMuscleGroupKeyList(parsed.secondary).filter(
    (key) => !primaryKeySet.has(key)
  );

  return { primaryKeys, secondaryKeys };
}

// Canonical storable value: keep the legacy plain-array shape whenever there
// are no secondaries so existing rows/consumers stay byte-compatible.
export function serializeExerciseMuscleSelection(value) {
  const { primaryKeys, secondaryKeys } = normalizeExerciseMuscleSelection(value);

  return secondaryKeys.length > 0
    ? { primary: primaryKeys, secondary: secondaryKeys }
    : primaryKeys;
}

// Every involved muscle group regardless of role (primary first).
export function normalizeExerciseMuscleGroupKeys(value) {
  const { primaryKeys, secondaryKeys } = normalizeExerciseMuscleSelection(value);

  return [...primaryKeys, ...secondaryKeys];
}

export function toggleExerciseMuscleFilterKey(selectedKeys, filterKey) {
  if (filterKey === "all") {
    return ["all"];
  }

  const activeKeys = Array.isArray(selectedKeys)
    ? selectedKeys.filter((key) => key !== "all")
    : [];
  const nextKeys = activeKeys.includes(filterKey)
    ? activeKeys.filter((key) => key !== filterKey)
    : [...activeKeys, filterKey];

  return nextKeys.length > 0 ? nextKeys : ["all"];
}

function getUniqueRegionKeysForView(regions, view) {
  return [
    ...new Set(
      regions
        .filter((region) => region.view === view)
        .map((region) => region.key)
    ),
  ];
}

export function buildCustomExerciseMuscleMetadata(value) {
  const { primaryKeys, secondaryKeys } = normalizeExerciseMuscleSelection(value);
  const primaryGroups = primaryKeys.map((key) => MUSCLE_GROUP_BY_KEY.get(key));
  const secondaryGroups = secondaryKeys.map((key) =>
    MUSCLE_GROUP_BY_KEY.get(key)
  );
  const primaryRegions = primaryGroups.flatMap((group) => group.regions);
  const secondaryRegions = secondaryGroups.flatMap((group) => group.regions);
  const allRegions = [...primaryRegions, ...secondaryRegions];

  const primaryFrontRegionKeys = getUniqueRegionKeysForView(
    primaryRegions,
    "front"
  );
  const primaryBackRegionKeys = getUniqueRegionKeysForView(
    primaryRegions,
    "back"
  );
  // A region highlighted as primary must not also render as secondary.
  const secondaryFrontRegionKeys = getUniqueRegionKeysForView(
    secondaryRegions,
    "front"
  ).filter((key) => !primaryFrontRegionKeys.includes(key));
  const secondaryBackRegionKeys = getUniqueRegionKeysForView(
    secondaryRegions,
    "back"
  ).filter((key) => !primaryBackRegionKeys.includes(key));

  const frontRegionCount =
    primaryFrontRegionKeys.length + secondaryFrontRegionKeys.length;
  const backRegionCount =
    primaryBackRegionKeys.length + secondaryBackRegionKeys.length;
  const upperRegionCount = allRegions.filter(
    (region) => region.section === "upper"
  ).length;
  const lowerRegionCount = allRegions.filter(
    (region) => region.section === "lower"
  ).length;
  const bodyMapView = backRegionCount > frontRegionCount ? "back" : "front";
  const bodyMapSection =
    lowerRegionCount > upperRegionCount ? "lower" : "upper";
  // Primary groups first so primary_group_key reflects the primary muscles.
  const groupKeys = [
    ...new Set(
      [...primaryGroups, ...secondaryGroups].map(
        (group) => group.trainingGroupKey
      )
    ),
  ];

  return {
    custom_muscle_group_keys: serializeExerciseMuscleSelection({
      primary: primaryKeys,
      secondary: secondaryKeys,
    }),
    primary_muscle_count: primaryKeys.length,
    secondary_muscle_count: secondaryKeys.length,
    primary_group_key: groupKeys[0] ?? null,
    primary_group_name: TRAINING_GROUP_LABELS[groupKeys[0]] ?? null,
    group_keys: groupKeys,
    group_names: groupKeys.map((key) => TRAINING_GROUP_LABELS[key]),
    body_map_view: bodyMapView,
    body_map_section: bodyMapSection,
    primary_body_map_region_keys:
      bodyMapView === "back" ? primaryBackRegionKeys : primaryFrontRegionKeys,
    secondary_body_map_region_keys:
      bodyMapView === "back"
        ? secondaryBackRegionKeys
        : secondaryFrontRegionKeys,
    primary_front_body_map_region_keys: primaryFrontRegionKeys,
    secondary_front_body_map_region_keys: secondaryFrontRegionKeys,
    primary_back_body_map_region_keys: primaryBackRegionKeys,
    secondary_back_body_map_region_keys: secondaryBackRegionKeys,
  };
}
