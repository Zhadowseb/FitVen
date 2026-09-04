// Run and Walk are switched off for the first public release: the tracking
// side is not ready, so the types must not be startable or plannable. The
// code stays in place — this list is the only thing to change when they ship.
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
