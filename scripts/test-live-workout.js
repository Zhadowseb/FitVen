// The lock-screen card during a strength workout: the state it is drawn from,
// the rules both native sides draw it and change it by, and the service that
// keeps it in step with the workout.
//
// The mistakes this pins are the ones nobody sees until they are at the gym
// with the phone locked: a card for a workout that was finished, a set ticked
// off twice, a rest that restarts when the app opens, the card jumping back to
// the first exercise, the Swift copies of the state drifting apart, a word on
// the card that is only in one language.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const live = loadAppModule("src/Utils/liveWorkout.js");
const restEvents = loadAppModule("src/Utils/restTimerEvents.js");
const da = loadAppModule("src/Localization/locales/da/liveWorkout.js").default;
const en = loadAppModule("src/Localization/locales/en/liveWorkout.js").default;

const NOW = 1790435000;
// t() over the Danish file, the way the app would with Danish chosen.
const t = (key) => {
  const [area, name] = key.split(".");

  assert.strictEqual(area, "liveWorkout", `the card reads ${key}, outside its own area`);
  assert.ok(name in da, `liveWorkout.${name} is missing in Danish`);

  return da[name];
};
const formatNumber = (value) => String(value).replace(".", ",");

// Rows as getLiveWorkoutSets returns them.
let nextSetId = 500;
function exercise(exerciseId, name, sets) {
  if (!sets.length) {
    return [{ exercise_instance_id: exerciseId, exercise_name: name, sets_id: null }];
  }

  return sets.map((set, index) => ({
    exercise_instance_id: exerciseId,
    exercise_name: name,
    sets_id: set.id ?? nextSetId++,
    set_number: index + 1,
    reps: set.reps ?? null,
    weight: set.kg ?? null,
    done: set.done ? 1 : 0,
    failed: 0,
    personal_record: 0,
    set_type: set.type ?? "working",
    amrap: 0,
    amrap_target: set.target ?? null,
    pause: set.rest ?? null,
  }));
}

const running = { workoutId: 7, workoutType: "Resistance", timerStart: NOW - 600, elapsedTime: 120 };
const build = (rows, extra = {}) =>
  live.buildLiveWorkoutState(
    { workout: running, rows, restTimer: null, focus: {}, now: NOW, ...extra },
    { t, formatNumber }
  );

// --- The state ----------------------------------------------------------------

{
  const rows = [
    ...exercise(1, "Bænkpres", [
      { id: 11, kg: 100, reps: 5, done: true, rest: 180 },
      { id: 12, kg: 100, reps: 5, done: true, rest: 180 },
      { id: 13, kg: 100, reps: 5, rest: 180 },
      { id: 14, kg: 102.5, reps: 5, rest: 180 },
    ]),
    ...exercise(2, "Skrå håndvægtspres", [{ id: 21, kg: 30, reps: 8, rest: 120 }]),
    ...exercise(3, "Dips", [{ id: 31, reps: 12 }]),
    ...exercise(4, "Tom", []),
  ];
  const state = build(rows);

  assert.strictEqual(state.v, 1);
  assert.strictEqual(state.workoutId, "7");
  // Ten minutes since the clock last started, two banked before: twelve.
  assert.strictEqual(NOW - state.startedAt, 720, "the clock counts from the start, pauses taken out");
  assert.strictEqual(state.pausedElapsed, null);
  assert.strictEqual(state.exercise.name, "Bænkpres");
  assert.strictEqual(state.exercise.index, 1);
  assert.strictEqual(state.exercise.total, 4, "an exercise without sets still counts");
  assert.deepStrictEqual(
    state.exercise.sets.map((set) => [set.id, set.text, set.short, set.done, set.rest]),
    [
      ["11", "100 kg × 5", "100×5", true, 180],
      ["12", "100 kg × 5", "100×5", true, 180],
      ["13", "100 kg × 5", "100×5", false, 180],
      ["14", "102,5 kg × 5", "102,5×5", false, 180],
    ],
    "the weight is formatted in the language's own way"
  );
  assert.strictEqual(state.next.name, "Skrå håndvægtspres");
  assert.strictEqual(state.next.index, 2);
  assert.deepStrictEqual(state.totals, { done: 2, all: 6, exercisesDone: 0 });
  assert.strictEqual(state.canPrev, false);
  assert.strictEqual(state.canNext, true);
  assert.strictEqual(state.rest, null);
  assert.strictEqual(state.strings.complete, "Sæt færdigt");

  // Body weight, and an AMRAP set without reps yet.
  assert.deepStrictEqual(live.formatLiveSet({ reps: 12 }), {
    text: "× 12",
    short: "×12",
    weight: null,
    repsText: "12",
  });
  assert.deepStrictEqual(
    live.formatLiveSet({ weight: 60, set_type: "amrap", amrap_target: 8 }, { decimal: "," }),
    { text: "60 kg × 8+", short: "60×8+", weight: 60, repsText: "8+" }
  );
  assert.deepStrictEqual(live.formatLiveSet({}), { text: "–", short: "–", weight: null, repsText: null });

  // What the weight buttons need: the language's decimal sign, and a step
  // that follows what is on the bar.
  assert.strictEqual(state.decimal, ",");
  assert.strictEqual(state.unit, "kg");
  assert.strictEqual(state.exercise.weightStep, 2.5);
  assert.strictEqual(state.exercise.weightStepText, "2,5");
  assert.strictEqual(state.exercise.sets[3].weight, 102.5);
  assert.strictEqual(state.exercise.sets[3].repsText, "5");
  assert.strictEqual(live.formatLiveWeight(102.5, ","), "102,5");
  assert.strictEqual(live.formatLiveWeight(102.25, ","), "102,25");
  assert.strictEqual(live.formatLiveWeight(100, ","), "100");
  assert.strictEqual(live.formatLiveWeight(1002.5, ","), "1002,5", "no thousands separator");
  assert.strictEqual(live.formatLiveWeight(0.1 + 0.2, "."), "0.3");
  assert.strictEqual(live.roundToQuarter(102.49999), 102.5);
  assert.strictEqual(live.roundToQuarter(0.1 + 0.2), 0.25);
  assert.strictEqual(live.decimalSignOf((value) => value.toLocaleString("en-GB")), ".");
  assert.strictEqual(live.decimalSignOf((value) => value.toLocaleString("da-DK")), ",");
  assert.strictEqual(live.liveWeightStepFor({ name: "Bench Press" }), 2.5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Squat" }), 5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Deadlift" }), 5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Dumbbell Shoulder Press" }), 2);
  assert.strictEqual(live.liveWeightStepFor({ name: "Min øvelse", equipment: "dumbbell" }), 2);
  assert.strictEqual(live.liveWeightStepFor({ name: "Leg Press" }), 5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Min øvelse", equipment: "machine" }), 5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Min øvelse", equipment: "cable" }), 5);
  assert.strictEqual(live.liveWeightStepFor({ name: "Pull-up" }), 2.5);

  // Paused: the clock stands still at what was banked.
  const paused = live.buildLiveWorkoutState(
    { workout: { ...running, timerStart: null, elapsedTime: 1500 }, rows, now: NOW },
    { t, formatNumber }
  );
  assert.strictEqual(paused.pausedElapsed, 1500);
  assert.deepStrictEqual(live.deriveLiveWorkoutView(paused, NOW).clock, { stopped: "25:00" });

  // The rest: its own, still running. Another workout's, or one that ran
  // out, is not on the card.
  const rest = { id: "r", workoutId: 7, startedAt: NOW - 30, endsAt: NOW + 150, durationSeconds: 180 };
  assert.deepStrictEqual(build(rows, { restTimer: rest }).rest, {
    startedAt: NOW - 30,
    endsAt: NOW + 150,
    duration: 180,
  });
  assert.strictEqual(build(rows, { restTimer: { ...rest, workoutId: 8 } }).rest, null);
  assert.strictEqual(build(rows, { restTimer: { ...rest, endsAt: NOW } }).rest, null);

  // Doing exercises out of order: the card stays with the one the last set
  // was ticked off in, while it has sets left.
  const outOfOrder = [
    ...exercise(1, "A", [{ id: 101, kg: 50, reps: 5 }]),
    ...exercise(2, "B", [
      { id: 201, kg: 50, reps: 5, done: true },
      { id: 202, kg: 50, reps: 5 },
    ]),
    ...exercise(3, "C", [{ id: 301, kg: 50, reps: 5 }]),
  ];
  const onB = build(outOfOrder, { focus: { recentSetId: 201 } });
  assert.strictEqual(onB.exercise.name, "B");
  assert.strictEqual(onB.next.name, "C");
  assert.strictEqual(onB.canPrev, true);
  // Without it, the first exercise with a set to do.
  assert.strictEqual(build(outOfOrder).exercise.name, "A");
  // The next one goes round to the start: A was skipped, and comes back.
  const onC = build(outOfOrder, { focus: { recentSetId: 201, viewOffset: 1 } });
  assert.strictEqual(onC.exercise.name, "C");
  assert.strictEqual(onC.next.name, "A");
  assert.strictEqual(onC.canNext, false);
  // Forrige / Næste stop at the ends, and the service keeps the offset there.
  assert.strictEqual(
    live.resolveLiveFocus(live.groupLiveWorkoutRows(outOfOrder), { viewOffset: 9 }).offset,
    2
  );
  assert.strictEqual(
    live.resolveLiveFocus(live.groupLiveWorkoutRows(outOfOrder), { viewOffset: -3 }).offset,
    0
  );

  // Every set done: no exercise, and the card says so.
  const finished = build(exercise(1, "A", [{ id: 1, kg: 1, reps: 1, done: true }]));
  assert.strictEqual(finished.exercise, null);
  assert.strictEqual(live.deriveLiveWorkoutView(finished, NOW).mode, "allDone");
  assert.strictEqual(live.deriveLiveWorkoutView(build([]), NOW).mode, "empty");
}

// Under the 4 KB ActivityKit takes: two exercises of the most sets it carries,
// long names, big numbers, and the English strings.
{
  const many = (exerciseId, name) =>
    exercise(
      exerciseId,
      name,
      Array.from({ length: 30 }, (_, index) => ({ kg: 1002.5, reps: 100, done: index < 8, rest: 300 }))
    );
  const state = live.buildLiveWorkoutState(
    {
      workout: running,
      rows: [...many(1, "Bulgarian split squat with a very long name, left leg"), ...many(2, "X".repeat(80))],
      restTimer: { id: "r", workoutId: 7, startedAt: NOW, endsAt: NOW + 300, durationSeconds: 300 },
      now: NOW,
    },
    { t: (key) => en[key.split(".")[1]], formatNumber }
  );

  assert.strictEqual(state.exercise.sets.length, live.LIVE_WORKOUT_MAX_SETS);
  assert.ok(
    state.exercise.sets.some((set) => !set.done),
    "the window of sets keeps the one to do"
  );
  assert.ok(
    live.liveWorkoutStateBytes(state) < live.LIVE_WORKOUT_MAX_BYTES,
    `the state is ${live.liveWorkoutStateBytes(state)} bytes`
  );
}

// --- Derive -------------------------------------------------------------------

{
  const rows = [
    ...exercise(1, "Bænkpres", [
      { id: 11, kg: 100, reps: 5, done: true, rest: 180 },
      { id: 12, kg: 100, reps: 5, done: true, rest: 180 },
      { id: 13, kg: 100, reps: 5, rest: 180 },
      { id: 14, kg: 100, reps: 5, rest: 180 },
    ]),
    ...exercise(2, "Skrå håndvægtspres", [{ id: 21, kg: 30, reps: 8, rest: 120 }]),
  ];
  const state = build(rows);
  const view = live.deriveLiveWorkoutView(state, NOW);

  assert.strictEqual(view.mode, "set");
  assert.strictEqual(view.nowSetId, "13");
  assert.strictEqual(view.title, "100 kg × 5");
  assert.strictEqual(view.subtitle, "Bænkpres · sæt 3 af 4");
  assert.strictEqual(view.subtitleShort, "Bænkpres · sæt 3/4");
  assert.strictEqual(view.setOfTitle, "Sæt 3 af 4");
  assert.strictEqual(view.eyebrow, "NUVÆRENDE SÆT");
  // The ring counts sets done, and fills with them.
  assert.deepStrictEqual(view.setsRing, { fraction: 0.5, text: "2/4", currentText: "3/4", label: "SÆT" });
  assert.strictEqual(view.exerciseName, "Bænkpres");
  assert.deepStrictEqual(view.exerciseRing, { fraction: 0, text: "1/2", label: "ØVELSE" });
  assert.strictEqual(view.setsCount, "2/5 sæt");
  assert.deepStrictEqual(view.clock, { countsFrom: state.startedAt });
  assert.deepStrictEqual(
    view.buttons.map((button) => [button.type, Boolean(button.primary), button.enabled]),
    [
      ["prev", false, false],
      ["completeSet", true, undefined],
      ["next", false, true],
    ]
  );
  assert.deepStrictEqual(
    view.chips.map((chip) => chip.state),
    ["done", "done", "now", "todo"]
  );
  assert.deepStrictEqual(view.weightButtons, {
    step: 2.5,
    label: "2,5 kg",
    a11yMinus: "Træk 2,5 kg fra sættet",
    a11yPlus: "Læg 2,5 kg til sættet",
    minusEnabled: true,
  });
  assert.strictEqual(view.nextRow.label, "Næste: Skrå håndvægtspres");
  assert.deepStrictEqual(view.nextRow.chips, [{ text: "30×8", state: "todo" }]);

  // Resting: the next set, the countdown and what the rest was.
  const resting = live.deriveLiveWorkoutView(
    { ...state, rest: { startedAt: NOW - 36, endsAt: NOW + 144, duration: 180 } },
    NOW
  );
  assert.strictEqual(resting.mode, "rest");
  assert.strictEqual(resting.title, "Næste: 100 kg × 5");
  assert.strictEqual(resting.subtitle, "Bænkpres · sæt 3 af 4");
  assert.strictEqual(resting.eyebrow, "NÆSTE SÆT");
  assert.strictEqual(resting.weightButtons, null, "no weight buttons while resting");
  assert.deepStrictEqual(resting.rest, { endsAt: NOW + 144, remaining: 144, fraction: 0.8, of: "af 3:00" });
  assert.deepStrictEqual(
    resting.buttons.map((button) => [button.type, button.seconds ?? null, Boolean(button.primary)]),
    [
      ["adjustRest", -15, false],
      ["skipRest", null, true],
      ["adjustRest", 15, false],
    ]
  );
  // A rest that has run out while the card was not told is a set again.
  assert.strictEqual(
    live.deriveLiveWorkoutView({ ...state, rest: { startedAt: NOW - 200, endsAt: NOW - 20, duration: 180 } }, NOW).mode,
    "set"
  );

  // More than six sets: five from two before the one to do, and "+n".
  const sets = Array.from({ length: 9 }, (_, index) => ({ short: `s${index + 1}`, done: index < 4 }));
  assert.deepStrictEqual(
    live.chipsFor(sets, 4).map((chip) => `${chip.text}:${chip.state}`),
    ["s3:done", "s4:done", "s5:now", "s6:todo", "s7:todo", "+4:todo"]
  );
  assert.deepStrictEqual(
    live.chipsFor(sets, 8).map((chip) => chip.text),
    ["s5", "s6", "s7", "s8", "s9", "+4"],
    "the window stops at the end"
  );
  assert.deepStrictEqual(live.chipsFor(sets.slice(0, 6), 4).length, 6);

  assert.strictEqual(live.formatLiveClock(59), "0:59");
  assert.strictEqual(live.formatLiveClock(3725), "1:02:05");
  assert.strictEqual(live.fillTemplate("sæt {n} af {total}", { n: 3, total: 4 }), "sæt 3 af 4");
}

// --- Reducer ------------------------------------------------------------------

{
  const rows = [
    ...exercise(1, "Bænkpres", [
      { id: 11, kg: 100, reps: 5, done: true, rest: 180 },
      { id: 12, kg: 100, reps: 5, rest: 90 },
    ]),
    ...exercise(2, "Dips", [
      { id: 21, reps: 12, rest: 0 },
      { id: 22, reps: 12, rest: 60 },
    ]),
  ];
  const state = build(rows);
  const at = NOW + 0.4;

  // The set that is "now", and nothing else.
  assert.strictEqual(live.applyLiveWorkoutAction(state, { type: "completeSet", setId: "21", at }, NOW), state);

  // The last set of an exercise: done, its rest starts at the tap, and the
  // next exercise takes its place.
  const afterBench = live.applyLiveWorkoutAction(state, { type: "completeSet", setId: "12", at }, NOW);
  assert.deepStrictEqual(afterBench.rest, { startedAt: at, endsAt: at + 90, duration: 90 });
  assert.strictEqual(afterBench.exercise.name, "Dips");
  assert.strictEqual(afterBench.next, null);
  assert.strictEqual(afterBench.canPrev, false);
  assert.strictEqual(afterBench.canNext, false);
  assert.deepStrictEqual(afterBench.totals, { done: 2, all: 4, exercisesDone: 1 });
  assert.strictEqual(state.exercise.sets[1].done, false, "the state it was given is left alone");

  const restView = live.deriveLiveWorkoutView(afterBench, NOW + 1);
  assert.strictEqual(restView.mode, "rest");
  assert.strictEqual(restView.title, "Næste: × 12");

  // Skipping the rest, and a set without a rest after it.
  const skipped = live.applyLiveWorkoutAction(afterBench, { type: "skipRest", at }, NOW + 1);
  assert.strictEqual(skipped.rest, null);
  const afterDip = live.applyLiveWorkoutAction(skipped, { type: "completeSet", setId: "21", at }, NOW + 2);
  assert.strictEqual(afterDip.rest, null, "no rest after a set without one");
  assert.strictEqual(live.deriveLiveWorkoutView(afterDip, NOW + 2).nowSetId, "22");

  // The last set of the workout: every set is done.
  const lastOne = live.applyLiveWorkoutAction(afterDip, { type: "completeSet", setId: "22", at }, NOW + 3);
  assert.strictEqual(lastOne.exercise, null);
  assert.strictEqual(live.deriveLiveWorkoutView(lastOne, NOW + 3).mode, "allDone");
  assert.deepStrictEqual(lastOne.totals, { done: 4, all: 4, exercisesDone: 2 });

  // With the workout clock paused there is no rest.
  const paused = { ...state, pausedElapsed: 300 };
  assert.strictEqual(
    live.applyLiveWorkoutAction(paused, { type: "completeSet", setId: "12", at }, NOW).rest,
    null
  );

  // ±15, and pushed back to now it is over.
  const resting = { ...state, rest: { startedAt: NOW - 10, endsAt: NOW + 20, duration: 30 } };
  assert.deepStrictEqual(
    live.applyLiveWorkoutAction(resting, { type: "adjustRest", seconds: 15, at }, NOW).rest,
    { startedAt: NOW - 10, endsAt: NOW + 35, duration: 45 }
  );
  assert.strictEqual(
    live.applyLiveWorkoutAction(resting, { type: "adjustRest", seconds: -30, at }, NOW).rest,
    null
  );
  // Completing is not possible while resting; the card shows Spring over.
  assert.strictEqual(
    live.applyLiveWorkoutAction(resting, { type: "completeSet", setId: "12", at }, NOW),
    resting
  );
  // The weight buttons: the set that is "now", a step at a time, to the
  // nearest quarter, never below zero - and its words follow.
  const plus = (current, delta = 2.5) =>
    live.applyLiveWorkoutAction(current, { type: "adjustWeight", setId: "12", delta, at }, NOW);
  const heavier = plus(state);
  assert.strictEqual(heavier.exercise.sets[1].weight, 102.5);
  assert.strictEqual(heavier.exercise.sets[1].text, "102,5 kg × 5");
  assert.strictEqual(heavier.exercise.sets[1].short, "102,5×5");
  assert.strictEqual(live.deriveLiveWorkoutView(heavier, NOW).title, "102,5 kg × 5");
  assert.strictEqual(heavier.exercise.sets[0].weight, 100, "only the set that is now");
  assert.strictEqual(plus(heavier).exercise.sets[1].weight, 105, "presses add up");
  assert.strictEqual(plus(state, 0.1 + 0.2).exercise.sets[1].weight, 100.25);
  assert.strictEqual(
    live.applyLiveWorkoutAction(state, { type: "adjustWeight", setId: "11", delta: 2.5, at }, NOW),
    state,
    "a set that is not now is left alone"
  );
  const light = { ...state, exercise: { ...state.exercise, sets: state.exercise.sets.map((set, index) => (index === 1 ? { ...set, weight: 1, text: "1 kg × 5", short: "1×5" } : set)) } };
  const empty = plus(light, -2.5);
  assert.strictEqual(empty.exercise.sets[1].weight, 0, "never below an empty bar");
  assert.strictEqual(empty.exercise.sets[1].text, "0 kg × 5");
  assert.strictEqual(live.deriveLiveWorkoutView(empty, NOW).weightButtons.minusEnabled, false);
  assert.strictEqual(plus(empty, -2.5), empty, "at zero, minus does nothing");
  assert.strictEqual(
    live.applyLiveWorkoutAction(resting, { type: "adjustWeight", setId: "12", delta: 2.5, at }, NOW),
    resting,
    "not while resting"
  );
  // Sæt færdigt after a weight button keeps the new weight.
  const doneHeavier = live.applyLiveWorkoutAction(heavier, { type: "completeSet", setId: "12", at }, NOW);
  assert.strictEqual(doneHeavier.exercise.name, "Dips");
  assert.strictEqual(doneHeavier.totals.done, 2);
  // Body weight: no buttons, and nothing to move.
  const onDips = live.deriveLiveWorkoutView(afterBench, NOW + 200);
  assert.strictEqual(onDips.nowSetId, "21");
  assert.strictEqual(onDips.weightButtons, null, "no weight buttons for body weight");
  assert.strictEqual(
    live.applyLiveWorkoutAction(skipped, { type: "adjustWeight", setId: "21", delta: 2.5, at }, NOW + 1),
    skipped
  );
  // An AMRAP target keeps its plus.
  assert.deepStrictEqual(
    live.composeLiveSetText(62.5, "8+", { decimal: ",", unit: "kg" }),
    { text: "62,5 kg × 8+", short: "62,5×8+" }
  );

  // Forrige / Næste are JavaScript's; the card does not move by itself.
  assert.strictEqual(live.applyLiveWorkoutAction(state, { type: "next", at }, NOW), state);
  assert.strictEqual(live.applyLiveWorkoutAction(state, { type: "prev", at }, NOW), state);
}

// --- The rest timer's ±15 -----------------------------------------------------

{
  const now = Math.floor(Date.now() / 1000);
  const timer = restEvents.startActiveRestTimer({ workoutId: 7, setId: 12, durationSeconds: 60, startedAt: now });
  const moved = restEvents.adjustActiveRestTimer(15);

  assert.strictEqual(moved.id, timer.id, "the same rest, moved");
  assert.strictEqual(moved.endsAt, timer.endsAt + 15);
  assert.strictEqual(moved.durationSeconds, 75);
  assert.strictEqual(restEvents.adjustActiveRestTimer(-200), null, "pushed back past now, it is over");
  assert.strictEqual(restEvents.getActiveRestTimer(), null);
}

// --- The words -----------------------------------------------------------------

{
  // What the card fills in on the phone has to be there in both languages.
  const placeholders = (text) => (String(text).match(/\{[a-z]+\}/g) ?? []).sort();

  assert.deepStrictEqual(Object.keys(da).sort(), Object.keys(en).sort());

  for (const key of Object.keys(da)) {
    assert.deepStrictEqual(placeholders(da[key]), placeholders(en[key]), `liveWorkout.${key}`);
  }

  for (const key of Object.keys(live.liveWorkoutStrings((name) => name))) {
    assert.ok(key in da, `the card sends strings.${key}, which has no translation`);
  }
}

// --- The Swift copies of the state ------------------------------------------------
//
// The pod starts the Live Activity; the widget draws it and its buttons run in
// the app. ActivityKit matches the two by the type's name, so the copies have
// to be the same type, byte for byte, between the markers.

{
  const between = (text) => {
    const match = text.match(/\/\/ BEGIN LiveWorkoutAttributes\r?\n([\s\S]*?)\/\/ END LiveWorkoutAttributes/);

    return match ? match[1].replace(/\r\n/g, "\n") : null;
  };
  const swiftFiles = (dir) =>
    fs.existsSync(path.join(root, dir))
      ? fs
          .readdirSync(path.join(root, dir))
          .filter((name) => name.endsWith(".swift"))
          .map((name) => `${dir}/${name}`)
      : [];
  const copies = [...swiftFiles("targets/widgets/_shared"), ...swiftFiles("modules/live-workout/ios")]
    .map((file) => ({ file, body: between(read(file)) }))
    .filter((copy) => copy.body !== null);

  assert.strictEqual(copies.length, 2, `two copies of LiveWorkoutAttributes, found ${copies.map((copy) => copy.file)}`);
  assert.strictEqual(copies[0].body, copies[1].body, `${copies[0].file} and ${copies[1].file} have drifted apart`);
}

// --- The wiring -------------------------------------------------------------------

{
  // Every local write to a set, an exercise or a workout ends in one of these,
  // and the card hears it there.
  for (const [file, fn] of [
    ["src/Services/cloudSync/setSync.js", "syncSetsInBackground"],
    ["src/Services/cloudSync/exerciseInstanceSync.js", "syncExerciseInstancesInBackground"],
    ["src/Services/cloudSync/workoutTypeInstanceSync.js", "syncWorkoutTypeInstancesInBackground"],
  ]) {
    assert.match(
      read(file),
      new RegExp(`export function ${fn}\\(db\\) \\{\\s*notifyWorkoutDataChanged\\(`),
      `${fn} no longer tells the lock-screen card`
    );
  }

  // The rest reminder is for a phone that is away.
  assert.match(
    read("src/Services/notificationService.js"),
    /data\?\.kind === REST_FINISHED_NOTIFICATION_KIND\) \{\s*return \{\s*shouldPlaySound: false,\s*shouldSetBadge: false,\s*shouldShowBanner: false,\s*shouldShowList: false/,
    "with the app in front, the rest reminder is shown anyway"
  );

  // A set ticked off, or its weight moved, on the lock screen reaches the
  // workout screen.
  assert.match(
    read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js"),
    /subscribeLockScreenEdits\(\(edit\) => \{\s*if \(Number\(edit\?\.workoutId\) === Number\(workout_id\)\)/
  );
}

// --- The service --------------------------------------------------------------------

(async () => {
  const storage = new Map();
  const nativeCalls = [];
  let queued = [];
  let actionListener = null;
  let appStateListener = null;
  let supported = true;
  let dismissedOnIos = false;
  const fakeNative = {
    isSupported: () => supported,
    start: async (json) => {
      nativeCalls.push(["start", JSON.parse(json)]);
      dismissedOnIos = false;
      return true;
    },
    update: async (json) => {
      nativeCalls.push(["update", JSON.parse(json)]);
      return !dismissedOnIos;
    },
    end: async () => {
      nativeCalls.push(["end"]);
    },
    drainActions: async () => {
      const json = JSON.stringify(queued);

      queued = [];
      return json;
    },
    addListener: (event, listener) => {
      assert.strictEqual(event, "onLiveWorkoutAction");
      actionListener = listener;
      return { remove() {} };
    },
  };
  const scheduled = [];

  loadAppModule.stubModule("expo", { requireOptionalNativeModule: () => fakeNative });
  loadAppModule.stubModule("react-native", {
    Platform: { OS: "ios" },
    AppState: {
      addEventListener: (event, listener) => {
        appStateListener = listener;
        return { remove() {} };
      },
    },
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
  loadAppModule.stubModule("expo-notifications", {
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({ status: "granted" }),
    scheduleNotificationAsync: async (request) => {
      scheduled.push(request);
      return `n${scheduled.length}`;
    },
    cancelScheduledNotificationAsync: async (id) => {
      scheduled.push({ cancelled: id });
    },
    setNotificationChannelAsync: async () => {},
    SchedulableTriggerInputTypes: { DATE: "date" },
    AndroidImportance: { HIGH: 4 },
    IosAuthorizationStatus: {},
  });
  loadAppModule.stubModule("expo-constants", { default: {} });
  // Loaded behind notificationService; never reached.
  loadAppModule.stubModule("@supabase/supabase-js", {
    createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }),
    processLock: () => {},
  });
  loadAppModule.stubModule("react-native-url-polyfill/auto", {});
  loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
  loadAppModule.stubModule("expo-secure-store", {});
  loadAppModule.stubModule("expo-location", {});

  const service = loadAppModule("src/Services/liveWorkoutService.js");
  const dataEvents = loadAppModule("src/Utils/workoutDataEvents.js");
  const rest = loadAppModule("src/Utils/restTimerEvents.js");
  const now = () => Math.floor(Date.now() / 1000);

  // A database with one table's worth of each: the open strength workouts,
  // and the sets of workout 7.
  const db = {
    workouts: [],
    rows: [],
    async getAllAsync(sql) {
      if (sql.includes("PRAGMA table_info")) return [{ name: "exercise_order" }];
      if (sql.includes("original_start_time IS NOT NULL")) return this.workouts;
      if (sql.includes('LEFT JOIN "Set" s')) return this.rows;
      throw new Error(`unexpected query: ${sql.slice(0, 80)}`);
    },
    async execAsync() {},
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 380));
  const workoutRow = (overrides = {}) => ({
    workout_id: 7,
    workout_type: "Resistance",
    label: "Push",
    date: "2026-09-27",
    original_start_time: now() - 900,
    timer_start: now() - 900,
    elapsed_time: 0,
    ...overrides,
  });

  db.rows = exercise(1, "Bænkpres", [
    { id: 71, kg: 100, reps: 5, rest: 120 },
    { id: 72, kg: 100, reps: 5, rest: 120 },
  ]);

  // Nothing running at launch: whatever card was left behind goes.
  const stop = service.startLiveWorkoutController(db);
  await settle();
  assert.deepStrictEqual(nativeCalls, [["end"]], "a card from before the app was killed is taken away");

  // A workout starts: one start, then updates.
  nativeCalls.length = 0;
  db.workouts = [workoutRow()];
  dataEvents.notifyWorkoutDataChanged("workouts");
  dataEvents.notifyWorkoutDataChanged("sets");
  await settle();
  assert.deepStrictEqual(nativeCalls.map(([call]) => call), ["start"], "several signals, one start");
  assert.strictEqual(nativeCalls[0][1].exercise.name, "Bænkpres");

  // Nothing changed: nothing sent.
  nativeCalls.length = 0;
  dataEvents.notifyWorkoutDataChanged("sets");
  await settle();
  assert.deepStrictEqual(nativeCalls, []);

  // The rest starts: an update with it, and the reminder scheduled for its end.
  const timer = rest.startActiveRestTimer({ workoutId: 7, setId: 71, durationSeconds: 120, startedAt: now() });
  await settle();
  assert.deepStrictEqual(nativeCalls.map(([call]) => call), ["update"]);
  assert.strictEqual(nativeCalls[0][1].rest.endsAt, timer.endsAt);
  assert.strictEqual(scheduled.length, 1);
  assert.strictEqual(scheduled[0].trigger.date.getTime(), timer.endsAt * 1000);
  assert.strictEqual(scheduled[0].content.data.kind, "restFinished");

  // +15 on the lock screen: drained, done, and the reminder moved with it.
  nativeCalls.length = 0;
  queued = [{ id: "a1", type: "adjustRest", seconds: 15, at: now() }];
  actionListener({ type: "adjustRest" });
  await settle();
  assert.strictEqual(rest.getActiveRestTimer().endsAt, timer.endsAt + 15);
  assert.deepStrictEqual(scheduled.slice(1).map((entry) => entry.cancelled ?? "scheduled"), ["n1", "scheduled"]);
  assert.strictEqual(nativeCalls.at(-1)[1].rest.endsAt, timer.endsAt + 15);

  // Spring over: the rest is cleared, and so is the reminder.
  queued = [{ id: "a2", type: "skipRest", at: now() }];
  actionListener({ type: "skipRest" });
  await settle();
  assert.strictEqual(rest.getActiveRestTimer(), null);
  assert.deepStrictEqual(scheduled.at(-1), { cancelled: "n3" });

  // Næste, tapped just now, moves the card; one tapped long ago does not.
  db.rows = [
    ...exercise(1, "Bænkpres", [{ id: 71, kg: 100, reps: 5 }]),
    ...exercise(2, "Dips", [{ id: 81, reps: 12 }]),
  ];
  dataEvents.notifyWorkoutDataChanged("sets");
  await settle();
  nativeCalls.length = 0;
  queued = [{ id: "a3", type: "next", at: now() - 300 }];
  actionListener({ type: "next" });
  await settle();
  assert.ok(
    nativeCalls.every(([, state]) => state.exercise.name === "Bænkpres"),
    "a Næste from five minutes ago moved the card"
  );
  queued = [{ id: "a4", type: "next", at: now() }];
  actionListener({ type: "next" });
  await settle();
  assert.strictEqual(nativeCalls.at(-1)[1].exercise.name, "Dips");

  // Ticking off an already-done set from the lock screen does nothing - no
  // write, and no second rest.
  db.rows = exercise(1, "Bænkpres", [{ id: 71, kg: 100, reps: 5, done: true, rest: 120 }, { id: 72, kg: 100, reps: 5 }]);
  queued = [{ id: "a5", type: "completeSet", setId: "71", at: now() }];
  actionListener({ type: "completeSet" });
  await settle();
  assert.strictEqual(rest.getActiveRestTimer(), null);

  // The card is swiped away on iOS: update does not bring it back, and it is
  // not started again while this workout runs - not even after a relaunch.
  dismissedOnIos = true;
  nativeCalls.length = 0;
  db.rows = exercise(1, "Bænkpres", [{ id: 71, kg: 100, reps: 5, done: true }, { id: 72, kg: 100, reps: 6 }]);
  dataEvents.notifyWorkoutDataChanged("sets");
  await settle();
  assert.deepStrictEqual(nativeCalls.map(([call]) => call), ["update"]);

  // Finished: the card goes at once.
  nativeCalls.length = 0;
  db.workouts = [];
  dataEvents.notifyWorkoutDataChanged("workouts");
  await settle();
  assert.deepStrictEqual(nativeCalls, [["end"]]);

  // Reset and started again under the same id: a new card.
  nativeCalls.length = 0;
  db.workouts = [workoutRow()];
  dataEvents.notifyWorkoutDataChanged("workouts");
  await settle();
  assert.deepStrictEqual(nativeCalls.map(([call]) => call), ["start"]);

  // A paused workout from yesterday is not being trained.
  nativeCalls.length = 0;
  db.workouts = [workoutRow({ original_start_time: now() - 9 * 3600, timer_start: null, elapsed_time: 3000 })];
  dataEvents.notifyWorkoutDataChanged("workouts");
  await settle();
  assert.deepStrictEqual(nativeCalls, [["end"]]);

  // Switched off in settings: no card; back on, and it returns for the workout.
  db.workouts = [workoutRow()];
  await service.setLockScreenCardEnabled(false);
  await settle();
  nativeCalls.length = 0;
  dataEvents.notifyWorkoutDataChanged("workouts");
  await settle();
  assert.deepStrictEqual(nativeCalls, []);
  await service.setLockScreenCardEnabled(true);
  await settle();
  assert.deepStrictEqual(nativeCalls.map(([call]) => call), ["start"]);

  // Coming back to the app drains what was tapped while it was away.
  queued = [{ id: "a6", type: "prev", at: now() }];
  appStateListener("active");
  await settle();
  assert.deepStrictEqual(queued, []);

  // Signed out: the card goes with the database.
  nativeCalls.length = 0;
  stop();
  await settle();
  assert.deepStrictEqual(nativeCalls, [["end"]]);

  // --- The writes, against the real schema --------------------------------
  //
  // What a tap on the card finally does to the sets, through the same
  // service calls the workout screen makes: a weight moved and then Sæt
  // færdigt saves the set once, with the new weight; a tap handled twice
  // changes nothing; an edit made in the app after the tap wins.
  const { DatabaseSync } = require("node:sqlite");
  const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
  const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  const realDb = {
    databasePath: ":memory:live-workout",
    getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql, params = []) => raw.prepare(sql).get(...params) ?? null,
    runAsync: async (sql, params = []) => {
      const result = raw.prepare(sql).run(...params);

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    execAsync: async (sql) => raw.exec(sql),
  };
  const started = now() - 600;

  raw
    .prepare(
      `INSERT INTO Workout_Type_Instance
         (workout_id, day_id, date, workout_type, label, done, is_active, original_start_time, timer_start, elapsed_time)
       VALUES (70, 1, '2026-09-27', 'Resistance', 'Push', 0, 1, ?, ?, 0)`
    )
    .run(started, started);
  raw
    .prepare(
      `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, sets)
       VALUES (1, 70, 'Bench Press', 1, 2), (2, 70, 'Dumbbell Row', 2, 1)`
    )
    .run();
  raw
    .prepare(
      `INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, weight, reps, pause, done, sync_version)
       VALUES (901, 1, 1, 100, 5, 120, 0, 0), (902, 1, 2, 100, 5, 120, 0, 0), (903, 2, 1, 30, 8, 90, 0, 0)`
    )
    .run();

  const setRow = (setId) => raw.prepare('SELECT weight, done, sync_version FROM "Set" WHERE sets_id = ?').get(setId);
  const edits = [];
  const stopEdits = dataEvents.subscribeLockScreenEdits((edit) => edits.push(edit));

  nativeCalls.length = 0;
  storage.clear();
  const stopReal = service.startLiveWorkoutController(realDb);
  await settle();

  const startedState = nativeCalls.find(([call]) => call === "start")?.[1];
  assert.ok(startedState, "the real database's running workout got no card");
  assert.strictEqual(startedState.exercise.name, "Bench Press");
  assert.strictEqual(startedState.exercise.weightStep, 2.5);
  assert.strictEqual(startedState.next.weightStep, 2, "dumbbells move by 2");

  // +2,5 twice on the card (merged into one entry with the final weight),
  // then Sæt færdigt.
  const tappedAt = now();
  queued = [
    { id: "w1", type: "adjustWeight", setId: "901", weight: 105, at: tappedAt },
    { id: "c1", type: "completeSet", setId: "901", at: tappedAt },
  ];
  actionListener({ type: "completeSet" });
  await settle();
  assert.strictEqual(setRow(901).weight, 105, "the set was not saved with the new weight");
  assert.strictEqual(setRow(901).done, 1);
  assert.strictEqual(setRow(902).weight, 100, "another set's weight moved");
  assert.deepStrictEqual(edits, [{ workoutId: 70 }], "the workout screen was not told");
  const timerAfterComplete = loadAppModule("src/Utils/restTimerEvents.js").getActiveRestTimer();
  assert.ok(timerAfterComplete, "Sæt færdigt started no rest");
  assert.strictEqual(timerAfterComplete.startedAt, tappedAt, "the rest starts when the button was tapped");
  assert.strictEqual(timerAfterComplete.durationSeconds, 120);

  // The same taps handled again: nothing changes, and no second rest.
  const versionBefore = setRow(901).sync_version;
  queued = [
    { id: "w1", type: "adjustWeight", setId: "901", weight: 105, at: tappedAt },
    { id: "c1", type: "completeSet", setId: "901", at: tappedAt },
  ];
  actionListener({ type: "completeSet" });
  await settle();
  assert.strictEqual(setRow(901).sync_version, versionBefore, "a tap handled twice wrote the set again");
  assert.strictEqual(
    loadAppModule("src/Utils/restTimerEvents.js").getActiveRestTimer().id,
    timerAfterComplete.id,
    "a tap handled twice started a second rest"
  );
  assert.strictEqual(edits.length, 1);

  // Edited in the app after the tap: the app wins.
  raw.prepare('UPDATE "Set" SET weight = 97.5, sync_version = ? WHERE sets_id = 902').run(now() + 60);
  queued = [{ id: "w2", type: "adjustWeight", setId: "902", weight: 102.5, at: now() }];
  actionListener({ type: "adjustWeight" });
  await settle();
  assert.strictEqual(setRow(902).weight, 97.5, "a tap overwrote an edit made after it");

  // A weight that is not a weight is ignored.
  queued = [{ id: "w3", type: "adjustWeight", setId: "903", weight: -5, at: now() + 120 }];
  actionListener({ type: "adjustWeight" });
  await settle();
  assert.strictEqual(setRow(903).weight, 30);

  stopEdits();
  stopReal();
  await settle();

  console.log(
    "Live workout: the state, its size, the view and the taps both native sides mirror, ±15 on the rest, the words in both languages, the Swift copies, the wiring, and the card's life from start to sign-out passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
