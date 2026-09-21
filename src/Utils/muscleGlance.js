// "Last month" on Home: one bar per muscle group, answering whether the person
// got stronger rather than whether they trained more.
//
// Volume rises when somebody trains more and falls when the programme changes
// phase, so it answers a question nobody asked. An estimated one-rep max
// answers the one they did.
//
// The formula is Brzycki, because that is the app's one 1RM formula. The design
// document asked for Epley "the same as Records"; Records is not Epley, and a
// second formula would make the same number mean two things on two screens -
// which is the mistake `recordsInsights.js` already carries a comment about.
import { calculateBrzyckiOneRepMax } from "./oneRepMaxUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fewer than this in either window and the group has nothing to compare. */
export const MUSCLE_GLANCE_MIN_SETS = 3;

/** Five is what fits across a 390 dp screen without the names breaking up. */
export const MUSCLE_GLANCE_MAX_GROUPS = 5;

/** A group with no comparable data still draws this much, so no column is empty. */
export const MUSCLE_GLANCE_EMPTY_FILL = 0.08;

function bestOneRepMax(sets) {
  let best = 0;

  for (const set of sets) {
    const estimate = calculateBrzyckiOneRepMax(set.weight, set.reps);

    if (Number.isFinite(estimate) && estimate > best) {
      best = estimate;
    }
  }

  return best;
}

/**
 * One entry per muscle group, strongest improvement first.
 *
 * `sets` are the rows `weightliftingService.getRecordsSourceData` returns, so
 * Home and Records read the same numbers from the same place.
 * `groupsByExercise` maps a lowercased exercise name to its group labels; an
 * exercise in none of them is not counted, and an empty map means the exercise
 * library has not synced yet and the block has nothing to say.
 *
 * A negative delta comes back as 0. Home is not the place to tell somebody they
 * have gone backwards - that belongs in Records, where there is room to say why.
 */
export function buildMuscleGroupDeltas(
  sets = [],
  { groupsByExercise, now = Date.now(), days = 30 } = {}
) {
  if (!groupsByExercise || groupsByExercise.size === 0) {
    return [];
  }

  const currentFrom = now - days * DAY_MS;
  const previousFrom = now - 2 * days * DAY_MS;
  const byGroup = new Map();

  for (const set of sets) {
    if (!Number.isFinite(set?.at) || set.at < previousFrom) {
      continue;
    }

    const name = typeof set?.name === "string" ? set.name.toLocaleLowerCase() : "";
    const labels = groupsByExercise.get(name) ?? [];

    for (const label of labels) {
      if (!byGroup.has(label)) {
        byGroup.set(label, { current: [], previous: [] });
      }

      byGroup.get(label)[set.at >= currentFrom ? "current" : "previous"].push(set);
    }
  }

  const entries = [];

  for (const [label, windows] of byGroup) {
    const hasEnough =
      windows.current.length >= MUSCLE_GLANCE_MIN_SETS &&
      windows.previous.length >= MUSCLE_GLANCE_MIN_SETS;

    if (!hasEnough) {
      entries.push({
        label,
        deltaPercent: null,
        setCount: windows.current.length + windows.previous.length,
      });
      continue;
    }

    const before = bestOneRepMax(windows.previous);
    const after = bestOneRepMax(windows.current);

    entries.push({
      label,
      // Backwards reads as flat. The bar is grey either way, and the honest
      // version of that number needs a screen with room to explain it.
      deltaPercent:
        before > 0 ? Math.max(0, Math.round(((after - before) / before) * 100)) : 0,
      setCount: windows.current.length + windows.previous.length,
    });
  }

  // Most improved first, then the ones with data, then by how much was logged -
  // so the five that survive are the five worth looking at.
  entries.sort((left, right) => {
    const byDelta = (right.deltaPercent ?? -1) - (left.deltaPercent ?? -1);

    return byDelta !== 0 ? byDelta : right.setCount - left.setCount;
  });

  const shown = entries.slice(0, MUSCLE_GLANCE_MAX_GROUPS);
  const maxDelta = shown.reduce(
    (highest, entry) => Math.max(highest, entry.deltaPercent ?? 0),
    0
  );

  return shown.map((entry) => ({
    label: entry.label,
    deltaPercent: entry.deltaPercent,
    // The best group is always full. With nothing to compare, or nothing
    // gained anywhere, the column is still drawn so the row does not gap.
    fill:
      entry.deltaPercent === null || maxDelta === 0
        ? MUSCLE_GLANCE_EMPTY_FILL
        : Math.max(MUSCLE_GLANCE_EMPTY_FILL, entry.deltaPercent / maxDelta),
    isGain: entry.deltaPercent !== null && entry.deltaPercent > 0,
  }));
}

/** The group with the largest gain, or null when nothing gained. */
export function pickMuscleGlanceHeadline(entries = []) {
  const best = entries.find((entry) => entry.isGain);

  return best ? best.label : null;
}
