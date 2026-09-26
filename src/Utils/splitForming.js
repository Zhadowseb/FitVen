// Home's split waits a week from the first finished workout.
//
// Somebody who trains one muscle group a day, six days a week, has no split
// anybody could recognise until the week has gone round once - a guess made
// on day four reads the first four days as the whole of it. So until seven
// days have passed, Home shows the split taking shape instead, a dot a day,
// even when splitGuess could already make groups. An account older than a
// week sees no difference.
//
// Pure, so scripts/test-home-quick-start.js runs it in Node.

export const SPLIT_FORMING_DAYS = 7;

function startOfLocalDay(at) {
  const date = new Date(at);

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

/**
 * `firstWorkoutAt` is when the first finished workout was, in ms
 * (workoutService.getFirstWorkoutAt), or null when there has not been one.
 * `groupCount` is how many groups the split guess made.
 *
 * `daysIn` counts calendar days in local time, not 24-hour blocks: a workout
 * late last night and a look this morning is one day in, and the second dot.
 * Rounded rather than floored, because the day the clocks change is 23 or 25
 * hours long. Null with no finished workout.
 *
 * `filledDots` fills the first dot on the day of the first workout and stops
 * at seven; it is 0 when there has been no workout. `weekIsOver` is true from
 * day seven on, split or not.
 */
export function splitFormingState({ firstWorkoutAt = null, now = Date.now(), groupCount = 0 } = {}) {
  if (typeof firstWorkoutAt !== "number" || !Number.isFinite(firstWorkoutAt)) {
    return { daysIn: null, filledDots: 0, showSplit: false, weekIsOver: false };
  }

  // A first workout dated after today - a planned one ticked off early - is
  // day one, not a negative day.
  const daysIn = Math.max(
    0,
    Math.round((startOfLocalDay(now) - startOfLocalDay(firstWorkoutAt)) / 86400000)
  );

  const weekIsOver = daysIn >= SPLIT_FORMING_DAYS;

  return {
    daysIn,
    filledDots: Math.min(SPLIT_FORMING_DAYS, daysIn + 1),
    showSplit: weekIsOver && Number(groupCount) > 0,
    // The week is behind them and the guess still has nothing: somebody who
    // has not repeated a session yet. "After your first week" would be a
    // promise already broken, so the row says what it is waiting for instead.
    weekIsOver,
  };
}
