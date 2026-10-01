// The rest counted up after a set with no rest written (Utils/restCountUp.js,
// Services/restCountUpService.js).
//
// "Når der ikke er skrevet pause på et sæt, så tæl op for at give en ide om
// pausen imellem sæt." Counting starts at the tick; nothing is kept for the
// first 15 seconds, so ticking every set at once after the exercise records no
// rests; the next tick, a pause or the finish writes what was counted into
// the set just ticked off - as an ordinary set write, so it syncs. It is no
// rest timer: the bottom menu's square and the rest-is-over reminder never
// hear of it. And it is a record, not a plan: a new set does not inherit it,
// and ticking the set again counts up again rather than down.
//
// The real services run against a real SQLite database built from the app's
// own schema, so these are the statements the phone runs.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

/* ----------------------------------------------------------- the world -- */

const consoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud push failed|cloud sync failed/i.test(args[0])) {
    return;
  }

  consoleError(...args);
};

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from() {
    throw new Error("the count-up reached for the cloud while signed out");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};
const storage = new Map();
const scheduled = [];

loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => fakeSupabase,
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
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => storage.set(key, String(value)),
    removeItem: async (key) => storage.delete(key),
    getAllKeys: async () => [...storage.keys()],
    multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
  },
});
loadAppModule.stubModule("expo-location", {
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
});
loadAppModule.stubModule("expo-notifications", {
  setNotificationHandler() {},
  getPermissionsAsync: async () => ({ status: "granted" }),
  scheduleNotificationAsync: async (request) => {
    scheduled.push(request);
    return `n${scheduled.length}`;
  },
  cancelScheduledNotificationAsync: async () => {},
  setNotificationChannelAsync: async () => {},
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { HIGH: 4 },
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const weightliftingService = loadAppModule("src/Services/weightliftingService.js");
const workoutService = loadAppModule("src/Services/workoutService.js");
const countUps = loadAppModule("src/Services/restCountUpService.js");
const restTimer = loadAppModule("src/Utils/restTimerEvents.js");
const dataEvents = loadAppModule("src/Utils/workoutDataEvents.js");
const rules = loadAppModule("src/Utils/restCountUp.js");

function createDatabase(databasePath) {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);

  return {
    databasePath,
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(sql, params) {
      return sqlite.prepare(sql).all(...bind(params));
    },
    async getFirstAsync(sql, params) {
      return sqlite.prepare(sql).get(...bind(params)) ?? null;
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const now = () => Math.trunc(Date.now() / 1000);

/* ------------------------------------------------------ the pure rules -- */

assert.strictEqual(rules.REST_COUNT_UP_GRACE_SECONDS, 15);
assert.strictEqual(rules.countedRestSeconds(100, 114.9), null, "under 15 s is no rest");
assert.strictEqual(rules.countedRestSeconds(100, 115), 15);
assert.strictEqual(rules.countedRestSeconds(100, 100 + 7200), 3600, "capped at the rest field's ceiling");
assert.strictEqual(rules.isRestCountUpVisible({ startedAt: 100 }, 114), false);
assert.strictEqual(rules.isRestCountUpVisible({ startedAt: 100 }, 115), true);
assert.strictEqual(rules.restCountUpElapsed({ startedAt: 100 }, 161.5), 61);
assert.deepStrictEqual(rules.withKnownRestCounted({ id: 1, rest_counted: null }, { rest_counted: 1 }), {
  id: 1,
  rest_counted: true,
});
assert.deepStrictEqual(rules.withKnownRestCounted({ id: 1, rest_counted: false }, { rest_counted: 1 }), {
  id: 1,
  rest_counted: false,
});
assert.ok(
  rules.isMissingRestCountedColumnError({ code: "42703", message: "column set.rest_counted does not exist" })
);
assert.ok(
  rules.isMissingRestCountedColumnError({
    code: "PGRST204",
    message: "Could not find the 'rest_counted' column of 'set' in the schema cache",
  })
);
assert.ok(!rules.isMissingRestCountedColumnError({ code: "42703", message: "column set.weight_mode does not exist" }));
assert.ok(!rules.isMissingRestCountedColumnError({ code: "22P02", message: "rest_counted" }), "the decimals' error is not this one");
assert.deepStrictEqual(
  rules.withSendableRestCounted({ a: 1, rest_counted: true }, { cloudHasColumn: false }),
  { a: 1 }
);
assert.deepStrictEqual(rules.withSendableRestCounted({ a: 1, rest_counted: false }), { a: 1, rest_counted: false });

// A saved counted rest reads as it did while it counted ("4.49"), not as
// minutes with decimals ("4.82 min") - the phone test of 2.17.0.
{
  const setList = require("fs").readFileSync(
    require("path").join(__dirname, "../src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js"),
    "utf8"
  );
  assert.ok(
    /isCountedRest\(set\)\s*\?\s*\{\s*displayFormatter: \(\) => formatTime\(Number\(set\.pause\)\)/.test(setList),
    "a saved counted rest is shown in minutes and seconds"
  );
}

(async () => {
  // The handle: the column is named until the cloud says it is missing, then
  // the request runs once more without it, and so does every later one.
  {
    const column = rules.createRestCountedCloudColumn();
    const selects = [];
    const result = await column.withFallback(async () => {
      const select = column.selectColumns("id, pause");
      selects.push(select);

      if (select.includes("rest_counted")) {
        throw { code: "42703", message: 'column set.rest_counted does not exist' };
      }

      return "ok";
    });

    assert.strictEqual(result, "ok");
    assert.deepStrictEqual(selects, ["id, pause, rest_counted", "id, pause"]);
    assert.strictEqual(column.isAvailable(), false);
    assert.deepStrictEqual(column.sendablePayload({ pause: 90, rest_counted: true }), { pause: 90 });
    await assert.rejects(
      rules.createRestCountedCloudColumn().withFallback(async () => {
        throw { code: "22P02", message: 'invalid input syntax for type integer: "102.5"' };
      }),
      "another error is not taken for the missing column"
    );
  }

  /* ----------------------------------------------------------- fixture -- */

  const db = createDatabase("test-rest-count-up");
  const one = (sql, ...params) => ({ ...db.sqlite.prepare(sql).get(...params) });
  const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);
  const started = now() - 1200;

  run(
    `INSERT INTO Workout_Type_Instance
       (workout_id, day_id, date, workout_type, label, done, is_active, original_start_time, timer_start, elapsed_time)
     VALUES (70, 1, '2026-09-30', 'Resistance', 'Push', 0, 1, ?, ?, 0)`,
    started,
    started
  );
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, sets)
     VALUES (1, 70, 'Pull-up', 1, 3), (2, 70, 'Bench Press', 2, 1)`
  );
  run(
    `INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, pause, done, needs_sync, sync_version)
     VALUES (11, 1, 1, NULL, 8, NULL, 0, 0, 1),
            (12, 1, 2, NULL, 8, NULL, 0, 0, 1),
            (13, 1, 3, NULL, 8, 90, 0, 0, 1),
            (21, 2, 1, 80, 5, NULL, 0, 0, 1)`
  );

  const setRow = (setId) =>
    one('SELECT pause, rest_counted, needs_sync, sync_version FROM "Set" WHERE sets_id = ?', setId);
  const tick = (setId, at, done = 1) =>
    weightliftingService.updateStrengthSetDone(db, { workoutId: 70, setId, done, failed: 0, at });
  const edits = [];
  const stopEdits = dataEvents.subscribeLockScreenEdits((edit) => edits.push(edit));
  const T = now() - 600;

  // A set with no rest written: counting starts at the tick. No rest timer,
  // so no square in the bottom menu and no reminder.
  await tick(11, T);
  assert.deepStrictEqual(
    (({ workoutId, setId, startedAt }) => ({ workoutId, setId, startedAt }))(countUps.getActiveRestCountUp()),
    { workoutId: 70, setId: 11, startedAt: T }
  );
  assert.strictEqual(restTimer.getActiveRestTimer(), null, "a count-up started the rest timer");
  assert.ok(storage.has("fitven.restCountUp"), "the count-up is not kept across a restart of the app");

  // The next set within 15 s: nothing written for the first, and the count
  // starts over for the second - somebody ticking every set at once.
  await tick(12, T + 10);
  assert.deepStrictEqual(
    (({ pause, rest_counted }) => ({ pause, rest_counted }))(setRow(11)),
    { pause: null, rest_counted: 0 },
    "a rest under 15 s was written"
  );
  assert.strictEqual(countUps.getActiveRestCountUp().setId, 12);

  // After 95 s, the next set: 95 s in set 12's rest field, counted, and
  // marked for upload. Set 13 has a rest of its own, so it counts down, as
  // the screen does it, and gets no count-up.
  const versionBefore = setRow(12).sync_version;
  await tick(13, T + 105);
  const counted = setRow(12);
  assert.strictEqual(counted.pause, 95, "the counted rest was not written into the set just ticked off");
  assert.strictEqual(counted.rest_counted, 1);
  assert.strictEqual(counted.needs_sync, 1, "the counted rest will not sync");
  assert.ok(counted.sync_version >= versionBefore);
  assert.strictEqual(countUps.getActiveRestCountUp(), null, "a set with a rest written got a count-up");
  assert.ok(edits.some((edit) => edit.workoutId === 70), "the workout screen was not told to read the set again");

  // The upload carries it.
  const { buildCloudSetPayload } = loadAppModule("src/Services/cloudSync/cloudSyncFields.js");
  const payload = buildCloudSetPayload(
    one('SELECT * FROM "Set" WHERE sets_id = 12'),
    "user",
    500
  );
  assert.strictEqual(payload.pause, 95);
  assert.strictEqual(payload.rest_counted, true);

  // A counted rest is not planned: ticked off again, the set counts up again.
  await tick(12, T + 200, 0);
  await tick(12, T + 210);
  assert.strictEqual(countUps.getActiveRestCountUp()?.setId, 12, "a counted rest was taken for a planned one");

  // Unticked while it counts: dropped, nothing written.
  await tick(12, T + 260, 0);
  assert.strictEqual(countUps.getActiveRestCountUp(), null);
  assert.strictEqual(setRow(12).pause, 95, "unticking the set wrote the count-up");

  // A rest typed by hand is planned again.
  await weightliftingService.updateSetField(db, { field: "pause", value: 120, setId: 12 });
  assert.deepStrictEqual(
    (({ pause, rest_counted }) => ({ pause, rest_counted }))(setRow(12)),
    { pause: 120, rest_counted: 0 }
  );

  // A rest typed while the count-up runs wins over it.
  await tick(21, T + 300);
  await weightliftingService.updateSetField(db, { field: "pause", value: 60, setId: 21 });
  assert.strictEqual(await countUps.finishRestCountUp(db, { at: T + 400, workoutId: 70 }), null);
  assert.deepStrictEqual(
    (({ pause, rest_counted }) => ({ pause, rest_counted }))(setRow(21)),
    { pause: 60, rest_counted: 0 }
  );
  await weightliftingService.updateSetField(db, { field: "pause", value: "", setId: 21 });

  // The last set of the workout: the finish ends it, and writes it.
  run('UPDATE "Set" SET done = 0 WHERE sets_id = 21');
  const lastAt = now() - 50;
  await tick(21, lastAt);
  await workoutService.finishWorkout(db, { workoutId: 70, elapsedTime: 1200, createPost: false });
  const last = setRow(21);
  assert.strictEqual(last.rest_counted, 1, "finishing the workout lost the rest after the last set");
  assert.ok(last.pause >= 50 && last.pause <= 52, `the rest after the last set was ${last.pause}`);
  assert.strictEqual(countUps.getActiveRestCountUp(), null);

  // A new set does not inherit it: the rest field starts empty, the weight
  // and reps as before.
  await weightliftingService.addSetToExercise(db, 2);
  const added = one('SELECT pause, reps, weight, rest_counted FROM "Set" WHERE exercise_instance_id = 2 AND set_number = 2');
  assert.deepStrictEqual(added, { pause: null, reps: 5, weight: 80, rest_counted: 0 });

  // A paused workout: no count-up at all.
  run("UPDATE Workout_Type_Instance SET done = 0, timer_start = NULL WHERE workout_id = 70");
  run('UPDATE "Set" SET done = 0 WHERE exercise_instance_id = 1');
  await tick(11, now());
  assert.strictEqual(countUps.getActiveRestCountUp(), null, "a paused workout counted a rest");

  // Pausing ends a running one, and writes it (Resistance.pauseWorkout).
  run("UPDATE Workout_Type_Instance SET timer_start = ? WHERE workout_id = 70", now() - 100);
  run('UPDATE "Set" SET done = 0, pause = NULL, rest_counted = 0 WHERE sets_id = 11');
  await tick(11, now() - 40);
  assert.ok((await countUps.finishRestCountUp(db, { workoutId: 70 })) >= 40);
  assert.strictEqual(setRow(11).rest_counted, 1);
  assert.match(
    read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js"),
    /const pauseWorkout = async \(\) => \{[\s\S]*?restCountUpService\.finishRestCountUp\(db, \{ workoutId: workout_id \}\)/,
    "pausing the workout no longer ends the count-up"
  );

  // A restart drops it.
  run('UPDATE "Set" SET done = 0 WHERE sets_id = 12');
  await tick(12, now());
  await weightliftingService.restartStrengthWorkout(db, 70);
  assert.strictEqual(countUps.getActiveRestCountUp(), null, "a restarted workout kept counting");

  // Kept for another database - a sign-out, another account - it is never
  // written into a set there with the same id.
  run("UPDATE Workout_Type_Instance SET timer_start = ?, done = 0 WHERE workout_id = 70", now() - 100);
  await tick(12, now() - 60);
  const other = createDatabase("another-account");
  other.sqlite.exec(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, done) VALUES (12, 1, 1, 1)`);
  assert.strictEqual(await countUps.finishRestCountUp(other, {}), null);
  assert.strictEqual(other.sqlite.prepare('SELECT pause FROM "Set" WHERE sets_id = 12').get().pause, null);

  // Restored after a restart of the app.
  storage.set(
    "fitven.restCountUp",
    JSON.stringify({ id: "x", workoutId: 70, setId: 11, startedAt: now() - 30, database: "test-rest-count-up" })
  );
  assert.strictEqual((await countUps.restoreRestCountUp()).setId, 11);

  // No reminder was ever scheduled for any of it.
  await settle();
  assert.deepStrictEqual(scheduled, [], "a count-up scheduled the rest-is-over reminder");

  // The in-app display: the rest bubble, no button, and never the square.
  const setList = read(
    "src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js"
  );
  assert.match(setList, /restCountUpService\.subscribeRestCountUp/);
  assert.match(setList, /isRestCountUpVisible\(activeCountUp, countUpTick\)/);
  assert.ok(
    !read("src/Resources/ThemedComponents/ThemedBottomNavigation.js").includes("restCountUp"),
    "the bottom menu's square shows the count-up"
  );

  stopEdits();
  await settle();
  console.log(
    "Rest count-up: counted from the tick, nothing under 15 s, written into the set by the next tick, the pause and the finish, " +
      "synced, never a rest timer or a reminder, never inherited, a hand-typed rest wins, and kept across a restart for its own database only."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
