// The walk tracker, whole: the real services against a real SQLite database
// built from the app's own schema, with the phone's sensors and the clock
// replaced by ones this test drives.
//
// It follows one walk the way a walker would: Start, walking, standing still
// until auto pause, a step, a pause and a resume, the app going to the
// background, Finish - and then what is on the phone afterwards, and what a
// walk looks like when it is opened again after the app was closed.
//
// That first walk is the one where the location service is refused, so the
// position is watched in front only and the app going to the background lets go
// of it. The second half follows a walk whose location task starts: the
// screen-off path, where nothing is let go of behind the screen and the service
// is stopped by everything that ends or pauses the walk.

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
  // The walk's location task: whether the phone lets it start, what it was
  // asked to do and what is running, and the function expo-task-manager was
  // given to deliver positions to.
  taskSupported: false,
  refuseStarts: 0,
  stopGate: null,
  runningTask: null,
  taskCalls: [],
  taskExecutors: {},
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
    ActivityType: { Fitness: 3 },
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
    startLocationUpdatesAsync: async (name, options) => {
      phone.taskCalls.push(["start", name, options]);

      if (phone.refuseStarts > 0) {
        phone.refuseStarts -= 1;

        const refused = new Error("Foreground service cannot be started when the application is in the background");

        refused.code = "ERR_FOREGROUND_SERVICE_START_NOT_ALLOWED";
        throw refused;
      }

      if (!phone.taskSupported) {
        throw new Error("the foreground service is not allowed to start");
      }

      phone.runningTask = { name, options };
    },
    stopLocationUpdatesAsync: async (name) => {
      if (phone.stopGate) {
        await phone.stopGate;
      }

      phone.taskCalls.push(["stop", name]);
      phone.runningTask = null;
    },
    hasStartedLocationUpdatesAsync: async (name) =>
      Boolean(phone.runningTask && phone.runningTask.name === name),
  });
  loadAppModule.stubModule("expo-task-manager", {
    defineTask: (name, executor) => {
      phone.taskExecutors[name] = executor;
    },
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

// The tracker, and the file App.js imports so the task is defined.
function loadTracker() {
  const loaded = loadAppModule("src/Services/walkTrackerService.js");

  loadAppModule("src/Services/walkLocationTask.js");

  return loaded;
}

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

// What the walk's location task is given by the phone: one or more positions.
async function deliver(locations) {
  await phone.taskExecutors["walk-location-task"]({ data: { locations }, error: null });
  await flush();
}

// One second of walking: the position moves 1.4 m, and two steps are taken.
async function walkSeconds(seconds, { steps = true, gps = true } = {}) {
  for (let second = 0; second < seconds; second += 1) {
    await advance(1);

    if (gps && (phone.runningTask || lastLocationWatcher())) {
      walkedMeters += 1.4;

      const location = {
        coords: {
          latitude: 55 + walkedMeters / METERS_PER_DEGREE,
          longitude: 12,
          accuracy: 8,
          speed: 1.4,
        },
        timestamp: clock,
      };

      if (phone.runningTask) {
        await deliver([location]);
      } else {
        lastLocationWatcher().callback(location);
      }
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

  let tracker = loadTracker();

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
  assert.deepStrictEqual(phone.taskCalls.map(([kind]) => kind), ["start"], "the walk's location task is tried first");
  assert.strictEqual(phone.runningTask, null, "and with the service refused the position is watched in front only");
  assert.strictEqual(phone.locationWatchers[0].options.foregroundService, undefined);
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
  tracker = loadTracker();
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

  /* ------------------------------------- a walk with the screen off -- */

  const locationService = loadAppModule("src/Services/locationService.js");
  const bg = createDatabase();
  const bgAll = (sql, ...params) => bg.sqlite.prepare(sql).all(...params).map((row) => ({ ...row }));
  const bgOne = (sql, ...params) => ({ ...bg.sqlite.prepare(sql).get(...params) });
  const taskKinds = () => phone.taskCalls.map(([kind]) => kind);
  const newBgWalk = (id) =>
    bg.sqlite
      .prepare(`INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done) VALUES (?, 1, '2026-10-10', 'Walk', 0)`)
      .run(id);
  const noBreaks = (id) =>
    bgAll("SELECT * FROM LocationLog WHERE workout_id = ? AND latitude IS NULL", id).length;

  // One second behind the screen: the clock moves, the timers do not (Android
  // does not run them there) and a position arrives.
  async function screenOffSeconds(seconds, { moving }) {
    for (let second = 0; second < seconds; second += 1) {
      clock += 1000;

      if (moving) {
        walkedMeters += 1.4;
      }

      await deliver([
        {
          coords: { latitude: 55 + walkedMeters / METERS_PER_DEGREE, longitude: 12, accuracy: 8, speed: moving ? 1.4 : 0 },
          timestamp: clock,
        },
      ]);
    }
  }

  bg.sqlite.prepare(`INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Saturday', '2026-10-10')`).run();
  newBgWalk(12);
  phone.taskSupported = true;
  phone.stepsAvailable = true;
  phone.locationPermission = { granted: true, status: "granted", canAskAgain: true };
  phone.locationWatchers = [];
  phone.stepWatchers = [];
  phone.taskCalls = [];
  walkedMeters = 0;
  await tracker.openWalk(bg, 12);
  await tracker.startWalk();

  assert.deepStrictEqual(taskKinds(), ["start"], "Start starts the location service");

  const [, taskName, taskOptions] = phone.taskCalls[0];

  assert.strictEqual(taskName, "walk-location-task");
  assert.ok(
    taskOptions.foregroundService.notificationTitle &&
      !/^walk\./.test(taskOptions.foregroundService.notificationTitle),
    "with a notification that says what it is"
  );
  assert.ok(!/^walk\./.test(taskOptions.foregroundService.notificationBody));
  assert.strictEqual(taskOptions.foregroundService.killServiceOnDestroy, true, "that ends with the app");
  assert.strictEqual(taskOptions.pausesUpdatesAutomatically, false, "iOS must not decide the phone stands still");
  assert.strictEqual(taskOptions.showsBackgroundLocationIndicator, true);
  assert.strictEqual(taskOptions.activityType, 3);
  assert.strictEqual(phone.locationWatchers.length, 0, "the task is the only source of positions");
  assert.strictEqual(phone.stepWatchers.length, 1);

  await walkSeconds(30);
  snap = tracker.getWalkSnapshot(12);

  assert.ok(Math.abs(snap.distanceMeters - 30 * 1.4) < 8, `positions from the task are the walk, got ${snap.distanceMeters}`);
  assert.strictEqual(snap.steps, 60);

  // A task can deliver several positions at once, and not in order.
  await advance(3);
  {
    const base = walkedMeters;
    const point = (n) => ({
      coords: { latitude: 55 + (base + 1.4 * n) / METERS_PER_DEGREE, longitude: 12, accuracy: 8, speed: 1.4 },
      timestamp: clock - 3000 + n * 1000,
    });
    const before = tracker.getWalkSnapshot(12).distanceMeters;

    walkedMeters += 4.2;
    await deliver([point(3), point(1), point(2)]);

    const gained = tracker.getWalkSnapshot(12).distanceMeters - before;

    assert.ok(gained > 3.4 && gained < 5, `a batch is folded oldest first, got +${gained}`);
  }

  // The screen goes off.
  const stepWatcher = lastStepWatcher();
  const stepsAtBackground = tracker.getWalkSnapshot(12).steps;
  const distanceAtBackground = tracker.getWalkSnapshot(12).distanceMeters;
  const breaksAtBackground = noBreaks(12);

  phone.appStateHandler("background");
  await flush();
  assert.deepStrictEqual(taskKinds(), ["start"], "the app in the background does not stop the service");
  assert.strictEqual(stepWatcher.removed, false, "nor the step counter");
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "running");
  assert.strictEqual(noBreaks(12), breaksAtBackground, "and the route is not broken");

  const walkedAtBackground = walkedMeters;

  await screenOffSeconds(60, { moving: true });
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "running", "walking with the screen off is not a pause");
  assert.ok(
    bgOne("SELECT actual_distance AS d FROM Run WHERE workout_id = 12").d * 1000 > distanceAtBackground + 50,
    "the walk is saved from the positions while the timers are asleep"
  );

  // Standing still: the positions judge it, since the step counter is stopped.
  await screenOffSeconds(14, { moving: false });
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "autoPaused", "standing still behind the screen auto pauses");
  assert.strictEqual(bgOne("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 12").t, null);

  // The jitter of a phone lying still is not walking: one position that moved
  // does not wake it.
  walkedMeters += 1.4;
  await screenOffSeconds(5, { moving: false });
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "autoPaused", "one jump of the position does not wake an auto pause");

  // And walking again wakes it, with a step watcher that is no longer delivering.
  await screenOffSeconds(6, { moving: true });
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "running", "ground gained behind the screen resumes an auto pause");
  assert.notStrictEqual(bgOne("SELECT timer_start AS t FROM Workout_Type_Instance WHERE workout_id = 12").t, null);
  await screenOffSeconds(10, { moving: true });
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "running");

  // The screen is back: the step counter catches up to its total in one go,
  // once, whatever iOS could say about the gap.
  intervals.forEach((interval) => {
    interval.next = clock + interval.every;
  });
  Platform.OS = "ios";
  phone.missedSteps = 150;
  phone.appStateHandler("active");
  await flush();
  stepWatcher.total += 500;
  stepWatcher.callback({ steps: stepWatcher.total });
  await flush();
  snap = tracker.getWalkSnapshot(12);
  Platform.OS = "android";

  assert.strictEqual(snap.steps, stepsAtBackground + 500, "the catch-up is the steps of the gap, counted once");
  assert.ok(snap.distanceMeters - distanceAtBackground > 80, `the distance walked behind the screen is there, got +${snap.distanceMeters - distanceAtBackground}`);
  assert.ok(snap.distanceMeters - distanceAtBackground < 110);
  assert.ok(walkedMeters - walkedAtBackground > 90);
  assert.ok([null, 0].includes(tracker.cadenceOf(snap, clock)), "a jump of steps is no cadence");
  await walkSeconds(8);
  assert.ok(Math.abs(tracker.cadenceOf(tracker.getWalkSnapshot(12), clock) - 120) <= 8, "the cadence is right again after it");
  assert.deepStrictEqual(taskKinds(), ["start"], "the service ran through all of it, once");

  // Pausing stops the service, and a resume right behind it starts a new one,
  // in that order.
  await tracker.pauseWalk();
  assert.deepStrictEqual(taskKinds(), ["start", "stop"], "pausing stops the service");
  assert.strictEqual(phone.runningTask, null);
  assert.ok(phone.stepWatchers.every((watcher) => watcher.removed));

  await tracker.resumeWalk();
  assert.deepStrictEqual(taskKinds(), ["start", "stop", "start"], "resuming starts it again");
  assert.ok(phone.runningTask);

  await Promise.all([tracker.pauseWalk(), tracker.resumeWalk()]);
  assert.deepStrictEqual(taskKinds().slice(3), ["stop", "start"], "a pause and a resume at once end with the service running");
  assert.ok(phone.runningTask, "and it is running");
  assert.strictEqual(tracker.getWalkSnapshot(12).status, "running");

  await walkSeconds(5);
  const finished = await tracker.finishWalk();

  assert.ok(finished);
  assert.strictEqual(taskKinds().at(-1), "stop", "finishing stops the service");
  assert.strictEqual(phone.runningTask, null);

  // Deleted, restarted, left: each one stops it.
  for (const [id, end] of [
    [13, () => tracker.releaseWalk(13)],
    [14, () => tracker.restartWalk()],
    [15, () => tracker.leaveWalk()],
  ]) {
    newBgWalk(id);
    await tracker.openWalk(bg, id);
    await tracker.startWalk();
    await walkSeconds(3);
    assert.ok(phone.runningTask, `walk ${id} has the service running`);
    await end();
    assert.strictEqual(phone.runningTask, null, `walk ${id} lets go of the service`);
  }

  // The first walk starts right after a permission dialog closes, when Android
  // does not count the app as in front yet: that refusal is tried again.
  newBgWalk(17);
  await tracker.openWalk(bg, 17);
  phone.refuseStarts = 2;
  phone.taskCalls = [];
  await tracker.startWalk();
  assert.deepStrictEqual(taskKinds(), ["start", "start", "start"], "a start refused for not being in front is tried again");
  assert.ok(phone.runningTask, "and the service runs once it is let through");
  assert.strictEqual(phone.locationWatchers.filter((watcher) => !watcher.removed).length, 0, "with no second source of positions");
  await tracker.leaveWalk();

  // A refusal that goes on - or for any other reason - is a walk that is
  // watched in front only, and the app going to the background lets go.
  newBgWalk(18);
  await tracker.openWalk(bg, 18);
  phone.refuseStarts = 99;
  await tracker.startWalk();
  phone.refuseStarts = 0;
  assert.strictEqual(phone.runningTask, null, "no service");
  assert.strictEqual(phone.locationWatchers.filter((watcher) => !watcher.removed).length, 1, "the position is watched in front");
  phone.appStateHandler("background");
  await flush();
  assert.ok(phone.locationWatchers.every((watcher) => watcher.removed), "and the background lets go of it");
  phone.appStateHandler("active");
  await flush();
  await flush();
  assert.ok(phone.runningTask, "back in front the service is let through, and takes over from the watcher");
  assert.strictEqual(phone.locationWatchers.filter((watcher) => !watcher.removed).length, 0);
  await tracker.leaveWalk();
  phone.taskCalls = [];

  // A late batch from a task that is being stopped must not stop the one a
  // quick resume has started behind it.
  newBgWalk(19);
  await tracker.openWalk(bg, 19);
  await tracker.startWalk();
  {
    let release = null;

    phone.stopGate = new Promise((resolve) => {
      release = resolve;
    });

    const pausing = tracker.pauseWalk();
    const resuming = tracker.resumeWalk();

    for (let turn = 0; turn < 10; turn += 1) {
      await flush();
    }

    await deliver([{ coords: { latitude: 55, longitude: 12, accuracy: 5, speed: 1 }, timestamp: clock }]);
    phone.stopGate = null;
    release();
    await Promise.all([pausing, resuming]);
    await flush();
    assert.ok(phone.runningTask, "the service the resume started is still running");
    assert.strictEqual(taskKinds().slice(-2).join(), "stop,start", "and nothing stopped it behind its back");
    await tracker.leaveWalk();
  }

  // No location, no service.
  newBgWalk(16);
  phone.locationPermission = { granted: false, status: "denied", canAskAgain: false };
  await tracker.openWalk(bg, 16);
  const callsBefore = phone.taskCalls.length;

  await tracker.startWalk();
  assert.strictEqual(phone.taskCalls.length, callsBefore, "a walk without location does not start the service");
  phone.locationPermission = { granted: true, status: "granted", canAskAgain: true };
  await tracker.leaveWalk();

  // A task that outlived its walk, or its app, is stopped and not listened to.
  phone.runningTask = { name: "walk-location-task" };
  await deliver([{ coords: { latitude: 55, longitude: 12, accuracy: 5, speed: 1 }, timestamp: clock }]);
  assert.strictEqual(phone.runningTask, null, "positions with no walk waiting stop the task");

  phone.runningTask = { name: "walk-location-task" };
  await locationService.stopWalkLocationTask();
  assert.strictEqual(phone.runningTask, null, "and so does the cleanup when the app starts");
  await phone.taskExecutors["walk-location-task"]({ data: null, error: new Error("the task failed") });

  assert.ok(phone.taskCalls.every(([, name]) => name === "walk-location-task"), "only the walk's task is ever started or stopped");

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
      "Walk tracker: start, distance and steps, auto pause and its resume, pause and resume, the background without the service, finish into one segment and the statistics, the route reopened, a killed app, denied location, no step counter, a deleted walk, and the screen-off path with its service."
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
