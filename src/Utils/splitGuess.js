// Working out what somebody's split is from what they have actually done.
//
// Home is built for the person with no programme: she runs the same two or
// three sessions on a loop and wants the next one open. Nobody types that in,
// so it is read out of the last sixty days of finished strength workouts.
//
// Everything here is pure, over rows the repository hands it. The guess is
// allowed to be wrong - the page it feeds has no Edit button, and correcting it
// belongs on the Train tab where a split can also be named.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Below this a group is a coincidence rather than a habit. */
export const SPLIT_MIN_OCCURRENCES = 3;

/** How much two workouts' exercises have to overlap to be the same session. */
export const SPLIT_OVERLAP_THRESHOLD = 0.6;

/** A weekday shows when at least this share of the group landed on it. */
export const SPLIT_WEEKDAY_SHARE = 0.5;

/** Weekdays are counted over this window, not the whole sixty days. */
export const SPLIT_WEEKDAY_WEEKS = 8;

/**
 * "Push A 2", "push a (2026-01-04)" and " Push A " are one session.
 *
 * Numbers and dates go because they are how people number repeats, not how
 * they name sessions. Everything else is left alone: an accent or a hyphen is
 * part of the name somebody chose.
 */
export function normalizeSplitName(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/\d{1,4}[-./]\d{1,2}[-./]\d{1,4}/g, " ")
    .replace(/\d+/g, " ")
    // Brackets go with whatever was inside them. "push a (2026-01-04)" has to
    // land on "push a", and it does not while the empty pair survives.
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The name somebody actually gave a session, or "" when they gave it none.
 *
 * A workout started from the quick-start button carries no label, and the
 * insert falls back to the workout type - so it is stored as the literal
 * string "Resistance". That is not a name, and treating it as one made every
 * unnamed session match every other one on the very first check, before the
 * exercise overlap was ever looked at: an upper-body day and a leg day
 * collapsed into one card, for exactly the person this screen was rebuilt for.
 *
 * Reading it here rather than fixing the insert also repairs the history that
 * is already stored that way.
 */
export function splitWorkoutName(workout) {
  const name = normalizeSplitName(workout?.name);
  const type = normalizeSplitName(workout?.workoutType);

  return name && name === type ? "" : name;
}

/** Shared exercises over the union of both. 1 is identical, 0 is nothing in common. */
export function exerciseOverlap(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);

  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let shared = 0;

  for (const id of a) {
    if (b.has(id)) {
      shared += 1;
    }
  }

  return shared / (a.size + b.size - shared);
}

function belongsToGroup(workout, group) {
  const name = splitWorkoutName(workout);

  for (const member of group.workouts) {
    if (name && name === splitWorkoutName(member)) {
      return true;
    }

    if (exerciseOverlap(workout.exerciseIds, member.exerciseIds) >= SPLIT_OVERLAP_THRESHOLD) {
      return true;
    }
  }

  return false;
}

function pickGroupName(group) {
  const counts = new Map();

  for (const workout of group.workouts) {
    // The spelling as she wrote it, but only when it is a name at all.
    const name = splitWorkoutName(workout) ? String(workout.name ?? "").trim() : "";

    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    return null;
  }

  // The most used spelling, and the earliest of those on a tie - the one she
  // settled on rather than the one she typed last.
  let best = null;
  let bestCount = 0;

  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }

  return best;
}

function pickWeekdays(group, now) {
  const from = now - SPLIT_WEEKDAY_WEEKS * 7 * DAY_MS;
  const recent = group.workouts.filter((workout) => workout.at >= from);

  if (recent.length === 0) {
    return [];
  }

  const counts = new Map();

  for (const workout of recent) {
    const weekday = new Date(workout.at).getDay();

    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }

  const needed = recent.length * SPLIT_WEEKDAY_SHARE;

  return [...counts.entries()]
    .filter(([, count]) => count >= needed)
    .map(([weekday]) => weekday)
    .sort((left, right) => {
      // Monday first, Sunday last - Date.getDay() puts Sunday at 0.
      const order = (day) => (day === 0 ? 7 : day);

      return order(left) - order(right);
    });
}

/**
 * The split, as far as it can be read out of the history.
 *
 * `workouts` are finished strength workouts, newest first, each
 * `{ workoutId, name, at, exerciseIds, exerciseCount, setCount }`.
 *
 * Returns [] when there is no recognisable split - fewer than two groups that
 * repeat. Home then offers an empty workout and nothing else; half a guess is
 * worse than none, because the row it fills is the one the person taps without
 * reading.
 */
export function guessSplitGroups(workouts = [], { now = Date.now() } = {}) {
  const groups = [];

  // Oldest first, so a group's `workouts` run in the order they happened and
  // the tie-break in "whose turn" is the historical one.
  const ordered = [...workouts]
    .filter((workout) => Number.isFinite(workout?.at))
    .sort((left, right) => left.at - right.at);

  for (const workout of ordered) {
    const existing = groups.find((group) => belongsToGroup(workout, group));

    if (existing) {
      existing.workouts.push(workout);
    } else {
      groups.push({ workouts: [workout] });
    }
  }

  const repeating = groups.filter(
    (group) => group.workouts.length >= SPLIT_MIN_OCCURRENCES
  );

  if (repeating.length < 2) {
    return [];
  }

  const described = repeating.map((group, index) => {
    const latest = group.workouts[group.workouts.length - 1];

    return {
      name: pickGroupName(group),
      // The latest occurrence, not an average: it is the one she reopens.
      lastWorkoutId: latest.workoutId,
      lastTrainedAt: latest.at,
      daysSince: Math.floor((now - latest.at) / DAY_MS),
      exerciseCount: latest.exerciseCount ?? latest.exerciseIds?.length ?? 0,
      setCount: latest.setCount ?? 0,
      weekdays: pickWeekdays(group, now),
      occurrences: group.workouts.length,
      historyOrder: index,
    };
  });

  // Whose turn: longest since. On a tie the one that comes first in the
  // history, so the order does not shuffle between two sessions done the same
  // day.
  const upNext = [...described].sort((left, right) => {
    const byDays = right.daysSince - left.daysSince;

    return byDays !== 0 ? byDays : left.historyOrder - right.historyOrder;
  })[0];

  return described.map((group) => ({
    ...group,
    isUpNext: group === upNext,
  }));
}
