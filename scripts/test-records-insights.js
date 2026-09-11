const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;

function iso(msFromNow, now) {
  return new Date(now + msFromNow).toISOString().slice(0, 10);
}

async function load(root, file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const inlined = source.replace(
    /from\s+"\.\/oneRepMaxUtils"/,
    () => {
      const util = fs.readFileSync(path.join(root, 'src/Utils/oneRepMaxUtils.js'), 'utf8');
      return `from "data:text/javascript;base64,${Buffer.from(util).toString('base64')}"`;
    }
  );

  return import(`data:text/javascript;base64,${Buffer.from(inlined).toString('base64')}`);
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const insights = await load(root, 'src/Utils/recordsInsights.js');
  const now = Date.UTC(2026, 8, 11);

  const row = (name, weight, reps, daysAgo, extra = {}) => ({
    exercise_name: name,
    weight,
    reps,
    performed_date_sort: iso(-daysAgo * DAY, now),
    workout_id: extra.workout ?? `w-${name}-${daysAgo}`,
    personal_record: extra.record ? 1 : 0,
  });

  // Rows that should never survive normalisation: no name, no weight, no date,
  // zero weight. A set with no weight is not a record of anything.
  const junk = insights.normalizeRecordRows([
    { exercise_name: '', weight: 100, reps: 5, performed_date_sort: iso(0, now) },
    { exercise_name: 'Squat', weight: 0, reps: 5, performed_date_sort: iso(0, now) },
    { exercise_name: 'Squat', weight: 100, reps: 0, performed_date_sort: iso(0, now) },
    { exercise_name: 'Squat', weight: 100, reps: 5, performed_date_sort: 'ikke en dato' },
  ]);
  assert.equal(junk.length, 0, 'Rows without a name, weight, reps or a usable date are dropped');

  const sets = insights.normalizeRecordRows([
    row('Bench', 100, 5, 200),
    row('Bench', 110, 5, 20, { workout: 'b1' }),
    row('Bench', 112.5, 5, 10, { workout: 'b2', record: true }),
    row('Bench', 115, 5, 3, { workout: 'b3', record: true }),
    row('Squat', 160, 5, 200),
    row('Squat', 150, 5, 14, { workout: 's1' }),
    row('Squat', 150, 5, 7, { workout: 's2' }),
    row('Squat', 152.5, 5, 2, { workout: 's3' }),
    row('Curl', 20, 10, 5, { workout: 'c1' }),
  ]);
  assert.equal(sets.length, 9);
  assert.ok(sets[0].at < sets[sets.length - 1].at, 'Sets come back oldest first');

  // Gains measure the window against everything before it, so a decline is a
  // real result and not a missing row.
  const gains = insights.buildExerciseGains(sets, { now, windowDays: 84 });
  const bench = gains.find((gain) => gain.name === 'Bench');
  const squat = gains.find((gain) => gain.name === 'Squat');
  const curl = gains.find((gain) => gain.name === 'Curl');
  assert.ok(bench.gainKg > 0, 'Bench improved against its pre-window best');
  assert.ok(squat.gainKg < 0, 'Squat is below its pre-window best and shows as a decline');
  assert.equal(curl.isNew, true, 'An exercise with nothing before the window is new, not up');
  assert.equal(curl.gainPct, null, 'A new exercise gets no percentage invented for it');
  assert.equal(bench.sessionCount, 3, 'Sessions count distinct workouts, not sets');

  // Direction needs three sessions and recency; one heavy day must not qualify.
  const directions = insights.buildDirections(sets, { now });
  const byName = new Map(directions.map((entry) => [entry.name, entry]));
  assert.equal(byName.get('Bench').qualifies, true);
  assert.equal(byName.get('Bench').direction, 'up');
  assert.equal(byName.get('Curl').qualifies, false, 'One session does not qualify');

  const stale = insights.normalizeRecordRows([
    row('Old', 100, 5, 120, { workout: 'o1' }),
    row('Old', 105, 5, 110, { workout: 'o2' }),
    row('Old', 110, 5, 100, { workout: 'o3' }),
  ]);
  const staleDirection = insights.buildDirections(stale, { now })[0];
  assert.equal(staleDirection.qualifies, false, 'Three sessions but none recent does not qualify');

  // The moving average has to count empty weeks, or it climbs through a break.
  const volume = insights.buildWeeklyVolume(
    insights.normalizeRecordRows([
      row('Bench', 100, 10, 0, { workout: 'v1' }),
      row('Bench', 100, 10, 21, { workout: 'v2' }),
    ]),
    { now, weeks: 4 }
  );
  assert.equal(volume.length, 4);
  assert.equal(volume[volume.length - 1].volume, 1000);
  assert.ok(volume.some((week) => week.isEmpty), 'Weeks without training are kept as empty');
  assert.equal(
    volume[volume.length - 1].average,
    (1000 + 0 + 0 + 1000) / 4,
    'The four-week average divides by four even when three weeks are empty'
  );

  // Stats compare against the same length of time immediately before.
  const stats = insights.buildStats(sets, { now, days: 28 });
  // Bench b1/b2/b3, Squat s1/s2/s3 and Curl c1 all fall inside four weeks.
  assert.equal(stats.current.workouts, 7, 'Seven distinct sessions in the last four weeks');
  assert.equal(stats.current.records, 2);
  assert.ok(stats.current.workoutsPerRecord > 0);
  assert.equal(
    insights.buildStats([], { now, days: 28 }).current.workoutsPerRecord,
    null,
    'No records is an absent rate, not a zero'
  );

  // Muscle groups need a mapping the local database does not carry.
  assert.deepEqual(
    insights.buildMuscleGroupSets(sets, { groupsByExercise: new Map(), now, days: 91 }),
    [],
    'Without the cloud mapping the section has nothing to show rather than wrong totals'
  );
  const grouped = insights.buildMuscleGroupSets(sets, {
    groupsByExercise: new Map([['bench', ['Chest']], ['squat', ['Legs']]]),
    now,
    days: 91,
  });
  assert.deepEqual(
    grouped.map((entry) => [entry.label, entry.setCount]),
    [['Chest', 3], ['Legs', 3]],
    'Groups carry their set counts and come back sorted by size'
  );

  const latest = insights.buildLatestRecords(sets, { limit: 2 });
  assert.equal(latest.length, 2);
  assert.ok(latest[0].at > latest[1].at, 'Newest record first');
  assert.equal(latest[0].weight, 115);


  // --- Exercise page -------------------------------------------------------

  // A six-week break has to split the line. Drawing one smooth curve across it
  // claims progress that was never measured.
  const gapped = insights.normalizeRecordRows([
    row('Bench', 100, 5, 120, { workout: 'g1' }),
    row('Bench', 102.5, 5, 113, { workout: 'g2' }),
    row('Bench', 110, 5, 20, { workout: 'g3' }),
    row('Bench', 112.5, 5, 13, { workout: 'g4' }),
  ]);
  const series = insights.buildExerciseSeries(gapped, { name: 'Bench', now, days: null });
  assert.equal(series.points.length, 4, 'One point per session');
  assert.equal(series.segments.length, 2, 'The break splits the line in two');
  assert.equal(series.gaps.length, 1);
  assert.equal(series.gaps[0].days, 93, 'The gap knows how long it was');
  assert.ok(series.best > 110, 'The best is the highest estimate in the window');

  // Two sets on the same day are one point, and it is the better of them.
  const sameDay = insights.buildExerciseSeries(
    insights.normalizeRecordRows([
      row('Bench', 90, 5, 2, { workout: 'd1' }),
      row('Bench', 100, 5, 2, { workout: 'd1' }),
    ]),
    { name: 'Bench', now, days: null }
  );
  assert.equal(sameDay.points.length, 1, 'One session is one point');
  assert.equal(sameDay.points[0].weight, 100, 'And it is the best set of that session');

  const ladder = insights.buildRepLadder(gapped, { name: 'Bench', now, days: 30 });
  assert.equal(insights.REP_LADDER_SLOTS, 12, 'The ladder runs to twelve, matching a rep block');
  assert.equal(ladder.length, insights.REP_LADDER_SLOTS, 'Every rep slot stays in the grid');
  assert.equal(ladder[4].reps, 5);
  assert.equal(ladder[4].weight, 112.5, 'The five-rep slot carries the heaviest five');
  assert.equal(ladder[4].isNewInPeriod, true, 'Set 13 days ago falls inside a 30 day period');
  assert.equal(ladder[0].weight, null, 'A rep count never trained stays empty rather than borrowing');

  const sessions = insights.buildRecentSessions(gapped, { name: 'Bench', limit: 2 });
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].at > sessions[1].at, 'Newest session first');

  console.log('Records exercise page: session points, gap splitting, same-day sessions, rep ladder holes and recent sessions passed.');

  console.log('Records insights: junk rows, gains and declines, qualification, empty-week averages, rate comparison and muscle grouping passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
