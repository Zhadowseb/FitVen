// Run and Walk are switched off for the first public release: the tracking
// side is not ready, so the types must not be startable or plannable. The
// code stays in place — this list is the only thing to change when they ship.
//
// They used to be shown greyed out with a COMING SOON stamp. They are now left
// out of every list that offers a type at all: App Store review guideline 2.1
// treats a control that announces a feature and then refuses it as an
// unfinished app, and it is not a control anyone can use meanwhile.
//
// Workouts a user already recorded are a different thing - they are that
// user's history, not an offer - so those rows stay where they are, still
// carrying the badge and still refusing to open.
const COMING_SOON_TYPES = new Set([
  "run",
  "runs",
  "running",
  "walk",
  "walks",
  "walking",
]);

export const COMING_SOON_LABEL = "COMING SOON";

/** True for a workout type id/label that is not released yet. */
export function isWorkoutTypeComingSoon(type) {
  if (typeof type !== "string") {
    return false;
  }

  return COMING_SOON_TYPES.has(type.trim().toLowerCase());
}

/**
 * Same check against a workout row. Falls back to the label only when the row
 * has no type, so a resistance workout the user named "Run" is not caught.
 */
export function isWorkoutComingSoon(workout) {
  return isWorkoutTypeComingSoon(workout?.workout_type ?? workout?.label);
}

/**
 * Drops the unreleased types from a list that offers types to choose from.
 *
 * `getType` reads the type out of one entry; the default suits a plain list of
 * type ids.
 */
export function filterReleasedWorkoutTypes(items, getType = (item) => item) {
  return (items ?? []).filter((item) => !isWorkoutTypeComingSoon(getType(item)));
}
