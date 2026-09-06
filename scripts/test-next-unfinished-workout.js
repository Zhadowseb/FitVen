// Covers the "up next" query against the scan-and-filter it replaced.
//
// Home shows one planned workout. It used to fetch every workout between
// tomorrow and 180 days out - each row running the personal-record subquery -
// and take the first one that was not done. Now the database returns that one
// row directly.
//
// The two only agree if the SQL's idea of "not done" matches the JavaScript's
// (`Number(workout.done) !== 1`, which treats NULL and 0 alike), and if the
// ordering is untouched: same date, several programs, the tie-break decides
// which workout the user is told about next. Both are checked here against the
// same fixture, over every window the old code could have been asked for.
//
// The SQL is read out of the repository rather than copied, so this tests the
// statements the app runs.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src", "Repository", "programRepository.js"),
  "utf8"
);

/** The SQL fragment helpers, taken from the repository as written. */
const fragmentHelpers = [
  "workoutDisplayLabelSql",
  "workoutHasPersonalRecordSql",
  "localDateToIsoSql",
]
  .map((name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start !== -1, `${name} is gone from the repository`);

    const end = source.indexOf("\n}", start);
    assert.ok(end !== -1, `${name} could not be read`);

    return source.slice(start, end + 2);
  })
  .join("\n");

/** Pulls the SQL out of a named repository function and resolves it. */
function queryFrom(functionName) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.ok(start !== -1, `${functionName} is gone from the repository`);

  const body = source.slice(start, source.indexOf("\nexport ", start + 1));
  const match = body.match(/get(?:All|First)Async\(\s*(`[\s\S]*?`)/);
  assert.ok(match, `${functionName} no longer runs a single query`);

  // The repository functions bind this local before their template uses it.
  const prelude = `const workoutIsoDateSql = localDateToIsoSql("w.date");`;

  return new Function(`${fragmentHelpers}\n${prelude}\nreturn ${match[1]};`)();
}

const ALL_IN_RANGE = queryFrom("getWorkoutsBetweenDates");
const NEXT_IN_RANGE = queryFrom("getNextUnfinishedWorkoutBetweenDates");

assert.ok(
  /\bLIMIT 1\b/.test(NEXT_IN_RANGE),
  "the up-next query stopped limiting to the one row the card shows"
);
assert.ok(
  !/has_personal_record/.test(NEXT_IN_RANGE),
  "the up-next card does not show a personal record, so the subquery is waste"
);

/* --------------------------------------------------------------- fixture -- */

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE Program (
    program_id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_name TEXT,
    status TEXT,
    deleted_at TEXT
  );
  CREATE TABLE Day (
    day_id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    Weekday TEXT,
    date TEXT,
    deleted_at TEXT
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
    date TEXT,
    done INTEGER,
    is_active INTEGER DEFAULT 0,
    original_start_time TEXT,
    timer_start TEXT,
    elapsed_time INTEGER,
    deleted_at TEXT
  );
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_type_instance_id INTEGER NOT NULL,
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

  INSERT INTO Workout_Type (name, display_name) VALUES ('Resistance', 'Styrke');
  INSERT INTO Program (program_name, status) VALUES
    ('Bravo', 'ACTIVE'),
    ('Alpha', 'ACTIVE'),
    ('Dropped', 'NOT_STARTED');
`);

const insertDay = db.prepare(
  `INSERT INTO Day (program_id, Weekday, date) VALUES (?, ?, ?);`
);
const insertWorkout = db.prepare(
  `INSERT INTO Workout_Type_Instance (day_id, workout_type, label, date, done)
   VALUES (?, 'Resistance', ?, ?, ?);`
);

/** A workout on `date` (dd.mm.yyyy) belonging to `programId` (or standalone). */
function addWorkout({ programId, date, label, done }) {
  const dayId = Number(insertDay.run(programId, "Monday", date).lastInsertRowid);

  return Number(insertWorkout.run(dayId, label, date, done).lastInsertRowid);
}

// Everything the old scan could have run into, on and around the same dates:
// a finished workout ahead of an unfinished one, a NULL done, a `done` stored
// as text, two programs sharing a date so the name tie-break decides, a
// standalone workout with no program, and a workout on a NOT_STARTED program
// that must stay invisible to both paths.
addWorkout({ programId: 1, date: "10.09.2026", label: "Done first", done: 1 });
addWorkout({ programId: 3, date: "10.09.2026", label: "Hidden", done: 0 });
// Bravo is inserted first so its workout id is the lower one: on this date the
// id order and the program-name order disagree, which is the only way a dropped
// tie-break shows up as a different answer.
addWorkout({ programId: 1, date: "11.09.2026", label: "Bravo same day", done: 0 });
addWorkout({ programId: 2, date: "11.09.2026", label: "Alpha same day", done: null });
addWorkout({ programId: null, date: "12.09.2026", label: "Standalone", done: 0 });
addWorkout({ programId: 1, date: "13.09.2026", label: "Text done", done: "1" });
addWorkout({ programId: 1, date: "14.09.2026", label: "Last one", done: 0 });

/* ------------------------------------------------------------------ then -- */

const WINDOWS = [
  ["2026-09-08", "2027-03-08"],
  ["2026-09-10", "2026-09-10"],
  ["2026-09-11", "2026-12-31"],
  ["2026-09-13", "2026-09-13"],
  ["2026-09-13", "2026-09-14"],
  ["2026-09-20", "2026-12-31"],
];

let windowsWithAnAnswer = 0;

for (const [startIso, endIso] of WINDOWS) {
  const scanned = db.prepare(ALL_IN_RANGE).all(startIso, endIso);
  const expected =
    scanned.find((workout) => Number(workout.done) !== 1) ?? null;
  const actual = db.prepare(NEXT_IN_RANGE).get(startIso, endIso) ?? null;
  const where = `${startIso}..${endIso}`;

  if (expected === null) {
    assert.strictEqual(
      actual,
      null,
      `${where}: nothing is unfinished, so the query must return nothing`
    );
    continue;
  }

  assert.ok(actual, `${where}: expected ${expected.label}, got nothing`);
  assert.strictEqual(
    actual.workout_id,
    expected.workout_id,
    `${where}: picked ${actual.label} where the scan picked ${expected.label}`
  );

  for (const field of [
    "workout_type",
    "label",
    "date",
    "date_iso",
    "done",
    "day_id",
    "weekday",
    "program_id",
    "program_name",
  ]) {
    assert.strictEqual(
      actual[field],
      expected[field],
      `${where}: ${field} differs from what the scan returned`
    );
  }

  windowsWithAnAnswer += 1;
}

assert.ok(
  windowsWithAnAnswer >= 3,
  `the fixture stopped covering the found case (${windowsWithAnAnswer} windows)`
);

// The tie-break is the whole reason ORDER BY survived into the LIMIT 1 query.
assert.strictEqual(
  db.prepare(NEXT_IN_RANGE).get("2026-09-11", "2026-09-11").program_name,
  "Alpha",
  "same-date workouts must still be ordered by program name"
);
assert.strictEqual(
  db.prepare(NEXT_IN_RANGE).get("2026-09-10", "2026-09-10"),
  undefined,
  "a NOT_STARTED program's workout must not surface as the next one"
);

console.log(
  `Up-next workout: the single-row query matches the old scan across ` +
    `${WINDOWS.length} date windows.`
);
