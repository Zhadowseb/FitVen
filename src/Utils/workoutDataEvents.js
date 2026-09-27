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

// A set changed from the lock screen - ticked off, or its weight moved - and
// written without the workout screen, which reads its sets again when it
// hears this.
const lockScreenListeners = new Set();

/** `{ workoutId }` - the workout whose sets the lock screen just wrote. */
export function notifyLockScreenEdit(edit) {
  lockScreenListeners.forEach((listener) => {
    try {
      listener(edit);
    } catch (error) {
      console.error("A lock-screen edit listener failed:", error);
    }
  });
}

export function subscribeLockScreenEdits(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  lockScreenListeners.add(listener);

  return () => {
    lockScreenListeners.delete(listener);
  };
}
