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
    toggleExerciseMuscleFilterKey,
  } = await import(moduleUrl);

  assert.deepStrictEqual(
    normalizeExerciseMuscleGroupKeys(
      JSON.stringify(["quads", "quads", "invalid", "hamstrings"])
    ),
    ["quads", "hamstrings"]
  );
  assert.deepStrictEqual(normalizeExerciseMuscleGroupKeys("not-json"), []);

  const shoulderAndHamstringMetadata = buildCustomExerciseMuscleMetadata([
    "shoulders",
    "hamstrings",
  ]);

  assert.strictEqual(shoulderAndHamstringMetadata.primary_muscle_count, 2);
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
    ["rear_delts", "hamstrings"]
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
