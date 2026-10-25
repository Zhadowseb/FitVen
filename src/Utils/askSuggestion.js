// A suggested change from Ask FitVen, checked on the phone and turned into the
// sets it would write. Pure (Node-testable).
//
// The function validates a suggestion before it leaves it; this checks it
// again, because it is what reaches the database - the contract's ranges
// (docs/ASK-FITVEN.md) are the app's own rules too.

export const MAX_SUGGESTION_ENTRIES = 6;
export const MAX_SUGGESTION_TOTAL_SETS = 30;
const LIMIT = 100;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function integerIn(value, min, max) {
  const number = Number(value);

  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function numberIn(value, min, max) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= min && number <= max
    ? Math.round(number * 100) / 100
    : null;
}

/**
 * A `suggestion` block as the screen may use it, or null: a target that is the
 * next workout with a label, an exercise name, and 1-6 entries of reps 1-100,
 * weight 0-1000 and count 1-10 (at most 30 sets in all). Nothing is repaired -
 * a suggestion that is slightly wrong is not applied at all.
 */
export function normalizeSuggestion(raw) {
  if (!raw || typeof raw !== "object" || raw.type !== "suggestion") {
    return null;
  }

  const label = cleanText(raw.target?.label, 80);
  const exercise = cleanText(raw.change?.exercise, 80);

  if (raw.target?.kind !== "next_workout" || !label || !exercise) {
    return null;
  }

  const entries = Array.isArray(raw.change?.sets) ? raw.change.sets : [];

  if (entries.length < 1 || entries.length > MAX_SUGGESTION_ENTRIES) {
    return null;
  }

  const sets = [];
  let total = 0;

  for (const entry of entries) {
    const reps = integerIn(entry?.reps, 1, LIMIT);
    const weight = numberIn(entry?.weight, 0, 1000);
    const count = integerIn(entry?.count ?? 1, 1, 10);

    if (reps === null || weight === null || count === null) {
      return null;
    }

    total += count;
    sets.push({ reps, weight, count });
  }

  if (total > MAX_SUGGESTION_TOTAL_SETS) {
    return null;
  }

  return {
    type: "suggestion",
    target: { kind: "next_workout", label },
    change: { exercise, sets },
    text: cleanText(raw.text, 400),
  };
}

/** `4 x 5 at 102.5, 1 x 8 at 90` as the sets it writes, in order. */
export function expandSuggestionSets(change) {
  const sets = [];

  for (const entry of change?.sets ?? []) {
    for (let index = 0; index < entry.count; index += 1) {
      sets.push({ reps: entry.reps, weight: entry.weight });
    }
  }

  return sets;
}

// The columns of a set a person can see and edit - what Undo has to bring back.
export const RESTORED_SET_FIELDS = [
  "pause",
  "rpe",
  "weight",
  "rm_percentage",
  "reps",
  "done",
  "failed",
  "amrap",
  "set_type",
  "amrap_target",
  "note",
];

/** The exercise's sets, in order, as plain values: the snapshot Undo restores from. */
export function snapshotSets(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .sort((left, right) => Number(left.set_number) - Number(right.set_number))
    .map((row) => {
      const copy = {};

      for (const field of RESTORED_SET_FIELDS) {
        copy[field] = row[field] === undefined ? null : row[field];
      }

      return copy;
    });
}

/** The snapshot as saveExerciseSets wants it: numbered 1..n. */
export function restorePayload(snapshot) {
  return snapshot.map((set, index) => ({ ...set, set_number: index + 1 }));
}

/**
 * A label matches a workout's when they are the same words without regard to
 * case, spacing or accents ("Push A" and " push  a ").
 */
export function normalizeWorkoutLabel(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function sameExerciseName(left, right) {
  return normalizeWorkoutLabel(left) === normalizeWorkoutLabel(right);
}
