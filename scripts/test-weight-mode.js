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
// does. The switch is played through the repository calls the service makes,
// and then - at the end, behind stubs for what the app loads - the service's
// own switch, undo and header write run against another one.

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

// One rule for the step, on the card and in the list: the lock screen's is
// getWeightStep's, not a copy of it (PR #291's review).
{
  const live = loadAppModule("src/Utils/liveWorkout.js");

  for (const exercise of [
    { name: "Bench Press" },
    { name: "Incline Dumbbell Press" },
    { name: "Row", equipment: "cable" },
    { name: "Row", equipment: "Machine" },
    { name: "Rumænsk dødløft" },
    { name: "Pull-up" },
    {},
  ]) {
    assert.strictEqual(live.liveWeightStepFor(exercise), steps.getWeightStep(exercise), JSON.stringify(exercise));
  }

  assert.strictEqual(live.LIVE_WEIGHT_STEP_DEFAULT, steps.DEFAULT_WEIGHT_STEP);
  assert.ok(
    !/\/dumbbell\|håndvægt\//.test(read("src/Utils/liveWorkout.js")),
    "liveWorkout.js has its own copy of the equipment rule again"
  );
  assert.ok(
    /roundToStep\(value, STEP_ROUNDING\)/.test(read("src/Utils/weightStep.js")),
    "weightStep.js rounds a quarter kilo its own way again, beside weightMode's roundToStep"
  );
}

/* ------------------------------------------- weights not saved yet (1e) -- */

// What a set list shows before the database has it. PR #291's review found
// two ways a weight on screen never reached the database.
{
  // 1. Typed 20 over a stored 15, then + at once: the press starts from 20,
  // not 15, and the steppers' write carries 22.5 - never a weight worked out
  // from the one before what was typed.
  const drafts = steps.createWeightDrafts();
  const stored = 15;
  const typedToken = drafts.typed(7, 20);

  assert.strictEqual(drafts.weightOf(7, stored), 20, "the press starts from the weight before the one typed");

  const pressed = steps.stepWeight(drafts.weightOf(7, stored), 1, 2.5);

  drafts.step(7, pressed);
  assert.strictEqual(pressed, 22.5);
  assert.deepStrictEqual(
    drafts.stepsToSave().map(({ setId, weight }) => ({ setId, weight })),
    [{ setId: 7, weight: 22.5 }]
  );
  // The typed weight's own write comes back after the press: it is not the
  // newest, so the screen keeps 22.5.
  assert.strictEqual(drafts.settle([{ setId: 7, token: typedToken }]).has(7), false);
  assert.strictEqual(drafts.weightOf(7, 20), 22.5);

  const written = drafts.stepsToSave();

  assert.strictEqual(drafts.settle(written).has(7), true);
  assert.ok(drafts.isEmpty(), "a saved step is still a draft");
}

{
  // 2. The steppers' write fails: the steps are kept - on screen and in the
  // next write - rather than dropped before it was tried.
  const drafts = steps.createWeightDrafts();

  drafts.step(1, 102.5);
  drafts.step(2, 62.5);

  const failed = drafts.stepsToSave();

  assert.strictEqual(failed.length, 2);
  // (the write throws; nothing is settled)
  assert.strictEqual(drafts.weightOf(1, 100), 102.5, "a failed write lost the weight on screen");
  assert.deepStrictEqual(
    drafts.stepsToSave().map(({ setId, weight }) => [setId, weight]),
    [[1, 102.5], [2, 62.5]],
    "the next write does not carry what the failed one did"
  );
}

{
  // 3. Pressed again while a write is out: the newer weight is not
  // forgotten when the older write comes back.
  const drafts = steps.createWeightDrafts();

  drafts.step(1, 102.5);
  const first = drafts.stepsToSave();

  drafts.step(1, 105);
  assert.deepStrictEqual([...drafts.settle(first)], [], "the older write's result would replace 105");
  assert.deepStrictEqual(drafts.stepsToSave().map(({ weight }) => weight), [105]);

  // Typed over a step: the step is out of the next write.
  drafts.typed(1, 80);
  assert.deepStrictEqual(drafts.stepsToSave(), []);

  // A typed weight whose write failed goes, unless something newer came.
  const token = drafts.typed(2, 50);

  assert.strictEqual(drafts.discard(2, token), true);
  assert.strictEqual(drafts.has(2), false);

  const stale = drafts.typed(3, 50);

  drafts.step(3, 52.5);
  assert.strictEqual(drafts.discard(3, stale), false, "a failed typed write dropped the step pressed after it");
  assert.strictEqual(drafts.weightOf(3, 40), 52.5);
}

// The set list keeps them there, and says so when a write fails.
{
  const setList = read(
    "src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js"
  );
  const flush = setList.slice(
    setList.indexOf("flushWeightStepsRef.current = async"),
    setList.indexOf("// Leaving with a step not saved yet")
  );
  const typed = setList.slice(
    setList.indexOf("const updateWeight = async"),
    setList.indexOf("/* ------------------------------------------------ the weight steppers")
  );

  assert.ok(!/pendingWeightsRef/.test(setList), "the set list keeps its own map of unsaved weights again");
  assert.ok(/weightDrafts\.stepsToSave\(\)/.test(flush) && /weightDrafts\.settle\(drafts\)/.test(flush));
  assert.ok(
    flush.indexOf("weightDrafts.settle(drafts)") > flush.indexOf("await weightliftingService.updateSetWeight"),
    "the steps are forgotten before their write went through"
  );
  assert.ok(/catch \(error\) \{[\s\S]*Alert\.alert\(/.test(flush), "a failed step write is only written to the console");
  assert.ok(
    typed.indexOf("weightDrafts.typed(setId") < typed.indexOf("await weightliftingService.updateSetWeight"),
    "a typed weight is only where + starts once its write is back"
  );
  assert.ok(/catch \(error\) \{[\s\S]*Alert\.alert\(/.test(typed), "a failed typed weight is only written to the console");

  for (const key of ["weightSaveFailedTitle", "weightStepsKept", "weightTypedReverted"]) {
    assert.ok(da.setList[key] && en.setList[key], `workout.setList.${key} is not in both languages`);
  }
}

/* ----------------------------------------------------------- the %1RM -- */

// Of the weight as written - the owner's rule: 22,5 kg per side is 22,5
// against the estimate, not 45. A switch moves it with the number (PR #291's
// review: the switch left the % behind the weight).
assert.strictEqual(mode.rmPercentageOf(40, 100), 40);
assert.strictEqual(mode.rmPercentageOf(22.5, 100), 23, "per side is the number for one side");
assert.strictEqual(mode.rmPercentageOf(22.75, 50), 46);
assert.strictEqual(mode.rmPercentageOf(null, 100), null);
assert.strictEqual(mode.rmPercentageOf(40, null), null);
assert.strictEqual(mode.rmPercentageOf(40, 0), null);
assert.strictEqual(mode.weightAtRmPercentage(45, 100), 45);
assert.strictEqual(mode.weightAtRmPercentage(81, 50), 41, "whole kilos, as before there were modes");
assert.strictEqual(mode.weightAtRmPercentage(null, 100), null);

/* ------------------------------------------------------------ the tabs -- */

// "Pr. side | Begge sider": the text 4.5:1 and the line under the selected
// tab 3:1, on the card as it is and as a done or record exercise tints it,
// in every accent, light and dark. PR #291's review: an idle tab in dark
// read 3.7:1.
{
  const colors = loadAppModule("src/Resources/GlobalStyling/colors.js");
  const { contrastRatio } = loadAppModule("src/Utils/categoryFormat.js");
  const { mixHexColors } = loadAppModule("src/Utils/colorMix.js");
  const tabsSource = read(
    "src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/WeightModeTabs.js"
  );
  const rowSource = read(
    "src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/ExerciseRow.js"
  );

  assert.ok(!/#[0-9a-f]{6}/i.test(tabsSource), "the tabs have a colour of their own again, beside the theme");
  assert.ok(/const idleColor = theme\.quietText;/.test(tabsSource));
  assert.ok(/const underlineColor = theme\.primaryText/.test(tabsSource), "the line is the accent's fill, 2.8:1 on white");
  // The tints the card takes, as ExerciseRow writes them.
  assert.ok(/rgba\(242,193,78,0\.05\)/.test(rowSource) && /rgba\(192,138,18,0\.05\)/.test(rowSource));
  assert.ok(/withAlpha\(secondaryColor, 0\.07\)/.test(rowSource));

  for (const accent of Object.keys(colors.AccentThemes)) {
    colors.applyAccentTheme(accent);

    for (const scheme of ["light", "dark"]) {
      const theme = colors.Colors[scheme];
      const surfaces = {
        card: theme.cardBackground,
        done: mixHexColors(theme.cardBackground, theme.secondary, 0.07),
        record: mixHexColors(theme.cardBackground, scheme === "dark" ? "#F2C14E" : "#C08A12", 0.05),
      };

      for (const [surface, background] of Object.entries(surfaces)) {
        const where = `${accent}, ${scheme}, ${surface} ${background}`;

        for (const [token, minimum] of [["title", 4.5], ["quietText", 4.5], ["primaryText", 3]]) {
          const ratio = contrastRatio(theme[token], background);

          assert.ok(ratio >= minimum, `${where}: ${token} ${theme[token]} is ${ratio?.toFixed(2)}:1`);
        }
      }
    }
  }

  colors.applyAccentTheme(colors.DEFAULT_ACCENT_THEME);
}

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

  // The migration is in the ledger, as run on 2026-09-27.
  const migration = "20261002090000_weight-mode-per-instance.sql";
  assert.ok(fs.existsSync(path.join(root, "supabase", "migrations", migration)));
  assert.ok(
    read("supabase/migrations/README.md").includes(`| \`${migration}\` | yes |`),
    "the weight mode migration is not in the ledger as run"
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

  await serviceChecks();

  console.log(
    "Weight mode and steppers: rounding, empty weights, the undo, the conversion rules, records, volume, the cloud column, the weight step, weights not saved yet, the %1RM, the tabs' contrast, and the switch, its undo and the header's write run through the service passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

/* ------------------------------------------- the service, run for real -- */

// switchExerciseWeightMode, undoExerciseWeightModeSwitch and updateSetWeights
// themselves, not the repository calls they are believed to make (PR #291's
// review: a wrong order or a lost await still passed). Signed out, so every
// upload they start stops at "no user" and nothing reaches the network.
async function serviceChecks() {
  const fakeSupabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from() {
      throw new Error("the weight mode service reached for the cloud while signed out");
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

  // The uploads reach programService through a dynamic import this loader
  // leaves to Node; what they say about it is not what is tested here.
  const consoleError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === "string" && /cloud push failed/.test(args[0])) {
      return;
    }

    consoleError(...args);
  };

  const service = loadAppModule("src/Services/weightliftingService.js");
  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );
  const db = {
    databasePath: "test-weight-mode-service",
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, params) => {
      const result = raw.prepare(sql).run(...bind(params));

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql, params) => raw.prepare(sql).all(...bind(params)),
    getFirstAsync: async (sql, params) => raw.prepare(sql).get(...bind(params)) ?? null,
    isInTransactionAsync: async () => Boolean(raw.isTransaction),
  };
  const run = (sql, ...params) => raw.prepare(sql).run(...params);
  const setsOf = (exerciseId) =>
    raw
      .prepare('SELECT sets_id, weight, rm_percentage FROM "Set" WHERE exercise_instance_id = ? ORDER BY set_number')
      .all(exerciseId)
      .map((row) => [row.sets_id, row.weight, row.rm_percentage]);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  // A program with a 1RM estimate of 100 kg for the dumbbell press, so the
  // %1RM has something to be worked out from.
  run("INSERT INTO Program (program_id, program_name, start_date) VALUES (1, 'Plan', '2026-09-01')");
  run("INSERT INTO Mesocycle (mesocycle_id, program_id, mesocycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Day (day_id, microcycle_id, program_id, Weekday, date) VALUES (1, 1, 1, 'Monday', '2026-09-28')");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date) VALUES (1, 1, 'Resistance', 'Push', '2026-09-28')");
  run("INSERT INTO Exercise (name, weight_mode) VALUES ('Dumbbell Press', 'total')");
  run("INSERT INTO Estimated_Set (program_id, exercise_name, estimated_weight) VALUES (1, 'Dumbbell Press', 100)");
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, weight_mode)
     VALUES (10, 1, 'Dumbbell Press', 1, 'total')`
  );
  for (const [id, number, weight, rm] of [[100, 1, 50, 50], [101, 2, 45, 45], [102, 3, null, null]]) {
    run(
      `INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, rm_percentage, done)
       VALUES (?, 10, ?, ?, 8, ?, 0)`,
      id,
      number,
      weight,
      rm
    );
  }

  // Both sides: the %1RM of what is typed is of the weight, as it always was.
  let written = await service.updateSetWeight(db, { setId: 101, weight: 40 });

  assert.deepStrictEqual([written.weight, written.rmPercentage], [40, 40]);

  // The switch: every weight halved, and the %1RM with it - it is of the
  // number as written.
  const undo = await service.switchExerciseWeightMode(db, { exerciseId: 10, weightMode: PER_SIDE });

  assert.ok(undo, "the switch changed nothing");
  assert.deepStrictEqual(
    setsOf(10),
    [[100, 25, 25], [101, 20, 20], [102, null, null]],
    "the switch left the %1RM behind the weight"
  );
  assert.strictEqual(raw.prepare("SELECT weight_mode FROM Exercise_Instance WHERE exercise_instance_id = 10").get().weight_mode, PER_SIDE);

  // Per side the %1RM is of the one side's number, typed or worked out.
  written = await service.updateSetWeight(db, { setId: 101, weight: 30 });
  assert.deepStrictEqual([written.weight, written.rmPercentage], [30, 30], "30 per side is 30% of a 100 kg estimate");
  written = await service.updateSetRmPercentage(db, { setId: 100, rmPercentage: 45 });
  assert.deepStrictEqual([written.weight, written.rmPercentage], [45, 45], "45% of 100 kg is 45 as written");

  // The header's write, through the service: both sets, one transaction.
  const header = await service.updateSetWeights(db, [
    { setId: 100, weight: 25 },
    { setId: 102, weight: 10 },
  ]);

  assert.deepStrictEqual(
    header.sets.map((set) => [set.setId, set.weight, set.rmPercentage]),
    [[100, 25, 25], [102, 10, 10]]
  );

  // Then the Undo: set 100 went back to 25 - where the switch left it - so it
  // gets its old weight and %1RM exactly. Set 101 was changed to 30 a side
  // after the switch, and 102 filled in: both are kept, written for both
  // sides again, instead of the weight from before the switch over them.
  assert.strictEqual(await service.undoExerciseWeightModeSwitch(db, undo), true);
  await settle();

  assert.deepStrictEqual(
    setsOf(10),
    [[100, 50, 50], [101, 60, 60], [102, 20, 20]],
    "the undo put the weight from before the switch over a set changed since"
  );
  assert.strictEqual(raw.prepare("SELECT weight_mode FROM Exercise_Instance WHERE exercise_instance_id = 10").get().weight_mode, TOTAL);

  // Without an estimate - a workout outside a program - the %1RM typed by
  // hand is the person's own, and a switch leaves it.
  run("INSERT INTO Day (day_id, Weekday, date) VALUES (2, 'Tuesday', '2026-09-29')");
  run("INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, date) VALUES (2, 2, 'Resistance', '2026-09-29')");
  run(
    `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, weight_mode)
     VALUES (20, 2, 'Dumbbell Press', 1, 'total')`
  );
  run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, rm_percentage, done) VALUES (200, 20, 1, 40, 8, 70, 0)`);
  await service.switchExerciseWeightMode(db, { exerciseId: 20, weightMode: PER_SIDE });
  assert.deepStrictEqual(setsOf(20), [[200, 20, 70]]);
  await settle();

  console.error = consoleError;
}
