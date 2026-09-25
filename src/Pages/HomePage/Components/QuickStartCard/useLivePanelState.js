import { useEffect, useRef, useState } from "react";

import {
  RECORD_HOLD_MS,
  focusSetFor,
  isPlannedWorkout,
  liveElapsedSeconds,
  pendingRecordFor,
  resolveLiveView,
  restCountdown,
  restRanOut,
} from "@utils/liveQuickStart";
import { getActiveRestTimer, subscribeRestTimer } from "@utils/restTimerEvents";
import { getCurrentStoredTimestampSeconds } from "@utils/timeUtils";

// For as long as the app runs, so Home can come and go under the workout
// screen without forgetting: which workouts turned out to be planned, and
// which records have already been celebrated.
const plannedWorkouts = new Set();
const celebratedRecords = new Set();

function belongsTo(timer, workoutId) {
  return Boolean(timer) && Number(timer.workoutId) === Number(workoutId);
}

/**
 * Everything the live panel decides, second by second: the clock, the rest
 * timer and whether it has just run out, whether a record is waiting to be
 * celebrated, and from those the view and the set it talks about.
 *
 * `visible` is Home on screen with the app in front. The clock only ticks
 * then, and a record only starts its 3.2 s then: one set on the workout
 * screen is waiting on Home when somebody comes back to it.
 */
export default function useLivePanelState({ workout, live, visible }) {
  const workoutId = workout?.workoutId ?? null;
  const isThisWorkout = Boolean(live) && Number(live.workoutId) === Number(workoutId);
  const progress = isThisWorkout ? live.progress : null;
  const recentSetId = isThisWorkout ? live.recentSetId ?? null : null;
  const doneSets = progress?.doneSets ?? 0;
  const [now, setNow] = useState(getCurrentStoredTimestampSeconds);
  const [restTimer, setRestTimer] = useState(() => getActiveRestTimer());
  // The rest that ran out, and how many sets were done when it did: "ready"
  // lasts until the next set is.
  const [ranOut, setRanOut] = useState(null);
  const [, setCelebrated] = useState(0);
  const lastTimerRef = useRef(restTimer);
  const doneSetsRef = useRef(doneSets);

  doneSetsRef.current = doneSets;

  useEffect(() => {
    return subscribeRestTimer((timer) => {
      const previous = lastTimerRef.current;
      const nowSeconds = getCurrentStoredTimestampSeconds();

      lastTimerRef.current = timer;

      // Cleared at its end, rather than cancelled by unticking the set or
      // pausing the workout.
      if (!timer && belongsTo(previous, workoutId) && restRanOut(previous, nowSeconds)) {
        setRanOut({ workoutId, timerId: previous.id, doneSets: doneSetsRef.current });
      }

      setRestTimer(timer);
      setNow(nowSeconds);
    });
  }, [workoutId]);

  // A second hand while there is something to see: the elapsed time, and
  // the rest counting down.
  useEffect(() => {
    if (!visible || workoutId === null) {
      return undefined;
    }

    setNow(getCurrentStoredTimestampSeconds());

    const interval = setInterval(() => {
      setNow(getCurrentStoredTimestampSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, workoutId]);

  const timer = belongsTo(restTimer, workoutId) ? restTimer : null;
  const rest = restCountdown(timer, now);
  const resting = Boolean(rest) && rest.remaining > 0;
  const timerId = timer?.id ?? null;
  const restRemaining = rest?.remaining ?? null;

  // A rest that reached zero while it was still the timer on record ran out
  // just as surely as one somebody else cleared at its end.
  useEffect(() => {
    if (timerId !== null && restRemaining === 0) {
      setRanOut((current) =>
        current?.timerId === timerId
          ? current
          : { workoutId, timerId, doneSets: doneSetsRef.current }
      );
    }
  }, [restRemaining, timerId, workoutId]);

  // Planned once it has had sets waiting - and then for good.
  useEffect(() => {
    if (workoutId !== null && progress && isPlannedWorkout(progress)) {
      plannedWorkouts.add(workoutId);
    }
  }, [progress, workoutId]);

  const ready =
    !resting &&
    Boolean(ranOut) &&
    Number(ranOut.workoutId) === Number(workoutId) &&
    ranOut.doneSets === doneSets;
  const planned = workoutId !== null && isPlannedWorkout(progress, plannedWorkouts.has(workoutId));
  const record = pendingRecordFor(progress, recentSetId, celebratedRecords);
  const recordId = record?.setId ?? null;

  // The record holds the panel for 3.2 s of being looked at, then it is done.
  useEffect(() => {
    if (recordId === null || !visible) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      celebratedRecords.add(recordId);
      setCelebrated((count) => count + 1);
    }, RECORD_HOLD_MS);

    return () => clearTimeout(timeout);
  }, [recordId, visible]);

  const view = resolveLiveView({ progress, planned, resting, ready, record });

  return {
    view,
    focus: focusSetFor(view, progress),
    progress,
    record,
    rest,
    // Which rest this is, so the drain starts once for each.
    restKey: timerId,
    // Which run-out the panel is flashing for, so it flashes once for each.
    readyKey: ready ? ranOut.timerId : null,
    elapsed: liveElapsedSeconds(
      { timerStart: workout?.timerStart ?? null, elapsedTime: workout?.elapsedTime ?? 0 },
      now
    ),
  };
}
