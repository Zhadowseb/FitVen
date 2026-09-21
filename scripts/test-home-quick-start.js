// The two pieces of reasoning behind the new Home, and the wiring that would
// otherwise only fail on a phone.
//
// The split guess and the muscle deltas are pure functions over rows, which is
// why they were written as utils rather than inside the service - everything
// here drives the real code, not a copy of it.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const splitGuess = loadAppModule("src/Utils/splitGuess.js");
const muscleGlance = loadAppModule("src/Utils/muscleGlance.js");

const DAY_MS = 86400000;

/* ---------------------------------------------------- reading the split -- */

// A Tuesday, so the weekday arithmetic below is checkable by hand.
const now = new Date(2026, 8, 22, 12, 0, 0).getTime();
const workout = (id, name, daysAgo, exercises) => ({
  workoutId: id,
  name,
  at: now - daysAgo * DAY_MS,
  exerciseIds: exercises,
  exerciseCount: exercises.length,
  setCount: exercises.length * 3,
});

const upper = ["bench press", "row", "overhead press", "curl"];
const lower = ["squat", "deadlift", "leg curl"];

const twoDay = splitGuess.guessSplitGroups(
  [
    workout(10, "Upper", 2, upper),
    workout(9, "Lower", 4, lower),
    workout(8, "Upper", 9, upper),
    workout(7, "Lower", 11, lower),
    workout(6, "Upper 2", 16, upper),
    workout(5, "Lower", 18, lower),
  ],
  { now }
);

assert.strictEqual(twoDay.length, 2, "two sessions on a loop is a two-day split");
assert.deepStrictEqual(
  twoDay.map((group) => group.name).sort(),
  ["Lower", "Upper"],
  "a group is named after the spelling its owner used most"
);

const upNext = twoDay.find((group) => group.isUpNext);

assert.strictEqual(upNext.name, "Lower", "whose turn it is is who has waited longest");
assert.strictEqual(
  twoDay.filter((group) => group.isUpNext).length,
  1,
  "exactly one session is next"
);

// The quick-start button and the highlighted card have to be the same session,
// or the screen contradicts itself.
assert.strictEqual(
  upNext.lastWorkoutId,
  10 - 1,
  "the session that is due points at its own latest occurrence"
);

assert.strictEqual(
  twoDay.find((group) => group.name === "Upper").exerciseCount,
  upper.length,
  "the exercise count comes from the latest occurrence, not an average"
);

// Three occurrences is the floor: twice is a coincidence.
assert.deepStrictEqual(
  splitGuess.guessSplitGroups(
    [
      workout(4, "Upper", 2, upper),
      workout(3, "Lower", 4, lower),
      workout(2, "Upper", 9, upper),
      workout(1, "Lower", 11, lower),
    ],
    { now }
  ),
  [],
  "twice each is not a split"
);

// One session on repeat is not a split either - there is nothing to be next.
assert.deepStrictEqual(
  splitGuess.guessSplitGroups(
    [
      workout(3, "Full body", 2, upper),
      workout(2, "Full body", 5, upper),
      workout(1, "Full body", 8, upper),
    ],
    { now }
  ),
  [],
  "one repeated session is not a split"
);

// Renaming between sessions must not split a group in two: the exercises are
// the same, and that is what the overlap rule is for.
const renamed = splitGuess.guessSplitGroups(
  [
    workout(6, "Push day", 2, upper),
    workout(5, "Lower", 4, lower),
    workout(4, "Overkrop", 9, upper),
    workout(3, "Lower", 11, lower),
    workout(2, "Upper", 16, upper),
    workout(1, "Lower", 18, lower),
  ],
  { now }
);

assert.strictEqual(
  renamed.length,
  2,
  "three names for the same exercises is still one session"
);

/* ------------------------------------------------------------- weekdays -- */

// Every Upper landed on a Sunday, every Lower on a Friday.
assert.deepStrictEqual(
  twoDay.find((group) => group.name === "Upper").weekdays,
  [0],
  "a weekday shows when at least half the group lands on it"
);

// Scattered days qualify for nothing, and the line is left out rather than
// listing every day of the week.
const scattered = splitGuess.guessSplitGroups(
  [
    workout(6, "Upper", 1, upper),
    workout(5, "Lower", 4, lower),
    workout(4, "Upper", 8, upper),
    workout(3, "Lower", 12, lower),
    workout(2, "Upper", 17, upper),
    workout(1, "Lower", 21, lower),
  ],
  { now }
);

assert.ok(
  scattered.every((group) => group.weekdays.length <= 1),
  "training on a different day each week settles on at most one weekday"
);

/* ------------------------------------------------------- names and sets -- */

assert.strictEqual(splitGuess.normalizeSplitName(" Push A 2 "), "push a");
assert.strictEqual(
  splitGuess.normalizeSplitName("push a (2026-01-04)"),
  "push a",
  "a date in brackets is how people number repeats, not how they name sessions"
);
assert.strictEqual(
  splitGuess.normalizeSplitName("Push-Pull"),
  "push-pull",
  "a hyphen is part of a name somebody chose"
);

assert.strictEqual(splitGuess.exerciseOverlap(["a", "b", "c", "d"], ["a", "b", "c", "e"]), 0.6);
assert.strictEqual(splitGuess.exerciseOverlap([], ["a"]), 0, "nothing overlaps with nothing");

/* ------------------------------------------------------- last month -- */

const set = (name, weight, reps, daysAgo) => ({
  name,
  weight,
  reps,
  at: now - daysAgo * DAY_MS,
});

const groupsByExercise = new Map([
  ["bench press", ["Chest"]],
  ["row", ["Back"]],
  ["curl", ["Biceps"]],
]);

const deltas = muscleGlance.buildMuscleGroupDeltas(
  [
    set("bench press", 100, 5, 5),
    set("bench press", 100, 5, 6),
    set("bench press", 100, 5, 7),
    set("bench press", 90, 5, 40),
    set("bench press", 90, 5, 41),
    set("bench press", 90, 5, 42),
    set("row", 80, 5, 5),
    set("row", 80, 5, 6),
    set("row", 80, 5, 7),
    set("row", 85, 5, 40),
    set("row", 85, 5, 41),
    set("row", 85, 5, 42),
    set("curl", 20, 10, 5),
  ],
  { groupsByExercise, now }
);

const chest = deltas.find((entry) => entry.label === "Chest");
const back = deltas.find((entry) => entry.label === "Back");
const biceps = deltas.find((entry) => entry.label === "Biceps");

assert.ok(chest.deltaPercent > 0, "a heavier month is a gain");
assert.strictEqual(chest.fill, 1, "the best group fills its track");
assert.strictEqual(chest.isGain, true);

// Going backwards reads as flat. Home is not where somebody is told they have
// lost ground - that needs a screen with room to explain why.
assert.strictEqual(back.deltaPercent, 0, "a lighter month is zero, never negative");
assert.strictEqual(back.isGain, false);

assert.strictEqual(biceps.deltaPercent, null, "too few sets is no answer, not zero");
assert.strictEqual(
  biceps.fill,
  muscleGlance.MUSCLE_GLANCE_EMPTY_FILL,
  "a column with no answer is still drawn, or the row looks broken"
);

assert.strictEqual(muscleGlance.pickMuscleGlanceHeadline(deltas), "Chest");
assert.strictEqual(
  muscleGlance.pickMuscleGlanceHeadline([back, biceps]),
  null,
  "no gain anywhere has no headline"
);

// The mapping lives in the synced exercise catalog. Without it the block says
// nothing rather than implying nobody trained.
assert.deepStrictEqual(
  muscleGlance.buildMuscleGroupDeltas([set("bench press", 100, 5, 5)], {
    groupsByExercise: new Map(),
    now,
  }),
  [],
  "no muscle mapping, no block"
);

assert.ok(
  muscleGlance.buildMuscleGroupDeltas(
    [...Array(40)].map((_, index) =>
      set(`exercise ${index}`, 100, 5, index % 2 ? 5 : 40)
    ),
    {
      groupsByExercise: new Map(
        [...Array(40)].map((_, index) => [`exercise ${index}`, [`Group ${index}`]])
      ),
      now,
    }
  ).length <= muscleGlance.MUSCLE_GLANCE_MAX_GROUPS,
  "five groups is what fits across the screen"
);

/* ------------------------------------------------------------- wiring -- */

// Home reads the sets through the same function Records does. Two screens
// disagreeing about whether somebody's chest went up is worse than one of them
// staying quiet.
const weightliftingSource = fs.readFileSync(
  path.join(root, "src", "Services", "weightliftingService.js"),
  "utf8"
);

assert.ok(
  /export async function getMuscleGroupDeltas[\s\S]*?getRecordsSourceData\(db\)/.test(
    weightliftingSource
  ),
  "Home stopped reading the muscle groups through the same source as Records"
);

// One formula in the app. The design document asked for Epley "the same as
// Records"; Records is Brzycki, and recordsInsights.js already carries a
// comment about a design that made this mistake once before.
const glanceSource = fs.readFileSync(path.join(root, "src", "Utils", "muscleGlance.js"), "utf8");

assert.ok(
  /calculateBrzyckiOneRepMax/.test(glanceSource) && !/Epley\(/.test(glanceSource),
  "Home is estimating one-rep maxes with a second formula"
);

// Profile is not a tab any more, so the avatar is the only way in from Home.
const headerSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "GreetingHeader", "GreetingHeader.js"),
  "utf8"
);

assert.ok(
  /onOpenProfile/.test(headerSource) && /UserAvatar/.test(headerSource),
  "the header lost the avatar, and with it the way to the profile"
);

const navSource = fs.readFileSync(
  path.join(root, "src", "Resources", "ThemedComponents", "ThemedBottomNavigation.js"),
  "utf8"
);

assert.ok(
  /nav\.tabs\.feed/.test(navSource),
  "the bar has no Feed tab"
);
assert.ok(
  !/nav\.tabs\.profile/.test(navSource),
  "Profile is back in the bar, where it was reached by nobody"
);

// The indicator holds its space when transparent, or the active tab's icon
// sits above the others.
assert.ok(
  /backgroundColor: is\w+Active \? indicatorColor : "transparent"/.test(navSource),
  "the tab indicator no longer keeps its place when inactive"
);

const homeSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "HomePage.js"),
  "utf8"
);

assert.ok(
  !/WorkoutSummaryCard|workoutSummaryPosts/.test(homeSource),
  "posts are back on Home"
);

console.log(
  "Home quick start: the split guess, the weekday rule, last month, and the wiring passed."
);
