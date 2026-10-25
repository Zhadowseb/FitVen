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

/* --------------------------------------------- kept across a restart -- */

/**
 * What is kept of a post that is posting or has failed, so that a phone that
 * was shut - or an app the system closed - mid-post can offer the retry the
 * next time Home opens, instead of the person never knowing whether it went.
 * Null for anything else.
 */
export function pendingPostRecord(status, database = null) {
  if (!status || (status.state !== "posting" && status.state !== "failed")) {
    return null;
  }

  return {
    database,
    workoutId: status.workoutId,
    note: status.note ?? null,
    shareRoute: status.shareRoute ?? null,
    state: status.state,
    error: status.error ?? null,
  };
}

/**
 * The status a kept record comes back as: always "failed" - what was posting
 * when the app closed did not finish - with the reason it had, or "interrupted".
 * Null for a record that is another account's or not a post.
 */
export function restoredPostStatus(record, database = null) {
  const workoutId = Number(record?.workoutId);

  if (!record || !Number.isFinite(workoutId) || (record.database ?? null) !== (database ?? null)) {
    return null;
  }

  return {
    id: 0,
    workoutId,
    note: record.note ?? null,
    shareRoute: record.shareRoute ?? null,
    state: "failed",
    error: record.state === "failed" && record.error ? record.error : "interrupted",
  };
}
