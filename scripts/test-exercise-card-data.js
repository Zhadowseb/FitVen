// What the exercise card's two panels read: the history table, the note from
// last time, and the heaviest lift behind the records shortcut.
//
// The table's shaping is pure and tested directly. The three queries run
// against the real schema in an in-memory SQLite, because each one has a rule
// that looks right in the SQL and is easy to get wrong in it: which session
// counts as "last time", which sets may be the heaviest, and that the table
// never shows a warm-up.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const table = loadAppModule("src/Utils/exerciseHistoryTable.js");
const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

/* ---------------------------------------------------------- the table ---- */

const rows = [
  // Newest session: two warm-ups, three working sets, one AMRAP that was a record.
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "warmup", weight: 40, reps: 10 },
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "warmup", weight: 60, reps: 6 },
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "working", weight: 80, reps: 8 },
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "working", weight: 85, reps: 6 },
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "drop", weight: 67.5, reps: 6 },
  { exercise_instance_id: 3, workout_id: 30, performed_date_sort: "2026-09-18", set_type: "working", amrap: 1, weight: 85, reps: 9, personal_record: 1 },
  // Older: two sets.
  { exercise_instance_id: 2, workout_id: 20, performed_date_sort: "2026-09-15", set_type: "working", weight: 80, reps: 8 },
  { exercise_instance_id: 2, workout_id: 20, performed_date_sort: "2026-09-15", set_type: "working", weight: 80, reps: 7 },
  // Oldest: nothing but warm-ups.
  { exercise_instance_id: 1, workout_id: 10, performed_date_sort: "2026-09-12", set_type: "warmup", weight: 40, reps: 10 },
];

const built = table.buildExerciseHistoryTable(rows);

assert.deepStrictEqual(
  built.sessions.map((session) => session.id),
  [3, 2],
  "sessions are out of order, or one with nothing but warm-ups was drawn as a row of empty cells"
);

const newest = built.sessions[0];

assert.strictEqual(newest.sets.length, 4, "a warm-up is in the history table");
assert.deepStrictEqual(
  newest.sets.map((set) => set.setNumber),
  [1, 2, 3, 4],
  "sets are numbered with the warm-ups still counted"
);
assert.deepStrictEqual(
  newest.sets.map((set) => set.setType),
  ["working", "working", "drop", "amrap"],
  "a set's type did not survive into the table - the old-client AMRAP flag was lost"
);

assert.strictEqual(
  built.maxSets,
  4,
  "the column count is not the widest session - it has to be a set number, not a sum"
);

// A record outranks its type: the gold is what is worth seeing.
assert.strictEqual(table.historyCellTone(newest.sets[3]), "record");
assert.strictEqual(table.historyCellTone(newest.sets[2]), "drop");
assert.strictEqual(table.historyCellTone({ setType: "amrap" }), "amrap");
assert.strictEqual(table.historyCellTone(newest.sets[0]), "plain");

assert.deepStrictEqual(table.buildExerciseHistoryTable([]), { sessions: [], maxSets: 0 });

/* --------------------------------------------------------- the queries --- */

const raw = new DatabaseSync(":memory:");
raw.exec(programSchemaSql);
raw.exec(weightliftingSchemaSql);

const db = {
  getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => raw.prepare(sql).get(...params) ?? null,
};

let nextId = 1;

function session({ date, done = 1, note = null, sets = [] }) {
  const id = nextId++;

  raw.prepare("INSERT INTO Day (day_id, date, Weekday) VALUES (?, ?, 'Monday')").run(id, date);
  raw
    .prepare(
      "INSERT INTO Workout_Type_Instance (workout_id, day_id, date, done) VALUES (?, ?, ?, ?)"
    )
    .run(id, id, date, done);
  raw
    .prepare(
      "INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, note) VALUES (?, ?, 'Bench', ?)"
    )
    .run(id, id, note);

  sets.forEach((set, index) => {
    raw
      .prepare(
        `INSERT INTO "Set" (exercise_instance_id, set_number, weight, reps, done, set_type)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(id, index + 1, set.weight, set.reps, set.type ?? "working");
  });

  return id;
}

(async () => {
  const early = session({ date: "01.09.2026", note: "Shoulder felt off" });
  const middle = session({
    date: "2026-09-15",
    note: null,
    sets: [
      { weight: 85, reps: 6 },
      { weight: 120, reps: 3, type: "warmup" },
      { weight: 110, reps: 1, type: "drop" },
    ],
  });
  const today = session({ date: "2026-09-18", note: "Paused reps" });
  const later = session({ date: "2026-09-25", note: "Newer than today" });

  // "Last time" is the previous session only. Its note was empty, so there is
  // no box - not the older note from two sessions back.
  const previous = await repository.getPreviousExerciseSession(db, {
    exerciseName: "Bench",
    beforeWorkoutId: today,
  });

  assert.strictEqual(
    previous.exercise_instance_id,
    middle,
    "'last time' is not the session immediately before the one being looked at"
  );
  assert.strictEqual(previous.note, null);

  // Relative to the workout being looked at: opening the later workout, its
  // previous session is today's.
  const fromLater = await repository.getPreviousExerciseSession(db, {
    exerciseName: "bench",
    beforeWorkoutId: later,
  });

  assert.strictEqual(
    fromLater.exercise_instance_id,
    today,
    "'last time' ignores which workout it is being shown for"
  );

  // Opening an old workout does not show a note written after it.
  const fromEarly = await repository.getPreviousExerciseSession(db, {
    exerciseName: "Bench",
    beforeWorkoutId: early,
  });

  assert.strictEqual(fromEarly, null, "an old workout shows a note written after it as 'last time'");

  // The heaviest lift: a warm-up and a drop set heavier than any working set
  // must not be it.
  const heaviest = await repository.getHeaviestLiftForExercise(db, "Bench");

  assert.deepStrictEqual(
    { weight: heaviest.weight, reps: heaviest.reps },
    { weight: 85, reps: 6 },
    "the records shortcut shows a warm-up or a drop set as the heaviest lift"
  );

  console.log(
    "Exercise card data: the history table, 'last time', and the heaviest lift passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
