// The Train tab's program card, worked out from a program's weeks and days
// (programRepository.getProgramCardRows): which block and week you are in,
// how far through the block you are, and the seven days of this week.
//
// Pure, so scripts/test-program-card.js runs it in Node.

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function isoWeekdayIndex(isoDate) {
  const match = String(isoDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return (date.getDay() + 6) % 7;
}

function weekdayIndexOf(day) {
  const byName = WEEKDAY_NAMES.indexOf(String(day.weekday ?? "").trim());

  return byName >= 0 ? byName : isoWeekdayIndex(day.dateSort);
}

/** Rows into blocks, weeks and days, in the program's order. */
export function groupProgramRows(rows = []) {
  const blocks = [];
  const blockById = new Map();
  const weekById = new Map();

  for (const row of rows) {
    let block = blockById.get(row.mesocycle_id);

    if (!block) {
      block = {
        id: row.mesocycle_id,
        number: Number(row.mesocycle_number) || blocks.length + 1,
        focus: row.mesocycle_focus ?? null,
        weeks: [],
      };
      blockById.set(row.mesocycle_id, block);
      blocks.push(block);
    }

    let week = weekById.get(row.microcycle_id);

    if (!week) {
      week = {
        id: row.microcycle_id,
        number: Number(row.microcycle_number) || block.weeks.length + 1,
        days: [],
        total: 0,
        done: 0,
      };
      weekById.set(row.microcycle_id, week);
      block.weeks.push(week);
    }

    if (row.day_id === null || row.day_id === undefined) {
      continue;
    }

    const workoutCount = Number(row.workout_count) || 0;
    const doneCount = Math.min(workoutCount, Number(row.done_count) || 0);

    week.days.push({
      id: row.day_id,
      dateSort: row.date_sort ?? null,
      weekday: row.weekday ?? null,
      isSick: Number(row.is_sick) === 1,
      workoutCount,
      doneCount,
    });
    week.total += workoutCount;
    week.done += doneCount;
  }

  return blocks;
}

function dayState(day) {
  if (!day || day.workoutCount === 0) {
    return "rest";
  }

  return day.doneCount >= day.workoutCount ? "done" : "planned";
}

/**
 * The card, or null for a program with no weeks.
 *
 * "This week" is the week holding today; before the program starts, the
 * first week; after it ends, the last - so the card always shows a week that
 * belongs to it.
 */
export function buildProgramCard(rows = [], { todayIso } = {}) {
  const blocks = groupProgramRows(rows);

  if (blocks.length === 0) {
    return null;
  }

  const located = [];

  blocks.forEach((block, blockIndex) => {
    block.weeks.forEach((week, weekIndex) => {
      for (const day of week.days) {
        located.push({ day, blockIndex, weekIndex });
      }
    });
  });

  const dated = located.filter((entry) => entry.day.dateSort);
  const current =
    dated.find((entry) => entry.day.dateSort === todayIso) ??
    [...dated].reverse().find((entry) => entry.day.dateSort < todayIso) ??
    dated[0] ??
    located[0] ??
    null;

  const blockIndex = current?.blockIndex ?? 0;
  const weekIndex = current?.weekIndex ?? 0;
  const block = blocks[blockIndex];
  const week = block.weeks[weekIndex];

  const segments = block.weeks.map((entry, index) => ({
    key: entry.id,
    fraction: entry.total > 0 ? entry.done / entry.total : 0,
    state: index < weekIndex ? "past" : index === weekIndex ? "current" : "upcoming",
  }));

  const days = WEEKDAY_NAMES.map((name, index) => {
    const day = week.days.find((entry) => weekdayIndexOf(entry) === index) ?? null;

    return {
      weekday: name,
      state: dayState(day),
      isToday: Boolean(day?.dateSort) && day.dateSort === todayIso,
      isSick: Boolean(day?.isSick),
    };
  });

  const lastDoneIso = dated
    .filter((entry) => entry.day.doneCount > 0)
    .reduce((latest, entry) => (latest === null || entry.day.dateSort > latest ? entry.day.dateSort : latest), null);

  return {
    blockNumber: blockIndex + 1,
    blockCount: blocks.length,
    focus: block.focus,
    weekNumber: weekIndex + 1,
    weekCount: block.weeks.length,
    weekDone: week.done,
    weekPlanned: week.total,
    segments,
    days,
    lastDoneIso,
  };
}

/**
 * Which active program the card shows: the one with a workout today, then
 * the one trained in most recently, then the first.
 */
export function pickCardProgram(candidates = []) {
  if (candidates.length === 0) {
    return null;
  }

  const withToday = candidates.find((candidate) => candidate.hasWorkoutToday);

  if (withToday) {
    return withToday;
  }

  const byRecent = [...candidates]
    .filter((candidate) => candidate.lastDoneIso)
    .sort((left, right) => (left.lastDoneIso < right.lastDoneIso ? 1 : -1));

  return byRecent[0] ?? candidates[0];
}
