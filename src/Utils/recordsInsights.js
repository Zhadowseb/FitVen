// Everything the Records screen shows, derived from the rows
// `getCompletedStrengthSetsForPersonalRecords` already returns. No new query
// and no migration: a row carries weight, reps, exercise name, workout id and
// an ISO-sortable date, which is enough for all of it.
//
// Pure on purpose. Dates come in as `now` so the caller decides what "today"
// is and the tests can pick a day.
import { calculateBrzyckiOneRepMax } from "./oneRepMaxUtils";

export const RECORDS_PERIODS = [
  { key: "3m", label: "3 mdr", days: 91 },
  { key: "1y", label: "1 år", days: 365 },
  { key: "all", label: "Alt", days: null },
];

// Section 7: an exercise has to have been logged with weight this many times,
// and recently enough, before it can be called improving or declining. One
// session with a heavy single should not be able to dominate the list.
const QUALIFYING_SESSIONS = 3;
const QUALIFYING_RECENCY_DAYS = 28;
const RECENT_WINDOW_DAYS = 28;
const PRIOR_WINDOW_DAYS = 56;
// Below this the direction is noise, not a trend.
const DIRECTION_THRESHOLD = 0.01;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRecordDate(value) {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }

  const timestamp = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function daysBetween(laterMs, earlierMs) {
  return (laterMs - earlierMs) / DAY_MS;
}

/**
 * The Monday of the week a timestamp falls in, as a UTC midnight timestamp.
 * Weeks start on Monday because the rest of the app does.
 */
export function startOfWeek(timestampMs) {
  const date = new Date(timestampMs);
  const weekday = (date.getUTCDay() + 6) % 7;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - weekday
  );
}

function normalizeRow(row) {
  const weight = Number(row?.weight);
  const reps = Number(row?.reps);
  const at = parseRecordDate(row?.performed_date_sort ?? row?.performed_date);
  const name =
    typeof row?.exercise_name === "string" ? row.exercise_name.trim() : "";

  if (!name || !at || !Number.isFinite(weight) || !Number.isFinite(reps)) {
    return null;
  }

  if (weight <= 0 || reps < 1) {
    return null;
  }

  return {
    name,
    weight,
    reps,
    at,
    volume: weight * reps,
    // The app has one 1RM formula and it is Brzycki. The design assumed Epley;
    // using it here would have put two formulas in one app, which is the thing
    // the design was trying to avoid.
    e1rm: calculateBrzyckiOneRepMax(weight, reps),
    isRecord: Number(row?.personal_record) === 1,
    workoutKey: row?.workout_id ?? row?.performed_date_sort ?? String(at),
    sessionKey: `${row?.workout_id ?? ""}::${row?.performed_date_sort ?? at}`,
  };
}

export function normalizeRecordRows(rows = []) {
  return rows
    .map(normalizeRow)
    .filter(Boolean)
    .sort((left, right) => left.at - right.at);
}

function bestE1rm(sets) {
  let best = null;

  for (const set of sets) {
    if (Number.isFinite(set.e1rm) && (best === null || set.e1rm > best)) {
      best = set.e1rm;
    }
  }

  return best;
}

function countSessions(sets) {
  return new Set(sets.map((set) => set.sessionKey)).size;
}

/**
 * Section 3.2. Weight progress per exercise, measured from the best estimated
 * 1RM before the window against the best inside it, so a decline can be shown
 * rather than hidden.
 */
export function buildExerciseGains(sets, { now, windowDays = 84 } = {}) {
  const windowStart = now - windowDays * DAY_MS;
  const byExercise = new Map();

  for (const set of sets) {
    const bucket = byExercise.get(set.name) ?? { before: [], inside: [] };

    (set.at < windowStart ? bucket.before : bucket.inside).push(set);
    byExercise.set(set.name, bucket);
  }

  const gains = [];

  for (const [name, bucket] of byExercise) {
    const bestNow = bestE1rm(bucket.inside);

    if (bestNow === null) {
      continue;
    }

    const bestBefore = bestE1rm(bucket.before);
    const sessionCount = countSessions(bucket.inside);
    const lastTrainedAt = bucket.inside[bucket.inside.length - 1]?.at ?? null;

    gains.push({
      name,
      bestBefore,
      bestNow,
      // Without a "before" there is no gain to show, only a first entry. The
      // screen says "ny" rather than inventing a percentage from zero.
      gainKg: bestBefore === null ? null : bestNow - bestBefore,
      gainPct:
        bestBefore === null || bestBefore === 0
          ? null
          : (bestNow - bestBefore) / bestBefore,
      sessionCount,
      lastTrainedAt,
      isNew: bestBefore === null,
    });
  }

  return gains;
}

/**
 * Section 7. Qualification is about trust in the number, so it is deliberately
 * stricter than "has any data": three sessions with weight, and trained within
 * the last four weeks.
 */
export function buildDirections(sets, { now } = {}) {
  const recentStart = now - RECENT_WINDOW_DAYS * DAY_MS;
  const priorStart = now - (RECENT_WINDOW_DAYS + PRIOR_WINDOW_DAYS) * DAY_MS;
  const byExercise = new Map();

  for (const set of sets) {
    const bucket = byExercise.get(set.name) ?? { all: [], recent: [], prior: [] };

    bucket.all.push(set);

    if (set.at >= recentStart) {
      bucket.recent.push(set);
    } else if (set.at >= priorStart) {
      bucket.prior.push(set);
    }

    byExercise.set(set.name, bucket);
  }

  const directions = [];

  for (const [name, bucket] of byExercise) {
    const sessionCount = countSessions(bucket.all);
    const lastAt = bucket.all[bucket.all.length - 1]?.at ?? null;
    const qualifies =
      sessionCount >= QUALIFYING_SESSIONS &&
      lastAt !== null &&
      daysBetween(now, lastAt) <= QUALIFYING_RECENCY_DAYS;

    if (!qualifies) {
      directions.push({ name, qualifies: false, direction: null, sessionCount });
      continue;
    }

    const recentBest = bestE1rm(bucket.recent);
    const priorBest = bestE1rm(bucket.prior);
    let direction = "flat";

    if (recentBest !== null && priorBest !== null && priorBest > 0) {
      const change = (recentBest - priorBest) / priorBest;

      if (change > DIRECTION_THRESHOLD) {
        direction = "up";
      } else if (change < -DIRECTION_THRESHOLD) {
        direction = "down";
      }
    } else if (recentBest !== null && priorBest === null) {
      direction = "up";
    }

    directions.push({ name, qualifies: true, direction, sessionCount });
  }

  return directions;
}

/**
 * Section 3.4. Kilos lifted per week with a four-week moving average.
 *
 * The average counts empty weeks as zero. Skipping them makes the line climb
 * through a break, which is the opposite of what the chart is for.
 */
export function buildWeeklyVolume(sets, { now, weeks = 12 } = {}) {
  const currentWeekStart = startOfWeek(now);
  const firstWeekStart = currentWeekStart - (weeks - 1) * 7 * DAY_MS;
  const totals = new Map();

  for (const set of sets) {
    const weekStart = startOfWeek(set.at);

    if (weekStart < firstWeekStart || weekStart > currentWeekStart) {
      continue;
    }

    totals.set(weekStart, (totals.get(weekStart) ?? 0) + set.volume);
  }

  const series = [];

  for (let index = 0; index < weeks; index += 1) {
    const weekStart = firstWeekStart + index * 7 * DAY_MS;
    const volume = totals.get(weekStart) ?? 0;
    const windowStartIndex = Math.max(0, index - 3);
    const windowValues = [];

    for (let step = windowStartIndex; step <= index; step += 1) {
      const stepStart = firstWeekStart + step * 7 * DAY_MS;

      windowValues.push(totals.get(stepStart) ?? 0);
    }

    series.push({
      weekStart,
      volume,
      isEmpty: volume === 0,
      average:
        windowValues.reduce((sum, value) => sum + value, 0) /
        windowValues.length,
    });
  }

  return series;
}

/**
 * Section 3.3. Rates rather than totals, each against the same length of time
 * immediately before the period, because "a record every 2-3 workouts" says
 * nothing until you know it used to be every 4.
 */
export function buildStats(sets, { now, days }) {
  const windowDays = days ?? null;

  const slice = (fromMs, toMs) =>
    sets.filter((set) => set.at >= fromMs && set.at < toMs);

  const currentFrom =
    windowDays === null
      ? (sets[0]?.at ?? now) - 1
      : now - windowDays * DAY_MS;
  const current = slice(currentFrom, now + DAY_MS);
  const previous =
    windowDays === null
      ? []
      : slice(currentFrom - windowDays * DAY_MS, currentFrom);

  const summarise = (windowSets) => {
    const workouts = new Set(windowSets.map((set) => set.sessionKey)).size;
    const records = windowSets.filter((set) => set.isRecord).length;

    return {
      workouts,
      records,
      perWorkout: workouts === 0 ? null : records / workouts,
      // "every n-th workout": the inverse of records per workout. Undefined
      // with no records, which is a real state and not a zero.
      workoutsPerRecord: records === 0 ? null : workouts / records,
    };
  };

  return { current: summarise(current), previous: summarise(previous) };
}

/**
 * Section 3.6. Needs the exercise-to-muscle-group mapping, which lives in the
 * cloud catalog rather than the local database, so the caller passes what it
 * has and this returns an empty list when it has nothing.
 */
export function buildMuscleGroupSets(sets, { groupsByExercise, now, days }) {
  if (!groupsByExercise || groupsByExercise.size === 0) {
    return [];
  }

  const from = days === null || days === undefined ? null : now - days * DAY_MS;
  const totals = new Map();

  for (const set of sets) {
    if (from !== null && set.at < from) {
      continue;
    }

    const groups = groupsByExercise.get(set.name.toLocaleLowerCase()) ?? [];

    for (const group of groups) {
      totals.set(group, (totals.get(group) ?? 0) + 1);
    }
  }

  return [...totals.entries()]
    .map(([label, setCount]) => ({ label, setCount }))
    .sort((left, right) => right.setCount - left.setCount);
}

/** Section 3.5. The most recent records, newest first. */
export function buildLatestRecords(sets, { limit = 8 } = {}) {
  return sets
    .filter((set) => set.isRecord)
    .slice()
    .sort((left, right) => right.at - left.at)
    .slice(0, limit)
    .map((set) => ({
      name: set.name,
      weight: set.weight,
      reps: set.reps,
      at: set.at,
    }));
}
