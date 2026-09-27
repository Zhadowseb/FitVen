// A workout's own clock, read from its row: running while `timer_start` is
// set, stopped - paused - once the time it ran is banked in `elapsed_time` and
// `timer_start` is cleared. A pause clears `is_active` along with the start
// (workoutRepository.persistWorkoutTimerState), so a paused workout is known
// by its `original_start_time` and nothing else.
//
// The square in the middle of the bottom navigation reads it: the time counts
// while the workout runs, stands still while it is paused, and counts on from
// there when it is resumed.
import { LIVE_WORKOUT_MAX_SECONDS } from "./liveWorkout";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "./timeUtils";

// A paused workout stops being the one in progress this long after it was
// started - the eight hours the lock-screen card gives it too, so the two
// agree on what is being trained. One left paused yesterday is left behind,
// and gives the square back to the plus.
export const PAUSED_WORKOUT_MAX_AGE_SECONDS = LIVE_WORKOUT_MAX_SECONDS;

/** Whether the workout's clock is counting now. */
export function isWorkoutClockRunning(workout) {
  return normalizeStoredTimestampSeconds(workout?.timer_start) !== null;
}

/**
 * The seconds on the workout's clock at `nowSeconds`: what is banked, plus the
 * stretch since the timer was last started while it runs. 0 for no workout.
 */
export function getWorkoutClockSeconds(workout, nowSeconds) {
  if (!workout) {
    return 0;
  }

  const banked = normalizeElapsedDurationSeconds(workout.elapsed_time, 0);
  const timerStart = normalizeStoredTimestampSeconds(workout.timer_start);

  if (timerStart === null) {
    return banked;
  }

  return banked + Math.max(0, Math.trunc(Number(nowSeconds) || 0) - timerStart);
}

/**
 * Of `rows` - started, unfinished workouts with their clock stopped, newest
 * start first - the one still in progress at `nowSeconds`, or null. The start
 * is normalised here rather than in SQL, because an old install can still hold
 * it in milliseconds.
 */
export function findPausedWorkoutInProgress(
  rows,
  nowSeconds,
  maxAgeSeconds = PAUSED_WORKOUT_MAX_AGE_SECONDS
) {
  const now = Math.trunc(Number(nowSeconds) || 0);

  return (
    (rows ?? []).find((row) => {
      if (Number(row?.done) === 1 || isWorkoutClockRunning(row)) {
        return false;
      }

      const startedAt = normalizeStoredTimestampSeconds(row?.original_start_time);

      return startedAt !== null && now - startedAt <= maxAgeSeconds;
    }) ?? null
  );
}
