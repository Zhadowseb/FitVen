// Covers the pass that takes back strength rows an upload dropped.
//
// uploadDirtyExerciseInstances skips an exercise whose workout cannot be given
// a cloud id at that moment, and the only code that recovers sits behind
// allowParentRepair - which the pass SetSync mounts used to turn off. A row
// skipped once kept needs_sync = 0 and was never looked at again, so its
// workout went on syncing as an empty shell. That is how three months of
// training ended up on one device and nowhere else.
//
// Two things are checked, because either one alone would let it come back:
//
//   1. markUnsyncedStrengthDataForRetry re-marks exactly the stranded rows and
//      nothing else, and a second pass over an install that has since synced
//      changes nothing. Without that second property the repair would re-upload
//      the whole history at every sync, forever.
//   2. The hierarchy push actually calls it, and lets the two lowest levels
//      repair their parent instead of giving up.
//
// The SQL is read out of the repository rather than copied.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const repositoryPath = path.join(
  root,
  "src",
  "Repository",
  "weightliftingRepository.js"
);
const hierarchyPath = path.join(
  root,
  "src",
  "Services",
  "cloudSync",
  "hierarchy.js"
);

const repository = fs.readFileSync(repositoryPath, "utf8");
const hierarchy = fs.readFileSync(hierarchyPath, "utf8");

/* ------------------------------------------------------------- the SQL ---- */

function repairStatements() {
  const start = repository.indexOf(
    "export async function markUnsyncedStrengthDataForRetry("
  );
  assert.ok(
    start !== -1,
    "markUnsyncedStrengthDataForRetry is gone from weightliftingRepository"
  );

  const body = repository.slice(start);
  const statements = [...body.matchAll(/runAsync\(\s*`([\s\S]*?)`\s*\)/g)].map(
    (match) => match[1].trim()
  );

  assert.strictEqual(
    statements.length,
    2,
    "the repair no longer runs one statement for exercises and one for sets"
  );

  return statements;
}

const [EXERCISE_SQL, SET_SQL] = repairStatements();

// A repair that re-marked a row already carrying a cloud id would re-upload the
// whole history at every sync. Both columns have to be asked about: cloud_id is
// read first by resolveSideBySideCloudId and the named one is the fallback, so
// a row holding either is synced.
for (const [label, sql, columns] of [
  ["the exercise repair", EXERCISE_SQL, ["cloud_id", "cloud_exercise_instance_id"]],
  ["the set repair", SET_SQL, ["cloud_id", "cloud_set_id"]],
]) {
  for (const column of columns) {
    assert.ok(
      new RegExp(`${column} IS NULL`).test(sql),
      `${label} does not require ${column} to be empty, so it re-marks rows that are already in the cloud`
    );
  }

  assert.ok(
    /needs_sync <> 1/.test(sql),
    `${label} rewrites rows that are already waiting to be uploaded`
  );

  assert.ok(
    /COALESCE\(deleted_at, ''\) = ''/.test(sql),
    `${label} would push rows the user has deleted back into the cloud`
  );
}

/* ------------------------------------------------------------- fixture ---- */

function createDatabase() {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE Workout_Type_Instance (
      workout_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id INTEGER,
      cloud_workout_type_instance_id INTEGER,
      deleted_at TEXT,
      needs_sync INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE Exercise_Instance (
      exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id INTEGER,
      cloud_exercise_instance_id INTEGER,
      deleted_at TEXT,
      workout_type_instance_id INTEGER NOT NULL,
      needs_sync INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE "Set" (
      sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id INTEGER,
      cloud_set_id INTEGER,
      deleted_at TEXT,
      exercise_instance_id INTEGER NOT NULL,
      needs_sync INTEGER NOT NULL DEFAULT 1
    );
  `);

  return db;
}

// Every state a cloud id column is known to reach on a real install: never
// uploaded, uploaded under the current column, uploaded under the legacy one.
const CLOUD_ID_STATES = [
  { label: "no cloud id", cloudId: null, legacyCloudId: null, synced: false },
  { label: "cloud_id set", cloudId: 4001, legacyCloudId: null, synced: true },
  { label: "legacy column set", cloudId: null, legacyCloudId: 4002, synced: true },
];

const WORKOUTS = [];

for (const cloud of CLOUD_ID_STATES) {
  for (const deletedAt of [null, "2026-09-20T10:00:00.000Z"]) {
    WORKOUTS.push({ cloud, deletedAt });
  }
}

const EXERCISES = [];

for (const cloud of CLOUD_ID_STATES) {
  for (const deletedAt of [null, "2026-09-20T10:00:00.000Z"]) {
    for (const needsSync of [0, 1]) {
      EXERCISES.push({ cloud, deletedAt, needsSync });
    }
  }
}

function seed(db) {
  const insertWorkout = db.prepare(
    `INSERT INTO Workout_Type_Instance
       (cloud_id, cloud_workout_type_instance_id, deleted_at, needs_sync)
     VALUES (?, ?, ?, 0);`
  );
  const insertExercise = db.prepare(
    `INSERT INTO Exercise_Instance
       (cloud_id, cloud_exercise_instance_id, deleted_at, workout_type_instance_id, needs_sync)
     VALUES (?, ?, ?, ?, ?);`
  );
  const insertSet = db.prepare(
    `INSERT INTO "Set"
       (cloud_id, cloud_set_id, deleted_at, exercise_instance_id, needs_sync)
     VALUES (?, ?, ?, ?, ?);`
  );

  const rows = { exercises: [], sets: [] };

  for (const workout of WORKOUTS) {
    const workoutId = Number(
      insertWorkout.run(
        workout.cloud.cloudId,
        workout.cloud.legacyCloudId,
        workout.deletedAt
      ).lastInsertRowid
    );

    for (const exercise of EXERCISES) {
      const exerciseId = Number(
        insertExercise.run(
          exercise.cloud.cloudId,
          exercise.cloud.legacyCloudId,
          exercise.deletedAt,
          workoutId,
          exercise.needsSync
        ).lastInsertRowid
      );

      rows.exercises.push({ id: exerciseId, workout, exercise });

      for (const set of EXERCISES) {
        const setId = Number(
          insertSet.run(
            set.cloud.cloudId,
            set.cloud.legacyCloudId,
            set.deletedAt,
            exerciseId,
            set.needsSync
          ).lastInsertRowid
        );

        rows.sets.push({ id: setId, exerciseRow: { exercise }, set });
      }
    }
  }

  return rows;
}

/** The answer, worked out here rather than asked of the SQL. */
function shouldReMarkExercise(row) {
  return (
    row.exercise.needsSync !== 1 &&
    !row.exercise.cloud.synced &&
    row.exercise.deletedAt === null &&
    row.workout.cloud.synced &&
    row.workout.deletedAt === null
  );
}

function shouldReMarkSet(row) {
  return (
    row.set.needsSync !== 1 &&
    !row.set.cloud.synced &&
    row.set.deletedAt === null &&
    // The parent only has to still exist. A set under an exercise that is
    // itself stranded is marked too, and waits for the level above it.
    row.exerciseRow.exercise.deletedAt === null
  );
}

/* ----------------------------------------------------- the repair repairs -- */

const db = createDatabase();
const rows = seed(db);

db.exec(EXERCISE_SQL);
db.exec(SET_SQL);

function needsSyncById(table, idColumn) {
  const byId = new Map();

  for (const row of db.prepare(`SELECT ${idColumn}, needs_sync FROM ${table};`).all()) {
    byId.set(Number(row[idColumn]), Number(row.needs_sync));
  }

  return byId;
}

const exerciseFlags = needsSyncById("Exercise_Instance", "exercise_instance_id");
const setFlags = needsSyncById('"Set"', "sets_id");

let reMarkedExercises = 0;

for (const row of rows.exercises) {
  const expected = shouldReMarkExercise(row) || row.exercise.needsSync === 1 ? 1 : 0;

  assert.strictEqual(
    exerciseFlags.get(row.id),
    expected,
    `exercise under a ${row.workout.cloud.label} workout` +
      `${row.workout.deletedAt ? " (deleted)" : ""}, itself ${row.exercise.cloud.label}` +
      `${row.exercise.deletedAt ? " (deleted)" : ""} at needs_sync ${row.exercise.needsSync}` +
      ` came out of the repair wrong`
  );

  reMarkedExercises += shouldReMarkExercise(row) ? 1 : 0;
}

let reMarkedSets = 0;

for (const row of rows.sets) {
  const expected = shouldReMarkSet(row) || row.set.needsSync === 1 ? 1 : 0;

  assert.strictEqual(
    setFlags.get(row.id),
    expected,
    `set that is ${row.set.cloud.label}${row.set.deletedAt ? " (deleted)" : ""}` +
      ` at needs_sync ${row.set.needsSync} came out of the repair wrong`
  );

  reMarkedSets += shouldReMarkSet(row) ? 1 : 0;
}

// The fixture has to actually contain the case the repair exists for, or the
// assertions above would pass over an empty set.
assert.ok(
  reMarkedExercises > 0 && reMarkedSets > 0,
  "the fixture no longer holds a stranded row, so nothing was proved"
);

/* ----------------------------------------------------------- it settles ---- */

// What the install looks like once the upload has run: every row that was
// marked now carries a cloud id. Nothing may be re-marked after that, or the
// repair re-uploads the whole history at every sync for the rest of time.
db.exec(`
  UPDATE Exercise_Instance
     SET cloud_exercise_instance_id = 9000 + exercise_instance_id, needs_sync = 0
   WHERE needs_sync = 1 AND COALESCE(deleted_at, '') = '';
  UPDATE "Set"
     SET cloud_set_id = 9000 + sets_id, needs_sync = 0
   WHERE needs_sync = 1 AND COALESCE(deleted_at, '') = '';
`);

function snapshot() {
  return JSON.stringify([
    db
      .prepare(
        `SELECT exercise_instance_id AS id, needs_sync FROM Exercise_Instance ORDER BY id;`
      )
      .all(),
    db
      .prepare(`SELECT sets_id AS id, needs_sync FROM "Set" ORDER BY id;`)
      .all(),
  ]);
}

const before = snapshot();

db.exec(EXERCISE_SQL);
db.exec(SET_SQL);

assert.strictEqual(
  snapshot(),
  before,
  "the repair marks rows again on an install that has finished syncing, so it would never stop uploading"
);

/* --------------------------------------------------- the push calls it ----- */

assert.ok(
  /markUnsyncedStrengthDataForRetry\(db\)/.test(hierarchy),
  "the hierarchy push no longer takes back the rows an earlier pass dropped"
);

const pushBody = hierarchy.slice(
  hierarchy.indexOf("async function pushDirtyProgramHierarchyWithCloudInternal(")
);
const repairIndex = pushBody.indexOf("markUnsyncedStrengthDataForRetry");
const firstUploadIndex = pushBody.indexOf("uploadDirtyPrograms");

assert.ok(
  repairIndex !== -1 && firstUploadIndex !== -1 && repairIndex < firstUploadIndex,
  "the repair runs after the uploads, so the rows it marks wait a whole sync"
);

// Without this the skip is permanent: a workout that is not dirty and has no
// cloud row is not reached by any of the levels above, and the exercises under
// it have nowhere else to be repaired from.
for (const upload of ["uploadDirtyExerciseInstances", "uploadDirtySets"]) {
  const match = pushBody.match(
    new RegExp(`${upload}\\(db, userId, \\{\\s*allowParentRepair: (true|false)`)
  );

  assert.ok(match, `${upload} is no longer called with an allowParentRepair setting`);

  assert.strictEqual(
    match[1],
    "true",
    `${upload} gives up when its parent has no cloud id, which is what stranded the exercises`
  );
}

console.log(
  `Stuck strength sync: the repair took back ${reMarkedExercises} exercises and ${reMarkedSets} sets, left a synced install alone, and the push runs it.`
);
