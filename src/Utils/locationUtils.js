const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_RUN_DISTANCE_FILTER = Object.freeze({
  // A phone carried in a pocket commonly reports 40-60m accuracy even while
  // its route is still usable. The previous 35m hard cut-off discarded those
  // points and then lost the distance across the resulting tracking gaps.
  maxAccuracyMeters: 65,
  minSegmentDistanceMeters: 3,
  maxAccuracyDistanceFloorMeters: 15,
  accuracyDistanceFloorMultiplier: 0.5,
  maxSegmentSpeedMetersPerSecond: 8.5,
  // Android may deliver sparse points while the screen is locked. A plausible
  // segment is safer to retain than dropping several minutes of a real run.
  maxSegmentGapSeconds: 600,
  samePointCoordinateEpsilon: 0.0000001,
});

const toRadians = (degrees) => degrees * (Math.PI / 180);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) *
      Math.cos(rLat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

export const normalizeLocationPoint = (point) => {
  const latitude = toFiniteNumber(point?.latitude);
  const longitude = toFiniteNumber(point?.longitude);
  const accuracy = toFiniteNumber(point?.accuracy);
  const timestamp = toFiniteNumber(point?.timestamp);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    timestamp === null
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy,
    timestamp,
  };
};

export const isLocationTrackingBreak = (point) =>
  point?.latitude === null && point?.longitude === null;

export const isSameLocationPoint = (
  left,
  right,
  coordinateEpsilon = DEFAULT_RUN_DISTANCE_FILTER.samePointCoordinateEpsilon
) => {
  if (!left || !right) {
    return false;
  }

  return (
    left.timestamp === right.timestamp &&
    Math.abs(left.latitude - right.latitude) <= coordinateEpsilon &&
    Math.abs(left.longitude - right.longitude) <= coordinateEpsilon
  );
};

export const getLocationSegmentMetrics = (previousPoint, nextPoint) => {
  const distanceMeters = calculateDistance(
    previousPoint.latitude,
    previousPoint.longitude,
    nextPoint.latitude,
    nextPoint.longitude
  );
  const timeDiffSeconds = (nextPoint.timestamp - previousPoint.timestamp) / 1000;
  const speedMetersPerSecond =
    Number.isFinite(distanceMeters) &&
    Number.isFinite(timeDiffSeconds) &&
    timeDiffSeconds > 0
      ? distanceMeters / timeDiffSeconds
      : null;

  return {
    distanceMeters,
    timeDiffSeconds,
    speedMetersPerSecond,
  };
};

const hasUsableAccuracy = (point, options) =>
  Number.isFinite(point?.accuracy) &&
  point.accuracy > 0 &&
  point.accuracy <= options.maxAccuracyMeters;

const getMinimumSegmentDistance = (previousPoint, nextPoint, options) => {
  const accuracyDistanceFloor =
    Math.max(previousPoint.accuracy, nextPoint.accuracy) *
    options.accuracyDistanceFloorMultiplier;

  return Math.max(
    options.minSegmentDistanceMeters,
    Math.min(options.maxAccuracyDistanceFloorMeters, accuracyDistanceFloor)
  );
};

const compareLocationLogs = (left, right) => {
  const leftTimestamp = toFiniteNumber(left?.timestamp);
  const rightTimestamp = toFiniteNumber(right?.timestamp);

  if (leftTimestamp !== null && rightTimestamp !== null) {
    const timestampDifference = leftTimestamp - rightTimestamp;

    if (timestampDifference !== 0) {
      return timestampDifference;
    }
  } else if (leftTimestamp !== null) {
    return -1;
  } else if (rightTimestamp !== null) {
    return 1;
  }

  return (toFiniteNumber(left?.id) ?? 0) - (toFiniteNumber(right?.id) ?? 0);
};

const analyzeTrackedDistance = (
  logs,
  filterOverrides = {},
  { includeDiagnostics = false } = {}
) => {
  const options = {
    ...DEFAULT_RUN_DISTANCE_FILTER,
    ...filterOverrides,
  };
  const orderedLogs = [...(Array.isArray(logs) ? logs : [])].sort(
    compareLocationLogs
  );

  // The recent point catches jumps; the anchor lets small valid steps accumulate.
  let totalDistanceMeters = 0;
  let previousAnchorPoint = null;
  let previousUsablePoint = null;
  let usablePointCount = 0;
  let acceptedSegmentCount = 0;
  let rejectedPointCount = 0;
  let trackingBreakCount = 0;
  let reanchorCount = 0;
  const diagnostics = includeDiagnostics ? [] : null;

  const recordDiagnostic = (log, values) => {
    if (!diagnostics) {
      return;
    }

    diagnostics.push({
      latitude: toFiniteNumber(log?.latitude),
      longitude: toFiniteNumber(log?.longitude),
      accuracy: toFiniteNumber(log?.accuracy),
      timestamp: toFiniteNumber(log?.timestamp),
      accepted: false,
      rejectionReason: null,
      distanceMeters: null,
      timeDiffSeconds: null,
      speedMetersPerSecond: null,
      ...values,
    });
  };

  for (const log of orderedLogs) {
    if (isLocationTrackingBreak(log)) {
      previousAnchorPoint = null;
      previousUsablePoint = null;
      trackingBreakCount += 1;
      recordDiagnostic(log, { rejectionReason: "tracking_break" });
      continue;
    }

    const currentPoint = normalizeLocationPoint(log);

    if (!currentPoint) {
      rejectedPointCount += 1;
      recordDiagnostic(log, { rejectionReason: "invalid_point" });
      continue;
    }

    if (!hasUsableAccuracy(currentPoint, options)) {
      rejectedPointCount += 1;
      recordDiagnostic(log, { rejectionReason: "poor_accuracy" });
      continue;
    }

    usablePointCount += 1;

    if (!previousAnchorPoint) {
      previousAnchorPoint = currentPoint;
      previousUsablePoint = currentPoint;
      recordDiagnostic(log, { accepted: true, rejectionReason: "anchor" });
      continue;
    }

    if (
      isSameLocationPoint(
        previousUsablePoint,
        currentPoint,
        options.samePointCoordinateEpsilon
      )
    ) {
      recordDiagnostic(log, { rejectionReason: "duplicate_point" });
      continue;
    }

    const {
      distanceMeters: transitionDistanceMeters,
      timeDiffSeconds: transitionTimeDiffSeconds,
      speedMetersPerSecond: transitionSpeedMetersPerSecond,
    } = getLocationSegmentMetrics(previousUsablePoint, currentPoint);

    const transitionDiagnostic = {
      distanceMeters: transitionDistanceMeters,
      timeDiffSeconds: transitionTimeDiffSeconds,
      speedMetersPerSecond: transitionSpeedMetersPerSecond,
    };

    if (
      !Number.isFinite(transitionTimeDiffSeconds) ||
      transitionTimeDiffSeconds <= 0
    ) {
      rejectedPointCount += 1;
      recordDiagnostic(log, {
        ...transitionDiagnostic,
        rejectionReason: "non_monotonic_timestamp",
      });
      continue;
    }

    if (transitionTimeDiffSeconds > options.maxSegmentGapSeconds) {
      previousAnchorPoint = currentPoint;
      previousUsablePoint = currentPoint;
      rejectedPointCount += 1;
      reanchorCount += 1;
      recordDiagnostic(log, {
        ...transitionDiagnostic,
        rejectionReason: "tracking_gap",
      });
      continue;
    }

    if (
      !Number.isFinite(transitionSpeedMetersPerSecond) ||
      transitionSpeedMetersPerSecond > options.maxSegmentSpeedMetersPerSecond
    ) {
      previousAnchorPoint = currentPoint;
      previousUsablePoint = currentPoint;
      rejectedPointCount += 1;
      reanchorCount += 1;
      recordDiagnostic(log, {
        ...transitionDiagnostic,
        rejectionReason: "implausible_speed",
      });
      continue;
    }

    const { distanceMeters } = getLocationSegmentMetrics(
      previousAnchorPoint,
      currentPoint
    );
    const minimumSegmentDistance = getMinimumSegmentDistance(
      previousAnchorPoint,
      currentPoint,
      options
    );

    if (
      !Number.isFinite(distanceMeters) ||
      distanceMeters < minimumSegmentDistance
    ) {
      previousUsablePoint = currentPoint;
      rejectedPointCount += 1;
      recordDiagnostic(log, {
        ...transitionDiagnostic,
        distanceMeters,
        rejectionReason: "below_noise_floor",
      });
      continue;
    }

    totalDistanceMeters += distanceMeters;
    previousAnchorPoint = currentPoint;
    previousUsablePoint = currentPoint;
    acceptedSegmentCount += 1;
    recordDiagnostic(log, {
      ...transitionDiagnostic,
      accepted: true,
      distanceMeters,
      rejectionReason:
        transitionTimeDiffSeconds > 120 ? "accepted_after_gap" : "accepted",
    });
  }

  const summary = {
    totalDistanceMeters,
    totalDistanceKm: totalDistanceMeters / 1000,
    pointCount: orderedLogs.length,
    usablePointCount,
    acceptedSegmentCount,
    rejectedPointCount,
    trackingBreakCount,
    reanchorCount,
  };

  return diagnostics ? { ...summary, diagnostics } : summary;
};

export const calculateTrackedDistanceSummary = (logs, filterOverrides = {}) =>
  analyzeTrackedDistance(logs, filterOverrides);

export const calculateTrackedDistanceDiagnostics = (
  logs,
  filterOverrides = {}
) => analyzeTrackedDistance(logs, filterOverrides, { includeDiagnostics: true });
