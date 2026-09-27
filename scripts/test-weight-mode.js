// Weight per side or for both sides (4d).
//
// What this pins, in the order it would go wrong: a switch that rounds to
// something other than 0.25 kg, an empty weight that turns into 0, an undo
// that converts back through the rounding instead of restoring what was
// there, a record that moves because somebody switched, and volume that
// counts a dumbbell once.
//
// The rules are pure and tested directly. The queries run against the real
// schema in an in-memory SQLite, the same way scripts/test-exercise-card-data.js
// does, and the switch is played through the same repository calls the
// service makes (the service itself pulls in the whole app to load).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const mode = loadAppModule("src/Utils/weightMode.js");
const custom = loadAppModule("src/Utils/customExercises.js");
const insights = loadAppModule("src/Utils/recordsInsights.js");
const history = loadAppModule("src/Utils/exerciseHistoryTable.js");
const fields = loadAppModule("src/Services/cloudSync/cloudSyncFields.js");
const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const programRepository = loadAppModule("src/Repository/programRepository.js");
const i18n = loadAppModule("src/Localization/i18n.js");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const da = loadAppModule("src/Localization/locales/da/workout.js").default;
const en = loadAppModule("src/Localization/locales/en/workout.js").default;

const { PER_SIDE, TOTAL } = mode;
const steps = loadAppModule("src/Utils/weightStep.js");
const limits = loadAppModule("src/Utils/setValueLimits.js");

/* ------------------------------------------------------------ rounding -- */

assert.strictEqual(mode.toggleWeight(45, TOTAL, PER_SIDE), 22.5);
assert.strictEqual(mode.toggleWeight(22.5, PER_SIDE, TOTAL), 45);
// To the nearest 0.25: 45.3 / 2 = 22.65, 22.3 × 2 = 44.6.
assert.strictEqual(mode.toggleWeight(45.3, TOTAL, PER_SIDE), 22.75, "halving rounds to 0.25 kg");
assert.strictEqual(mode.toggleWeight(22.3, PER_SIDE, TOTAL), 44.5, "doubling rounds to 0.25 kg");
assert.strictEqual(mode.toggleWeight(12.5, TOTAL, PER_SIDE), 6.25);
assert.strictEqual(mode.toggleWeight(0.1, TOTAL, PER_SIDE), 0);
assert.strictEqual(mode.toggleWeight(7.3, TOTAL, PER_SIDE), 3.75);
// lb is 0.5, for the day a unit setting exists.
assert.strictEqual(mode.toggleWeight(45.3, TOTAL, PER_SIDE, "lb"), 22.5);
assert.strictEqual(mode.toggleWeight(22.3, PER_SIDE, TOTAL, "lb"), 44.5);
// The same mode leaves the weight exactly as it is, unrounded.
assert.strictEqual(mode.toggleWeight(45.3, TOTAL, TOTAL), 45.3);
assert.strictEqual(mode.toggleWeight(45.3, null, "total"), 45.3, "NULL is total");
assert.strictEqual(mode.toggleWeight("45", TOTAL, PER_SIDE), 22.5, "a weight from SQLite may be text");

/* ---------------------------------------------------------------- null -- */

for (const empty of [null, undefined, "", "abc", NaN]) {
  assert.strictEqual(mode.toggleWeight(empty, TOTAL, PER_SIDE), null, `${String(empty)} is no weight and stays none`);
  assert.strictEqual(mode.totalLoad(empty, PER_SIDE), null);
  assert.strictEqual(mode.convertWeight(empty, TOTAL, PER_SIDE), null);
}
assert.strictEqual(mode.toggleWeight(0, TOTAL, PER_SIDE), 0, "zero is a weight, not an empty one");

/* ----------------------------------------------------------- the modes -- */

assert.strictEqual(mode.resolveWeightMode(null, null), TOTAL);
assert.strictEqual(mode.resolveWeightMode(null, "per_side"), PER_SIDE, "a new instance takes the exercise's mode");
assert.strictEqual(mode.resolveWeightMode("total", "per_side"), TOTAL, "an instance's own mode wins");
assert.strictEqual(mode.resolveWeightMode(undefined, "bodyweight"), TOTAL, "bodyweight is total for the numbers");
assert.strictEqual(mode.resolveWeightMode({ weight_mode: "per_side" }, null), PER_SIDE);
assert.strictEqual(mode.resolveWeightMode(" PER_SIDE ", null), PER_SIDE);
assert.strictEqual(mode.normalizeInstanceWeightMode(null), null, "unknown stays unknown for the sync");
assert.strictEqual(mode.normalizeInstanceWeightMode("nonsense"), null);
assert.strictEqual(mode.weightModeOf(null), TOTAL, "NULL means total");

assert.strictEqual(mode.totalLoad(22.5, PER_SIDE), 45, "a weight per side counts twice");
assert.strictEqual(mode.totalLoad(45, TOTAL), 45);
assert.strictEqual(mode.totalLoad(45, null), 45);
// The records compare exactly, so no two sets swap places.
assert.strictEqual(mode.convertWeight(45.3, TOTAL, PER_SIDE), 22.65);
assert.strictEqual(mode.convertWeight(22.3, PER_SIDE, TOTAL), 44.6);

/* ------------------------------------------------------------ the text -- */

const tFor = (locale) => (key) => {
  const [area, ...rest] = key.split(".");
  const table = area === "common" ? { kg: "kg" } : area === "workout" ? locale : null;
  const value = rest.reduce((node, part) => node?.[part], table);

  assert.ok(typeof value === "string", `${key} is missing`);
  return value;
};

i18n.setLanguage("da");
assert.strictEqual(mode.formatWeight(22.5, PER_SIDE, tFor(da)), "22,5 kg pr. side");
assert.strictEqual(mode.formatWeight(45, TOTAL, tFor(da)), "45 kg");
assert.strictEqual(mode.formatWeight(null, PER_SIDE, tFor(da)), "", "no weight, no text");
assert.strictEqual(mode.formatWeightNumber(11.25), "11,25", "two decimals survive, with a comma");
i18n.setLanguage("en");
assert.strictEqual(mode.formatWeight(22.5, PER_SIDE, tFor(en)), "22.5 kg per side");

for (const key of ["perSide", "bothSides", "tabValue", "doubled", "halved", "undo", "suffix", "a11y"]) {
  assert.ok(da.weightMode[key] && en.weightMode[key], `workout.weightMode.${key} is not in both languages`);
}
assert.strictEqual(da.weightMode.doubled, "Vægten er fordoblet: {from} → {to} {unit}");
assert.strictEqual(en.weightMode.halved, "Weight halved: {from} → {to} {unit}");

/* ------------------------------------------------------------- the card -- */

const unfinishedFirst = [
  { sets_id: 1, weight: 20, done: 1 },
  { sets_id: 2, weight: 22.5, done: 0 },
  { sets_id: 3, weight: 25, done: 0 },
];
assert.strictEqual(mode.pickTabWeight(unfinishedFirst), 22.5, "the tabs follow the first set not ticked off");
assert.strictEqual(
  mode.pickTabWeight(unfinishedFirst.map((set) => ({ ...set, done: 1 }))),
  25,
  "all done: the last set"
);
assert.strictEqual(mode.pickTabWeight([{ sets_id: 1, weight: null, done: 0 }]), null, "no weight: labels only");
assert.strictEqual(mode.pickTabWeight([]), null);
assert.deepStrictEqual(mode.tabWeights(22.5, PER_SIDE), { perSide: 22.5, bothSides: 45 });
assert.deepStrictEqual(mode.tabWeights(45, TOTAL), { perSide: 22.5, bothSides: 45 });
assert.deepStrictEqual(mode.tabWeights(null, TOTAL), { perSide: null, bothSides: null });

// Who gets the switch: equipment, a name that says so, or already per side.
assert.ok(custom.canLogWeightPerSide({ name: "Incline Dumbbell Press" }));
assert.ok(custom.canLogWeightPerSide({ name: "Cable Fly" }));
assert.ok(custom.canLogWeightPerSide({ name: "Kettlebell Swing" }));
assert.ok(custom.canLogWeightPerSide({ name: "Skrå håndvægtspres" }));
assert.ok(custom.canLogWeightPerSide({ name: "Kabeltræk" }));
assert.ok(custom.canLogWeightPerSide({ name: "My press", equipment: "dumbbell" }));
assert.ok(custom.canLogWeightPerSide({ name: "Squat", weightMode: "per_side" }), "per side always keeps the way back");
assert.ok(!custom.canLogWeightPerSide({ name: "Bench Press" }), "a barbell card is unchanged");
assert.ok(!custom.canLogWeightPerSide({ name: "Leg Press", equipment: "machine" }));
assert.ok(
  !custom.canLogWeightPerSide({ name: "Dumbbell Dip", weightMode: "bodyweight" }),
  "a bodyweight exercise has no switch"
);

/* ------------------------------------------------------ switch and undo -- */

const sets = [
  { sets_id: 11, weight: 45.3, done: 1, reps: 10 },
  { sets_id: 12, weight: 45, done: 0, reps: 8 },
  { sets_id: 13, weight: null, done: 0, reps: 8 },
];
const plan = mode.planWeightModeSwitch(sets, TOTAL, PER_SIDE);

assert.deepStrictEqual(
  plan,
  [
    { setId: 11, previous: 45.3, next: 22.75 },
    { setId: 12, previous: 45, next: 22.5 },
    { setId: 13, previous: null, next: null },
  ],
  "ticked-off and open sets convert the same way, and an empty weight stays empty"
);

// Converting back through the rounding would give 45.5, not 45.3. The undo
// restores `previous`, which is the only way to get the 45.3 back.
assert.strictEqual(mode.toggleWeight(22.75, PER_SIDE, TOTAL), 45.5);
assert.deepStrictEqual(
  plan.map((change) => change.previous),
  sets.map((set) => set.weight),
  "the undo does not have what was there"
);
assert.deepStrictEqual(mode.planWeightModeSwitch(sets, TOTAL, TOTAL).map((change) => change.next), [45.3, 45, null]);

/* ------------------------------------------------- the weight steppers -- */

// The lock screen's rule (liveWeightStepFor), case by case: the same press
// has to move a set by the same amount on the card and in the list.
for (const [exercise, expected] of [
  [{ name: "Bench Press" }, 2.5],
  [{ name: "Incline Dumbbell Press" }, 2],
  [{ name: "Skrå håndvægtspres" }, 2],
  [{ name: "My press", equipment: "dumbbell" }, 2],
  [{ name: "Chest Press Machine" }, 5],
  [{ name: "Brystpres i maskine" }, 5],
  [{ name: "Cable Row" }, 5],
  [{ name: "Kabeltræk" }, 5],
  [{ name: "Leg Press" }, 5],
  [{ name: "Benpres" }, 5],
  [{ name: "Row", equipment: "machine" }, 5],
  [{ name: "Row", equipment: "cable" }, 5],
  [{ name: "Back Squat" }, 5],
  [{ name: "Deadlift" }, 5],
  [{ name: "Rumænsk dødløft" }, 5],
  [{ name: "Overhead Press" }, 2.5],
  [{ name: "Kettlebell Swing", equipment: "kettlebell" }, 2.5],
  [{}, 2.5],
  [{ name: "Squat", weightStep: 1.25 }, 1.25],
  [{ name: "Squat", weightStep: 1.1 }, 1],
  [{ name: "Squat", weightStep: 0 }, 5],
  [{ name: "Squat", weightStep: -2 }, 5],
  [{ name: "Squat", weightStep: "x" }, 5],
]) {
  assert.strictEqual(steps.getWeightStep(exercise), expected, `step for ${JSON.stringify(exercise)}`);
}

assert.strictEqual(steps.stepWeight(100, 1, 2.5), 102.5, "+ on 100 kg bench gives 102.5");
assert.strictEqual(steps.stepWeight(100, -1, 2.5), 97.5);
assert.strictEqual(steps.stepWeight(1, -1, 2.5), 0, "never below 0");
assert.strictEqual(steps.stepWeight(0, -1, 2.5), null, "− at 0 does nothing");
assert.strictEqual(steps.stepWeight(null, -1, 2.5), null, "− on an empty weight does nothing");
assert.strictEqual(steps.stepWeight(null, 1, 2.5), 2.5, "+ on empty with nothing to start from is 0 + a step");
assert.strictEqual(steps.stepWeight("", 1, 2, { startFrom: 20 }), 22, "+ on empty starts from the set above");
assert.strictEqual(steps.stepWeight(22.6, 1, 2.5), 25, "rounded to 0.25");
assert.strictEqual(steps.stepWeight(0.1 + 0.2, 1, 2.5), 2.75, "no float dust");
assert.strictEqual(steps.stepWeight(6.25, 1, 2), 8.25, "a quarter kilo per side survives a step");

const listed = [
  { sets_id: 1, weight: 60, done: 1, failed: 0 },
  { sets_id: 2, weight: 100, done: 0, failed: 0 },
  { sets_id: 3, weight: null, done: 0, failed: 0 },
  { sets_id: 4, weight: 1, done: 0, failed: 0 },
  { sets_id: 5, weight: 90, done: 1, failed: 1 },
];
assert.deepStrictEqual(
  steps.stepAllWeights(listed, 1, 2.5),
  [
    { setId: 2, weight: 102.5 },
    { setId: 4, weight: 3.5 },
  ],
  "the header moves every unfinished set with a weight, and leaves the finished and the empty ones"
);
assert.deepStrictEqual(
  steps.stepAllWeights(listed, -1, 2.5),
  [
    { setId: 2, weight: 97.5 },
    { setId: 4, weight: 0 },
  ],
  "a set that would go under 0 stays at 0"
);
assert.deepStrictEqual(steps.stepAllWeights(listed.map((set) => ({ ...set, done: 1 })), 1, 2.5), []);

const columns = (keys) =>
  Object.fromEntries(
    ["note", "rest", "set", "reps", "rpe", "rm_percentage", "weight", "done"].map((key) => [key, keys.includes(key)])
  );
assert.ok(steps.showsWeightStepper(columns(["rest", "set", "reps", "weight", "done"])));
assert.ok(steps.showsWeightStepper(columns(["set", "reps", "weight"])));
assert.ok(!steps.showsWeightStepper(columns(["rest", "set", "reps", "weight", "done", "rpe"])), "RPE: the table is as before");
assert.ok(!steps.showsWeightStepper(columns(["rest", "set", "reps", "weight", "note"])));
assert.ok(!steps.showsWeightStepper(columns(["rest", "set", "reps", "weight", "rm_percentage"])));
assert.ok(!steps.showsWeightStepper(columns(["rest", "set", "reps", "done"])), "no weight column, no steppers");
assert.ok(
  !steps.showsWeightStepper(columns(["rest", "set", "reps", "weight", "done"]), { weightMode: "bodyweight" }),
  "a bodyweight exercise has no steppers"
);

// A stepped weight is stored as it is shown: two decimals, not one.
assert.strictEqual(limits.clampSetValue("weight", 6.25), 6.25);
assert.strictEqual(limits.clampSetValue("weight", "11,25"), 11.25);

for (const key of ["weightMinus", "weightPlus", "weightMinusAll", "weightPlusAll"]) {
  assert.ok(da.setList[key] && en.setList[key], `workout.setList.${key} is not in both languages`);
}
assert.strictEqual(da.setList.weightPlus, "Læg {step} kg til sæt {label}");

/* -------------------------------------------------------- the cloud column -- */

assert.ok(
  fields.SYNCED_FIELDS.ExerciseInstance.some((field) => field.key === "weight_mode" && field.compare && field.inPayload),
  "exercise_instance.weight_mode is not synced - a switch would stay on one phone"
);
assert.deepStrictEqual(
  mode.withSendableWeightMode({ a: 1, weight_mode: null }),
  { a: 1 },
  "a null weight_mode would erase another phone's"
);
assert.deepStrictEqual(mode.withSendableWeightMode({ a: 1, weight_mode: "per_side" }), { a: 1, weight_mode: "per_side" });
assert.deepStrictEqual(
  mode.withSendableWeightMode({ a: 1, weight_mode: "per_side" }, { cloudHasColumn: false }),
  { a: 1 }
);

const missing = { code: "42703", message: "column exercise_instance.weight_mode does not exist" };
assert.ok(mode.isMissingWeightModeColumnError(missing));
assert.ok(mode.isMissingWeightModeColumnError({ code: "PGRST204", message: "Could not find the 'weight_mode' column" }));
assert.ok(!mode.isMissingWeightModeColumnError({ code: "42703", message: "column set.set_type does not exist" }));

(async () => {
  const column = mode.createWeightModeCloudColumn();
  const selects = [];
  const answer = await column.withFallback(async () => {
    const select = column.selectColumns("id, exercise_name");

    selects.push(select);

    if (select.includes("weight_mode")) {
      throw missing;
    }

    return "synced";
  });

  assert.strictEqual(answer, "synced", "a missing column stopped the sync instead of syncing without it");
  assert.deepStrictEqual(selects, ["id, exercise_name, weight_mode", "id, exercise_name"]);
  assert.strictEqual(column.isAvailable(), false);
  assert.deepStrictEqual(column.sendablePayload({ id: 1, weight_mode: "per_side" }), { id: 1 });
  await assert.rejects(
    column.withFallback(async () => {
      throw { code: "500", message: "boom" };
    }),
    "another error is not swallowed"
  );

  // Every read and write of the column goes through a handle.
  const instanceSync = read("src/Services/cloudSync/exerciseInstanceSync.js");
  assert.ok(/weightModeColumn\.selectColumns\(EXERCISE_INSTANCE_CLOUD_SYNC_SELECT\)/.test(instanceSync));
  assert.ok(/weightModeColumn\.sendablePayload\(payload\)/.test(instanceSync));
  assert.ok(!/SYNC_SELECT =[^;]*weight_mode/.test(read("src/Services/cloudSync/cloudSyncShared.js")),
    "the base select names weight_mode, so a project without the migration fails every exercise sync");
  const service = read("src/Services/weightliftingService.js");
  assert.ok(/preferenceWeightModeColumn\.selectColumns\(/.test(service));
  assert.ok(/preferenceWeightModeColumn\.sendablePayload\(/.test(service));
  assert.ok(/hydrateWeightModeColumn\.selectColumns\(/.test(service));
  // A switch changes the unit, not the lift: no record is recomputed by it.
  // Several sets' weights in one transaction, and the records once per
  // exercise rather than once per set.
  const setWeightsBody = service.slice(
    service.indexOf("export async function updateSetWeights"),
    service.indexOf("export async function getExerciseSets")
  );
  assert.ok(/withTransaction\(db/.test(setWeightsBody), "updateSetWeights is not one transaction");
  assert.ok(/refreshPersonalRecordsForExerciseName/.test(setWeightsBody), "updateSetWeights does not recompute the records");
  assert.ok(/writeSetWeight\(db, setId, change\.weight\)/.test(setWeightsBody), "updateSetWeights skips the 1RM %");

  const switchBody = service.slice(
    service.indexOf("export async function switchExerciseWeightMode"),
    service.indexOf("export async function undoExerciseWeightModeSwitch")
  );
  assert.ok(switchBody.length > 0 && !/refreshPersonalRecords/.test(switchBody), "a switch recomputes the records");

  // The migration is in the ledger, and not as run.
  const migration = "20261002090000_weight-mode-per-instance.sql";
  assert.ok(fs.existsSync(path.join(root, "supabase", "migrations", migration)));
  assert.ok(
    read("supabase/migrations/README.md").includes(`| \`${migration}\` | no |`),
    "the weight mode migration is not in the ledger as not run"
  );

  /* ------------------------------------------------------ the database -- */

  const raw = new DatabaseSync(":memory:");
  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  const db = {
    getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql, params = []) => raw.prepare(sql).get(...params) ?? null,
    runAsync: async (sql, params = []) => {
      const result = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    execAsync: async (sql) => raw.exec(sql),
    isInTransactionAsync: async () => raw.isTransaction,
  };

  raw.exec(`
    INSERT INTO Exercise (name, weight_mode) VALUES ('Dumbbell Press', 'total');
    INSERT INTO Exercise (name, weight_mode) VALUES ('Bench Press', 'total');
  `);

  let nextId = 1;

  function session({ date, exercise = "Dumbbell Press", weightMode = null, sets: rows }) {
    const id = nextId++;

    raw.prepare("INSERT INTO Day (day_id, date, Weekday) VALUES (?, ?, 'Monday')").run(id, date);
    raw.prepare("INSERT INTO Workout_Type_Instance (workout_id, day_id, date, done) VALUES (?, ?, ?, 1)").run(id, id, date);
    raw
      .prepare(
        "INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, weight_mode, needs_sync) VALUES (?, ?, ?, ?, 0)"
      )
      .run(id, id, exercise, weightMode);
    rows.forEach((set, index) => {
      raw
        .prepare(
          `INSERT INTO "Set" (exercise_instance_id, set_number, weight, reps, done, set_type, needs_sync)
           VALUES (?, ?, ?, ?, ?, 'working', 0)`
        )
        .run(id, index + 1, set.weight, set.reps, set.done ?? 1);
    });

    return id;
  }

  // Three sessions for both sides (one from before the column: NULL), then
  // today's, which is switched.
  session({ date: "2026-09-01", sets: [{ weight: 40, reps: 10 }] });
  session({ date: "2026-09-08", weightMode: "total", sets: [{ weight: 45, reps: 10 }, { weight: 42.5, reps: 8 }] });
  session({ date: "2026-09-15", weightMode: "total", sets: [{ weight: 47.5, reps: 10 }] });
  const today = session({
    date: "2026-09-22",
    weightMode: "total",
    sets: [{ weight: 50, reps: 10 }, { weight: 50, reps: 8, done: 0 }, { weight: null, reps: 8, done: 0 }],
  });
  session({ date: "2026-09-22", exercise: "Bench Press", weightMode: "total", sets: [{ weight: 100, reps: 5 }] });

  // The records' own rule, as the service applies it: a set holds a record
  // at its rep count when it beats every earlier one.
  const recordIds = (rows) => {
    const best = new Map();
    const ids = [];

    for (const row of [...rows].sort((a, b) =>
      a.performed_date_sort === b.performed_date_sort
        ? a.sets_id - b.sets_id
        : a.performed_date_sort.localeCompare(b.performed_date_sort)
    )) {
      const key = `${row.exercise_name}::${row.reps}`;

      if (!best.has(key) || row.weight > best.get(key)) {
        best.set(key, row.weight);
        ids.push(row.sets_id);
      }
    }

    return ids.sort((a, b) => a - b);
  };
  const volume = (rows) =>
    insights.normalizeRecordRows(rows).reduce((sum, set) => sum + set.volume, 0);

  const before = await repository.getCompletedStrengthSetsForPersonalRecords(db);

  assert.ok(before.every((row) => row.weight_mode === TOTAL), "nothing is per side yet");

  // The switch, as switchExerciseWeightMode makes it.
  const context = await repository.getExerciseWeightModeContext(db, {
    exerciseId: today,
    preferenceUserId: "__local__",
  });

  assert.strictEqual(context.exercise_name, "Dumbbell Press");
  assert.strictEqual(context.weight_mode, "total");
  assert.strictEqual(context.exercise_weight_mode, "total");
  assert.strictEqual(context.preference_id, null);

  const todaysSets = await repository.getSetsByExercise(db, today);
  const switchPlan = mode.planWeightModeSwitch(todaysSets, TOTAL, PER_SIDE);

  for (const change of switchPlan) {
    if (change.next !== change.previous) {
      await repository.updateSetField(db, { field: "weight", value: change.next, setId: change.setId });
    }
  }
  await repository.updateExerciseInstanceWeightMode(db, { exerciseId: today, weightMode: PER_SIDE });
  await repository.updateExerciseWeightMode(db, { exerciseName: "Dumbbell Press", weightMode: PER_SIDE });
  await repository.upsertExerciseWeightModePreference(db, {
    userId: "__local__",
    exerciseName: "Dumbbell Press",
    weightMode: PER_SIDE,
    visibleColumns: "{}",
  });

  const switched = raw
    .prepare('SELECT weight, reps FROM "Set" WHERE exercise_instance_id = ? ORDER BY set_number')
    .all(today);

  assert.deepStrictEqual(
    switched.map((set) => set.weight),
    [25, 25, null],
    "the switch did not halve every set, or an empty weight got a number"
  );
  assert.deepStrictEqual(switched.map((set) => set.reps), [10, 8, 8], "a switch changed the reps");

  const instance = raw.prepare("SELECT weight_mode, needs_sync FROM Exercise_Instance WHERE exercise_instance_id = ?").get(today);
  assert.deepStrictEqual({ ...instance }, { weight_mode: PER_SIDE, needs_sync: 1 }, "the instance is not marked for upload");
  assert.strictEqual(
    raw.prepare('SELECT COUNT(*) AS n FROM "Set" WHERE exercise_instance_id = ? AND needs_sync = 1').get(today).n,
    2,
    "the converted sets are not marked for upload"
  );
  const preference = raw.prepare("SELECT weight_mode, needs_sync FROM Exercise_Column_Preference WHERE exercise_name = 'Dumbbell Press'").get();
  assert.deepStrictEqual({ ...preference }, { weight_mode: PER_SIDE, needs_sync: 1 }, "the choice will not reach a new phone");

  // Earlier workouts are not touched.
  assert.deepStrictEqual(
    raw.prepare(`SELECT s.weight FROM "Set" s WHERE s.exercise_instance_id < ? ORDER BY s.sets_id`).all(today).map((row) => row.weight),
    [40, 45, 42.5, 47.5]
  );

  const after = await repository.getCompletedStrengthSetsForPersonalRecords(db);
  const press = after.filter((row) => row.exercise_name === "Dumbbell Press");

  assert.ok(press.every((row) => row.weight_mode === PER_SIDE), "the records are not in the exercise's current mode");
  assert.deepStrictEqual(
    press.map((row) => [row.logged_weight, row.logged_weight_mode, row.weight]).sort((a, b) => a[2] - b[2]),
    [
      [40, TOTAL, 20],
      [42.5, TOTAL, 21.25],
      [45, TOTAL, 22.5],
      [47.5, TOTAL, 23.75],
      [25, PER_SIDE, 25],
    ],
    "older sets are not converted to the current mode before they are compared"
  );
  assert.strictEqual(
    after.find((row) => row.exercise_name === "Bench Press").weight,
    100,
    "another exercise changed"
  );
  assert.deepStrictEqual(recordIds(after), recordIds(before), "a switch created or removed a record by itself");
  assert.strictEqual(volume(after), volume(before), "volume changed with the unit - per side must count twice");
  assert.strictEqual(
    insights.normalizeRecordRows(after).find((set) => set.weight === 25).volume,
    500,
    "25 kg per side × 10 is 500 kg of volume"
  );
  // e1RM scales with the unit, so the order of bests is the same.
  const e1rm = (rows) => insights.normalizeRecordRows(rows).filter((set) => set.name === "Dumbbell Press").map((set) => set.e1rm);
  e1rm(after).forEach((value, index) => assert.ok(Math.abs(value * 2 - e1rm(before)[index]) < 1e-9));

  // The heaviest lift is found by what was lifted and shown per side.
  const heaviest = await repository.getHeaviestLiftForExercise(db, "dumbbell press");
  assert.deepStrictEqual({ ...heaviest }, { weight: 25, weight_mode: PER_SIDE, reps: 10 });

  // The history shows each session as it was written.
  const historyRows = await repository.getCompletedExerciseHistorySets(db, {
    exerciseId: today,
    exerciseName: "Dumbbell Press",
    limit: 3,
  });
  const table = history.buildExerciseHistoryTable(historyRows);
  assert.ok(table.sessions.length > 0 && table.sessions.every((row) => row.weightMode === TOTAL));

  // A new workout takes the exercise's mode, and the weight it carries from
  // last time comes over converted.
  const catalogEntry = await repository.getExerciseCatalogEntryByName(db, "Dumbbell Press");
  assert.strictEqual(mode.resolveWeightMode(null, catalogEntry.weight_mode), PER_SIDE);
  const last = await repository.getLastSetValuesForExerciseName(db, { exerciseName: "Dumbbell Press", excludeExerciseId: 999 });
  assert.strictEqual(last.weight_mode, PER_SIDE);
  const created = await repository.createExercise(db, { workoutId: today, exerciseName: "Bench Press" });
  assert.strictEqual(
    raw.prepare("SELECT weight_mode FROM Exercise_Instance WHERE exercise_instance_id = ?").get(created.lastInsertRowId).weight_mode,
    TOTAL,
    "an instance created without a mode is not total"
  );

  // The program overview's volume counts per side twice.
  raw.exec("UPDATE Day SET program_id = 1");
  const overview = await programRepository.getProgramOverviewStats(db, 1);
  assert.strictEqual(
    Number(overview.total_volume),
    // Done sets only; today's 25 per side × 10 is 50 kg × 10.
    40 * 10 + 45 * 10 + 42.5 * 8 + 47.5 * 10 + 25 * 2 * 10 + 100 * 5,
    "the program's volume does not count a weight per side twice"
  );

  // The catalog comes back as total from the cloud; the preference puts the
  // choice back.
  await repository.replaceExerciseCatalog(db, [{ name: "Dumbbell Press" }, { name: "Bench Press" }]);
  assert.strictEqual(
    (await repository.getExerciseCatalogEntryByName(db, "Dumbbell Press")).weight_mode,
    PER_SIDE,
    "a catalog refresh forgot the exercise is written per side"
  );

  // The undo, as undoExerciseWeightModeSwitch makes it: exactly what was there.
  for (const change of switchPlan) {
    if (change.next !== change.previous) {
      await repository.updateSetField(db, { field: "weight", value: change.previous, setId: change.setId });
    }
  }
  await repository.updateExerciseInstanceWeightMode(db, { exerciseId: today, weightMode: TOTAL });
  await repository.updateExerciseWeightMode(db, { exerciseName: "Dumbbell Press", weightMode: TOTAL });

  assert.deepStrictEqual(
    raw.prepare('SELECT weight FROM "Set" WHERE exercise_instance_id = ? ORDER BY set_number').all(today).map((set) => set.weight),
    [50, 50, null],
    "the undo did not give back the exact weights"
  );
  assert.deepStrictEqual(
    (await repository.getCompletedStrengthSetsForPersonalRecords(db)).map((row) => row.weight),
    before.map((row) => row.weight),
    "after the undo the records read differently than before the switch"
  );

  // A round trip through the rounding is not exact, which is why the undo
  // keeps the previous weights instead.
  assert.notStrictEqual(
    mode.toggleWeight(mode.toggleWeight(45.3, TOTAL, PER_SIDE), PER_SIDE, TOTAL),
    45.3
  );

  // A custom exercise is marked for its own upload when the mode changes.
  raw.exec("INSERT INTO Exercise (name, is_custom, weight_mode, custom_needs_upload) VALUES ('My Row', 1, 'total', 0)");
  await repository.updateExerciseWeightMode(db, { exerciseName: "my row", weightMode: PER_SIDE });
  assert.deepStrictEqual(
    { ...raw.prepare("SELECT weight_mode, custom_needs_upload FROM Exercise WHERE name = 'My Row'").get() },
    { weight_mode: PER_SIDE, custom_needs_upload: 1 },
    "a custom exercise's mode will not reach public.custom_exercise"
  );

  // The SQL and the JavaScript agree on the conversion.
  for (const [weight, from, to] of [
    [45.3, TOTAL, PER_SIDE],
    [22.3, PER_SIDE, TOTAL],
    [45, TOTAL, TOTAL],
    [null, TOTAL, PER_SIDE],
  ]) {
    // Literals, not placeholders: each fragment names its inputs more than once.
    const lit = (value) => (value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value}'`);
    const row = raw
      .prepare(
        `SELECT ${mode.convertWeightSql(lit(weight), lit(from), lit(to))} AS converted,
                ${mode.totalLoadSql(lit(weight), lit(from))} AS total`
      )
      .get();

    assert.strictEqual(row.converted, mode.convertWeight(weight, from, to), `convertWeightSql(${weight}, ${from}, ${to})`);
    assert.strictEqual(row.total, mode.totalLoad(weight, from), `totalLoadSql(${weight}, ${from})`);
  }

  console.log(
    "Weight mode and steppers: rounding, empty weights, the undo, the conversion rules, records, volume, the cloud column and the weight step passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
