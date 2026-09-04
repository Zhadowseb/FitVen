const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const workoutServicePath = path.join(
  rootDir,
  "src",
  "Services",
  "workoutService.js"
);
const resistancePagePath = path.join(
  rootDir,
  "src",
  "Pages",
  "WorkoutPage",
  "WorkoutTypes",
  "Resistance",
  "Resistance.js"
);

const workoutServiceSource = fs.readFileSync(workoutServicePath, "utf8");
const resistancePageSource = fs.readFileSync(resistancePagePath, "utf8");

const finishWorkoutStart = workoutServiceSource.indexOf(
  "export async function finishWorkout"
);
const finishWorkoutEnd = workoutServiceSource.indexOf(
  "const WORKOUT_SUMMARY_REPOST_SKIP_MESSAGES",
  finishWorkoutStart
);
const finishWorkoutSource = workoutServiceSource.slice(
  finishWorkoutStart,
  finishWorkoutEnd
);

assert.ok(finishWorkoutStart >= 0, "finishWorkout should be available to workout screens");
assert.ok(finishWorkoutEnd > finishWorkoutStart, "finishWorkout should have a complete body");
assert.match(finishWorkoutSource, /await withTransaction\(db/);
assert.match(finishWorkoutSource, /persistWorkoutTimerState\(db, \{[\s\S]*timerStart: null/);
assert.match(finishWorkoutSource, /updateWorkoutDone\(db, \{[\s\S]*done: true/);
assert.match(finishWorkoutSource, /refreshWorkoutHierarchyCompletion\(db, workoutId\)/);
assert.match(
  resistancePageSource,
  /await workoutService\.finishWorkout\(db, \{[\s\S]*workoutId: workout_id,[\s\S]*elapsedTime: finalElapsed/
);

console.log("Strength workout finish completion checks passed.");
