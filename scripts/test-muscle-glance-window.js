// Home's muscle glance reads two thirty-day windows and nothing earlier.
//
// It used to pull every completed set ever logged, a five-table join with no
// date bound, on every return to Home - and throw nine tenths of it away in
// JavaScript. On a phone with three months of history that was most of the
// two seconds before anything showed on the screen.
//
// This runs the real repository query against an in-memory SQLite rather than
// reading its text, because the one thing that can quietly go wrong here is
// the date comparison: the Day.date column holds both "2026-09-20" and
// "01.08.2026", and a bound that only understood one of them would drop half
// the window without a single error.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const raw = new DatabaseSync(":memory:");

raw.exec(`
  CREATE TABLE Program (program_id INTEGER PRIMARY KEY, program_name TEXT);
  CREATE TABLE Day (day_id INTEGER PRIMARY KEY, date TEXT, program_id INTEGER, deleted_at TEXT);
  CREATE TABLE Workout_Type_Instance (
    workout_id INTEGER PRIMARY KEY, day_id INTEGER, label TEXT, deleted_at TEXT
  );
  CREATE TABLE Exercise_Instance (
    exercise_instance_id INTEGER PRIMARY KEY, workout_type_instance_id INTEGER,
    exercise_name TEXT, deleted_at TEXT
  );
  CREATE TABLE "Set" (
    sets_id INTEGER PRIMARY KEY, exercise_instance_id INTEGER, weight REAL,
    reps INTEGER, done INTEGER, failed INTEGER, personal_record INTEGER, deleted_at TEXT
  );
`);

// One set per day, in both spellings the column is known to hold.
const DAYS = [
  { date: "2026-09-20", inWindow: true },
  { date: "01.08.2026", inWindow: true },
  { date: "24.07.2026", inWindow: true }, // the bound itself is included
  { date: "2026-07-23", inWindow: false },
  { date: "15.03.2026", inWindow: false },
];

DAYS.forEach((day, index) => {
  const id = index + 1;

  raw.prepare("INSERT INTO Day VALUES (?, ?, NULL, NULL)").run(id, day.date);
  raw.prepare("INSERT INTO Workout_Type_Instance VALUES (?, ?, 'W', NULL)").run(id, id);
  raw.prepare("INSERT INTO Exercise_Instance VALUES (?, ?, 'Squat', NULL)").run(id, id);
  raw.prepare('INSERT INTO "Set" VALUES (?, ?, 100, 5, 1, 0, 0, NULL)').run(id, id);
});

const db = {
  getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
};

(async () => {
  // Records: unchanged, everything there is.
  const everything = await repository.getCompletedStrengthSetsForPersonalRecords(db);

  assert.strictEqual(
    everything.length,
    DAYS.length,
    "without a bound the query no longer returns the whole history - Records would lose its oldest sets"
  );

  // Home: the window and nothing else, whichever way the date is written.
  const bounded = await repository.getCompletedStrengthSetsForPersonalRecords(db, {
    sinceIsoDate: "2026-07-24",
  });
  const returned = new Set(bounded.map((row) => row.performed_date));

  for (const day of DAYS) {
    assert.strictEqual(
      returned.has(day.date),
      day.inWindow,
      day.inWindow
        ? `${day.date} is inside the window and was dropped - the bound misreads that spelling`
        : `${day.date} is before the window and was still read`
    );
  }

  console.log(
    `Muscle glance window: ${everything.length} sets unbounded, ${bounded.length} inside the window, both date spellings respected.`
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
