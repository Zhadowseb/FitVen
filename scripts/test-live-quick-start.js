// The Quick start panel on Home while a workout is running: which view it
// shows, the set it talks about, its bars, the rest countdown, the elapsed
// time - and the wiring from the workout screen's tick-off to Home.
//
// The mistakes this pins are the quiet ones: a "finished" panel in the middle
// of a workout that is filled as you go, a rest that is still counting after
// it was cancelled, a record celebrated for the wrong set, or the wrong set
// shown as next because the panel and the workout screen order them apart.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const live = loadAppModule("src/Utils/liveQuickStart.js");
const events = loadAppModule("src/Utils/workoutSetEvents.js");

// Rows as the repository returns them: one per set, in the workout screen's
// order, and a row with no set for an exercise without any.
let nextSetId = 100;
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
    failed: set.failed ? 1 : 0,
    personal_record: set.pr ? 1 : 0,
    set_type: set.type ?? "working",
    amrap: 0,
    amrap_target: set.target ?? null,
  }));
}

const bench = (done = []) =>
  exercise(1, "Bænkpres", [
    { id: 1, reps: 8, kg: 80, done: done.includes(1) },
    { id: 2, reps: 8, kg: 80, done: done.includes(2) },
    { id: 3, reps: 8, kg: 82.5, done: done.includes(3) },
    { id: 4, reps: 6, kg: 82.5, done: done.includes(4) },
  ]);
const incline = (done = []) =>
  exercise(2, "Skrå håndvægtspres", [
    { id: 5, reps: 10, kg: 30, done: done.includes(5) },
    { id: 6, reps: 10, kg: 30, done: done.includes(6) },
    { id: 7, reps: 9, kg: 30, done: done.includes(7) },
  ]);
const plan = (done = []) => [...bench(done), ...incline(done)];

/* ------------------------------------------------------- the progress -- */

{
  const progress = live.buildLiveWorkoutProgress(plan());

  assert.strictEqual(progress.totalSets, 7);
  assert.strictEqual(progress.doneSets, 0);
  assert.strictEqual(progress.remaining, 7);
  assert.strictEqual(progress.next.setId, 1);
  assert.strictEqual(progress.next.name, "Bænkpres");
  assert.strictEqual(progress.next.index, 0);
  assert.strictEqual(progress.next.count, 4, "the bars are the exercise's sets, not the workout's");
  assert.deepStrictEqual(progress.next.doneFlags, [false, false, false, false]);
  assert.strictEqual(progress.next.reps, 8);
  assert.strictEqual(progress.next.weight, 80);
  assert.strictEqual(progress.lastDone, null);
}

{
  const progress = live.buildLiveWorkoutProgress(plan([1, 2, 3, 4]));

  assert.strictEqual(progress.next.setId, 5, "the next set is the next exercise's first");
  assert.strictEqual(progress.next.name, "Skrå håndvægtspres");
  assert.deepStrictEqual(progress.next.doneFlags, [false, false, false], "the bars start again at the next exercise");
  assert.strictEqual(progress.lastDone.setId, 4);
}

// Out of order: the first set not done is next, and the bars show what is done.
{
  const progress = live.buildLiveWorkoutProgress(plan([1, 3]));

  assert.strictEqual(progress.next.setId, 2);
  assert.deepStrictEqual(progress.next.doneFlags, [true, false, true, false]);
  assert.strictEqual(progress.lastDone.setId, 3, "with no word from the screen, the last done in order");
  assert.strictEqual(
    live.buildLiveWorkoutProgress(plan([1, 3]), { recentSetId: 1 }).lastDone.setId,
    1,
    "the set the workout screen just reported is the one finished last"
  );
  assert.strictEqual(
    live.buildLiveWorkoutProgress(plan([1, 3]), { recentSetId: 2 }).lastDone.setId,
    3,
    "a reported set that is not done does not count as finished"
  );
}

// Warm-ups come first, as the workout screen lists them.
{
  const rows = exercise(9, "Squat", [
    { id: 90, reps: 5, kg: 100 },
    { id: 91, reps: 10, kg: 40, type: "warmup" },
  ]);
  const progress = live.buildLiveWorkoutProgress(rows);

  assert.strictEqual(progress.next.setId, 91, "the warm-up the screen shows first is not the one shown next");
  assert.strictEqual(progress.next.setType, "warmup");
}

// A record only counts when it is done and not failed.
{
  const rows = exercise(3, "Dødløft", [
    { id: 30, reps: 5, kg: 140, done: true, pr: true },
    { id: 31, reps: 5, kg: 145, done: true, failed: true, pr: true },
  ]);
  const progress = live.buildLiveWorkoutProgress(rows, { recentSetId: 30 });

  assert.strictEqual(progress.lastDone.personalRecord, true);
  assert.strictEqual(
    live.buildLiveWorkoutProgress(rows, { recentSetId: 31 }).lastDone.personalRecord,
    false,
    "a failed set was celebrated as a record"
  );
}

// The latest set: the last exercise and its last set.
{
  const rows = [...bench([1, 2, 3, 4]), ...exercise(8, "Kabelflyes", [{ id: 80, reps: 12, kg: 17.5, done: true }])];
  const progress = live.buildLiveWorkoutProgress(rows);

  assert.strictEqual(progress.next, null);
  assert.strictEqual(progress.latest.name, "Kabelflyes");
  assert.strictEqual(progress.latest.setId, 80);
  assert.strictEqual(progress.latest.weight, 17.5);
}

// An exercise with no sets is still there, by name.
{
  const progress = live.buildLiveWorkoutProgress(exercise(4, "Pull-ups", []));

  assert.strictEqual(progress.totalSets, 0);
  assert.strictEqual(progress.latest.name, "Pull-ups");
  assert.strictEqual(progress.latest.setId, null);
  assert.strictEqual(live.buildLiveWorkoutProgress([]).latest, null);
}

/* ------------------------------------------------------------ planned -- */

assert.strictEqual(live.isPlannedWorkout({ remaining: 7 }), true);
assert.strictEqual(live.isPlannedWorkout({ remaining: 1 }), false, "one set waiting is a workout filled as you go");
assert.strictEqual(live.isPlannedWorkout({ remaining: 0 }, true), true, "a planned workout stays planned");
assert.strictEqual(live.isPlannedWorkout(null), false);

/* -------------------------------------------------------------- views -- */

const view = (progressRows, options = {}) =>
  live.resolveLiveView({ progress: live.buildLiveWorkoutProgress(progressRows), ...options });

assert.strictEqual(view(plan()), "first", "no set done yet");
assert.strictEqual(view(plan([1])), "next");
assert.strictEqual(view(plan([1]), { resting: true }), "rest");
assert.strictEqual(view(plan([1]), { ready: true }), "ready");
assert.strictEqual(view(plan([1]), { resting: true, ready: true }), "rest", "a new rest wins over the last one being over");
assert.strictEqual(view(plan([1]), { resting: true, record: { setId: 1 } }), "record", "a record holds the panel");
assert.strictEqual(view(plan([1, 2, 3, 4, 5, 6, 7]), { planned: true }), "finished");
assert.strictEqual(
  view(plan([1, 2, 3, 4, 5, 6, 7]), { planned: true, resting: true }),
  "finished",
  "a planned workout with every set done is finished, rest or not"
);
assert.strictEqual(
  view(plan([1, 2, 3, 4, 5, 6, 7]), { planned: false }),
  "latest",
  "a workout filled as you go was told it was finished between two sets"
);
assert.strictEqual(
  view(plan([1, 2, 3, 4, 5, 6, 7]), { planned: false, resting: true }),
  "rest",
  "filled as you go, the rest still counts down"
);
assert.strictEqual(view([]), "latest", "an empty workout shows what there is");
assert.strictEqual(view(exercise(4, "Pull-ups", []), { planned: true }), "latest", "no sets at all is not finished");

// The set beside the view, and whether it carries "Next".
{
  const first = live.buildLiveWorkoutProgress(plan());
  const middle = live.buildLiveWorkoutProgress(plan([1]));
  const over = live.buildLiveWorkoutProgress(plan([1, 2, 3, 4, 5, 6, 7]));

  assert.deepStrictEqual(
    [live.focusSetFor("first", first).kicker, live.focusSetFor("next", middle).kicker, live.focusSetFor("rest", middle).kicker],
    [false, true, true],
    "the first view has no kicker; next and rest do"
  );
  assert.strictEqual(live.focusSetFor("latest", over).set.setId, 7);
  assert.strictEqual(live.focusSetFor("latest", over).kicker, false, "the latest set is not next");
  assert.strictEqual(live.focusSetFor("rest", over).isNext, false);
}

// One bar per set of the exercise; done filled, the next one glowing.
{
  const progress = live.buildLiveWorkoutProgress(plan([1, 2]));
  const bars = live.setBars(progress.next);

  assert.deepStrictEqual(
    bars.map((bar) => [bar.filled, bar.now]),
    [
      [true, false],
      [true, false],
      [false, true],
      [false, false],
    ]
  );
  assert.ok(
    live.setBars(live.buildLiveWorkoutProgress(plan([1, 2, 3, 4, 5, 6, 7])).latest, { isNext: false }).every(
      (bar) => bar.filled && !bar.now
    ),
    "the latest set's bars glow as if one were next"
  );
  assert.deepStrictEqual(live.setBars(null), []);
}

// The bars that filled in while Home was out of sight fill in when seen.
{
  const before = live.buildLiveWorkoutProgress(plan([1])).next;
  const after = live.buildLiveWorkoutProgress(plan([1, 2])).next;
  const nextExercise = live.buildLiveWorkoutProgress(plan([1, 2, 3, 4])).next;

  assert.deepStrictEqual(live.newlyFilledBars(before, after), [1]);
  assert.deepStrictEqual(live.newlyFilledBars(after, after), []);
  assert.deepStrictEqual(live.newlyFilledBars(null, after), [], "the first look fills nothing in");
  assert.deepStrictEqual(live.newlyFilledBars(after, nextExercise), [], "a new exercise starts its bars again");
}

/* ------------------------------------------------------ rest and clock -- */

{
  const timer = { id: "t", workoutId: 5, durationSeconds: 90, startedAt: 1000, endsAt: 1090 };

  assert.deepStrictEqual(live.restCountdown(timer, 1000), { remaining: 90, duration: 90, fraction: 1, pops: false });
  assert.strictEqual(live.restCountdown(timer, 1045).fraction, 0.5, "the background drains with the rest");
  assert.strictEqual(live.restCountdown(timer, 1081).pops, true, "the last ten seconds pop");
  assert.strictEqual(live.restCountdown(timer, 1079).pops, false);
  assert.strictEqual(live.restCountdown(timer, 1100).remaining, 0);
  assert.strictEqual(live.restCountdown(timer, 1100).pops, false);
  assert.strictEqual(live.restCountdown(null, 1000), null);

  assert.strictEqual(live.restRanOut(timer, 1090), true, "a rest cleared at its end ran out");
  assert.strictEqual(live.restRanOut(timer, 1089), true, "a second early is still the end");
  assert.strictEqual(live.restRanOut(timer, 1040), false, "a cancelled rest is not over");
}

// The same sum as the bottom navigation's centre timer.
assert.strictEqual(live.liveElapsedSeconds({ timerStart: 1000, elapsedTime: 600 }, 1453), 1053);
assert.strictEqual(live.liveElapsedSeconds({ timerStart: null, elapsedTime: 600 }, 1453), 600, "a paused workout");
assert.strictEqual(
  live.liveElapsedSeconds({ timerStart: 1700000000000, elapsedTime: 0 }, 1700000060),
  60,
  "a start stored in milliseconds"
);
assert.strictEqual(live.liveElapsedSeconds({ timerStart: 2000, elapsedTime: 0 }, 1000), 0, "a clock behind the start");

/* ------------------------------------------------------------ the set -- */

assert.deepStrictEqual(live.setLineParts({ reps: 8, weight: 80, setType: "working" }), {
  kind: "both",
  reps: "8",
  weight: 80,
});
assert.deepStrictEqual(live.setLineParts({ reps: 12, weight: null, setType: "working" }), {
  kind: "reps",
  reps: "12",
  weight: null,
  count: 12,
});
assert.strictEqual(live.setLineParts({ reps: null, weight: 60, setType: "working" }).kind, "weight");
assert.strictEqual(live.setLineParts({ reps: null, weight: null }).kind, "none");
assert.strictEqual(live.setLineParts({ reps: 8, weight: 0 }).kind, "reps", "no weight is not 0 kg");
assert.strictEqual(
  live.setLineParts({ reps: null, weight: 80, setType: "amrap", amrapTarget: 6 }).reps,
  "6+",
  "an AMRAP set is its target and more"
);
assert.strictEqual(live.setLineParts(null).kind, "none");

/* ----------------------------------------------------------- a record -- */

{
  const rows = exercise(3, "Dødløft", [
    { id: 30, reps: 5, kg: 140, done: true, pr: true },
    { id: 32, reps: 5, kg: 140 },
  ]);
  const progress = live.buildLiveWorkoutProgress(rows, { recentSetId: 30 });

  assert.strictEqual(live.pendingRecordFor(progress, 30).setId, 30);
  assert.strictEqual(live.pendingRecordFor(progress, 30, new Set([30])), null, "a record was celebrated twice");
  assert.strictEqual(
    live.pendingRecordFor(live.buildLiveWorkoutProgress(rows), null),
    null,
    "a record from before the app started was celebrated as new"
  );
  assert.strictEqual(
    live.pendingRecordFor(live.buildLiveWorkoutProgress(plan([1]), { recentSetId: 1 }), 1),
    null,
    "a set that was no record was celebrated"
  );
}

assert.strictEqual(live.RECORD_HOLD_MS, 3200);

const tones = { fire: "#fire", record: "#gold", finished: "#green" };

assert.strictEqual(live.livePanelTone("record", tones), "#gold");
assert.strictEqual(live.livePanelTone("finished", tones), "#green");
for (const name of ["first", "rest", "ready", "next", "latest"]) {
  assert.strictEqual(live.livePanelTone(name, tones), "#fire", `${name} is not in the fire's colour`);
}

/* ---------------------------------------------------------- the event -- */

{
  const heard = [];
  const stop = events.subscribeWorkoutSetChanges((change) => heard.push(change));

  events.notifyWorkoutSetChanged({ workoutId: "5", setId: "30", done: 1, personalRecord: true });
  stop();
  events.notifyWorkoutSetChanged({ workoutId: 5, setId: 31, done: 0 });

  assert.strictEqual(heard.length, 2, "a subscriber hears the last change at once, then every new one");
  assert.deepStrictEqual(
    { ...heard[1], at: undefined },
    { workoutId: 5, setId: 30, done: true, failed: false, personalRecord: true, at: undefined }
  );
  assert.strictEqual(events.getLastWorkoutSetChange().setId, 31, "an unsubscribed listener kept hearing");
}

/* --------------------------------------------------------- the wiring -- */

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const service = read("src/Services/weightliftingService.js");
const setDone = service.slice(
  service.indexOf("export async function updateStrengthSetDone"),
  service.indexOf("export async function getLiveWorkoutProgress")
);

assert.ok(
  /notifyWorkoutSetChanged\(/.test(setDone),
  "ticking a set off no longer tells Home, so the panel shows the old set"
);
assert.ok(/getLiveWorkoutSets\(/.test(service), "the service no longer asks the repository for the sets");

const home = read("src/Pages/HomePage/HomePage.js");

assert.ok(/subscribeWorkoutSetChanges\(/.test(home), "Home stopped listening for sets ticked off");
assert.ok(/getLiveWorkoutProgress\(/.test(home), "Home no longer reads the running workout's sets");
assert.ok(/live=\{liveWorkout\}/.test(home), "the panel is not given the running workout's sets");

const workoutService = read("src/Services/workoutService.js");

assert.ok(
  /timerStart: rows\[0\]\.timer_start/.test(workoutService) && /elapsedTime: rows\[0\]\.elapsed_time/.test(workoutService),
  "today's open workout lost its timer, so the panel cannot say how long it has been going"
);

// The block is untouched unless the workout is running.
const quickStart = read("src/Pages/HomePage/Components/QuickStartCard/QuickStartCard.js");

assert.ok(/openToday\?\.first\?\.isRunning/.test(quickStart), "the live panel shows for a workout that is not running");
assert.ok(/home\.quickStart\.emptyWorkout/.test(quickStart), "the empty workout button is gone for good");

// Every string in both languages.
const en = loadAppModule("src/Localization/locales/en/home.js").default.quickStart.live;
const da = loadAppModule("src/Localization/locales/da/home.js").default.quickStart.live;

assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(da).sort());
assert.strictEqual(da.inProgress, "I gang");
assert.strictEqual(da.setsOfTotal, "{done} af {total} sæt");
assert.strictEqual(en.setsOfTotal, "{done} of {total} sets");

console.log(
  "Live quick start: the progress, the views, the bars, the rest and the clock, records, the set event and the wiring passed."
);
