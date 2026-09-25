// The last set somebody ticked off or unticked, for the Quick start panel on
// Home: which workout, which set, whether it is done now, and whether it set
// a personal record. Module state with listeners - the same shape as
// restTimerEvents and workoutPostEvents - so Home, waiting under the workout
// screen, can refresh the moment a set is finished, and knows which set just
// earned a record.

const listeners = new Set();
let last = null;

function emit() {
  listeners.forEach((listener) => {
    listener(last);
  });
}

export function getLastWorkoutSetChange() {
  return last;
}

/** `{ workoutId, setId, done, failed, personalRecord }`, stamped with when. */
export function notifyWorkoutSetChanged(change) {
  if (!change) {
    return;
  }

  last = {
    workoutId: Number(change.workoutId),
    setId: Number(change.setId),
    done: Boolean(change.done),
    failed: Boolean(change.failed),
    personalRecord: Boolean(change.personalRecord),
    at: Date.now(),
  };
  emit();
}

/** Calls `listener` with the last change now and with every one after. */
export function subscribeWorkoutSetChanges(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  listener(last);

  return () => {
    listeners.delete(listener);
  };
}
