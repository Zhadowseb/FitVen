// A set counts as a record for every rep count below it ("rekorder nedad"),
// and is still announced as a new record only at its own.
//
// The owner: 90 kg × 3 is also 90 kg for 1 and for 2, and the Records page's
// "Rekord pr. reps" should say so, for the statistics. But a first set of ten
// is one new record, not ten - nothing that says "new record" may count a
// rep count the set was not.
//
// Run for real: the app's schema in an in-memory SQLite (node:sqlite), sets
// ticked off through weightliftingService.updateStrengthSetDone, and every
// reader of "a new record" asked what it counts - the returned record ids,
// the set-changed event the toast and Home's Quick start listen to, the
// personal_record flags themselves (the crown, calendar, posts and
// friends activity all read those), Home's records today, the trophy room's
// counts per day and its record count, milestones and newest records. Then
// the rep ladder, from the rows the Records page loads, fills downward -
// without warm-ups, drop sets or failed sets, and per side in per-side mode.
const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from() {
    throw new Error("signed out: the records reached for the cloud");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
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

// The background uploads and the offline muscle grouping say so on the
// console; what they say is not what is tested here.
const quiet = (original, pattern) => (...args) => {
  if (typeof args[0] === "string" && pattern.test(args[0])) {
    return;
  }

  original(...args);
};
console.error = quiet(console.error, /cloud push failed|sync/i);
console.warn = quiet(console.warn, /muscle grouping unavailable|sync/i);

const service = loadAppModule("src/Services/weightliftingService.js");
const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const trainRepository = loadAppModule("src/Repository/trainRepository.js");
const insights = loadAppModule("src/Utils/recordsInsights.js");
const trophy = loadAppModule("src/Utils/trophyRoom.js");
const events = loadAppModule("src/Utils/workoutSetEvents.js");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

const raw = new DatabaseSync(":memory:");
raw.exec(programSchemaSql);
raw.exec(weightliftingSchemaSql);

const bind = (params) =>
  (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
    value === undefined ? null : typeof value === "boolean" ? Number(value) : value
  );
const db = {
  databasePath: "test-rep-records-downward",
  execAsync: async (sql) => raw.exec(sql),
  runAsync: async (sql, params) => {
    const result = raw.prepare(sql).run(...bind(params));

    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
  },
  getAllAsync: async (sql, params) => raw.prepare(sql).all(...bind(params)),
  getFirstAsync: async (sql, params) => raw.prepare(sql).get(...bind(params)) ?? null,
  isInTransactionAsync: async () => Boolean(raw.isTransaction),
};
const run = (sql, ...params) => raw.prepare(sql).run(...bind(params));

const pad = (value) => String(value).padStart(2, "0");
const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const daysAgo = (count) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - count);
  return isoDay(date);
};
const TODAY = daysAgo(0);

run("INSERT INTO Program (program_id, program_name, start_date) VALUES (1, 'Plan', ?)", daysAgo(30));
run("INSERT INTO Mesocycle (mesocycle_id, program_id, mesocycle_number) VALUES (1, 1, 1)");
run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (1, 1, 1)");
run("INSERT INTO Exercise (name, weight_mode) VALUES ('Bench Press', 'total')");
run("INSERT INTO Exercise (name, weight_mode) VALUES ('Dumbbell Press', 'per_side')");

let nextWorkout = 1;
let nextSet = 1;

/** A workout on a day with one exercise and its sets, none of them ticked yet. */
function workout(date, exercise, sets, { weightMode = null } = {}) {
  const id = nextWorkout++;

  run("INSERT INTO Day (day_id, microcycle_id, program_id, Weekday, date) VALUES (?, 1, 1, 'Monday', ?)", id, date);
  run(
    "INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date) VALUES (?, ?, 'Resistance', 'Push', ?)",
    id,
    id,
    date
  );
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, weight_mode)
     VALUES (?, ?, ?, 1, ?)`,
    id,
    id,
    exercise,
    weightMode
  );

  const ids = sets.map((set, index) => {
    const setId = nextSet++;

    run(
      `INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, done, set_type, amrap)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      setId,
      id,
      index + 1,
      set.weight,
      set.reps,
      set.type ?? "working",
      set.type === "amrap" ? 1 : 0
    );

    return setId;
  });

  return { workoutId: id, setIds: ids };
}

const changes = [];
events.subscribeWorkoutSetChanges((change) => {
  if (change) {
    changes.push(change);
  }
});

async function tick(workoutId, setId, { failed = 0 } = {}) {
  const result = await service.updateStrengthSetDone(db, { workoutId, setId, done: 1, failed });
  const change = changes[changes.length - 1];

  assert.strictEqual(change.setId, setId, "the set-changed event is about the set that was ticked");
  return { ids: [...result.personalRecordSetIds].map(Number).sort((a, b) => a - b), announced: change.personalRecord };
}

const flagged = () =>
  raw
    .prepare('SELECT sets_id FROM "Set" WHERE personal_record = 1 ORDER BY sets_id')
    .all()
    .map((row) => Number(row.sets_id));

async function recordRows() {
  const { rows } = await service.getRecordsSourceData(db);
  return insights.normalizeRecordRows(rows);
}

async function main() {
  // 1. The owner's bench: 90 × 3, the first bench ever. One new record, at
  //    three reps - not at one and two as well.
  const first = workout(daysAgo(20), "Bench Press", [{ weight: 90, reps: 3 }]);
  const [ninetyThree] = first.setIds;
  let result = await tick(first.workoutId, ninetyThree);

  assert.deepStrictEqual(result.ids, [ninetyThree], "90 × 3 is the one record");
  assert.strictEqual(result.announced, true, "and it is announced");
  assert.deepStrictEqual(flagged(), [ninetyThree], "no set but 90 × 3 carries the flag");

  // 2. Today, the first set of ten: 60 × 10. One new record, not ten. And
  //    a warm-up, a drop set and a failed set that would each be heavier than
  //    anything at their rep count: none of them is a record, anywhere.
  const today = workout(TODAY, "Bench Press", [
    { weight: 100, reps: 1, type: "warmup" },
    { weight: 60, reps: 10 },
    { weight: 110, reps: 2, type: "drop" },
    { weight: 120, reps: 1 },
    { weight: 70, reps: 6, type: "amrap" },
  ]);
  const [warmUp, sixtyTen, dropSet, failedSingle, amrapSix] = today.setIds;

  result = await tick(today.workoutId, warmUp);
  assert.strictEqual(result.announced, false, "a warm-up is never a record");
  result = await tick(today.workoutId, sixtyTen);
  assert.strictEqual(result.announced, true, "the first ten is a record");
  assert.deepStrictEqual(result.ids, [ninetyThree, sixtyTen], "and the only new one: 60 × 10 fills nothing below it with records");
  result = await tick(today.workoutId, dropSet);
  assert.strictEqual(result.announced, false, "a drop set is never a record");
  result = await tick(today.workoutId, failedSingle, { failed: 1 });
  assert.strictEqual(result.announced, false, "a failed set is never a record");
  result = await tick(today.workoutId, amrapSix);
  assert.strictEqual(result.announced, true, "70 × 6 AMRAP is the first six, a record at six");
  assert.deepStrictEqual(flagged(), [ninetyThree, sixtyTen, amrapSix], "three flags: one per set that was a record at its own reps");

  // Every place that counts new records counts two today, not the 1 to 10
  // and 1 to 6 the two sets fill below them.
  assert.strictEqual(await service.getPersonalRecordsToday(db), 2, "Home's records today: two");
  assert.strictEqual(await repository.countPersonalRecordsOnDate(db, TODAY), 2, "the friends tile's crown: two");
  const perDay = await trainRepository.getPersonalRecordCountsByDay(db);
  assert.deepStrictEqual(
    perDay.map((row) => [row.performed_date_sort, Number(row.record_count)]),
    [[daysAgo(20), 1], [TODAY, 2]],
    "the trophy room's records per day: one, then two"
  );

  let sets = await recordRows();
  const room = trophy.buildTrophyRoom({ sets, now: Date.parse(`${TODAY}T00:00:00Z`) });
  assert.strictEqual(sets.filter((set) => set.isRecord).length, 3, "three records in all");
  assert.strictEqual(room.hero.recordCount, 3, "the trophy room's record count: three");
  assert.strictEqual(room.milestones.find((entry) => entry.key === "records").value, 3, "the records milestone counts three");
  assert.deepStrictEqual(
    room.recent.map((entry) => [entry.weight, entry.reps]),
    [[70, 6], [90, 3]],
    "the newest records are the sets as they were done, one card a day"
  );
  assert.strictEqual(
    insights.buildLatestRecords(sets).length,
    3,
    "Records' latest records: the three sets, nothing derived"
  );

  // The ladder does fill downward, for the statistics - and marks only the
  // sets' own rep counts as new.
  let ladder = insights.buildRepLadder(sets, { name: "Bench Press", now: Date.now(), days: 30 });
  assert.deepStrictEqual(
    ladder.map((slot) => slot.weight),
    [90, 90, 90, 70, 70, 70, 60, 60, 60, 60, null, null],
    "90 × 3 fills 1 to 3, 70 × 6 fills 4 to 6, 60 × 10 fills 7 to 10; the warm-up, drop set and failed set nowhere"
  );
  assert.deepStrictEqual(
    ladder.filter((slot) => slot.isNewInPeriod).map((slot) => slot.reps),
    [3, 6, 10],
    "gold only where a set was a record at its own reps"
  );
  assert.deepStrictEqual(
    ladder.filter((slot) => slot.isDerived).map((slot) => [slot.reps, slot.fromReps]),
    [[1, 3], [2, 3], [4, 6], [5, 6], [7, 10], [8, 10], [9, 10]],
    "every other slot says which set it came from"
  );

  // 3. A true single at 85 afterwards. It is the first single, so it is a
  //    record at one rep, as it always was - the flag is worked out per exact
  //    rep count and the ladder does not change that. The ladder keeps 90 at
  //    one: 90 × 3 is heavier.
  const later = workout(TODAY, "Bench Press", [{ weight: 85, reps: 1 }]);
  const [eightyFiveSingle] = later.setIds;
  result = await tick(later.workoutId, eightyFiveSingle);
  assert.strictEqual(result.announced, true, "the first single is a record at one rep, as before");
  sets = await recordRows();
  ladder = insights.buildRepLadder(sets, { name: "Bench Press", now: Date.now(), days: 30 });
  assert.deepStrictEqual([ladder[0].weight, ladder[0].fromReps, ladder[0].isNewInPeriod], [90, 3, false], "the 1 stays 90, from 90 × 3");

  //    A heavier single takes the one back, at its own rep count.
  const heavier = workout(TODAY, "Bench Press", [{ weight: 95, reps: 1 }]);
  result = await tick(heavier.workoutId, heavier.setIds[0]);
  assert.strictEqual(result.announced, true);
  sets = await recordRows();
  ladder = insights.buildRepLadder(sets, { name: "Bench Press", now: Date.now(), days: 30 });
  assert.deepStrictEqual([ladder[0].weight, ladder[0].fromReps, ladder[0].isNewInPeriod], [95, 1, true], "the 95 single holds the 1");
  assert.deepStrictEqual([ladder[1].weight, ladder[1].fromReps], [90, 3], "the 2 still from 90 × 3");

  // 4. Per side. The ladder is in the exercise's current mode: 30 kg a side
  //    × 5, and an older 50 kg in all × 8 is 25 a side. 30 fills 1 to 5, 25
  //    fills 6 to 8.
  const older = workout(daysAgo(10), "Dumbbell Press", [{ weight: 50, reps: 8 }], { weightMode: "total" });
  await tick(older.workoutId, older.setIds[0]);
  const perSide = workout(daysAgo(3), "Dumbbell Press", [{ weight: 30, reps: 5 }], { weightMode: "per_side" });
  result = await tick(perSide.workoutId, perSide.setIds[0]);
  assert.strictEqual(result.announced, true, "the first five is a record");
  sets = await recordRows();
  ladder = insights.buildRepLadder(sets, { name: "Dumbbell Press", now: Date.now(), days: 30 });
  assert.ok(
    sets.filter((set) => set.name === "Dumbbell Press").every((set) => set.weightMode === "per_side"),
    "the rows arrive per side"
  );
  assert.deepStrictEqual(
    ladder.map((slot) => slot.weight),
    [30, 30, 30, 30, 30, 25, 25, 25, null, null, null, null],
    "per side, converted like with like"
  );
  assert.deepStrictEqual(
    ladder.filter((slot) => slot.isNewInPeriod).map((slot) => slot.reps),
    [5, 8],
    "new only at 5 and 8"
  );

  console.log(
    "Rep records downward: a set fills every rep count below it on the Records page, and is announced, flagged, counted today, per day and in the trophy room only at its own; warm-ups, drop sets and failed sets count nowhere; per side stays per side."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
