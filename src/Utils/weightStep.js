// One step of the weight steppers (1e): how far + and − move a weight, and
// what a press does to one.
//
// The lock screen's weight buttons use this same rule (liveWeightStepFor in
// liveWorkout.js hands the card getWeightStep's answer), so a press moves a
// set by the same amount wherever it is made. What is on the bar decides how
// finely it can move: a pair of dumbbells goes up 2, a machine or a cable
// stack 5, a squat or a deadlift 5, everything else - the bench press among
// them - 2.5. A step set on the exercise itself wins over all of it, for the
// day there is a setting.
//
// kg only: the app has no lb. Pure, so scripts/test-weight-mode.js loads it.
import { roundToStep } from "./weightMode";

export const DEFAULT_WEIGHT_STEP = 2.5;
const DUMBBELL_STEP = 2;
const HEAVY_STEP = 5;
const STEP_ROUNDING = 0.25;

/** To the nearest quarter kilo, so 0.1 + 0.2 never reads 102.49999. */
export function roundWeightToQuarter(value) {
  return roundToStep(value, STEP_ROUNDING);
}

/**
 * One step for an exercise, in kg. In order: its own `weightStep` when that
 * is a positive number; dumbbells 2; machines and cables 5 (a leg press is a
 * machine); squats and deadlifts 5; otherwise 2.5. Rounded to 0.25.
 */
export function getWeightStep({ name = "", equipment = null, weightStep = null } = {}) {
  const own = Number(weightStep);

  if (weightStep !== null && weightStep !== undefined && weightStep !== "" && Number.isFinite(own) && own > 0) {
    return roundWeightToQuarter(own) || STEP_ROUNDING;
  }

  const kind = typeof equipment === "string" ? equipment.trim().toLowerCase() : "";
  const lowered = String(name ?? "").toLowerCase();

  if (kind === "dumbbell" || /dumbbell|håndvægt/i.test(lowered)) {
    return DUMBBELL_STEP;
  }

  if (
    kind === "machine" ||
    kind === "cable" ||
    /machine|maskine|cable|kabel|leg press|benpres/i.test(lowered)
  ) {
    return HEAVY_STEP;
  }

  if (/squat|deadlift|dødløft/i.test(lowered)) {
    return HEAVY_STEP;
  }

  return DEFAULT_WEIGHT_STEP;
}

function toWeight(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * What one press does to one weight: `direction` +1 or −1, never below 0,
 * rounded to 0.25. An empty weight has nothing to take from, so − leaves it
 * empty; + starts from `startFrom` - the set before it, or last time - and
 * from 0 when there is neither. Null when the press changes nothing.
 */
export function stepWeight(weight, direction, step, { startFrom = null } = {}) {
  const current = toWeight(weight);
  const size = Number(step) > 0 ? Number(step) : DEFAULT_WEIGHT_STEP;

  if (current === null) {
    if (direction < 0) {
      return null;
    }

    const base = toWeight(startFrom) ?? 0;

    return roundWeightToQuarter(Math.max(0, base) + size);
  }

  if (direction < 0 && current <= 0) {
    return null;
  }

  const next = roundWeightToQuarter(Math.max(0, current + direction * size));

  return next === current ? null : next;
}

/** Whether a set still has its steppers: not ticked off, not failed. */
export function isSteppableSet(set) {
  return Number(set?.done) !== 1 && Number(set?.failed) !== 1;
}

/**
 * The header's press: every unfinished set with a weight moved one step,
 * the finished ones and the empty ones left alone, none below 0. Returns only
 * the sets that change, as [{ setId, weight }].
 */
export function stepAllWeights(sets = [], direction, step) {
  return (Array.isArray(sets) ? sets : [])
    .filter((set) => isSteppableSet(set) && toWeight(set?.weight) !== null)
    .map((set) => ({ setId: set.sets_id, weight: stepWeight(set.weight, direction, step) }))
    .filter((change) => change.weight !== null);
}

// Only these columns leave room for the steppers; with a note, RPE or 1RM %
// the table is as it was.
export const WEIGHT_STEPPER_COLUMNS = Object.freeze(["rest", "set", "reps", "weight", "done"]);

/** Whether the set list shows the steppers for these visible columns. */
export function showsWeightStepper(visibleColumns, { weightMode = null } = {}) {
  if (!visibleColumns?.weight || weightMode === "bodyweight") {
    return false;
  }

  return Object.keys(visibleColumns).every(
    (key) => !visibleColumns[key] || WEIGHT_STEPPER_COLUMNS.includes(key)
  );
}

/**
 * The weights a set list shows before the database has them, by set (1e).
 *
 * Two kinds, and the newest for a set wins:
 *
 * - a step, + or − pressed: saved by the steppers' one write, 400 ms after
 *   the last press (stepsToSave, then settle);
 * - a typed weight: saved at once by its own write (typed, then settle, or
 *   discard when the write failed).
 *
 * Either is on screen and is where the next press starts (weightOf). Before
 * this, a press made while a typed weight was being saved started from the
 * weight before it, and the steppers' write then put that over what was
 * typed. A draft is forgotten only when the write that carried it went
 * through, and only if nothing newer came for its set meanwhile - a failed
 * write used to drop the steps it carried, and the screen kept showing a
 * weight that was never saved.
 */
export function createWeightDrafts() {
  const drafts = new Map();
  let lastToken = 0;
  const keyOf = (setId) => Number(setId);
  const put = (setId, kind, weight) => {
    lastToken += 1;
    drafts.set(keyOf(setId), { kind, weight, token: lastToken });

    return lastToken;
  };

  return {
    /** A press: the set's weight is now `weight`, to be saved with the next write. */
    step(setId, weight) {
      return put(setId, "step", weight);
    },
    /** A weight typed in, being saved by its own write. Returns its token. */
    typed(setId, weight) {
      return put(setId, "typed", weight);
    },
    isEmpty() {
      return drafts.size === 0;
    },
    has(setId) {
      return drafts.has(keyOf(setId));
    },
    /** The weight on screen: the newest draft, else what is stored. */
    weightOf(setId, storedWeight = null) {
      const draft = drafts.get(keyOf(setId));

      return draft ? draft.weight : storedWeight;
    },
    /** The steps the next write carries, as [{ setId, weight, token }]. Kept until settled. */
    stepsToSave() {
      return [...drafts.entries()]
        .filter(([, draft]) => draft.kind === "step")
        .map(([setId, draft]) => ({ setId, weight: draft.weight, token: draft.token }));
    },
    /**
     * A write went through: each of its drafts still the newest for its set
     * is forgotten. Returns those sets' ids - the ones whose saved result the
     * screen can take; the others have something newer on screen.
     */
    settle(written = []) {
      const current = new Set();

      for (const entry of written) {
        const key = keyOf(entry?.setId);

        if (drafts.get(key)?.token === entry?.token) {
          drafts.delete(key);
          current.add(key);
        }
      }

      return current;
    },
    /** A typed weight's write failed: forgotten if still the newest. True when it was. */
    discard(setId, token) {
      const key = keyOf(setId);

      if (drafts.get(key)?.token !== token) {
        return false;
      }

      drafts.delete(key);

      return true;
    },
  };
}
