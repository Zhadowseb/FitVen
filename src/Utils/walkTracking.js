import {
  calculateDistance,
  isLocationTrackingBreak,
  normalizeLocationPoint,
} from "./locationUtils";

// What a walk measures, as plain functions: which GPS points count, how far
// the walk went, the pace right now, the cadence, and when auto pause should
// stop the clock. Nothing here touches a sensor or the database, so the rules
// are checked by scripts/test-walk-tracking.js and the screen only feeds them.
//
// Distance, the point filter and the "now" pace are one pass over the points
// (foldWalkPoint), so the number on the screen while walking and the number
// rebuilt from LocationLog after the app was closed are the same number.

export const WALK_TRACKING = Object.freeze({
  // A point less exact than this is not kept at all.
  maxAccuracyMeters: 30,
  // Faster than this between two points is a jump, not walking (a brisk walk
  // is about 2 m/s; a run, 3 or more).
  maxSegmentSpeedMetersPerSecond: 4,
  // A step shorter than the GPS wobble is not movement. The anchor stays put,
  // so a slow walk still adds up once it has gone far enough.
  minSegmentMeters: 3,
  maxNoiseFloorMeters: 15,
  noiseFloorAccuracyShare: 0.5,
  // Silence this long means the fix was lost, not that the walker teleported:
  // the next point starts a new stretch and nothing is added across the gap.
  maxGapSeconds: 120,
  // "Now" pace is read over this long, and needs this much ground to mean
  // anything.
  paceWindowSeconds: 30,
  paceMinWindowMeters: 12,
  // Cadence is steps over this long, and needs this much of it.
  cadenceWindowSeconds: 20,
  cadenceMinWindowSeconds: 6,
  // Auto pause: this long without a step and without ground gained.
  autoPauseQuietSeconds: 10,
  autoPauseMinSpeedMetersPerSecond: 0.5,
  // Positions in a row that gained ground, to wake an auto pause by ground
  // alone (no step counter delivering).
  autoPauseWakeStreak: 3,
});

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function createWalkState() {
  return {
    anchor: null,
    distanceMeters: 0,
    // [timestampMs, cumulative meters] - only as far back as the pace window.
    samples: [],
    pointCount: 0,
  };
}

/** Whether a fix is worth keeping at all (checked before it is written). */
export function isUsableWalkFix(point, options = WALK_TRACKING) {
  const normalized = normalizeLocationPoint(point);

  return (
    normalized !== null &&
    isFiniteNumber(normalized.accuracy) &&
    normalized.accuracy > 0 &&
    normalized.accuracy <= options.maxAccuracyMeters
  );
}

function trimSamples(samples, nowMs, options) {
  const cutoff = nowMs - options.paceWindowSeconds * 1000 * 2;
  let first = 0;

  while (first < samples.length - 1 && samples[first][0] < cutoff) {
    first += 1;
  }

  return first > 0 ? samples.slice(first) : samples;
}

/**
 * Takes one point into the walk and returns the new state, without touching
 * the old one. A tracking break (null coordinates, written when the walk is
 * paused, resumed or comes back from the background) ends the stretch.
 */
export function foldWalkPoint(state, rawPoint, options = WALK_TRACKING) {
  if (isLocationTrackingBreak(rawPoint)) {
    return { ...state, anchor: null };
  }

  const point = normalizeLocationPoint(rawPoint);

  if (!point || !isUsableWalkFix(point, options)) {
    return state;
  }

  const pointCount = state.pointCount + 1;

  if (!state.anchor) {
    return {
      anchor: point,
      distanceMeters: state.distanceMeters,
      samples: trimSamples(
        [...state.samples, [point.timestamp, state.distanceMeters]],
        point.timestamp,
        options
      ),
      pointCount,
    };
  }

  const seconds = (point.timestamp - state.anchor.timestamp) / 1000;

  // Out of order, or the same moment twice.
  if (!(seconds > 0)) {
    return state;
  }

  // The fix was gone for a while: start again from here, adding nothing.
  if (seconds > options.maxGapSeconds) {
    return { ...state, anchor: point, pointCount };
  }

  const meters = calculateDistance(
    state.anchor.latitude,
    state.anchor.longitude,
    point.latitude,
    point.longitude
  );

  if (!Number.isFinite(meters)) {
    return state;
  }

  // A jump: leave the anchor where it was, so the next honest point is
  // measured from somewhere that was real.
  if (meters / seconds > options.maxSegmentSpeedMetersPerSecond) {
    return state;
  }

  const noiseFloor = Math.max(
    options.minSegmentMeters,
    Math.min(
      options.maxNoiseFloorMeters,
      Math.max(state.anchor.accuracy, point.accuracy) * options.noiseFloorAccuracyShare
    )
  );

  if (meters < noiseFloor) {
    return { ...state, pointCount };
  }

  const distanceMeters = state.distanceMeters + meters;

  return {
    anchor: point,
    distanceMeters,
    samples: trimSamples(
      [...state.samples, [point.timestamp, distanceMeters]],
      point.timestamp,
      options
    ),
    pointCount,
  };
}

/** The walk rebuilt from its stored points, oldest first. */
export function replayWalkPoints(points, options = WALK_TRACKING) {
  return (points ?? []).reduce(
    (state, point) => foldWalkPoint(state, point, options),
    createWalkState()
  );
}

/** Seconds per kilometre over the whole walk, or null before it has gone anywhere. */
export function averagePaceSecondsPerKm(distanceMeters, movingSeconds) {
  if (!(distanceMeters >= 50) || !(movingSeconds > 0)) {
    return null;
  }

  return movingSeconds / (distanceMeters / 1000);
}

/**
 * Seconds per kilometre over roughly the last 30 seconds of ground gained, or
 * null when there is not enough of it (standing still, or just starting).
 */
export function currentPaceSecondsPerKm(state, nowMs, options = WALK_TRACKING) {
  const samples = state?.samples ?? [];

  if (samples.length < 2) {
    return null;
  }

  const windowStart = nowMs - options.paceWindowSeconds * 1000;
  const latest = samples[samples.length - 1];

  // The newest sample is too old to say anything about now.
  if (nowMs - latest[0] > options.paceWindowSeconds * 1000) {
    return null;
  }

  let earliest = latest;

  for (let index = samples.length - 2; index >= 0; index -= 1) {
    earliest = samples[index];

    if (samples[index][0] <= windowStart) {
      break;
    }
  }

  const seconds = (latest[0] - earliest[0]) / 1000;
  const meters = latest[1] - earliest[1];

  if (!(seconds > 0) || meters < options.paceMinWindowMeters) {
    return null;
  }

  return seconds / (meters / 1000);
}

/**
 * Steps per minute over the last ~20 seconds. `samples` are [timestampMs,
 * total steps] and only contain moving time (the step counter is stopped while
 * the walk is paused). null until there are a few seconds to measure.
 */
export function cadenceStepsPerMinute(samples, nowMs, options = WALK_TRACKING) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return null;
  }

  const windowStart = nowMs - options.cadenceWindowSeconds * 1000;
  const latest = samples[samples.length - 1];

  if (nowMs - latest[0] > options.cadenceWindowSeconds * 1000) {
    return 0;
  }

  let earliest = latest;

  for (let index = samples.length - 2; index >= 0; index -= 1) {
    earliest = samples[index];

    if (samples[index][0] <= windowStart) {
      break;
    }
  }

  const seconds = (latest[0] - earliest[0]) / 1000;

  if (seconds < options.cadenceMinWindowSeconds) {
    return null;
  }

  return Math.max(0, Math.round(((latest[1] - earliest[1]) / seconds) * 60));
}

/** A step sample list with only the part the cadence window can still use. */
export function trimStepSamples(samples, nowMs, options = WALK_TRACKING) {
  const cutoff = nowMs - options.cadenceWindowSeconds * 1000 * 2;
  let first = 0;

  while (first < samples.length - 1 && samples[first][0] < cutoff) {
    first += 1;
  }

  return first > 0 ? samples.slice(first) : samples;
}

/** Steps for each kilometre walked, from the walk's own numbers. */
export function stepsPerKilometre(steps, distanceMeters) {
  if (!(steps > 0) || !(distanceMeters >= 100)) {
    return null;
  }

  return Math.round(steps / (distanceMeters / 1000));
}

/**
 * How long one full stride of the little figure takes: a stride is two steps.
 * null for no cadence, which is "do not animate".
 */
export function strideSeconds(cadence) {
  if (!(cadence > 0)) {
    return null;
  }

  // A figure faster than this is a blur, and slower than this looks stuck.
  return Math.min(4, Math.max(0.6, 120 / cadence));
}

/**
 * Auto pause, one look at a time. The screen calls it about once a second
 * while a walk is running and does what it says.
 *
 * - Pause: no new step AND under 0.5 m/s of ground gained, for about 10 s.
 * - Resume: a step arrives. Without a step counter, ground is gained again.
 * - Without a step counter the pause rests on speed alone, and without GPS on
 *   steps alone.
 *
 * `lastStepAtMs` and `lastMoveAtMs` are when the walker last showed that sign
 * of life; a walk that has not shown one yet counts from `sinceMs`, so a walk
 * is not paused in its first seconds, nor one that has just resumed.
 */
export function evaluateAutoPause(
  {
    enabled,
    autoPaused,
    nowMs,
    sinceMs,
    hasStepCounter,
    hasGps,
    lastStepAtMs,
    lastMoveAtMs,
  },
  options = WALK_TRACKING
) {
  if (!enabled || (!hasStepCounter && !hasGps)) {
    return autoPaused ? "resume" : null;
  }

  const quietMs = options.autoPauseQuietSeconds * 1000;
  const lastStep = hasStepCounter ? Math.max(lastStepAtMs ?? 0, sinceMs ?? 0) : null;
  const lastMove = hasGps ? Math.max(lastMoveAtMs ?? 0, sinceMs ?? 0) : null;

  if (autoPaused) {
    // Back to walking: whichever sign of life the phone can see is fresh.
    if (hasStepCounter) {
      return lastStepAtMs != null && nowMs - lastStepAtMs < 2000 ? "resume" : null;
    }

    return lastMoveAtMs != null && nowMs - lastMoveAtMs < 3000 ? "resume" : null;
  }

  const stepsQuiet = lastStep === null || nowMs - lastStep >= quietMs;
  const groundQuiet = lastMove === null || nowMs - lastMove >= quietMs;

  return stepsQuiet && groundQuiet ? "pause" : null;
}

/** 7:05 for 425 seconds. null stays null, so the screen can show a dash. */
export function formatPaceClock(secondsPerUnit) {
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) {
    return null;
  }

  const total = Math.round(secondsPerUnit);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
