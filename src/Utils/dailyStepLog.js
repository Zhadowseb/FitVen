// The rules for the one number a day keeps (Daily_Steps, public.daily_steps),
// without the phone or the cloud: which source's number wins, what a refresh
// writes, and what a pull from the cloud changes.
//
// The sources are tried best first and never added together:
//   health   the phone's health app: Apple Health, Health Connect. Has the
//            watch, de-duplicates between sources, and keeps history.
//   motion   the phone's own motion history (iPhone, about 7 days back).
//   sensor   the phone's own step sensor, counted by FitVen (Android).
// A day takes its number from the best source that has one for that day, and a
// worse source never replaces a better one - not when the better one has
// stopped answering (the permission was taken away), and not when two phones
// meet in the cloud. Between two numbers from the same source the larger one
// wins: a day's steps only grow, and a number that came late is the more
// complete one. That is a rule with no clocks in it, so the order the phones
// speak in does not matter.

export const STEP_SOURCES = Object.freeze(["health", "motion", "sensor"]);

const SOURCE_RANK = Object.freeze({ health: 1, motion: 2, sensor: 3 });

// More than a person can walk in a day: a number above it is a fault, not steps.
export const MAX_DAILY_STEPS = 200000;

export function isStepSource(source) {
  return Object.prototype.hasOwnProperty.call(SOURCE_RANK, source);
}

export function normalizeDailySteps(value) {
  const steps = Math.round(Number(value));

  return Number.isFinite(steps) && steps >= 0 && steps <= MAX_DAILY_STEPS ? steps : null;
}

export function isDayKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** A row as it is kept, or null for one that is not a day's steps at all. */
export function normalizeDayRow(row) {
  const steps = normalizeDailySteps(row?.steps);

  if (!isDayKey(row?.day) || !isStepSource(row?.source) || steps === null) {
    return null;
  }

  return { day: row.day, steps, source: row.source };
}

/** The row that wins: the better source, and between equals the larger number. */
export function pickDay(left, right) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  const leftRank = SOURCE_RANK[left.source];
  const rightRank = SOURCE_RANK[right.source];

  if (leftRank !== rightRank) {
    return leftRank < rightRank ? left : right;
  }

  return right.steps > left.steps ? right : left;
}

const sameDay = (left, right) =>
  Boolean(left) && Boolean(right) && left.steps === right.steps && left.source === right.source;

/**
 * What a read of the sources should write. `readings` is
 * { health: { "2026-10-05": 8000, ... } | null, motion: ..., sensor: ... } -
 * null for a source that could not be asked. A reading of 0 is not a reading:
 * iOS cannot tell "no steps" from "not allowed", so a day is only taken from a
 * source that says something about it, and a worse source can answer when the
 * better one is silent.
 *
 * `existing` is the rows already kept, by day. Returns the rows to write, each
 * flagged to go to the cloud - only days whose number or source actually
 * changed, so a refresh that finds nothing new writes nothing.
 */
export function planRefresh({ days, readings, existing, now }) {
  const writes = [];

  for (const day of days) {
    let best = null;

    for (const source of STEP_SOURCES) {
      const steps = normalizeDailySteps(readings[source]?.[day]);

      if (steps !== null && steps > 0) {
        best = pickDay(best, { day, steps, source });
      }
    }

    if (!best) {
      continue;
    }

    const kept = existing.get(day) ?? null;
    const winner = pickDay(kept && { day, steps: kept.steps, source: kept.source }, best);

    if (!sameDay(winner, kept)) {
      writes.push({ ...winner, updatedAt: now, needsSync: true });
    }
  }

  return writes;
}

/**
 * Meeting the cloud: `local` is the rows kept here (by day), `cloud` the rows it
 * has. Returns what to write here (the cloud's number won, or the cloud has a
 * day this phone does not) and which local rows now match the cloud, which do
 * not and have to go up.
 */
export function planCloudMerge({ local, cloud, now }) {
  const writeLocal = [];
  const inSync = [];
  const goUp = [];

  for (const cloudRow of cloud) {
    const normalized = normalizeDayRow(cloudRow);

    if (!normalized) {
      continue;
    }

    const kept = local.get(normalized.day) ?? null;
    const keptRow = kept && { day: normalized.day, steps: kept.steps, source: kept.source };
    const winner = pickDay(keptRow, normalized);

    if (!keptRow) {
      writeLocal.push({ ...normalized, updatedAt: now, needsSync: false });
    } else if (sameDay(winner, normalized) && sameDay(winner, keptRow)) {
      inSync.push(normalized.day);
    } else if (sameDay(winner, normalized)) {
      writeLocal.push({ ...normalized, updatedAt: now, needsSync: false });
    } else {
      goUp.push(normalized.day);
    }
  }

  return { writeLocal, inSync, goUp };
}

/**
 * The cloud table is not there yet: the migration has not been run. Until it
 * has, the days stay on the phone and nothing is sent.
 */
export function isMissingDailyStepsTableError(error) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (text.includes("daily_steps") && (text.includes("does not exist") || text.includes("schema cache")))
  );
}
