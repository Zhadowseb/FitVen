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
      { key: "rear_delts", view: "back", section: "upper" },
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
    regions: [{ key: "adductors", view: "front", section: "lower" }],
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
    regionKeys: group.regions.map((region) => region.key),
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

function parseMuscleGroupKeys(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function normalizeExerciseMuscleGroupKeys(value) {
  const normalizedKeys = [];
  const seenKeys = new Set();

  for (const rawKey of parseMuscleGroupKeys(value)) {
    const key = typeof rawKey === "string" ? rawKey.trim().toLowerCase() : "";

    if (!MUSCLE_GROUP_BY_KEY.has(key) || seenKeys.has(key)) {
      continue;
    }

    normalizedKeys.push(key);
    seenKeys.add(key);
  }

  return normalizedKeys;
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

export function buildCustomExerciseMuscleMetadata(value) {
  const muscleGroupKeys = normalizeExerciseMuscleGroupKeys(value);
  const selectedGroups = muscleGroupKeys.map((key) => MUSCLE_GROUP_BY_KEY.get(key));
  const regions = selectedGroups.flatMap((group) => group.regions);
  const frontRegionKeys = [
    ...new Set(
      regions
        .filter((region) => region.view === "front")
        .map((region) => region.key)
    ),
  ];
  const backRegionKeys = [
    ...new Set(
      regions
        .filter((region) => region.view === "back")
        .map((region) => region.key)
    ),
  ];
  const upperRegionCount = regions.filter(
    (region) => region.section === "upper"
  ).length;
  const lowerRegionCount = regions.filter(
    (region) => region.section === "lower"
  ).length;
  const bodyMapView =
    backRegionKeys.length > frontRegionKeys.length ? "back" : "front";
  const bodyMapSection =
    lowerRegionCount > upperRegionCount ? "lower" : "upper";
  const groupKeys = [
    ...new Set(selectedGroups.map((group) => group.trainingGroupKey)),
  ];

  return {
    custom_muscle_group_keys: muscleGroupKeys,
    primary_muscle_count: muscleGroupKeys.length,
    secondary_muscle_count: 0,
    primary_group_key: groupKeys[0] ?? null,
    primary_group_name: TRAINING_GROUP_LABELS[groupKeys[0]] ?? null,
    group_keys: groupKeys,
    group_names: groupKeys.map((key) => TRAINING_GROUP_LABELS[key]),
    body_map_view: bodyMapView,
    body_map_section: bodyMapSection,
    primary_body_map_region_keys:
      bodyMapView === "back" ? backRegionKeys : frontRegionKeys,
    secondary_body_map_region_keys: [],
    primary_front_body_map_region_keys: frontRegionKeys,
    secondary_front_body_map_region_keys: [],
    primary_back_body_map_region_keys: backRegionKeys,
    secondary_back_body_map_region_keys: [],
  };
}
