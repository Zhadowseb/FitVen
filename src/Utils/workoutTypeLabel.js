// What a workout type, and a workout named after one, is called on screen.
//
// The types are stored in English - `Resistance`, `Upperbody`, `Legs`,
// `StrengthTraining`, `Run`, `Walk` and the rest - in Workout_Type.name, in a
// workout's `workout_type`, and often in its `label` too. They reached Danish
// users as "Resistance" and "Upperbody". What is stored does not change: only
// what is drawn goes through here.
//
// A label somebody typed is theirs and is drawn as typed, even when it spells
// a type id: "Run" or "Resistance" typed as a name stays "Run", "Resistance".
// Only a name the app wrote itself is drawn in the app's language - see
// isAppWorkoutName for which those are, and for the one case it cannot tell.
//
// Pure, with `t` passed in, so scripts/test-localization.js runs it in Node.

import { WORKOUT_CLASSIFICATION_LABELS } from "./workoutClassification";

// Lower-case id -> key in locales/<language>/workoutTypes.js. StrengthTraining
// is an older id for the same thing as Resistance, and gets the same name.
const WORKOUT_TYPE_KEYS = {
  resistance: "workoutTypes.resistance",
  strengthtraining: "workoutTypes.resistance",
  upperbody: "workoutTypes.upperbody",
  lowerbody: "workoutTypes.lowerbody",
  legs: "workoutTypes.legs",
  push: "workoutTypes.push",
  pull: "workoutTypes.pull",
  core: "workoutTypes.core",
  mobility: "workoutTypes.mobility",
  run: "workoutTypes.run",
  walk: "workoutTypes.walk",
};

// The types reclassifyWorkoutLabel (weightliftingService) names after their
// exercises - its CLASSIFIABLE_WORKOUT_TYPES, lower-cased.
const AUTO_NAMED_WORKOUT_TYPES = new Set([
  "resistance",
  "strengthtraining",
  "upperbody",
  "legs",
]);

// What it names them, spelled exactly as it writes them: "Push", "Legs",
// "Upperbody"...
const AUTO_NAMES = new Set(WORKOUT_CLASSIFICATION_LABELS);

// Every id spelled as the app stores it, for a caller with no type to compare.
const STORED_SPELLINGS = new Set([
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Lowerbody",
  "Legs",
  "Push",
  "Pull",
  "Core",
  "Mobility",
  "Run",
  "Walk",
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function keyFor(value) {
  const text = cleanText(value);

  return text ? WORKOUT_TYPE_KEYS[text.toLowerCase()] ?? null : null;
}

/** True when `value` is one of the stored type ids, in any case. */
export function isWorkoutTypeId(value) {
  return keyFor(value) !== null;
}

/**
 * Whether a workout's label is a name the app wrote rather than one somebody
 * typed. The app writes two kinds:
 *
 * - its type, for a workout nobody named: the insert falls back to it, and
 *   the display queries fall back to the type's catalog name;
 * - for a strength workout, the name reclassifyWorkoutLabel gives it after
 *   its exercises ("Push", "Legs", "Upperbody"), spelled exactly as it
 *   writes it.
 *
 * Anything else was typed. Pass the workout's type whenever the row has one:
 * it is what tells the fallback from a typed "Run" or "Resistance". Without
 * it, only a label spelled exactly as the app stores an id counts.
 *
 * The one case a label cannot settle: somebody typing exactly one of the
 * auto-names ("Legs") on a strength workout. Nothing stored says who wrote
 * it - reclassifyWorkoutLabel treats that label as its own too, and renames
 * it when the exercises change. Telling them apart needs a stored flag.
 */
export function isAppWorkoutName(label, workoutType = null) {
  const text = cleanText(label);
  const type = cleanText(workoutType);

  if (!text) {
    return false;
  }

  if (!type) {
    return STORED_SPELLINGS.has(text);
  }

  if (text.toLowerCase() === type.toLowerCase()) {
    return true;
  }

  return AUTO_NAMED_WORKOUT_TYPES.has(type.toLowerCase()) && AUTO_NAMES.has(text);
}

/**
 * A workout type's name in the app's language: "Resistance" -> "Styrketræning".
 * A type this app does not know yet (a new one in the cloud catalog) is shown
 * as it is stored rather than not at all. Null for nothing.
 */
export function workoutTypeLabel(type, t) {
  const key = keyFor(type);

  if (key && typeof t === "function") {
    return t(key);
  }

  return cleanText(type) || null;
}

/**
 * A workout's name on screen: the label as typed, unless the app wrote it
 * (isAppWorkoutName) - then its name in the app's language; the type's name
 * when there is no label. Null when there is neither, so the caller can pick
 * its own fallback. Pass `workoutType` whenever the row has it.
 */
export function workoutDisplayName(label, t, workoutType = null) {
  const text = cleanText(label);

  if (!text) {
    return workoutTypeLabel(workoutType, t);
  }

  return isAppWorkoutName(text, workoutType) ? workoutTypeLabel(text, t) : text;
}
