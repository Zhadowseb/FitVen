const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const utilsPath = path.join(rootDir, "src", "Utils", "runIntervalUtils.js");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(utilsPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const {
    getActualPaceMinutesPerKm,
    getDistanceIntervalProgress,
    getRunSetCompletionMode,
    getRunSetRecordedDurationSeconds,
  } = await import(moduleUrl);

  assert.strictEqual(getRunSetCompletionMode({ time: 1, distance: 0.4 }), "time");
  assert.strictEqual(
    getRunSetCompletionMode({
      time: 1,
      distance: 0.4,
      completion_target: "distance",
    }),
    "distance"
  );
  assert.strictEqual(
    getRunSetCompletionMode({
      time: 1,
      distance: 0.4,
      completion_target: "time",
    }),
    "time"
  );
  assert.strictEqual(
    getRunSetCompletionMode({
      time: null,
      distance: 0.4,
      completion_target: "time",
    }),
    "distance"
  );
  assert.strictEqual(getRunSetCompletionMode({ time: null, distance: 0.4 }), "distance");
  assert.strictEqual(getRunSetCompletionMode({ time: null, distance: null }), "manual");
  assert.strictEqual(
    getRunSetRecordedDurationSeconds({ time: 1, actual_duration_seconds: 71 }),
    71
  );
  assert.strictEqual(getRunSetRecordedDurationSeconds({ time: 1 }), 60);

  const inProgress = getDistanceIntervalProgress({
    targetDistanceKm: 0.4,
    completedDistanceKm: 0.275,
  });
  assert.strictEqual(inProgress.isComplete, false);
  assert.ok(Math.abs(inProgress.remainingKm - 0.125) < 0.000001);

  const completed = getDistanceIntervalProgress({
    targetDistanceKm: 0.4,
    completedDistanceKm: 0.403,
  });
  assert.strictEqual(completed.isComplete, true);
  assert.strictEqual(
    getActualPaceMinutesPerKm({ durationSeconds: 100, distanceKm: 0.4 }),
    100 / 60 / 0.4
  );

  console.log("Run interval progression checks passed.");
}
