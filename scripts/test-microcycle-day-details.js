// Covers the batched microcycle query against the per-day queries it replaced.
//
// Drawing the microcycle list used to run one query per weekday per microcycle,
// then one per workout inside each of those - around 135 for a normal screen.
// getMicrocycleDayDetails does the same work in three. That is only an
// improvement if it answers identically, and the ways it could differ are quiet
// ones: a day whose workouts land in the wrong day's card, workouts in a
// different order so the wrong icon shows, or a weekday with no row at all
// silently becoming an empty day instead of a missing one.
//
// The SQL is read out of the repository files rather than copied, so this tests
// the statements the app actually runs. Both paths are executed against the
// same fixture and the assembled per-day shapes are compared field for field.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const programSource = fs.readFileSync(
  path.join(root, "src", "Repository", "programRepository.js"),
  "utf8"
);
const weightliftingSource = fs.readFileSync(
  path.join(root, "src", "Repository", "weightliftingRepository.js"),
  "utf8"
);

/** The two SQL fragment helpers, taken from the repository as written. */
const fragmentHelpers = ["workoutDisplayLabelSql", "workoutHasPersonalRecordSql"]
  .map((name) => {
    const start = programSource.indexOf(`function ${name}(`);
    assert.ok(start !== -1, `${name} is gone from the repository`);

    const end = programSource.indexOf("\n}", start);
    assert.ok(end !== -1, `${name} could not be read`);

    return programSource.slice(start, end + 2);
  })
  .join("\n");

/**
 * Pulls the SQL out of a named repository function. Returns a builder that
 * resolves the template placeholders for a given number of bind markers.
 */
function queryFrom(source, functionName) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.ok(start !== -1, `${functionName} is gone from the repository`);

  const body = source.slice(start, source.indexOf("\nexport ", start + 1));
  const match = body.match(/get(?:All|First)Async\(\s*(`[\s\S]*?`)/);
  assert.ok(match, `${functionName} no longer runs a single query`);

  const build = new Function(
    "placeholders",
    `${fragmentHelpers}\nreturn ${match[1]};`
  );

  return (count = 0) =>
    build(Array.from({ length: count }, () => "?").join(", "));
}

const daySingle = queryFrom(programSource, "getDayByWeekdayAndMicrocycle")();
const daysBatched = queryFrom(programSource, "getDaysByMicrocycleIds");
const workoutsSingle = queryFrom(programSource, "getWorkoutsByDayId")();
const workoutsBatched = queryFrom(programSource, "getWorkoutsByDayIds");
const exercisesSingle = queryFrom(
  weightliftingSource,
  "getExerciseSummariesByWorkout"
)();
const exercisesBatched = queryFrom(
  weightliftingSource,
  "getExerciseSummariesByWorkoutIds"
);

assert.ok(
  /\bday_id\b/.test(daysBatched(1)) && /\bmicrocycle_id\b/.test(daysBatched(1)),
  "the batched day query must return day_id and microcycle_id to regroup by"
);
assert.ok(
  /\bday_id\b/.test(workoutsBatched(1)),
  "the batched workout query must return day_id to regroup by"
);
assert.ok(
  /\bworkout_type_instance_id\b/.test(exercisesBatched(1)),
  "the batched exercise query must return its workout id to regroup by"
);

/* --------------------------------------------------------------- fixture -- */

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE Day (
    day_id INTEGER PRIMARY KEY AUTOINCREMENT,
    microcycle_id INTEGER NOT NULL,
    Weekday TEXT NOT NULL,
    date TEXT,
    done INTEGER DEFAULT 0,
    is_sick INTEGER DEFAULT 0
  );
  CREATE TABLE Workout_Type (
    name TEXT PRIMARY KEY,
    display_name TEXT
  );
  CREATE TABLE Workout_Type_Instance (
    workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER,
    workout_type TEXT,
    label TEXT,
    done INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 0,
    original_start_time TEXT,
    timer_start TEXT,
    elapsed_time INTEGER
  );
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_type_instance_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    sets INTEGER,
    exercise_order INTEGER,
    deleted_at TEXT
  );
  CREATE TABLE "Set" (
    sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_instance_id INTEGER NOT NULL,
    personal_record INTEGER DEFAULT 0,
    done INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    deleted_at TEXT
  );

  INSERT INTO Workout_Type (name, display_name) VALUES
    ('Resistance', 'Styrke'),
    ('Cardio', '');
`);

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MICROCYCLES = [1, 2];

const insertDay = db.prepare(
  `INSERT INTO Day (microcycle_id, Weekday, date, done, is_sick)
   VALUES (?, ?, ?, ?, ?);`
);
const insertWorkout = db.prepare(
  `INSERT INTO Workout_Type_Instance
     (day_id, workout_type, label, done, is_active, elapsed_time)
   VALUES (?, ?, ?, ?, ?, ?);`
);
const insertExercise = db.prepare(
  `INSERT INTO Exercise_Instance
     (workout_type_instance_id, exercise_name, sets, exercise_order)
   VALUES (?, ?, ?, ?);`
);
const insertSet = db.prepare(
  `INSERT INTO "Set" (exercise_instance_id, personal_record, done, failed)
   VALUES (?, ?, ?, ?);`
);

// Deliberately uneven: Sunday of microcycle 1 has no Day row at all, Saturday
// has a day but no workouts, Wednesday has two, and one workout carries a
// personal record. Days are inserted weekday-major so the two microcycles
// interleave and no path can pass by accident of insertion order.
for (const weekday of WEEKDAYS) {
  for (const microcycleId of MICROCYCLES) {
    if (microcycleId === 1 && weekday === "Sunday") {
      continue;
    }

    const dayId = Number(
      insertDay.run(
        microcycleId,
        weekday,
        `0${microcycleId}.09.2026`,
        weekday === "Monday" ? 1 : 0,
        weekday === "Friday" ? 1 : 0
      ).lastInsertRowid
    );

    if (weekday === "Saturday") {
      continue;
    }

    const workoutCount = weekday === "Wednesday" ? 2 : 1;

    for (let n = 0; n < workoutCount; n += 1) {
      const workoutId = Number(
        insertWorkout.run(
          dayId,
          n === 0 ? "Resistance" : "Cardio",
          n === 0 ? "Resistance" : "Morgenløb",
          weekday === "Monday" ? 1 : 0,
          0,
          600 + n
        ).lastInsertRowid
      );

      for (let e = 0; e < 3 - n; e += 1) {
        const exerciseId = Number(
          insertExercise.run(workoutId, `Exercise ${e}`, e + 2, 3 - e)
            .lastInsertRowid
        );

        if (weekday === "Tuesday" && e === 0) {
          insertSet.run(exerciseId, 1, 1, 0);
        }
      }
    }
  }
}

/* ----------------------------------------------------------------- paths -- */

/** The shape getDayDetails returns, built the old way: one query at a time. */
function detailsTheOldWay(microcycleId, weekday) {
  const day = db.prepare(daySingle).get(weekday, microcycleId);

  if (!day?.day_id) {
    return null;
  }

  const workouts = db.prepare(workoutsSingle).all(day.day_id);

  return {
    ...day,
    workouts,
    workoutExercises: workouts.map((workout) => ({
      workout_id: workout.workout_id,
      label: workout.label,
      exercises: db.prepare(exercisesSingle).all(workout.workout_id),
    })),
    workoutsDone: day.done === 1,
  };
}

/** The same shape, assembled the way getMicrocycleDayDetails does it. */
function detailsTheNewWay(microcycleIds) {
  const detailsByKey = new Map();
  const days = db.prepare(daysBatched(microcycleIds.length)).all(...microcycleIds);

  if (!days.length) {
    return detailsByKey;
  }

  const workouts = db
    .prepare(workoutsBatched(days.length))
    .all(...days.map((day) => day.day_id));
  const exercises = db
    .prepare(exercisesBatched(workouts.length))
    .all(...workouts.map((workout) => workout.workout_id));

  const exercisesByWorkoutId = new Map();
  for (const exercise of exercises) {
    const workoutId = exercise.workout_type_instance_id;
    const list = exercisesByWorkoutId.get(workoutId) ?? [];

    list.push({ exercise_name: exercise.exercise_name, sets: exercise.sets });
    exercisesByWorkoutId.set(workoutId, list);
  }

  const workoutsByDayId = new Map();
  for (const workout of workouts) {
    const list = workoutsByDayId.get(workout.day_id) ?? [];

    list.push(workout);
    workoutsByDayId.set(workout.day_id, list);
  }

  for (const day of days) {
    const key = `${day.microcycle_id}:${day.weekday}`;

    if (detailsByKey.has(key)) {
      continue;
    }

    const dayWorkouts = workoutsByDayId.get(day.day_id) ?? [];

    detailsByKey.set(key, {
      ...day,
      workouts: dayWorkouts,
      workoutExercises: dayWorkouts.map((workout) => ({
        workout_id: workout.workout_id,
        label: workout.label,
        exercises: exercisesByWorkoutId.get(workout.workout_id) ?? [],
      })),
      workoutsDone: day.done === 1,
    });
  }

  return detailsByKey;
}

/* ------------------------------------------------------------------ then -- */

// node:sqlite hands back null-prototype rows; the batched path rebuilds the
// exercise rows as plain objects. Only the values are being compared here.
const plain = (value) => JSON.parse(JSON.stringify(value));


const batched = detailsTheNewWay(MICROCYCLES);
let comparedWorkouts = 0;

for (const microcycleId of MICROCYCLES) {
  for (const weekday of WEEKDAYS) {
    const expected = detailsTheOldWay(microcycleId, weekday);
    const actual = batched.get(`${microcycleId}:${weekday}`) ?? null;
    const where = `microcycle ${microcycleId} ${weekday}`;

    if (expected === null) {
      assert.strictEqual(
        actual,
        null,
        `${where} has no Day row, so the batched path must not invent one`
      );
      continue;
    }

    assert.ok(actual, `${where} went missing from the batched path`);
    assert.strictEqual(actual.day_id, expected.day_id, `${where}: wrong day`);
    assert.strictEqual(actual.date, expected.date, `${where}: wrong date`);
    assert.strictEqual(actual.done, expected.done, `${where}: wrong done`);
    assert.strictEqual(
      actual.is_sick,
      expected.is_sick,
      `${where}: wrong sickness`
    );
    assert.strictEqual(
      actual.workoutsDone,
      expected.workoutsDone,
      `${where}: wrong workoutsDone`
    );
    assert.deepStrictEqual(
      plain(actual.workouts),
      plain(expected.workouts),
      `${where}: the workouts differ - order, grouping or a column`
    );
    assert.deepStrictEqual(
      plain(actual.workoutExercises),
      plain(expected.workoutExercises),
      `${where}: the exercises differ - order, grouping or a column`
    );

    comparedWorkouts += expected.workouts.length;
  }
}

assert.ok(
  comparedWorkouts >= 13,
  `the fixture stopped covering workouts (compared ${comparedWorkouts})`
);
assert.strictEqual(
  batched.get("2:Tuesday").workouts[0].has_personal_record,
  1,
  "the personal record column stopped coming through the batched query"
);
assert.strictEqual(
  batched.get("1:Saturday").workouts.length,
  0,
  "a day without workouts must stay empty rather than borrow another day's"
);
assert.strictEqual(
  batched.get("1:Monday").workouts[0].label,
  "Styrke",
  "the display-name label stopped resolving in the batched query"
);

console.log(
  "Microcycle day details: batched path matches the per-day path across " +
    `${batched.size} days and ${comparedWorkouts} workouts.`
);
