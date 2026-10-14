// One step of the weight steppers (1e): how far + and − move a weight, and
// what a press does to one.
//
// The lock screen's weight buttons use this same rule (liveWeightStepFor in
// liveWorkout.js hands the card getWeightStep's answer), so a press moves a
// set by the same amount wherever it is made. What is on the bar decides how
// finely it can move: a pair of dumbbells goes up 2, a machine or a cable
// stack 5, a squat or a deadlift 5, everything else - the bench press among
// them - 2.5. A step set on the exercise itself wins over all of it, - the
// person's own, typed in the bar over the keyboard and kept per exercise.
//
// kg only: the app has no lb. Pure, so scripts/test-weight-mode.js loads it.
import { parseSetNumber } from "./setValueLimits";
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

/* ------------------------------------------- the step the person chose -- */

// The bar over the keyboard has a small field with the step. What is typed in
// it is kept for this exercise (Exercise_Column_Preference.weight_step), and
// is what + and - move by from then on - in the set list and on the lock
// screen - until it is cleared.
export const MIN_WEIGHT_STEP = 0.25;
export const MAX_WEIGHT_STEP = 50;
// Stored, and sent to the cloud, for "automatic". Not null: in the column
// preferences null means "not known" and a phone keeps its own value over it,
// so a cleared step stored as null would come back from the cloud.
export const AUTOMATIC_WEIGHT_STEP = 0;

/**
 * What a step typed in the field means:
 *  - empty: { action: "clear" } - the automatic step applies again;
 *  - a number: { action: "set", step } - "1,25" and "1.25" alike, rounded to a
 *    quarter kilo and kept between 0.25 and 50;
 *  - anything else, and 0 or less: { action: "keep" } - the field goes back to
 *    the step it had.
 */
export function parseWeightStepInput(text) {
  if (text === null || text === undefined || String(text).trim() === "") {
    return { action: "clear" };
  }

  const parsed = parseSetNumber(text);

  if (parsed === null || !(parsed > 0)) {
    return { action: "keep" };
  }

  const clamped = Math.min(Math.max(roundWeightToQuarter(parsed), MIN_WEIGHT_STEP), MAX_WEIGHT_STEP);

  return { action: "set", step: clamped };
}

/** A stored step as the step to use: null for none, 0 and anything unusable. */
export function storedWeightStep(value) {
  const own = Number(value);

  if (value === null || value === undefined || value === "" || !Number.isFinite(own) || own <= 0) {
    return null;
  }

  return Math.min(Math.max(roundWeightToQuarter(own), MIN_WEIGHT_STEP), MAX_WEIGHT_STEP);
}

/** The value written for a typed step: the step, or 0 for "automatic". */
export function weightStepToStore(parsed) {
  return parsed?.action === "set" ? parsed.step : AUTOMATIC_WEIGHT_STEP;
}

/* ------------------------------------------------------- the cloud column -- */

const WEIGHT_STEP_CLOUD_COLUMN = "weight_step";

/**
 * The cloud has no weight_step column on exercise_column_preferences yet: the
 * migration that adds it (20261014090000_a-step-per-exercise.sql) has not been
 * run. 42703 on a read, PGRST204 on a write, and a word match so another
 * missing column - weight_mode - is not mistaken for this one.
 */
export function isMissingWeightStepColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`;

  return (error?.code === "42703" || error?.code === "PGRST204") && /\bweight_step\b/.test(message);
}

/**
 * The payload as it may be sent: weight_step is left out when the cloud has no
 * such column, and when it is null ("not known" - a phone that never chose).
 * 0 is a value - automatic - and is sent, so a cleared step reaches the cloud.
 */
export function withSendableWeightStep(payload, { cloudHasColumn = true } = {}) {
  if (
    !payload ||
    !Object.prototype.hasOwnProperty.call(payload, WEIGHT_STEP_CLOUD_COLUMN) ||
    (cloudHasColumn && payload[WEIGHT_STEP_CLOUD_COLUMN] !== null && payload[WEIGHT_STEP_CLOUD_COLUMN] !== undefined)
  ) {
    return payload;
  }

  const { [WEIGHT_STEP_CLOUD_COLUMN]: _left, ...sendable } = payload;

  return sendable;
}

/**
 * The handle on the column for one app session, the pattern of
 * createWeightModeCloudColumn in ./weightMode.js: named until the cloud says
 * it is missing, then the request runs once more without it. `request` must
 * be safe to run twice.
 */
export function createWeightStepCloudColumn({ onMissing } = {}) {
  let missing = false;

  return {
    isAvailable() {
      return !missing;
    },

    selectColumns(baseColumns) {
      return missing ? baseColumns : `${baseColumns}, ${WEIGHT_STEP_CLOUD_COLUMN}`;
    },

    sendablePayload(payload) {
      return withSendableWeightStep(payload, { cloudHasColumn: !missing });
    },

    async withFallback(request) {
      try {
        return await request();
      } catch (error) {
        if (missing || !isMissingWeightStepColumnError(error)) {
          throw error;
        }

        missing = true;
        onMissing?.(error);

        return request();
      }
    },
  };
}
