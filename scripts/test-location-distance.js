const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const locationUtilsPath = path.join(rootDir, "src", "Utils", "locationUtils.js");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(locationUtilsPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const {
    DEFAULT_RUN_DISTANCE_FILTER,
    calculateTrackedDistanceDiagnostics,
    calculateTrackedDistanceSummary,
  } = await import(moduleUrl);

  verifyStraightRun(calculateTrackedDistanceSummary);
  verifySmallStepsAccumulate(calculateTrackedDistanceSummary);
  verifyStationaryJitterIsIgnored(calculateTrackedDistanceSummary);
  verifyGpsJumpCannotBeAbsorbedLater(calculateTrackedDistanceSummary);
  verifyStationarySamplesKeepSpeedWindowFresh(calculateTrackedDistanceSummary);
  verifyPoorAccuracyDoesNotAddDistance(calculateTrackedDistanceSummary);
  verifyPocketAccuracyIsCounted(calculateTrackedDistanceSummary);
  verifyPauseMovementIsIgnored(calculateTrackedDistanceSummary);
  verifyBatchedBackgroundLocationsAreCounted(calculateTrackedDistanceSummary);
  verifyBatchedBackgroundJumpIsRejected(calculateTrackedDistanceSummary);
  verifyRecoverableBackgroundGapIsCounted(calculateTrackedDistanceSummary);
  verifyVeryLongTrackingGapStartsFresh(
    calculateTrackedDistanceSummary,
    DEFAULT_RUN_DISTANCE_FILTER
  );
  verifyDiagnosticReasons(calculateTrackedDistanceDiagnostics);

  console.log("Location distance regression checks passed.");
}

const METERS_PER_LONGITUDE_DEGREE_AT_EQUATOR = 111194.9266;

function point(distanceMeters, timestampSeconds, accuracy = 5) {
  return {
    latitude: 0,
    longitude: distanceMeters / METERS_PER_LONGITUDE_DEGREE_AT_EQUATOR,
    accuracy,
    timestamp: timestampSeconds * 1000,
  };
}

function trackingBreak(timestampSeconds) {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: timestampSeconds * 1000,
  };
}

function assertDistance(summary, expectedMeters, toleranceMeters = 0.15) {
  assert.ok(
    Math.abs(summary.totalDistanceMeters - expectedMeters) <= toleranceMeters,
    `Expected ${expectedMeters}m, received ${summary.totalDistanceMeters}m`
  );
}

function verifyStraightRun(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(5, 1),
    point(10, 2),
    point(15, 3),
  ]);

  assertDistance(summary, 15);
  assert.strictEqual(summary.acceptedSegmentCount, 3);
}

function verifySmallStepsAccumulate(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(1, 1),
    point(2, 2),
    point(3, 3),
    point(4, 4),
    point(5, 5),
    point(6, 6),
  ]);

  assertDistance(summary, 6);
}

function verifyStationaryJitterIsIgnored(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(1, 1),
    point(-1, 2),
    point(1.5, 3),
    point(-1.5, 4),
  ]);

  assertDistance(summary, 0);
}

function verifyGpsJumpCannotBeAbsorbedLater(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(100, 1),
    point(100, 20),
    point(103, 21),
  ]);

  assertDistance(summary, 3);
  assert.ok(summary.reanchorCount >= 1);
}

function verifyStationarySamplesKeepSpeedWindowFresh(
  calculateTrackedDistanceSummary
) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(0, 20),
    point(100, 21),
  ]);

  assertDistance(summary, 0);
  assert.ok(summary.reanchorCount >= 1);
}

function verifyPoorAccuracyDoesNotAddDistance(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(100, 1, 100),
    point(100, 2),
    point(103, 3),
  ]);

  assertDistance(summary, 3);
  assert.ok(summary.rejectedPointCount >= 2);
}

function verifyPocketAccuracyIsCounted(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0, 50),
    point(20, 5, 50),
    point(40, 10, 50),
    point(60, 15, 50),
  ]);

  assertDistance(summary, 60);
  assert.strictEqual(summary.acceptedSegmentCount, 3);
}

function verifyPauseMovementIsIgnored(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(10, 2),
    trackingBreak(3),
    point(100, 4),
    point(110, 6),
  ]);

  assertDistance(summary, 20);
  assert.strictEqual(summary.trackingBreakCount, 1);
}

function verifyBatchedBackgroundLocationsAreCounted(
  calculateTrackedDistanceSummary
) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(90, 30),
    point(180, 60),
    point(270, 90),
  ]);

  assertDistance(summary, 270);
  assert.strictEqual(summary.acceptedSegmentCount, 3);
  assert.strictEqual(summary.reanchorCount, 0);
}

function verifyBatchedBackgroundJumpIsRejected(calculateTrackedDistanceSummary) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(300, 30),
    point(305, 31),
  ]);

  assertDistance(summary, 5);
  assert.strictEqual(summary.reanchorCount, 1);
}

function verifyRecoverableBackgroundGapIsCounted(
  calculateTrackedDistanceSummary
) {
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(600, 300),
    point(610, 305),
  ]);

  assertDistance(summary, 610);
  assert.strictEqual(summary.reanchorCount, 0);
}

function verifyVeryLongTrackingGapStartsFresh(
  calculateTrackedDistanceSummary,
  distanceFilter
) {
  const gapSeconds = distanceFilter.maxSegmentGapSeconds + 1;
  const summary = calculateTrackedDistanceSummary([
    point(0, 0),
    point(100, gapSeconds),
    point(105, gapSeconds + 1),
  ]);

  assertDistance(summary, 5);
  assert.strictEqual(summary.reanchorCount, 1);
}

function verifyDiagnosticReasons(calculateTrackedDistanceDiagnostics) {
  const summary = calculateTrackedDistanceDiagnostics([
    point(0, 0),
    point(5, 1, 100),
    point(2, 2),
    point(20, 5),
  ]);

  assert.strictEqual(summary.diagnostics.length, 4);
  assert.deepStrictEqual(
    summary.diagnostics.map((diagnostic) => diagnostic.rejectionReason),
    ["anchor", "poor_accuracy", "below_noise_floor", "accepted"]
  );
}
