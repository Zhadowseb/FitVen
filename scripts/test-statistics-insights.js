// The Statistics page's numbers: the period, the three normalisers, the bars,
// the week streaks, the weekdays, the running best 1RM behind the intensity,
// its zones and RPE bands, the set type shares, the runs' pace and fastest
// run, the exercises in a period, the teasers - and what each of them says
// when there is nothing to count.
//
// src/Utils/statisticsInsights.js is pure, so it runs here as it is, through
// the same loader the other app-module tests use.
const assert = require("assert/strict");
const loadAppModule = require("./lib/loadAppModule");

const stats = loadAppModule("src/Utils/statisticsInsights.js");
const { normalizeRecordRows, startOfWeek } = loadAppModule("src/Utils/recordsInsights.js");

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
// Thursday 17 September 2026 at noon UTC: the same calendar day in every time
// zone within eleven hours of UTC, so dayOf() lands on the 17th wherever this
// runs.
const NOW = Date.UTC(2026, 8, 17, 12);
const TODAY = Date.UTC(2026, 8, 17);
const THIS_MONDAY = Date.UTC(2026, 8, 14);

const isoDay = (daysAgo) => new Date(TODAY - daysAgo * DAY).toISOString().slice(0, 10);
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);

const period = (key) => stats.resolvePeriod(key, NOW);

/* ------------------------------------------------------------ periods -- */

assert.equal(stats.dayOf(NOW), TODAY, "dayOf is the calendar day as a UTC midnight");
assert.equal(startOfWeek(TODAY), THIS_MONDAY, "the test's week starts on Monday the 14th");

const fourWeeks = period("4w");
assert.equal(fourWeeks.key, "4w");
assert.equal(fourWeeks.from, TODAY - 27 * DAY, "four weeks are today and the 27 days before it");
assert.equal(fourWeeks.to, TODAY + DAY, "the period ends after today");
assert.equal(stats.isInPeriod(TODAY - 27 * DAY, fourWeeks), true, "the first day is inside");
assert.equal(stats.isInPeriod(TODAY - 28 * DAY, fourWeeks), false, "the day before it is not");
assert.equal(stats.isInPeriod(TODAY, fourWeeks), true, "today is inside");
assert.equal(stats.isInPeriod(TODAY + DAY, fourWeeks), false, "tomorrow is not");
assert.equal(period("all").from, null, "the whole history has no first day");
assert.equal(stats.isInPeriod(Date.UTC(2001, 0, 1), period("all")), true);
assert.equal(period("nonsense").key, "3m", "an unknown key is the three months the overview falls back to");
assert.equal(period("1y").from, TODAY - 364 * DAY);

/* -------------------------------------------------------- normalising -- */

const workoutRows = [
  { workout_id: 3, workout_type: "Run", elapsed_time: 1800, performed_date_sort: isoDay(1) },
  { workout_id: 1, workout_type: "Resistance", elapsed_time: 3600, performed_date_sort: isoDay(3) },
  // The same workout twice - a join fanned it out - counts once.
  { workout_id: 1, workout_type: "Resistance", elapsed_time: 3600, performed_date_sort: isoDay(3) },
  { workout_id: 2, workout_type: "Upperbody", elapsed_time: null, performed_date_sort: isoDay(2) },
  // Milliseconds where seconds belong: normalizeElapsedDurationSeconds repairs it.
  { workout_id: 4, workout_type: "Walk", elapsed_time: 2400000, performed_date_sort: isoDay(0) },
  { workout_id: 5, workout_type: "Run", elapsed_time: 600, performed_date_sort: null },
];
const normalizedWorkouts = stats.normalizeStatisticsWorkouts(workoutRows);
assert.deepEqual(
  normalizedWorkouts.map((workout) => [workout.id, workout.kind, workout.seconds]),
  [
    [1, "strength", 3600],
    [2, "strength", 0],
    [3, "run", 1800],
    [4, "walk", 2400],
  ],
  "one workout per id, oldest first, Upperbody is strength, no time is 0, a row without a day is dropped"
);
assert.equal(stats.workoutKind("StrengthTraining"), "strength");
assert.equal(stats.workoutKind(undefined), "strength");

const runRows = [
  { workout_id: 10, type: "WARMUP", actual_distance: 1, actual_duration_seconds: 360, workout_type: "Run", performed_date_sort: isoDay(2) },
  { workout_id: 10, type: "WORKING_SET", actual_distance: 4, actual_duration_seconds: 1140, workout_type: "Run", performed_date_sort: isoDay(2) },
  { workout_id: 11, type: "WORKING_SET", actual_distance: null, actual_duration_seconds: 900, workout_type: "Run", performed_date_sort: isoDay(1) },
  { workout_id: 12, type: "WORKING_SET", actual_distance: 2.5, actual_duration_seconds: 1800, workout_type: "Walk", performed_date_sort: isoDay(1) },
  { workout_id: 13, type: "WORKING_SET", actual_distance: 3, actual_duration_seconds: 60, workout_type: "Resistance", performed_date_sort: isoDay(1) },
];
const normalizedRuns = stats.normalizeRunSegments(runRows);
assert.deepEqual(
  normalizedRuns.map((run) => [run.id, run.kind, run.km, run.seconds]),
  [
    [10, "run", 5, 1500],
    [11, "run", 0, 900],
    [12, "walk", 2.5, 1800],
  ],
  "segments add up per workout, warm-up included; no distance is 0 km; a strength workout is not a run"
);

const typeRows = [
  { set_type: "warmup", reps: 10, performed_date_sort: isoDay(1) },
  { set_type: "working", amrap: 1, amrap_target: 8, reps: 11, performed_date_sort: isoDay(1) },
  { set_type: "made-up", reps: null, performed_date_sort: isoDay(1) },
  { set_type: "amrap", amrap_target: 0, reps: 9, performed_date_sort: isoDay(1) },
  { set_type: "drop", reps: 12, performed_date_sort: "" },
];
const normalizedTypes = stats.normalizeSetTypeRows(typeRows);
assert.deepEqual(
  normalizedTypes.map((set) => [set.type, set.reps, set.amrapTarget]),
  [
    ["warmup", 10, null],
    ["amrap", 11, 8],
    ["working", null, null],
    ["amrap", 9, null],
  ],
  "an older client's AMRAP flag wins over 'working', an unknown type is working, a target of 0 is none"
);

for (const normalise of [
  stats.normalizeStatisticsWorkouts,
  stats.normalizeRunSegments,
  stats.normalizeSetTypeRows,
]) {
  assert.deepEqual(normalise(), [], `${normalise.name} with nothing gives nothing`);
  assert.deepEqual(normalise([]), [], `${normalise.name} with an empty list gives nothing`);
}

/* ------------------------------------------------------------ streaks -- */

const onDays = (...daysAgo) => daysAgo.map((ago, index) => ({ id: index + 1, at: TODAY - ago * DAY, kind: "strength", seconds: 0 }));
// Weeks by their offset from this one: 0 is this week (Monday the 14th), 1 last week.
const inWeeks = (...weeksAgo) =>
  weeksAgo.map((ago, index) => ({ id: index + 1, at: THIS_MONDAY - ago * WEEK + DAY, kind: "strength", seconds: 0 }));

let streak = stats.buildCurrentStreak(inWeeks(0, 1, 2, 4, 5), { now: NOW });
assert.deepEqual(streak, { weeks: 3, includesThisWeek: true }, "trained this week: the streak ends with this week");

streak = stats.buildCurrentStreak(inWeeks(1, 2, 3, 5), { now: NOW });
assert.deepEqual(streak, { weeks: 3, includesThisWeek: false }, "not yet this week: the streak still ends with last week");

streak = stats.buildCurrentStreak(inWeeks(2, 3, 4), { now: NOW });
assert.deepEqual(streak, { weeks: 0, includesThisWeek: false }, "a week without training ends the streak");

// Three workouts in one week are one week.
assert.equal(stats.buildCurrentStreak(onDays(0, 1, 2), { now: NOW }).weeks, 1);
// Monday of this week and Sunday of last week are two weeks in a row.
assert.equal(stats.buildCurrentStreak(onDays(3, 4), { now: NOW }).weeks, 2);

assert.equal(stats.buildLongestStreak(inWeeks(0, 1, 2, 4, 5, 6, 7, 8, 12)), 5, "the longest run is the whole history's");
assert.equal(stats.buildLongestStreak(inWeeks(30)), 1);
assert.deepEqual(stats.buildCurrentStreak([], { now: NOW }), { weeks: 0, includesThisWeek: false });
assert.equal(stats.buildLongestStreak([]), 0);

/* ----------------------------------------------------------- weekdays -- */

// The 14th is a Monday, so 3 days ago is Monday, 1 day ago Wednesday and
// 4 days ago Sunday. 29 days ago is outside four weeks.
const weekdayWorkouts = onDays(3, 3, 1, 4, 10, 29);
assert.deepEqual(
  stats.buildWeekdayCounts(weekdayWorkouts, { period: fourWeeks }),
  [3, 0, 1, 0, 0, 0, 1],
  "Monday first; ten days ago was a Monday too; the day outside the period is not counted"
);
assert.deepEqual(stats.buildWeekdayCounts([], { period: fourWeeks }), [0, 0, 0, 0, 0, 0, 0]);

/* --------------------------------------------------------- per week ---- */

// Eight workouts in the last four weeks, and a history long before them.
const steady = [...onDays(1, 4, 8, 11, 15, 18, 22, 25), ...onDays(200, 300)];
close(stats.averagePerWeek(steady, { period: fourWeeks }), 2, "8 workouts in 4 weeks are 2 a week");
// Started eight days ago: two workouts over eight days, not over three months.
close(stats.averagePerWeek(onDays(7, 0), { period: period("3m") }), 2 / (8 / 7), "counted from the first workout");
assert.equal(stats.averagePerWeek(onDays(0), { period: period("1y") }), 1, "a first workout today is one a week, not seven");
assert.equal(stats.averagePerWeek(onDays(40), { period: fourWeeks }), null, "nothing in the period is no average");
assert.equal(stats.averagePerWeek([], { period: period("all") }), null);

/* ------------------------------------------------------------ buckets -- */

// 24 days ago was Monday the 24th of August, the first of the four weeks.
const weekly = stats.buildPeriodBuckets(onDays(0, 1, 7, 24), { period: fourWeeks });
assert.equal(weekly.unit, "week");
assert.deepEqual(
  weekly.buckets.map((bucket) => bucket.start),
  [THIS_MONDAY - 3 * WEEK, THIS_MONDAY - 2 * WEEK, THIS_MONDAY - WEEK, THIS_MONDAY],
  "four weeks are four Mondays, this week last"
);
assert.deepEqual(weekly.buckets.map((bucket) => bucket.value), [1, 0, 1, 2]);
assert.deepEqual(weekly.buckets.map((bucket) => bucket.isEmpty), [false, true, false, false]);
assert.equal(stats.buildPeriodBuckets([], { period: period("3m") }).buckets.length, 13, "three months are thirteen weeks");

// 40 days ago was the 8th of August; 400 days ago is before the first bar.
const yearly = stats.buildPeriodBuckets(onDays(0, 40, 70, 400), { period: period("1y") });
assert.equal(yearly.unit, "month");
assert.equal(yearly.buckets.length, 12, "a year is twelve months, this one last");
assert.equal(yearly.buckets[11].start, Date.UTC(2026, 8, 1));
assert.equal(yearly.buckets[0].start, Date.UTC(2025, 9, 1));
assert.deepEqual(
  yearly.buckets.map((bucket) => bucket.value),
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  "September, August and July each hold one"
);

const kmChart = stats.buildPeriodBuckets(
  [{ at: TODAY, km: 5 }, { at: TODAY - DAY, km: 2.5 }],
  { period: fourWeeks, amountOf: (run) => run.km }
);
assert.equal(kmChart.buckets[3].value, 7.5, "amountOf decides what a bar adds up");

const allTime = stats.buildPeriodBuckets(onDays(0, 100), { period: period("all") });
assert.equal(allTime.buckets.length, 4, "the whole history starts at its first month: June to September");
assert.equal(allTime.buckets[0].start, Date.UTC(2026, 5, 1));
const longAgo = stats.buildPeriodBuckets(onDays(0, 1500), { period: period("all") });
assert.equal(longAgo.buckets.length, 24, "and shows at most two years of months");
assert.equal(longAgo.buckets.every((bucket, index) => index === 23 || bucket.isEmpty), true);
const nothing = stats.buildPeriodBuckets([], { period: period("all") });
assert.equal(nothing.buckets.length, 1, "no history is this month, empty");
assert.equal(nothing.buckets[0].isEmpty, true);

/* ---------------------------------------------------------- frequency -- */

const mixed = [
  { id: 1, at: TODAY, kind: "strength", seconds: 3600 },
  { id: 2, at: TODAY - DAY, kind: "run", seconds: 1800 },
  { id: 3, at: TODAY - 2 * DAY, kind: "walk", seconds: 0 },
  { id: 4, at: TODAY - 9 * DAY, kind: "strength", seconds: 4200 },
  { id: 5, at: TODAY - 60 * DAY, kind: "strength", seconds: 3000 },
];
const frequency = stats.buildFrequency(mixed, { period: fourWeeks, now: NOW });
assert.equal(frequency.count, 4);
assert.deepEqual(frequency.byKind, { strength: 2, run: 1, walk: 1 }, "a run and a walk count as workouts too");
assert.equal(frequency.totalSeconds, 9600, "time counts only the workouts in the period");
assert.equal(frequency.timedCount, 3);
assert.equal(frequency.averageSeconds, 3200, "a workout without a time is not in the average");
assert.deepEqual(frequency.streak, { weeks: 2, includesThisWeek: true });
assert.equal(frequency.longestStreak, 2);
assert.equal(frequency.chart.unit, "week");

const idle = stats.buildFrequency([], { period: fourWeeks, now: NOW });
assert.equal(idle.count, 0);
assert.equal(idle.perWeek, null);
assert.equal(idle.averageSeconds, null);
assert.deepEqual(idle.weekdays, [0, 0, 0, 0, 0, 0, 0]);
assert.deepEqual(idle.streak, { weeks: 0, includesThisWeek: false });
assert.equal(idle.longestStreak, 0);
assert.equal(idle.chart.buckets.every((bucket) => bucket.isEmpty), true);

/* ---------------------------------------------------------- intensity -- */

// Brzycki, as the app has it: weight / (1.0278 - 0.0278 × reps).
const brzycki = (weight, reps) => weight / (1.0278 - 0.0278 * reps);

const liftRow = (name, weight, reps, daysAgo, extra = {}) => ({
  exercise_name: name,
  weight,
  reps,
  performed_date_sort: isoDay(daysAgo),
  workout_id: extra.workout ?? `w-${daysAgo}`,
  set_type: extra.type ?? "working",
  rpe: extra.rpe ?? null,
});

const lifts = normalizeRecordRows([
  // The first session is measured against itself.
  liftRow("Squat", 100, 5, 60),
  liftRow("Squat", 90, 5, 60),
  // A long, light set: 20 reps would "estimate" 148 kg, which is no best.
  liftRow("Squat", 70, 20, 50),
  // A drop set with a big estimate neither sets the best nor is measured.
  liftRow("Squat", 80, 12, 45, { type: "drop" }),
  liftRow("Squat", 80, 5, 40),
  // A new best, which the same day's lighter set is measured against.
  liftRow("Squat", 110, 3, 20, { rpe: 9 }),
  liftRow("Squat", 95, 5, 20, { rpe: 8.5 }),
  liftRow("Squat", 100, 1, 10, { type: "amrap", rpe: 10 }),
  liftRow("Bench", 60, 1, 5, { rpe: 7 }),
  liftRow("Bench", 40, 10, 5),
]);

const intensities = stats.buildRelativeIntensities(lifts);
const intensityOf = (name, weight, daysAgo) =>
  intensities.find((set) => set.name === name && set.weight === weight && set.at === TODAY - daysAgo * DAY)?.intensity;

const firstBest = brzycki(100, 5);
const newBest = brzycki(110, 3);
close(intensityOf("Squat", 100, 60), 100 / firstBest, "the first session's best comes from the first session");
close(intensityOf("Squat", 90, 60), 90 / firstBest, "a lighter set that day is measured against the same best");
close(intensityOf("Squat", 70, 50), 70 / firstBest, "twenty reps do not raise the best");
close(intensityOf("Squat", 80, 40), 80 / firstBest, "nor does a drop set");
assert.equal(intensityOf("Squat", 80, 45), undefined, "a drop set is not measured");
close(intensityOf("Squat", 110, 20), 110 / newBest, "the running best moves up on the day it is beaten");
close(intensityOf("Squat", 95, 20), 95 / newBest, "and the rest of that day is measured against it");
close(intensityOf("Squat", 100, 10), 100 / newBest, "an AMRAP set is measured like a working set");
assert.equal(intensityOf("Bench", 60, 5), 1, "a single at your best is 100 %");
close(intensityOf("Bench", 40, 5), 40 / 60, "exercises keep their own best: bench is not measured against squat");
assert.equal(intensities.length, 9);
assert.ok(intensities.every((set) => set.intensity > 0 && set.intensity <= 1), "nothing goes over 100 %");

assert.equal(stats.intensityZone(0.59), "below60");
assert.equal(stats.intensityZone(0.6), "from60");
assert.equal(stats.intensityZone(0.699), "from60");
assert.equal(stats.intensityZone(0.7), "from70");
assert.equal(stats.intensityZone(0.8), "from80");
assert.equal(stats.intensityZone(0.85), "from80");
assert.equal(stats.intensityZone(0.9), "from90");
assert.equal(stats.intensityZone(1), "from90");

// Four weeks hold the squat sets of 20 and 10 days ago and the bench of 5:
// 94 %, 82 % and 86 % of the new best, and 100 % and 67 % of bench's own.
const intensity = stats.buildIntensity(lifts, { period: fourWeeks });
const recent = [110 / newBest, 95 / newBest, 100 / newBest, 1, 40 / 60];
assert.equal(intensity.count, 5, "only the period's sets, although the whole history set the best");
close(intensity.average, recent.reduce((sum, value) => sum + value, 0) / recent.length, "the average intensity");
assert.deepEqual(
  intensity.zones.map((zone) => [zone.key, zone.count]),
  [
    ["below60", 0],
    ["from60", 1],
    ["from70", 0],
    ["from80", 2],
    ["from90", 2],
  ]
);
close(intensity.zones.reduce((sum, zone) => sum + zone.share, 0), 1, "the zone shares add up to all of it");
assert.equal(intensity.heavyCount, 3, "85 % and over is heavy: 94 %, 86 % and 100 %");
assert.equal(intensity.rpe.count, 4, "the sets without an RPE are not in its average");
close(intensity.rpe.average, (9 + 8.5 + 10 + 7) / 4, "the average RPE");
assert.deepEqual(
  intensity.rpe.bands.map((band) => [band.key, band.count]),
  [
    ["upTo7", 1],
    ["rpe8", 0],
    ["rpe9", 2],
    ["rpe10", 1],
  ],
  "8.5 rounds up to a 9"
);
assert.equal(stats.rpeBand(6), "upTo7");
assert.equal(stats.rpeBand(8.4), "rpe8");
assert.equal(stats.rpeBand(10), "rpe10");

const noRpe = stats.buildIntensity(lifts, { period: stats.resolvePeriod("4w", NOW - 40 * DAY) });
assert.equal(noRpe.count, 4, "four weeks ending forty days ago: the squat sets of 60, 50 and 40 days ago");
assert.equal(noRpe.rpe, null, "no RPE in the period is no RPE section");

const noLifts = stats.buildIntensity([], { period: fourWeeks });
assert.equal(noLifts.count, 0);
assert.equal(noLifts.average, null);
assert.equal(noLifts.heavyCount, 0);
assert.equal(noLifts.rpe, null);
assert.ok(noLifts.zones.every((zone) => zone.count === 0 && zone.share === 0));

/* ---------------------------------------------------------- set types -- */

const setTypes = stats.normalizeSetTypeRows([
  { set_type: "warmup", reps: 10, performed_date_sort: isoDay(1) },
  { set_type: "warmup", reps: 8, performed_date_sort: isoDay(1) },
  { set_type: "working", reps: 5, performed_date_sort: isoDay(1) },
  { set_type: "working", reps: 5, performed_date_sort: isoDay(1) },
  { set_type: "working", reps: 5, performed_date_sort: isoDay(1) },
  { set_type: "drop", reps: 12, performed_date_sort: isoDay(1) },
  { set_type: "drop", reps: 10, performed_date_sort: isoDay(1) },
  { set_type: "drop", reps: 8, performed_date_sort: isoDay(1) },
  { set_type: "amrap", amrap_target: 8, reps: 11, performed_date_sort: isoDay(1) },
  { set_type: "working", amrap: 1, amrap_target: 6, reps: 5, performed_date_sort: isoDay(2) },
  { set_type: "amrap", reps: 20, performed_date_sort: isoDay(2) },
  { set_type: "drop", reps: 10, performed_date_sort: isoDay(200) },
]);
const shares = stats.buildSetTypeShares(setTypes, { period: fourWeeks });
assert.equal(shares.total, 11, "the set 200 days ago is outside the period");
assert.deepEqual(
  shares.types.map((entry) => [entry.type, entry.count]),
  [
    ["warmup", 2],
    ["working", 3],
    ["drop", 3],
    ["amrap", 3],
  ],
  "warm-ups are counted, and an older client's AMRAP is an AMRAP"
);
close(shares.types[2].share, 3 / 11, "a share is of every set in the period");
close(shares.types.reduce((sum, entry) => sum + entry.share, 0), 1, "the shares add up to all of it");
assert.equal(shares.amrap.count, 2, "an AMRAP set without a target is not in the average");
close(shares.amrap.averageOverTarget, ((11 - 8) + (5 - 6)) / 2, "short of the target counts as below it");

const noSets = stats.buildSetTypeShares([], { period: fourWeeks });
assert.equal(noSets.total, 0);
assert.equal(noSets.amrap, null);
assert.ok(noSets.types.every((entry) => entry.count === 0 && entry.share === 0));

const volumeSets = normalizeRecordRows([
  liftRow("Row", 100, 5, 2),
  liftRow("Row", 60, 10, 2, { type: "drop" }),
  liftRow("Row", 100, 10, 90, { type: "drop" }),
]);
close(stats.buildDropVolumeShare(volumeSets, { period: fourWeeks }), 600 / 1100, "the drop sets' share of the kilos");
assert.equal(stats.buildDropVolumeShare([], { period: fourWeeks }), null, "no volume is no share");

/* --------------------------------------------------------------- runs -- */

const run = (id, daysAgo, km, seconds, kind = "run") => ({ id, at: TODAY - daysAgo * DAY, kind, km, seconds });
const runs = [
  run(1, 20, 5, 1500), // 5:00 /km
  run(2, 10, 10, 3300), // 5:30 /km, the longest
  run(3, 5, 0.8, 180), // 3:45 /km, but under a kilometre
  run(4, 3, 0, 1200), // no distance: not in the pace
  run(5, 2, 3, 2160, "walk"),
  run(6, 60, 21.1, 6300), // outside the period
];
const summary = stats.buildRunSummary(runs, { period: fourWeeks });
assert.equal(summary.count, 4, "walks are not runs");
close(summary.km, 15.8, "the total distance");
assert.equal(summary.seconds, 6180, "the total time, the run without a distance included");
close(summary.pace, (1500 + 3300 + 180) / 15.8, "the pace is time over distance of the runs that have both");
assert.equal(stats.formatPace(summary.pace), "5:15");
assert.equal(summary.fastest.id, 1, "the fastest run is the best pace over at least a kilometre");
assert.equal(summary.fastest.at, TODAY - 20 * DAY, "and carries its day");
assert.equal(summary.fastest.pace, 300);
assert.equal(summary.longest.id, 2, "the longest run is the most kilometres");
assert.equal(summary.longest.at, TODAY - 10 * DAY);
assert.deepEqual(summary.walks, { count: 1, km: 3 });
assert.equal(summary.chart.unit, "week");
close(summary.chart.buckets.reduce((sum, bucket) => sum + bucket.value, 0), 15.8, "the bars hold the runs' kilometres");
// Segments are summed in floating point; three tenths and seven tenths make a kilometre.
const summed = stats.normalizeRunSegments([
  { workout_id: 30, actual_distance: 0.7, actual_duration_seconds: 200, workout_type: "Run", performed_date_sort: isoDay(1) },
  { workout_id: 30, actual_distance: 0.3, actual_duration_seconds: 100, workout_type: "Run", performed_date_sort: isoDay(1) },
]);
assert.equal(stats.buildRunSummary(summed, { period: fourWeeks }).fastest?.id, 30, "a kilometre summed from segments is a kilometre");

assert.equal(stats.formatPace(300), "5:00");
assert.equal(stats.formatPace(359.6), "6:00", "a pace rounds to the second and carries into the minute");
assert.equal(stats.formatPace(65), "1:05");
assert.equal(stats.formatPace(null), null);
assert.equal(stats.formatPace(0), null);
assert.deepEqual(stats.splitDuration(6180), { hours: 1, minutes: 43 });
assert.deepEqual(stats.splitDuration(3590), { hours: 1, minutes: 0 }, "59 minutes 50 rounds to an hour");
assert.deepEqual(stats.splitDuration(0), { hours: 0, minutes: 0 });
assert.equal(stats.splitDuration(null), null);

const onlyShort = stats.buildRunSummary([run(1, 1, 0.5, 150)], { period: fourWeeks });
assert.equal(onlyShort.fastest, null, "no run of a kilometre is no fastest run");
assert.equal(onlyShort.longest.id, 1);

const noRuns = stats.buildRunSummary([], { period: fourWeeks });
assert.equal(noRuns.count, 0);
assert.equal(noRuns.km, 0);
assert.equal(noRuns.pace, null);
assert.equal(noRuns.fastest, null);
assert.equal(noRuns.longest, null);
assert.deepEqual(noRuns.walks, { count: 0, km: 0 });

/* ---------------------------------------------------------- exercises -- */

const exerciseSets = normalizeRecordRows([
  liftRow("Deadlift", 180, 3, 200),
  liftRow("Deadlift", 150, 5, 30, { workout: "d1" }),
  liftRow("Deadlift", 155, 5, 20, { workout: "d2" }),
  liftRow("Deadlift", 160, 5, 10, { workout: "d3" }),
  liftRow("Deadlift", 165, 5, 3, { workout: "d4" }),
  liftRow("Curl", 20, 10, 300),
]);
const exercises = stats.buildPeriodExercises(exerciseSets, { period: fourWeeks, now: NOW });
assert.deepEqual(exercises.map((entry) => entry.name), ["Deadlift"], "only what was trained in the period");
assert.deepEqual(exercises[0].heaviest, { weight: 165, reps: 5 }, "the heaviest lift in the period, not ever");
assert.equal(exercises[0].direction, "up", "the direction comes from the whole history");
assert.equal(stats.buildPeriodExercises(exerciseSets, { period: period("all"), now: NOW }).length, 2);
assert.deepEqual(stats.buildPeriodExercises([], { period: fourWeeks, now: NOW }), []);

/* ------------------------------------------------------------ teasers -- */

const teasers = stats.buildTeasers(
  { sets: lifts, workouts: steady, runs, setTypes },
  { period: fourWeeks }
);
close(teasers.intensity.average, intensity.average, "the intensity teaser is the page's average");
close(teasers.frequency.perWeek, 2, "the frequency teaser is workouts per week");
assert.equal(teasers.setTypes.type, "drop", "the biggest share that is not a working set; a tie goes to the first type");
close(teasers.setTypes.share, 3 / 11, "and its share");
assert.equal(teasers.runs.count, 4);
close(teasers.runs.km, 15.8);
assert.deepEqual(teasers.exercises, { count: 2 }, "exercises trained in the period");

const onlyWorking = stats.buildTeasers(
  { setTypes: stats.normalizeSetTypeRows([{ set_type: "working", reps: 5, performed_date_sort: isoDay(0) }]) },
  { period: fourWeeks }
);
assert.deepEqual(onlyWorking.setTypes, { type: "working", share: 1 }, "nothing but working sets says so");

assert.equal(stats.wholePercent(0.74), 74);
assert.equal(stats.wholePercent(0.0025), 1, "something that is there is never 0 %");
assert.equal(stats.wholePercent(0.9975), 99, "and something short of all of it never 100 %");
assert.equal(stats.wholePercent(1), 100);
assert.equal(stats.wholePercent(0), 0);
assert.equal(stats.wholePercent(null), 0);

assert.deepEqual(
  stats.buildTeasers({}, { period: fourWeeks }),
  { intensity: null, frequency: null, setTypes: null, runs: null, exercises: null },
  "a period with nothing in it has a dash on every row"
);
assert.deepEqual(stats.STATISTICS_METRICS, ["intensity", "frequency", "setTypes", "runs", "exercises"]);

console.log("statistics-insights: all checks passed.");
