// The trophy room's numbers: the record count and the heaviest lift, the
// podium and its next round weight, the newest records as one card per
// exercise and day, the milestones and the longest streak of weeks.
//
// All of it is shown without a period and without anything to compare with,
// so a wrong number here is the whole page being wrong. src/Utils/trophyRoom.js
// is pure and runs here as it is, with its two imports inlined.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;
const root = path.resolve(__dirname, '..');

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

function inline(file, replacements) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');

  for (const [specifier, url] of replacements) {
    source = source.replace(new RegExp(`from\\s+"${specifier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"`), () => `from "${url}"`);
  }

  return dataUrl(source);
}

async function run() {
  const oneRepMax = dataUrl(fs.readFileSync(path.join(root, 'src/Utils/oneRepMaxUtils.js'), 'utf8'));
  const insightsUrl = inline('src/Utils/recordsInsights.js', [['./oneRepMaxUtils', oneRepMax]]);
  const insights = await import(insightsUrl);
  const trophy = await import(inline('src/Utils/trophyRoom.js', [['./recordsInsights', insightsUrl]]));

  const now = Date.UTC(2026, 8, 24);
  const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString().slice(0, 10);
  const row = (name, weight, reps, daysAgo, extra = {}) => ({
    exercise_name: name,
    weight,
    reps,
    performed_date_sort: iso(daysAgo),
    workout_id: extra.workout ?? `w-${daysAgo}`,
    personal_record: extra.record ? 1 : 0,
  });

  // Nothing yet: no hero, an empty podium and shelf, and milestones that
  // have reached nothing but know the first rung.
  const empty = trophy.buildTrophyRoom({ sets: [], workouts: [], now });
  assert.equal(empty.hero, null, 'With no sets there is no hero to show');
  assert.deepEqual(empty.podium, []);
  assert.deepEqual(empty.recent, []);
  assert.equal(empty.milestones.length, 4);
  for (const milestone of empty.milestones) {
    assert.equal(milestone.reached, null, `${milestone.key}: nothing reached with nothing done`);
    assert.equal(milestone.next, trophy.MILESTONE_LADDERS[milestone.key][0], `${milestone.key}: the first rung is next`);
    assert.equal(milestone.progress, 0);
  }

  const sets = insights.normalizeRecordRows([
    row('Deadlift', 170, 3, 60, { workout: 'a', record: true }),
    row('Deadlift', 180, 1, 30, { workout: 'b', record: true }),
    row('Deadlift', 180, 2, 3, { workout: 'e', record: true }),
    row('Squat', 150, 5, 30, { workout: 'b', record: true }),
    row('Squat', 150, 5, 20, { workout: 'c' }),
    row('Bench', 100, 5, 20, { workout: 'c', record: true }),
    row('Bench', 105, 3, 3, { workout: 'e', record: true }),
    row('Bench', 102.5, 5, 3, { workout: 'e', record: true }),
    row('Curl', 20, 10, 1, { workout: 'f' }),
    row('Leg press', 150, 8, 40, { workout: 'g' }),
  ]);

  // The hero: every record set counted, and the heaviest lift - on a tie in
  // weight, the one with more reps.
  const hero = trophy.buildTrophyHero(sets);
  assert.equal(hero.recordCount, 7);
  assert.deepEqual(
    { name: hero.heaviest.name, weight: hero.heaviest.weight, reps: hero.heaviest.reps },
    { name: 'Deadlift', weight: 180, reps: 2 },
    '180 kg for two beats 180 kg for one'
  );
  assert.equal(hero.since, Date.parse(`${iso(60)}T00:00:00Z`), 'Since the first set on record');

  // The podium: one entry per exercise, by heaviest set. Squat and leg press
  // tie at 150 kg; leg press did more reps, so it places above squat.
  const podium = trophy.buildPodium(sets);
  assert.deepEqual(podium.map((entry) => entry.name), ['Deadlift', 'Leg press', 'Squat']);
  assert.equal(podium[0].goal, 200, 'The next round weight above 180 kg is 200');
  assert.equal(podium[0].toGo, 20);
  assert.equal(
    trophy.buildPodium(insights.normalizeRecordRows([row('Squat', 150, 5, 30), row('Squat', 150, 5, 10)]))[0].at,
    Date.parse(`${iso(30)}T00:00:00Z`),
    'A repeated best belongs to the day it was first lifted'
  );
  assert.equal(trophy.nextWeightGoal(92.5), 100);
  assert.equal(trophy.nextWeightGoal(250), 300, 'Above 250 the goals go up by 50');
  assert.equal(trophy.nextWeightGoal(310), 350);

  // The shelf: two records in one session for one exercise are one card, by
  // the heavier set; newest first; new within two weeks.
  const recent = trophy.buildRecentRecords(sets, { now });
  assert.deepEqual(
    recent.map((record) => `${record.name} ${record.weight}x${record.reps}`),
    ['Deadlift 180x2', 'Bench 105x3', 'Bench 100x5', 'Deadlift 180x1', 'Squat 150x5']
  );
  assert.deepEqual(recent.map((record) => record.isNew), [true, true, false, false, false]);
  assert.equal(trophy.buildRecentRecords(sets, { now, limit: 2 }).length, 2);

  // The longest run of weeks in a row, whatever the gaps before and after.
  const monday = Date.UTC(2026, 8, 7);
  const weeks = (...offsets) => offsets.map((week) => monday + week * 7 * DAY + DAY);
  assert.equal(trophy.longestWeekStreak([]), 0);
  assert.equal(trophy.longestWeekStreak(weeks(0)), 1);
  assert.equal(trophy.longestWeekStreak(weeks(0, 0, 1, 2, 4, 5)), 3, 'Two workouts in one week are one week');
  assert.equal(trophy.longestWeekStreak(weeks(-10, -9, -8, -7, 0)), 4);

  // Milestones: workouts from the workout rows when there are any, the
  // strength sessions otherwise; the next rung and how far to it.
  const workouts = trophy.normalizeWorkoutRows(
    Array.from({ length: 12 }, (_, index) => ({
      workout_id: index + 1,
      workout_type: index % 3 === 0 ? 'Run' : 'Resistance',
      performed_date_sort: iso(index * 7),
    })).concat([{ workout_id: 1, workout_type: 'Run', performed_date_sort: iso(0) }])
  );
  assert.equal(workouts.length, 12, 'A workout is counted once');

  const byKey = (list) => Object.fromEntries(list.map((milestone) => [milestone.key, milestone]));
  const milestones = byKey(trophy.buildMilestones({ sets, workouts }));
  assert.equal(milestones.workouts.value, 12);
  assert.equal(milestones.workouts.reached, 10);
  assert.equal(milestones.workouts.next, 25);
  assert.equal(milestones.workouts.toGo, 13);
  assert.ok(Math.abs(milestones.workouts.progress - 2 / 15) < 1e-9, 'Progress runs from the last rung to the next');
  assert.equal(milestones.records.value, 7);
  assert.equal(milestones.records.reached, 1);
  assert.equal(milestones.weekStreak.value, 12, 'Twelve weekly workouts in a row');
  assert.equal(milestones.weekStreak.reached, 12);

  const volume = sets.reduce((total, set) => total + set.volume, 0);
  assert.equal(milestones.tonnes.value, Math.floor((volume / 1000) * 10) / 10);
  assert.equal(milestones.tonnes.reached, 1);

  const fromSessions = byKey(trophy.buildMilestones({ sets, workouts: [] }));
  assert.equal(fromSessions.workouts.value, 6, 'Without workout rows, the strength sessions count: six workouts');

  const topped = byKey(trophy.buildMilestones({
    sets: insights.normalizeRecordRows(
      Array.from({ length: 510 }, (_, index) => row('Bench', 100 + index, 1, 600 - index, { workout: `r${index}`, record: true }))
    ),
  }));
  assert.equal(topped.records.reached, 500);
  assert.equal(topped.records.next, null, 'Past the top rung there is nothing next');
  assert.equal(topped.records.progress, 1);

  console.log('Trophy room: the hero, the podium and its goals, the newest records, week streaks and milestones passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
