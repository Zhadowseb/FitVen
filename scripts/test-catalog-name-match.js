// An exercise is matched to the catalog by name, without regard to case.
//
// The phone stores an exercise instance's name as it was written - by the
// catalog, by the user, by another phone - and looks its catalog row up with
// `name = ? COLLATE NOCASE`. Two things went wrong with that:
//
//   1. getLiveWorkoutSets joined the catalog with a plain `=`, so "seated
//      press" found nothing under "Seated Press", and the lock-screen card
//      fell back from the machine's 5 kg step to the name's guess.
//   2. The UNIQUE index on Exercise.name compares exactly, and SQLite cannot
//      use it for a NOCASE comparison: every one of these lookups read the
//      whole catalog. lower() on both sides cannot use it either.
//      exercise_name_nocase_idx (schema/weightlifting.js) is an index in the
//      same collation as the lookups, which can.
//
// And copying a week asked the catalog once per exercise, one after the
// other; it now asks once per workout (getExerciseCatalogWeightModes).
//
// The real schema in node:sqlite, and the real repository and service.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

// Signed out, as far as Supabase knows: the uploads a copy queues stop at
// "no user", and nothing reaches the network.
loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from() {
      throw new Error("a copy reached for the cloud while signed out");
    },
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  }),
  processLock: () => {},
});
loadAppModule.stubModule("react-native", {
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) },
  I18nManager: {},
  NativeModules: {},
});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    getAllKeys: async () => [],
    multiRemove: async () => {},
  },
});
loadAppModule.stubModule("expo-location", {
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
});
loadAppModule.stubModule("expo-notifications", {
  setNotificationHandler() {},
  getPermissionsAsync: async () => ({ status: "denied" }),
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const { liveWeightStepFor } = loadAppModule("src/Utils/liveWorkout.js");

/** node:sqlite behind expo-sqlite's API, recording every statement and its plan. */
function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const statements = [];
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );
  const record = (sql, params) => {
    const plan = /^\s*(SELECT|WITH|UPDATE|DELETE)\b/i.test(sql)
      ? sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...bind(params)).map((row) => row.detail)
      : [];
    statements.push({ sql, plan });
  };

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  // A copied workout copies its run sets too.
  sqlite.exec(runningSchemaSql);

  return {
    databasePath: "test-catalog-name-match",
    sqlite,
    statements,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      record(sql, params);
      const result = sqlite.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(sql, params) {
      record(sql, params);
      return sqlite.prepare(sql).all(...bind(params));
    },
    async getFirstAsync(sql, params) {
      record(sql, params);
      return sqlite.prepare(sql).get(...bind(params)) ?? null;
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
  };
}

const insert = (db, sql, ...params) => Number(db.sqlite.prepare(sql).run(...params).lastInsertRowid);

function catalog(db) {
  // The catalog's rows, and a custom exercise the user named with other
  // casing: Exercise.name is UNIQUE only exactly, so both can be there.
  for (const [name, equipment, weightMode, isCustom] of [
    ["Seated Press", "machine", "total", 0],
    ["seated press", null, "total", 1],
    ["Dumbbell Press", "dumbbell", "per_side", 0],
    ["Squat", "barbell", "total", 0],
  ]) {
    insert(
      db,
      "INSERT INTO Exercise (name, equipment, weight_mode, is_custom, official) VALUES (?, ?, ?, ?, ?)",
      name,
      equipment,
      weightMode,
      isCustom,
      isCustom ? 0 : 1
    );
  }
}

const usesTheNocaseIndex = (plan) => plan.some((line) => /\bexercise_name_nocase_idx\b/.test(line));

async function liveWorkoutSetsFindTheCatalogWhateverTheCase() {
  const db = createDatabase();
  catalog(db);

  const workoutId = insert(
    db,
    "INSERT INTO Workout_Type_Instance (day_id, date, workout_type, label) VALUES (1, '27.09.2026', 'Resistance', 'Push')"
  );
  const exerciseId = insert(
    db,
    "INSERT INTO Exercise_Instance (workout_type_instance_id, exercise_name, exercise_order, sets) VALUES (?, 'SEATED PRESS', 1, 2)",
    workoutId
  );
  insert(db, 'INSERT INTO "Set" (exercise_instance_id, set_number, weight, reps) VALUES (?, 1, 50, 10), (?, 2, 50, 10)', exerciseId, exerciseId);

  const rows = await repository.getLiveWorkoutSets(db, workoutId);

  assert.strictEqual(rows.length, 2, "two catalog names that differ only in case repeated every set");
  assert.deepStrictEqual(
    rows.map((row) => row.exercise_equipment),
    ["machine", "machine"],
    "the catalog's equipment was not found under another casing of the name"
  );
  assert.strictEqual(
    liveWeightStepFor({ name: rows[0].exercise_name, equipment: rows[0].exercise_equipment }),
    5,
    "the card's step comes from the machine, which the name alone does not say"
  );
  assert.strictEqual(liveWeightStepFor({ name: rows[0].exercise_name, equipment: null }), 2.5, "this test would prove nothing");

  const plan = db.statements.find((statement) => /AS exercise_equipment/.test(statement.sql)).plan;
  assert.ok(usesTheNocaseIndex(plan), `getLiveWorkoutSets reads the whole catalog:\n${plan.join("\n")}`);
}

async function everyLookupByNameUsesTheIndex() {
  const db = createDatabase();
  catalog(db);

  // The functions in the repository that find a catalog row by name
  // (getDirtyExerciseFavourites too, whose table db.js makes, not the schema).
  const lookups = {
    getExerciseCatalogEntryByName: () => repository.getExerciseCatalogEntryByName(db, "squat"),
    getExerciseCatalogWeightModes: () => repository.getExerciseCatalogWeightModes(db, ["squat", "seated press"]),
    getCompletedSetsForGymLifts: () => repository.getCompletedSetsForGymLifts(db, 1),
    getExercisesByWorkout: () => repository.getExercisesByWorkout(db, 1),
    getWorkoutClassificationExercises: () => repository.getWorkoutClassificationExercises(db, 1),
    getProgramMuscleLoadExercises: () => repository.getProgramMuscleLoadExercises(db, 1),
    getExerciseWeightModeContext: () =>
      repository.getExerciseWeightModeContext(db, { exerciseId: 1, preferenceUserId: "user" }),
    getDirtyExerciseColumnPreferences: () => repository.getDirtyExerciseColumnPreferences(db, "user"),
    updateExerciseWeightMode: () => repository.updateExerciseWeightMode(db, { exerciseName: "squat", weightMode: "total" }),
  };

  for (const [name, lookup] of Object.entries(lookups)) {
    db.statements.length = 0;
    await lookup();
    const catalogQueries = db.statements.filter((statement) => /\bExercise\b(?!_)/.test(statement.sql) && /COLLATE NOCASE/.test(statement.sql));

    assert.ok(catalogQueries.length > 0, `${name} no longer looks the catalog up by name; update this test`);
    for (const { plan } of catalogQueries) {
      assert.ok(usesTheNocaseIndex(plan), `${name} reads the whole catalog:\n${plan.join("\n")}`);
    }
  }

  // And the index is the one the lookups need, in their collation.
  const index = db.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'exercise_name_nocase_idx'").get();
  assert.ok(index && /\(\s*name\s+COLLATE\s+NOCASE\s*\)/i.test(index.sql), "exercise_name_nocase_idx is gone from the schema");
}

async function weightModesForAWholeWorkoutAtOnce() {
  const db = createDatabase();
  catalog(db);

  const rows = await repository.getExerciseCatalogWeightModes(db, [
    "dumbbell press",
    "Unknown exercise",
    "Dumbbell Press",
    "dumbbell press",
    null,
  ]);

  assert.deepStrictEqual(
    rows.map((row) => ({ ...row })),
    [
      { exercise_name: "dumbbell press", weight_mode: "per_side" },
      { exercise_name: "Unknown exercise", weight_mode: null },
      { exercise_name: "Dumbbell Press", weight_mode: "per_side" },
    ],
    "one row per distinct name, as asked for, matched without regard to case"
  );
  assert.deepStrictEqual(await repository.getExerciseCatalogWeightModes(db, []), []);

  // The same answer as the one-name lookup, for every name.
  for (const name of ["seated press", "SEATED PRESS", "Squat", "Unknown exercise"]) {
    const [batch] = await repository.getExerciseCatalogWeightModes(db, [name]);
    const single = await repository.getExerciseCatalogEntryByName(db, name);
    assert.strictEqual(batch.weight_mode, single?.weight_mode ?? null, name);
  }
}

async function copyingAWeekAsksTheCatalogOncePerWorkout() {
  const db = createDatabase();
  catalog(db);

  const programService = loadAppModule("src/Services/programService.js");
  const programId = insert(db, "INSERT INTO Program (program_name, start_date, status) VALUES ('Strength', '21.09.2026', 'ACTIVE')");
  const mesocycleId = insert(db, "INSERT INTO Mesocycle (program_id, mesocycle_number, weeks) VALUES (?, 1, 2)", programId);
  const [sourceWeek, targetWeek] = [1, 2].map((number) =>
    insert(db, "INSERT INTO Microcycle (mesocycle_id, microcycle_number) VALUES (?, ?)", mesocycleId, number)
  );
  const day = (microcycleId, weekday, date) =>
    insert(db, "INSERT INTO Day (microcycle_id, program_id, Weekday, date) VALUES (?, ?, ?, ?)", microcycleId, programId, weekday, date);
  const monday = day(sourceWeek, "Monday", "21.09.2026");
  const tuesday = day(sourceWeek, "Tuesday", "22.09.2026");
  day(targetWeek, "Monday", "28.09.2026");
  day(targetWeek, "Tuesday", "29.09.2026");

  const workout = (dayId, date, exercises) => {
    const workoutId = insert(
      db,
      "INSERT INTO Workout_Type_Instance (day_id, date, workout_type, label) VALUES (?, ?, 'Resistance', 'Resistance')",
      dayId,
      date
    );
    exercises.forEach(([name, weight], index) => {
      const exerciseId = insert(
        db,
        "INSERT INTO Exercise_Instance (workout_type_instance_id, exercise_name, exercise_order, sets, weight_mode) VALUES (?, ?, ?, 1, 'total')",
        workoutId,
        name,
        index + 1
      );
      insert(db, 'INSERT INTO "Set" (exercise_instance_id, set_number, weight, reps) VALUES (?, 1, ?, 8)', exerciseId, weight);
    });
  };
  // Written for both sides before the dumbbell press was switched to per side.
  workout(monday, "21.09.2026", [["dumbbell press", 40], ["Seated Press", 50], ["Squat", 100]]);
  workout(tuesday, "22.09.2026", [["Dumbbell Press", 30], ["seated press", 45]]);

  db.statements.length = 0;
  await programService.copyMicrocycleWorkouts(db, { sourceMicrocycleId: sourceWeek, targetMicrocycleId: targetWeek });

  const oneNameLookups = db.statements.filter((statement) => /FROM Exercise\s+WHERE name = \? COLLATE NOCASE/.test(statement.sql));
  const workoutLookups = db.statements.filter((statement) => /WITH requested\(name\)/.test(statement.sql));
  assert.strictEqual(oneNameLookups.length, 0, "copying a week still asks the catalog once per exercise");
  assert.strictEqual(workoutLookups.length, 2, "one catalog lookup per copied workout");

  const copied = db.sqlite
    .prepare(
      `SELECT e.exercise_name, e.weight_mode, s.weight
       FROM Exercise_Instance e
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       JOIN "Set" s ON s.exercise_instance_id = e.exercise_instance_id
       WHERE d.microcycle_id = ?
       ORDER BY d.date, e.exercise_order`
    )
    .all(targetWeek)
    .map((row) => ({ ...row }));

  assert.deepStrictEqual(copied, [
    { exercise_name: "dumbbell press", weight_mode: "per_side", weight: 20 },
    { exercise_name: "Seated Press", weight_mode: "total", weight: 50 },
    { exercise_name: "Squat", weight_mode: "total", weight: 100 },
    { exercise_name: "Dumbbell Press", weight_mode: "per_side", weight: 15 },
    { exercise_name: "seated press", weight_mode: "total", weight: 45 },
  ], "the copy is written the way each exercise is written now");
}

(async () => {
  await liveWorkoutSetsFindTheCatalogWhateverTheCase();
  await everyLookupByNameUsesTheIndex();
  await weightModesForAWholeWorkoutAtOnce();
  await copyingAWeekAsksTheCatalogOncePerWorkout();

  console.log(
    "Catalog name match: the lock-screen sets find the catalog's equipment whatever the case, once per set; " +
      "every lookup by name searches exercise_name_nocase_idx; and copying a week asks the catalog once per workout."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
