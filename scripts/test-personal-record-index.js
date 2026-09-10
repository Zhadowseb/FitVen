// Proves the personal-record lookup uses an index rather than scanning.
//
// Ticking a set off recalculates the personal record for that exercise, and
// both queries behind it filter Exercise_Instance by name. Without an index
// SQLite scans the user's whole exercise history on every tap: 22.9 ms over
// 50,000 sets when the performance review measured it, against 1 ms with the
// index.
//
// Nothing about that is visible from the app. The result is identical either
// way, only slower, and slower in proportion to how long somebody has been
// using FitVen - so the only way it stays fixed is a check that reads the query
// plan and fails when it says SCAN.
//
// The CREATE INDEX statement is taken out of db.js rather than repeated here,
// so deleting it there fails this.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const dbSource = fs.readFileSync(
  path.join(root, "src", "Database", "db.js"),
  "utf8"
);

const indexMatch = dbSource.match(
  /CREATE INDEX IF NOT EXISTS exercise_instance_name_idx[\s\S]*?;/
);

assert.ok(
  indexMatch,
  "exercise_instance_name_idx is gone from db.js - the personal record lookup scans the whole exercise history without it"
);

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_type_instance_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE "Set" (
    sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_instance_id INTEGER NOT NULL,
    personal_record INTEGER NOT NULL DEFAULT 0,
    done INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    weight INTEGER,
    reps INTEGER,
    deleted_at TEXT
  );
  CREATE INDEX set_exercise_idx ON "Set"(exercise_instance_id);
`);

// Enough rows that the planner has a reason to prefer the index. Without one it
// reports SCAN whatever the size, but a realistic table makes the plan output
// mean what it says.
const insertExercise = db.prepare(
  `INSERT INTO Exercise_Instance (workout_type_instance_id, exercise_name, deleted_at)
   VALUES (?, ?, NULL)`
);
const insertSet = db.prepare(
  `INSERT INTO "Set" (exercise_instance_id, personal_record, done, failed, weight, reps, deleted_at)
   VALUES (?, 0, 1, 0, ?, ?, NULL)`
);

const NAMES = ["Bench Press", "Squat", "Deadlift", "Row", "Overhead Press"];

for (let index = 0; index < 2000; index += 1) {
  insertExercise.run(Math.floor(index / 4) + 1, NAMES[index % NAMES.length]);
  insertSet.run(index + 1, 40 + (index % 60), 5 + (index % 8));
}

// The query the personal record refresh actually runs, from
// getPersonalRecordFlagsByExerciseName.
const PR_QUERY = `
  SELECT s.sets_id, COALESCE(s.personal_record, 0) AS personal_record
  FROM "Set" s
  JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
  WHERE e.exercise_name = ?
    AND COALESCE(s.deleted_at, '') = ''
    AND COALESCE(e.deleted_at, '') = ''`;

function planFor(query) {
  return db
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .all("Bench Press")
    .map((row) => row.detail)
    .join(" | ");
}

const planWithoutIndex = planFor(PR_QUERY);

assert.ok(
  /SCAN e\b|SCAN Exercise_Instance/.test(planWithoutIndex),
  `expected a scan before the index exists, so this test can tell the difference. Got: ${planWithoutIndex}`
);

db.exec(indexMatch[0]);
db.exec("ANALYZE;");

const planWithIndex = planFor(PR_QUERY);

assert.ok(
  /SEARCH e\b.*exercise_instance_name_idx|SEARCH Exercise_Instance.*exercise_instance_name_idx/.test(
    planWithIndex
  ),
  `the personal record query still does not use exercise_instance_name_idx. Plan: ${planWithIndex}`
);

// The index has to answer from itself, or SQLite goes back to the table for the
// join key and half the point is lost.
assert.ok(
  /COVERING INDEX exercise_instance_name_idx/.test(planWithIndex) ||
    /USING INDEX exercise_instance_name_idx/.test(planWithIndex),
  `expected the lookup to be served by the index. Plan: ${planWithIndex}`
);

// And the answer must not change. That is the whole risk of adding an index:
// none, unless it does.
const withIndex = db.prepare(PR_QUERY).all("Bench Press");

db.exec("DROP INDEX exercise_instance_name_idx;");
const withoutIndex = db.prepare(PR_QUERY).all("Bench Press");

assert.deepStrictEqual(
  withIndex,
  withoutIndex,
  "the index changed the result, which an index must never do"
);
assert.ok(withIndex.length > 0, "the fixture matched nothing, so nothing was tested");

console.log(
  `Personal record index checks passed (${withIndex.length} rows, plan: ${planWithIndex}).`
);
