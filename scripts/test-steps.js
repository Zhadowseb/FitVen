// A day's steps: the zones, training as steps, putting a day together from the
// phone's count, the walks and the workouts, and the sums of a period - and the
// service that reads them, against a real SQLite database with a fake Health
// Connect.
const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const zones = loadAppModule("src/Utils/stepZones.js");
const steps = loadAppModule("src/Utils/dailySteps.js");
const { Colors } = loadAppModule("src/Resources/GlobalStyling/colors.js");

/* ----------------------------------------------------------------- zones -- */

for (const [value, id] of [
  [0, "inactive"],
  [1999, "inactive"],
  [2000, "moving"],
  [3999, "moving"],
  [4000, "active"],
  [6999, "active"],
  [7000, "sweetSpot"],
  [9999, "sweetSpot"],
  [10000, "bonus"],
  [25000, "bonus"],
]) {
  assert.strictEqual(zones.getStepZone(value).id, id, `${value} steps is ${id}`);
}
assert.strictEqual(zones.getStepZone(-5).id, "inactive", "a negative number is the lowest zone");
assert.strictEqual(zones.getStepZone(NaN).id, "inactive");
assert.strictEqual(zones.getStepZone(7500).color, "#4ED39A", "the colour comes from the theme's zone colours");
assert.strictEqual(zones.getStepZone(7500, Colors.light).color, Colors.light.stepZones.sweetSpot, "and follows the theme it is asked for");
assert.deepStrictEqual(
  zones.STEP_ZONES.map((zone) => zone.labelKey),
  ["steps.zones.inactive", "steps.zones.moving", "steps.zones.active", "steps.zones.sweetSpot", "steps.zones.bonus"],
  '"Inactive" is the name - not "Resting"'
);
for (const scheme of ["dark", "light"]) {
  assert.deepStrictEqual(Object.keys(Colors[scheme].stepZones), zones.STEP_ZONES.map((zone) => zone.id), `${scheme} has a colour for every zone`);
}

// The target: three upper zones, sweet spot by default.
assert.deepStrictEqual(zones.TARGET_ZONE_IDS, ["active", "sweetSpot", "bonus"]);
assert.strictEqual(zones.getTargetSteps("sweetSpot"), 7000);
assert.strictEqual(zones.getTargetSteps("active"), 4000);
assert.strictEqual(zones.getTargetSteps("bonus"), 10000);
assert.strictEqual(zones.getTargetSteps("moving"), 7000, "a zone that is not a target falls back to the default");
assert.strictEqual(zones.normalizeTargetZoneId("nonsense"), "sweetSpot");

// Training as steps: 115 a minute, to the nearest 25.
assert.strictEqual(zones.TRAINING_STEPS_PER_MINUTE, 115);
assert.strictEqual(zones.trainingStepsForSeconds(30 * 60), 3450);
assert.strictEqual(zones.trainingStepsForSeconds(45 * 60), 5175);
assert.strictEqual(zones.trainingStepsForSeconds(50 * 60), 5750);
assert.strictEqual(zones.trainingStepsForSeconds(40 * 60), 4600);
assert.strictEqual(zones.trainingStepsForSeconds(0), 0, "a workout with no time counts as nothing");
assert.strictEqual(zones.trainingStepsForSeconds(null), 0);
assert.strictEqual(zones.trainingStepsForSeconds(undefined), 0);
assert.strictEqual(zones.trainingStepsForSeconds(-60), 0);
assert.strictEqual(zones.trainingStepsForSeconds(1), 0, "a second is under half of 25");

// The bar on Home.
{
  const segments = zones.getZoneBarSegments(6482, 9932);

  assert.deepStrictEqual(
    segments.map((segment) => Math.round(segment.widthShare * 10000) / 100),
    [16.67, 16.67, 25, 25, 16.67],
    "segment widths follow the zone ranges on a 0-12,000 scale"
  );
  assert.deepStrictEqual(segments.map((segment) => segment.fill), [1, 1, 1, (9932 - 7000) / 3000, 0], "each segment fills up to the active steps");
  assert.ok(Math.abs(segments[2].trainingFrom - (6482 - 4000) / 3000) < 1e-9, "training starts where the walked steps ended, inside the active segment...");
  assert.strictEqual(segments[2].trainingTo, 1, "...and runs to its end");
  assert.strictEqual(segments[0].trainingFrom, 1, "a segment filled by walking has no training in it");
  assert.strictEqual(segments[0].trainingTo, 1);
  assert.strictEqual(segments[3].trainingFrom, 0, "the sweet spot is where the training starts");
  assert.ok(Math.abs(segments[3].trainingTo - 0.9773) < 0.001);
  assert.deepStrictEqual(zones.getZoneBarSegments(0, 0).map((segment) => segment.fill), [0, 0, 0, 0, 0]);
  assert.strictEqual(zones.getZoneBarSegments(30000, 30000)[4].fill, 1, "the last segment is cut off at 12,000");
  assert.deepStrictEqual(zones.STEP_BAR_TICKS.map((tick) => tick.label), ["2k", "4k", "7k", "10k"], "no zone names under the bar, only the ticks");
}

/* ------------------------------------------------------------------ dates -- */

assert.strictEqual(steps.addDays("2026-10-31", 1), "2026-11-01");
assert.strictEqual(steps.addDays("2026-03-01", -1), "2026-02-28");
assert.strictEqual(steps.startOfWeek("2026-10-11"), "2026-10-05", "Sunday belongs to the week that began on Monday");
assert.strictEqual(steps.startOfWeek("2026-10-05"), "2026-10-05");
assert.strictEqual(steps.startOfWeek("2026-10-07"), "2026-10-05");
assert.deepStrictEqual(steps.datesBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
assert.deepStrictEqual(steps.monthRange("2026-02-14"), { from: "2026-02-01", to: "2026-02-28" });
assert.strictEqual(steps.localIsoDate(new Date(2026, 9, 5, 23, 59)), "2026-10-05", "a date is the phone's own day");

/* -------------------------------------------------------------------- day -- */

{
  // The phone says 6,482; a 45-minute workout adds 5,175 on top, in its own number.
  const day = steps.buildDay({
    date: "2026-10-10",
    phoneSteps: 6482,
    walkSteps: 2000,
    walkDistanceKm: 1.6,
    workouts: [{ id: 1, label: "Push A", seconds: 45 * 60 }],
  });

  assert.strictEqual(day.walked, 6482, "the walked steps are the phone's count");
  assert.strictEqual(day.walks, 2000, "the walk's steps are part of it, not added to it");
  assert.strictEqual(day.everyday, 4482, "and the rest of the day is Everyday");
  assert.strictEqual(day.training, 5175);
  assert.strictEqual(day.active, 11657, "active = walked + training");
  assert.strictEqual(day.zone.id, "bonus");
  assert.strictEqual(day.distanceKm, 1.6);
  assert.strictEqual(day.trainingWorkouts[0].steps, 5175);

  // "Count training as steps" off: walked steps only, and no orange.
  const off = steps.buildDay(
    { date: "2026-10-10", phoneSteps: 6482, walkSteps: 2000, workouts: [{ id: 1, seconds: 45 * 60 }] },
    { countTraining: false }
  );

  assert.strictEqual(off.training, 0);
  assert.strictEqual(off.active, 6482);
  assert.deepStrictEqual(off.trainingWorkouts, [], "the list of workouts is hidden too");
  assert.strictEqual(off.zone.id, "active");
}
{
  // A day with only training and no steps.
  const day = steps.buildDay({ date: "2026-10-10", phoneSteps: 0, walkSteps: 0, workouts: [{ id: 2, seconds: 30 * 60 }] });

  assert.strictEqual(day.walked, 0);
  assert.strictEqual(day.active, 3450);
  assert.strictEqual(day.zone.id, "moving");

  // No phone source at all, and a training only day: the training stands alone, walked stays unknown.
  const noPhone = steps.buildDay({ date: "2026-10-10", phoneSteps: null, walkSteps: 0, workouts: [{ id: 2, seconds: 30 * 60 }] });

  assert.strictEqual(noPhone.walked, null, "no source is not zero");
  assert.strictEqual(noPhone.active, 3450);
}
{
  // A workout without elapsed_time adds nothing, and does not break the day.
  const day = steps.buildDay({ date: "2026-10-10", phoneSteps: 3000, walkSteps: 0, workouts: [{ id: 3, seconds: 0 }, { id: 4, seconds: null }] });

  assert.strictEqual(day.training, 0);
  assert.strictEqual(day.active, 3000);
}
{
  // No phone, but a walk: the walk is all there is. No phone and nothing else: no number.
  const walkOnly = steps.buildDay({ date: "2026-10-10", phoneSteps: null, walkSteps: 4200, workouts: [] });

  assert.strictEqual(walkOnly.source, "walks");
  assert.strictEqual(walkOnly.walked, 4200);
  assert.strictEqual(walkOnly.walks, 4200);
  assert.strictEqual(walkOnly.everyday, 0);

  const nothing = steps.buildDay({ date: "2026-10-10", phoneSteps: null, walkSteps: 0, workouts: [] });

  assert.strictEqual(nothing.active, null, "a day with nothing is not a day of zero steps");
  assert.strictEqual(nothing.zone, null);

  // The walk's own counter ahead of the health app: never a negative Everyday.
  const ahead = steps.buildDay({ date: "2026-10-10", phoneSteps: 1500, walkSteps: 1800, workouts: [] });

  assert.strictEqual(ahead.walked, 1800);
  assert.strictEqual(ahead.everyday, 0);
}

/* ----------------------------------------------------------------- period -- */

{
  const week = [
    { date: "2026-10-05", phoneSteps: 8000, walkSteps: 3000, walkDistanceKm: 2.4, workouts: [{ id: 1, seconds: 45 * 60, label: "Push A" }] },
    { date: "2026-10-06", phoneSteps: 6000, walkSteps: 0, workouts: [] },
    { date: "2026-10-07", phoneSteps: 12000, walkSteps: 5000, walkDistanceKm: 4, workouts: [{ id: 2, seconds: 50 * 60, label: "Legs" }] },
    { date: "2026-10-08", phoneSteps: null, walkSteps: 0, workouts: [] },
  ].map((row) => steps.buildDay(row));
  const summary = steps.summarisePeriod(week);

  assert.strictEqual(summary.days, 3, "a day with no data is not counted");
  assert.strictEqual(summary.total, 8000 + 5175 + 6000 + 12000 + 5750);
  assert.strictEqual(summary.walkedTotal, 26000);
  assert.strictEqual(summary.trainingTotal, 10925);
  assert.strictEqual(summary.average, Math.round(36925 / 3), "the average is over the days that have a number");
  assert.strictEqual(summary.sweetSpotDays, 2, "7,000 or more");
  assert.strictEqual(summary.best.date, "2026-10-07");
  assert.strictEqual(summary.best.active, 17750);
  assert.strictEqual(summary.distanceKm, 6.4);
  assert.strictEqual(summary.walksTotal, 8000);
  assert.strictEqual(summary.everydayTotal, 18000);
  assert.deepStrictEqual(
    summary.shares,
    { walks: Math.round((8000 / 36925) * 100), everyday: Math.round((18000 / 36925) * 100), training: Math.round((10925 / 36925) * 100) }
  );
  assert.strictEqual(summary.zone.id, "bonus");
  assert.deepStrictEqual(
    steps.listTrainingWorkouts(week).map((workout) => [workout.date, workout.label, workout.steps]),
    [["2026-10-05", "Push A", 5175], ["2026-10-07", "Legs", 5750]]
  );

  const empty = steps.summarisePeriod([]);

  assert.strictEqual(empty.average, null, "no days, no average - nothing is invented");
  assert.strictEqual(empty.best, null);
  assert.strictEqual(empty.shares, null);
  assert.strictEqual(empty.distanceKm, null, "no walks, no distance");

  // Months are drawn per week.
  const weeks = steps.groupByWeek([
    ...week,
    steps.buildDay({ date: "2026-10-12", phoneSteps: 4000, walkSteps: 0, workouts: [] }),
  ]);

  assert.deepStrictEqual(weeks.map((entry) => entry.start), ["2026-10-05", "2026-10-12"]);
  assert.strictEqual(weeks[1].average, 4000);
}

assert.strictEqual(steps.changePercent(9000, 8500), 6);
assert.strictEqual(steps.changePercent(8000, 9000), -11);
assert.strictEqual(steps.changePercent(8000, 0), null, "no change to a week with nothing");
assert.strictEqual(steps.changePercent(null, 8000), null);

/* --------------------------------------------------------------- service -- */

// The service reads the phone's sources into Daily_Steps and the screens read
// the table, so every date here is counted from today: the refresh looks back
// from the clock, and a test with fixed dates would stop passing in three months.
const dailyLog = loadAppModule("src/Utils/dailySteps.js");
const TODAY = dailyLog.localIsoDate();
const D = [-4, -3, -2, -1].map((offset) => dailyLog.addDays(TODAY, offset)); // four days, oldest first
const [FROM, TO] = [D[0], D[3]];
const oldStyle = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

const storage = new Map();
const hc = {
  status: 3,
  granted: [],
  byDate: {},
  omit: new Set(),
  requested: [],
  calls: [],
};

const platform = { OS: "android" };

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
// stepsService reads the daily table, whose service reaches for the cloud client.
loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from() {
      throw new Error("the steps reached for the cloud");
    },
  }),
  processLock: () => {},
});
loadAppModule.stubModule("expo-sensors", {});
// No step sensor in this world: the iPhone and old builds have none.
loadAppModule.stubModule("expo", { requireOptionalNativeModule: () => null });
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});
loadAppModule.stubModule("react-native-health-connect", {
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_AVAILABLE: 3 },
  getSdkStatus: async () => hc.status,
  initialize: async () => true,
  getGrantedPermissions: async () => hc.granted,
  requestPermission: async (permissions) => {
    hc.requested.push(permissions);
    hc.granted = permissions;

    return permissions;
  },
  openHealthConnectSettings() {},
  // One group for each day of the range, the way the phone answers - minus the
  // days a test leaves out - each told by its own start.
  aggregateGroupByPeriod: async (request) => {
    hc.calls.push(request);

    const groups = [];
    const start = new Date(request.timeRangeFilter.startTime);
    const end = new Date(request.timeRangeFilter.endTime);

    for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

      if (!hc.omit.has(iso)) {
        groups.push({ startTime: `${iso}T00:00`, result: { COUNT_TOTAL: hc.byDate[iso] ?? 0 } });
      }
    }

    return groups;
  },
});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { stepsSchemaSql } = loadAppModule("src/Database/schema/steps.js");
const stepsService = loadAppModule("src/Services/stepsService.js");

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) => (value === undefined ? null : value));

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);
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
      return sqlite.prepare(sql).all(...bind(params)).map((row) => ({ ...row }));
    },
    async getFirstAsync(sql, params) {
      const row = sqlite.prepare(sql).get(...bind(params));

      return row ? { ...row } : null;
    },
  };
}

async function main() {
  const db = createDatabase();
  const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);

  // Four days, one stored the old way ("DD.MM.YYYY").
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Monday', ?)", D[0]);
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (2, 'Wednesday', ?)", oldStyle(D[2]));
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (3, 'Thursday', ?)", D[3]);
  const workout = (id, dayId, date, type, label, done, seconds) =>
    run(
      "INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, dayId, date, type, label, done, seconds
    );

  workout(1, 1, D[0], "Resistance", "Push A", 1, 2700);
  workout(2, 2, oldStyle(D[2]), "Legs", "Legs", 1, 3000);
  workout(3, 2, oldStyle(D[2]), "Resistance", "Unfinished", 0, 3000);
  workout(4, 3, D[3], "Resistance", "No clock", 1, null);
  workout(5, 3, D[3], "Walk", null, 1, 1800);
  run("INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_duration_seconds, actual_steps, done) VALUES (5, 'WORKING_SET', 1, 0, 2.5, 1800, 3000, 1)");
  workout(6, 3, D[3], "Walk", null, 0, 0);
  run("INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_duration_seconds, actual_steps, done) VALUES (6, 'WORKING_SET', 1, 0, 9, 9, 9999, 0)");

  /* ---------------------------------------------------------- access -- */

  assert.strictEqual(await stepsService.getStepsAccess(), "undetermined", "never asked");
  assert.deepStrictEqual(hc.requested, [], "nothing is asked for just by looking");

  const before = await stepsService.loadStepDays(db, { fromIso: FROM, toIso: TO });

  assert.strictEqual(before.hasPhoneSource, false, "nothing is read before it has been asked");
  assert.strictEqual(hc.calls.length, 0, "and the health app is not touched");

  hc.byDate = { [D[0]]: 8000, [D[1]]: 0, [D[2]]: 6000, [D[3]]: 7500 };
  stepsService.clearStepsCache();
  assert.strictEqual(await stepsService.requestStepsAccess(db), "granted");
  assert.deepStrictEqual(hc.requested, [[{ accessType: "read", recordType: "Steps" }]], "only reading steps is asked for");

  /* ----------------------------------------------------------- days -- */

  const range = await stepsService.loadStepDays(db, { fromIso: FROM, toIso: TO });

  assert.strictEqual(range.hasPhoneSource, true);
  assert.ok(hc.calls.length >= 1, "the sources were read");
  assert.strictEqual(hc.calls[0].recordType, "Steps");
  assert.deepStrictEqual(hc.calls[0].timeRangeSlicer, { period: "DAYS", length: 1 }, "a day at a time, by the phone's own calendar");
  assert.deepStrictEqual(range.days.map((day) => day.walked), [8000, null, 6000, 7500], "a day the phone has no steps for is not a day of zero");
  assert.deepStrictEqual(range.days.map((day) => day.training), [5175, 0, 5750, 0], "a finished strength workout is added; one that is not finished, or has no clock, is not");
  assert.deepStrictEqual(range.days.map((day) => day.active), [13175, null, 11750, 7500]);
  assert.strictEqual(range.days[3].walks, 3000, "a finished walk is part of the phone's count");
  assert.strictEqual(range.days[3].everyday, 4500);
  assert.strictEqual(range.days[3].distanceKm, 2.5, "and its distance is the walk's");
  assert.strictEqual(range.days[2].trainingWorkouts[0].label, "Legs", "a day stored as DD.MM.YYYY is found");

  const kept = db.sqlite.prepare("SELECT day, steps, source, needs_sync FROM Daily_Steps ORDER BY day").all();

  assert.deepStrictEqual(
    kept.map((row) => [row.day, row.steps, row.source, row.needs_sync]),
    [[D[0], 8000, "health", 1], [D[2], 6000, "health", 1], [D[3], 7500, "health", 1]],
    "the days are kept as rows with their source, waiting for the cloud - and a day of 0 is not kept"
  );

  // The same range again is served without asking the phone twice.
  const calls = hc.calls.length;

  await stepsService.loadStepDays(db, { fromIso: FROM, toIso: TO, countTraining: false });
  assert.strictEqual(hc.calls.length, calls);

  const off = await stepsService.loadStepDays(db, { fromIso: FROM, toIso: TO, countTraining: false });

  assert.deepStrictEqual(off.days.map((day) => day.active), [8000, null, 6000, 7500], "the switch recomputes the same days without training");

  // The days stay when the health app goes away: the table is what the screens read.
  hc.status = 1;
  stepsService.clearStepsCache();

  const gone = await stepsService.loadStepDays(db, { fromIso: FROM, toIso: TO, countTraining: false });

  assert.deepStrictEqual(gone.days.map((day) => day.walked), [8000, null, 6000, 7500], "a day that was seen is kept");
  hc.status = 3;

  /* ----------------------------------------------------- settings -- */

  assert.deepStrictEqual(await stepsService.getStepsSettings(), { countTraining: true, targetZoneId: "sweetSpot", targetSteps: 7000 });
  await stepsService.setCountTraining(false);
  await stepsService.setTargetZone("bonus");
  assert.deepStrictEqual(await stepsService.getStepsSettings(), { countTraining: false, targetZoneId: "bonus", targetSteps: 10000 });
  await stepsService.setTargetZone("moving");
  assert.strictEqual((await stepsService.getStepsSettings()).targetZoneId, "sweetSpot", "an unknown target is the default");

  /* ---------------------------- Health Connect leaves a day out -- */

  const gapDb = createDatabase();

  hc.byDate = { [D[0]]: 100, [D[2]]: 200, [D[3]]: 5000 };
  hc.omit = new Set([D[1]]);
  stepsService.clearStepsCache();
  await stepsService.requestStepsAccess(gapDb);

  const gap = await stepsService.loadStepDays(gapDb, { fromIso: FROM, toIso: TO, countTraining: false });

  assert.deepStrictEqual(
    gap.days.map((day) => day.walked),
    [100, null, 200, 5000],
    "a day Health Connect leaves out is told by its own date: the days after it keep their numbers"
  );
  hc.omit = new Set();

  /* ------------------------------------------------ no health app -- */

  const noHealthDb = createDatabase();

  noHealthDb.sqlite.prepare("INSERT INTO Day (day_id, Weekday, date) VALUES (3, 'Thursday', ?)").run(D[3]);
  noHealthDb.sqlite.prepare("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, done, elapsed_time) VALUES (5, 3, ?, 'Walk', 1, 1800)").run(D[3]);
  noHealthDb.sqlite.prepare("INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_steps, done) VALUES (5, 'WORKING_SET', 1, 0, 2.5, 3000, 1)").run();
  noHealthDb.sqlite.prepare("INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Monday', ?)").run(D[0]);
  noHealthDb.sqlite.prepare("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (1, 1, ?, 'Resistance', 'Push A', 1, 2700)").run(D[0]);

  hc.status = 1;
  stepsService.clearStepsCache();

  // Re-stubbing clears the module cache, so this service sees the provider that is gone.
  loadAppModule.stubModule("expo-secure-store", {});
  const fresh = loadAppModule("src/Services/stepsService.js");

  assert.strictEqual(await fresh.getStepsAccess(), "unavailable");

  const without = await fresh.loadStepDays(noHealthDb, { fromIso: FROM, toIso: TO });

  assert.strictEqual(without.hasPhoneSource, false, "no health app is said, not shown as a quiet week");
  assert.deepStrictEqual(without.days.map((day) => day.walked), [null, null, null, 3000], "only the walk is known");
  assert.deepStrictEqual(without.days.map((day) => day.active), [5175, null, null, 3000], "training and walks stand alone, and a day with nothing has no number");

  /* --------------------------------------------------------- iOS -- */

  const kit = { status: 0, requested: [], reads: [], rows: [] };
  const iosDb = createDatabase();

  platform.OS = "ios";
  loadAppModule.stubModule("@kingstinct/react-native-healthkit", {
    isHealthDataAvailableAsync: async () => true,
    getRequestStatusForAuthorization: async () => kit.status,
    requestAuthorization: async (request) => {
      kit.requested.push(request);
      kit.status = 2;

      return true;
    },
    queryStatisticsCollectionForQuantity: async (...args) => {
      kit.reads.push(args);

      return kit.rows;
    },
  });

  const ios = loadAppModule("src/Services/stepsService.js");

  for (const unaskedStatus of [0, 1]) {
    kit.status = unaskedStatus;
    ios.clearStepsCache();

    assert.strictEqual(await ios.getStepsAccess(), "undetermined", `status ${unaskedStatus} is not a yes`);

    const unasked = await ios.loadStepDays(iosDb, { fromIso: FROM, toIso: TO });

    assert.strictEqual(unasked.hasPhoneSource, false, "nothing is read before the question has been asked");
    assert.strictEqual(kit.reads.length, 0, `HealthKit is not touched with status ${unaskedStatus}`);
  }

  kit.status = 1;
  kit.rows = [
    { startDate: new Date(`${D[0]}T00:00:00`), sumQuantity: { quantity: 8000, unit: "count" } },
    { startDate: new Date(`${D[2]}T00:00:00`), sumQuantity: { quantity: 6000, unit: "count" } },
  ];
  assert.strictEqual(await ios.requestStepsAccess(iosDb), "granted", "asked, so it is read");
  assert.deepStrictEqual(kit.requested, [{ toRead: ["HKQuantityTypeIdentifierStepCount"], toShare: [] }], "only reading steps is asked for");

  const asked = await ios.loadStepDays(iosDb, { fromIso: FROM, toIso: TO, countTraining: false });

  assert.deepStrictEqual(asked.days.map((day) => day.walked), [8000, null, 6000, null], "rows are told apart by their start date");
  assert.ok(kit.reads.length >= 1);
  assert.strictEqual(kit.reads[0][0], "HKQuantityTypeIdentifierStepCount");
  assert.deepStrictEqual(kit.reads[0][1], ["cumulativeSum"]);
  assert.deepStrictEqual(kit.reads[0][3], { day: 1 }, "a day at a time");
  assert.strictEqual(kit.reads[0][4].unit, "count");
  platform.OS = "android";
}

main()
  .then(() => {
    console.log("Steps: zone boundaries, training as steps, a day from the phone, the walks and the workouts, period sums, and the service reading the table.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
