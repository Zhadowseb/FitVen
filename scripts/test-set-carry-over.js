// Covers the two queries that decide what a new set starts out holding.
//
// Adding an exercise now creates its first set from the last time that exercise
// was done, and adding set N copies set N-1. Both are one SQL statement, and
// both get the wrong answer quietly: the fields just hold numbers from the
// wrong session, which looks exactly like the right answer until somebody
// notices they are lifting last month's weight.
//
// The statements are read out of the repository file rather than copied, so
// this tests the query the app runs. Dates in this schema are stored two ways -
// "dd.mm.yyyy" from the older screens and ISO from the newer ones - and the
// ordering has to be right across both, which is most of what is checked here.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src", "Repository", "weightliftingRepository.js"),
  "utf8"
);

/** Pulls the SQL out of `db.getFirstAsync(\`...\`)` inside a named function. */
function queryFrom(functionName) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.ok(start !== -1, `${functionName} is gone from the repository`);

  const body = source.slice(start, source.indexOf("\nexport ", start + 1));
  const match = body.match(/getFirstAsync\(\s*`([\s\S]*?)`/);
  assert.ok(match, `${functionName} no longer runs a single getFirstAsync`);

  return match[1];
}

const LAST_SET_FOR_EXERCISE = queryFrom("getLastSetValuesForExercise");
const LAST_SET_FOR_NAME = queryFrom("getLastSetValuesForExerciseName");

/* --------------------------------------------------------------- fixture -- */

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE "Set" (
    sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_number INTEGER NOT NULL,
    exercise_instance_id INTEGER NOT NULL,
    pause INTEGER, reps INTEGER, weight INTEGER,
    deleted_at TEXT
  );
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_type_instance_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE Workout_Type_Instance (
    workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER,
    date TEXT,
    deleted_at TEXT
  );
  CREATE TABLE Day (
    day_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    deleted_at TEXT
  );
`);

let nextWorkout = 0;

/** One session: a date, an exercise, and its sets in order. */
function session({ date, name, sets, dayDate = null, deleted = null }) {
  nextWorkout += 1;
  let dayId = null;

  if (dayDate !== null) {
    db.prepare(`INSERT INTO Day (date) VALUES (?)`).run(dayDate);
    dayId = db.prepare(`SELECT last_insert_rowid() AS id`).get().id;
  }

  db.prepare(
    `INSERT INTO Workout_Type_Instance (day_id, date) VALUES (?, ?)`
  ).run(dayId, date);
  const workoutId = db.prepare(`SELECT last_insert_rowid() AS id`).get().id;

  db.prepare(
    `INSERT INTO Exercise_Instance (workout_type_instance_id, exercise_name, deleted_at)
     VALUES (?, ?, ?)`
  ).run(workoutId, name, deleted);
  const exerciseId = db.prepare(`SELECT last_insert_rowid() AS id`).get().id;

  sets.forEach((set, index) => {
    db.prepare(
      `INSERT INTO "Set" (set_number, exercise_instance_id, pause, reps, weight, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      index + 1,
      exerciseId,
      set.pause ?? null,
      set.reps ?? null,
      set.weight ?? null,
      set.deleted_at ?? null
    );
  });

  return exerciseId;
}

const lastForExercise = (exerciseId) =>
  db.prepare(LAST_SET_FOR_EXERCISE).get(exerciseId);

const lastForName = (name, excludeExerciseId = null) =>
  db.prepare(LAST_SET_FOR_NAME).get(name, excludeExerciseId);

/* ------------------------------------------- set N copies set N-1 -------- */

const bench = session({
  date: "01.03.2026",
  name: "Bench Press",
  sets: [
    { pause: 120, reps: 10, weight: 60 },
    { pause: 150, reps: 8, weight: 70 },
    { pause: 180, reps: 6, weight: 80 },
  ],
});

{
  const previous = lastForExercise(bench);
  assert.strictEqual(previous.weight, 80, "the last set is the heaviest one here");
  assert.strictEqual(previous.reps, 6);
  assert.strictEqual(previous.pause, 180);
}

// A deleted set is not the one to copy: it is not on screen, so copying it
// would put a number in the row that the user cannot see the source of.
db.prepare(
  `INSERT INTO "Set" (set_number, exercise_instance_id, pause, reps, weight, deleted_at)
   VALUES (4, ?, 999, 99, 999, '2026-03-01T00:00:00Z')`
).run(bench);

assert.strictEqual(
  lastForExercise(bench).weight,
  80,
  "a deleted set must not be copied forward"
);

// An exercise with no sets has nothing to offer, and must not borrow from
// another exercise.
const emptyExercise = session({
  date: "01.03.2026",
  name: "Empty Lift",
  sets: [],
});
assert.strictEqual(
  lastForExercise(emptyExercise),
  undefined,
  "an exercise with no sets returns nothing"
);

/* ------------------------------- a new exercise copies the last session -- */

session({
  date: "10.02.2026",
  name: "Squat",
  sets: [{ pause: 120, reps: 5, weight: 100 }],
});
session({
  date: "24.02.2026",
  name: "Squat",
  sets: [
    { pause: 180, reps: 5, weight: 110 },
    { pause: 200, reps: 3, weight: 120 },
  ],
});

{
  const previous = lastForName("Squat");
  assert.strictEqual(previous.weight, 120, "the most recent session wins");
  assert.strictEqual(previous.reps, 3, "and its last set, not its first");
  assert.strictEqual(previous.pause, 200);
}

// dd.mm.yyyy sorts as text in the wrong order - "24.02" is greater than
// "05.03" - so the query rewrites it before sorting. This is the case that
// catches that being dropped.
session({
  date: "05.03.2026",
  name: "Squat",
  sets: [{ pause: 90, reps: 12, weight: 60 }],
});

assert.strictEqual(
  lastForName("Squat").weight,
  60,
  "March beats February even though the raw text sorts the other way"
);

// The name is matched without case, the way the catalog treats it.
assert.strictEqual(lastForName("squat").weight, 60, "the name is case-insensitive");
assert.strictEqual(lastForName("SQUAT").weight, 60);

// An exercise never done before leaves the fields empty rather than borrowing
// from something else.
assert.strictEqual(
  lastForName("Never Done This"),
  undefined,
  "an unknown exercise offers nothing"
);

/* ------------------------------------------------- what has to be ignored -- */

// The Day date wins over the workout date where both exist, which is what the
// rest of the app sorts by.
session({
  date: "01.01.2020",
  dayDate: "20.03.2026",
  name: "Row",
  sets: [{ pause: 60, reps: 10, weight: 50 }],
});
session({
  date: "10.03.2026",
  name: "Row",
  sets: [{ pause: 70, reps: 9, weight: 55 }],
});

assert.strictEqual(
  lastForName("Row").weight,
  50,
  "the day's date is what dates a workout when it has one"
);

// A deleted exercise is gone as far as the user is concerned.
session({
  date: "01.04.2026",
  name: "Curl",
  sets: [{ pause: 60, reps: 12, weight: 20 }],
});
session({
  date: "10.04.2026",
  name: "Curl",
  sets: [{ pause: 60, reps: 12, weight: 999 }],
  deleted: "2026-04-10T00:00:00Z",
});

assert.strictEqual(
  lastForName("Curl").weight,
  20,
  "a deleted exercise is not history"
);

// A row with all three fields empty is not a value to copy - it is a set
// somebody added and never filled in - so the search passes over it.
session({
  date: "01.05.2026",
  name: "Press",
  sets: [{ pause: 90, reps: 8, weight: 40 }],
});
session({
  date: "10.05.2026",
  name: "Press",
  sets: [{ pause: null, reps: null, weight: null }],
});

assert.strictEqual(
  lastForName("Press").weight,
  40,
  "an untouched set is skipped in favour of the last real one"
);

// A partly filled row still counts: somebody who logged reps without weight
// meant those reps.
session({
  date: "20.05.2026",
  name: "Press",
  sets: [{ pause: null, reps: 15, weight: null }],
});

{
  const previous = lastForName("Press");
  assert.strictEqual(previous.reps, 15);
  assert.strictEqual(previous.weight, null, "the empty field stays empty");
}

// The exercise being created is excluded, so it cannot seed itself.
const freshSquat = session({
  date: "01.06.2026",
  name: "Squat",
  sets: [{ pause: 1, reps: 1, weight: 1 }],
});

assert.strictEqual(
  lastForName("Squat", freshSquat).weight,
  60,
  "the exercise asking the question is not part of the answer"
);

console.log("Set carry-over checks passed.");
