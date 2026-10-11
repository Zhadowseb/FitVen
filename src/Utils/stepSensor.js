// Turns the readings of the phone's own step counter into steps for each day.
// Pure: the readings are handed in, and nothing here knows about the phone.
//
// The counter says how many steps the phone has counted since it was last
// started, and keeps counting while the app is closed. A reading is
// { time, counter, bootTime } - when it was taken, the counter, and when the
// phone started, all in ms since 1970 except the counter. Two readings and the
// difference between them is the steps in between; this puts those steps on the
// days they happened on.
//
// It is the last of the three sources (Utils/dailyStepLog.js): used only for a
// day no health app has a number for, and always an estimate, because the
// readings are only taken when the app is open and, in between, by a job the
// system runs when it likes. So the rules are about doing that honestly:
//   * steps between two readings are spread over the time between them, split
//     at midnight, so a walk at 23:50 does not all land on one day;
//   * over a long silence (the phone off, the job killed) the steps are put in
//     the hours a person is awake, not in the night;
//   * a restart (the counter goes back to zero) is not a negative number of
//     steps - the steps since the start are the steps since the start;
//   * a number no body could walk is clamped.

// A restart is told by the counter going down, or by the phone's start moving
// by more than the clock's own drift.
export const BOOT_TOLERANCE_MS = 90 * 1000;
// Up to this the steps are spread evenly over the time; beyond it, over the
// hours the person is awake.
export const LONG_GAP_MS = 6 * 60 * 60 * 1000;
export const WAKING_FROM_HOUR = 7;
export const WAKING_UNTIL_HOUR = 22;
// A sleeping hour still counts for a little: the person may have walked in it.
export const SLEEPING_WEIGHT = 0.1;
// Faster than a sprint, for as long as the readings are apart, is a fault.
export const MAX_STEPS_PER_SECOND = 5;

const pad = (value) => String(value).padStart(2, "0");

const isoOfLocal = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const isReading = (value) =>
  value &&
  Number.isFinite(value.time) &&
  Number.isFinite(value.counter) &&
  value.counter >= 0 &&
  Number.isFinite(value.bootTime);

/** The readings that can be used, oldest first, one for each moment. */
export function cleanReadings(readings) {
  const seen = new Set();

  return (readings ?? [])
    .filter(isReading)
    .sort((left, right) => left.time - right.time)
    .filter((reading) => {
      if (seen.has(reading.time)) {
        return false;
      }

      seen.add(reading.time);
      return true;
    });
}

/**
 * Puts `steps` on the days between `start` and `end` (ms): in proportion to the
 * time, split at local midnights, or - over a long gap - in proportion to the
 * hours a person is awake. Returns { "2026-10-05": 3.2, ... } with fractions
 * kept, so adding intervals up loses nothing.
 */
export function spreadOverDays(start, end, steps) {
  if (!(end > start) || !(steps > 0)) {
    return {};
  }

  const awakeOnly = end - start > LONG_GAP_MS;
  const chunks = [];
  let cursor = start;

  // An hour at a time, by the phone's own clock, so a day that is 23 or 25
  // hours long is cut where the clock cuts it.
  while (cursor < end) {
    const date = new Date(cursor);
    const nextHour = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
    const stop = Math.min(end, nextHour > cursor ? nextHour : cursor + 3600000);
    const awake = date.getHours() >= WAKING_FROM_HOUR && date.getHours() < WAKING_UNTIL_HOUR;

    chunks.push({
      day: isoOfLocal(date),
      weight: (stop - cursor) * (awakeOnly && !awake ? SLEEPING_WEIGHT : 1),
    });
    cursor = stop;
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.weight, 0);
  const days = {};

  for (const chunk of chunks) {
    days[chunk.day] = (days[chunk.day] ?? 0) + (steps * chunk.weight) / total;
  }

  return days;
}

/**
 * The steps for each day that the readings after `anchor` add up to, and the
 * reading to count from next time. `anchor` is the last reading that was
 * already counted (null the first time: counting starts there, and nothing
 * before it is guessed). Counting the readings in two batches, the second
 * starting from the first's `anchor`, gives what counting them in one would.
 */
export function incrementsFromReadings(readings, anchor = null) {
  const ordered = cleanReadings(readings).filter((reading) => !anchor || reading.time > anchor.time);
  const days = {};
  let previous = anchor && isReading(anchor) ? anchor : null;

  for (const reading of ordered) {
    if (!previous) {
      previous = reading;
      continue;
    }

    const restarted =
      reading.counter < previous.counter ||
      Math.abs(reading.bootTime - previous.bootTime) > BOOT_TOLERANCE_MS;
    // After a restart the counter is the steps since the start, and they were
    // walked between the start and now (not before the reading it replaces).
    const from = restarted ? Math.max(previous.time, reading.bootTime) : previous.time;
    const to = reading.time;
    let steps = restarted ? reading.counter : reading.counter - previous.counter;

    if (to > from && steps > 0) {
      steps = Math.min(steps, ((to - from) / 1000) * MAX_STEPS_PER_SECOND);

      for (const [day, share] of Object.entries(spreadOverDays(from, to, steps))) {
        days[day] = (days[day] ?? 0) + share;
      }
    }

    previous = reading;
  }

  return { days, anchor: previous };
}
