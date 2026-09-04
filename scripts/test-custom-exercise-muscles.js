const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const muscleGroupsPath = path.join(
  rootDir,
  "src",
  "Utils",
  "exerciseMuscleGroups.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(muscleGroupsPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const {
    buildCustomExerciseMuscleMetadata,
    EXERCISE_MUSCLE_FILTERS,
    normalizeExerciseMuscleGroupKeys,
    normalizeExerciseMuscleSelection,
    serializeExerciseMuscleSelection,
    toggleExerciseMuscleFilterKey,
  } = await import(moduleUrl);

  assert.deepStrictEqual(
    normalizeExerciseMuscleGroupKeys(
      JSON.stringify(["quads", "quads", "invalid", "hamstrings"])
    ),
    ["quads", "hamstrings"]
  );
  assert.deepStrictEqual(normalizeExerciseMuscleGroupKeys("not-json"), []);

  // Legacy plain arrays are all-primary selections.
  assert.deepStrictEqual(normalizeExerciseMuscleSelection(["chest", "abs"]), {
    primaryKeys: ["chest", "abs"],
    secondaryKeys: [],
  });
  // Object selections keep roles; primary wins on overlap, invalids drop.
  assert.deepStrictEqual(
    normalizeExerciseMuscleSelection(
      JSON.stringify({
        primary: ["chest", "invalid"],
        secondary: ["chest", "triceps"],
      })
    ),
    { primaryKeys: ["chest"], secondaryKeys: ["triceps"] }
  );
  // Combined key list puts primaries first.
  assert.deepStrictEqual(
    normalizeExerciseMuscleGroupKeys({
      primary: ["chest"],
      secondary: ["triceps"],
    }),
    ["chest", "triceps"]
  );
  // Serialization stays a plain array without secondaries (legacy compat).
  assert.deepStrictEqual(
    serializeExerciseMuscleSelection({ primary: ["chest"], secondary: [] }),
    ["chest"]
  );
  assert.deepStrictEqual(
    serializeExerciseMuscleSelection({
      primary: ["chest"],
      secondary: ["triceps"],
    }),
    { primary: ["chest"], secondary: ["triceps"] }
  );

  const shoulderAndHamstringMetadata = buildCustomExerciseMuscleMetadata([
    "shoulders",
    "hamstrings",
  ]);

  assert.strictEqual(shoulderAndHamstringMetadata.primary_muscle_count, 2);
  assert.strictEqual(shoulderAndHamstringMetadata.secondary_muscle_count, 0);
  assert.deepStrictEqual(shoulderAndHamstringMetadata.group_keys, [
    "push",
    "legs",
  ]);
  assert.deepStrictEqual(
    shoulderAndHamstringMetadata.primary_front_body_map_region_keys,
    ["front_delts", "side_delts"]
  );
  assert.deepStrictEqual(
    shoulderAndHamstringMetadata.primary_back_body_map_region_keys,
    ["side_delts", "rear_delts", "hamstrings"]
  );

  // Secondary muscles land in the secondary metadata fields.
  const benchLikeMetadata = buildCustomExerciseMuscleMetadata({
    primary: ["chest"],
    secondary: ["triceps", "shoulders"],
  });

  assert.strictEqual(benchLikeMetadata.primary_muscle_count, 1);
  assert.strictEqual(benchLikeMetadata.secondary_muscle_count, 2);
  assert.deepStrictEqual(
    benchLikeMetadata.custom_muscle_group_keys,
    { primary: ["chest"], secondary: ["triceps", "shoulders"] }
  );
  assert.strictEqual(benchLikeMetadata.primary_group_key, "push");
  assert.deepStrictEqual(
    benchLikeMetadata.primary_front_body_map_region_keys,
    ["pecs"]
  );
  assert.deepStrictEqual(
    benchLikeMetadata.secondary_front_body_map_region_keys,
    ["front_delts", "side_delts"]
  );
  assert.deepStrictEqual(benchLikeMetadata.primary_back_body_map_region_keys, []);
  assert.deepStrictEqual(
    benchLikeMetadata.secondary_back_body_map_region_keys,
    ["triceps", "side_delts", "rear_delts"]
  );

  // The rotator cuff group exposes the previously unused back regions.
  const rotatorCuffMetadata = buildCustomExerciseMuscleMetadata([
    "rotator-cuff",
  ]);

  assert.strictEqual(rotatorCuffMetadata.body_map_view, "back");
  assert.deepStrictEqual(
    rotatorCuffMetadata.primary_back_body_map_region_keys,
    ["infraspinatus", "teres_major", "teres_minor"]
  );

  const legMetadata = buildCustomExerciseMuscleMetadata(["quads", "calves"]);

  assert.strictEqual(legMetadata.body_map_section, "lower");
  assert.deepStrictEqual(legMetadata.group_keys, ["legs"]);
  assert.deepStrictEqual(legMetadata.primary_front_body_map_region_keys, [
    "quads",
  ]);
  assert.deepStrictEqual(legMetadata.primary_back_body_map_region_keys, [
    "calves",
  ]);

  const shoulderFilter = EXERCISE_MUSCLE_FILTERS.find(
    (filter) => filter.key === "shoulders"
  );
  assert.deepStrictEqual(shoulderFilter.regionKeys, [
    "front_delts",
    "side_delts",
    "rear_delts",
  ]);

  const rotatorCuffFilter = EXERCISE_MUSCLE_FILTERS.find(
    (filter) => filter.key === "rotator-cuff"
  );
  assert.deepStrictEqual(rotatorCuffFilter.regionKeys, [
    "infraspinatus",
    "teres_major",
    "teres_minor",
  ]);

  assert.deepStrictEqual(toggleExerciseMuscleFilterKey(["quads"], "quads"), [
    "all",
  ]);
  assert.deepStrictEqual(
    toggleExerciseMuscleFilterKey(["quads", "calves"], "quads"),
    ["calves"]
  );
  assert.deepStrictEqual(toggleExerciseMuscleFilterKey(["all"], "quads"), [
    "quads",
  ]);
  assert.deepStrictEqual(toggleExerciseMuscleFilterKey(["quads"], "all"), [
    "all",
  ]);

  console.log("Custom exercise muscle metadata checks passed.");
}
