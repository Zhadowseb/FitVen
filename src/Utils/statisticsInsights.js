// Everything the Statistics page and its deep dives show, from the rows the
// services already read: the strength sets (normalizeRecordRows), every
// finished workout of any kind, the finished segments of runs and walks, and
// the type of every finished set. Three normalisers below turn the last three
// into small records with a day on them; the rest is arithmetic over those.
//
// Pure on purpose, like recordsInsights: `now` comes in from the screen, which
// freezes it, so the tests can pick a day. No React and no react-native here -
// scripts/test-statistics-insights.js loads this file in plain Node.
import { MAX_ESTIMATE_REPS } from "./oneRepMaxUtils";
import {
  RECORDS_PERIODS,
  buildExerciseList,
  parseRecordDate,
  startOfWeek,
} from "./recordsInsights";
import { SET_TYPES, resolveSetType } from "./setTypes";
import { normalizeElapsedDurationSeconds } from "./timeUtils";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// The volume chart's rule, so a bar means the same on every chart of the
// page: a bar a week up to three months, a bar a month beyond, and never more
// than two years of months.
const WEEKLY_UP_TO_DAYS = 91;
const MAX_MONTH_BUCKETS = 24;

/** The deep dives, in the order the Statistics page lists them. */
export const STATISTICS_METRICS = ["intensity", "frequency", "setTypes", "runs", "exercises"];

/**
 * Relative intensity in the five bands the intensity page draws. A set goes
 * in the first band it is below; labels live in "statistics.intensity.zones".
 */
export const INTENSITY_ZONES = [
  { key: "below60", below: 0.6 },
  { key: "from60", below: 0.7 },
  { key: "from70", below: 0.8 },
  { key: "from80", below: 0.9 },
  { key: "from90", below: Infinity },
];

/** From here a set counts as heavy. */
export const HEAVY_INTENSITY = 0.85;

/**
 * RPE in four bands. RPE is kept with one decimal, and a half point rounds
 * up: 8.5 is a 9. Labels live in "statistics.intensity.rpe.bands".
 */
export const RPE_BANDS = [
  { key: "upTo7", below: 7.5 },
  { key: "rpe8", below: 8.5 },
  { key: "rpe9", below: 9.5 },
  { key: "rpe10", below: Infinity },
];

/** A run shorter than this cannot be the fastest: a dash for the bus is not a pace. */
export const FASTEST_RUN_MIN_KM = 1;

/* ------------------------------------------------------------- periods -- */

/**
 * Today, counted the way the rows count days: the UTC midnight of the phone's
 * own calendar day. A row's day is stored like that (parseRecordDate) while
 * `now` is an instant, and compared as they are the two disagree for the
 * first hours of every day east of Greenwich - Monday's workout would land in
 * the week before.
 */
export function dayOf(now) {
  const date = new Date(now);

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A period from RECORDS_PERIODS as a range of days: `from` is the first day
 * in it and `to` the day after the last, so four weeks are today and the 27
 * days before it. `from` is null for the whole history. An unknown key is the
 * three months the overview also falls back to.
 */
export function resolvePeriod(periodKey, now) {
  const period =
    RECORDS_PERIODS.find((entry) => entry.key === periodKey) ?? RECORDS_PERIODS[1];
  const today = dayOf(now);

  return {
    key: period.key,
    days: period.days,
    today,
    from: period.days === null ? null : today - (period.days - 1) * DAY_MS,
    to: today + DAY_MS,
  };
}

export function isInPeriod(at, period) {
  return (
    Number.isFinite(at) &&
    (period.from === null || at >= period.from) &&
    at < period.to
  );
}

function insidePeriod(items, period) {
  return items.filter((item) => isInPeriod(item.at, period));
}

/**
 * A share as a whole percentage that never contradicts the bar beside it:
 * something that is there is at least 1 %, and something short of all of it
 * at most 99 %.
 */
export function wholePercent(share) {
  if (!Number.isFinite(share) || share <= 0) {
    return 0;
  }

  if (share >= 1) {
    return 100;
  }

  return Math.min(99, Math.max(1, Math.round(share * 100)));
}

function sumOf(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

/* --------------------------------------------------------- normalising -- */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function rowDay(row) {
  return parseRecordDate(row?.performed_date_sort ?? row?.performed_date);
}

/**
 * What a workout was, from its stored type. Run and Walk are their own; every
 * other type in the catalog - Resistance, and the older Upperbody, Legs and
 * StrengthTraining - is a strength session.
 */
export function workoutKind(type) {
  if (type === "Run") {
    return "run";
  }

  if (type === "Walk") {
    return "walk";
  }

  return "strength";
}

/**
 * Finished workouts, one per workout and oldest first: the day, the kind, and
 * how long it took in seconds - 0 when no time was kept.
 */
export function normalizeStatisticsWorkouts(rows = []) {
  const seen = new Set();
  const workouts = [];

  for (const row of rows) {
    const at = rowDay(row);
    const id = row?.workout_id ?? null;

    if (at === null || (id !== null && seen.has(id))) {
      continue;
    }

    if (id !== null) {
      seen.add(id);
    }

    workouts.push({
      id,
      at,
      kind: workoutKind(row?.workout_type),
      seconds: normalizeElapsedDurationSeconds(row?.elapsed_time, 0),
    });
  }

  return workouts.sort((left, right) => left.at - right.at);
}

/**
 * One entry per finished run or walk, added up from its finished segments:
 * how far and for how long, warm-up and cool-down included - they were
 * covered too. Rows of any other kind of workout are left out.
 */
export function normalizeRunSegments(rows = []) {
  const byWorkout = new Map();

  for (const row of rows) {
    const at = rowDay(row);
    const id = row?.workout_id ?? null;
    const kind = workoutKind(row?.workout_type);

    if (at === null || id === null || kind === "strength") {
      continue;
    }

    const entry = byWorkout.get(id) ?? { id, at, kind, km: 0, seconds: 0 };
    const km = toNumber(row?.actual_distance);

    entry.km += km !== null && km > 0 ? km : 0;
    entry.seconds += normalizeElapsedDurationSeconds(row?.actual_duration_seconds, 0);
    byWorkout.set(id, entry);
  }

  return [...byWorkout.values()].sort((left, right) => left.at - right.at);
}

/**
 * Every finished set as its type and day, warm-ups included, with its reps
 * and - on an AMRAP set - the target. The type honours the AMRAP flag an
 * older app version writes instead of set_type.
 */
export function normalizeSetTypeRows(rows = []) {
  const sets = [];

  for (const row of rows) {
    const at = rowDay(row);

    if (at === null) {
      continue;
    }

    const reps = toNumber(row?.reps);
    const target = toNumber(row?.amrap_target);

    sets.push({
      at,
      type: resolveSetType(row),
      reps: reps !== null && reps >= 0 ? reps : null,
      amrapTarget: target !== null && target > 0 ? target : null,
    });
  }

  return sets.sort((left, right) => left.at - right.at);
}

/* ------------------------------------------------------------ buckets -- */

function startOfMonth(timestampMs) {
  const date = new Date(timestampMs);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function addMonths(monthStart, count) {
  const date = new Date(monthStart);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1);
}

function monthsBetween(fromMonth, toMonth) {
  const from = new Date(fromMonth);
  const to = new Date(toMonth);

  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
}

/**
 * The bars of a chart in the period, the way the volume chart draws them: a
 * bar a week up to three months, a bar a month beyond, and for the whole
 * history from the first month with anything in it, at most two years back.
 * Every bar is a whole week or month, the first one too, so a bar always
 * means the same stretch of time. `amountOf` is what an item adds to its bar -
 * one each unless it says otherwise.
 */
export function buildPeriodBuckets(items = [], { period, amountOf = () => 1 }) {
  let unit;
  let starts;

  if (period.days !== null && period.days <= WEEKLY_UP_TO_DAYS) {
    const weeks = Math.max(1, Math.ceil(period.days / 7));
    const lastWeek = startOfWeek(period.today);

    unit = "week";
    starts = Array.from({ length: weeks }, (_, index) => lastWeek - (weeks - 1 - index) * WEEK_MS);
  } else {
    const lastMonth = startOfMonth(period.today);
    let firstMonth;

    if (period.days === null) {
      const firstAt = items.reduce(
        (first, item) => (Number.isFinite(item.at) && item.at < first ? item.at : first),
        period.today
      );

      firstMonth = startOfMonth(firstAt);

      if (monthsBetween(firstMonth, lastMonth) >= MAX_MONTH_BUCKETS) {
        firstMonth = addMonths(lastMonth, -(MAX_MONTH_BUCKETS - 1));
      }
    } else {
      firstMonth = addMonths(lastMonth, -(Math.round(period.days / 30.44) - 1));
    }

    unit = "month";
    starts = [];

    for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
      starts.push(month);
    }
  }

  const bucketOf = unit === "week" ? startOfWeek : startOfMonth;
  const totals = new Map(starts.map((start) => [start, 0]));

  for (const item of items) {
    if (!Number.isFinite(item.at)) {
      continue;
    }

    const start = bucketOf(item.at);

    if (totals.has(start)) {
      totals.set(start, totals.get(start) + amountOf(item));
    }
  }

  return {
    unit,
    buckets: starts.map((start) => {
      const value = totals.get(start);

      return { start, value, isEmpty: value === 0 };
    }),
  };
}

/* ---------------------------------------------------------- frequency -- */

function trainedWeeks(workouts) {
  return new Set(
    workouts.filter((workout) => Number.isFinite(workout.at)).map((workout) => startOfWeek(workout.at))
  );
}

/**
 * Weeks in a row with at least one workout: up to this week when you have
 * trained in it, up to last week when you have not - a week that has only
 * just begun has not broken anything yet. `includesThisWeek` says which.
 */
export function buildCurrentStreak(workouts = [], { now }) {
  const weeks = trainedWeeks(workouts);
  const thisWeek = startOfWeek(dayOf(now));
  const includesThisWeek = weeks.has(thisWeek);
  let week = includesThisWeek ? thisWeek : thisWeek - WEEK_MS;
  let length = 0;

  // Mondays at UTC midnight are exactly a week apart: UTC has no clock change.
  while (weeks.has(week)) {
    length += 1;
    week -= WEEK_MS;
  }

  return { weeks: length, includesThisWeek };
}

/** The longest run of weeks in a row with at least one workout, in the whole history. */
export function buildLongestStreak(workouts = []) {
  const weeks = [...trainedWeeks(workouts)].sort((left, right) => left - right);
  let longest = 0;
  let run = 0;
  let previous = null;

  for (const week of weeks) {
    run = previous !== null && week - previous === WEEK_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = week;
  }

  return longest;
}

/** Workouts on each weekday in the period, Monday first. */
export function buildWeekdayCounts(workouts = [], { period }) {
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const workout of insidePeriod(workouts, period)) {
    counts[(new Date(workout.at).getUTCDay() + 6) % 7] += 1;
  }

  return counts;
}

/**
 * Workouts per week in the period, null when there are none. The weeks are
 * counted from the start of the period, or from the first workout ever when
 * that came later - two weeks of training are not a quarter of a year of it -
 * and never fewer than one, so a first workout today is one a week, not seven.
 */
export function averagePerWeek(workouts = [], { period }) {
  const count = insidePeriod(workouts, period).length;

  if (count === 0) {
    return null;
  }

  const firstAt = workouts.reduce(
    (first, workout) => (Number.isFinite(workout.at) && workout.at < first ? workout.at : first),
    Infinity
  );
  const start = period.from === null ? firstAt : Math.max(period.from, firstAt);

  return count / Math.max(1, (period.to - start) / WEEK_MS);
}

/**
 * The frequency deep dive: how often, how steadily, on which days, for how
 * long and what kind. Time counts only the workouts that kept one.
 */
export function buildFrequency(workouts = [], { period, now }) {
  const inside = insidePeriod(workouts, period);
  const timed = inside.filter((workout) => workout.seconds > 0);
  const totalSeconds = sumOf(timed, (workout) => workout.seconds);
  const byKind = { strength: 0, run: 0, walk: 0 };

  for (const workout of inside) {
    byKind[workout.kind] = (byKind[workout.kind] ?? 0) + 1;
  }

  return {
    count: inside.length,
    perWeek: averagePerWeek(workouts, { period }),
    chart: buildPeriodBuckets(workouts, { period }),
    streak: buildCurrentStreak(workouts, { now }),
    longestStreak: buildLongestStreak(workouts),
    weekdays: buildWeekdayCounts(workouts, { period }),
    totalSeconds,
    averageSeconds: timed.length > 0 ? totalSeconds / timed.length : null,
    timedCount: timed.length,
    byKind,
  };
}

/* ---------------------------------------------------------- intensity -- */

function isWorkSet(set) {
  return set.setType === "working" || set.setType === "amrap";
}

// What a set says about the 1RM: its estimate, and never less than the weight
// itself, which a 1RM can only be above. Past MAX_ESTIMATE_REPS the estimate
// stops meaning anything - twenty reps doubles the weight - so a long, light
// set cannot set a best that nothing heavy could come close to.
function referenceMax(set) {
  const estimate =
    set.reps <= MAX_ESTIMATE_REPS && Number.isFinite(set.e1rm) ? set.e1rm : 0;

  return Math.max(set.weight, estimate);
}

/**
 * Every working and AMRAP set with its relative intensity: its weight against
 * the best estimated 1RM of the exercise up to and including its own day. The
 * best runs over the whole history, so an exercise's first session is
 * measured against itself and nothing goes over 100 %. Drop sets are left out
 * on both sides: the lighter half of a set is neither an effort worth
 * measuring nor a best to measure against.
 */
export function buildRelativeIntensities(sets = []) {
  const byExercise = new Map();

  for (const set of sets) {
    if (!isWorkSet(set) || !Number.isFinite(set.at) || !(set.weight > 0)) {
      continue;
    }

    const list = byExercise.get(set.name) ?? [];

    list.push(set);
    byExercise.set(set.name, list);
  }

  const measured = [];

  for (const list of byExercise.values()) {
    list.sort((left, right) => left.at - right.at);
    let best = 0;
    let start = 0;

    while (start < list.length) {
      let end = start;

      // A day's own sets count toward the best they are measured against.
      while (end < list.length && list[end].at === list[start].at) {
        best = Math.max(best, referenceMax(list[end]));
        end += 1;
      }

      for (let index = start; index < end; index += 1) {
        measured.push({ ...list[index], intensity: list[index].weight / best });
      }

      start = end;
    }
  }

  return measured.sort((left, right) => left.at - right.at);
}

/** The key of the INTENSITY_ZONES band an intensity falls in. */
export function intensityZone(intensity) {
  return (INTENSITY_ZONES.find((zone) => intensity < zone.below) ?? INTENSITY_ZONES[INTENSITY_ZONES.length - 1]).key;
}

/** The key of the RPE_BANDS band an RPE falls in. */
export function rpeBand(rpe) {
  return (RPE_BANDS.find((band) => rpe < band.below) ?? RPE_BANDS[RPE_BANDS.length - 1]).key;
}

function shareOut(bands, keyOf, items) {
  const counts = new Map(bands.map((band) => [band.key, 0]));

  for (const item of items) {
    const key = keyOf(item);

    counts.set(key, counts.get(key) + 1);
  }

  return bands.map((band) => ({
    key: band.key,
    count: counts.get(band.key),
    share: items.length > 0 ? counts.get(band.key) / items.length : 0,
  }));
}

/**
 * The intensity deep dive for the period: the average relative intensity,
 * the share of sets in each zone, the heavy sets, and - when any set in the
 * period has one - the RPE, as its average and the share at each band.
 */
export function buildIntensity(sets = [], { period }) {
  const inside = insidePeriod(buildRelativeIntensities(sets), period);
  const rated = inside.filter((set) => Number.isFinite(set.rpe) && set.rpe > 0);

  return {
    count: inside.length,
    average:
      inside.length > 0 ? sumOf(inside, (set) => set.intensity) / inside.length : null,
    zones: shareOut(INTENSITY_ZONES, (set) => intensityZone(set.intensity), inside),
    heavyCount: inside.filter((set) => set.intensity >= HEAVY_INTENSITY).length,
    rpe:
      rated.length === 0
        ? null
        : {
            count: rated.length,
            average: sumOf(rated, (set) => set.rpe) / rated.length,
            bands: shareOut(RPE_BANDS, (set) => rpeBand(set.rpe), rated),
          },
  };
}

/* ---------------------------------------------------------- set types -- */

/**
 * How the period's sets divide between the four types, warm-ups included:
 * the count and share of each, in SET_TYPES order. For the AMRAP sets that
 * had a target, how many reps past it they went on average - short of it is
 * negative. `amrap` is null when no AMRAP set had a target.
 */
export function buildSetTypeShares(setTypes = [], { period }) {
  const inside = insidePeriod(setTypes, period);
  const counts = new Map(SET_TYPES.map((type) => [type, 0]));

  for (const set of inside) {
    counts.set(set.type, (counts.get(set.type) ?? 0) + 1);
  }

  const targeted = inside.filter(
    (set) => set.type === "amrap" && set.amrapTarget !== null && set.reps !== null
  );

  return {
    total: inside.length,
    types: SET_TYPES.map((type) => ({
      type,
      count: counts.get(type),
      share: inside.length > 0 ? counts.get(type) / inside.length : 0,
    })),
    amrap:
      targeted.length === 0
        ? null
        : {
            count: targeted.length,
            averageOverTarget:
              sumOf(targeted, (set) => set.reps - set.amrapTarget) / targeted.length,
          },
  };
}

/**
 * The drop sets' share of the kilos lifted in the period. Read from the
 * strength sets, which carry the weight the set-type rows do not; warm-ups
 * are not in them, and add nothing to volume anyway. Null with no volume.
 */
export function buildDropVolumeShare(sets = [], { period }) {
  let total = 0;
  let drop = 0;

  for (const set of insidePeriod(sets, period)) {
    total += set.volume;

    if (set.setType === "drop") {
      drop += set.volume;
    }
  }

  return total > 0 ? drop / total : null;
}

/* --------------------------------------------------------------- runs -- */

/** Seconds per kilometre as "m:ss", or null when there is no pace to show. */
export function formatPace(secondsPerKm) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return null;
  }

  const total = Math.round(secondsPerKm);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Seconds as whole hours and minutes, rounded to the minute. */
export function splitDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const minutes = Math.round(seconds / 60);

  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

function paceOf(run) {
  return run.km > 0 && run.seconds > 0 ? run.seconds / run.km : null;
}

/**
 * The runs deep dive for the period. Walks are counted apart. The average
 * pace is the total time over the total distance of the runs that have both,
 * so a run logged without a distance does not slow it down; the fastest run
 * is the best pace over at least FASTEST_RUN_MIN_KM, and the longest the most
 * kilometres. Pace is in seconds per kilometre.
 */
export function buildRunSummary(runs = [], { period }) {
  const inside = insidePeriod(runs, period);
  const onlyRuns = inside.filter((run) => run.kind === "run");
  const walks = inside.filter((run) => run.kind === "walk");
  const paced = onlyRuns.filter((run) => paceOf(run) !== null);
  const pacedKm = sumOf(paced, (run) => run.km);
  let fastest = null;
  let longest = null;

  for (const run of onlyRuns) {
    const pace = paceOf(run);

    // A hair under the minimum still counts: segment distances are summed in
    // floating point, and 0.7 + 0.3 must be a kilometre.
    if (pace !== null && run.km >= FASTEST_RUN_MIN_KM - 1e-9 && (fastest === null || pace < fastest.pace)) {
      fastest = { ...run, pace };
    }

    if (run.km > 0 && (longest === null || run.km > longest.km)) {
      longest = { ...run, pace };
    }
  }

  return {
    count: onlyRuns.length,
    km: sumOf(onlyRuns, (run) => run.km),
    seconds: sumOf(onlyRuns, (run) => run.seconds),
    pace: pacedKm > 0 ? sumOf(paced, (run) => run.seconds) / pacedKm : null,
    fastest,
    longest,
    chart: buildPeriodBuckets(
      runs.filter((run) => run.kind === "run"),
      { period, amountOf: (run) => run.km }
    ),
    walks: { count: walks.length, km: sumOf(walks, (run) => run.km) },
  };
}

/* ---------------------------------------------------------- exercises -- */

/**
 * Every exercise trained in the period, in the shape of recordsInsights'
 * buildExerciseList and most recently trained first: its heaviest lift in
 * the period and when it was last trained. Which way it is going is read
 * from the whole history, as the list always has - the last four weeks
 * against the eight before - since a period cut short has nothing before it.
 */
export function buildPeriodExercises(sets = [], { period, now }) {
  const directions = new Map(
    buildExerciseList(sets, { now }).map((entry) => [entry.name, entry.direction])
  );

  return buildExerciseList(insidePeriod(sets, period), { now }).map((entry) => ({
    ...entry,
    direction: directions.get(entry.name) ?? null,
  }));
}

/* ------------------------------------------------------------ teasers -- */

/**
 * The one number each deep dive shows in its row on the Statistics page, for
 * the period. A metric with nothing in the period is null, and the row shows
 * a dash. The set types name the biggest share that is not a working set,
 * or the working sets alone when there is nothing else.
 */
export function buildTeasers({ sets = [], workouts = [], runs = [], setTypes = [] } = {}, { period }) {
  const intensity = buildIntensity(sets, { period });
  const perWeek = averagePerWeek(workouts, { period });
  const shares = buildSetTypeShares(setTypes, { period });
  const running = buildRunSummary(runs, { period });
  const exercises = new Set(insidePeriod(sets, period).map((set) => set.name)).size;
  const [biggestOther] = shares.types
    .filter((entry) => entry.type !== "working" && entry.count > 0)
    .sort((left, right) => right.count - left.count);

  return {
    intensity: intensity.average === null ? null : { average: intensity.average },
    frequency: perWeek === null ? null : { perWeek },
    setTypes:
      shares.total === 0
        ? null
        : biggestOther
          ? { type: biggestOther.type, share: biggestOther.share }
          : { type: "working", share: 1 },
    runs: running.count === 0 ? null : { km: running.km, count: running.count },
    exercises: exercises === 0 ? null : { count: exercises },
  };
}
