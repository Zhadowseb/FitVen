// What a workout type, and a workout named after one, is called on screen.
//
// The types are stored in English - `Resistance`, `Upperbody`, `Legs`,
// `StrengthTraining`, `Run`, `Walk` and the rest - in Workout_Type.name, in a
// workout's `workout_type`, and often in its `label` too, because a workout
// nobody named is labelled with its type. They reached Danish users as
// "Resistance" and "Upperbody". What is stored does not change: only what is
// drawn goes through here.
//
// A label the user typed is theirs and stays as typed. Only a label that is
// one of the type ids is replaced by that type's name - so "Push" or "Ben dag"
// is left alone, and "Resistance" becomes "Styrketræning".
//
// Pure, with `t` passed in, so scripts/test-localization.js runs it in Node.

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
 * A workout's name on screen. The label the user gave it when there is one,
 * translated only when it is a type id itself; otherwise the name of its
 * type. Null when there is neither, so the caller can pick its own fallback.
 */
export function workoutDisplayName(label, t, workoutType = null) {
  const text = cleanText(label);

  if (text) {
    return isWorkoutTypeId(text) ? workoutTypeLabel(text, t) : text;
  }

  return workoutTypeLabel(workoutType, t);
}
