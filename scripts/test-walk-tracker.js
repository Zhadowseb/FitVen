// The walk tracker, whole: the real services against a real SQLite database
// built from the app's own schema, with the phone's sensors and the clock
// replaced by ones this test drives.
//
// It follows one walk the way a walker would: Start, walking, standing still
// until auto pause, a step, a pause and a resume, the app going to the
// background, Finish - and then what is on the phone afterwards, and what a
// walk looks like when it is opened again after the app was closed.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

/* ------------------------------------------------------------- the world -- */

const consoleError = console.error;
const consoleWarn = console.warn;

console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud (push|sync) failed|Workout hierarchy cloud/i.test(args[0])) {
    return;
  }

  consoleError(...args);
};
console.warn = () => {};

// A clock and interval timers that move when the test says so.
let clock = Date.parse("2026-10-10T10:00:00Z");
const realNow = Date.now;
const realSetInterval = global.setInterval;
const realClearInterval = global.clearInterval;
let intervals = [];
let intervalId = 0;

Date.now = () => clock;
global.setInterval = (fn, every) => {
  intervalId += 1;
  intervals.push({ id: intervalId, fn, every, next: clock + every });

  return intervalId;
};
global.clearInterval = (id) => {
  intervals = intervals.filter((interval) => interval.id !== id);
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function advance(seconds) {
  for (let second = 0; second < seconds; second += 1) {
    clock += 1000;

    for (const interval of [...intervals]) {
      while (interval.next <= clock) {
        interval.next += interval.every;
        interval.fn();
      }
    }

    await flush();
  }
}

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from() {
    throw new Error("the walk reached for the cloud while signed out");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};
const storage = new Map();

// What the phone says, and what the sensors were asked to do.
const phone = {
  platform: "android",
  locationPermission: { granted: true, status: "granted", canAskAgain: true },
  stepsAvailable: true,
  stepPermission: { granted: true, status: "granted", canAskAgain: true },
  locationWatchers: [],
  stepWatchers: [],
  appStateHandler: null,
  missedSteps: 0,
  asked: [],
};

const Platform = { OS: "android" };

function installWorld() {
  loadAppModule.stubModule("@supabase/supabase-js", {
    createClient: () => fakeSupabase,
    processLock: () => {},
  });
  loadAppModule.stubModule("react-native", {
    Platform,
    AppState: {
      addEventListener: (event, handler) => {
        phone.appStateHandler = handler;

        return { remove() {} };
      },
    },
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
    Accuracy: { BestForNavigation: 6 },
    getForegroundPermissionsAsync: async () => phone.locationPermission,
    requestForegroundPermissionsAsync: async () => {
      phone.asked.push("location");

      return phone.locationPermission;
    },
    watchPositionAsync: async (options, callback) => {
      const watcher = { options, callback, removed: false };

      phone.locationWatchers.push(watcher);

      return {
        remove() {
          watcher.removed = true;
        },
      };
    },
    hasStartedLocationUpdatesAsync: async () => false,
  });
  loadAppModule.stubModule("expo-sensors", {
    Pedometer: {
      isAvailableAsync: async () => phone.stepsAvailable,
      getPermissionsAsync: async () => phone.stepPermission,
      requestPermissionsAsync: async () => {
        phone.asked.push("steps");

        return phone.stepPermission;
      },
      watchStepCount: (callback) => {
        const watcher = { callback, removed: false };

        phone.stepWatchers.push(watcher);

        return {
          remove() {
            watcher.removed = true;
          },
        };
      },
      getStepCountAsync: async () => ({ steps: phone.missedSteps }),
    },
  });
  loadAppModule.stubModule("expo-notifications", {
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({ status: "granted" }),
    scheduleNotificationAsync: async () => "n1",
    cancelScheduledNotificationAsync: async () => {},
    setNotificationChannelAsync: async () => {},
    SchedulableTriggerInputTypes: { DATE: "date" },
    AndroidImportance: { HIGH: 4 },
  });
  loadAppModule.stubModule("expo-constants", { default: {} });
  loadAppModule.stubModule("react-native-url-polyfill/auto", {});
  loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
  loadAppModule.stubModule("expo-secure-store", {});
}

installWorld();

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const { locationSchemaSql } = loadAppModule("src/Database/schema/location.js");

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);
  sqlite.exec(locationSchemaSql);

  return {
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

/* ------------------------------------------------------------- the walker -- */

const METERS_PER_DEGREE = 111195;
let walkedMeters = 0;
let totalStepsCounted = 0;

const lastLocationWatcher = () => phone.locationWatchers.filter((watcher) => !watcher.removed).at(-1);
const lastStepWatcher = () => phone.stepWatchers.filter((watcher) => !watcher.removed).at(-1);

// One second of walking: the position moves 1.4 m, and two steps are taken.
async function walkSeconds(seconds, { steps = true, gps = true } = {}) {
  for (let second = 0; second < seconds; second += 1) {
    await advance(1);

    if (gps && lastLocationWatcher()) {
      walkedMeters += 1.4;
      lastLocationWatcher().callback({
        coords: {
          latitude: 55 + walkedMeters / METERS_PER_DEGREE,
          longitude: 12,
          accuracy: 8,
          speed: 1.4,
        },
        timestamp: clock,
      });
    }

    if (steps && lastStepWatcher()) {
      // Two steps a second is 120 steps a minute; the counter reports a total
      // since it was started, which is what the real one does.
      lastStepWatcher().total = (lastStepWatcher().total ?? 0) + 2;
      totalStepsCounted += 2;
      lastStepWatcher().callback({ steps: lastStepWatcher().total });
    }

    await flush();
  }
}

/* ----------------------------------------------------------------- the run -- */

async function main() {
  const db = createDatabase();
  const one = (sql, ...params) => {
    const row = db.sqlite.prepare(sql).get(...params);

    return row ? { ...row } : null;
  };
  const all = (sql, ...params) => db.sqlite.prepare(sql).all(...params).map((row) => ({ ...row }));
  const exec = (sql, ...params) => db.sqlite.prepare(sql).run(...params);

  exec(`INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Saturday', '2026-10-10')`);
  exec(
    `INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done) VALUES (7, 1, '2026-10-10', 'Walk', NULL, 0)`
  );

  let tracker = loadAppModule("src/Services/walkTrackerService.js");

  /* ------------------------------------------------------ a fresh walk -- */

  const opened = await tracker.openWalk(db, 7);

  assert.strictEqual(opened.status, "idle", "a walk that was never started is idle");
  assert.strictEqual(opened.stepsAvailable, true);
  assert.strictEqual(opened.location, "granted");
  assert.strictEqual(opened.autoPauseEnabled, true, "auto pause is on until somebody turns it off");
  assert.strictEqual(phone.locationWatchers.length, 0, "nothing is watched before Start");
  assert.strictEqual(phone.stepWatchers.length, 0);
  assert.deepStrictEqual(phone.asked, [], "no permission is asked for when the screen opens");

  /* ------------------------------------------------------------ Start -- */

  await tracker.startWalk();

  let snap = tracker.getWalkSnapshot(7);

  assert.strictEqual(snap.status, "running");
  assert.deepStrictEqual(phone.asked.length, 0, "permissions that were already granted are not asked for again");
  assert.strictEqual(phone.locationWatchers.length, 1, "the position is watched");
  assert.strictEqual(phone.stepWatchers.length, 1, "and the steps");
  assert.strictEqual(phone.locationWatchers[0].options.foregroundService, undefined, "no foreground service, ever");
  assert.ok(
    Math.abs(Math.trunc(clock / 1000) - one("SELECT original_start_time AS t FROM Workout_Type_Instance WHERE workout_id = 7").t) <= 1,
    "the start is written"
  );
  assert.notStrictEqual(one("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 7").t, null, "and the clock is running");

  /* -------------------------------------------------------- walking -- */

  await walkSeconds(60);
  snap = tracker.getWalkSnapshot(7);

  assert.ok(Math.abs(snap.distanceMeters - 60 * 1.4) < 10, `a minute of walking is ~84 m, got ${snap.distanceMeters}`);
  assert.strictEqual(snap.steps, 120, "two steps a second for a minute");
  assert.strictEqual(snap.route.length, 1, "one stretch of route");
  assert.ok(snap.route[0].length > 10, "with its points");
  assert.ok(snap.fix, "and a position");
  assert.strictEqual(snap.status, "running", "walking never auto pauses");
  assert.ok(
    all("SELECT * FROM LocationLog WHERE workout_id = 7 AND latitude IS NOT NULL").length > 10,
    "the points are stored"
  );
  assert.ok(Math.abs(tracker.cadenceOf(snap, clock) - 120) <= 6, "the cadence is ~120");

  /* ---------------------------------------------------- auto pause -- */

  await advance(12);
  snap = tracker.getWalkSnapshot(7);

  assert.strictEqual(snap.status, "autoPaused", "10 s with no step and no ground gained pauses");
  assert.strictEqual(one("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 7").t, null, "the clock is stopped");
  assert.ok(one("SELECT elapsed_time AS t FROM Workout_Type_Instance WHERE workout_id = 7").t >= 60, "and what it ran is banked");
  assert.strictEqual(phone.locationWatchers.filter((w) => !w.removed).length, 1, "the sensors keep running, to see you start again");
  const bankedWhilePaused = tracker.getWalkSnapshot(7).elapsed;

  await advance(30);
  assert.strictEqual(tracker.getWalkSnapshot(7).elapsed, bankedWhilePaused, "an auto pause does not count as time");

  // A step: the walk is on again, with a new stretch of route.
  const stepsBefore = tracker.getWalkSnapshot(7).steps;

  lastStepWatcher().total += 1;
  lastStepWatcher().callback({ steps: lastStepWatcher().total });
  await flush();
  snap = tracker.getWalkSnapshot(7);

  assert.strictEqual(snap.status, "running", "a step resumes it");
  assert.strictEqual(snap.steps, stepsBefore + 1, "and it counts");
  assert.notStrictEqual(one("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 7").t, null);
  assert.ok(
    all("SELECT * FROM LocationLog WHERE workout_id = 7 AND latitude IS NULL").length >= 2,
    "the stretches are told apart in the stored route"
  );

  // Standing still elsewhere, with auto pause switched off, never pauses.
  await tracker.setAutoPause(false);
  await advance(40);
  assert.strictEqual(tracker.getWalkSnapshot(7).status, "running", "switched off, it never pauses");
  assert.strictEqual(storage.get("fitven.walk.autoPause"), "0", "and the choice is remembered");
  await tracker.setAutoPause(true);

  /* ------------------------------------------------- pause and resume -- */

  await walkSeconds(10);
  await tracker.pauseWalk();
  snap = tracker.getWalkSnapshot(7);

  assert.strictEqual(snap.status, "paused");
  assert.ok(phone.locationWatchers.every((watcher) => watcher.removed), "pausing lets go of the position");
  assert.ok(phone.stepWatchers.every((watcher) => watcher.removed), "and of the step counter");
  assert.strictEqual(one("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 7").t, null);

  const distanceAtPause = snap.distanceMeters;
  const stepsAtPause = snap.steps;

  await advance(120);
  assert.strictEqual(tracker.getWalkSnapshot(7).distanceMeters, distanceAtPause, "nothing is added while paused");

  await tracker.resumeWalk();
  assert.strictEqual(tracker.getWalkSnapshot(7).status, "running");
  assert.strictEqual(phone.locationWatchers.filter((w) => !w.removed).length, 1, "the position is watched again");

  // A fix 300 m from where it stopped does not draw a line across the pause.
  walkedMeters += 300;
  await walkSeconds(20);
  snap = tracker.getWalkSnapshot(7);

  assert.ok(snap.distanceMeters - distanceAtPause < 60, `the 300 m of the pause are not walked, got +${snap.distanceMeters - distanceAtPause}`);
  assert.ok(snap.steps > stepsAtPause, "steps count again, on top of the total");
  assert.ok(snap.route.length >= 2, "the route has a gap there");

  /* ------------------------------------------------------ background -- */

  const stepsBeforeBackground = tracker.getWalkSnapshot(7).steps;
  const elapsedBeforeBackground = () => {
    const current = tracker.getWalkSnapshot(7);

    return current.elapsed + (current.timerStart ? Math.trunc(clock / 1000) - current.timerStart : 0);
  };
  const clockBefore = elapsedBeforeBackground();

  phone.appStateHandler("background");
  await flush();
  assert.ok(phone.locationWatchers.every((watcher) => watcher.removed), "the app in the background stops the position");
  assert.ok(phone.stepWatchers.every((watcher) => watcher.removed), "and the steps");
  assert.strictEqual(tracker.getWalkSnapshot(7).status, "running", "the walk itself is not paused");

  await advance(90);
  assert.ok(elapsedBeforeBackground() - clockBefore >= 90, "the clock goes on while the app is away");

  Platform.OS = "ios";
  phone.missedSteps = 150;
  phone.appStateHandler("active");
  await flush();
  await flush();
  snap = tracker.getWalkSnapshot(7);

  assert.strictEqual(phone.locationWatchers.filter((w) => !w.removed).length, 1, "back in front, it watches again");
  assert.strictEqual(snap.steps, stepsBeforeBackground + 150, "iOS says how many steps were taken meanwhile");
  Platform.OS = "android";

  /* -------------------------------------------------------- Finish -- */

  await walkSeconds(15);
  const beforeFinish = tracker.getWalkSnapshot(7);
  const result = await tracker.finishWalk();

  assert.ok(result, "finishing says what to show");
  assert.strictEqual(result.steps, beforeFinish.steps);
  assert.ok(Math.abs(result.distanceMeters - beforeFinish.distanceMeters) < 1);
  assert.ok(phone.locationWatchers.every((watcher) => watcher.removed) && phone.stepWatchers.every((watcher) => watcher.removed), "finishing lets go of every sensor");
  assert.strictEqual(tracker.getWalkSnapshot(7).status, "done");

  const workout = one("SELECT done, timer_start, elapsed_time FROM Workout_Type_Instance WHERE workout_id = 7");

  assert.strictEqual(workout.done, 1, "the workout is finished");
  assert.strictEqual(workout.timer_start, null);
  assert.strictEqual(workout.elapsed_time, result.movingSeconds, "with its moving time");

  const segments = all("SELECT * FROM Run WHERE workout_id = 7");

  assert.strictEqual(segments.length, 1, "one segment holds the walk");
  assert.strictEqual(segments[0].done, 1);
  assert.strictEqual(segments[0].is_pause, 0);
  assert.strictEqual(segments[0].type, "WORKING_SET");
  assert.ok(Math.abs(segments[0].actual_distance * 1000 - result.distanceMeters) < 1, "its distance is what was walked, in km");
  assert.strictEqual(segments[0].actual_duration_seconds, result.movingSeconds);
  assert.strictEqual(segments[0].actual_steps, result.steps);
  assert.ok(segments[0].actual_pace > 0, "and its pace");

  // What the statistics read.
  const { getCompletedRunSegmentsForStatistics } = loadAppModule("src/Repository/runningRepository.js");
  const statisticsRows = await getCompletedRunSegmentsForStatistics(db);

  assert.strictEqual(statisticsRows.length, 1, "a finished walk is in the statistics");
  assert.strictEqual(statisticsRows[0].workout_type, "Walk");

  /* ---------------------------------------------- opened afterwards -- */

  const walkService = loadAppModule("src/Services/walkService.js");
  const stored = await walkService.loadWalk(db, 7);

  assert.strictEqual(stored.totals.segments, 1);
  assert.strictEqual(stored.totals.steps, result.steps);
  assert.ok(stored.points.length > 10, "the route is still there to be drawn");

  await tracker.leaveWalk();
  const reopened = await tracker.openWalk(db, 7);

  assert.strictEqual(reopened.status, "done", "a finished walk opens as finished");
  assert.strictEqual(reopened.savedTotals.steps, result.steps);
  assert.ok(Math.abs(reopened.savedTotals.distanceKm * 1000 - result.distanceMeters) < 1);
  assert.ok(reopened.route.length >= 2 && reopened.fix, "with its route");
  assert.ok(Math.abs(reopened.walk.distanceMeters - result.distanceMeters) < 5, "and the distance rebuilt from the stored points is the same");

  // The route goes with the walk.
  const { deleteRunSetsByWorkout } = loadAppModule("src/Repository/runningRepository.js");

  await deleteRunSetsByWorkout(db, 7);
  assert.strictEqual(all("SELECT * FROM LocationLog WHERE workout_id = 7").length, 0, "deleting a walk deletes its route");
  assert.strictEqual(all("SELECT * FROM Run WHERE workout_id = 7").length, 0);

  /* ------------------------------- the app closed in the middle of a walk -- */

  const killed = createDatabase();
  const killedOne = (sql, ...params) => ({ ...killed.sqlite.prepare(sql).get(...params) });

  killed.sqlite.prepare(`INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Saturday', '2026-10-10')`).run();
  killed.sqlite
    .prepare(`INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done) VALUES (8, 1, '2026-10-10', 'Walk', 0)`)
    .run();

  phone.locationWatchers = [];
  phone.stepWatchers = [];
  walkedMeters = 0;
  await tracker.leaveWalk();
  await tracker.openWalk(killed, 8);
  await tracker.startWalk();
  await walkSeconds(61); // and the periodic save has run

  const savedSteps = killed.sqlite.prepare("SELECT actual_steps AS s FROM Run WHERE workout_id = 8").get();

  assert.ok(savedSteps && savedSteps.s >= 80, "the steps so far are saved while the walk runs");
  const distanceWhenKilled = tracker.getWalkSnapshot(8).distanceMeters;

  // The app is closed: a new process, the same phone.
  intervals = [];
  loadAppModule.stubModule("react-native", {
    Platform,
    AppState: { addEventListener: (event, handler) => ({ remove() {} }) },
    I18nManager: {},
    NativeModules: {},
  });
  installWorld();
  tracker = loadAppModule("src/Services/walkTrackerService.js");
  phone.locationWatchers = [];
  phone.stepWatchers = [];

  await advance(30);
  const back = await tracker.openWalk(killed, 8);

  assert.strictEqual(back.status, "paused", "a walk that was running when the app closed comes back paused");
  assert.strictEqual(phone.locationWatchers.length, 0, "and nothing watches until it is resumed");
  assert.ok(back.elapsed >= 61 + 30 - 2, "its clock has the time up to now banked, the time the app was closed included");
  assert.strictEqual(killedOne("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 8").t, null, "and is stopped in the database too");
  assert.ok(Math.abs(back.walk.distanceMeters - distanceWhenKilled) < 5, "the distance is rebuilt from the route");
  assert.ok(back.steps >= 80, "and the steps from the last save");
  assert.ok(back.route.length >= 1 && back.fix, "with the route to draw");

  /* ----------------------------------------- location not allowed -- */

  const denied = createDatabase();

  denied.sqlite.prepare(`INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Saturday', '2026-10-10')`).run();
  denied.sqlite
    .prepare(`INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done) VALUES (9, 1, '2026-10-10', 'Walk', 0)`)
    .run();

  phone.locationPermission = { granted: false, status: "denied", canAskAgain: true };
  phone.asked = [];
  phone.locationWatchers = [];
  phone.stepWatchers = [];
  await tracker.leaveWalk();
  await tracker.openWalk(denied, 9);
  await tracker.startWalk();
  snap = tracker.getWalkSnapshot(9);

  assert.deepStrictEqual(phone.asked, ["location"], "it asks for location when the walk starts, not before");
  assert.strictEqual(snap.status, "running", "the walk starts all the same");
  assert.strictEqual(snap.location, "denied");
  assert.strictEqual(phone.locationWatchers.length, 0, "with nothing to watch the position by");
  assert.strictEqual(phone.stepWatchers.length, 1, "but steps are counted");

  await walkSeconds(20, { gps: false });
  assert.strictEqual(tracker.getWalkSnapshot(9).steps, 40, "steps and time without a map");
  await advance(12);
  assert.strictEqual(tracker.getWalkSnapshot(9).status, "autoPaused", "auto pause goes by the steps alone");

  phone.locationPermission = { granted: false, status: "denied", canAskAgain: false };
  await tracker.pauseWalk();
  await tracker.resumeWalk();
  assert.strictEqual(tracker.getWalkSnapshot(9).location, "blocked", "a refusal that cannot be asked again again is blocked");

  // Allowing it from the screen starts the position at once - once, even when
  // two things ask for it at the same moment.
  phone.locationPermission = { granted: true, status: "granted", canAskAgain: true };
  await Promise.all([tracker.requestLocationAccess(), tracker.requestLocationAccess()]);
  assert.strictEqual(tracker.getWalkSnapshot(9).location, "granted");
  assert.strictEqual(phone.locationWatchers.filter((w) => !w.removed).length, 1, "and the position is watched, by one watcher");
  assert.strictEqual(phone.locationWatchers.length, 1, "and two asks started exactly one");

  /* ------------------------------------------ no step counter at all -- */

  const noSteps = createDatabase();

  noSteps.sqlite.prepare(`INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Saturday', '2026-10-10')`).run();
  noSteps.sqlite
    .prepare(`INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done) VALUES (10, 1, '2026-10-10', 'Walk', 0)`)
    .run();

  phone.stepsAvailable = false;
  phone.locationWatchers = [];
  phone.stepWatchers = [];
  await tracker.leaveWalk();
  await tracker.openWalk(noSteps, 10);
  await tracker.startWalk();
  await walkSeconds(30, { steps: false });
  snap = tracker.getWalkSnapshot(10);

  assert.strictEqual(snap.stepsAvailable, false);
  assert.strictEqual(snap.steps, null, "no step counter is no number, not a zero");
  assert.strictEqual(tracker.cadenceOf(snap, clock), null);
  assert.strictEqual(phone.stepWatchers.length, 0);
  await advance(12);
  assert.strictEqual(tracker.getWalkSnapshot(10).status, "autoPaused", "without steps it goes by speed alone");

  const noStepsResult = await tracker.finishWalk();

  assert.strictEqual(noStepsResult.steps, null);
  assert.strictEqual(noSteps.sqlite.prepare("SELECT actual_steps AS s FROM Run WHERE workout_id = 10").get().s, null, "and none is stored");

  /* ------------------------------------------------- a deleted walk -- */

  phone.stepsAvailable = true;
  phone.locationPermission = { granted: true, status: "granted", canAskAgain: true };
  phone.locationWatchers = [];
  phone.stepWatchers = [];
  walkedMeters = 0;
  await tracker.leaveWalk();
  await tracker.openWalk(db, 7);
  await tracker.leaveWalk();
  exec(
    `INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done) VALUES (11, 1, '2026-10-10', 'Walk', 0)`
  );
  // What a copy of an older walk can carry: a segment with another walk's numbers, and a stray route.
  exec(
    `INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_duration_seconds, actual_steps, done) VALUES (11, 'WORKING_SET', 1, 0, 3.2, 2400, 5000, 0)`
  );
  exec(`INSERT INTO LocationLog (workout_id, latitude, longitude, accuracy, timestamp) VALUES (11, 55, 12, 5, 1)`);

  const copied = await tracker.openWalk(db, 11);

  assert.strictEqual(copied.status, "idle");
  assert.strictEqual(copied.steps, 0, "an unstarted walk does not take over the steps of the one it was copied from");
  assert.strictEqual(copied.route.length, 0, "or its route");

  await tracker.startWalk();
  await walkSeconds(5);
  assert.strictEqual(all("SELECT * FROM LocationLog WHERE workout_id = 11 AND timestamp = 1").length, 0, "Start clears what was there");
  assert.strictEqual(tracker.getWalkSnapshot(11).steps, 10, "and the steps count from nothing");

  // A deleted walk: what was queued is written first, so deleting leaves nothing behind it.
  await walkSeconds(3);
  await tracker.releaseWalk(11);
  assert.ok(phone.locationWatchers.every((watcher) => watcher.removed), "a deleted walk lets go of the position");
  assert.strictEqual(tracker.getWalkSnapshot(11), null, "and is no longer tracked");
  await deleteRunSetsByWorkout(db, 11);
  await advance(30);
  assert.strictEqual(all("SELECT * FROM LocationLog WHERE workout_id = 11").length, 0, "nothing is written for it afterwards");
  assert.strictEqual(all("SELECT * FROM Run WHERE workout_id = 11").length, 0);

  void totalStepsCounted;
}

main()
  .then(() => {
    Date.now = realNow;
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    console.error = consoleError;
    console.warn = consoleWarn;
    console.log(
      "Walk tracker: start, distance and steps, auto pause and its resume, pause and resume, the background, finish into one segment and the statistics, the route reopened, a killed app, denied location, no step counter and a deleted walk."
    );
    process.exit(0);
  })
  .catch((error) => {
    Date.now = realNow;
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    console.error = consoleError;
    console.error(error);
    process.exit(1);
  });
