// The Quick start block on Home while a workout is running: one panel that
// shows what matters right now - the first set, the rest counting down, that
// the rest is over, the next set, a new record, or that every set is done.
//
// Pure, so which of those it shows can be checked without a phone. The
// screen hands in what it knows - the workout's sets, the rest timer, the
// clock - and gets back the view and what goes in it.
import { orderSetsForDisplay, resolveSetType } from "./setTypes";
import { normalizeElapsedDurationSeconds, normalizeStoredTimestampSeconds } from "./timeUtils";

export const LIVE_VIEWS = ["first", "rest", "ready", "next", "record", "finished", "latest"];

// How long a new record holds the panel before it goes back to the rest.
export const RECORD_HOLD_MS = 3200;
// The countdown pops each second of the last ten.
export const REST_POP_FROM_SECONDS = 10;
// A workout counts as planned once it has had this many sets waiting at once.
// A workout filled as you go has one at a time: the set added for the
// exercise just picked, or the next one added to it.
export const PLANNED_WAITING_SETS = 2;

const flag = (value) => Number(value) === 1;

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function toSet(row) {
  const done = flag(row.done);
  const failed = flag(row.failed);

  return {
    setId: Number(row.sets_id),
    setNumber: Number(row.set_number) || 0,
    reps: numberOrNull(row.reps),
    weight: numberOrNull(row.weight),
    setType: resolveSetType(row),
    amrapTarget: numberOrNull(row.amrap_target),
    done,
    failed,
    // What the workout screen shows as a record: done, not failed, flagged.
    personalRecord: done && !failed && flag(row.personal_record),
  };
}

/**
 * The running workout's sets, from rows of exercise and set - one row per
 * set, and one with no set for an exercise without any - in the order the
 * workout screen lists them: exercise by exercise, and within one, the
 * warm-ups first.
 *
 *   next      the first set not done yet, with its exercise's name, where it
 *             is in that exercise, how many sets the exercise has, and which
 *             of them are done
 *   lastDone  the set finished last: `recentSetId` when the screen knows
 *             which one that was and it is done, otherwise the last done set
 *             in that order
 *   latest    the last exercise and its latest set, for a workout with no
 *             set waiting to be shown as the next one
 */
export function buildLiveWorkoutProgress(rows = [], { recentSetId = null } = {}) {
  const exercises = [];
  const byId = new Map();

  for (const row of rows ?? []) {
    const exerciseId = Number(row?.exercise_instance_id);

    if (!Number.isFinite(exerciseId)) {
      continue;
    }

    let exercise = byId.get(exerciseId);

    if (!exercise) {
      exercise = { exerciseId, name: String(row.exercise_name ?? "").trim(), rows: [] };
      byId.set(exerciseId, exercise);
      exercises.push(exercise);
    }

    if (row.sets_id !== null && row.sets_id !== undefined) {
      exercise.rows.push(row);
    }
  }

  let totalSets = 0;
  let doneSets = 0;
  let next = null;
  let lastDone = null;
  let recent = null;

  const ordered = exercises.map((exercise) => {
    const sets = orderSetsForDisplay(exercise.rows).map(toSet);

    return { exerciseId: exercise.exerciseId, name: exercise.name, sets };
  });

  ordered.forEach((exercise) => {
    const doneFlags = exercise.sets.map((set) => set.done);

    exercise.sets.forEach((set, index) => {
      totalSets += 1;

      const entry = {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        index,
        count: exercise.sets.length,
        doneFlags,
        ...set,
      };

      if (set.done) {
        doneSets += 1;
        lastDone = entry;

        if (recentSetId !== null && Number(recentSetId) === set.setId) {
          recent = entry;
        }
      } else if (!next) {
        next = entry;
      }
    });
  });

  const lastExercise = ordered[ordered.length - 1] ?? null;
  const latestSet = lastExercise?.sets[lastExercise.sets.length - 1] ?? null;
  const latest = lastExercise
    ? {
        exerciseId: lastExercise.exerciseId,
        name: lastExercise.name,
        index: latestSet ? lastExercise.sets.length - 1 : -1,
        count: lastExercise.sets.length,
        doneFlags: lastExercise.sets.map((set) => set.done),
        ...(latestSet ?? { setId: null, reps: null, weight: null, setType: "working", amrapTarget: null }),
      }
    : null;

  return {
    totalSets,
    doneSets,
    remaining: totalSets - doneSets,
    next,
    lastDone: recent ?? lastDone,
    latest,
  };
}

/**
 * Whether the workout was planned - sets laid out before they were done - or
 * is being filled as you go. Nothing in the rows says so, so it is what the
 * screen has seen: planned once it has had PLANNED_WAITING_SETS waiting at
 * the same time, and it stays planned.
 */
export function isPlannedWorkout(progress, wasPlanned = false) {
  return Boolean(wasPlanned) || (Number(progress?.remaining) || 0) >= PLANNED_WAITING_SETS;
}

/**
 * Where the rest timer is, in whole seconds: what is left, and the share of
 * the rest still to go, 1 when it starts and 0 when it is over. Null without
 * a timer.
 */
export function restCountdown(timer, nowSeconds) {
  if (!timer || !Number.isFinite(Number(timer.endsAt))) {
    return null;
  }

  const duration = Math.max(1, Math.round(Number(timer.durationSeconds) || 0));
  const remaining = Math.max(0, Math.ceil(Number(timer.endsAt) - nowSeconds));

  return {
    remaining,
    duration,
    fraction: Math.min(1, Math.max(0, remaining / duration)),
    pops: remaining > 0 && remaining <= REST_POP_FROM_SECONDS,
  };
}

/**
 * A rest timer that has gone away ran out, rather than being cancelled -
 * unticking the set or pausing the workout clears it early. A second of
 * slack, because whoever cleared it may have ticked just before this did.
 */
export function restRanOut(timer, nowSeconds) {
  return Boolean(timer) && Number(timer.endsAt) <= nowSeconds + 1;
}

/**
 * The workout's elapsed time in seconds: what was banked before the last
 * pause, plus the time since the timer last started - the same sum as the
 * clock in the middle of the bottom navigation.
 */
export function liveElapsedSeconds({ timerStart = null, elapsedTime = 0 } = {}, nowSeconds) {
  const start = normalizeStoredTimestampSeconds(timerStart);

  return (
    normalizeElapsedDurationSeconds(elapsedTime, 0) +
    (start === null ? 0 : Math.max(0, Math.trunc(nowSeconds) - start))
  );
}

/**
 * Which view the panel shows. In order: a record just set holds it; then a
 * planned workout with every set done is finished; then the rest, while it
 * runs; then "ready", once it has run out and until the next set; then the
 * next set - "first" before any set is done. A workout with no set waiting
 * that was filled as you go shows its latest set instead of "finished".
 */
export function resolveLiveView({ progress, planned = false, resting = false, ready = false, record = null }) {
  if (record) {
    return "record";
  }

  const hasSets = (Number(progress?.totalSets) || 0) > 0;
  const allDone = hasSets && !progress?.next;

  if (allDone && planned) {
    return "finished";
  }

  if (resting) {
    return "rest";
  }

  if (ready) {
    return "ready";
  }

  if (progress?.next) {
    return (Number(progress.doneSets) || 0) === 0 ? "first" : "next";
  }

  return "latest";
}

/**
 * The set the panel talks about beside the view: the next one to do, or,
 * when nothing is waiting, the latest one. `kicker` is whether it carries the
 * "Next" line over its name - the first set does not, and neither does the
 * latest, which is not next.
 */
export function focusSetFor(view, progress) {
  const next = progress?.next ?? null;
  const set = next ?? progress?.latest ?? null;

  return {
    set,
    isNext: Boolean(next),
    kicker: Boolean(next) && view !== "first",
  };
}

/**
 * One bar per set of the exercise: filled for a set that is done, and the
 * next one glowing.
 */
export function setBars(set, { isNext = true } = {}) {
  if (!set || !Array.isArray(set.doneFlags)) {
    return [];
  }

  return set.doneFlags.map((done, index) => ({
    filled: Boolean(done),
    now: isNext && index === set.index,
  }));
}

/**
 * The bars that have filled in since the panel last showed them - the sets
 * done while somebody was away - keyed by the bar's position. They fill in
 * when they are seen. Only for the same exercise: the bars start again at the
 * next one.
 */
export function newlyFilledBars(previous, current) {
  if (!previous || !current || previous.exerciseId !== current.exerciseId) {
    return [];
  }

  const filled = [];

  current.doneFlags.forEach((done, index) => {
    if (done && !previous.doneFlags?.[index]) {
      filled.push(index);
    }
  });

  return filled;
}

/**
 * What the big line says about a set: "8 x 80 kg" with both, the reps alone
 * for a set without a weight, the weight alone without reps, nothing at all
 * with neither. An AMRAP set is its target with a plus.
 */
export function setLineParts(set) {
  if (!set) {
    return { kind: "none", reps: null, weight: null };
  }

  const isAmrap = set.setType === "amrap";
  const repsValue = isAmrap ? set.amrapTarget ?? set.reps : set.reps;
  const reps = repsValue === null || repsValue === undefined ? null : `${repsValue}${isAmrap ? "+" : ""}`;
  const weight = set.weight === null || set.weight === undefined || set.weight <= 0 ? null : set.weight;

  if (reps !== null && weight !== null) {
    return { kind: "both", reps, weight };
  }

  if (reps !== null) {
    return { kind: "reps", reps, weight: null, count: Number(repsValue) || 0 };
  }

  if (weight !== null) {
    return { kind: "weight", reps: null, weight };
  }

  return { kind: "none", reps: null, weight: null };
}

/**
 * The record to celebrate, if there is one: the set finished last, when it
 * is a record, it is the one the workout screen just reported, and it has not
 * been shown yet.
 */
export function pendingRecordFor(progress, recentSetId, celebrated = new Set()) {
  const set = progress?.lastDone ?? null;

  if (!set || !set.personalRecord || recentSetId === null || recentSetId === undefined) {
    return null;
  }

  if (Number(recentSetId) !== set.setId || celebrated.has(set.setId)) {
    return null;
  }

  return set;
}

/** The panel's colour: the record's gold, green once it is all done, fire otherwise. */
export function livePanelTone(view, { fire, record, finished }) {
  if (view === "record") {
    return record;
  }

  return view === "finished" ? finished : fire;
}
