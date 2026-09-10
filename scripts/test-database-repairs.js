// Covers the startup repairs that were rewritten to stop writing rows they had
// nothing to change.
//
// They ran over every row of their table at every app start. SQLite writes a row
// to the WAL even when the new value equals the old one, so a full history paid
// for tens of thousands of no-op writes before the first frame. Each now carries
// a WHERE that excludes rows already holding the right value.
//
// That is only safe if the repair still repairs. Two properties are checked here
// against a fixture holding every state the columns are known to reach - NULL,
// wrong, already right, and the odd spellings the run types have arrived in:
//
//   1. After one pass, every row holds what it should. "Should" is computed in
//      JavaScript from the fixture, not read back out of the SQL, so a wrong
//      statement cannot agree with itself.
//   2. A second pass changes nothing. That is the whole point of the WHERE, and
//      it is what stops the cost coming back the next time someone edits these.
//
// The SQL is read out of db.js rather than copied.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "Database", "db.js"), "utf8");

/** The statements inside a named function's single execAsync template. */
function statementsFrom(functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.ok(start !== -1, `${functionName} is gone from db.js`);

  const close = /\r?\n\}\r?\n/g;
  close.lastIndex = start;

  const end = close.exec(source);
  assert.ok(end, `${functionName} has no closing brace`);

  const body = source.slice(start, end.index);
  const match = body.match(/execAsync\(\s*`([\s\S]*?)`\s*\)/);
  assert.ok(match, `${functionName} no longer runs one execAsync`);

  return match[1]
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`);
}

/** The exercise set-count repair, which sits inline in initializeDatabase. */
function setCountStatement() {
  const start = source.indexOf("UPDATE Exercise_Instance\n    SET sets = (");
  const windows = start === -1 ? source.indexOf("SET sets = (") : start;
  assert.ok(windows !== -1, "the set-count repair is gone from db.js");

  const from = source.lastIndexOf("UPDATE Exercise_Instance", windows);
  const to = source.indexOf(";", windows);

  return `${source.slice(from, to).trim()};`;
}

const RESISTANCE_STATEMENTS = statementsFrom("repairResistanceTrainingState");
const RUN_STATEMENTS = statementsFrom("repairRunSetState");
const SET_COUNT_STATEMENT = setCountStatement();

for (const [label, statements] of [
  ["repairResistanceTrainingState", RESISTANCE_STATEMENTS],
  ["repairRunSetState", RUN_STATEMENTS],
  ["the set-count repair", [SET_COUNT_STATEMENT]],
]) {
  assert.ok(
    statements.every((statement) => /\bWHERE\b/i.test(statement)),
    `${label} has a statement with no WHERE, so it writes every row of its table at every app start`
  );
}

/* --------------------------------------------------------------- fixture -- */

function createDatabase() {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE Exercise_Instance (
      exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_type_instance_id INTEGER,
      visible_columns TEXT,
      sets INTEGER,
      done INTEGER
    );
    CREATE TABLE "Set" (
      sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_instance_id INTEGER NOT NULL,
      done INTEGER DEFAULT 0
    );
    CREATE TABLE Workout_Type_Instance (
      workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
      done INTEGER
    );
    CREATE TABLE Run (
      run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER,
      type TEXT,
      done INTEGER,
      is_pause INTEGER
    );
  `);

  return db;
}

// One exercise per combination that matters: the stored flags are deliberately
// wrong, right, and missing, over sets that are all done, partly done and none.
const EXERCISES = [];

for (const setStates of [[], [1], [0], [1, 1], [1, 0], [0, 0, 1]]) {
  for (const storedDone of [null, 0, 1]) {
    for (const storedSets of [null, 0, 99, setStates.length]) {
      EXERCISES.push({ setStates, storedDone, storedSets });
    }
  }
}

// Every workout shape the done-flag repair has to get right: run-backed (keeps
// whatever it had) and strength-backed (takes it from its exercises), with the
// stored flag right, wrong and missing.
const WORKOUTS = [];

for (const isRun of [false, true]) {
  for (const exerciseDoneStates of [[1], [0], [1, 1], [1, 0]]) {
    for (const storedDone of [null, 0, 1]) {
      WORKOUTS.push({ isRun, exerciseDoneStates, storedDone });
    }
  }
}

const RUN_ROWS = [
  { type: null },
  { type: "WARMUP" },
  { type: "WORKING_SET" },
  { type: "COOLDOWN" },
  { type: "warmup" },
  { type: "warm-up" },
  { type: "Warm Up" },
  { type: "cool down" },
  { type: "COOL_DOWN" },
  { type: "  cooldown  " },
  { type: "something else" },
  { type: "" },
];

/** The answer, worked out in JavaScript rather than asked of the SQL. */
function expectedFor(exercise) {
  return {
    sets: exercise.setStates.length,
    // done is 1 when no set is left undone - an exercise with no sets counts as done.
    done: exercise.setStates.every((state) => state === 1) ? 1 : 0,
  };
}

function expectedRunType(type) {
  if (type === null) return "WORKING_SET";

  const canonical = String(type).trim().replace(/[- ]/g, "_").toUpperCase();

  if (canonical === "WARMUP" || canonical === "WARM_UP") return "WARMUP";
  if (canonical === "COOLDOWN" || canonical === "COOL_DOWN") return "COOLDOWN";

  return "WORKING_SET";
}

function seed(db) {
  const insertExercise = db.prepare(
    `INSERT INTO Exercise_Instance (workout_type_instance_id, sets, done)
     VALUES (?, ?, ?);`
  );
  const insertSet = db.prepare(
    `INSERT INTO "Set" (exercise_instance_id, done) VALUES (?, ?);`
  );
  const insertWorkout = db.prepare(
    `INSERT INTO Workout_Type_Instance (done) VALUES (?);`
  );
  const insertRun = db.prepare(
    `INSERT INTO Run (workout_id, type, done, is_pause) VALUES (?, ?, ?, ?);`
  );

  for (const workout of WORKOUTS) {
    workout.id = Number(insertWorkout.run(workout.storedDone).lastInsertRowid);

    // A run workout keeps its own flag; a strength workout takes it from its
    // exercises. Both shapes have to survive the guard.
    if (workout.isRun) {
      insertRun.run(workout.id, "WORKING_SET", 1, 0);
    }

    for (const done of workout.exerciseDoneStates) {
      const exerciseId = Number(
        insertExercise.run(workout.id, 1, done).lastInsertRowid
      );

      insertSet.run(exerciseId, done);
    }
  }

  // The set-count and exercise-done cases hang off a workout of their own, so
  // they do not disturb what the workouts above are expected to end up with.
  const workoutId = Number(insertWorkout.run(null).lastInsertRowid);

  EXERCISES.forEach((exercise, index) => {
    const exerciseId = Number(
      insertExercise.run(workoutId, exercise.storedSets, exercise.storedDone)
        .lastInsertRowid
    );

    for (const state of exercise.setStates) {
      insertSet.run(exerciseId, state);
    }

    exercise.id = exerciseId;
    exercise.index = index;
  });

  for (const row of RUN_ROWS) {
    row.id = Number(insertRun.run(null, row.type, null, null).lastInsertRowid);
  }
}

/** Runs every repair statement once and reports how many rows it wrote. */
function runRepairs(db) {
  let changed = 0;

  for (const statement of [
    SET_COUNT_STATEMENT,
    ...RESISTANCE_STATEMENTS,
    ...RUN_STATEMENTS,
  ]) {
    db.exec(statement);
    changed += db.prepare("SELECT changes() AS c;").get().c;
  }

  return changed;
}

/* ------------------------------------------------------------------ then -- */

const db = createDatabase();
seed(db);

const firstPass = runRepairs(db);

assert.ok(
  firstPass > 0,
  "the repairs wrote nothing at all on a deliberately broken fixture"
);

const repairedExercises = new Map(
  db
    .prepare("SELECT exercise_instance_id, sets, done FROM Exercise_Instance;")
    .all()
    .map((row) => [row.exercise_instance_id, row])
);

for (const exercise of EXERCISES) {
  const expected = expectedFor(exercise);
  const actual = repairedExercises.get(exercise.id);
  const where =
    `exercise ${exercise.index} (sets ${JSON.stringify(exercise.setStates)}, ` +
    `stored done ${exercise.storedDone}, stored sets ${exercise.storedSets})`;

  assert.strictEqual(actual.sets, expected.sets, `${where}: wrong set count`);
  assert.strictEqual(actual.done, expected.done, `${where}: wrong done flag`);
}

const repairedWorkouts = new Map(
  db
    .prepare("SELECT workout_id, done FROM Workout_Type_Instance;")
    .all()
    .map((row) => [row.workout_id, row])
);

for (const workout of WORKOUTS) {
  const actual = repairedWorkouts.get(workout.id).done;
  const where =
    `${workout.isRun ? "run" : "strength"} workout with exercises ` +
    `${JSON.stringify(workout.exerciseDoneStates)} and stored done ${workout.storedDone}`;

  if (workout.isRun) {
    assert.strictEqual(
      actual,
      workout.storedDone,
      `${where}: a run workout's own flag was overwritten`
    );
    continue;
  }

  assert.strictEqual(
    actual,
    workout.exerciseDoneStates.every((done) => done === 1) ? 1 : 0,
    `${where}: wrong done flag`
  );
}

const repairedRuns = new Map(
  db.prepare("SELECT run_id, type, done, is_pause FROM Run;").all().map((row) => [row.run_id, row])
);

for (const row of RUN_ROWS) {
  const actual = repairedRuns.get(row.id);

  assert.strictEqual(
    actual.type,
    expectedRunType(row.type),
    `run type ${JSON.stringify(row.type)} was normalised to ${actual.type}`
  );
  assert.strictEqual(actual.done, 0, "a run set kept a NULL done");
  assert.strictEqual(actual.is_pause, 0, "a run set kept a NULL is_pause");
}

// The point of the WHERE clauses: nothing left to do, nothing written.
const secondPass = runRepairs(db);

assert.strictEqual(
  secondPass,
  0,
  `a second pass wrote ${secondPass} rows with nothing left to repair, which is the cost these clauses exist to remove`
);

const thirdPass = runRepairs(db);

assert.strictEqual(thirdPass, 0, "the repairs are not settling");

console.log(
  `Startup repairs: ${EXERCISES.length} exercises, ${WORKOUTS.length} workouts ` +
    `and ${RUN_ROWS.length} run sets end in the state computed for them, and a ` +
    `repeat pass writes nothing.`
);
