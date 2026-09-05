// Covers the pure maths lifted out of Run.js.
//
// Run.js was 5,172 lines with no tests at all, and the report called splitting
// it the highest-risk change in the review. These helpers are the part that can
// be pinned down without a device: pace windows, segment labels, route
// simplification, clock and distance formatting.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const display = loadAppModule("src/Pages/WorkoutPage/WorkoutTypes/Run/runDisplayUtils.js");
const format = loadAppModule("src/Pages/WorkoutPage/WorkoutTypes/Run/runFormatUtils.js");

/* ----------------------------------------------------------- formatting -- */

assert.strictEqual(format.formatRunClock(0), "00:00");
assert.strictEqual(format.formatRunClock(59), "00:59");
assert.strictEqual(format.formatRunClock(60), "01:00");
assert.strictEqual(format.formatRunClock(3599), "59:59");
assert.strictEqual(format.formatRunClock(3600), "1:00:00");
assert.strictEqual(format.formatRunClock(-5), "00:00", "negative time is clamped");

assert.strictEqual(format.formatRunDistance(0), "0.00");
assert.strictEqual(format.formatRunDistance(5), "5.00");
assert.strictEqual(format.formatRunDistance(5.678), "5.68");
assert.strictEqual(format.formatRunDistance(null), "0.00");
assert.strictEqual(format.formatRunDistance("bogus"), "0.00");

assert.strictEqual(format.parsePaceToMinutes("5:30"), 5.5);
assert.strictEqual(format.parsePaceToMinutes("5.5"), 5.5);
assert.strictEqual(format.parsePaceToMinutes(""), null);
assert.strictEqual(format.parsePaceToMinutes(null), null);
// A string with no digits strips to nothing and reads as zero rather than
// null. Surprising, but it is what the screen has always done.
assert.strictEqual(format.parsePaceToMinutes("nonsense"), 0);

assert.strictEqual(format.formatPaceDisplay(5.5), "5'30");
assert.strictEqual(format.formatPaceDisplay(null), "--'--''");

// The axis label is the same number in the other notation.
assert.strictEqual(format.formatPaceAxisLabel(5.5), "5:30");
assert.strictEqual(format.formatSignedPaceDelta(-90), "-01'30\"");
assert.strictEqual(format.formatSignedPaceDelta(0), "00'00\"");
assert.strictEqual(format.formatSignedPaceDelta("bogus"), "--");

// A pace survives a round trip through its own formatter.
for (const minutes of [3, 4.25, 5.5, 6.75, 7.1, 12.9]) {
  const roundTripped = format.parsePaceToMinutes(format.formatPaceDisplay(minutes));
  assert.ok(
    Math.abs(roundTripped - minutes) < 1 / 60 + 1e-9,
    `pace ${minutes} did not survive formatting: got ${roundTripped}`
  );
}

assert.strictEqual(format.parsePositiveRunValue("5"), 5);
assert.strictEqual(format.parsePositiveRunValue("0"), null);
assert.strictEqual(format.parsePositiveRunValue("-3"), null);
assert.strictEqual(format.parsePositiveRunValue("abc"), null);

/* --------------------------------------------------------- section maths - */

const sets = [
  { type: "WARMUP", is_pause: 0 },
  { type: "WORKING_SET", is_pause: 0 },
  { type: "WORKING_SET", is_pause: 1 },
  { type: "WORKING_SET", is_pause: 0 },
  { type: "COOLDOWN", is_pause: 0 },
];
const counts = display.getRunSectionCounts(sets);

assert.strictEqual(counts.WARMUP, 1);
assert.strictEqual(counts.COOLDOWN, 1);
assert.strictEqual(counts.WORKING_SET, 3, "rests count towards their section");

// An unknown or missing type is a working set, never a lost row.
assert.strictEqual(display.normalizeRunSectionType(undefined), "WORKING_SET");
assert.strictEqual(display.normalizeRunSectionType("warm up"), "WARMUP");
assert.strictEqual(display.normalizeRunSectionType("cool-down"), "COOLDOWN");
assert.strictEqual(
  Object.values(display.getRunSectionCounts(sets)).reduce((a, b) => a + b, 0),
  sets.length,
  "every set lands in exactly one section"
);

assert.strictEqual(display.getRunSegmentLabel({ type: "WARMUP" }), "Warmup");
assert.strictEqual(display.getRunSegmentLabel({ type: "COOLDOWN" }), "Cooldown");
assert.strictEqual(display.getRunSegmentLabel({ is_pause: 1 }), "Rest");
assert.strictEqual(display.getRunSegmentLabel({ type: "WORKING_SET" }), "Sprint");

// A rest carries the number of the work before it; the working sets themselves
// number from one, skipping the rests.
assert.strictEqual(display.getWorkingSetPosition(sets, 0), null, "the warmup has no number");
assert.strictEqual(display.getWorkingSetPosition(sets, 1), 1);
assert.strictEqual(display.getWorkingSetPosition(sets, 3), 2);
assert.strictEqual(display.getWorkingSetPosition(sets, -1), null);

/* ------------------------------------------------------------- location -- */

const t0 = 1_747_562_972_000;
const logs = [
  { latitude: 55.6, longitude: 12.5, timestamp: t0 },
  { latitude: 55.601, longitude: 12.5, timestamp: t0 + 30_000 },
  { latitude: 55.602, longitude: 12.5, timestamp: t0 + 60_000 },
];

assert.deepStrictEqual(display.getLogsFromTimestamp(logs, t0 + 30_000).length, 2);
// Without a start time there is no run yet, so nothing is in the window.
assert.deepStrictEqual(display.getLogsFromTimestamp(logs, null), []);
assert.deepStrictEqual(display.getLogsFromTimestamp(logs, t0).length, 3);

const segments = display.splitLocationRouteSegments(logs);
assert.strictEqual(segments.length, 1, "a clean track is one line");
assert.strictEqual(segments[0].length, logs.length, "splitting never drops points");

// A dropped fix breaks the line rather than drawing a straight edge across the
// gap - the thing that used to put a ruler line through the map.
const broken = display.splitLocationRouteSegments([
  logs[0],
  { latitude: null, longitude: null, timestamp: t0 + 40_000 },
  logs[1],
  logs[2],
]);
assert.strictEqual(broken.length, 2, "a missing fix starts a new segment");
assert.strictEqual(broken.flat().length, 3, "the bad fix is not drawn");

// Points arrive out of order after a background flush; the line is still drawn
// in time order.
const shuffled = display.splitLocationRouteSegments([logs[2], logs[0], logs[1]]);
assert.deepStrictEqual(shuffled, segments, "order of arrival does not matter");

const region = display.getRouteRegion(segments);
assert.ok(region, "a route has a region");
assert.ok(region.latitudeDelta > 0, "the map region has height");
assert.ok(region.longitudeDelta > 0, "the map region has width");
assert.ok(
  region.latitude > 55.59 && region.latitude < 55.61,
  "the region is centred on the route"
);

assert.deepStrictEqual(display.splitLocationRouteSegments([]), []);
assert.strictEqual(display.getRouteRegion([]), null);
assert.strictEqual(display.getRouteRegion([[]]), null);

// Simplification keeps the ends, stays under the cap and never grows a segment.
const long = Array.from({ length: 2000 }, (_, i) => ({
  latitude: 55.6 + i / 100000,
  longitude: 12.5,
}));
const simplified = display.simplifyRouteSegmentForDisplay(long);
assert.ok(simplified.length < long.length, "a long segment is thinned");
assert.ok(
  simplified.length <= display.MAX_ROUTE_POINTS_PER_SEGMENT + 1,
  "the thinned segment stays near the cap"
);
assert.strictEqual(simplified[0], long[0], "the start is kept");
assert.strictEqual(
  simplified[simplified.length - 1],
  long[long.length - 1],
  "the end is kept"
);

// A short segment is handed back untouched.
const short = long.slice(0, 10);
assert.strictEqual(display.simplifyRouteSegmentForDisplay(short), short);

/* ---------------------------------------------------------------- charts - */

// Chart points are {x: minutes, y: value}, not the row shape.
const chartData = [
  { x: 0, y: 100 },
  { x: 5, y: 140 },
  { x: 10, y: 120 },
];
const chartPath = display.buildChartPath(chartData, { durationMinutes: 10 });
assert.strictEqual(typeof chartPath, "string", "a chart path is a string");
assert.ok(/^M/.test(chartPath), "a path starts with a move");
assert.ok(
  Number.isFinite(
    Number(chartPath.replace(/[^0-9.\- ]/g, " ").trim().split(/\s+/)[0])
  ),
  "a path holds numbers, not NaN"
);
assert.ok(!/NaN/.test(chartPath), "a path never contains NaN");

// One point cannot make a line, so there is no path at all.
assert.strictEqual(display.buildChartPath([], {}), null);
assert.strictEqual(display.buildChartPath([{ x: 0, y: 1 }], {}), null);

// A flat series has no vertical range; it must not divide by zero.
const flatPath = display.buildChartPath(
  [{ x: 0, y: 100 }, { x: 5, y: 100 }],
  { durationMinutes: 5 }
);
assert.ok(!/NaN/.test(flatPath), "a flat series still draws");

const zoneSegments = display.buildHeartRateZoneSegments(chartData, {
  durationMinutes: 10,
});
assert.ok(Array.isArray(zoneSegments), "zone segments come back as a list");
assert.ok(zoneSegments.length > 0, "a heart rate trace is coloured");
for (const segment of zoneSegments) {
  assert.ok(segment.color, "every zone segment is coloured");
}
assert.deepStrictEqual(display.buildHeartRateZoneSegments([], {}), []);

console.log("Run display and format checks passed.");
