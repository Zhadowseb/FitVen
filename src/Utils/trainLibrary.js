// The Train tab's library tiles, "Your form" and the two tools, worked out from
// the rows the services read: finished workouts, the days records were set on,
// sickness periods, programs and their weeks, strength sets and the catalog.
//
// Pure on purpose, like recordsInsights and statisticsInsights: no React, no
// react-native, no database. `now` comes in from the caller, so the tests can
// pick a day, and scripts/test-train-library.js loads this file in plain Node.
//
// Days are UTC midnights throughout, the way parseRecordDate stores a row's
// day, and "today" is dayOf(now) - the phone's own calendar day on that scale.
// A week starts on Monday, which makes every week an ISO week.
import {
  MAX_ESTIMATE_REPS,
  calculateBrzyckiOneRepMax,
  roundToNearestWeightIncrement,
} from "./oneRepMaxUtils";
import { buildMuscleGroupSets, parseRecordDate, startOfWeek } from "./recordsInsights";
import { buildPeriodBuckets, dayOf } from "./statisticsInsights";
import { normalizeWorkoutRows } from "./trophyRoom";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Section 6.1: a week counts toward the streak from this many finished
 * workouts. A constant for now; it can become a setting later.
 */
export const STREAK_MIN_WORKOUTS = 3;

/** How many weeks each chart covers, this week included. */
export const WORKOUT_TILE_WEEKS = 8;
export const RECORD_TILE_WEEKS = 8;
export const FORM_WEEKS = 12;

/** The Exercises tile: the busiest muscle groups over this many days. */
export const MUSCLE_GROUP_DAYS = 90;
export const MUSCLE_GROUP_LIMIT = 6;
export const MUSCLE_LEGEND_LIMIT = 3;

/** The 1RM tool: the best set over this many days. */
export const ONE_REP_MAX_DAYS = 30;

/** The Programs tile draws a bar a program, up to this many. */
export const PROGRAM_BAR_LIMIT = 5;

/**
 * A name longer than this does not fit beside a set in the 1RM tool: at
 * 375 pt the row has about 120 pt, and "102.5 × 12" takes half of it.
 */
export const ABBREVIATION_MAX_LENGTH = 10;

/* ---------------------------------------------------------------- days -- */

/** A UTC-midnight day as "yyyy-mm-dd". */
export function isoDay(dayMs) {
  return new Date(dayMs).toISOString().slice(0, 10);
}

/**
 * The first day of the last `days` days, today included, as "yyyy-mm-dd" -
 * what a repository takes as `sinceIsoDate`.
 */
export function windowStartIso(now, days) {
  return isoDay(dayOf(now) - (days - 1) * DAY_MS);
}

/**
 * A stored day - "dd.mm.yyyy", the way Day, Program and Sickness write it,
 * or ISO - as a UTC midnight, or null. A day that does not exist is not one:
 * Date.parse would read 31.02 as the 3rd of March.
 */
export function parseDayValue(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const local = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso = local ? `${local[3]}-${local[2]}-${local[1]}` : text.slice(0, 10);
  const at = parseRecordDate(iso);

  return at !== null && isoDay(at) === iso ? at : null;
}

/**
 * The last `weeks` weeks, this one included, as a period in the shape
 * statisticsInsights' resolvePeriod gives - which buildPeriodBuckets draws a
 * bar a week for, up to three months of them.
 */
function lastWeeksPeriod(now, weeks) {
  const today = dayOf(now);
  const days = weeks * 7;

  return { key: null, days, today, from: today - (days - 1) * DAY_MS, to: today + DAY_MS };
}

/**
 * A bar a week for the `weeks` weeks ending with this one, oldest first: the
 * Statistics page's own weekly buckets, so a bar means the same week there and
 * here. The height is a share of the busiest week (`ratio`, 0 to 1); the
 * screen turns it into pixels and gives an empty week its minimum. `amountOf`
 * is what an item adds to its week - one, unless it says otherwise.
 */
export function buildWeekBars(items = [], { now, weeks, amountOf = () => 1 }) {
  const { buckets } = buildPeriodBuckets(items, { period: lastWeeksPeriod(now, weeks), amountOf });
  const busiest = Math.max(0, ...buckets.map((bucket) => bucket.value));
  const thisWeek = startOfWeek(dayOf(now));

  return buckets.map((bucket) => ({
    weekStart: bucket.start,
    count: bucket.value,
    ratio: busiest > 0 ? bucket.value / busiest : 0,
    isCurrent: bucket.start === thisWeek,
  }));
}

/**
 * Finished workouts per week over the whole history - Monday -> how many -
 * which the streak walks back through for as long as it lasts.
 */
export function countByWeek(workouts = []) {
  const counts = new Map();

  for (const workout of workouts) {
    if (Number.isFinite(workout?.at)) {
      const week = startOfWeek(workout.at);

      counts.set(week, (counts.get(week) ?? 0) + 1);
    }
  }

  return counts;
}

/* ------------------------------------------------------------ sickness -- */

/**
 * Sickness rows as ranges of days, from the first day to the last - or to
 * today while it is still going. Days after today are left out: they have
 * not happened yet, so they are neither sick days nor sick weeks. A row
 * whose dates cannot be read, or that ends before it starts, is dropped.
 */
export function normalizeSicknessPeriods(rows = [], { now }) {
  const today = dayOf(now);
  const periods = [];

  for (const row of rows) {
    const from = parseDayValue(row?.start_date);
    const hasEnd = typeof row?.end_date === "string" && row.end_date.trim() !== "";
    const end = hasEnd ? parseDayValue(row.end_date) : today;

    if (from === null || end === null) {
      continue;
    }

    const to = Math.min(end, today);

    if (to >= from) {
      periods.push({ from, to });
    }
  }

  return periods;
}

/** The Mondays of every week with at least one sick day in it. */
export function buildSickWeeks(periods = []) {
  const weeks = new Set();

  for (const period of periods) {
    for (let week = startOfWeek(period.from); week <= period.to; week += WEEK_MS) {
      weeks.add(week);
    }
  }

  return weeks;
}

/**
 * Section 7: the sick days of this calendar year, up to today, and how many
 * fell in each month. Overlapping periods count a day once.
 */
export function buildSickDays(periods = [], { now }) {
  const today = dayOf(now);
  const year = new Date(today).getUTCFullYear();
  const currentMonth = new Date(today).getUTCMonth();
  const yearStart = Date.UTC(year, 0, 1);
  const days = new Set();

  for (const period of periods) {
    const to = Math.min(period.to, today);

    for (let day = Math.max(period.from, yearStart); day <= to; day += DAY_MS) {
      days.add(day);
    }
  }

  const perMonth = Array.from({ length: 12 }, () => 0);

  for (const day of days) {
    perMonth[new Date(day).getUTCMonth()] += 1;
  }

  return {
    year,
    total: days.size,
    months: perMonth.map((count, month) => ({
      month,
      days: count,
      isCurrent: month === currentMonth,
      isUpcoming: month > currentMonth,
    })),
  };
}

/* ------------------------------------------------------ workouts, form -- */

/**
 * Section 6.1. Weeks in a row with at least `minWorkouts` finished workouts,
 * counted back from last week:
 * - this week is added once it has reached the threshold, and until then it
 *   breaks nothing - it is not over yet;
 * - a week with a sick day in it neither breaks the run nor counts toward it.
 *
 * `weekStarts` are the weeks that counted, for the bars.
 */
export function buildWeekStreak(
  countsByWeek,
  { now, sickWeeks = new Set(), minWorkouts = STREAK_MIN_WORKOUTS }
) {
  const thisWeek = startOfWeek(dayOf(now));
  const counted = [];
  // Mondays at UTC midnight are exactly a week apart: UTC has no clock change.
  // The walk ends at the first week short of the threshold; sick weeks are
  // stepped over, and there are only ever finitely many of them.
  let week = thisWeek - WEEK_MS;

  while (true) {
    if (sickWeeks.has(week)) {
      week -= WEEK_MS;
      continue;
    }

    if ((countsByWeek.get(week) ?? 0) < minWorkouts) {
      break;
    }

    counted.push(week);
    week -= WEEK_MS;
  }

  const includesThisWeek =
    !sickWeeks.has(thisWeek) && (countsByWeek.get(thisWeek) ?? 0) >= minWorkouts;

  if (includesThisWeek) {
    counted.push(thisWeek);
  }

  return { weeks: counted.length, weekStarts: new Set(counted), includesThisWeek };
}

/**
 * What the bars add up to, a week, to one decimal. "Your form" gives it its
 * own twelve bars, this week included, so the number beside the chart is the
 * chart's.
 */
export function weeklyAverage(bars = []) {
  if (bars.length === 0) {
    return 0;
  }

  const total = bars.reduce((sum, bar) => sum + bar.count, 0);

  return Math.round((total / bars.length) * 10) / 10;
}

/** The Workouts tile: every finished workout, this week's, and eight weekly bars. */
export function buildWorkoutsTile(workouts = [], { now }) {
  const bars = buildWeekBars(workouts, { now, weeks: WORKOUT_TILE_WEEKS });

  return {
    total: workouts.length,
    thisWeek: bars[bars.length - 1].count,
    bars,
  };
}

/** "Your form": the streak, the weekly average and twelve weekly bars. */
export function buildFormCard(
  workouts = [],
  { now, sickWeeks = new Set(), minWorkouts = STREAK_MIN_WORKOUTS }
) {
  const streak = buildWeekStreak(countByWeek(workouts), { now, sickWeeks, minWorkouts });
  const bars = buildWeekBars(workouts, { now, weeks: FORM_WEEKS });

  return {
    streak: streak.weeks,
    includesThisWeek: streak.includesThisWeek,
    minWorkouts,
    average: weeklyAverage(bars),
    bars: bars.map((bar) => ({
      ...bar,
      inStreak: streak.weekStarts.has(bar.weekStart),
      isSick: sickWeeks.has(bar.weekStart),
    })),
  };
}

/* ------------------------------------------------------------- records -- */

/**
 * The rows of trainRepository.getPersonalRecordCountsByDay - a day and how
 * many records were set on it - as { at, count }, oldest first.
 */
export function normalizeRecordDays(rows = []) {
  const days = [];

  for (const row of rows) {
    const at = parseRecordDate(row?.performed_date_sort ?? row?.performed_date);
    const count = Number(row?.record_count);

    if (at !== null && Number.isFinite(count) && count > 0) {
      days.push({ at, count });
    }
  }

  return days.sort((left, right) => left.at - right.at);
}

/**
 * The Records tile: every record, this week's, and a staircase of the records
 * set over the last eight weeks, added up week by week from nothing. `ratio`
 * is each step against the top one; with no records it is 0 all along, which
 * draws a flat line.
 */
export function buildRecordsTile(recordDays = [], { now }) {
  let running = 0;
  const steps = buildWeekBars(recordDays, {
    now,
    weeks: RECORD_TILE_WEEKS,
    amountOf: (day) => day.count,
  }).map(({ weekStart, count }) => {
    running += count;

    return { weekStart, count, cumulative: running };
  });

  return {
    total: recordDays.reduce((sum, day) => sum + day.count, 0),
    thisWeek: steps[steps.length - 1].count,
    steps: steps.map((step) => ({ ...step, ratio: running > 0 ? step.cumulative / running : 0 })),
  };
}

/**
 * The staircase as an SVG path: from the bottom left, up to each week's level
 * at the start of that week, and along it to the next. `ratios` run 0 to 1;
 * `inset` keeps a stroke of twice its width inside the box.
 */
export function buildStaircasePath(ratios = [], { width, height, inset = 1 }) {
  if (!(width > 0) || !(height > 0) || ratios.length === 0) {
    return "";
  }

  const left = inset;
  const top = inset;
  const bottom = height - inset;
  const stepWidth = (width - 2 * inset) / ratios.length;
  const round = (value) => Math.round(value * 100) / 100;
  const levelOf = (ratio) =>
    round(bottom - Math.min(1, Math.max(0, Number(ratio) || 0)) * (bottom - top));
  let path = `M${round(left)} ${round(bottom)}`;

  ratios.forEach((ratio, index) => {
    path += ` V${levelOf(ratio)} H${round(left + (index + 1) * stepWidth)}`;
  });

  return path;
}

/* ----------------------------------------------------------- exercises -- */

/**
 * How many exercises the catalog holds, counted the way the catalog screen
 * lists them: one per name, whatever its case, and none without a name.
 */
export function countCatalogExercises(rows = []) {
  const names = new Set();

  for (const row of rows) {
    const name = row?.exercise_name ?? row?.name;
    const key = typeof name === "string" ? name.trim().toLocaleLowerCase() : "";

    if (key) {
      names.add(key);
    }
  }

  return names.size;
}

/**
 * The Exercises tile's bar: the muscle groups with the most sets over the
 * last ninety days, busiest first, each with its share of the bar - the top
 * six between them fill it - and the first three for the legend. A set counts
 * toward every primary group of its exercise, the way Records counts them.
 * Empty when nothing maps to a group, which is also what an unsynced catalog
 * looks like.
 */
export function buildMuscleGroupShares(
  sets = [],
  {
    groupsByExercise,
    now,
    days = MUSCLE_GROUP_DAYS,
    limit = MUSCLE_GROUP_LIMIT,
    legendLimit = MUSCLE_LEGEND_LIMIT,
  }
) {
  const today = dayOf(now);
  const from = today - (days - 1) * DAY_MS;
  const inside = sets.filter(
    (set) => Number.isFinite(set?.at) && set.at >= from && set.at < today + DAY_MS
  );
  const ranked = buildMuscleGroupSets(inside, { groupsByExercise, now, days: null }).sort(
    (left, right) => right.setCount - left.setCount || left.label.localeCompare(right.label)
  );
  const top = ranked.slice(0, limit);
  const total = top.reduce((sum, group) => sum + group.setCount, 0);
  const groups = top.map((group, index) => ({
    label: group.label,
    setCount: group.setCount,
    rank: index,
    share: total > 0 ? group.setCount / total : 0,
  }));

  return { groups, legend: groups.slice(0, legendLimit), setCount: total };
}

/* ------------------------------------------------------------ programs -- */

function programKind(status) {
  const normalized = String(status ?? "").trim().toUpperCase();

  if (normalized === "ACTIVE") {
    return "active";
  }

  return normalized === "COMPLETE" ? "complete" : "draft";
}

/**
 * Whether a week of a program is behind you, from a row of
 * trainRepository.getProgramMicrocycleProgress. A week with workouts is done
 * when every one of them is - a workout on a sick day that has passed counts,
 * as it does on every progress bar in the app. A week without any is done
 * once its last day has passed.
 */
export function isMicrocycleDone(row, { todayIso }) {
  const workouts = Number(row?.workout_count) || 0;

  if (workouts > 0) {
    return (Number(row?.completed_count) || 0) >= workouts;
  }

  const lastDay = typeof row?.last_day_sort === "string" ? row.last_day_sort.slice(0, 10) : "";

  return (Number(row?.day_count) || 0) > 0 && lastDay !== "" && lastDay < todayIso;
}

/**
 * The Programs tile: how many there are, how many are active, and a bar a
 * program - active ones filled by the share of their weeks that are done,
 * finished ones full, drafts empty - active first, then finished, then
 * drafts, the newest first within each. With one program or none there is
 * room for another, and the tile says so with an empty slot.
 */
export function buildProgramsTile(
  programs = [],
  microcycleRows = [],
  { now, limit = PROGRAM_BAR_LIMIT }
) {
  const todayIso = isoDay(dayOf(now));
  const weeksByProgram = new Map();

  for (const row of microcycleRows) {
    if (row?.microcycle_id === null || row?.microcycle_id === undefined) {
      continue;
    }

    const programId = Number(row.program_id);
    const entry = weeksByProgram.get(programId) ?? { done: 0, total: 0 };

    entry.total += 1;
    entry.done += isMicrocycleDone(row, { todayIso }) ? 1 : 0;
    weeksByProgram.set(programId, entry);
  }

  const entries = programs.map((program) => {
    const kind = programKind(program?.status);
    const weeks = weeksByProgram.get(Number(program?.program_id)) ?? { done: 0, total: 0 };

    return {
      programId: program?.program_id ?? null,
      name: program?.program_name ?? null,
      kind,
      doneWeeks: weeks.done,
      totalWeeks: weeks.total,
      progress:
        kind === "complete"
          ? 1
          : kind === "active" && weeks.total > 0
            ? Math.min(1, weeks.done / weeks.total)
            : 0,
      startsAt: parseDayValue(program?.start_date),
    };
  });
  const order = { active: 0, complete: 1, draft: 2 };
  const bars = [...entries]
    .sort(
      (left, right) =>
        order[left.kind] - order[right.kind] ||
        (right.startsAt ?? 0) - (left.startsAt ?? 0) ||
        (Number(right.programId) || 0) - (Number(left.programId) || 0)
    )
    .slice(0, limit);

  return {
    total: programs.length,
    active: entries.filter((entry) => entry.kind === "active").length,
    bars,
    showEmptySlot: programs.length <= 1,
  };
}

/* ---------------------------------------------------------------- 1RM -- */

/**
 * The best estimated 1RM of the last thirty days and the set it came from.
 *
 * The same sum as OneRepMaxCalculatorPage, so the number on the tile is the
 * number the calculator shows for that set: Brzycki, only for 1 to
 * MAX_ESTIMATE_REPS whole reps, rounded to the nearest half kilo. Drop sets
 * are left out - the lighter half of a set is never somebody's best, and the
 * app keeps no record on one. A tie goes to the heavier set, then the newer.
 */
export function buildBestOneRepMax(sets = [], { now, days = ONE_REP_MAX_DAYS }) {
  const today = dayOf(now);
  const from = today - (days - 1) * DAY_MS;
  let best = null;

  for (const set of sets) {
    if (!Number.isFinite(set?.at) || set.at < from || set.at >= today + DAY_MS) {
      continue;
    }

    if (
      set.setType === "drop" ||
      !(set.weight > 0) ||
      !Number.isInteger(set.reps) ||
      set.reps < 1 ||
      set.reps > MAX_ESTIMATE_REPS
    ) {
      continue;
    }

    const estimate = calculateBrzyckiOneRepMax(set.weight, set.reps);

    if (!Number.isFinite(estimate)) {
      continue;
    }

    if (
      best === null ||
      estimate > best.estimate ||
      (estimate === best.estimate &&
        (set.weight > best.weight || (set.weight === best.weight && set.at > best.at)))
    ) {
      best = { name: set.name, weight: set.weight, reps: set.reps, at: set.at, estimate };
    }
  }

  return best === null
    ? null
    : { ...best, value: roundToNearestWeightIncrement(best.estimate) };
}

// Latin letters, Danish ones included, and digits: what an initial can be.
const INITIAL = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/;

/**
 * A name short enough to sit beside a set: the name itself when it fits,
 * else the catalog's nickname when that does, else the initials of its words
 * ("Romanian Deadlift" -> "RD"), and a single long word cut short.
 */
export function abbreviateExerciseName(
  name,
  { nickname = null, maxLength = ABBREVIATION_MAX_LENGTH } = {}
) {
  const full = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const short = typeof nickname === "string" ? nickname.trim() : "";

  if (full.length <= maxLength) {
    return full;
  }

  if (short && short.length <= maxLength) {
    return short;
  }

  const initials = full
    .split(/[\s-]+/)
    .map((word) => word.match(INITIAL)?.[0] ?? "")
    .join("");

  if (initials.length >= 2) {
    return initials.toLocaleUpperCase().slice(0, 4);
  }

  return `${full.slice(0, maxLength - 1)}.`;
}

/* -------------------------------------------------------------- the lot -- */

/**
 * Everything the library grid shows but the muscle groups, which wait on the
 * cloud catalog and come from buildMuscleGroupShares on their own. The
 * Workouts tile and "Your form" are read from the same finished workouts.
 */
export function buildTrainLibrary(
  {
    workoutRows = [],
    recordDayRows = [],
    sicknessRows = [],
    programs = [],
    microcycleRows = [],
    catalogRows = [],
  } = {},
  { now }
) {
  const workouts = normalizeWorkoutRows(workoutRows);
  const sickWeeks = buildSickWeeks(normalizeSicknessPeriods(sicknessRows, { now }));

  return {
    workouts: buildWorkoutsTile(workouts, { now }),
    form: buildFormCard(workouts, { now, sickWeeks }),
    records: buildRecordsTile(normalizeRecordDays(recordDayRows), { now }),
    exercises: { count: countCatalogExercises(catalogRows) },
    programs: buildProgramsTile(programs, microcycleRows, { now }),
  };
}

/**
 * The two tools: the best estimated 1RM of the last thirty days with a short
 * name for its exercise, and this year's sick days. `sets` are strength sets
 * as normalizeRecordRows gives them.
 */
export function buildTrainTools({ sets = [], sicknessRows = [], catalogRows = [] } = {}, { now }) {
  const best = buildBestOneRepMax(sets, { now });
  let oneRepMax = null;

  if (best !== null) {
    const key = best.name.trim().toLocaleLowerCase();
    const entry = catalogRows.find((row) => {
      const name = row?.exercise_name ?? row?.name;

      return typeof name === "string" && name.trim().toLocaleLowerCase() === key;
    });

    oneRepMax = {
      ...best,
      abbreviation: abbreviateExerciseName(best.name, { nickname: entry?.nickname ?? null }),
    };
  }

  return {
    oneRepMax,
    sickDays: buildSickDays(normalizeSicknessPeriods(sicknessRows, { now }), { now }),
  };
}
