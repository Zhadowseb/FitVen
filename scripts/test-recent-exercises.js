// Covers the list behind the "Recent" button at the bottom of a strength
// workout: the exercises used in the last four workouts.
//
// The point of it is quick access mid-session, so it has to answer "what have I
// been training", not "how often" - an exercise used in all four workouts is one
// entry, not four. It also has to look at the last four *workouts*, not the last
// four exercises, and the dates it orders by are stored two ways in this schema
// ("dd.mm.yyyy" from the older screens, ISO from the newer ones), which is where
// a plain text sort puts February after March.
//
// The SQL is read out of the repository rather than copied.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src", "Repository", "programRepository.js"),
  "utf8"
);

/** The date-normalising helper, taken from the repository as written. */
function fragmentFrom(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} is gone from the repository`);

  const end = source.indexOf("\n}", start);
  assert.ok(end !== -1, `${name} could not be read`);

  return source.slice(start, end + 2);
}

const start = source.indexOf(
  "export async function getRecentlyUsedExerciseNames("
);
assert.ok(start !== -1, "getRecentlyUsedExerciseNames is gone");

const body = source.slice(start, source.indexOf("\nexport ", start + 1));
const match = body.match(/getAllAsync\(\s*(`[\s\S]*?`)/);
assert.ok(match, "getRecentlyUsedExerciseNames no longer runs a single query");

const RECENT_QUERY = new Function(
  `${fragmentFrom("localDateToIsoSql")}
   const workoutIsoDateSql = localDateToIsoSql("w.date");
   return ${match[1]};`
)();

assert.ok(
  /\bDISTINCT\b/i.test(RECENT_QUERY),
  "the query stopped de-duplicating, so an exercise used four times lists four times"
);
assert.ok(
  /\bLIMIT\b/i.test(RECENT_QUERY),
  "the query stopped limiting how many workouts it looks back over"
);

/* --------------------------------------------------------------- fixture -- */

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE Workout_Type_Instance (
    workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    deleted_at TEXT
  );
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_type_instance_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    deleted_at TEXT
  );
`);

const insertWorkout = db.prepare(
  `INSERT INTO Workout_Type_Instance (date, deleted_at) VALUES (?, ?);`
);
const insertExercise = db.prepare(
  `INSERT INTO Exercise_Instance
     (workout_type_instance_id, exercise_name, deleted_at)
   VALUES (?, ?, ?);`
);

/** A workout on `date` holding `exercises`. */
function addWorkout({ date, exercises, deletedAt = null }) {
  const workoutId = Number(insertWorkout.run(date, deletedAt).lastInsertRowid);

  for (const exercise of exercises) {
    insertExercise.run(
      workoutId,
      typeof exercise === "string" ? exercise : exercise.name,
      typeof exercise === "string" ? null : exercise.deletedAt ?? null
    );
  }

  return workoutId;
}

// Seven workouts, oldest first, with the two date formats mixed. February and
// March are both present so a text sort would get the order wrong.
addWorkout({ date: "01.02.2026", exercises: ["Too Old"] });
addWorkout({ date: "2026-03-01", exercises: ["Also Too Old"] });
addWorkout({ date: "10.03.2026", exercises: ["Bench Press", "Squat"] });
addWorkout({ date: "2026-03-12", exercises: ["Bench Press"] });
addWorkout({ date: "14.03.2026", exercises: ["Bench Press", "Row"] });
addWorkout({
  date: "16.03.2026",
  exercises: ["Bench Press", "Deadlift", { name: "Removed", deletedAt: "x" }],
});

// Two workouts that must not count: one deleted, one with nothing in it.
addWorkout({ date: "18.03.2026", exercises: ["Deleted Workout"], deletedAt: "x" });
const emptyWorkoutId = addWorkout({ date: "19.03.2026", exercises: [] });

// And the one being added to, which is where the button was pressed.
const currentWorkoutId = addWorkout({
  date: "20.03.2026",
  exercises: ["Currently Open"],
});

/* ------------------------------------------------------------------ then -- */

const run = ({ excludeWorkoutId = null, workoutLimit = 4 } = {}) =>
  db
    .prepare(RECENT_QUERY)
    .all(excludeWorkoutId, excludeWorkoutId, workoutLimit)
    .map((row) => row.exercise_name);

// The last four that count are 10.03, 12.03, 14.03 and 16.03. Bench Press is in
// three of them and appears once; Squat comes from the oldest of the four.
assert.deepStrictEqual(
  run({ excludeWorkoutId: currentWorkoutId }),
  ["Bench Press", "Deadlift", "Row", "Squat"],
  "the last four workouts' exercises are wrong"
);

assert.ok(
  !run({ excludeWorkoutId: currentWorkoutId }).includes("Currently Open"),
  "the workout being added to counted as one of the recent four"
);
assert.ok(
  !run({ excludeWorkoutId: currentWorkoutId }).includes("Deleted Workout"),
  "a deleted workout counted as one of the recent four"
);
assert.ok(
  !run({ excludeWorkoutId: currentWorkoutId }).includes("Removed"),
  "a deleted exercise was listed"
);
assert.ok(
  !run({ excludeWorkoutId: currentWorkoutId }).includes("Too Old"),
  "the query looked further back than four workouts"
);

// Without an exclusion the open workout is simply the most recent one.
assert.deepStrictEqual(
  run(),
  ["Bench Press", "Currently Open", "Deadlift", "Row"],
  "with nothing excluded the most recent workouts are wrong"
);

// A workout with nothing in it never took up one of the four slots, so
// excluding it changes nothing.
assert.deepStrictEqual(
  run({ excludeWorkoutId: emptyWorkoutId }),
  run(),
  "an empty workout was taking up one of the four slots"
);

// The look-back is a parameter, not a hard-coded four.
assert.deepStrictEqual(
  run({ excludeWorkoutId: currentWorkoutId, workoutLimit: 1 }),
  ["Bench Press", "Deadlift"],
  "the workout limit is not being applied"
);
assert.ok(
  run({ excludeWorkoutId: currentWorkoutId, workoutLimit: 6 }).includes(
    "Also Too Old"
  ),
  "a wider look-back did not reach further"
);

console.log(
  "Recent exercises: the last four workouts give one entry per exercise, " +
    "across both date formats, ignoring the open workout, deleted workouts, " +
    "deleted exercises and workouts with nothing in them."
);
