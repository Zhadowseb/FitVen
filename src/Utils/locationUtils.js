const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_RUN_DISTANCE_FILTER = Object.freeze({
  maxAccuracyMeters: 35,
  minSegmentDistanceMeters: 3,
  maxAccuracyDistanceFloorMeters: 10,
  accuracyDistanceFloorMultiplier: 0.5,
  maxSegmentSpeedMetersPerSecond: 8.5,
  maxSegmentGapSeconds: 120,
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

export const calculateTrackedDistanceSummary = (logs, filterOverrides = {}) => {
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

  for (const log of orderedLogs) {
    if (isLocationTrackingBreak(log)) {
      previousAnchorPoint = null;
      previousUsablePoint = null;
      trackingBreakCount += 1;
      continue;
    }

    const currentPoint = normalizeLocationPoint(log);

    if (!currentPoint || !hasUsableAccuracy(currentPoint, options)) {
      rejectedPointCount += 1;
      continue;
    }

    usablePointCount += 1;

    if (!previousAnchorPoint) {
      previousAnchorPoint = currentPoint;
      previousUsablePoint = currentPoint;
      continue;
    }

    if (
      isSameLocationPoint(
        previousUsablePoint,
        currentPoint,
        options.samePointCoordinateEpsilon
      )
    ) {
      continue;
    }

    const {
      timeDiffSeconds: transitionTimeDiffSeconds,
      speedMetersPerSecond: transitionSpeedMetersPerSecond,
    } = getLocationSegmentMetrics(previousUsablePoint, currentPoint);

    if (
      !Number.isFinite(transitionTimeDiffSeconds) ||
      transitionTimeDiffSeconds <= 0
    ) {
      rejectedPointCount += 1;
      continue;
    }

    if (
      transitionTimeDiffSeconds > options.maxSegmentGapSeconds ||
      !Number.isFinite(transitionSpeedMetersPerSecond) ||
      transitionSpeedMetersPerSecond > options.maxSegmentSpeedMetersPerSecond
    ) {
      previousAnchorPoint = currentPoint;
      previousUsablePoint = currentPoint;
      rejectedPointCount += 1;
      reanchorCount += 1;
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
      continue;
    }

    totalDistanceMeters += distanceMeters;
    previousAnchorPoint = currentPoint;
    previousUsablePoint = currentPoint;
    acceptedSegmentCount += 1;
  }

  return {
    totalDistanceMeters,
    totalDistanceKm: totalDistanceMeters / 1000,
    pointCount: orderedLogs.length,
    usablePointCount,
    acceptedSegmentCount,
    rejectedPointCount,
    trackingBreakCount,
    reanchorCount,
  };
};
