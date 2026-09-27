// Restart on a strength workout, the start after it, and the workout in
// progress that the square in the middle of the bottom navigation shows.
//
// "Restart workout sætter ikke sets til not done. Og når jeg starter tiden
// igen, går der et eller andet galt." Restart reset the workout's timer and
// nothing else: every set stayed ticked off, its records and its exercises'
// done flags with it, so the second start was a started workout whose sets
// were already done. And nothing told the lock-screen card or the square that
// the workout had been reset or started again: workoutService's own upload
// never raised the data event the card is rebuilt on.
//
// "Ved pause, stopper timeren også fra firkanten i bund menuen." The square
// asked for the workout whose timer runs. A pause clears timer_start and
// is_active together, so a paused workout was nothing to it, and the square
// went back to the plus.
//
// The real services run here against a real SQLite database built from the
// app's own schema, so these are the statements the phone runs.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

/* ----------------------------------------------------------- the world -- */

// The uploads every write queues reach programService through a dynamic
// import, which this loader leaves to Node, and they would stop at "signed
// out" anyway. What they say about it is not what is tested here.
const consoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud push failed/.test(args[0])) {
    return;
  }

  consoleError(...args);
};

// Signed out as far as Supabase knows: every upload the services start stops
// at "no user", and nothing reaches the network.
const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
  },
  from() {
    throw new Error("a restart reached for the cloud while signed out");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

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
const { weightliftingSchemaSql } = loadAppModule(
  "src/Database/schema/weightlifting.js"
);
const workoutService = loadAppModule("src/Services/workoutService.js");
const weightliftingService = loadAppModule("src/Services/weightliftingService.js");
const workoutRepository = loadAppModule("src/Repository/workoutRepository.js");
const weightliftingRepository = loadAppModule("src/Repository/weightliftingRepository.js");
const dataEvents = loadAppModule("src/Utils/workoutDataEvents.js");
const setEvents = loadAppModule("src/Utils/workoutSetEvents.js");
const clock = loadAppModule("src/Utils/workoutClock.js");
const { LIVE_WORKOUT_MAX_SECONDS, LIVE_STRENGTH_WORKOUT_TYPES } = loadAppModule(
  "src/Utils/liveWorkout.js"
);

/** node:sqlite behind the part of expo-sqlite's API the services use. */
function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map(
      (value) =>
        value === undefined
          ? null
          : typeof value === "boolean"
            ? Number(value)
            : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);

  return {
    databasePath: "test-workout-restart",
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));

      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
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

const now = () => Math.trunc(Date.now() / 1000);
// The background uploads the services start run on the sync queue; give them
// their turn, so the test ends after them rather than under them.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/* ------------------------------------------------------------- fixture -- */

const db = createDatabase();
const all = (sql, ...params) => db.sqlite.prepare(sql).all(...params);
const one = (sql, ...params) => db.sqlite.prepare(sql).get(...params);
const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);

// Three days of one program: the bench press before, the workout that is
// restarted, and one after it - which only gets its record back once the
// restarted workout's heavier set is no longer ticked off.
run(`INSERT INTO Program (program_id, program_name, start_date) VALUES (1, 'Plan', '01.09.2026')`);
run(`INSERT INTO Day (day_id, program_id, Weekday, date, done) VALUES (1, 1, 'Friday', '25.09.2026', 1)`);
run(`INSERT INTO Day (day_id, program_id, Weekday, date, done) VALUES (2, 1, 'Sunday', '27.09.2026', 0)`);
run(`INSERT INTO Day (day_id, program_id, Weekday, date, done) VALUES (3, 1, 'Monday', '28.09.2026', 1)`);

run(`INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date, done) VALUES (1, 1, 'Resistance', 'Push', '25.09.2026', 1)`);
run(`INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date, done) VALUES (2, 2, 'Resistance', 'Push', '27.09.2026', 0)`);
run(`INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date, done) VALUES (3, 3, 'Resistance', 'Push', '28.09.2026', 1)`);

const exercise = (id, workoutId, name, order) =>
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, sets, done)
     VALUES (?, ?, ?, ?, 0, 0)`,
    id,
    workoutId,
    name,
    order
  );
const set = (id, exerciseId, number, weight, reps, { done = 0, failed = 0, rest = 90 } = {}) =>
  run(
    `INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, pause, done, failed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    exerciseId,
    number,
    weight,
    reps,
    rest,
    done,
    failed
  );

exercise(10, 1, "Bench Press", 1);
set(100, 10, 1, 90, 5, { done: 1 });

exercise(20, 2, "Bench Press", 1);
set(200, 20, 1, 100, 5);
set(201, 20, 2, 100, 5);
exercise(21, 2, "Squat", 2);
set(210, 21, 1, 120, 5);
set(211, 21, 2, 120, 5);
exercise(22, 2, "Barbell Row", 3);
set(220, 22, 1, 60, 8);

exercise(30, 3, "Bench Press", 1);
set(300, 30, 1, 95, 5, { done: 1 });

/* ------------------------------------------- a workout, trained and done -- */

(async () => {
  // Started, sets ticked off on the workout screen, and finished - through the
  // same service calls the screen makes.
  const firstStart = now() - 1800;

  await workoutService.setWorkoutOriginalStartTime(db, {
    workoutId: 2,
    startTime: firstStart,
  });
  await workoutService.persistWorkoutTimerState(db, {
    workoutId: 2,
    timerStart: firstStart,
    elapsedTime: 0,
  });

  for (const [setId, failed] of [[200, 0], [201, 1], [210, 0]]) {
    await weightliftingService.updateStrengthSetDone(db, {
      workoutId: 2,
      setId,
      done: 1,
      failed,
    });
  }

  await workoutService.finishWorkout(db, {
    workoutId: 2,
    elapsedTime: 1500,
    createPost: false,
  });
  await settle();

  const flag = (setId) => one(`SELECT personal_record FROM "Set" WHERE sets_id = ?`, setId).personal_record;

  assert.strictEqual(flag(200), 1, "fixture: the 100 kg bench is a record");
  assert.strictEqual(flag(300), 0, "fixture: 95 kg the day after is not");
  assert.strictEqual(flag(100), 1, "fixture: 90 kg the day before was");
  assert.strictEqual(one(`SELECT done FROM Exercise_Instance WHERE exercise_instance_id = 20`).done, 1);
  assert.strictEqual(one(`SELECT done FROM Day WHERE day_id = 2`).done, 1);

  // Uploaded: nothing is waiting to go.
  run(`UPDATE "Set" SET needs_sync = 0, sync_version = 1`);
  run(`UPDATE Exercise_Instance SET needs_sync = 0, sync_version = 1`);
  run(`UPDATE Workout_Type_Instance SET needs_sync = 0, sync_version = 1`);
  run(`UPDATE Day SET needs_sync = 0, sync_version = 1`);

  /* ----------------------------------------------------------- restart -- */

  const dataChanges = [];
  const setChanges = [];
  const stopData = dataEvents.subscribeWorkoutDataChanges((scope) => dataChanges.push(scope));
  const stopSets = setEvents.subscribeWorkoutSetChanges((change) => {
    if (change) setChanges.push(change);
  });
  setChanges.length = 0;

  // A restart that fails half-way changes nothing. It used to be two
  // transactions, sets first: a failure writing the timer left the sets
  // unticked - and queued for upload - under a workout still finished and
  // timed (PR #288's review). Here the workout row refuses the reset.
  const snapshot = () => ({
    sets: all(`SELECT sets_id, done, failed, personal_record, needs_sync FROM "Set" ORDER BY sets_id`),
    exercises: all(`SELECT exercise_instance_id, done, needs_sync FROM Exercise_Instance ORDER BY exercise_instance_id`),
    workouts: all(`SELECT workout_id, done, timer_start, elapsed_time, original_start_time, needs_sync FROM Workout_Type_Instance ORDER BY workout_id`),
    days: all(`SELECT day_id, done, needs_sync FROM Day ORDER BY day_id`),
  });
  const before = snapshot();

  run(`CREATE TRIGGER refuse_restart BEFORE UPDATE OF elapsed_time ON Workout_Type_Instance
       WHEN NEW.workout_id = 2 AND NEW.elapsed_time = 0
       BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END`);
  await assert.rejects(
    weightliftingService.restartStrengthWorkout(db, 2),
    /disk I\/O error/,
    "a failed restart has to reach the screen, which tells the person"
  );
  run(`DROP TRIGGER refuse_restart`);

  assert.deepStrictEqual(snapshot(), before, "a failed restart left part of the workout reset");
  assert.strictEqual(setChanges.length, 0, "a failed restart announced a reset");
  assert.strictEqual(db.sqlite.isTransaction, false, "the failed restart left its transaction open");

  // What Resistance's restartWorkout does: sets and timer, one transaction.
  assert.strictEqual(await weightliftingService.restartStrengthWorkout(db, 2), 3);
  await settle();

  for (const row of all(`SELECT * FROM "Set" s JOIN Exercise_Instance e USING (exercise_instance_id) WHERE e.workout_type_instance_id = 2`)) {
    assert.strictEqual(row.done, 0, `set ${row.sets_id} is still done after Restart`);
    assert.strictEqual(row.failed, 0, `set ${row.sets_id} is still failed after Restart`);
    assert.strictEqual(row.personal_record, 0, `set ${row.sets_id} still holds a record`);
  }

  for (const setId of [200, 201, 210]) {
    const row = one(`SELECT needs_sync, sync_version FROM "Set" WHERE sets_id = ?`, setId);

    assert.strictEqual(row.needs_sync, 1, `set ${setId} was unticked and never marked for upload`);
    assert.ok(row.sync_version > 1, `set ${setId} kept its sync version, so the cloud's would win`);
  }

  assert.strictEqual(
    one(`SELECT needs_sync FROM "Set" WHERE sets_id = 220`).needs_sync,
    0,
    "a set that was never ticked off has nothing to upload"
  );
  assert.strictEqual(flag(300), 1, "the record goes back to the heaviest bench still ticked off");
  assert.strictEqual(flag(100), 1);
  assert.strictEqual(
    one(`SELECT done FROM "Set" WHERE sets_id = 300`).done,
    1,
    "another workout's sets are not touched"
  );

  const exerciseRow = (id) => one(`SELECT done, needs_sync FROM Exercise_Instance WHERE exercise_instance_id = ?`, id);

  assert.deepStrictEqual({ ...exerciseRow(20) }, { done: 0, needs_sync: 1 });
  assert.deepStrictEqual({ ...exerciseRow(21) }, { done: 0, needs_sync: 1 });

  const workoutRow = () => ({ ...one(`SELECT done, is_active, original_start_time, timer_start, elapsed_time, needs_sync FROM Workout_Type_Instance WHERE workout_id = 2`) });

  assert.deepStrictEqual(workoutRow(), {
    done: 0,
    is_active: 0,
    original_start_time: null,
    timer_start: null,
    elapsed_time: 0,
    needs_sync: 1,
  });
  assert.strictEqual(one(`SELECT done FROM Day WHERE day_id = 2`).done, 0, "the day is no longer done");

  assert.strictEqual(setChanges.length, 1, "Home and the lock-screen card hear the reset once, not per set");
  assert.strictEqual(setChanges[0].workoutId, 2);
  assert.strictEqual(setChanges[0].done, false);
  assert.ok(
    dataChanges.includes("workouts"),
    "the reset timer never told the lock-screen card or the square"
  );

  // Nothing ticked off: no set written, nothing said about sets.
  setChanges.length = 0;
  assert.strictEqual(await weightliftingService.restartStrengthWorkout(db, 2), 0);
  assert.strictEqual(setChanges.length, 0);

  /* ---------------------------------------------- started again, paused -- */

  // Resistance's startWorkout: a fresh start, because the reset cleared it.
  assert.strictEqual(
    (await workoutService.getWorkoutOriginalStartTime(db, 2)).original_start_time,
    null,
    "a restarted workout starts afresh"
  );

  const secondStart = now();
  dataChanges.length = 0;

  await workoutService.setWorkoutOriginalStartTime(db, { workoutId: 2, startTime: secondStart });
  await workoutService.persistWorkoutTimerState(db, {
    workoutId: 2,
    timerStart: secondStart,
    elapsedTime: 0,
  });

  assert.ok(dataChanges.length >= 2, "the second start was never announced");
  assert.deepStrictEqual(
    { ...workoutRow(), needs_sync: undefined },
    {
      done: 0,
      is_active: 1,
      original_start_time: secondStart,
      timer_start: secondStart,
      elapsed_time: 0,
      needs_sync: undefined,
    }
  );

  let inProgress = await workoutService.getWorkoutInProgress(db, { now: secondStart + 30 });

  assert.strictEqual(inProgress?.workout_id, 2);
  assert.strictEqual(clock.isWorkoutClockRunning(inProgress), true);
  assert.strictEqual(
    clock.getWorkoutClockSeconds(inProgress, secondStart + 30),
    30,
    "the second start counts from nothing, not from the first"
  );

  // Paused 42 s in, the way pauseWorkout banks it.
  await workoutService.persistWorkoutTimerState(db, {
    workoutId: 2,
    timerStart: null,
    elapsedTime: 42,
  });

  assert.strictEqual(
    await workoutService.getActiveWorkoutTimer(db),
    null,
    "fixture: the query the square used to ask has nothing for a paused workout"
  );

  inProgress = await workoutService.getWorkoutInProgress(db, { now: secondStart + 60 });

  assert.strictEqual(inProgress?.workout_id, 2, "the paused workout went out of the square");
  assert.strictEqual(inProgress.label, "Push", "the square opens the workout it shows");
  assert.strictEqual(inProgress.program_id, 1);
  assert.strictEqual(clock.isWorkoutClockRunning(inProgress), false);
  assert.strictEqual(clock.getWorkoutClockSeconds(inProgress, secondStart + 60), 42);
  assert.strictEqual(
    clock.getWorkoutClockSeconds(inProgress, secondStart + 600),
    42,
    "paused, the clock stands still"
  );

  // The lock-screen card asks for running or paused too, and the pause used
  // to take its workout away with is_active.
  const open = await workoutRepository.getOpenStartedWorkoutsOfTypes(db, {
    types: LIVE_STRENGTH_WORKOUT_TYPES,
  });

  assert.deepStrictEqual(
    open.map((row) => row.workout_id),
    [2],
    "a paused workout has no lock-screen card"
  );

  // Resumed: it counts on from what was banked.
  const resumedAt = secondStart + 100;

  await workoutService.persistWorkoutTimerState(db, {
    workoutId: 2,
    timerStart: resumedAt,
    elapsedTime: 42,
  });
  inProgress = await workoutService.getWorkoutInProgress(db, { now: resumedAt + 10 });
  assert.strictEqual(clock.isWorkoutClockRunning(inProgress), true);
  assert.strictEqual(clock.getWorkoutClockSeconds(inProgress, resumedAt + 10), 52);

  /* ------------------------------------------ when the square lets it go -- */

  await workoutService.persistWorkoutTimerState(db, {
    workoutId: 2,
    timerStart: null,
    elapsedTime: 52,
  });

  assert.strictEqual(
    (await workoutService.getWorkoutInProgress(db, {
      now: secondStart + LIVE_WORKOUT_MAX_SECONDS + 1,
    })),
    null,
    "a workout paused and left since yesterday keeps the square from the plus"
  );

  // Kept in milliseconds by an old install: still read as the same moment.
  run(`UPDATE Workout_Type_Instance SET original_start_time = ? WHERE workout_id = 2`, secondStart * 1000);
  assert.strictEqual(
    (await workoutService.getWorkoutInProgress(db, { now: secondStart + 60 }))?.workout_id,
    2
  );

  await workoutService.finishWorkout(db, { workoutId: 2, elapsedTime: 52, createPost: false });
  await settle();
  assert.strictEqual(
    await workoutService.getWorkoutInProgress(db, { now: secondStart + 60 }),
    null,
    "a finished workout is not in progress"
  );

  // The pure half, on its own.
  assert.strictEqual(clock.getWorkoutClockSeconds(null, 100), 0);
  assert.strictEqual(
    clock.getWorkoutClockSeconds({ timer_start: 1000, elapsed_time: 5 }, 990),
    5,
    "a start after now (a clock set back) adds nothing"
  );
  assert.strictEqual(
    clock.findPausedWorkoutInProgress(
      [
        { workout_id: 1, done: 0, original_start_time: 1000, timer_start: 1500, elapsed_time: 0 },
        { workout_id: 2, done: 1, original_start_time: 1000, timer_start: null, elapsed_time: 60 },
        { workout_id: 3, done: 0, original_start_time: 900, timer_start: null, elapsed_time: 60 },
      ],
      2000
    )?.workout_id,
    3,
    "running and finished rows are not paused ones"
  );
  assert.strictEqual(clock.PAUSED_WORKOUT_MAX_AGE_SECONDS, LIVE_WORKOUT_MAX_SECONDS);

  stopData();
  stopSets();

  /* ------------------------------ "See statistics", through the service -- */

  // The exercise library asks the service, which trims the name first; the
  // repository alone does not (PR #288's review: only the repository was
  // tested). The bench press has finished sets on the days either side.
  assert.strictEqual(await weightliftingService.hasCompletedSetsForExercise(db, "Bench Press"), true);
  assert.strictEqual(
    await weightliftingService.hasCompletedSetsForExercise(db, "  Bench Press  "),
    true,
    "a name with spaces around it has no statistics"
  );
  assert.strictEqual(
    await weightliftingRepository.hasCompletedStrengthSetForExercise(db, "  Bench Press  "),
    false,
    "fixture: the repository takes the name as it is given"
  );
  assert.strictEqual(await weightliftingService.hasCompletedSetsForExercise(db, "Barbell Row"), false, "never finished");

  for (const nothing of ["", "   ", null, undefined, 42]) {
    assert.strictEqual(
      await weightliftingService.hasCompletedSetsForExercise(db, nothing),
      false,
      `${JSON.stringify(nothing)} asked the database`
    );
  }

  /* --------------------------------------------------- the screen's half -- */

  const resistance = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js");
  const restartStart = resistance.indexOf("const restartWorkout = async");
  const restartBody = resistance.slice(restartStart, resistance.indexOf("\n  };", restartStart));

  assert.ok(restartStart !== -1, "Resistance no longer has restartWorkout");
  assert.match(
    restartBody,
    /weightliftingService\.restartStrengthWorkout\(db, workout_id\)/,
    "Restart on the workout screen resets the timer and leaves the sets ticked off"
  );
  assert.doesNotMatch(
    restartBody,
    /workoutService\.resetWorkoutState\(/,
    "the timer is reset in a second transaction again, and can fail on its own"
  );
  assert.match(
    restartBody,
    /catch \(error\) \{[\s\S]*Alert\.alert\(\s*t\("workout\.page\.restartFailedTitle"\)/,
    "a failed restart is only written to the console"
  );
  assert.match(restartBody, /timerStartRef\.current = null/);
  assert.match(restartBody, /elapsedTimeRef\.current = 0/);

  const navigation = read("src/Resources/ThemedComponents/ThemedBottomNavigation.js");

  assert.match(
    navigation,
    /workoutService\.getWorkoutInProgress\(db\)/,
    "the square asks for the running workout only, and a paused one leaves it"
  );
  assert.match(
    navigation,
    /const hasRunningTimer = isActiveWorkoutRunning \|\| Boolean\(activeRestTimer\)/,
    "a paused workout's clock stands still, and needs no 1 s poll"
  );
  assert.match(navigation, /subscribeWorkoutDataChanges\(/);

  console.log(
    "Workout restart checks passed: every set unticked and marked for upload, records, exercises and the day recomputed, the second start from nothing, and a paused workout kept in the square and on the lock screen."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
