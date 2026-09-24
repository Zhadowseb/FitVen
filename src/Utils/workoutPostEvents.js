// Where the workout post the person just sent has got to, for the bar on
// Home: "posting", "posted" or "failed", or null when there is nothing to
// say. Module state with listeners - the same shape as restTimerEvents - so
// the workout screen can hand the post off and leave, and Home, mounted or
// not, picks the status up when it looks.

const listeners = new Set();
let current = null;

function emit() {
  listeners.forEach((listener) => {
    listener(current);
  });
}

export function getWorkoutPostStatus() {
  return current;
}

export function setWorkoutPostStatus(next) {
  current = next ?? null;
  emit();
}

/** Only if `id` is still the post the status is about - a newer one wins. */
export function updateWorkoutPostStatus(id, changes) {
  if (!current || current.id !== id) {
    return;
  }

  current = { ...current, ...changes };
  emit();
}

export function clearWorkoutPostStatus(id = null) {
  if (id !== null && current?.id !== id) {
    return;
  }

  current = null;
  emit();
}

/** Calls `listener` with the status now and on every change after. */
export function subscribeWorkoutPost(listener) {
  listeners.add(listener);
  listener(current);

  return () => {
    listeners.delete(listener);
  };
}
