import { getCurrentStoredTimestampSeconds } from "./timeUtils";

const restTimerListeners = new Set();
let activeRestTimer = null;

const emitRestTimer = () => {
  restTimerListeners.forEach((listener) => {
    listener(activeRestTimer);
  });
};

export function getActiveRestTimer() {
  if (
    activeRestTimer &&
    activeRestTimer.endsAt <= getCurrentStoredTimestampSeconds()
  ) {
    activeRestTimer = null;
  }

  return activeRestTimer;
}

export function startActiveRestTimer(timer) {
  const durationSeconds = Math.max(
    0,
    Math.round(Number(timer?.durationSeconds) || 0)
  );

  if (durationSeconds <= 0) {
    return null;
  }

  const startedAt =
    timer?.startedAt ?? getCurrentStoredTimestampSeconds();

  activeRestTimer = {
    ...timer,
    id:
      timer?.id ??
      `${timer?.workoutId ?? "workout"}:${timer?.setId ?? "set"}:${startedAt}`,
    durationSeconds,
    startedAt,
    endsAt: startedAt + durationSeconds,
  };

  emitRestTimer();
  return activeRestTimer;
}

/**
 * Moves the end of the running rest by `deltaSeconds` - the ±15 on the lock
 * screen. A rest pushed back to or past now is over, and is cleared.
 */
export function adjustActiveRestTimer(deltaSeconds, timerId = null) {
  const timer = getActiveRestTimer();
  const delta = Math.trunc(Number(deltaSeconds) || 0);

  if (!timer || delta === 0 || (timerId && timer.id !== timerId)) {
    return timer;
  }

  const endsAt = timer.endsAt + delta;

  if (endsAt <= getCurrentStoredTimestampSeconds()) {
    clearActiveRestTimer(timer.id);
    return null;
  }

  activeRestTimer = {
    ...timer,
    endsAt,
    durationSeconds: Math.max(1, timer.durationSeconds + delta),
  };

  emitRestTimer();
  return activeRestTimer;
}

export function clearActiveRestTimer(timerId = null) {
  if (!activeRestTimer) {
    return;
  }

  if (timerId && activeRestTimer.id !== timerId) {
    return;
  }

  activeRestTimer = null;
  emitRestTimer();
}

export function subscribeRestTimer(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  restTimerListeners.add(listener);
  listener(getActiveRestTimer());

  return () => {
    restTimerListeners.delete(listener);
  };
}
