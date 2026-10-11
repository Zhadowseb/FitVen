import { getStepZone, trainingStepsForSeconds } from "./stepZones";

// A day's steps, put together from the three places they come from, and the
// sums the Steps page and the Statistics section show. Pure: the phone's step
// count, the walks and the strength workouts are read by Services/stepsService.js
// and handed in as plain rows.
//
//   phone steps    what the phone's health app counted all day (walk steps are
//                  inside this number already)
//   walks          the steps counted during Walk workouts; they only say how
//                  much of the phone's number was "Walks" rather than "Everyday"
//   training       finished strength workouts as step equivalents, computed
//
// Walked steps and training are never mixed into one unmarked number: a day
// carries both, and `active` is their sum for the zone.

export const SWEET_SPOT_STEPS = 7000;

const pad = (value) => String(value).padStart(2, "0");

/* ----------------------------------------------------------------- dates -- */

/** "2026-10-10" -> a Date at UTC midnight, so adding days ignores daylight saving. */
function utcDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function isoOf(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(iso, count) {
  const date = utcDate(iso);

  date.setUTCDate(date.getUTCDate() + count);

  return isoOf(date);
}

/** Today in the phone's own time, as "YYYY-MM-DD". */
export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday of the week the day is in. */
export function startOfWeek(iso) {
  const weekday = utcDate(iso).getUTCDay();

  return addDays(iso, -((weekday + 6) % 7));
}

export function datesBetween(fromIso, toIso) {
  const dates = [];

  for (let date = fromIso; date <= toIso; date = addDays(date, 1)) {
    dates.push(date);
  }

  return dates;
}

export function monthRange(iso) {
  const date = utcDate(iso);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

  return { from: isoOf(first), to: isoOf(last) };
}

/* ------------------------------------------------------------------- day -- */

/**
 * One day, from what was read for it:
 *   { date, phoneSteps: number | null, walkSteps, walkDistanceKm,
 *     workouts: [{ id, label, seconds }] }
 * `phoneSteps` is null when there is no health source for it (no access, no
 * such history). Then the walks are all there is, and a day with neither has no
 * number at all - not a zero.
 */
export function buildDay(row, { countTraining = true, theme } = {}) {
  const walkSteps = Math.max(0, Number(row.walkSteps) || 0);
  const phone = Number.isFinite(row.phoneSteps) ? Math.max(0, row.phoneSteps) : null;
  const workouts = (row.workouts ?? []).map((workout) => ({
    ...workout,
    steps: trainingStepsForSeconds(workout.seconds),
  }));
  const training = countTraining ? workouts.reduce((sum, workout) => sum + workout.steps, 0) : 0;

  let source = "none";
  let walked = null;

  if (phone !== null) {
    source = "phone";
    // The walk's own counter can be ahead of the health app for a moment.
    walked = Math.max(phone, walkSteps);
  } else if (walkSteps > 0) {
    source = "walks";
    walked = walkSteps;
  }

  const walks = walked === null ? 0 : Math.min(walkSteps, walked);
  const everyday = walked === null ? 0 : Math.max(0, walked - walks);
  const active = walked === null && training === 0 ? null : (walked ?? 0) + training;

  return {
    date: row.date,
    source,
    walked,
    walks,
    everyday,
    training,
    trainingWorkouts: countTraining ? workouts : [],
    active,
    distanceKm: Number(row.walkDistanceKm) > 0 ? Number(row.walkDistanceKm) : 0,
    zone: active === null ? null : getStepZone(active, theme),
  };
}

/* ---------------------------------------------------------------- period -- */

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * What a run of days adds up to. Only days that have a number count: a day with
 * no data is not a day of zero steps, and does not pull an average down.
 */
export function summarisePeriod(days, { theme } = {}) {
  const counted = days.filter((day) => day.active !== null);
  const total = sum(counted.map((day) => day.active));
  const walkedTotal = sum(counted.map((day) => day.walked ?? 0));
  const trainingTotal = sum(counted.map((day) => day.training));
  const walksTotal = sum(counted.map((day) => day.walks));
  const everydayTotal = sum(counted.map((day) => day.everyday));
  const distanceKm = sum(days.map((day) => day.distanceKm));
  const count = counted.length;
  const average = count > 0 ? Math.round(total / count) : null;
  const best = counted.reduce((top, day) => (top === null || day.active > top.active ? day : top), null);

  return {
    days: count,
    total,
    walkedTotal,
    trainingTotal,
    walksTotal,
    everydayTotal,
    average,
    averageWalked: count > 0 ? Math.round(walkedTotal / count) : null,
    averageTraining: count > 0 ? Math.round(trainingTotal / count) : null,
    sweetSpotDays: counted.filter((day) => day.active >= SWEET_SPOT_STEPS).length,
    best,
    distanceKm: distanceKm > 0 ? distanceKm : null,
    zone: average === null ? null : getStepZone(average, theme),
    // Shares of the activity, in whole percent, for the "where it came from" bar.
    shares:
      total > 0
        ? {
            walks: Math.round((walksTotal / total) * 100),
            everyday: Math.round((everydayTotal / total) * 100),
            training: Math.round((trainingTotal / total) * 100),
          }
        : null,
  };
}

/** The strength workouts in a run of days, newest last: { date, id, label, seconds, steps }. */
export function listTrainingWorkouts(days) {
  return days.flatMap((day) =>
    day.trainingWorkouts.map((workout) => ({ date: day.date, ...workout }))
  );
}

/** Per week (Monday to Sunday): the average of the days that have a number. */
export function groupByWeek(days) {
  const weeks = new Map();

  for (const day of days) {
    const start = startOfWeek(day.date);

    weeks.set(start, [...(weeks.get(start) ?? []), day]);
  }

  return [...weeks.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([start, weekDays]) => ({ start, ...summarisePeriod(weekDays) }));
}

/** The change from one period's number to the next, in whole percent. */
export function changePercent(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }

  return Math.round(((current - previous) / previous) * 100);
}
