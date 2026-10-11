// Walks recorded with a watch, read from Health Connect and made into walks:
// the rules (which sessions, never twice, never on top of a walk of our own)
// and the whole import against a real SQLite database built from the app's own
// schema, with a Health Connect that this test drives.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const consoleError = console.error;

console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud (push|sync) failed|Workout hierarchy cloud/i.test(args[0])) {
    return;
  }

  consoleError(...args);
};
console.warn = () => {};

const NOW = Date.parse("2026-10-11T18:00:00Z");
const MIN = 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

/* ------------------------------------------------------------- the rules -- */

{
  const rules = loadAppModule("src/Utils/watchWalks.js");
  const session = (id, startMs, minutes, extra = {}) => ({
    exerciseType: 79,
    startTime: iso(startMs),
    endTime: iso(startMs + minutes * MIN),
    metadata: { id, dataOrigin: "com.sec.android.app.shealth", recordingMethod: 1, ...extra.metadata },
    ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== "metadata")),
  });
  const base = NOW - 5 * 24 * 60 * MIN;

  assert.strictEqual(rules.readWalkSession(session("a", base, 30)).durationSeconds, 1800, "a walk the person started");
  assert.strictEqual(rules.readWalkSession(session("a", base, 30, { exerciseType: 56 })), null, "a run is not a walk");
  assert.strictEqual(rules.readWalkSession(session("a", base, 4)), null, "too short");
  assert.ok(rules.readWalkSession(session("a", base, 5)), "five minutes is enough");
  assert.strictEqual(rules.readWalkSession(session("a", base, 30, { metadata: { recordingMethod: 2 } })), null, "a stroll the watch detected itself");
  assert.strictEqual(rules.readWalkSession(session("a", base, 30, { metadata: { recordingMethod: 3 } })), null, "typed in by hand");
  assert.ok(rules.readWalkSession(session("a", base, 30, { metadata: { recordingMethod: 0 } })), "an app that does not say is believed");
  assert.strictEqual(rules.readWalkSession(session("a", base, 30, { metadata: { id: undefined } })), null, "no id, no way to know it again");
  assert.strictEqual(rules.readWalkSession({ ...session("a", base, 30), endTime: iso(base) }), null, "ends before it starts");
  assert.strictEqual(rules.readWalkSession(null), null);

  const picked = rules.pickWalksToImport({
    sessions: [
      session("two", base + 3 * 24 * 60 * MIN, 20),
      session("one", base, 30),
      // The same walk written by the phone as well: starts a minute later.
      session("one-phone", base + MIN, 29),
      session("run", base + 60 * MIN, 30, { exerciseType: 56 }),
    ],
  });

  assert.deepStrictEqual(picked.map((walk) => walk.hcId), ["one", "two"], "oldest first, the duplicate and the run left out");

  assert.deepStrictEqual(
    rules.pickWalksToImport({ sessions: [session("one", base, 30)], existing: [{ hcId: "one", startMs: base, endMs: base + 30 * MIN }] }),
    [],
    "imported before"
  );
  assert.deepStrictEqual(
    rules.pickWalksToImport({ sessions: [session("one", base, 30)], existing: [{ hcId: null, startMs: base + MIN, endMs: base + 25 * MIN }] }),
    [],
    "a walk with this start is there already (tracked here, or back from the cloud)"
  );
  assert.deepStrictEqual(
    rules.pickWalksToImport({ sessions: [session("one", base, 30)], existing: [{ hcId: null, startMs: base + 25 * MIN, endMs: base + 55 * MIN }] }).length,
    0,
    "overlapping a walk tracked here"
  );
  assert.strictEqual(
    rules.pickWalksToImport({ sessions: [session("one", base, 30)], existing: [{ hcId: null, startMs: base + 3 * 60 * MIN, endMs: base + 4 * 60 * MIN }] }).length,
    1,
    "a walk later the same day is another walk"
  );

  assert.deepStrictEqual(rules.walkNumbers({ durationSeconds: 1800, distanceMeters: null, steps: null }), { movingSeconds: 1800, distanceMeters: 0, steps: null }, "no distance is none");
  assert.deepStrictEqual(rules.walkNumbers({ durationSeconds: 1800.4, distanceMeters: 2500, steps: 3300.6 }), { movingSeconds: 1800, distanceMeters: 2500, steps: 3301 });

  const day = 24 * 60 * 60 * 1000;

  assert.strictEqual(rules.importFromMs({ lastImportMs: 0, now: NOW }), NOW - 14 * day, "the first time, two weeks");
  assert.strictEqual(rules.importFromMs({ lastImportMs: NOW - 2 * 60 * MIN, now: NOW }), NOW - 2 * 60 * MIN - day, "then since the last time, with a day to spare");
  assert.strictEqual(rules.importFromMs({ lastImportMs: NOW - 40 * day, now: NOW }), NOW - 14 * day, "never further back than two weeks");
}

/* -------------------------------------------------------- Health Connect -- */

const hc = {
  granted: [],
  sessions: [],
  distanceByStart: {},
  stepsByStart: {},
  routes: {},
  routeRefused: false,
  failRead: false,
  asked: [],
};

const storage = new Map();
const Platform = { OS: "android" };
const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from() {
    throw new Error("the import reached for the cloud while signed out");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
loadAppModule.stubModule("react-native", {
  Platform,
  Linking: { openURL: async () => {}, openSettings: async () => {} },
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
  Accuracy: { BestForNavigation: 6 },
  getForegroundPermissionsAsync: async () => ({ granted: false, status: "denied", canAskAgain: true }),
  requestForegroundPermissionsAsync: async () => ({ granted: false, status: "denied", canAskAgain: true }),
  hasStartedLocationUpdatesAsync: async () => false,
});
loadAppModule.stubModule("expo-sensors", {});
loadAppModule.stubModule("expo", { requireOptionalNativeModule: () => null });
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
loadAppModule.stubModule("react-native-health-connect", {
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  getSdkStatus: async () => 3,
  initialize: async () => true,
  getGrantedPermissions: async () => hc.granted,
  requestPermission: async (permissions) => {
    hc.asked.push(permissions.map((permission) => permission.recordType));
    hc.granted = permissions;

    return permissions;
  },
  readRecords: async (recordType, options) => {
    if (hc.failRead) {
      throw new Error("Health Connect is not answering");
    }

    assert.strictEqual(recordType, "ExerciseSession");

    const from = Date.parse(options.timeRangeFilter.startTime);
    const to = Date.parse(options.timeRangeFilter.endTime);

    return {
      records: hc.sessions.filter((session) => Date.parse(session.endTime) >= from && Date.parse(session.startTime) <= to),
      pageToken: undefined,
    };
  },
  aggregateRecord: async ({ recordType, timeRangeFilter }) => {
    const key = String(Date.parse(timeRangeFilter.startTime));

    if (recordType === "Distance") {
      return hc.distanceByStart[key] === undefined ? {} : { DISTANCE: { inMeters: hc.distanceByStart[key] } };
    }

    return hc.stepsByStart[key] === undefined ? {} : { COUNT_TOTAL: hc.stepsByStart[key] };
  },
  requestExerciseRoute: async (id) => {
    if (hc.routeRefused) {
      throw new Error("Route access denied");
    }

    return hc.routes[id] ?? [];
  },
});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const { locationSchemaSql } = loadAppModule("src/Database/schema/location.js");
const { stepsSchemaSql } = loadAppModule("src/Database/schema/steps.js");

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
  sqlite.exec(stepsSchemaSql);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS App_Metadata (metadata_key TEXT PRIMARY KEY, metadata_value TEXT);`);

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

const service = loadAppModule("src/Services/watchWalkService.js");
const walkService = loadAppModule("src/Services/walkService.js");

const walkSession = (id, startMs, minutes, extra = {}) => ({
  exerciseType: 79,
  startTime: iso(startMs),
  endTime: iso(startMs + minutes * MIN),
  metadata: { id, dataOrigin: "com.sec.android.app.shealth", recordingMethod: 1 },
  ...extra,
});

const startOne = NOW - 2 * 24 * 60 * MIN + 9 * 60 * MIN;
const startTwo = NOW - 24 * 60 * MIN;

async function main() {
  const db = createDatabase();
  const walks = () => db.sqlite.prepare(`SELECT * FROM Workout_Type_Instance WHERE workout_type = 'Walk' ORDER BY original_start_time`).all();
  const mapping = () => db.sqlite.prepare(`SELECT * FROM Imported_Health_Walk ORDER BY started_at`).all();

  hc.sessions = [
    walkSession("w1", startOne, 42),
    walkSession("w2", startTwo, 25),
    // Not walks: a run, a stroll the watch found by itself, a short one, a walk
    // the phone wrote as well as the watch.
    walkSession("run", startOne + 3 * 60 * MIN, 30, { exerciseType: 56 }),
    walkSession("auto", startOne + 4 * 60 * MIN, 30, { metadata: { id: "auto", recordingMethod: 2 } }),
    walkSession("short", startOne + 5 * 60 * MIN, 3),
    walkSession("w1-phone", startOne + MIN, 41, { metadata: { id: "w1-phone", dataOrigin: "com.google.android.apps.fitness", recordingMethod: 1 } }),
  ];
  hc.distanceByStart[String(startOne)] = 3150;
  hc.stepsByStart[String(startOne)] = 4380;
  hc.distanceByStart[String(startTwo)] = undefined; // the watch gave no distance
  hc.stepsByStart[String(startTwo)] = 2900;

  // Not switched on: nothing is read, nothing is made.
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW }), 0);
  assert.strictEqual(walks().length, 0);
  assert.deepStrictEqual(await service.getWatchWalkState(db), { access: "denied", enabled: false });

  // The yes: Health Connect is asked once for the sessions, the distance and the steps.
  const result = await service.enableWatchWalks(db);

  assert.deepStrictEqual(result, { access: "granted", enabled: true, imported: 2 });
  assert.deepStrictEqual(hc.asked, [["ExerciseSession", "Distance", "Steps"]]);
  assert.deepStrictEqual(await service.getWatchWalkState(db), { access: "granted", enabled: true });

  // Two walks, finished, with what the watch measured.
  const made = walks();

  assert.strictEqual(made.length, 2);
  assert.deepStrictEqual(
    made.map((walk) => [walk.done, walk.original_start_time, walk.elapsed_time, walk.started_from]),
    [
      [1, Math.floor(startOne / 1000), 42 * 60, "other"],
      [1, Math.floor(startTwo / 1000), 25 * 60, "other"],
    ]
  );
  assert.strictEqual(made[0].gym_id, null, "no centre was matched to a walk from a watch");

  const segment = (workoutId) => db.sqlite.prepare(`SELECT * FROM Run WHERE workout_id = ?`).get(workoutId);

  assert.deepStrictEqual(
    [segment(made[0].workout_id).actual_distance, segment(made[0].workout_id).actual_steps, segment(made[0].workout_id).done],
    [3.15, 4380, 1],
    "the distance in km and the steps of the same minutes"
  );
  assert.deepStrictEqual(
    [segment(made[1].workout_id).actual_distance, segment(made[1].workout_id).actual_steps],
    [0, 2900],
    "a walk with no distance has none - never an invented one"
  );

  const totals = await walkService.loadWalk(db, made[0].workout_id);

  assert.strictEqual(totals.totals.distanceKm, 3.15);
  assert.strictEqual(totals.totals.steps, 4380);
  assert.strictEqual(mapping().length, 2);
  assert.deepStrictEqual(mapping().map((row) => row.hc_id), ["w1", "w2"]);

  // The same sessions again: nothing new.
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 10 * MIN }), 0);
  assert.strictEqual(walks().length, 2);

  // A walk deleted afterwards is not brought back.
  db.sqlite.prepare(`UPDATE Workout_Type_Instance SET deleted_at = ? WHERE workout_id = ?`).run("2026-10-11T10:00:00Z", made[1].workout_id);
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 20 * MIN }), 0);
  assert.strictEqual(walks().length, 2, "the deleted one stays deleted");

  // A new phone: the walks came back from the cloud, the mapping did not.
  db.sqlite.exec(`DELETE FROM Imported_Health_Walk`);
  db.sqlite.exec(`DELETE FROM App_Metadata WHERE metadata_key = 'watch_walks_last_import_at'`);
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 30 * MIN }), 0, "found by their start, not by a mapping");
  assert.strictEqual(walks().length, 2);

  // A walk tracked in FitVen itself, and a session on top of it.
  const own = Math.floor((NOW - 6 * 60 * MIN) / 1000);

  db.sqlite
    .prepare(`INSERT INTO Day (Weekday, date) VALUES ('Sat', '2026-10-11')`)
    .run();
  const dayId = db.sqlite.prepare(`SELECT day_id FROM Day ORDER BY day_id DESC LIMIT 1`).get().day_id;

  db.sqlite
    .prepare(`INSERT INTO Workout_Type_Instance (day_id, workout_type, date, done, original_start_time, elapsed_time) VALUES (?, 'Walk', '2026-10-11', 1, ?, ?)`)
    .run(dayId, own, 30 * 60);
  hc.sessions.push(walkSession("over-own", (own + 10 * 60) * 1000, 30));
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 40 * MIN }), 0, "never on top of a walk of our own");

  // The watch syncs late: a walk from yesterday that turns up now is still found.
  hc.sessions.push(walkSession("late", NOW - 20 * 60 * MIN, 35));
  hc.stepsByStart[String(NOW - 20 * 60 * MIN)] = 3800;
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 50 * MIN }), 1);
  assert.strictEqual(mapping().some((row) => row.hc_id === "late"), true);

  // Health Connect not answering: nothing is made, and the next time is not postponed.
  hc.failRead = true;
  hc.sessions.push(walkSession("later", NOW - 10 * 60 * MIN, 35));
  const lastBefore = db.sqlite.prepare(`SELECT metadata_value FROM App_Metadata WHERE metadata_key = 'watch_walks_last_import_at'`).get().metadata_value;

  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 60 * MIN }), 0);
  assert.strictEqual(db.sqlite.prepare(`SELECT metadata_value FROM App_Metadata WHERE metadata_key = 'watch_walks_last_import_at'`).get().metadata_value, lastBefore);
  hc.failRead = false;
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 70 * MIN }), 1, "and it is read when it answers again");

  // Switched off: the walks stay, no new ones.
  await service.disableWatchWalks(db);
  hc.sessions.push(walkSession("after-off", NOW - 5 * 60 * MIN, 35));
  assert.strictEqual(await service.importWatchWalks(db, { now: NOW + 80 * MIN }), 0);
  assert.strictEqual(walks().length >= 4, true);

  /* ------------------------------------------------------------- the route -- */

  const first = made[0].workout_id;
  const origin = await service.getWatchWalkOrigin(db, first);

  assert.strictEqual(origin, null, "the mapping was rebuilt by the test, not for this walk");

  await db.runAsync(
    `INSERT INTO Imported_Health_Walk (hc_id, workout_id, started_at, ended_at, origin, imported_at) VALUES ('w1', ?, ?, ?, 'x', 1)`,
    [first, startOne, startOne + 42 * MIN]
  );
  assert.deepStrictEqual(await service.getWatchWalkOrigin(db, first), { hcId: "w1", routeLoaded: false });
  assert.strictEqual(await service.getWatchWalkOrigin(db, 99999), null, "a walk tracked here is not from a watch");

  // The person says no to the route.
  hc.routes.w1 = [
    { time: iso(startOne + 60 * 1000), latitude: 55.1, longitude: 12.1, horizontalAccuracy: { inMeters: 6 } },
    { time: iso(startOne), latitude: 55.0, longitude: 12.0 },
    { time: "not a time", latitude: 55.2, longitude: 12.2 },
  ];
  hc.routeRefused = true;
  assert.strictEqual(await service.loadWatchWalkRoute(db, first), 0);
  assert.strictEqual(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM LocationLog WHERE workout_id = ?`).get(first).n, 0);

  // And yes: the points are kept, oldest first, on the phone.
  hc.routeRefused = false;
  assert.strictEqual(await service.loadWatchWalkRoute(db, first), 2, "the point with no time is left out");

  const points = db.sqlite.prepare(`SELECT latitude, longitude, accuracy, timestamp FROM LocationLog WHERE workout_id = ? ORDER BY id`).all(first);

  assert.deepStrictEqual(points.map((point) => point.latitude), [55.0, 55.1], "oldest first");
  assert.strictEqual(points[1].accuracy, 6);
  assert.deepStrictEqual(await service.getWatchWalkOrigin(db, first), { hcId: "w1", routeLoaded: true });

  // The route is on the walk now, where the walk screen reads it.
  assert.strictEqual((await walkService.loadWalk(db, first)).points.length, 2);

  // A route that is fetched again replaces the old one.
  assert.strictEqual(await service.loadWatchWalkRoute(db, first), 2);
  assert.strictEqual(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM LocationLog WHERE workout_id = ?`).get(first).n, 2);

  // iPhone: nothing to read.
  Platform.OS = "ios";
  assert.deepStrictEqual(await service.getWatchWalkState(db), { access: "unavailable", enabled: false });
  Platform.OS = "android";
}

main()
  .then(() => {
    console.log(
      "Watch walks: which sessions are walks, never twice (also after a delete or a new phone), never on top of a walk of our own, the numbers from Health Connect, the route on request and the iPhone."
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
