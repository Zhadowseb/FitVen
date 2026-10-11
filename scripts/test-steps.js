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

const storage = new Map();
const hc = {
  status: 3,
  granted: [],
  groups: null,
  requested: [],
  calls: [],
};

loadAppModule.stubModule("react-native", {
  Platform: { OS: "android" },
  Linking: { openURL: async () => {} },
});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => storage.set(key, String(value)),
    removeItem: async (key) => storage.delete(key),
  },
});
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
  aggregateGroupByPeriod: async (request) => {
    hc.calls.push(request);

    return hc.groups;
  },
});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const stepsService = loadAppModule("src/Services/stepsService.js");

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) => (value === undefined ? null : value));

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);

  return {
    sqlite,
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

  // Two days, one stored the old way ("DD.MM.YYYY").
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Monday', '2026-10-05')");
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (2, 'Wednesday', '07.10.2026')");
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (3, 'Thursday', '2026-10-08')");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (1, 1, '2026-10-05', 'Resistance', 'Push A', 1, 2700)");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (2, 2, '07.10.2026', 'Legs', 'Legs', 1, 3000)");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (3, 2, '07.10.2026', 'Resistance', 'Unfinished', 0, 3000)");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (4, 3, '2026-10-08', 'Resistance', 'No clock', 1, NULL)");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (5, 3, '2026-10-08', 'Walk', NULL, 1, 1800)");
  run("INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_duration_seconds, actual_steps, done) VALUES (5, 'WORKING_SET', 1, 0, 2.5, 1800, 3000, 1)");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, workout_type, label, done, elapsed_time) VALUES (6, 3, '2026-10-08', 'Walk', NULL, 0, 0)");
  run("INSERT INTO Run (workout_id, type, set_number, is_pause, actual_distance, actual_duration_seconds, actual_steps, done) VALUES (6, 'WORKING_SET', 1, 0, 9, 9, 9999, 0)");

  /* ---------------------------------------------------------- access -- */

  assert.strictEqual(await stepsService.getStepsAccess(), "undetermined", "never asked");
  assert.deepStrictEqual(hc.requested, [], "nothing is asked for just by looking");
  assert.strictEqual(await stepsService.requestStepsAccess(), "granted");
  assert.deepStrictEqual(hc.requested, [[{ accessType: "read", recordType: "Steps" }]], "only reading steps is asked for");

  /* ----------------------------------------------------------- days -- */

  hc.groups = [8000, 0, 6000, 7500].map((count) => ({ result: { COUNT_TOTAL: count } }));

  const range = await stepsService.loadStepDays(db, { fromIso: "2026-10-05", toIso: "2026-10-08" });

  assert.strictEqual(range.hasPhoneSource, true);
  assert.strictEqual(hc.calls.length, 1);
  assert.strictEqual(hc.calls[0].recordType, "Steps");
  assert.deepStrictEqual(hc.calls[0].timeRangeSlicer, { period: "DAYS", length: 1 }, "a day at a time, by the phone's own calendar");
  assert.deepStrictEqual(range.days.map((day) => day.walked), [8000, 0, 6000, 7500]);
  assert.deepStrictEqual(range.days.map((day) => day.training), [5175, 0, 5750, 0], "a finished strength workout is added; one that is not finished, or has no clock, is not");
  assert.deepStrictEqual(range.days.map((day) => day.active), [13175, 0, 11750, 7500]);
  assert.strictEqual(range.days[3].walks, 3000, "a finished walk is part of the phone's count");
  assert.strictEqual(range.days[3].everyday, 4500);
  assert.strictEqual(range.days[3].distanceKm, 2.5, "and its distance is the walk's");
  assert.strictEqual(range.days[2].trainingWorkouts[0].label, "Legs", "a day stored as DD.MM.YYYY is found");

  // The same range again is served without asking the phone twice.
  await stepsService.loadStepDays(db, { fromIso: "2026-10-05", toIso: "2026-10-08", countTraining: false });
  assert.strictEqual(hc.calls.length, 1);

  const off = await stepsService.loadStepDays(db, { fromIso: "2026-10-05", toIso: "2026-10-08", countTraining: false });

  assert.deepStrictEqual(off.days.map((day) => day.active), [8000, 0, 6000, 7500], "the switch recomputes the same days without training");

  /* ----------------------------------------------------- settings -- */

  assert.deepStrictEqual(await stepsService.getStepsSettings(), { countTraining: true, targetZoneId: "sweetSpot", targetSteps: 7000 });
  await stepsService.setCountTraining(false);
  await stepsService.setTargetZone("bonus");
  assert.deepStrictEqual(await stepsService.getStepsSettings(), { countTraining: false, targetZoneId: "bonus", targetSteps: 10000 });
  await stepsService.setTargetZone("moving");
  assert.strictEqual((await stepsService.getStepsSettings()).targetZoneId, "sweetSpot", "an unknown target is the default");

  /* ------------------------------------------------ no health app -- */

  hc.status = 1;
  stepsService.clearStepsCache();
  // A fresh health service (re-stubbing clears the module cache) sees the unavailable provider.
  loadAppModule.stubModule("expo-secure-store", {});
  const fresh = loadAppModule("src/Services/stepsService.js");

  assert.strictEqual(await fresh.getStepsAccess(), "unavailable");

  const without = await fresh.loadStepDays(db, { fromIso: "2026-10-05", toIso: "2026-10-08" });

  assert.strictEqual(without.hasPhoneSource, false, "no health app is said, not shown as a quiet week");
  assert.deepStrictEqual(without.days.map((day) => day.walked), [null, null, null, 3000], "only the walk is known");
  assert.deepStrictEqual(without.days.map((day) => day.active), [5175, null, 5750, 3000], "training and walks stand alone, and a day with nothing has no number");
}

main()
  .then(() => {
    console.log("Steps: zone boundaries, training as steps, a day from the phone, the walks and the workouts, period sums and the service against SQLite.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
