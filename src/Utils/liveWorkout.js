// The running strength workout on the lock screen: the state the card is drawn
// from (`buildLiveWorkoutState`), and the two sets of rules the native sides
// follow to draw it (`deriveLiveWorkoutView`) and to change it by themselves
// when a button on the card is tapped (`applyLiveWorkoutAction`).
//
// The card is native - a Live Activity on iOS, a notification on Android - and
// it has to work while this JavaScript is not running, so it cannot be handed
// a finished picture. It gets data and translated templates instead, and both
// native sides turn them into the same card. The two functions below are the
// reference for that: the Swift and the Kotlin code mirror them rule by rule,
// and scripts/test-live-workout.js pins them.
//
// Pure: no database, no clock of its own, no native module. The service
// passes in what it read and `t`.
import { orderSetsForDisplay, resolveSetType } from "./setTypes";
import { normalizeElapsedDurationSeconds, normalizeStoredTimestampSeconds } from "./timeUtils";

export const LIVE_WORKOUT_STATE_VERSION = 1;

// The workout types that are drawn by the strength screen, and so get a card.
// A run has its own notification from expo-location, and no card until one is
// designed for it.
export const LIVE_STRENGTH_WORKOUT_TYPES = new Set([
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Legs",
]);

// iOS drops a Live Activity after eight hours, and Android's notification
// times out after as long. A paused workout older than that is left behind,
// not trained.
export const LIVE_WORKOUT_MAX_SECONDS = 8 * 60 * 60;

// ActivityKit refuses a content state over 4 KB. Ten sets an exercise and
// two exercises keep it under, with room for the strings and long names. An
// exercise with more - rare - is shown as the ten around the set to do, and
// the card's counts are then of those ten.
export const LIVE_WORKOUT_MAX_SETS = 10;
export const LIVE_WORKOUT_MAX_BYTES = 4096;

// The card's chips: at most six in a row; with more sets, five around the one
// being done and a "+n".
export const LIVE_WORKOUT_MAX_CHIPS = 6;

// Forrige / Næste only move what the card shows. Tapped while the app was not
// running and handled when it opens, they would move it for no reason.
export const LIVE_WORKOUT_VIEW_ACTION_MAX_AGE_SECONDS = 60;

export const LIVE_WORKOUT_ACTION_TYPES = [
  "completeSet",
  "prev",
  "next",
  "adjustRest",
  "skipRest",
  "adjustWeight",
];

// The weight buttons on Android's open card move a set by one step of plates.
// The step follows the exercise: what is on the bar decides how finely it can
// move. A setting per exercise can come later; until then, this.
export const LIVE_WEIGHT_STEP_DEFAULT = 2.5;
const HEAVY_STEP = 5;
const DUMBBELL_STEP = 2;

/**
 * One step on the weight buttons for an exercise, in kg: 2 for dumbbells, 5
 * for machines and cables and for squats and deadlifts on the bar, and 2.5
 * for everything else - the bench press among them.
 */
export function liveWeightStepFor({ name = "", equipment = null } = {}) {
  const lowered = String(name ?? "").toLowerCase();

  if (equipment === "dumbbell" || /dumbbell|håndvægt/.test(lowered)) {
    return DUMBBELL_STEP;
  }

  if (
    equipment === "machine" ||
    equipment === "cable" ||
    /machine|maskine|cable|kabel|leg press|benpres/.test(lowered)
  ) {
    return HEAVY_STEP;
  }

  if (/squat|deadlift|dødløft/.test(lowered)) {
    return HEAVY_STEP;
  }

  return LIVE_WEIGHT_STEP_DEFAULT;
}

/** To the nearest quarter kilo, so 0.1 + 0.2 never shows as 102.49999. */
export function roundToQuarter(value) {
  return Math.round(Number(value) * 4) / 4;
}

/**
 * A weight as the card writes it: at most two decimals, no trailing zeros, no
 * thousands separator, and the language's decimal sign - "102,5", "100". The
 * native sides write a weight their buttons changed with exactly this rule.
 */
export function formatLiveWeight(weight, decimal = ".") {
  const rounded = Math.round(Number(weight) * 100) / 100;

  return String(Object.is(rounded, -0) ? 0 : rounded).replace(".", decimal);
}

/** "," or ".", as `formatNumber` writes one and a half in the chosen language. */
export function decimalSignOf(formatNumber) {
  if (typeof formatNumber !== "function") {
    return ".";
  }

  const sample = String(formatNumber(1.5, { minimumFractionDigits: 1, useGrouping: false }));

  return sample.includes(",") ? "," : ".";
}

/** A set's words, from its weight and the reps part - what a weight button redraws. */
export function composeLiveSetText(weight, repsText, { decimal = ".", unit = "kg" } = {}) {
  const kilos = weight === null || weight === undefined ? null : formatLiveWeight(weight, decimal);

  if (kilos !== null && repsText) {
    return { text: `${kilos} ${unit} × ${repsText}`, short: `${kilos}×${repsText}` };
  }

  if (repsText) {
    return { text: `× ${repsText}`, short: `×${repsText}` };
  }

  if (kilos !== null) {
    return { text: `${kilos} ${unit}`, short: kilos };
  }

  return { text: "–", short: "–" };
}

const flag = (value) => Number(value) === 1 || value === true;

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function restSecondsOf(value) {
  const seconds = Math.round(Number(value));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** Plain `{name}` substitution, the same the native sides do. */
export function fillTemplate(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    String(template ?? "")
  );
}

/** "1:24", and "1:02:05" from an hour. */
export function formatLiveClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

/**
 * What a set says on the card: "100 kg × 5" and, on a chip, "100×5". Without
 * a weight it is body weight - "× 12". An AMRAP set without reps yet shows its
 * target with a plus. Also the parts the weight buttons redraw it from: the
 * weight, and the reps as written.
 */
export function formatLiveSet(row, { decimal = ".", unit = "kg" } = {}) {
  const weight = numberOrNull(row?.weight);
  let reps = numberOrNull(row?.reps);
  let plus = "";

  if (reps === null && resolveSetType(row ?? {}) === "amrap") {
    reps = numberOrNull(row?.amrap_target);
    plus = reps === null ? "" : "+";
  }

  const repsText = reps === null ? null : `${Math.round(reps)}${plus}`;

  return {
    ...composeLiveSetText(weight, repsText, { decimal, unit }),
    weight,
    repsText,
  };
}

/** Every word the card shows, translated here because native never does. */
export function liveWorkoutStrings(t) {
  return {
    complete: t("liveWorkout.complete"),
    skip: t("liveWorkout.skip"),
    prev: t("liveWorkout.prev"),
    next: t("liveWorkout.next"),
    nowEyebrow: t("liveWorkout.nowEyebrow"),
    nextEyebrow: t("liveWorkout.nextEyebrow"),
    pause: t("liveWorkout.pause"),
    sets: t("liveWorkout.sets"),
    exercise: t("liveWorkout.exercise"),
    nextSet: t("liveWorkout.nextSet"),
    nextExercise: t("liveWorkout.nextExercise"),
    setOf: t("liveWorkout.setOf"),
    setOfTitle: t("liveWorkout.setOfTitle"),
    setShort: t("liveWorkout.setShort"),
    of: t("liveWorkout.of"),
    setsCount: t("liveWorkout.setsCount"),
    restClock: t("liveWorkout.restClock"),
    restSub: t("liveWorkout.restSub"),
    allDone: t("liveWorkout.allDone"),
    allDoneQuestion: t("liveWorkout.allDoneQuestion"),
    finish: t("liveWorkout.finish"),
    noSets: t("liveWorkout.noSets"),
    channelName: t("liveWorkout.channelName"),
    weightStep: t("liveWorkout.weightStep"),
    a11yWeightMinus: t("liveWorkout.a11yWeightMinus"),
    a11yWeightPlus: t("liveWorkout.a11yWeightPlus"),
  };
}

/**
 * The workout's exercises in the workout screen's order, each with its sets
 * in the order the screen lists them (warm-ups first) - from rows of exercise
 * and set, one per set, and one with no set for an exercise without any.
 */
export function groupLiveWorkoutRows(rows = []) {
  const exercises = [];
  const byId = new Map();

  for (const row of rows ?? []) {
    const exerciseId = Number(row?.exercise_instance_id);

    if (!Number.isFinite(exerciseId)) {
      continue;
    }

    let exercise = byId.get(exerciseId);

    if (!exercise) {
      exercise = {
        exerciseId,
        name: String(row.exercise_name ?? "").trim(),
        equipment: row.exercise_equipment ?? null,
        rows: [],
      };
      byId.set(exerciseId, exercise);
      exercises.push(exercise);
    }

    if (row.sets_id !== null && row.sets_id !== undefined) {
      exercise.rows.push(row);
    }
  }

  return exercises.map((exercise, position) => ({
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    equipment: exercise.equipment,
    position,
    sets: orderSetsForDisplay(exercise.rows).map((row) => ({
      row,
      setId: Number(row.sets_id),
      done: flag(row.done),
      rest: restSecondsOf(row.pause),
    })),
  }));
}

const hasSetToDo = (exercise) => exercise.sets.some((set) => !set.done);

/**
 * Which exercise the card is about, before Forrige / Næste: the one the last
 * set was ticked off in while it still has sets to do - so doing exercises out
 * of order does not throw the card back to the first one - and otherwise the
 * first exercise with a set to do. Null when every set is done.
 */
export function autoFocusExercise(exercises, recentSetId = null) {
  if (recentSetId !== null && recentSetId !== undefined) {
    const recent = exercises.find((exercise) =>
      exercise.sets.some((set) => set.setId === Number(recentSetId))
    );

    if (recent && hasSetToDo(recent)) {
      return recent;
    }
  }

  return exercises.find(hasSetToDo) ?? null;
}

/**
 * Where the card is, after Forrige / Næste have moved it `viewOffset`
 * exercises: only exercises with a set to do count, since those are the ones
 * a button on the card can act on. Also says whether it can move further.
 */
export function resolveLiveFocus(exercises, { recentSetId = null, viewOffset = 0 } = {}) {
  const actionable = exercises.filter(hasSetToDo);
  const auto = autoFocusExercise(exercises, recentSetId);

  if (!auto) {
    return { focus: null, next: null, canPrev: false, canNext: false, offset: 0 };
  }

  const autoIndex = actionable.indexOf(auto);
  const wanted = autoIndex + (Math.trunc(Number(viewOffset)) || 0);
  const index = Math.min(actionable.length - 1, Math.max(0, wanted));
  const focus = actionable[index];
  // The next exercise with a set to do after this one, going round to the
  // start: somebody who skipped one comes back to it.
  const next = actionable.length > 1 ? actionable[(index + 1) % actionable.length] : null;

  return {
    focus,
    next,
    canPrev: index > 0,
    canNext: index < actionable.length - 1,
    offset: index - autoIndex,
  };
}

// At most LIVE_WORKOUT_MAX_SETS, around the first one to do.
function windowOfSets(sets) {
  if (sets.length <= LIVE_WORKOUT_MAX_SETS) {
    return sets;
  }

  const nowIndex = Math.max(0, sets.findIndex((set) => !set.done));
  const start = Math.min(
    sets.length - LIVE_WORKOUT_MAX_SETS,
    Math.max(0, nowIndex - Math.floor(LIVE_WORKOUT_MAX_SETS / 2))
  );

  return sets.slice(start, start + LIVE_WORKOUT_MAX_SETS);
}

function exerciseForState(exercise, total, format) {
  const weightStep = liveWeightStepFor(exercise);

  return {
    name: exercise.name,
    index: exercise.position + 1,
    total,
    weightStep,
    weightStepText: formatLiveWeight(weightStep, format.decimal),
    sets: windowOfSets(exercise.sets).map((set) => ({
      id: String(set.setId),
      ...formatLiveSet(set.row, format),
      done: set.done,
      rest: set.rest,
    })),
  };
}

/**
 * The state the card is drawn from, for one running strength workout.
 *
 *   workout    { workoutId, workoutType, timerStart, elapsedTime } - the row
 *              the workout clock is kept in: `timerStart` is when it last
 *              started (null while paused), `elapsedTime` what was banked
 *              before that
 *   rows       the workout's exercises and sets, as the repository returns
 *              them (getLiveWorkoutSets)
 *   restTimer  the active rest timer, or null; one for another workout, or
 *              one that has run out, is ignored
 *   focus      { recentSetId, viewOffset } - the set ticked off last, and how
 *              far Forrige / Næste have moved the card
 *   now        Unix seconds
 */
export function buildLiveWorkoutState(
  { workout, rows = [], restTimer = null, focus = {}, now },
  { t, formatNumber } = {}
) {
  const exercises = groupLiveWorkoutRows(rows);
  const { focus: shown, next, canPrev, canNext } = resolveLiveFocus(exercises, focus);
  const timerStart = normalizeStoredTimestampSeconds(workout?.timerStart ?? null);
  const banked = normalizeElapsedDurationSeconds(workout?.elapsedTime ?? 0, 0);
  const nowSeconds = Math.trunc(Number(now) || 0);
  const running = timerStart !== null;
  const allSets = exercises.flatMap((exercise) => exercise.sets);
  const format = { decimal: decimalSignOf(formatNumber), unit: "kg" };
  const ownRest =
    restTimer &&
    Number(restTimer.workoutId) === Number(workout?.workoutId) &&
    Number(restTimer.endsAt) > nowSeconds
      ? restTimer
      : null;

  return {
    v: LIVE_WORKOUT_STATE_VERSION,
    workoutId: String(workout?.workoutId ?? ""),
    workoutType: String(workout?.workoutType ?? "Resistance"),
    // The moment the clock would have started had it never been paused, so
    // it can count up from there by itself.
    startedAt: running ? timerStart - banked : nowSeconds - banked,
    pausedElapsed: running ? null : banked,
    unit: format.unit,
    decimal: format.decimal,
    exercise: shown ? exerciseForState(shown, exercises.length, format) : null,
    next: next ? exerciseForState(next, exercises.length, format) : null,
    rest: ownRest
      ? {
          startedAt: Math.trunc(Number(ownRest.startedAt)),
          endsAt: Math.trunc(Number(ownRest.endsAt)),
          duration: Math.max(1, Math.round(Number(ownRest.durationSeconds) || 0)),
        }
      : null,
    totals: {
      done: allSets.filter((set) => set.done).length,
      all: allSets.length,
      exercisesDone: exercises.filter(
        (exercise) => exercise.sets.length > 0 && !hasSetToDo(exercise)
      ).length,
    },
    canPrev,
    canNext,
    // Where "Afslut" on a card with every set done takes you: the app opens
    // on the workout and finishes it, then asks about the post.
    finishUrl: liveWorkoutFinishUrl(workout),
    strings: typeof t === "function" ? liveWorkoutStrings(t) : {},
  };
}

export const LIVE_WORKOUT_FINISH_URL_PATH = "live-workout/finish";

/** `fitven://live-workout/finish?workoutId=7&type=Resistance` */
export function liveWorkoutFinishUrl(workout) {
  const workoutId = encodeURIComponent(String(workout?.workoutId ?? ""));
  const type = encodeURIComponent(String(workout?.workoutType ?? "Resistance"));

  return `fitven://${LIVE_WORKOUT_FINISH_URL_PATH}?workoutId=${workoutId}&type=${type}`;
}

/**
 * The finish link, read back: `{ workoutId, workoutType }`, or null for any
 * other address.
 */
export function parseLiveWorkoutFinishUrl(url) {
  const match = String(url ?? "").match(/^fitven:\/\/+live-workout\/finish\/?\?(.*)$/);

  if (!match) {
    return null;
  }

  const params = {};

  for (const pair of match[1].split("&")) {
    const [key, value = ""] = pair.split("=");

    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  const workoutId = Number(params.workoutId);

  return Number.isFinite(workoutId) && workoutId > 0
    ? { workoutId, workoutType: params.type || "Resistance" }
    : null;
}

/** The size ActivityKit measures, near enough: the JSON in UTF-8. */
export function liveWorkoutStateBytes(state) {
  let bytes = 0;

  for (const character of JSON.stringify(state)) {
    const code = character.codePointAt(0);

    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }

  return bytes;
}

const firstToDo = (exercise) => (exercise?.sets ?? []).findIndex((set) => !set.done);

/**
 * Derive: what the card draws from a state, at `now`. The native sides do
 * exactly this; see the shared brief. A card that has been changed by a button
 * without JavaScript can have an exercise with nothing left to do - then the
 * next exercise takes its place, as it would once JavaScript rebuilt it.
 */
export function deriveLiveWorkoutView(state, now) {
  const strings = state?.strings ?? {};
  let exercise = state?.exercise ?? null;
  let next = state?.next ?? null;
  let canPrev = Boolean(state?.canPrev);
  let canNext = Boolean(state?.canNext);

  if (exercise && firstToDo(exercise) < 0) {
    exercise = next && firstToDo(next) >= 0 ? next : null;
    next = null;
    canPrev = false;
    canNext = false;
  }

  const totals = state?.totals ?? { done: 0, all: 0, exercisesDone: 0 };

  if (!exercise) {
    const mode = (Number(totals.all) || 0) > 0 ? "allDone" : "empty";

    // Every set done: the card asks to finish, and its one button opens the
    // app on the workout to do it - a link, not a queued tap, because the
    // post question after it needs the app.
    return mode === "allDone"
      ? {
          mode,
          title: strings.allDone,
          subtitle: strings.allDoneQuestion ?? "",
          buttons: [
            { type: "finish", primary: true, label: strings.finish, url: state?.finishUrl ?? null },
          ],
        }
      : { mode, title: strings.noSets, subtitle: "", buttons: [] };
  }

  const rest = state?.rest ?? null;
  const resting = Boolean(rest) && Number(rest.endsAt) > now;
  const sets = exercise.sets;
  const nowIndex = firstToDo(exercise);
  const nowSet = sets[nowIndex];
  const done = sets.filter((set) => set.done).length;
  const position = { n: nowIndex + 1, total: sets.length };
  const view = {
    mode: resting ? "rest" : "set",
    nowSetId: nowSet.id,
    title: resting ? fillTemplate(strings.nextSet, { set: nowSet.text }) : nowSet.text,
    subtitle: `${exercise.name} · ${fillTemplate(strings.setOf, position)}`,
    subtitleShort: `${exercise.name} · ${fillTemplate(strings.setShort, position)}`,
    // Android's open card says only the exercise under the title; which set
    // it is stands in the ring.
    exerciseName: exercise.name,
    setOfTitle: fillTemplate(strings.setOfTitle, position),
    eyebrow: resting ? strings.nextEyebrow : strings.nowEyebrow,
    setsRing: {
      fraction: sets.length > 0 ? done / sets.length : 0,
      text: `${done}/${sets.length}`,
      // Android's ring counts the set being done - "3/4" with two done - and
      // fills with the ones that are.
      currentText: `${Math.min(done + 1, sets.length)}/${sets.length}`,
      label: strings.sets,
    },
    exerciseRing: {
      fraction:
        Number(exercise.total) > 0
          ? Math.min(1, (Number(totals.exercisesDone) || 0) / Number(exercise.total))
          : 0,
      text: `${exercise.index}/${exercise.total}`,
      label: strings.exercise,
    },
    setsCount: fillTemplate(strings.setsCount, { done: totals.done, total: totals.all }),
    clock:
      state.pausedElapsed === null || state.pausedElapsed === undefined
        ? { countsFrom: state.startedAt }
        : { stopped: formatLiveClock(state.pausedElapsed) },
    rest: resting
      ? {
          endsAt: rest.endsAt,
          remaining: Math.max(0, Math.ceil(rest.endsAt - now)),
          fraction: Math.min(1, Math.max(0, (rest.endsAt - now) / Math.max(1, rest.duration))),
          of: fillTemplate(strings.of, { duration: formatLiveClock(rest.duration) }),
        }
      : null,
    buttons: resting
      ? [
          { type: "adjustRest", seconds: -15 },
          { type: "skipRest", primary: true, label: strings.skip },
          { type: "adjustRest", seconds: 15 },
        ]
      : [
          { type: "prev", label: strings.prev, enabled: canPrev },
          { type: "completeSet", primary: true, label: strings.complete, setId: nowSet.id },
          { type: "next", label: strings.next, enabled: canNext },
        ],
    // Android's open card, between sets: −step · Sæt færdigt · +step. None
    // for a set without a weight - body weight or time - where Sæt færdigt
    // takes the whole row, and none while resting.
    weightButtons: resting ? null : weightButtonsFor(state, exercise, nowSet),
    chips: chipsFor(sets, nowIndex),
    nextRow: next
      ? {
          label: fillTemplate(strings.nextExercise, { name: next.name }),
          chips: chipsFor(
            next.sets.map((set) => ({ ...set, done: false })),
            -1
          ).map((chip) => (chip.more ? chip : { ...chip, state: "todo" })),
        }
      : null,
  };

  return view;
}

function weightButtonsFor(state, exercise, nowSet) {
  if (nowSet?.weight === null || nowSet?.weight === undefined) {
    return null;
  }

  const strings = state?.strings ?? {};
  const step = Number(exercise.weightStep) || LIVE_WEIGHT_STEP_DEFAULT;
  const values = {
    step: exercise.weightStepText ?? formatLiveWeight(step, state?.decimal ?? "."),
    unit: state?.unit ?? "kg",
  };

  return {
    step,
    label: fillTemplate(strings.weightStep, values),
    a11yMinus: fillTemplate(strings.a11yWeightMinus, values),
    a11yPlus: fillTemplate(strings.a11yWeightPlus, values),
    // Nothing lighter than an empty bar.
    minusEnabled: Number(nowSet.weight) > 0,
  };
}

/**
 * Android's chip row: every set when there are at most six, otherwise five
 * starting two before the one being done, and a "+n" for the rest.
 */
export function chipsFor(sets, nowIndex) {
  const stateOf = (set, index) => (set.done ? "done" : index === nowIndex ? "now" : "todo");

  if (sets.length <= LIVE_WORKOUT_MAX_CHIPS) {
    return sets.map((set, index) => ({ text: set.short, state: stateOf(set, index) }));
  }

  const shown = LIVE_WORKOUT_MAX_CHIPS - 1;
  const start = Math.min(sets.length - shown, Math.max(0, nowIndex - 2));

  return [
    ...sets
      .slice(start, start + shown)
      .map((set, offset) => ({ text: set.short, state: stateOf(set, start + offset) })),
    { text: `+${sets.length - shown}`, state: "todo", more: true },
  ];
}

/**
 * Reducer: what a tap on the card does to the stored state before
 * JavaScript knows about it. The native sides do exactly this and queue the
 * action; JavaScript then does the real thing and sends a fresh state.
 * Forrige / Næste change nothing here.
 */
export function applyLiveWorkoutAction(state, action, now) {
  if (!state || !action) {
    return state;
  }

  const at = Number(action.at ?? now);
  const view = deriveLiveWorkoutView(state, now);

  switch (action.type) {
    case "completeSet": {
      if (view.mode !== "set" || String(action.setId) !== String(view.nowSetId)) {
        return state;
      }

      // The exercise the card really shows: after an earlier tap it can be
      // `next` standing in for a finished one.
      let exercise = state.exercise;
      let next = state.next;
      let canPrev = state.canPrev;
      let canNext = state.canNext;

      if (firstToDo(exercise) < 0) {
        exercise = next;
        next = null;
        canPrev = false;
        canNext = false;
      }

      const nowIndex = firstToDo(exercise);
      const nowSet = exercise.sets[nowIndex];
      const sets = exercise.sets.map((set, index) =>
        index === nowIndex ? { ...set, done: true } : set
      );
      const finishedExercise = sets.every((set) => set.done);
      const running = state.pausedElapsed === null || state.pausedElapsed === undefined;
      const rest =
        running && nowSet.rest > 0
          ? { startedAt: at, endsAt: at + nowSet.rest, duration: nowSet.rest }
          : null;
      let shown = { ...exercise, sets };

      if (finishedExercise) {
        if (next && firstToDo(next) >= 0) {
          shown = next;
        } else {
          shown = null;
        }

        next = null;
        canPrev = false;
        canNext = false;
      }

      return {
        ...state,
        exercise: shown,
        next,
        canPrev,
        canNext,
        rest,
        totals: {
          ...state.totals,
          done: (Number(state.totals?.done) || 0) + 1,
          exercisesDone: (Number(state.totals?.exercisesDone) || 0) + (finishedExercise ? 1 : 0),
        },
      };
    }

    case "adjustWeight": {
      // Only the set that is "now", only between sets, and only one with a
      // weight to move.
      if (view.mode !== "set" || String(action.setId) !== String(view.nowSetId)) {
        return state;
      }

      const exercise = firstToDo(state.exercise) >= 0 ? state.exercise : state.next;
      const nowIndex = firstToDo(exercise);
      const nowSet = exercise.sets[nowIndex];

      if (nowSet.weight === null || nowSet.weight === undefined) {
        return state;
      }

      const weight = roundToQuarter(Math.max(0, Number(nowSet.weight) + (Number(action.delta) || 0)));

      if (weight === Number(nowSet.weight)) {
        return state;
      }

      const changed = {
        ...exercise,
        sets: exercise.sets.map((set, index) =>
          index === nowIndex
            ? {
                ...set,
                weight,
                ...composeLiveSetText(weight, set.repsText, {
                  decimal: state.decimal ?? ".",
                  unit: state.unit ?? "kg",
                }),
              }
            : set
        ),
      };

      return exercise === state.exercise ? { ...state, exercise: changed } : { ...state, next: changed };
    }

    case "skipRest":
      return state.rest ? { ...state, rest: null } : state;

    case "adjustRest": {
      if (!state.rest) {
        return state;
      }

      const seconds = Math.trunc(Number(action.seconds) || 0);
      const endsAt = state.rest.endsAt + seconds;

      if (endsAt <= now) {
        return { ...state, rest: null };
      }

      return {
        ...state,
        rest: { ...state.rest, endsAt, duration: Math.max(1, state.rest.duration + seconds) },
      };
    }

    default:
      return state;
  }
}
