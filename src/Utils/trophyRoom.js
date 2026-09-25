// The trophy room: what somebody has achieved, over their whole history. No
// period and no comparison - that is the Statistics page's job. Everything
// here is a count, a best or a milestone, read from the same strength sets as
// Records (normalizeRecordRows) and, for how often somebody shows up, every
// finished workout of any kind.
//
// Pure: no React, no database, so scripts/test-trophy-room.js runs it in Node.

import { parseRecordDate, startOfWeek } from "./recordsInsights";

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

// A record from the last two weeks is new.
export const NEW_RECORD_DAYS = 14;
export const RECENT_RECORD_LIMIT = 5;
export const PODIUM_SIZE = 3;

// Round weights to reach for, in kilos. Above the list, every 50.
const WEIGHT_GOALS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 250];

// Each milestone is a ladder; the highest rung reached is the trophy, the
// next one is what to go for.
export const MILESTONE_LADDERS = {
  workouts: [1, 10, 25, 50, 100, 250, 500, 1000],
  tonnes: [1, 10, 25, 50, 100, 250, 500, 1000],
  records: [1, 10, 25, 50, 100, 250, 500],
  weekStreak: [2, 4, 8, 12, 26, 52],
};

/** Finished workouts, one per workout, oldest first, with the day as a timestamp. */
export function normalizeWorkoutRows(rows = []) {
  const seen = new Set();
  const workouts = [];

  for (const row of rows) {
    const at = parseRecordDate(row?.performed_date_sort ?? row?.performed_date);
    const id = row?.workout_id ?? null;

    if (!at || (id !== null && seen.has(id))) {
      continue;
    }

    if (id !== null) {
      seen.add(id);
    }

    workouts.push({ id, at, type: typeof row?.workout_type === "string" ? row.workout_type : null });
  }

  return workouts.sort((left, right) => left.at - right.at);
}

/**
 * The top of the room: how many records there are, and the heaviest weight
 * ever lifted - with what, how many times and when. Null when there is
 * nothing yet.
 */
export function buildTrophyHero(sets = []) {
  if (sets.length === 0) {
    return null;
  }

  let heaviest = null;

  for (const set of sets) {
    if (
      !heaviest ||
      set.weight > heaviest.weight ||
      // The same weight for more reps is the better lift.
      (set.weight === heaviest.weight && set.reps > heaviest.reps)
    ) {
      heaviest = set;
    }
  }

  return {
    recordCount: sets.filter((set) => set.isRecord).length,
    heaviest: { name: heaviest.name, weight: heaviest.weight, reps: heaviest.reps, at: heaviest.at },
    since: sets.reduce((earliest, set) => Math.min(earliest, set.at), Infinity),
  };
}

/** The next round weight above `weight`: 20, 40 ... 220, 250, then every 50. */
export function nextWeightGoal(weight) {
  const goal = WEIGHT_GOALS.find((candidate) => candidate > weight);

  if (goal !== undefined) {
    return goal;
  }

  return (Math.floor(weight / 50) + 1) * 50;
}

/**
 * The strongest lifts: every exercise's heaviest set, heaviest first. A tie
 * goes to the one with more reps, then to whoever got there first. Each has
 * the next round weight to go for.
 */
export function buildPodium(sets = [], { limit = PODIUM_SIZE } = {}) {
  const best = new Map();

  for (const set of sets) {
    const key = set.name.toLocaleLowerCase();
    const current = best.get(key);

    if (
      !current ||
      set.weight > current.weight ||
      (set.weight === current.weight && set.reps > current.reps) ||
      (set.weight === current.weight && set.reps === current.reps && set.at < current.at)
    ) {
      best.set(key, set);
    }
  }

  return [...best.values()]
    .sort(
      (left, right) =>
        right.weight - left.weight || right.reps - left.reps || left.at - right.at
    )
    .slice(0, limit)
    .map((set) => {
      const goal = nextWeightGoal(set.weight);

      return {
        name: set.name,
        weight: set.weight,
        reps: set.reps,
        at: set.at,
        goal,
        toGo: goal - set.weight,
      };
    });
}

/**
 * The newest records, one card per exercise and day - two records in the
 * same session are one achievement, shown by its heaviest set - newest
 * first. `isNew` for the last two weeks.
 */
export function buildRecentRecords(sets = [], { now, limit = RECENT_RECORD_LIMIT } = {}) {
  const byDay = new Map();

  for (const set of sets) {
    if (!set.isRecord) {
      continue;
    }

    const key = `${set.name.toLocaleLowerCase()}::${set.at}`;
    const current = byDay.get(key);

    if (!current || set.weight > current.weight || (set.weight === current.weight && set.reps > current.reps)) {
      byDay.set(key, set);
    }
  }

  return [...byDay.values()]
    .sort((left, right) => right.at - left.at || right.weight - left.weight)
    .slice(0, limit)
    .map((set) => ({
      name: set.name,
      weight: set.weight,
      reps: set.reps,
      at: set.at,
      isNew: now - set.at < NEW_RECORD_DAYS * DAY_MS,
    }));
}

/** The longest run of consecutive weeks with at least one workout in each. */
export function longestWeekStreak(timestamps = []) {
  const weeks = [...new Set(timestamps.map((at) => startOfWeek(at)))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous = null;

  for (const week of weeks) {
    // Rounded: a week that crosses a clock change is not seven days of
    // milliseconds, but it is still the next week.
    run = previous !== null && Math.round((week - previous) / WEEK_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = week;
  }

  return longest;
}

function climb(key, value) {
  const ladder = MILESTONE_LADDERS[key];
  let reached = null;

  for (const rung of ladder) {
    if (value >= rung) {
      reached = rung;
    }
  }

  const next = ladder.find((rung) => rung > value) ?? null;
  const from = reached ?? 0;

  return {
    key,
    value,
    reached,
    next,
    // How far from the last rung to the next, so a fresh rung starts empty.
    progress: next === null ? 1 : Math.max(0, Math.min(1, (value - from) / (next - from))),
    toGo: next === null ? 0 : next - value,
  };
}

/**
 * Four milestones: workouts finished, tonnes lifted, records set and the
 * longest streak of weeks in a row. Each says the highest rung reached and
 * how far it is to the next.
 *
 * Workouts are counted from every finished workout - a run counts - and fall
 * back to the strength sessions when there are no workout rows to read.
 */
export function buildMilestones({ sets = [], workouts = [] } = {}) {
  const sessionDays = new Map();

  for (const set of sets) {
    sessionDays.set(set.sessionKey, set.at);
  }

  const workoutDays = workouts.length > 0 ? workouts.map((workout) => workout.at) : [...sessionDays.values()];
  const tonnes = sets.reduce((total, set) => total + set.volume, 0) / 1000;

  return [
    climb("workouts", workoutDays.length),
    climb("tonnes", Math.floor(tonnes * 10) / 10),
    climb("records", sets.filter((set) => set.isRecord).length),
    climb("weekStreak", longestWeekStreak(workoutDays)),
  ];
}

/** Everything the room shows, in one pass over the same inputs. */
export function buildTrophyRoom({ sets = [], workouts = [], now } = {}) {
  return {
    hero: buildTrophyHero(sets),
    podium: buildPodium(sets),
    recent: buildRecentRecords(sets, { now }),
    milestones: buildMilestones({ sets, workouts }),
  };
}
