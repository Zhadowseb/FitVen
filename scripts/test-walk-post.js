// The walk post, without the phone: what goes into the payload, how the route is
// made safe to share (the start and the end never leave the phone), and how the
// numbers are written. The service and the card are tested further down.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const rules = loadAppModule("src/Utils/walkPost.js");

const METERS_PER_DEGREE = 111195;
const north = (meters) => 55 + meters / METERS_PER_DEGREE;
const east = (meters) => 12 + meters / (METERS_PER_DEGREE * Math.cos((55 * Math.PI) / 180));
const at = (northMeters, eastMeters = 0) => ({ latitude: north(northMeters), longitude: east(eastMeters) });

// A walk as the tracker keeps it: one position every 5 m.
function straightWalk(lengthMeters, stepMeters = 5) {
  const points = [];

  for (let meters = 0; meters <= lengthMeters; meters += stepMeters) {
    points.push(at(meters, Math.sin(meters / 90) * 6));
  }

  return points;
}

const distance = rules.distanceBetween;
const alongOf = (points, index) => {
  let total = 0;

  for (let step = 1; step <= index; step += 1) {
    total += distance(points[step - 1], points[step]);
  }

  return total;
};

/* ----------------------------------------------------------- the route -- */

// Flattened: pauses are separate stretches, and a break marker is not a point.
{
  const flat = rules.flattenRoute([
    [at(0), at(5), { latitude: null, longitude: null }],
    [at(100), undefined, at(110)],
    null,
  ]);

  assert.strictEqual(flat.length, 4);
  assert.deepStrictEqual(rules.flattenRoute(undefined), []);
}

// A short walk shares no route at all - under 800 m is nothing but start and end.
assert.strictEqual(rules.trimRoute(straightWalk(790)), null);
assert.strictEqual(rules.buildPostRoute([straightWalk(790)]), null);
assert.strictEqual(rules.canShareRoute([straightWalk(790)]), false);
assert.strictEqual(rules.trimRoute([at(0)]), null, "one point is not a route");
assert.strictEqual(rules.trimRoute([]), null);

// A walk of 800 m is trimmed to the 400 m in the middle - and nothing near either end is left.
{
  const walk = straightWalk(800);
  const kept = rules.trimRoute(walk);

  assert.ok(kept && kept.length >= 2, "800 m is the least that has a route");

  const first = walk[0];
  const last = walk[walk.length - 1];

  for (const point of kept) {
    assert.ok(distance(point, first) >= 200, "never within 200 m of where it started");
    assert.ok(distance(point, last) >= 200, "never within 200 m of where it ended");
  }

  assert.ok(distance(kept[0], first) < 215 && distance(kept.at(-1), last) < 215, "and no more than a step beyond that is cut");
}

// The rule, checked on a long walk, point by point and along the route.
{
  const walk = straightWalk(3400);
  const kept = rules.trimRoute(walk);
  const total = alongOf(walk, walk.length - 1);

  for (const point of kept) {
    const index = walk.indexOf(point);

    assert.ok(alongOf(walk, index) >= 200, "200 m along the route from the start");
    assert.ok(total - alongOf(walk, index) >= 200, "and from the end");
    assert.ok(distance(point, walk[0]) >= 200 && distance(point, walk.at(-1)) >= 200);
  }
}

// A walk that comes back past the front door half way: the straight-line rule
// cuts the route there, and one stretch is kept, without a line across a hole.
{
  const out = straightWalk(1200).map((point) => ({ ...point }));
  const back = [];

  for (let meters = 1200; meters >= 0; meters -= 5) {
    back.push(at(meters, 60 + Math.sin(meters / 80) * 5));
  }

  // Out, back past the door (60 m to the east of the start), then away again to the south and round.
  const away = [];

  for (let meters = 0; meters <= 1500; meters += 5) {
    away.push(at(-meters * 0.2, 60 + meters));
  }

  const walk = [...out, ...back, ...away];
  const kept = rules.trimRoute(walk);

  assert.ok(kept && kept.length >= 2);

  for (const point of kept) {
    assert.ok(distance(point, walk[0]) >= 200, "the door is not shown, though the walk passed it");
    assert.ok(distance(point, walk.at(-1)) >= 200);
  }

  const indexes = kept.map((point) => walk.indexOf(point));

  assert.deepStrictEqual(indexes, indexes.slice().sort((a, b) => a - b), "in the walk's own order");
  assert.strictEqual(indexes.at(-1) - indexes[0] + 1, indexes.length, "one unbroken stretch");
}

// A walk where everything stays near where it started has nothing left to show.
{
  const circle = [];

  for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
    circle.push(at(Math.cos(angle) * 120, Math.sin(angle) * 120));
  }

  assert.strictEqual(rules.trimRoute(circle), null, "a walk round the block, 750 m, near home the whole time");
}

// What is posted: simplified (a few points for a straight stretch), capped, rounded.
{
  const walk = straightWalk(6000, 3);
  const route = rules.buildPostRoute([walk]);

  assert.ok(route && route.points.length >= 2 && route.points.length <= 150, `a long walk is at most 150 points: ${route.points.length}`);
  assert.ok(route.points.length < walk.length / 4, "and a lot fewer than the walk had");

  for (const [latitude, longitude] of route.points) {
    assert.strictEqual(String(latitude).split(".")[1].length <= 5, true, "five decimals");
    assert.strictEqual(String(longitude).split(".")[1].length <= 5, true);
  }

  // A winding route, which is where simplifying has to keep points.
  const winding = [];

  for (let meters = 0; meters <= 4000; meters += 4) {
    winding.push(at(meters, Math.sin(meters / 25) * 80));
  }

  const windingRoute = rules.buildPostRoute([winding]);

  assert.ok(windingRoute.points.length <= 150, "even a winding one");
  assert.ok(windingRoute.points.length > 40, `and it is still a winding line: ${windingRoute.points.length}`);

  // In the walk's pause the line is not cut: two stretches become one route.
  const halves = rules.buildPostRoute([straightWalk(1500), straightWalk(1500).map((point) => ({ ...point, latitude: point.latitude + 1500 / METERS_PER_DEGREE }))]);

  assert.ok(halves.points.length >= 2);
}

/* ---------------------------------------------------------- the payload -- */

{
  const walk = [straightWalk(3420)];
  const payload = rules.buildWalkPayload({ distanceMeters: 3420.4, movingSeconds: 2538.2, steps: 4860.4, segments: walk, shareRoute: true });

  assert.deepStrictEqual(
    { ...payload, route: payload.route ? "a route" : null },
    { version: 1, distanceMeters: 3420, movingSeconds: 2538, steps: 4860, cadence: 115, route: "a route" },
    "cadence is the steps a minute while moving"
  );
  assert.deepStrictEqual(Object.keys(payload).sort(), ["cadence", "distanceMeters", "movingSeconds", "route", "steps", "version"], "no pace and no steps per km - they are worked out when it is drawn");

  assert.strictEqual(rules.buildWalkPayload({ distanceMeters: 3420, movingSeconds: 2538, steps: 4860, segments: walk, shareRoute: false }).route, null, "the route is left out when the person says so");
  assert.strictEqual(rules.buildWalkPayload({ distanceMeters: 500, movingSeconds: 400, steps: 600, segments: [straightWalk(500)], shareRoute: true }).route, null, "and when the walk is too short");
  assert.deepStrictEqual(
    rules.buildWalkPayload({ distanceMeters: 0, movingSeconds: 1800, steps: 2400, segments: [], shareRoute: true }),
    { version: 1, distanceMeters: null, movingSeconds: 1800, steps: 2400, cadence: 80, route: null },
    "a walk with no GPS, only steps: no distance rather than a zero"
  );
  assert.deepStrictEqual(
    rules.buildWalkPayload({ distanceMeters: 2000, movingSeconds: 1500, steps: null, segments: [], shareRoute: false }),
    { version: 1, distanceMeters: 2000, movingSeconds: 1500, steps: null, cadence: null, route: null },
    "no step counter: no steps and no cadence"
  );

  // Nothing recorded is no post - never a post of zeros.
  for (const empty of [
    { distanceMeters: 0, movingSeconds: 0, steps: 0 },
    { distanceMeters: 0, movingSeconds: 1800, steps: null },
    { distanceMeters: 2000, movingSeconds: 0, steps: 3000 },
    { distanceMeters: null, movingSeconds: null, steps: null },
  ]) {
    assert.strictEqual(rules.buildWalkPayload({ ...empty, segments: [], shareRoute: true }), null, JSON.stringify(empty));
    assert.strictEqual(rules.hasWalkToPost(empty), false);
  }
}

/* ----------------------------------------------------------- the writing -- */

assert.strictEqual(rules.formatWalkDistance(3420), "3.42");
assert.strictEqual(rules.formatWalkDistance(12400), "12.40");
assert.strictEqual(rules.formatWalkDistance(850), "0.85");
assert.deepStrictEqual(rules.formatWalkTime(2538), { value: "42", unit: "min" });
assert.deepStrictEqual(rules.formatWalkTime(3599), { value: "1:00", unit: "h" }, "59 min 59 s rounds up to the hour");
assert.deepStrictEqual(rules.formatWalkTime(4080), { value: "1:08", unit: "h" });
assert.deepStrictEqual(rules.formatWalkTime(7380), { value: "2:03", unit: "h" });
assert.deepStrictEqual(rules.formatWalkTime(20), { value: "1", unit: "min" }, "never 0 min");

{
  const stats = rules.walkPostStats({ distanceMeters: 3420, movingSeconds: 2538, steps: 4860, cadence: 115 });

  assert.strictEqual(Math.round(stats.pace), 742, "12:22 a kilometre");
  assert.strictEqual(stats.stepsPerKm, 1421, "steps a km, whole");
  assert.strictEqual(stats.steps, 4860);
  assert.strictEqual(stats.cadence, 115);

  assert.deepStrictEqual(rules.walkPostStats({ distanceMeters: 2000, movingSeconds: 1500, steps: null, cadence: null }).steps, null, "no step counter, no steps");
  assert.strictEqual(rules.walkPostStats({ distanceMeters: null, movingSeconds: 1800, steps: 2400, cadence: 80 }).pace, null, "no distance, no pace");
  assert.strictEqual(rules.walkPostStats({ distanceMeters: 30, movingSeconds: 60, steps: 40, cadence: 40 }).pace, null, "nor over a few steps");
  assert.deepStrictEqual(rules.walkPostStats(null), { pace: null, steps: null, cadence: null, stepsPerKm: null });
}

assert.deepStrictEqual(rules.routePointsOf({ route: { points: [[55.1, 12.1], [55.2, 12.2], ["x", 1], null] } }), [
  { latitude: 55.1, longitude: 12.1 },
  { latitude: 55.2, longitude: 12.2 },
]);
assert.deepStrictEqual(rules.routePointsOf({ route: null }), []);
assert.deepStrictEqual(rules.routePointsOf(undefined), []);

console.log("Walk post: the route trimmed away from the start and the end (also when it passes the door), simplified and rounded, the payload with no pace, a walk with no distance or no steps, nothing recorded is no post, and how the numbers are written.");
