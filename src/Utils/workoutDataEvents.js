// "The local strength data changed": a set, an exercise or a workout row was
// written on this phone. Raised where every such write already ends up - the
// three background uploads for sets, exercises and workouts - so a listener
// hears all of them without each service function having to remember to say
// so. The lock-screen card listens, and rebuilds itself from the database.
//
// Module state with listeners, the same shape as restTimerEvents and
// workoutSetEvents. It carries no payload worth trusting: a listener reads
// what it needs.

const listeners = new Set();

/** `scope` is "sets", "exercises" or "workouts" - which upload was started. */
export function notifyWorkoutDataChanged(scope) {
  listeners.forEach((listener) => {
    try {
      listener(scope);
    } catch (error) {
      console.error("A workout data listener failed:", error);
    }
  });
}

export function subscribeWorkoutDataChanges(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
