// The history panel on an exercise card: the last few times this exercise was
// done, one row per session and one column per set.
//
// Pure, over the rows `getCompletedExerciseHistorySets` returns - newest
// session first, sets in order within each - so the arithmetic can be tested
// without a device. The screen only draws what this hands it.

import { resolveSetType } from "./setTypes";

/**
 * Sessions newest first, each with its sets numbered after the warm-ups are
 * taken out.
 *
 * Warm-ups are left out entirely: they are preparation, and a table of bests
 * whose first two columns are always the lightest sets of the day buries the
 * work. `maxSets` is the widest session among the ones shown - the number of
 * columns - not the sum, because the columns are set numbers.
 *
 * A session left with nothing once its warm-ups are gone is dropped rather
 * than drawn as a row of empty cells.
 */
export function buildExerciseHistoryTable(rows = []) {
  const sessions = [];
  const byId = new Map();

  for (const row of rows) {
    const id = row?.exercise_instance_id;

    if (id === null || id === undefined) {
      continue;
    }

    let session = byId.get(id);

    if (!session) {
      session = {
        id,
        workoutId: row?.workout_id ?? null,
        performedDate: row?.performed_date ?? null,
        performedDateSort: row?.performed_date_sort ?? null,
        sets: [],
      };
      byId.set(id, session);
      sessions.push(session);
    }

    const setType = resolveSetType(row);

    if (setType === "warmup") {
      continue;
    }

    const weight = Number(row?.weight);
    const reps = Number(row?.reps);

    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      continue;
    }

    session.sets.push({
      setNumber: session.sets.length + 1,
      weight,
      reps,
      setType,
      amrapTarget: setType === "amrap" ? Number(row?.amrap_target) || null : null,
      personalRecord: Number(row?.personal_record) === 1,
    });
  }

  const shown = sessions.filter((session) => session.sets.length > 0);
  const maxSets = shown.reduce(
    (widest, session) => Math.max(widest, session.sets.length),
    0
  );

  return { sessions: shown, maxSets };
}

/**
 * How a cell is coloured. A record outranks the type: the gold is the thing
 * worth seeing, and an AMRAP set that set a record is first of all a record.
 */
export function historyCellTone(set) {
  if (set?.personalRecord) {
    return "record";
  }

  if (set?.setType === "amrap" || set?.setType === "drop") {
    return set.setType;
  }

  return "plain";
}
