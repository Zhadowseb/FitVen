// One step of the weight steppers (1e): how far + and − move a weight, and
// what a press does to one.
//
// The same rule as the lock screen's weight buttons (liveWeightStepFor on the
// Android card), so a press moves a set by the same amount wherever it is
// made. What is on the bar decides how finely it can move: a pair of
// dumbbells goes up 2, a machine or a cable stack 5, a squat or a deadlift 5,
// everything else - the bench press among them - 2.5. A step set on the
// exercise itself wins over all of it, for the day there is a setting.
//
// kg only: the app has no lb. Pure, so scripts/test-weight-mode.js loads it.

export const DEFAULT_WEIGHT_STEP = 2.5;
const DUMBBELL_STEP = 2;
const HEAVY_STEP = 5;
const STEP_ROUNDING = 0.25;

/** To the nearest quarter kilo, so 0.1 + 0.2 never reads 102.49999. */
export function roundWeightToQuarter(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number((Math.round(numeric / STEP_ROUNDING) * STEP_ROUNDING).toFixed(2));
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
