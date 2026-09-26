// One visit to "Add exercise": what the workout held when the picker opened,
// and what this visit has added and taken out since.
//
// The + on a row adds the exercise, and pressed again takes it out. What that
// second press may do without asking depends on where the exercise came from:
//
//   * added on this visit - it is undone at once, no question. Somebody who
//     tapped the wrong row a second ago is correcting a slip, not deleting
//     their training.
//   * already in the workout when the picker opened - it may have sets
//     logged, so taking it out is asked first.
//
// The snapshot is what tells the two apart. It is taken once, when the picker
// opens; leaving the picker ends the visit, and the next one starts from what
// the workout holds by then - so an exercise added last visit counts as
// already there.
//
// Names are matched without regard to case, the way the rest of the app joins
// an exercise instance to its exercise. Pure, so
// scripts/test-exercise-picker.js runs it in Node.

const nameKey = (name) => (typeof name === "string" ? name.trim().toLocaleLowerCase() : "");

/** How the picker compares names: the list's rows against the session's keys. */
export const pickerNameKey = nameKey;

/**
 * A new visit, from the workout's exercises as they are now:
 * `[{ exerciseId, exerciseName }]`.
 */
export function createPickerSession(entries = []) {
  const snapshot = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = nameKey(entry?.exerciseName);
    // Number(null) is 0, a row id no row has.
    const exerciseId = entry?.exerciseId == null ? NaN : Number(entry.exerciseId);

    if (!key || !Number.isInteger(exerciseId) || exerciseId <= 0) {
      continue;
    }

    snapshot.set(key, [...(snapshot.get(key) ?? []), exerciseId]);
  }

  return { snapshot, added: new Map(), removed: new Set() };
}

/** Added on this visit and still in. */
export function wasAddedThisVisit(session, name) {
  return session.added.has(nameKey(name));
}

/** In the workout from before the picker opened, and not taken out since. */
export function wasAlreadyThere(session, name) {
  const key = nameKey(name);

  return session.snapshot.has(key) && !session.removed.has(key) && !session.added.has(key);
}

/** In the workout now, either way - what the row's + shows as ticked. */
export function isInWorkout(session, name) {
  return wasAddedThisVisit(session, name) || wasAlreadyThere(session, name);
}

/**
 * What a press on the + means:
 *   { action: "add" }
 *   { action: "undo", exerciseId }                   - added this visit; no question
 *   { action: "removeExisting", exerciseIds, count } - was there before; ask first
 */
export function planToggle(session, name) {
  const key = nameKey(name);

  if (!key) {
    return { action: "none" };
  }

  if (session.added.has(key)) {
    return { action: "undo", exerciseId: session.added.get(key) };
  }

  if (wasAlreadyThere(session, key)) {
    const exerciseIds = session.snapshot.get(key) ?? [];

    return { action: "removeExisting", exerciseIds, count: exerciseIds.length };
  }

  return { action: "add" };
}

export function withAdded(session, name, exerciseId) {
  const added = new Map(session.added);

  added.set(nameKey(name), Number(exerciseId));

  return { ...session, added };
}

export function withUndone(session, name) {
  const added = new Map(session.added);

  added.delete(nameKey(name));

  return { ...session, added };
}

export function withRemovedExisting(session, name) {
  const removed = new Set(session.removed);

  removed.add(nameKey(name));

  return { ...session, removed };
}

/** How many exercises this visit has put in, net - the count on "Done". */
export function addedThisVisitCount(session) {
  return session.added.size;
}
