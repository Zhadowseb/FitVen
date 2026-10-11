// The one number a day keeps: which source's number wins, what a refresh
// writes, how the phone and the cloud meet, and the iPhone's own motion
// history - the real services on real SQLite, with the cloud faked.
const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

console.warn = () => {};

const log = loadAppModule("src/Utils/dailyStepLog.js");

/* ------------------------------------------------------------------ rules -- */

assert.deepStrictEqual(log.STEP_SOURCES, ["health", "motion", "sensor"], "best first");
assert.strictEqual(log.normalizeDailySteps(8000.4), 8000);
assert.strictEqual(log.normalizeDailySteps(-1), null);
assert.strictEqual(log.normalizeDailySteps(200001), null, "more than a person can walk is a fault");
assert.strictEqual(log.normalizeDailySteps("x"), null);
assert.deepStrictEqual(log.normalizeDayRow({ day: "2026-10-05", steps: 100, source: "health" }), { day: "2026-10-05", steps: 100, source: "health" });
assert.strictEqual(log.normalizeDayRow({ day: "5 Oct", steps: 100, source: "health" }), null);
assert.strictEqual(log.normalizeDayRow({ day: "2026-10-05", steps: 100, source: "gps" }), null, "a source nobody knows");

const row = (steps, source) => ({ day: "2026-10-05", steps, source });

assert.strictEqual(log.pickDay(row(9000, "motion"), row(3000, "health")).source, "health", "the better source wins even with the smaller number");
assert.strictEqual(log.pickDay(row(3000, "health"), row(9000, "sensor")).source, "health", "and a worse one never replaces it");
assert.strictEqual(log.pickDay(row(6000, "health"), row(6500, "health")).steps, 6500, "between equals the larger number: a day only grows");
assert.strictEqual(log.pickDay(row(6500, "health"), row(6000, "health")).steps, 6500);
assert.strictEqual(log.pickDay(null, row(1, "sensor")).steps, 1);
assert.strictEqual(log.pickDay(row(1, "sensor"), null).steps, 1);
// Commutative: the order the phones speak in does not matter.
for (const [left, right] of [[row(5, "health"), row(9, "motion")], [row(5, "sensor"), row(9, "sensor")], [row(7, "motion"), row(7, "motion")]]) {
  assert.deepStrictEqual(log.pickDay(left, right), log.pickDay(right, left));
}

const NOW = 1_800_000_000_000;
const days = ["2026-10-05", "2026-10-06", "2026-10-07"];

{
  const plan = log.planRefresh({
    days,
    readings: {
      health: { "2026-10-05": 8000, "2026-10-06": 0 },
      motion: { "2026-10-05": 7000, "2026-10-06": 4000, "2026-10-07": 0 },
    },
    existing: new Map(),
    now: NOW,
  });

  assert.deepStrictEqual(
    plan.map((write) => [write.day, write.steps, write.source]),
    [["2026-10-05", 8000, "health"], ["2026-10-06", 4000, "motion"]],
    "health wins where it has a number; a 0 is not a number, so motion answers for the day health is silent on; nothing for a day neither knows"
  );
  assert.ok(plan.every((write) => write.needsSync && write.updatedAt === NOW), "and every write is on its way to the cloud");
}
{
  const existing = new Map([["2026-10-05", { steps: 8000, source: "health" }]]);

  // The health app has gone quiet (permission taken away): the day stays.
  assert.deepStrictEqual(log.planRefresh({ days, readings: { health: null, motion: { "2026-10-05": 6000 } }, existing, now: NOW }), []);
  // Nothing new: nothing written.
  assert.deepStrictEqual(log.planRefresh({ days, readings: { health: { "2026-10-05": 8000 } }, existing, now: NOW }), []);
  // The same source, later in the day: more steps.
  assert.deepStrictEqual(
    log.planRefresh({ days, readings: { health: { "2026-10-05": 9100 } }, existing, now: NOW }).map((write) => write.steps),
    [9100]
  );
  // The same source, fewer (a record deleted in the health app): the day keeps what it had.
  assert.deepStrictEqual(log.planRefresh({ days, readings: { health: { "2026-10-05": 100 } }, existing, now: NOW }), []);
  // A better source arrives for a day that had a worse one.
  assert.deepStrictEqual(
    log
      .planRefresh({ days, readings: { health: { "2026-10-06": 2000 } }, existing: new Map([["2026-10-06", { steps: 5000, source: "motion" }]]), now: NOW })
      .map((write) => [write.steps, write.source]),
    [[2000, "health"]],
    "upgraded, even to a smaller number"
  );
  // A fault is not a number.
  assert.deepStrictEqual(log.planRefresh({ days, readings: { health: { "2026-10-07": 999999 } }, existing: new Map(), now: NOW }), []);
}

{
  const local = new Map([
    ["2026-10-05", { day: "2026-10-05", steps: 8000, source: "health" }],
    ["2026-10-06", { day: "2026-10-06", steps: 3000, source: "motion" }],
    ["2026-10-07", { day: "2026-10-07", steps: 5000, source: "health" }],
    ["2026-10-08", { day: "2026-10-08", steps: 100, source: "sensor" }],
  ]);
  const plan = log.planCloudMerge({
    local,
    cloud: [
      { day: "2026-10-04", steps: 4000, source: "health" }, // a day this phone has not seen
      { day: "2026-10-05", steps: 8000, source: "health" }, // the same
      { day: "2026-10-06", steps: 9000, source: "health" }, // better than ours
      { day: "2026-10-07", steps: 2000, source: "sensor" }, // worse than ours
      { day: "2026-10-08", steps: 100, source: "sensor", extra: 1 }, // the same
      { day: "bad", steps: 1, source: "health" },
    ],
    now: NOW,
  });

  assert.deepStrictEqual(plan.writeLocal.map((write) => [write.day, write.steps, write.source, write.needsSync]), [
    ["2026-10-04", 4000, "health", false],
    ["2026-10-06", 9000, "health", false],
  ], "the cloud's number is kept here when it is new or better, and then it is not sent back");
  assert.deepStrictEqual(plan.inSync, ["2026-10-05", "2026-10-08"]);
  assert.deepStrictEqual(plan.goUp, ["2026-10-07"], "ours is the better one: it goes up over the cloud's");
}

assert.ok(log.isMissingDailyStepsTableError({ code: "42P01", message: "relation \"public.daily_steps\" does not exist" }));
assert.ok(log.isMissingDailyStepsTableError({ code: "PGRST205", message: "Could not find the table 'public.daily_steps' in the schema cache" }));
assert.ok(!log.isMissingDailyStepsTableError({ code: "42501", message: "new row violates row-level security policy for table \"daily_steps\"" }), "a refusal is not a missing table");
assert.ok(!log.isMissingDailyStepsTableError(null));

/* ---------------------------------------------------------- the services -- */

const storage = new Map();
const world = {
  userId: "u1",
  acceptedPolicy: "2026-10-11.1",
  tables: { daily_steps: [] },
  tableMissing: false,
  calls: [],
};

function fakeFrom(table) {
  const query = { table, filters: [], order: null, op: "select" };
  const run = () => {
    world.calls.push(`${table}:${query.op}`);

    if (table === "profile_private") {
      return { data: [{ user_id: world.userId, privacy_policy_version: world.acceptedPolicy }], error: null };
    }

    if (world.tableMissing) {
      return { data: null, error: { code: "42P01", message: "relation \"public.daily_steps\" does not exist" } };
    }

    if (query.op === "upsert") {
      for (const incoming of query.rows) {
        const at = world.tables.daily_steps.findIndex((existing) => existing.user_id === incoming.user_id && existing.day === incoming.day);

        if (at >= 0) {
          world.tables.daily_steps[at] = { ...incoming };
        } else {
          world.tables.daily_steps.push({ ...incoming });
        }
      }

      return { data: null, error: null };
    }

    let rows = world.tables.daily_steps.filter((entry) =>
      query.filters.every(([kind, column, value]) => (kind === "eq" ? entry[column] === value : entry[column] >= value))
    );

    if (query.order) {
      rows = [...rows].sort((left, right) => (left[query.order] < right[query.order] ? -1 : 1));
    }

    return { data: rows.map((entry) => ({ ...entry })), error: null };
  };

  const builder = {
    select() {
      return builder;
    },
    eq(column, value) {
      query.filters.push(["eq", column, value]);
      return builder;
    },
    gte(column, value) {
      query.filters.push(["gte", column, value]);
      return builder;
    },
    order(column) {
      query.order = column;
      return builder;
    },
    maybeSingle() {
      const result = run();

      return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error });
    },
    upsert(rows) {
      query.op = "upsert";
      query.rows = rows;

      return Promise.resolve(run());
    },
    then(resolve, reject) {
      return Promise.resolve(run()).then(resolve, reject);
    },
  };

  return builder;
}

const platform = { OS: "ios" };
const motion = { permission: "granted", available: true, reads: [], steps: {} };

loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: fakeFrom,
  }),
  processLock: () => {},
});
loadAppModule.stubModule("react-native", {
  Platform: platform,
  Linking: { openURL: async () => {} },
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
// The native step sensor of an Android phone, driven by the test.
const nativeSensor = {
  present: false,
  permission: false,
  recording: false,
  now: null,
  store: [],
  trimmedBefore: [],
};

loadAppModule.stubModule("expo", {
  requireOptionalNativeModule: () =>
    nativeSensor.present
      ? {
          isAvailable: () => nativeSensor.present,
          hasPermission: () => nativeSensor.permission,
          readNow: async () => {
            if (nativeSensor.now) {
              nativeSensor.store.push(nativeSensor.now);
            }

            return nativeSensor.now;
          },
          startRecording: async () => {
            nativeSensor.recording = true;
          },
          stopRecording: async () => {
            nativeSensor.recording = false;
          },
          isRecording: async () => nativeSensor.recording,
          readSnapshots: async (after) => JSON.stringify(nativeSensor.store.filter((entry) => entry.time > after)),
          trimSnapshots: async (before) => {
            nativeSensor.trimmedBefore.push(before);
          },
        }
      : null,
});
loadAppModule.stubModule("expo-sensors", {
  Pedometer: {
    isAvailableAsync: async () => motion.available,
    getPermissionsAsync: async () => ({ granted: motion.permission === "granted", status: motion.permission, canAskAgain: true }),
    requestPermissionsAsync: async () => {
      nativeSensor.permission = true;
      motion.permission = "granted";

      return { granted: true, status: "granted", canAskAgain: true };
    },
    getStepCountAsync: async (start, end) => {
      motion.reads.push([start, end]);

      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      return { steps: motion.steps[iso] ?? 0 };
    },
  },
});
const hc = { calls: [], respond: null };

loadAppModule.stubModule("react-native-health-connect", {
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_AVAILABLE: 3 },
  getSdkStatus: async () => 3,
  initialize: async () => true,
  getGrantedPermissions: async () => [{ accessType: "read", recordType: "Steps" }],
  requestPermission: async (permissions) => permissions,
  openHealthConnectSettings() {},
  aggregateGroupByPeriod: async (request) => {
    hc.calls.push(request);

    return hc.respond ? hc.respond(request) : [];
  },
});

const kit = { status: 1, reads: [], rows: [] };

loadAppModule.stubModule("@kingstinct/react-native-healthkit", {
  isHealthDataAvailableAsync: async () => true,
  getRequestStatusForAuthorization: async () => kit.status,
  requestAuthorization: async () => {
    kit.status = 2;

    return true;
  },
  queryStatisticsCollectionForQuantity: async (...args) => {
    kit.reads.push(args);

    return kit.rows;
  },
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { stepsSchemaSql } = loadAppModule("src/Database/schema/steps.js");
const dailyLog = loadAppModule("src/Utils/dailySteps.js");
const steps = loadAppModule("src/Services/dailyStepsService.js");
const stepsService = loadAppModule("src/Services/stepsService.js");
const sensorService = loadAppModule("src/Services/stepSensorService.js");
const stepCounter = loadAppModule("src/Services/stepCounterService.js");
const stepsRepository = loadAppModule("src/Repository/stepsRepository.js");

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) => (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) => (value === undefined ? null : value));

  sqlite.exec(programSchemaSql);
  sqlite.exec(stepsSchemaSql);

  return {
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(sql, params) {
      return sqlite.prepare(sql).all(...bind(params)).map((entry) => ({ ...entry }));
    },
    async getFirstAsync(sql, params) {
      const entry = sqlite.prepare(sql).get(...bind(params));

      return entry ? { ...entry } : null;
    },
  };
}

const TODAY = dailyLog.localIsoDate();
const day = (offset) => dailyLog.addDays(TODAY, offset);
const kept = (db) => db.sqlite.prepare("SELECT day, steps, source, needs_sync FROM Daily_Steps ORDER BY day").all().map((entry) => ({ ...entry }));
const put = (db, offset, stepsValue, source, needsSync = 1) =>
  db.sqlite
    .prepare("INSERT OR REPLACE INTO Daily_Steps (day, steps, source, updated_at, needs_sync) VALUES (?, ?, ?, ?, ?)")
    .run(day(offset), stepsValue, source, 1000, needsSync);

async function main() {
  /* -------------------------------------------- the iPhone's motion history -- */

  {
    motion.steps = { [day(-6)]: 600, [day(-3)]: 3000, [day(-1)]: 5000, [day(0)]: 250 };
    motion.reads = [];

    const read = await stepCounter.readMotionDailySteps(day(-30), day(0));

    assert.deepStrictEqual(Object.keys(read), [day(-6), day(-5), day(-4), day(-3), day(-2), day(-1), day(0)], "only the week Core Motion remembers");
    assert.strictEqual(read[day(-3)], 3000);
    assert.strictEqual(read[day(0)], 250);
    assert.strictEqual(motion.reads.length, 7);

    motion.permission = "undetermined";
    motion.reads = [];
    assert.strictEqual(await stepCounter.readMotionDailySteps(day(-6), day(0)), null, "it never asks: without the permission it reads nothing");
    assert.strictEqual(motion.reads.length, 0);
    motion.permission = "granted";

    platform.OS = "android";
    assert.strictEqual(await stepCounter.readMotionDailySteps(day(-6), day(0)), null, "and it is the iPhone's history, not Android's");
    platform.OS = "ios";
  }

  /* ------------------------------------------------ reading sources into the table -- */

  {
    const db = createDatabase();

    await stepsRepository.setStepsEnabled(db);
    motion.steps = { [day(-1)]: 5000, [day(0)]: 250 };

    const written = await steps.refreshRecentDailySteps(db);

    assert.ok(written >= 2, "the sources were read into the table");
    assert.deepStrictEqual(
      kept(db).filter((entry) => entry.day >= day(-1)).map((entry) => [entry.day, entry.steps, entry.source, entry.needs_sync]),
      [[day(-1), 5000, "motion", 1], [day(0), 250, "motion", 1]],
      "the iPhone's own history stands in where there is no health app"
    );
    assert.strictEqual(await steps.refreshRecentDailySteps(db), 0, "a second look finds nothing new and writes nothing");
  }
  {
    // A permission given for a walk is not a yes to the whole day: nothing is read,
    // and nothing is sent, until Allow has been tapped on the steps card.
    world.tables.daily_steps = [];

    const db = createDatabase();

    motion.permission = "granted";
    motion.steps = { [day(-1)]: 5000, [day(0)]: 250 };
    motion.reads = [];
    kit.reads = [];

    assert.strictEqual(await steps.refreshRecentDailySteps(db), 0);
    assert.strictEqual(motion.reads.length, 0, "the motion history is not read");
    assert.strictEqual(kit.reads.length, 0, "and neither is Apple Health");
    assert.strictEqual(kept(db).length, 0);

    const result = await steps.syncDailyStepsWithCloud(db, { userId: "u1", policyVersion: "2026-10-11.1" });

    assert.deepStrictEqual(result, { pulled: 0, pushed: 0 }, "and nothing goes up");
    assert.strictEqual(world.tables.daily_steps.length, 0);

    await stepsRepository.setStepsEnabled(db);
    assert.ok((await steps.refreshRecentDailySteps(db)) > 0, "after Allow it is read");
    assert.ok(motion.reads.length > 0);
  }
  {
    // The first opening, before the question has been asked, does not use up the history.
    const db = createDatabase();

    await stepsRepository.setStepsEnabled(db);
    motion.permission = "undetermined";
    kit.status = 1;
    await steps.refreshRecentDailySteps(db);
    assert.strictEqual(await stepsRepository.getBackfillDoneAt(db, "motion"), 0, "no source answered, so nothing was marked done");
    assert.strictEqual(await stepsRepository.getBackfillDoneAt(db, "health"), 0);
    motion.permission = "granted";
    motion.steps = { [day(-5)]: 4000 };
    await steps.refreshRecentDailySteps(db);
    assert.ok((await stepsRepository.getBackfillDoneAt(db, "motion")) > 0, "the history is read once a source answers");
    assert.ok(kept(db).some((entry) => entry.day === day(-5) && entry.steps === 4000));

    // ...and the marks belong to this person's database, not to the phone.
    const other = createDatabase();

    assert.strictEqual(await stepsRepository.getBackfillDoneAt(other, "motion"), 0);
  }
  {
    // A better source that comes later still gets its history, though the table
    // already holds days from a worse one: motion first, Apple Health turned on after.
    const db = createDatabase();

    await stepsRepository.setStepsEnabled(db);
    motion.permission = "granted";
    motion.steps = { [day(-5)]: 4000, [day(-4)]: 3000, [day(-1)]: 5000 };
    kit.status = 1; // not asked yet
    kit.rows = [];
    await steps.refreshRecentDailySteps(db);
    assert.deepStrictEqual(
      kept(db).filter((entry) => entry.day <= day(-4)).map((entry) => [entry.day, entry.source]),
      [[day(-5), "motion"], [day(-4), "motion"]],
      "the table has days from the motion history"
    );
    assert.strictEqual(await stepsRepository.getBackfillDoneAt(db, "health"), 0);

    kit.status = 2; // Apple Health is allowed now
    kit.rows = [
      { startDate: new Date(day(-40) + "T00:00:00"), sumQuantity: { quantity: 7000, unit: "count" } },
      { startDate: new Date(day(-4) + "T00:00:00"), sumQuantity: { quantity: 8200, unit: "count" } },
    ];
    await steps.refreshRecentDailySteps(db);

    assert.ok((await stepsRepository.getBackfillDoneAt(db, "health")) > 0, "Apple Health's history is read, though the table was not empty");
    assert.deepStrictEqual(
      kept(db).filter((entry) => entry.day === day(-40) || entry.day === day(-4)).map((entry) => [entry.day, entry.steps, entry.source]),
      [[day(-40), 7000, "health"], [day(-4), 8200, "health"]],
      "a day from before the motion history is filled, and a day motion had is upgraded"
    );
  }
  {
    // A new phone: the cloud filled the table before health was allowed. Health still backfills.
    world.tables.daily_steps = [{ user_id: "u1", day: day(-10), steps: 2500, source: "motion", updated_at: new Date(1000).toISOString() }];

    const db = createDatabase();

    await steps.syncDailyStepsWithCloud(db, { userId: "u1", policyVersion: "2026-10-11.1" });
    assert.strictEqual(kept(db).length, 1, "the history came from the cloud");

    await stepsRepository.setStepsEnabled(db);
    kit.status = 2;
    kit.rows = [{ startDate: new Date(day(-30) + "T00:00:00"), sumQuantity: { quantity: 6100, unit: "count" } }];
    await steps.refreshRecentDailySteps(db);
    assert.ok(kept(db).some((entry) => entry.day === day(-30) && entry.source === "health"), "and Apple Health's days are read on top");
    world.tables.daily_steps = [];
  }
  {
    // Android: the history is asked for within the 30 days Health Connect shows
    // without the history permission, not for 90 it may refuse.
    platform.OS = "android";
    hc.calls = [];

    const db = createDatabase();

    await stepsRepository.setStepsEnabled(db);
    await steps.refreshRecentDailySteps(db);

    const starts = hc.calls.map((call) => new Date(call.timeRangeFilter.startTime));
    const oldest = new Date(Math.min(...starts));
    const asked = Math.round((new Date(TODAY + "T00:00:00") - oldest) / (24 * 60 * 60 * 1000));

    assert.strictEqual(hc.calls.length, 2, "the last days, and the history");
    assert.strictEqual(asked, 29, "the history goes back 29 days on Android");
    assert.ok((await stepsRepository.getBackfillDoneAt(db, "health")) > 0);
    platform.OS = "ios";
  }

  /* ------------------------------------------------------------- the cloud -- */

  const sync = (db, extra = {}) => steps.syncDailyStepsWithCloud(db, { userId: "u1", policyVersion: "2026-10-11.1", ...extra });

  assert.deepStrictEqual(await steps.syncDailyStepsWithCloud(createDatabase(), { userId: null, policyVersion: "x" }), { skipped: "signed_out" });

  {
    world.calls = [];
    world.acceptedPolicy = "2026-10-04.1";

    const db = createDatabase();

    put(db, -1, 7000, "health");
    assert.deepStrictEqual(await sync(db), { skipped: "policy_not_accepted" }, "health data goes up only under the policy this build carries");
    assert.deepStrictEqual(world.calls, ["profile_private:select"], "and nothing else is asked of the cloud");
    assert.strictEqual(kept(db)[0].needs_sync, 1, "the day waits on the phone");
    world.acceptedPolicy = "2026-10-11.1";
  }
  {
    // The first meeting: what the phone has goes up, and is then not dirty.
    world.tables.daily_steps = [];

    const db = createDatabase();

    put(db, -2, 6000, "health");
    put(db, -1, 7000, "motion");

    const result = await sync(db);

    assert.deepStrictEqual(result, { pulled: 0, pushed: 2 });
    assert.deepStrictEqual(
      world.tables.daily_steps.map((entry) => [entry.user_id, entry.day, entry.steps, entry.source]),
      [["u1", day(-2), 6000, "health"], ["u1", day(-1), 7000, "motion"]]
    );
    assert.ok(world.tables.daily_steps.every((entry) => !Number.isNaN(Date.parse(entry.updated_at))), "with a real timestamp");
    assert.ok(kept(db).every((entry) => entry.needs_sync === 0), "and the phone knows the cloud has them");
    assert.deepStrictEqual(await sync(db), { pulled: 0, pushed: 0 }, "a second meeting sends nothing");
  }
  {
    // A new phone: its history comes back from the cloud, and nothing goes up.
    const db = createDatabase();
    const result = await sync(db);

    assert.deepStrictEqual(result, { pulled: 2, pushed: 0 });
    assert.deepStrictEqual(kept(db).map((entry) => [entry.day, entry.steps, entry.source, entry.needs_sync]), [
      [day(-2), 6000, "health", 0],
      [day(-1), 7000, "motion", 0],
    ]);
  }
  {
    // Two phones that disagree: the better source wins on both, whoever speaks first.
    world.tables.daily_steps = [
      { user_id: "u1", day: day(-3), steps: 9000, source: "health", updated_at: new Date(1000).toISOString() },
      { user_id: "u1", day: day(-2), steps: 100, source: "sensor", updated_at: new Date(1000).toISOString() },
    ];

    const db = createDatabase();

    put(db, -3, 3000, "sensor"); // worse than the cloud's
    put(db, -2, 4000, "motion"); // better than the cloud's

    const result = await sync(db);

    assert.deepStrictEqual(result, { pulled: 1, pushed: 1 });
    assert.deepStrictEqual(
      kept(db).map((entry) => [entry.day, entry.steps, entry.source, entry.needs_sync]),
      [[day(-3), 9000, "health", 0], [day(-2), 4000, "motion", 0]],
      "the cloud's health number replaced the sensor's here"
    );
    assert.deepStrictEqual(
      world.tables.daily_steps.map((entry) => [entry.day, entry.steps, entry.source]),
      [[day(-3), 9000, "health"], [day(-2), 4000, "motion"]],
      "and the motion number replaced the sensor's there - the worse one never wins"
    );
  }
  {
    // A row only the owner can touch: nothing written for somebody else's id.
    world.tables.daily_steps = [{ user_id: "somebody-else", day: day(-1), steps: 12345, source: "health", updated_at: new Date(1000).toISOString() }];

    const db = createDatabase();

    assert.deepStrictEqual(await sync(db), { pulled: 0, pushed: 0 }, "another person's day is not this person's history");
    assert.strictEqual(kept(db).length, 0);
  }
  {
    // The migration has not been run: the days stay on the phone, and nothing breaks.
    world.tableMissing = true;

    const db = createDatabase();

    put(db, -1, 7000, "health");
    assert.deepStrictEqual(await sync(db), { skipped: "cloud_missing" });
    assert.strictEqual(kept(db)[0].needs_sync, 1, "still waiting");
    world.tableMissing = false;
  }
  {
    // A number that changed while the upload was out goes again.
    const db = createDatabase();

    put(db, -1, 7000, "health");
    await stepsRepository.markDailyStepSynced(db, { day: day(-1), updatedAt: 999 });
    assert.strictEqual(kept(db)[0].needs_sync, 1, "it is not cleared for a row that is no longer the one that was sent");
    await stepsRepository.markDailyStepSynced(db, { day: day(-1), updatedAt: 1000 });
    assert.strictEqual(kept(db)[0].needs_sync, 0);
  }

  /* ----------------------------------------- Android: the phone's own step sensor -- */

  {
    platform.OS = "android";
    nativeSensor.present = true;
    nativeSensor.permission = true;
    nativeSensor.recording = false;
    nativeSensor.trimmedBefore = [];
    hc.respond = null; // Health Connect is there and has nothing.

    const bootTime = Date.now() - 36 * 60 * 60 * 1000;
    const at = (offset, hour, minute = 0) => {
      const date = new Date(day(offset) + "T00:00:00");

      date.setHours(hour, minute, 0, 0);

      return date.getTime();
    };

    // Not allowed yet: nothing is counted, nothing recorded.
    {
      const db = createDatabase();

      nativeSensor.store = [{ time: at(-1, 10), counter: 1000, bootTime }];
      nativeSensor.now = { time: Date.now(), counter: 2500, bootTime };
      assert.strictEqual(await steps.refreshRecentDailySteps(db), 0);
      assert.strictEqual(nativeSensor.recording, false, "no periodic job before Allow");
      assert.strictEqual(kept(db).length, 0);
    }

    // Allowed: the sensor counts, and a day with no health number gets its steps from it.
    const db = createDatabase();

    await stepsRepository.setStepsEnabled(db);
    nativeSensor.store = [
      { time: at(-1, 10), counter: 1000, bootTime },
      { time: at(-1, 14), counter: 1500, bootTime },
      { time: at(-1, 20), counter: 2400, bootTime },
    ];
    nativeSensor.now = { time: Date.now(), counter: 2500, bootTime };
    nativeSensor.permission = false;
    assert.strictEqual(await steps.refreshRecentDailySteps(db), 0, "without the permission it counts nothing");
    assert.strictEqual(nativeSensor.recording, false);
    nativeSensor.permission = true;

    await steps.refreshRecentDailySteps(db);

    assert.strictEqual(nativeSensor.recording, true, "the periodic read is started");

    const rows = kept(db).filter((entry) => entry.source === "sensor");
    const counted = rows.reduce((sum, entry) => sum + entry.steps, 0);

    assert.ok(rows.length >= 1 && rows.every((entry) => entry.needs_sync === 1), "the days are kept as the sensor's, waiting for the cloud");
    assert.ok(Math.abs(counted - 1500) <= 2, "the steps between the first reading and now: " + counted);
    assert.ok(rows.find((entry) => entry.day === day(-1))?.steps >= 1400, "most of them on yesterday");
    assert.ok(nativeSensor.trimmedBefore.length > 0, "the readings that were counted are let go natively");

    // Counting what was counted again adds nothing.
    nativeSensor.now = null;
    await steps.refreshRecentDailySteps(db);
    assert.strictEqual(kept(db).filter((entry) => entry.source === "sensor").reduce((sum, entry) => sum + entry.steps, 0), counted);

    // More steps later are added on top.
    nativeSensor.now = { time: Date.now() + 60 * 60 * 1000, counter: 2700, bootTime };
    await steps.refreshRecentDailySteps(db, { now: Date.now() + 60 * 60 * 1000 });
    assert.ok(
      Math.abs(kept(db).filter((entry) => entry.source === "sensor").reduce((sum, entry) => sum + entry.steps, 0) - 1700) <= 3,
      "200 more steps"
    );
    nativeSensor.now = null;

    // A health app that has a number for the day wins - the sensor's is never added to it.
    hc.respond = () => [{ startTime: day(-1) + "T00:00", result: { COUNT_TOTAL: 9000 } }];
    await steps.refreshRecentDailySteps(db);
    assert.deepStrictEqual(
      kept(db).filter((entry) => entry.day === day(-1)).map((entry) => [entry.steps, entry.source]),
      [[9000, "health"]],
      "the better source's number, not the two added"
    );
    hc.respond = null;

    // And if the health app goes quiet again, the day keeps its number.
    await steps.refreshRecentDailySteps(db);
    assert.strictEqual(kept(db).find((entry) => entry.day === day(-1)).source, "health");

    // The sensor's own working is kept apart, and stays on the phone.
    assert.ok(db.sqlite.prepare("SELECT COUNT(*) AS n FROM Sensor_Steps").get().n >= 1);
  }
  {
    // The yes, asked once: on Android the sensor's permission is asked for when no
    // health app has anything - not before, and not again when it has been given.
    const db = createDatabase();

    nativeSensor.present = true;
    nativeSensor.permission = false;
    nativeSensor.recording = false;
    nativeSensor.store = [];
    nativeSensor.now = { time: Date.now(), counter: 100, bootTime: Date.now() - 1000000 };

    assert.strictEqual(await stepsService.getStepsAccess(db), "undetermined", "the sensor is always a way in, so the first answer is a question");
    assert.strictEqual(await stepsService.requestStepsAccess(db), "granted", "asked, and the sensor's permission given");
    assert.strictEqual(nativeSensor.permission, true);
    assert.strictEqual(nativeSensor.recording, true, "and counting has started");
    assert.strictEqual(await stepsRepository.getStepsEnabled(db), true);

    // The walks and workouts are not what this is about: no such tables, no such rows.
    const realGetAll = db.getAllAsync.bind(db);

    db.getAllAsync = async (sql, params) => {
      return /(Run|Workout)/.test(sql) && !/Daily_Steps|Sensor_Steps|App_Metadata/.test(sql) ? [] : realGetAll(sql, params);
    };

    const { hasPhoneSource, days } = await stepsService.loadStepDays(db, { fromIso: day(-1), toIso: day(0) });

    assert.strictEqual(hasPhoneSource, true, "counting, though it has not counted a step yet");
    assert.strictEqual(days[days.length - 1].walked, 0, "today is a morning with no steps yet, not a refusal");

    nativeSensor.permission = false;
    assert.strictEqual(await stepsService.getStepsAccess(db), "granted", "a health app that answers keeps it granted (Health Connect is granted here)");
    nativeSensor.present = false;
    platform.OS = "ios";
  }

  /* ---------------------------------------------------------- the migration -- */

  {
    const fs = require("fs");
    const path = require("path");
    const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261011090000_daily-steps.sql"), "utf8");

    assert.ok(/primary key \(user_id, day\)/.test(sql), "one row for each person and day");
    assert.ok(/references public\.profiles\(id\) on delete cascade/.test(sql), "deleted with the account");
    assert.ok(/enable row level security/.test(sql));
    assert.ok(/check \(source in \('health', 'motion', 'sensor'\)\)/.test(sql), "the sources the app knows");
    assert.ok(/steps >= 0 and steps <= 200000/.test(sql), "the same limit as the app");
    assert.ok(!/to anon/.test(sql) && /revoke all on public\.daily_steps from anon, authenticated/.test(sql), "nothing for anon");
    assert.ok(!/user_follows/.test(sql), "followers cannot read it");
    assert.strictEqual((sql.match(/privacy_policy_version is not null/g) ?? []).length, 2, "a write needs the policy accepted, for insert and for update");
    assert.ok(sql.includes(sql.match(/20261010090000_more-catalog-exercises\.sql/)?.[0] ?? "?"), "it says what it runs after");
  }
}

main()
  .then(() => {
    console.log("Daily steps: the rules (best source wins, a worse never replaces it), reading sources into the table, the iPhone's motion history, meeting the cloud, and the migration.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
