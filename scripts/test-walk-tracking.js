// The rules of a walk, without a phone: which GPS points count, the distance
// they add up to, the pace and cadence windows, and when auto pause acts.
const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const walk = loadAppModule("src/Utils/walkTracking.js");

// About 1.11 m of latitude per 0.00001 degrees; a walker at 1.4 m/s.
const METERS_PER_DEGREE = 111195;
const T0 = 1_700_000_000_000;

const point = (meters, seconds, accuracy = 8) => ({
  latitude: 55 + meters / METERS_PER_DEGREE,
  longitude: 12,
  accuracy,
  timestamp: T0 + seconds * 1000,
});
const walkLine = (seconds, speed = 1.4, step = 1) =>
  Array.from({ length: Math.floor(seconds / step) + 1 }, (_, index) =>
    point(index * step * speed, index * step)
  );

/* ------------------------------------------------------- the point filter -- */

assert.strictEqual(walk.isUsableWalkFix(point(0, 0, 8)), true);
assert.strictEqual(walk.isUsableWalkFix(point(0, 0, 30)), true, "30 m is the limit, and still allowed");
assert.strictEqual(walk.isUsableWalkFix(point(0, 0, 31)), false, "over 30 m is dropped");
assert.strictEqual(walk.isUsableWalkFix({ ...point(0, 0), accuracy: null }), false, "a fix with no accuracy is dropped");
assert.strictEqual(walk.isUsableWalkFix({ latitude: 95, longitude: 12, accuracy: 5, timestamp: T0 }), false);

/* ----------------------------------------------------------- the distance -- */

{
  const state = walk.replayWalkPoints(walkLine(600));
  // 600 s at 1.4 m/s is 840 m.
  assert.ok(Math.abs(state.distanceMeters - 840) < 15, `600 s of walking is ~840 m, got ${state.distanceMeters}`);
}
{
  // Standing still with a wobbling fix adds nothing.
  const wobble = Array.from({ length: 120 }, (_, index) => point((index % 2 === 0 ? 0 : 2), index, 12));
  assert.strictEqual(walk.replayWalkPoints(wobble).distanceMeters, 0, "GPS noise on the spot is not distance");
}
{
  // A slow walk, 0.4 m/s, still adds up: the anchor stays until it is far enough.
  const state = walk.replayWalkPoints(walkLine(300, 0.4));
  assert.ok(Math.abs(state.distanceMeters - 120) < 10, `a slow walk counts, got ${state.distanceMeters}`);
}
{
  // A jump of 400 m in one second is not walking: ignored, and the walk goes on from where it was.
  const line = [...walkLine(30), point(430, 31), ...walkLine(30).slice(1).map((p, i) => point(42 + (i + 1) * 1.4, 31 + i + 1))];
  const state = walk.replayWalkPoints(line);
  assert.ok(state.distanceMeters < 120 && state.distanceMeters > 60, `the jump is not added, got ${state.distanceMeters}`);
}
{
  // The fix is gone for five minutes, and the walker is 400 m on when it comes back.
  const line = [...walkLine(60), ...walkLine(60).map((p, index) => point(84 + 400 + index * 1.4, 360 + index))];
  const state = walk.replayWalkPoints(line);
  assert.ok(Math.abs(state.distanceMeters - 168) < 12, `nothing is added across the gap, got ${state.distanceMeters}`);
}
{
  // A tracking break (written on pause/resume/background) ends the stretch the same way.
  const breakRow = { latitude: null, longitude: null, accuracy: null, timestamp: T0 + 61_000 };
  const line = [...walkLine(60), breakRow, ...walkLine(60).map((p, index) => point(2000 + index * 1.4, 62 + index))];
  const state = walk.replayWalkPoints(line);
  assert.ok(Math.abs(state.distanceMeters - 168) < 12, `a break draws no line across it, got ${state.distanceMeters}`);
}
{
  // Poor fixes in the middle are skipped, not counted.
  const line = walkLine(60);
  line[30] = { ...line[30], accuracy: 80, latitude: 56 };
  assert.ok(Math.abs(walk.replayWalkPoints(line).distanceMeters - 84) < 6, "a bad fix is left out");
}
{
  // One pass is one pass: the live total equals the replayed one.
  const points = walkLine(200);
  let live = walk.createWalkState();
  points.forEach((p) => {
    live = walk.foldWalkPoint(live, p);
  });
  assert.strictEqual(live.distanceMeters, walk.replayWalkPoints(points).distanceMeters);
  const before = walk.createWalkState();
  walk.foldWalkPoint(before, points[0]);
  assert.strictEqual(before.anchor, null, "the old state is not changed");
}

/* ------------------------------------------------------------------ pace -- */

assert.strictEqual(walk.averagePaceSecondsPerKm(10, 100), null, "no pace before 50 m");
assert.strictEqual(Math.round(walk.averagePaceSecondsPerKm(1000, 600)), 600);
{
  const state = walk.replayWalkPoints(walkLine(120));
  const now = T0 + 120 * 1000;
  const pace = walk.currentPaceSecondsPerKm(state, now);
  assert.ok(Math.abs(pace - 1000 / 1.4) < 25, `1.4 m/s is about 714 s/km, got ${pace}`);
  assert.strictEqual(walk.currentPaceSecondsPerKm(state, now + 60_000), null, "no pace once the last point is a minute old");
  assert.strictEqual(walk.currentPaceSecondsPerKm(walk.createWalkState(), now), null);
}
assert.strictEqual(walk.formatPaceClock(425), "7:05");
assert.strictEqual(walk.formatPaceClock(null), null);

/* --------------------------------------------------------------- cadence -- */

{
  // 110 steps a minute = 11 steps every 6 s.
  const samples = Array.from({ length: 21 }, (_, index) => [T0 + index * 1000, Math.round(index * (110 / 60))]);
  const cadence = walk.cadenceStepsPerMinute(samples, T0 + 20_000);
  assert.ok(Math.abs(cadence - 110) <= 6, `~110 steps/min, got ${cadence}`);
  assert.strictEqual(walk.cadenceStepsPerMinute(samples.slice(0, 3), T0 + 2000), null, "too little to measure yet");
  assert.strictEqual(walk.cadenceStepsPerMinute(samples, T0 + 60_000), 0, "no steps for a while is a cadence of 0");
  assert.strictEqual(walk.cadenceStepsPerMinute([], T0), null);
  assert.strictEqual(walk.trimStepSamples(samples, T0 + 120_000).length, 1);
}
assert.strictEqual(walk.stepsPerKilometre(3300, 3000), 1100);
assert.strictEqual(walk.stepsPerKilometre(0, 3000), null, "no zeros: nothing counted means nothing shown");
assert.strictEqual(walk.stepsPerKilometre(50, 40), null);
assert.strictEqual(walk.strideSeconds(120), 1, "one stride is two steps: 120 steps/min is a stride a second");
assert.strictEqual(walk.strideSeconds(0), null);
assert.strictEqual(walk.strideSeconds(null), null);
assert.strictEqual(walk.strideSeconds(30), 4, "never slower than 4 s");

/* ------------------------------------------------------------ auto pause -- */

{
  const base = { enabled: true, autoPaused: false, hasStepCounter: true, hasGps: true, sinceMs: T0 };
  const at = (secondsAfterStart, extra) => walk.evaluateAutoPause({ ...base, nowMs: T0 + secondsAfterStart * 1000, ...extra });

  assert.strictEqual(at(5), null, "not in the first seconds of a walk");
  assert.strictEqual(at(10), "pause", "10 s with no step and no ground pauses");
  assert.strictEqual(at(30, { lastStepAtMs: T0 + 28_000 }), null, "a recent step keeps it going, even with no GPS gain");
  assert.strictEqual(at(30, { lastMoveAtMs: T0 + 28_000 }), null, "ground gained keeps it going, even with no step");
  assert.strictEqual(at(30, { lastStepAtMs: T0 + 12_000, lastMoveAtMs: T0 + 15_000 }), "pause", "both quiet for 10 s");
  assert.strictEqual(at(60, { enabled: false }), null, "switched off, never pauses");
  assert.strictEqual(at(60, { enabled: false, autoPaused: true }), "resume", "switching it off while auto paused resumes");

  // Resume: as soon as steps come in again.
  assert.strictEqual(at(40, { autoPaused: true, lastStepAtMs: T0 + 39_500 }), "resume");
  assert.strictEqual(at(40, { autoPaused: true, lastStepAtMs: T0 + 20_000 }), null, "still no steps, still paused");
  assert.strictEqual(at(40, { autoPaused: true, lastStepAtMs: T0 + 20_000, lastMoveAtMs: T0 + 39_500 }), null, "with a step counter, GPS alone does not resume");

  // Without a step counter: speed only, both ways.
  const noSteps = { hasStepCounter: false };
  assert.strictEqual(at(10, noSteps), "pause");
  assert.strictEqual(at(30, { ...noSteps, lastMoveAtMs: T0 + 28_000 }), null);
  assert.strictEqual(at(40, { ...noSteps, autoPaused: true, lastMoveAtMs: T0 + 39_000 }), "resume");
  assert.strictEqual(at(40, { ...noSteps, autoPaused: true, lastMoveAtMs: T0 + 20_000 }), null);

  // Without GPS: steps only.
  const noGps = { hasGps: false };
  assert.strictEqual(at(10, noGps), "pause");
  assert.strictEqual(at(30, { ...noGps, lastStepAtMs: T0 + 28_000 }), null);

  // With neither sensor there is nothing to judge by: it never pauses on its own.
  assert.strictEqual(at(60, { hasStepCounter: false, hasGps: false }), null);
  assert.strictEqual(at(60, { hasStepCounter: false, hasGps: false, autoPaused: true }), "resume");
}

console.log("Walk tracking: the point filter, distance (live = replayed), pace, cadence, stride and auto pause.");
