// The weight bar over the keyboard, and the step it keeps for an exercise.
//
// While a weight is edited, minus, plus and a small field with the step sit in
// the global keyboard toolbar (Resources/Components/SetEditorBar), driven by the
// set list that owns the field through a store (Utils/setEditorBar.js). What
// is typed in the step field is kept for the exercise and the user - in
// Exercise_Column_Preference.weight_step, synced like weight_mode - and is read
// by the set list and the lock screen.
//
// Run for real here: the rules of the step field (Utils/weightStep.js), the
// store's lifecycle, and the service and sync against a real SQLite database
// and a small in-memory cloud that can lack the column. Read as text: the
// wiring that needs a phone (the toolbar, the cell's handle, App.js), the
// migration and the strings. Nothing here has run on a device.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

/* ------------------------------------------------- the step field's rules -- */

const steps = loadAppModule("src/Utils/weightStep.js");

assert.deepStrictEqual(steps.parseWeightStepInput("2"), { action: "set", step: 2 });
assert.deepStrictEqual(steps.parseWeightStepInput("1,25"), { action: "set", step: 1.25 }, "a Danish decimal comma");
assert.deepStrictEqual(steps.parseWeightStepInput("1.25"), { action: "set", step: 1.25 });
assert.deepStrictEqual(steps.parseWeightStepInput("1,3"), { action: "set", step: 1.25 }, "rounded to a quarter kilo");
assert.deepStrictEqual(steps.parseWeightStepInput("0,1"), { action: "set", step: 0.25 }, "under the range: the smallest step");
assert.deepStrictEqual(steps.parseWeightStepInput("80"), { action: "set", step: 50 }, "over the range: the largest step");
assert.deepStrictEqual(steps.parseWeightStepInput(""), { action: "clear" }, "empty: automatic again");
assert.deepStrictEqual(steps.parseWeightStepInput("   "), { action: "clear" });
assert.deepStrictEqual(steps.parseWeightStepInput(null), { action: "clear" });
assert.deepStrictEqual(steps.parseWeightStepInput("0"), { action: "keep" }, "0 is not a step: the field goes back");
assert.deepStrictEqual(steps.parseWeightStepInput("abc"), { action: "keep" });
assert.deepStrictEqual(steps.parseWeightStepInput("-2"), { action: "set", step: 2 }, "a stray minus is dropped, as in a weight");

assert.strictEqual(steps.weightStepToStore({ action: "set", step: 1.25 }), 1.25);
assert.strictEqual(steps.weightStepToStore({ action: "clear" }), 0, "automatic is stored as 0 and never as null");
assert.strictEqual(steps.AUTOMATIC_WEIGHT_STEP, 0);

assert.strictEqual(steps.storedWeightStep(1.25), 1.25);
assert.strictEqual(steps.storedWeightStep("2"), 2);
assert.strictEqual(steps.storedWeightStep(0), null, "0 is automatic");
assert.strictEqual(steps.storedWeightStep(null), null);
assert.strictEqual(steps.storedWeightStep(-1), null);
assert.strictEqual(steps.storedWeightStep(900), 50);

// The chosen step wins over every automatic rule - and 0 over none.
assert.strictEqual(steps.getWeightStep({ name: "Squat", weightStep: 1.25 }), 1.25);
assert.strictEqual(steps.getWeightStep({ name: "Squat", weightStep: 0 }), 5, "a cleared step: the automatic one again");
assert.strictEqual(steps.getWeightStep({ name: "Dumbbell Curl", weightStep: null }), 2);

// The cloud column.
const missingRead = { code: "42703", message: "column exercise_column_preferences.weight_step does not exist" };
const missingWrite = {
  code: "PGRST204",
  message: "Could not find the 'weight_step' column of 'exercise_column_preferences' in the schema cache",
};
assert.strictEqual(steps.isMissingWeightStepColumnError(missingRead), true);
assert.strictEqual(steps.isMissingWeightStepColumnError(missingWrite), true);
assert.strictEqual(
  steps.isMissingWeightStepColumnError({ code: "42703", message: "column exercise_column_preferences.weight_mode does not exist" }),
  false,
  "another missing column is not this one"
);
assert.strictEqual(steps.isMissingWeightStepColumnError({ code: "23505", message: "weight_step" }), false);
assert.deepStrictEqual(steps.withSendableWeightStep({ a: 1, weight_step: 1.25 }), { a: 1, weight_step: 1.25 });
assert.deepStrictEqual(steps.withSendableWeightStep({ a: 1, weight_step: 0 }), { a: 1, weight_step: 0 }, "0 is sent: that is how a reset reaches the cloud");
assert.deepStrictEqual(steps.withSendableWeightStep({ a: 1, weight_step: null }), { a: 1 }, "null is not sent: it would erase another phone's step");
assert.deepStrictEqual(steps.withSendableWeightStep({ a: 1, weight_step: 2 }, { cloudHasColumn: false }), { a: 1 });

/* ---------------------------------------------------- the reps carousel -- */

const carousel = loadAppModule("src/Utils/repsCarousel.js");

assert.strictEqual(carousel.repsAsNumber("12"), 12);
assert.strictEqual(carousel.repsAsNumber(8.7), 8);
assert.strictEqual(carousel.repsAsNumber(""), 0);
assert.strictEqual(carousel.repsAsNumber(null), 0);
assert.strictEqual(carousel.repsAsNumber("abc"), 0);
assert.strictEqual(carousel.repsAsNumber(-3), 0);
// The strip goes on as far as a finger does: the numbers to draw around the one
// in the middle, none under 0. Two show on each side; the rest are the buffer.
assert.deepStrictEqual(carousel.visibleRepsWindow(8, 6), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
assert.deepStrictEqual(carousel.visibleRepsWindow("12", 2), [10, 11, 12, 13, 14], "typed 12");
assert.deepStrictEqual(carousel.visibleRepsWindow(1, 3), [0, 1, 2, 3, 4], "nothing under 0");
assert.deepStrictEqual(carousel.visibleRepsWindow("", 2), [0, 1, 2], "nothing typed is 0");

// Where the strip is while a finger drags it: freely to the left, to the right
// only as far as 0 and a little give. It starts from where the strip was, which
// is not a whole number when a finger lands on a strip that is still gliding.
assert.strictEqual(carousel.scrollPositionFor(8 * 44, -500, 44), 8 * 44 + 500, "towards more: free, as far as the finger goes");
assert.strictEqual(carousel.scrollPositionFor(8 * 44, 100, 44), 8 * 44 - 100, "towards fewer: with the finger");
assert.strictEqual(carousel.scrollPositionFor(2 * 44, 400, 44), -44 * 0.3, "no further than 0 and a little give");
assert.strictEqual(carousel.scrollPositionFor(0, 90, 44), -44 * 0.3);
assert.strictEqual(carousel.scrollPositionFor(8.4 * 44, -10, 44), 8.4 * 44 + 10, "from a strip that was between two numbers");

// The count at a position, for as long as a number is in the middle.
assert.strictEqual(carousel.repsAtScroll(8 * 44, 44), 8);
assert.strictEqual(carousel.repsAtScroll(8.49 * 44, 44), 8);
assert.strictEqual(carousel.repsAtScroll(8.51 * 44, 44), 9, "the number passes the middle half way between two");
assert.strictEqual(carousel.repsAtScroll(-0.3 * 44, 44), 0, "never below 0");
assert.strictEqual(carousel.repsAtScroll(400 * 44, 44), 400, "as far as a finger goes");

// Letting go: the nearest number, pushed on by how fast it was going.
assert.strictEqual(carousel.settledReps(10 * 44, 0, 44), 10);
assert.strictEqual(carousel.settledReps(9.6 * 44, 0, 44), 10, "9.6 rounds to 10");
assert.strictEqual(carousel.settledReps(9.4 * 44, 0, 44), 9);
assert.ok(carousel.settledReps(9.4 * 44, -1.5, 44) > carousel.settledReps(9.4 * 44, 0, 44), "a fast flick left goes further");
assert.ok(carousel.settledReps(9.4 * 44, 1.5, 44) < carousel.settledReps(9.4 * 44, 0, 44), "released while moving right: it carries that way");
assert.strictEqual(carousel.settledReps(0.5 * 44, 2, 44), 0, "never below 0, however hard");

{
  const columns = (keys) =>
    Object.fromEntries(
      ["note", "rest", "set", "reps", "rpe", "rm_percentage", "weight", "done"].map((key) => [key, keys.includes(key)])
    );

  assert.ok(steps.showsSetEditors(columns(["rest", "set", "reps", "weight", "done"])));
  assert.ok(steps.showsSetEditors(columns(["rest", "set", "reps", "done"])), "a table with no weight still has the carousel");
  assert.ok(!steps.showsSetEditors(columns(["rest", "set", "reps", "weight", "done", "rpe"])), "with RPE the table is as before");
  assert.ok(!steps.showsSetEditors(columns(["set", "reps", "weight", "note"])));
}

/* ----------------------------------------------------- the bar's store -- */

const barStore = loadAppModule("src/Utils/setEditorBar.js");

{
  const store = barStore.createSetEditorBarStore();
  let notified = 0;
  const unsubscribe = store.subscribe(() => {
    notified += 1;
  });
  const OWNER_A = 1;
  const OWNER_B = 2;

  assert.strictEqual(store.get(), null);

  store.open({ ownerId: OWNER_A, setId: 10, step: 2 });
  assert.strictEqual(store.get().setId, 10);
  const shown = store.get();
  assert.strictEqual(store.get(), shown, "the same object until it changes, for useSyncExternalStore");

  // The weight cell blurs because the step field took focus: nothing closes.
  // Only the owner closes it, and only for the set it is about.
  store.update(OWNER_A, 10, { step: 1.25 });
  assert.strictEqual(store.get().step, 1.25);
  store.update(OWNER_B, 10, { step: 99 });
  store.update(OWNER_A, 11, { step: 99 });
  assert.strictEqual(store.get().step, 1.25, "an update for another owner or set changes nothing");

  store.close(OWNER_B);
  assert.ok(store.get(), "another set list's cleanup does not close this bar");
  store.close(OWNER_A, 11);
  assert.ok(store.get(), "nor does the same list's close of another set");

  // Another set's weight opens: it replaces this one.
  store.open({ ownerId: OWNER_B, setId: 20, step: 5 });
  assert.strictEqual(store.get().ownerId, OWNER_B);
  store.close(OWNER_A);
  assert.ok(store.get(), "the first owner's late cleanup does not close the second's bar");

  // A reps cell took focus, the keyboard went away: a close with no owner.
  store.close();
  assert.strictEqual(store.get(), null);

  const before = notified;

  store.close();
  assert.strictEqual(notified, before, "closing what is not open tells nobody");

  // The set was ticked off: its owner closes it.
  store.open({ ownerId: OWNER_A, setId: 10 });
  store.close(OWNER_A, 10);
  assert.strictEqual(store.get(), null);
  // The set list went away.
  store.open({ ownerId: OWNER_A, setId: 10 });
  store.close(OWNER_A);
  assert.strictEqual(store.get(), null);

  // A finger dragging the carousel: the page behind it does not scroll.
  let dragNotified = 0;
  const unsubscribeDrag = store.subscribe(() => {
    dragNotified += 1;
  });

  assert.strictEqual(store.isDragging(), false);
  store.setDragging(true);
  assert.strictEqual(store.isDragging(), true);
  store.setDragging(true);
  assert.strictEqual(dragNotified, 1, "the same answer twice tells nobody");
  store.setDragging(false);
  assert.strictEqual(store.isDragging(), false);
  store.open({ ownerId: OWNER_A, setId: 3 });
  store.setDragging(true);
  store.close();
  assert.strictEqual(store.isDragging(), false, "a bar that goes away takes the drag with it: the page must never stay locked");
  unsubscribeDrag();

  unsubscribe();
  store.open({ ownerId: OWNER_A, setId: 1 });
  assert.ok(notified > 0);

  assert.notStrictEqual(barStore.newSetEditorOwnerId(), barStore.newSetEditorOwnerId(), "one id for each set list");
}

/* ------------------------------------------------ the service and sync -- */

const USER_ID = "user-weight-step";
const CLOUD_EXERCISE_ID = 77;

function createCloud() {
  const state = { hasStepColumn: true, rows: [], writes: [], reads: [] };

  const missingColumn = (value) => /\bweight_step\b/.test(value);
  const from = (table) => {
    assert.strictEqual(table, "exercise_column_preferences", `the weight step reached for ${table}`);
    const query = { columns: "", filters: [] };
    const builder = {
      upsert(payload) {
        state.writes.push(payload);

        if (!state.hasStepColumn && Object.prototype.hasOwnProperty.call(payload, "weight_step")) {
          return Promise.resolve({ error: missingWrite });
        }

        const existing = state.rows.find(
          (row) => row.user_id === payload.user_id && row.exercise_id === payload.exercise_id
        );

        if (existing) {
          Object.assign(existing, payload);
        } else {
          state.rows.push({ ...payload });
        }

        return Promise.resolve({ error: null });
      },
      select(columns) {
        query.columns = columns;
        return builder;
      },
      eq() {
        return builder;
      },
      in(_column, ids) {
        state.reads.push(query.columns);

        if (!state.hasStepColumn && missingColumn(query.columns)) {
          return Promise.resolve({ data: null, error: missingRead });
        }

        const data = state.rows
          .filter((row) => ids.includes(row.exercise_id))
          .map((row) => {
            const copy = { ...row };

            if (!state.hasStepColumn) {
              delete copy.weight_step;
            }

            return copy;
          });

        return Promise.resolve({ data, error: null });
      },
    };

    return builder;
  };

  return { state, from };
}

(async () => {
  {
    const handle = steps.createWeightStepCloudColumn();
    let calls = 0;

    assert.strictEqual(handle.selectColumns("a, b"), "a, b, weight_step");
    assert.strictEqual(
      await handle.withFallback(async () => {
        calls += 1;

        if (calls === 1) {
          throw missingRead;
        }

        return "ran without it";
      }),
      "ran without it"
    );
    assert.strictEqual(calls, 2, "a missing column runs the request once more");
    assert.strictEqual(handle.selectColumns("a, b"), "a, b", "and from then on without the column");
    assert.strictEqual(handle.isAvailable(), false);
    await assert.rejects(
      () =>
        handle.withFallback(async () => {
          throw new Error("boom");
        }),
      /boom/
    );
  }

  const cloud = createCloud();

  loadAppModule.stubModule("@supabase/supabase-js", {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: { user: { id: USER_ID } } }, error: null }),
        getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: cloud.from,
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

  const consoleInfo = console.info;
  const consoleError = console.error;

  console.info = () => {};
  console.error = (...args) => {
    if (typeof args[0] === "string" && /cloud push failed|sync failed/i.test(args[0])) {
      return;
    }

    consoleError(...args);
  };

  const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
  const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
  const service = loadAppModule("src/Services/weightliftingService.js");

  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );
  const db = {
    databasePath: "test-set-editors",
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, params) => {
      const result = raw.prepare(sql).run(...bind(params));

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql, params) => raw.prepare(sql).all(...bind(params)),
    getFirstAsync: async (sql, params) => raw.prepare(sql).get(...bind(params)) ?? null,
    isInTransactionAsync: async () => Boolean(raw.isTransaction),
  };
  const run = (sql, ...params) => raw.prepare(sql).run(...params);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
  const localPreference = () =>
    raw
      .prepare("SELECT weight_step, needs_sync, user_id, cloud_exercise_id FROM Exercise_Column_Preference WHERE exercise_name = 'Bench Press'")
      .get();
  const cloudRow = () => cloud.state.rows.find((row) => row.exercise_id === CLOUD_EXERCISE_ID);

  run("INSERT INTO Program (program_id, program_name, start_date) VALUES (1, 'Plan', '2026-10-01')");
  run("INSERT INTO Mesocycle (mesocycle_id, program_id, mesocycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Day (day_id, microcycle_id, program_id, Weekday, date) VALUES (1, 1, 1, 'Monday', '2026-10-13')");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date) VALUES (1, 1, 'Resistance', 'Push', '2026-10-13')");
  run("INSERT INTO Exercise (name, cloud_exercise_id, equipment, weight_mode) VALUES ('Bench Press', ?, 'barbell', 'total')", CLOUD_EXERCISE_ID);
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, weight_mode)
     VALUES (10, 1, 'Bench Press', 1, 'total')`
  );

  const loadedStep = async () => (await service.getWorkoutExercises(db, 1))[0].weightStep;

  // Nothing chosen: automatic.
  assert.strictEqual(await loadedStep(), null);

  // 1. A step typed in the bar: kept for the exercise, marked for upload, and
  // what the workout loads for it.
  assert.deepStrictEqual(await service.setExerciseWeightStep(db, { exerciseId: 10, step: 1.25 }), { step: 1.25 });
  await settle();
  assert.strictEqual(localPreference().weight_step, 1.25);
  assert.strictEqual(await loadedStep(), 1.25, "the next workout steps by it");
  assert.strictEqual(localPreference().cloud_exercise_id, CLOUD_EXERCISE_ID);

  // The lock screen's rows carry it.
  const liveRows = await loadAppModule("src/Repository/weightliftingRepository.js").getLiveWorkoutSets(db, 1);
  assert.strictEqual(liveRows[0].exercise_weight_step, 1.25, "the lock screen card steps by it too");

  // 2. Up to the cloud, and the dirty flag cleared.
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(cloudRow().weight_step, 1.25, "the step reaches the cloud");
  assert.strictEqual(Number(localPreference().needs_sync), 0);

  // 3. Cleared: 0 locally and in the cloud, never null - and a download does
  // not bring the old step back.
  assert.deepStrictEqual(await service.setExerciseWeightStep(db, { exerciseId: 10, step: 0 }), { step: null });
  await settle();
  assert.strictEqual(localPreference().weight_step, 0);
  assert.strictEqual(await loadedStep(), null, "automatic again");
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(cloudRow().weight_step, 0, "a reset reaches the cloud as 0");
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(localPreference().weight_step, 0, "and the next download keeps it");
  assert.strictEqual(
    (await loadAppModule("src/Repository/weightliftingRepository.js").getLiveWorkoutSets(db, 1))[0].exercise_weight_step,
    null,
    "0 is automatic on the card too"
  );

  // 4. Another phone chose 2: this one takes it.
  cloudRow().weight_step = 2;
  cloudRow().updated_at = new Date(Date.now() + 1000).toISOString();
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(localPreference().weight_step, 2, "the choice made on another phone follows the person");
  assert.strictEqual(await loadedStep(), 2);

  // 5. A cloud row an older app wrote (no step): ours stays, and is not sent as null.
  delete cloudRow().weight_step;
  await service.setExerciseWeightStep(db, { exerciseId: 10, step: 1.5 });
  await settle();
  cloud.state.writes.length = 0;
  delete cloudRow().weight_step;
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(localPreference().weight_step, 1.5, "a null from the cloud keeps the local step");
  assert.ok(
    cloud.state.writes.every((payload) => payload.weight_step !== null),
    "a step that is not known is never sent as null"
  );

  // 6. The migration has not run: syncing goes on without the column, and the
  // step stays on the phone.
  cloud.state.hasStepColumn = false;
  await service.setExerciseWeightStep(db, { exerciseId: 10, step: 2.5 });
  await settle();
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(localPreference().weight_step, 2.5, "the step is still on the phone");
  assert.strictEqual(Number(localPreference().needs_sync), 0, "and the preferences synced without it");
  assert.ok(
    cloud.state.writes.some((payload) => !Object.prototype.hasOwnProperty.call(payload, "weight_step")),
    "a write without the column went out after the first one failed"
  );
  assert.ok(
    cloud.state.reads.length >= 2 && !/weight_step/.test(cloud.state.reads[cloud.state.reads.length - 1]),
    "once the cloud said the column is missing, no read names it"
  );

  // 7. A custom exercise's step stays on the phone: no cloud row to sync.
  run("INSERT INTO Exercise (name, is_custom, weight_mode) VALUES ('My Lift', 1, 'total')");
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, weight_mode)
     VALUES (11, 1, 'My Lift', 2, 'total')`
  );
  cloud.state.hasStepColumn = true;
  await service.setExerciseWeightStep(db, { exerciseId: 11, step: 3 });
  await settle();
  await service.syncExerciseColumnPreferencesWithCloud(db);
  assert.strictEqual(
    raw.prepare("SELECT weight_step FROM Exercise_Column_Preference WHERE exercise_name = 'My Lift'").get().weight_step,
    3
  );
  assert.strictEqual(
    cloud.state.rows.filter((row) => row.exercise_id !== CLOUD_EXERCISE_ID).length,
    0,
    "a custom exercise has no row in the cloud"
  );

  // 8. An exercise that does not exist is a no-op.
  assert.strictEqual(await service.setExerciseWeightStep(db, { exerciseId: 999, step: 2 }), null);

  console.info = consoleInfo;
  console.error = consoleError;

  /* -------------------------------------------------- read as text -- */

  // The migration.
  const migration = read("supabase/migrations/20261014090000_a-step-per-exercise.sql");
  const sql = migration.replace(/--[^\n]*/g, "");

  assert.ok(/^\s*begin;/m.test(sql) && /^\s*commit;\s*$/m.test(sql));
  assert.ok(/add column if not exists weight_step numeric\(5, 2\)/.test(sql), "a nullable column, added once");
  assert.ok(/check \(weight_step is null or weight_step = 0 or \(weight_step >= 0\.25 and weight_step <= 50\)\)/.test(sql), "null, 0 or 0.25-50");
  assert.ok(/validate constraint exercise_column_preferences_weight_step_valid/.test(sql));
  assert.ok(/Safe to run|Idempotent/.test(migration));
  assert.ok(
    read("supabase/migrations/README.md").includes("20261014090000_a-step-per-exercise.sql"),
    "the ledger lists it"
  );

  // The set list: the always-visible steppers and the header's are gone.
  const setList = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js");

  assert.ok(!/weightStepperCell|renderWeightStepButton|stepAllSetWeights|weightStepper=/.test(setList), "no steppers beside the cell or in the header");
  assert.ok(/setEditorBar\.open\(\{/.test(setList) && /openWeightBar\(set\)/.test(setList), "a weight cell with focus opens the bar");
  assert.ok(
    (setList.match(/setEditorBar\.close\(\);/g) ?? []).length >= 2 &&
      (setList.match(/onFocus: \(\) => setEditorBar\.close\(\)/g) ?? []).length === 2,
    "reps, RPE and 1RM % close it"
  );

  // The reps carousel is in the bar over the keyboard, like the weight.
  assert.ok(
    /openRepsBar\(set, repsSuffix\)/.test(setList) && /kind: "reps"/.test(setList),
    "the reps of a set with focus open the bar's carousel"
  );
  assert.ok(
    /showsSetEditors\(resolvedVisibleColumns\)\s*&&\s*isSteppableSet\(set\)\s*&&\s*isPersistedSet\(set\.sets_id\)/.test(setList),
    "in the tables that leave room, and not on a finished, failed or unsaved set"
  );
  assert.ok(!/<RepsCarousel|repsCarouselHost|raisedCell|typedReps/.test(setList), "no overlay on the cell any more");
  assert.ok(/REPS_SWIPE_SAVE_DELAY_MS/.test(setList) && /flushRepsRef\.current\?\.\(\)/.test(setList), "saved once after the swipe, and on the way out");
  assert.ok(/discardRepsDraft\(set\.sets_id\);\s*return updateField\("reps"/.test(setList), "what is typed wins over a swipe still waiting");
  assert.ok(
    /onLiveChange: \(text\) =>\s*setEditorBar\.update\(barOwnerId, set\.sets_id, \{ reps: text \}\)/.test(setList),
    "the carousel shows what is being typed"
  );
  assert.ok(/setEditorBar\.close\(barOwnerId, repsBarSetId\)/.test(setList), "ticking the set off closes the carousel");
  assert.ok(/onPreviewReps: \(next\) =>\s*cellControlsRef\.current\.get\(`\$\{setId\}:reps`\)\?\.preview\?\.\(String\(next\)\)/.test(setList) && /preview: \(text\) => inputRef\.current\?\.setNativeProps\?\.\(\{ text \}\)/.test(read("src/Resources/ThemedComponents/ThemedEditableCell.js")), "the number the carousel is passing shows in the cell without a render of the set list");

  const carouselSource = read("src/Resources/Components/SetEditorBar/RepsCarousel.js");

  assert.ok(
    /onStartShouldSetPanResponder: \(\) => true/.test(carouselSource) && /touchArea: \{\s*flex: 1,/.test(carouselSource),
    "it takes hold of the finger at once, anywhere in the middle of the toolbar - a thumb does not have to find the box, and a curved start does not slip past"
  );
  assert.ok(
    /accessibilityRole="adjustable"/.test(carouselSource) && /accessibilityValue=\{\{ now: current \}\}/.test(carouselSource),
    "adjustable for a screen reader"
  );
  assert.ok(/name: "increment"/.test(carouselSource) && /name: "decrement"/.test(carouselSource) && /name: "activate"/.test(carouselSource));
  assert.ok(!/expo-blur|react-native-community\/blur/.test(carouselSource), "no blur dependency");
  const moveHandler = carouselSource.match(/onPanResponderMove: \([^)]*\) => \{[\s\S]*?\n        \},/)[0];

  assert.ok(!/onChangeRef|Vibration|onPreview|setMiddle/.test(moveHandler), "while the finger is down the move handler only moves the strip: ticks, the cell and the window follow it from a listener, and nothing is saved");
  assert.ok(/scroll\.setValue\(\s*scrollPositionFor\(/.test(moveHandler), "the strip is its own value, set straight from the finger, and cannot be dragged past 0");
  assert.ok(/scroll\.addListener\(/.test(carouselSource) && /Vibration\.vibrate\(TICK_MS\)/.test(carouselSource) && /MIN_TICK_GAP_MS/.test(carouselSource) && /onPreviewRef\.current\?\.\(reps\)/.test(carouselSource), "every number that passes the middle ticks and shows in the cell");
  assert.ok(/if \(activeRef\.current\) \{[\s\S]*Vibration\.vibrate/.test(carouselSource), "but only while a finger or the settling is on the strip, not when the count is changed from outside");
  assert.ok(/onPanResponderRelease[\s\S]*settledReps\(/.test(carouselSource) && /onChangeRef\.current\?\.\(reps\)/.test(carouselSource), "the count is handed over when the strip has settled");
  assert.ok(/onPanResponderTerminate[\s\S]*onPreviewRef\.current\?\.\(dragRef\.current\.startReps\)/.test(carouselSource), "a drag that is taken away puts the cell back");
  assert.ok(/const SPREAD = 9;/.test(carouselSource) && /const RECENTRE = 4;/.test(carouselSource) && /visibleRepsWindow\(windowCentre, SPREAD\)/.test(carouselSource), "the numbers around the middle are drawn from where the strip is, so there is always more to scroll to - and drawn again only every few numbers, not on every one");
  assert.ok(/dragRef\.current\.startScroll = positionRef\.current/.test(carouselSource), "a finger that lands on a gliding strip takes it from where it is");
  assert.ok(
    /onPanResponderGrant[\s\S]*setEditorBar\.setDragging\(true\)/.test(carouselSource) &&
      /onPanResponderRelease[\s\S]*setEditorBar\.setDragging\(false\)/.test(carouselSource) &&
      /onPanResponderTerminate[\s\S]*setEditorBar\.setDragging\(false\)/.test(carouselSource),
    "the carousel says when a finger is on it, and when it is not"
  );
  const protection = read("src/Resources/ThemedComponents/ThemedKeyboardProtection.js");

  assert.ok(
    /setEditorBar\.subscribe\(apply\)/.test(protection) && /scrollRef\.current\?\.setNativeProps\?\.\(\{\s*scrollEnabled: ownScrollEnabled && !setEditorBar\.isDragging\(\)/.test(protection) && /ref=\{scrollRef\}/.test(protection),
    "the page's scroll view is locked on the native view the moment a finger lands on the carousel - a render of the page is too slow, and by then the scroll view has taken the touch"
  );
  const workoutPage = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js");

  assert.ok(
    /const setEditorDragging = useSetEditorDragging\(\);/.test(workoutPage) && /scrollEnabled: !isReorderingExercises && !setEditorDragging/.test(workoutPage),
    "the workout page does not scroll while a finger drags the carousel, however far up or down it wanders"
  );
  assert.ok(/setEditorBar\.close\(barOwnerId\)/.test(setList), "the set list's own bar is closed when it goes away");
  assert.ok(/cellControlsRef\.current\.get\(`\$\{setId\}:weight`\)\?\.commit/.test(setList), "a press saves what is typed before it steps");
  assert.ok(
    setList.indexOf("?.commit?.()") < setList.indexOf("return stepSetWeight(setId, direction)"),
    "the commit comes before the step"
  );
  assert.ok(/isSteppableSet\(set\) && isPersistedSet\(set\.sets_id\)/.test(setList), "no bar on a finished, failed or unsaved set");
  assert.ok(/showsWeightStepper\(resolvedVisibleColumns/.test(setList), "the columns rule and bodyweight mode still apply");
  assert.ok(/setEditorBar\.close\(barOwnerId, weightBarSetId\)/.test(setList), "ticking the set off closes the bar");
  const listStyles = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetListStyle.js");

  assert.ok(!/repsCarouselHost|raisedCell/.test(listStyles), "no holder around the reps cell: a percentage height in it made the card several screens tall on a phone");
  assert.ok(!/weightWithStepper/.test(read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetListStyle.js")));

  const cell = read("src/Resources/ThemedComponents/ThemedEditableCell.js");

  assert.ok(/registerControl/.test(cell) && /commit: \(\) => commitRef\.current\?\.\(\)/.test(cell), "the cell hands out a commit");

  const exerciseRow = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/ExerciseRow.js");

  assert.ok(/weightStep: typedWeightStep !== undefined \? typedWeightStep : exercise\.weightStep/.test(exerciseRow), "the chosen step is passed to getWeightStep");
  assert.ok(/setExerciseWeightStep\(db, \{/.test(exerciseRow) && /onWeightStepChange=\{changeWeightStep\}/.test(exerciseRow));

  const app = read("App.js");

  assert.ok(/<SetEditorKeyboardToolbar \/>/.test(app) && !/<KeyboardToolbar \/>/.test(app), "the toolbar App.js mounts has the weight bar in it");

  const bar = read("src/Resources/Components/SetEditorBar/SetEditorBar.js");

  assert.ok(/showArrows=\{!bar\}/.test(bar), "the arrows make way while the bar shows");
  assert.ok(/bar\.kind === "reps"/.test(bar) && /<RepsBarContent bar=\{bar\} \/>/.test(bar), "the bar shows the carousel for reps and minus-plus for weight");
  assert.ok(/keyboardDidHide", \(\) => setEditorBar\.close\(\)/.test(bar), "the keyboard going away closes it");
  assert.ok(/keyboardType="numeric"/.test(bar), "the weight cell's keyboard");
  assert.ok(/delayLongPress=\{bar\.repeatDelayMs\}/.test(bar) && /onPressOut=\{\(\) => bar\.onRepeatStop\(\)\}/.test(bar), "hold to repeat");

  // The lock screen's rule is the same function, given the chosen step.
  const live = loadAppModule("src/Utils/liveWorkout.js");

  assert.strictEqual(live.liveWeightStepFor({ name: "Bench Press", weightStep: 1.25 }), 1.25);
  assert.strictEqual(live.liveWeightStepFor({ name: "Bench Press" }), 2.5);

  // The strings, in both languages.
  const i18n = loadAppModule("src/Localization/i18n.js");

  for (const key of ["weightBarLabel", "weightStepField", "weightMinus", "weightPlus", "repsCarouselLabel"]) {
    for (const language of ["en", "da"]) {
      const text = i18n.translate(`workout.setList.${key}`, { label: "3", step: "2" }, language);

      assert.ok(text && !text.startsWith("workout.setList"), `workout.setList.${key} is missing in ${language}`);
    }
  }

  assert.strictEqual(i18n.translate("workout.setList.weightBarLabel", { label: "3" }, "en"), "Edit weight for set 3");
  assert.strictEqual(i18n.translate("workout.setList.repsCarouselLabel", { label: "3" }, "en"), "Reps for set 3");

  console.log(
    "Set editors: the step field's rules, the reps carousel's numbers and swipe, the bar's lifecycle, the step kept per exercise and synced (also 0 for automatic, a null from the cloud, a cloud without the column), the lock screen's step, and the wiring passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
