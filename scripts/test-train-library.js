// The Train tab's library tiles, "Your form" and the two tools: the weekly
// counts and the streak, the average, the records staircase, the muscle-group
// bar, the program bars, the best estimated 1RM and the sick days - and what
// each of them says with nothing to count.
//
// src/Utils/trainLibrary.js is pure, so it runs here as it is. The two queries
// it reads from (src/Repository/trainRepository.js) run against an in-memory
// SQLite built from the real schema, because what goes wrong in them is the
// kind of thing only a database shows: a date in the other spelling, a
// deleted row, a warm-up counted as a record.
const assert = require("assert/strict");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const lib = loadAppModule("src/Utils/trainLibrary.js");
const { normalizeRecordRows } = loadAppModule("src/Utils/recordsInsights.js");
const {
  calculateBrzyckiOneRepMax,
  roundToNearestWeightIncrement,
} = loadAppModule("src/Utils/oneRepMaxUtils.js");
const trainRepository = loadAppModule("src/Repository/trainRepository.js");
const weightliftingRepository = loadAppModule("src/Repository/weightliftingRepository.js");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
// Thursday 24 September 2026 at noon UTC: the same calendar day in every time
// zone within eleven hours of UTC, so dayOf() lands on the 24th wherever this
// runs. Its week starts on Monday the 21st.
const NOW = Date.UTC(2026, 8, 24, 12);
const TODAY = Date.UTC(2026, 8, 24);
const THIS_MONDAY = Date.UTC(2026, 8, 21);

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const local = (ms) => {
  const [year, month, day] = iso(ms).split("-");

  return `${day}.${month}.${year}`;
};
const weekOf = (offset, monday = THIS_MONDAY) => monday + offset * WEEK;
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);

let nextWorkoutId = 1;

/** `count` finished workouts in the week `offset` weeks from this one, Monday onward. */
function workoutsIn(offset, count, monday = THIS_MONDAY) {
  return Array.from({ length: count }, (_, index) => ({
    workout_id: nextWorkoutId++,
    workout_type: "Resistance",
    performed_date_sort: iso(weekOf(offset, monday) + (index % 7) * DAY),
  }));
}

function sickness(fromMs, toMs) {
  return { start_date: local(fromMs), end_date: toMs === null ? null : local(toMs) };
}

function form(workoutRows, sicknessRows = [], now = NOW) {
  return lib.buildTrainLibrary({ workoutRows, sicknessRows }, { now }).form;
}

/* ---------------------------------------------------------------- days -- */

assert.equal(lib.parseDayValue("24.09.2026"), TODAY, "the local spelling Day and Sickness use");
assert.equal(lib.parseDayValue("2026-09-24"), TODAY, "the ISO spelling");
assert.equal(lib.parseDayValue("2026-09-24T10:30:00"), TODAY, "an ISO day with a time");
assert.equal(lib.parseDayValue("31.02.2026"), null, "a day that does not exist is not the 3rd of March");
assert.equal(lib.parseDayValue(""), null);
assert.equal(lib.parseDayValue(null), null);
assert.equal(lib.windowStartIso(NOW, 30), "2026-08-26", "thirty days are today and the 29 before it");
assert.deepEqual(
  lib.buildWeekBars([], { now: NOW, weeks: 3 }).map((bar) => bar.weekStart),
  [weekOf(-2), weekOf(-1), THIS_MONDAY],
  "the weeks end with this one, oldest first"
);
assert.deepEqual(
  lib
    .buildWeekBars(
      [
        { at: THIS_MONDAY, count: 2 },
        { at: weekOf(-1) + 6 * DAY, count: 3 },
        { at: weekOf(-5), count: 9 },
      ],
      { now: NOW, weeks: 3, amountOf: (item) => item.count }
    )
    .map((bar) => [bar.count, bar.isCurrent]),
  [
    [0, false],
    [3, false],
    [2, true],
  ],
  "an item adds what it is worth to its week; one outside the weeks adds nothing"
);

/* ------------------------------------------------------------- streak -- */

{
  // Four full weeks back from last week, then a short one. This week has two.
  const history = [
    ...workoutsIn(-5, 2),
    ...workoutsIn(-4, 3),
    ...workoutsIn(-3, 3),
    ...workoutsIn(-2, 4),
    ...workoutsIn(-1, 3),
  ];
  const inProgress = form([...history, ...workoutsIn(0, 2)]);

  assert.equal(inProgress.streak, 4, "counted back from last week; the short week ends it");
  assert.equal(inProgress.includesThisWeek, false, "two workouts this week do not add it yet");

  const reached = form([...history, ...workoutsIn(0, 3)]);

  assert.equal(reached.streak, 5, "this week is added once it has three");
  assert.equal(reached.includesThisWeek, true);
  assert.equal(reached.bars[11].inStreak, true);

  const untouched = form(history);

  assert.equal(untouched.streak, 4, "a week that has only begun breaks nothing");
  assert.equal(untouched.bars[11].isCurrent, true, "the last bar is this week");
  assert.equal(untouched.bars[11].count, 0);
}

{
  // A gap: an empty week three weeks back ends the run, whatever came before.
  const gap = form([
    ...workoutsIn(-5, 3),
    ...workoutsIn(-4, 5),
    ...workoutsIn(-2, 4),
    ...workoutsIn(-1, 3),
  ]);

  assert.equal(gap.streak, 2, "the empty week three weeks back breaks the streak");
  assert.deepEqual(
    gap.bars.map((bar) => bar.inStreak),
    [false, false, false, false, false, false, false, false, false, true, true, false],
    "only the two weeks since the gap are drawn as the streak"
  );
}

{
  // A sick week in the middle: one workout, Wednesday to Friday ill. It
  // neither breaks the run nor counts toward it.
  const rows = [
    ...workoutsIn(-6, 0),
    ...workoutsIn(-5, 4),
    ...workoutsIn(-4, 3),
    ...workoutsIn(-3, 1),
    ...workoutsIn(-2, 3),
    ...workoutsIn(-1, 3),
  ];
  const ill = [sickness(weekOf(-3) + 2 * DAY, weekOf(-3) + 4 * DAY)];
  const withSickness = form(rows, ill);

  assert.equal(withSickness.streak, 4, "the sick week is stepped over: 2 before it and 2 after");
  assert.equal(form(rows).streak, 2, "without the sickness the same week breaks it");

  const sickBar = withSickness.bars[8];

  assert.equal(sickBar.weekStart, weekOf(-3));
  assert.equal(sickBar.isSick, true);
  assert.equal(sickBar.inStreak, false, "a sick week is not drawn as part of the streak");
  assert.deepEqual(
    withSickness.bars.slice(5).map((bar) => bar.inStreak),
    [false, true, true, false, true, true, false]
  );
  close(withSickness.bars[6].ratio, 1, "the busiest of the twelve weeks is the full height");
  close(withSickness.bars[7].ratio, 0.75, "the rest are a share of it");
}

{
  // A sick week does not count even when it reached the threshold.
  const rows = [...workoutsIn(-3, 3), ...workoutsIn(-2, 4), ...workoutsIn(-1, 3)];
  const ill = [sickness(weekOf(-2) + 5 * DAY, weekOf(-2) + 5 * DAY)];

  assert.equal(form(rows, ill).streak, 2, "four workouts in a sick week add nothing");
}

{
  // Sick this week: it is not added, even with three.
  const rows = [...workoutsIn(-1, 3), ...workoutsIn(0, 3)];

  assert.equal(form(rows).streak, 2);
  assert.equal(form(rows, [sickness(TODAY, TODAY)]).streak, 1, "a sick week in progress is not added");

  // Still ill, with no end date: every week since it began is stepped over.
  const ongoing = form(
    [...workoutsIn(-6, 1), ...workoutsIn(-5, 3), ...workoutsIn(-4, 3), ...workoutsIn(-2, 1)],
    [sickness(weekOf(-3) + DAY, null)]
  );

  assert.equal(ongoing.streak, 2, "an ongoing sickness covers every week up to this one");

  // A sickness that starts tomorrow has not happened yet.
  assert.equal(
    form(rows, [sickness(TODAY + DAY, TODAY + 3 * DAY)]).streak,
    2,
    "future sick days leave this week alone"
  );
}

{
  // Last week short, this week done: a streak of one.
  const fresh = form([...workoutsIn(-1, 2), ...workoutsIn(0, 3)]);

  assert.equal(fresh.streak, 1);
  assert.equal(fresh.includesThisWeek, true);
  assert.equal(lib.STREAK_MIN_WORKOUTS, 3, "the threshold is the constant the spec names");
  assert.equal(fresh.minWorkouts, lib.STREAK_MIN_WORKOUTS);
}

/* --------------------------------------- averages and weeks over a new year -- */

{
  // Wednesday 6 January 2027. This week began on Monday the 4th; last week
  // ran from Monday 28 December 2026 into the new year.
  const newYear = Date.UTC(2027, 0, 6, 12);
  const monday = Date.UTC(2027, 0, 4);
  const at = (y, m, d) => ({
    workout_id: nextWorkoutId++,
    workout_type: "Resistance",
    performed_date_sort: iso(Date.UTC(y, m, d)),
  });
  const rows = [
    at(2027, 0, 4),
    at(2027, 0, 5), // this week: 2
    at(2026, 11, 31),
    at(2027, 0, 1),
    at(2027, 0, 3), // last week, across the new year: 3
    at(2026, 11, 21),
    at(2026, 11, 22),
    at(2026, 11, 23),
    at(2026, 11, 27), // the week before: 4
    at(2026, 10, 10), // week of 9 November: 1
    at(2026, 9, 19),
    at(2026, 9, 20),
    at(2026, 9, 25), // week of 19 October, the twelfth week back: 3
    ...workoutsIn(0, 5, Date.UTC(2026, 9, 12)), // week of 12 October: outside
  ];
  const library = lib.buildTrainLibrary({ workoutRows: rows }, { now: newYear });
  const { workouts } = library;

  assert.equal(workouts.total, 18, "every finished workout, however old");
  assert.equal(workouts.thisWeek, 2);
  assert.deepEqual(
    workouts.bars.map((bar) => bar.count),
    [0, 0, 0, 0, 0, 4, 3, 2],
    "the three workouts either side of New Year are one week"
  );
  assert.equal(workouts.bars[7].weekStart, monday);
  assert.equal(workouts.bars[6].weekStart, Date.UTC(2026, 11, 28));
  assert.deepEqual(
    workouts.bars.map((bar) => bar.isCurrent),
    [false, false, false, false, false, false, false, true]
  );
  close(workouts.bars[5].ratio, 1, "the busiest week of the eight is the full height");
  close(workouts.bars[6].ratio, 0.75, "three of four");

  assert.equal(library.form.bars.length, 12);
  assert.equal(library.form.bars[0].weekStart, Date.UTC(2026, 9, 19), "twelve weeks back is 19 October");
  assert.equal(library.form.bars[0].count, 3);
  assert.equal(
    library.form.average,
    1.1,
    "13 workouts in the twelve weeks shown, this one included, is 1.1 a week"
  );
  assert.equal(library.form.streak, 2, "last week, across the new year, and the one before");
  assert.equal(lib.weeklyAverage([]), 0, "no bars, no average");
}

{
  // One decimal, rounded: 46 in twelve weeks.
  const rows = [];

  for (let offset = -11; offset <= 0; offset += 1) {
    rows.push(...workoutsIn(offset, offset >= -9 ? 4 : 3));
  }

  assert.equal(rows.length, 46);
  assert.equal(form(rows).average, 3.8, "46 / 12 is 3.83, shown as 3.8");
}

/* ------------------------------------------------------------ records -- */

{
  const days = lib.normalizeRecordDays([
    { performed_date_sort: iso(weekOf(-9)), record_count: 2 }, // before the eight weeks
    { performed_date_sort: iso(weekOf(-6) + DAY), record_count: 1 },
    { performed_date_sort: iso(weekOf(-1) + 2 * DAY), record_count: 3 },
    { performed_date_sort: iso(weekOf(-1) + 4 * DAY), record_count: 1 },
    { performed_date_sort: iso(THIS_MONDAY), record_count: 2 },
    { performed_date_sort: "not a day", record_count: 5 },
    { performed_date_sort: iso(THIS_MONDAY), record_count: 0 },
  ]);
  const records = lib.buildRecordsTile(days, { now: NOW });

  assert.equal(records.total, 9, "every record, however old; rows that say nothing are dropped");
  assert.equal(records.thisWeek, 2);
  assert.deepEqual(
    records.steps.map((step) => step.cumulative),
    [0, 1, 1, 1, 1, 1, 5, 7],
    "added up week by week from the start of the eight weeks"
  );
  assert.deepEqual(
    records.steps.map((step) => Math.round(step.ratio * 7)),
    [0, 1, 1, 1, 1, 1, 5, 7],
    "each step against the top one"
  );
}

{
  // No records at all: a flat line along the floor.
  const none = lib.buildRecordsTile([], { now: NOW });

  assert.equal(none.total, 0);
  assert.equal(none.thisWeek, 0);
  assert.ok(none.steps.every((step) => step.ratio === 0));

  const path = lib.buildStaircasePath(
    none.steps.map((step) => step.ratio),
    { width: 120, height: 30, inset: 1 }
  );
  const levels = [...path.matchAll(/V(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));

  assert.ok(path.startsWith("M1 29"), "the line starts at the bottom left");
  assert.equal(levels.length, 8, "a step a week");
  assert.ok(levels.every((level) => level === 29), `a flat line at the floor, got ${path}`);
  assert.ok(path.endsWith("H119"), "and it runs the whole width");
}

assert.equal(
  lib.buildStaircasePath([0, 0.5, 1], { width: 90, height: 30, inset: 1 }),
  "M1 29 V29 H30.33 V15 H59.67 V1 H89",
  "up to each week's level at its start, and along it"
);
assert.equal(lib.buildStaircasePath([], { width: 90, height: 30 }), "");
assert.equal(lib.buildStaircasePath([1], { width: 0, height: 30 }), "", "nothing before the width is known");

/* ------------------------------------------------------ muscle groups -- */

{
  const groupsByExercise = new Map([
    ["bench press", ["Chest", "Triceps"]],
    ["overhead press", ["Shoulders", "Triceps"]],
    ["squat", ["Quads", "Glutes"]],
    // Lower back is met first, so only the tie-break puts Hamstrings ahead.
    ["deadlift", ["Lower back", "Glutes", "Hamstrings"]],
    ["barbell row", ["Lats", "Biceps"]],
    ["calf raise", ["Calves"]],
  ]);
  const setsOf = (name, count, daysAgo) =>
    Array.from({ length: count }, (_, index) => ({
      exercise_name: name,
      weight: 50,
      reps: 8,
      performed_date_sort: iso(TODAY - daysAgo * DAY),
      workout_id: `${name}-${daysAgo}-${index}`,
    }));
  const sets = normalizeRecordRows([
    ...setsOf("Bench Press", 6, 10),
    ...setsOf("Overhead Press", 4, 20),
    ...setsOf("Squat", 5, 5),
    ...setsOf("Deadlift", 3, 89), // the first of the ninety days
    ...setsOf("Barbell Row", 2, 30),
    ...setsOf("Calf Raise", 1, 1),
    ...setsOf("Calf Raise", 10, 90), // the day before them: not counted
    ...setsOf("Plank", 4, 2), // in no group
  ]);
  const shares = lib.buildMuscleGroupShares(sets, { groupsByExercise, now: NOW });

  assert.deepEqual(
    shares.groups.map((group) => [group.label, group.setCount]),
    [
      ["Triceps", 10],
      ["Glutes", 8],
      ["Chest", 6],
      ["Quads", 5],
      ["Shoulders", 4],
      ["Hamstrings", 3],
    ],
    "the six busiest by sets, a set counting toward each of its exercise's groups; a tie goes by name"
  );
  assert.deepEqual(
    shares.groups.map((group) => group.rank),
    [0, 1, 2, 3, 4, 5],
    "the rank picks the colour"
  );
  close(
    shares.groups.reduce((sum, group) => sum + group.share, 0),
    1,
    "the six fill the bar between them"
  );
  close(shares.groups[0].share, 10 / 36, "each by its sets");
  assert.deepEqual(
    shares.legend.map((group) => group.label),
    ["Triceps", "Glutes", "Chest"],
    "the legend is the top three"
  );
  assert.equal(
    lib.buildMuscleGroupShares(sets, { groupsByExercise, now: NOW, days: 91 }).groups[0].label,
    "Calves",
    "a day further back and the old calf raises count"
  );

  const unsynced = lib.buildMuscleGroupShares(sets, { groupsByExercise: new Map(), now: NOW });

  assert.deepEqual(unsynced.groups, [], "no mapping yet: no groups, not a wrong bar");
  assert.deepEqual(unsynced.legend, []);
}

/* ------------------------------------------------------------ programs -- */

{
  const programs = [
    { program_id: 1, program_name: "Hypertrophy", start_date: "07.09.2026", status: "ACTIVE" },
    { program_id: 2, program_name: "Strength", start_date: "01.06.2026", status: "COMPLETE" },
    { program_id: 3, program_name: "Next", start_date: "01.11.2026", status: "NOT_STARTED" },
    { program_id: 4, program_name: "Older", start_date: "03.08.2026", status: "active" },
  ];
  const weeks = [
    { program_id: 1, microcycle_id: 11, workout_count: 3, completed_count: 3, day_count: 7, last_day_sort: "2026-09-13" },
    { program_id: 1, microcycle_id: 12, workout_count: 3, completed_count: 2, day_count: 7, last_day_sort: "2026-09-20" },
    // A rest week that has passed is done; one still to come is not, and a
    // week with no days at all has nothing to be done with.
    { program_id: 1, microcycle_id: 13, workout_count: 0, completed_count: 0, day_count: 7, last_day_sort: "2026-09-20" },
    { program_id: 1, microcycle_id: 14, workout_count: 0, completed_count: 0, day_count: 7, last_day_sort: "2026-10-04" },
    { program_id: 1, microcycle_id: 15, workout_count: 0, completed_count: 0, day_count: 0, last_day_sort: null },
    { program_id: 4, microcycle_id: 41, workout_count: 2, completed_count: 2, day_count: 7, last_day_sort: "2026-08-09" },
    { program_id: 4, microcycle_id: 42, workout_count: 2, completed_count: 0, day_count: 7, last_day_sort: "2026-08-16" },
    { program_id: 2, microcycle_id: 21, workout_count: 3, completed_count: 1, day_count: 7, last_day_sort: "2026-06-07" },
    { program_id: 3, microcycle_id: 31, workout_count: 3, completed_count: 0, day_count: 7, last_day_sort: "2026-11-07" },
    { program_id: 9, microcycle_id: null, workout_count: 0, completed_count: 0, day_count: 0 },
  ];
  const tile = lib.buildProgramsTile(programs, weeks, { now: NOW });

  assert.equal(tile.total, 4);
  assert.equal(tile.active, 2, "the status is read whatever its case");
  assert.deepEqual(
    tile.bars.map((bar) => [bar.programId, bar.kind]),
    [
      [1, "active"],
      [4, "active"],
      [2, "complete"],
      [3, "draft"],
    ],
    "active first, newest first; then finished; then drafts"
  );
  close(tile.bars[0].progress, 2 / 5, "two of its five weeks are behind it");
  assert.equal(tile.bars[0].doneWeeks, 2);
  assert.equal(tile.bars[0].totalWeeks, 5);
  close(tile.bars[1].progress, 1 / 2, "one of two");
  assert.equal(tile.bars[2].progress, 1, "a finished program is full, whatever its weeks say");
  assert.equal(tile.bars[3].progress, 0, "a draft is empty");
  assert.equal(tile.showEmptySlot, false);

  const many = Array.from({ length: 7 }, (_, index) => ({
    program_id: 100 + index,
    start_date: local(Date.UTC(2026, index, 1)),
    status: "COMPLETE",
  }));
  const capped = lib.buildProgramsTile(many, [], { now: NOW });

  assert.equal(capped.total, 7, "the number counts them all");
  assert.equal(capped.bars.length, lib.PROGRAM_BAR_LIMIT, "the bars stop at the limit");
  assert.equal(capped.bars[0].programId, 106, "the newest first");

  const lone = lib.buildProgramsTile([programs[0]], weeks, { now: NOW });

  assert.equal(lone.showEmptySlot, true, "a lone program leaves room for another");
  assert.equal(lone.bars.length, 1);

  const none = lib.buildProgramsTile([], [], { now: NOW });

  assert.deepEqual(
    { total: none.total, active: none.active, bars: none.bars, showEmptySlot: none.showEmptySlot },
    { total: 0, active: 0, bars: [], showEmptySlot: true }
  );
}

/* ---------------------------------------------------------------- 1RM -- */

{
  const set = (name, weight, reps, daysAgo, setType = "working") => ({
    exercise_name: name,
    weight,
    reps,
    set_type: setType,
    performed_date_sort: iso(TODAY - daysAgo * DAY),
    workout_id: `${name}-${daysAgo}`,
  });
  const sets = normalizeRecordRows([
    set("Bench Press", 100, 5, 3),
    set("Squat", 140, 3, 10),
    set("Bench Press", 105, 8, 12, "amrap"),
    set("Deadlift", 180, 2, 29), // the first of the thirty days: the best
    set("Deadlift", 200, 1, 30), // the day before them: would win, is out
    set("Squat", 170, 4, 2, "drop"), // heavier estimate, but a drop set
    set("Leg Press", 150, 15, 1), // past the reps the estimate is kept for
  ]);
  const best = lib.buildBestOneRepMax(sets, { now: NOW });

  assert.equal(best.name, "Deadlift");
  assert.equal(best.weight, 180);
  assert.equal(best.reps, 2);
  assert.equal(best.at, TODAY - 29 * DAY);
  assert.equal(
    best.value,
    roundToNearestWeightIncrement(calculateBrzyckiOneRepMax(180, 2)),
    "the calculator's own sum and rounding"
  );
  assert.equal(best.value, 185, "180 kg for two is 185.2, to the half kilo 185");

  assert.equal(
    lib.buildBestOneRepMax(normalizeRecordRows([set("Bench Press", 100, 5, 3)]), { now: NOW }).value,
    112.5,
    "100 kg for five is 112.5"
  );

  const onlyOld = lib.buildBestOneRepMax(normalizeRecordRows([set("Deadlift", 200, 1, 30)]), {
    now: NOW,
  });

  assert.equal(onlyOld, null, "nothing inside the thirty days is nothing");

  const repeat = lib.buildBestOneRepMax(
    normalizeRecordRows([set("Squat", 140, 3, 10), set("Squat", 140, 3, 4)]),
    { now: NOW }
  );

  assert.equal(repeat.at, TODAY - 4 * DAY, "the same set twice: the newer one");
  assert.equal(lib.buildBestOneRepMax([], { now: NOW }), null);
}

assert.equal(lib.abbreviateExerciseName("Squat"), "Squat", "a name that fits stays");
assert.equal(lib.abbreviateExerciseName("Hip Thrust"), "Hip Thrust", "ten letters fit");
assert.equal(lib.abbreviateExerciseName("Bench Press"), "BP");
assert.equal(lib.abbreviateExerciseName("Romanian Deadlift"), "RD");
assert.equal(lib.abbreviateExerciseName("Barbell  Bench   Press"), "BBP");
assert.equal(lib.abbreviateExerciseName("Barbell Bench Press", { nickname: "Bench" }), "Bench", "a short nickname beats initials");
assert.equal(lib.abbreviateExerciseName("Deadlift", { nickname: "DL" }), "Deadlift", "a name that fits beats a nickname");
assert.equal(lib.abbreviateExerciseName("Barbell Bench Press", { nickname: "Barbell bench" }), "BBP", "a long nickname is no help");
assert.equal(lib.abbreviateExerciseName("Hyperextensions"), "Hyperexte.", "one long word is cut short");
assert.equal(lib.abbreviateExerciseName("Øvre ryg-træk på maskine"), "ØRTP", "Danish letters are initials too");

/* ----------------------------------------------------------- sick days -- */

{
  const rows = [
    { start_date: "28.01.2026", end_date: "03.02.2026" }, // over a month boundary
    { start_date: "29.12.2025", end_date: "02.01.2026" }, // over the new year
    { start_date: "2026-03-10", end_date: "2026-03-10" }, // the ISO spelling, one day
    { start_date: "20.09.2026", end_date: "30.09.2026" }, // ends after today
    { start_date: "22.09.2026", end_date: null }, // still ill, and overlapping
    { start_date: "05.05.2026", end_date: "01.05.2026" }, // ends before it starts
    { start_date: "31.02.2026", end_date: "02.03.2026" }, // a day that does not exist
    { start_date: "01.10.2026", end_date: "05.10.2026" }, // has not happened
  ];
  const { sickDays } = lib.buildTrainTools({ sicknessRows: rows }, { now: NOW });

  assert.equal(sickDays.year, 2026);
  assert.deepEqual(
    sickDays.months.map((month) => month.days),
    [6, 3, 1, 0, 0, 0, 0, 0, 5, 0, 0, 0],
    "January has 28-31 and the first two; February 1-3; September the 20th to today, once"
  );
  assert.equal(sickDays.total, 15);
  assert.deepEqual(
    sickDays.months.map((month) => month.isCurrent),
    [false, false, false, false, false, false, false, false, true, false, false, false]
  );
  assert.deepEqual(
    sickDays.months.map((month) => month.isUpcoming),
    [false, false, false, false, false, false, false, false, false, true, true, true],
    "October to December are still to come"
  );

  const sickWeeks = lib.buildSickWeeks(lib.normalizeSicknessPeriods(rows, { now: NOW }));

  assert.ok(sickWeeks.has(Date.UTC(2026, 0, 26)), "the week of 28 January");
  assert.ok(sickWeeks.has(Date.UTC(2026, 1, 2)), "and the week it ran into");
  assert.ok(sickWeeks.has(Date.UTC(2025, 11, 29)), "the week over the new year");
  assert.ok(sickWeeks.has(THIS_MONDAY), "this week, ill since Sunday");
  assert.ok(sickWeeks.has(Date.UTC(2026, 8, 14)), "and last week, which that Sunday ends");
  assert.ok(!sickWeeks.has(Date.UTC(2026, 8, 28)), "next week has not happened yet");
}

/* -------------------------------------------------------------- empty -- */

{
  const empty = lib.buildTrainLibrary({}, { now: NOW });

  assert.equal(empty.workouts.total, 0);
  assert.equal(empty.workouts.thisWeek, 0);
  assert.equal(empty.workouts.bars.length, lib.WORKOUT_TILE_WEEKS);
  assert.ok(empty.workouts.bars.every((bar) => bar.count === 0 && bar.ratio === 0), "flat bars");
  assert.equal(empty.form.streak, 0, "the streak is 0, not missing");
  assert.equal(empty.form.average, 0);
  assert.equal(empty.form.bars.length, lib.FORM_WEEKS);
  assert.ok(empty.form.bars.every((bar) => bar.ratio === 0 && !bar.inStreak && !bar.isSick));
  assert.equal(empty.records.total, 0);
  assert.ok(empty.records.steps.every((step) => step.ratio === 0), "a flat line");
  assert.equal(empty.exercises.count, 0);
  assert.equal(empty.programs.total, 0);
  assert.equal(empty.programs.showEmptySlot, true);

  const tools = lib.buildTrainTools({}, { now: NOW });

  assert.equal(tools.oneRepMax, null);
  assert.equal(tools.sickDays.total, 0, "no sick days is 0");
  assert.ok(tools.sickDays.months.every((month) => month.days === 0), "and a grey grid");
  assert.equal(tools.sickDays.months.length, 12);

  // Rows that say nothing usable are skipped rather than counted.
  const junk = lib.buildTrainLibrary(
    {
      workoutRows: [null, {}, { workout_id: 1, performed_date_sort: "someday" }],
      recordDayRows: [null, { record_count: 2 }],
      sicknessRows: [null, { start_date: null }],
      catalogRows: [null, { exercise_name: "  " }],
    },
    { now: NOW }
  );

  assert.equal(junk.workouts.total, 0);
  assert.equal(junk.records.total, 0);
  assert.equal(junk.exercises.count, 0);
  assert.equal(junk.form.streak, 0);
}

assert.equal(
  lib.countCatalogExercises([
    { exercise_name: "Squat" },
    { exercise_name: "squat " },
    { exercise_name: "Bench Press" },
    { exercise_name: "" },
    { name: "Deadlift" },
  ]),
  3,
  "one per name, the way the catalog lists them"
);

{
  // The tool names the exercise by its catalog nickname when its name is long.
  const tools = lib.buildTrainTools(
    {
      sets: normalizeRecordRows([
        {
          exercise_name: "Barbell Bench Press",
          weight: 100,
          reps: 5,
          performed_date_sort: iso(TODAY - DAY),
          workout_id: 1,
        },
      ]),
      catalogRows: [{ exercise_name: "barbell bench press", nickname: "Bench" }],
    },
    { now: NOW }
  );

  assert.equal(tools.oneRepMax.name, "Barbell Bench Press", "the full name goes to the calculator");
  assert.equal(tools.oneRepMax.abbreviation, "Bench");
  assert.equal(tools.oneRepMax.value, 112.5);
}

/* --------------------------------------------------------- the queries -- */

function database() {
  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  return {
    raw,
    db: {
      getAllAsync: async (sql, params = []) =>
        raw.prepare(sql).all(...params).map((row) => ({ ...row })),
    },
  };
}

async function recordsQuery() {
  const { raw, db } = database();
  let setId = 1;
  const workout = (workoutId, date, { dayDeleted = null } = {}) => {
    raw
      .prepare("INSERT INTO Day (day_id, Weekday, date, deleted_at) VALUES (?, 'Monday', ?, ?)")
      .run(workoutId, date, dayDeleted);
    raw
      .prepare(
        "INSERT INTO Workout_Type_Instance (workout_id, day_id, date, label, done) VALUES (?, ?, ?, 'W', 1)"
      )
      .run(workoutId, workoutId, date);
    raw
      .prepare(
        "INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name) VALUES (?, ?, 'Squat')"
      )
      .run(workoutId, workoutId);
  };
  const addSet = (exerciseId, fields) => {
    const set = {
      personal_record: 1,
      done: 1,
      failed: 0,
      weight: 100,
      reps: 5,
      set_type: "working",
      deleted_at: null,
      ...fields,
    };

    raw
      .prepare(
        `INSERT INTO "Set" (sets_id, set_number, exercise_instance_id, personal_record, done, failed, weight, reps, set_type, deleted_at)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        setId++,
        exerciseId,
        set.personal_record,
        set.done,
        set.failed,
        set.weight,
        set.reps,
        set.set_type,
        set.deleted_at
      );
  };

  workout(1, "2026-09-20");
  addSet(1, {});
  addSet(1, { reps: 3 });
  addSet(1, { personal_record: 0 }); // not a record
  addSet(1, { set_type: "warmup" }); // a warm-up is in no record
  addSet(1, { failed: 1 });
  addSet(1, { done: 0 });
  addSet(1, { deleted_at: "2026-09-21T10:00:00Z" });
  addSet(1, { weight: 0 });
  addSet(1, { set_type: "drop" }); // counted, as the trophy room counts it
  workout(2, "01.08.2026"); // the other spelling
  addSet(2, {});
  workout(3, "2026-09-10", { dayDeleted: "2026-09-11T08:00:00Z" });
  addSet(3, {});
  workout(4, "2026-09-20"); // another workout on the same day
  addSet(4, { weight: 102.5 });

  const rows = await trainRepository.getPersonalRecordCountsByDay(db);

  assert.deepEqual(
    rows,
    [
      { performed_date_sort: "2026-08-01", record_count: 1 },
      { performed_date_sort: "2026-09-20", record_count: 4 },
    ],
    "records a day, in either spelling, with the sets Records leaves out left out here too"
  );

  const trophyRoomCount = normalizeRecordRows(
    await weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db)
  ).filter((set) => set.isRecord).length;
  const tile = lib.buildRecordsTile(lib.normalizeRecordDays(rows), { now: NOW });

  assert.equal(tile.total, trophyRoomCount, "the tile's total is the trophy room's record count");
  assert.equal(tile.total, 5);
}

async function programsQuery() {
  const { raw, db } = database();
  const run = (sql, ...params) => raw.prepare(sql).run(...params);

  run("INSERT INTO Program (program_id, program_name, start_date, status) VALUES (1, 'P', '14.09.2026', 'ACTIVE')");
  run("INSERT INTO Mesocycle (mesocycle_id, program_id, mesocycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (1, 1, 1)");
  run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (2, 1, 2)");
  run("INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number) VALUES (3, 1, 3)");
  run(
    "INSERT INTO Microcycle (microcycle_id, mesocycle_id, microcycle_number, deleted_at) VALUES (4, 1, 4, '2026-09-01')"
  );

  const day = (dayId, microcycleId, date, isSick = 0) =>
    run(
      "INSERT INTO Day (day_id, microcycle_id, program_id, Weekday, date, is_sick) VALUES (?, ?, 1, 'Monday', ?, ?)",
      dayId,
      microcycleId,
      date,
      isSick
    );
  const workout = (workoutId, dayId, done, deletedAt = null) =>
    run(
      "INSERT INTO Workout_Type_Instance (workout_id, day_id, date, done, deleted_at) VALUES (?, ?, '', ?, ?)",
      workoutId,
      dayId,
      done,
      deletedAt
    );

  // Week 1: done on Monday; ill on Wednesday, which has passed; ill on Friday
  // the 25th, which has not; and a deleted workout that counts for nothing.
  day(1, 1, "14.09.2026");
  workout(1, 1, 1);
  day(2, 1, "16.09.2026", 1);
  workout(2, 2, 0);
  day(3, 1, "2026-09-25", 1);
  workout(3, 3, 0);
  workout(4, 1, 0, "2026-09-15T09:00:00Z");
  // Week 2: two rest days, both behind us. Week 3: no days at all.
  day(4, 2, "21.09.2026");
  day(5, 2, "22.09.2026");
  day(6, 4, "28.09.2026"); // in the deleted week

  const rows = await trainRepository.getProgramMicrocycleProgress(db, { todayIso: "2026-09-24" });

  assert.deepEqual(
    rows,
    [
      { program_id: 1, microcycle_id: 1, day_count: 3, last_day_sort: "2026-09-25", workout_count: 3, completed_count: 2 },
      { program_id: 1, microcycle_id: 2, day_count: 2, last_day_sort: "2026-09-22", workout_count: 0, completed_count: 0 },
      { program_id: 1, microcycle_id: 3, day_count: 0, last_day_sort: null, workout_count: 0, completed_count: 0 },
    ],
    "a workout on a sick day that has passed is complete; one still to come is not"
  );

  const tomorrow = await trainRepository.getProgramMicrocycleProgress(db, { todayIso: "2026-09-26" });

  assert.equal(tomorrow[0].completed_count, 3, "once Friday has passed, its sick workout counts too");

  const programs = await db.getAllAsync("SELECT program_id, program_name, start_date, status FROM Program");
  const tile = lib.buildProgramsTile(programs, rows, { now: NOW });

  close(tile.bars[0].progress, 1 / 3, "only the rest week that has passed is done");
}

(async () => {
  await recordsQuery();
  await programsQuery();

  console.log(
    "Train library: streak, averages, weekly bars, records, muscle groups, programs, 1RM, sick days and the two queries all check out."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
