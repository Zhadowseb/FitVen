// Pure display maths for the run screen: section counts, segment labels, pace
// windows, route simplification and the two chart path builders.
//
// Lifted out of Run.js, which was 5,172 lines. None of it touches state or
// React, so it is covered by scripts/test-run-display-utils.js - the first
// automated coverage the run screen has had.
import {
  FALLBACK_MAX_HEART_RATE,
  getHeartRateZoneColor,
  getHeartRateZoneThresholds,
} from "./RunHeartRateChartConfig";
import { calculateTrackedDistanceSummary } from "@utils/locationUtils";

export const EMPTY_RUN_SECTION_COUNTS = {
  WARMUP: 0,
  WORKING_SET: 0,
  COOLDOWN: 0,
};

export function normalizeRunSectionType(type) {
  const normalizedType = String(type ?? "WORKING_SET")
    .trim()
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (normalizedType === "WARMUP" || normalizedType === "WARM_UP") {
    return "WARMUP";
  }

  if (normalizedType === "COOLDOWN" || normalizedType === "COOL_DOWN") {
    return "COOLDOWN";
  }

  return "WORKING_SET";
}

export function getRunSectionCounts(sets) {
  return sets.reduce(
    (counts, set) => {
      const type = normalizeRunSectionType(set.type);
      counts[type] += 1;

      return counts;
    },
    { ...EMPTY_RUN_SECTION_COUNTS }
  );
}

export function getRunSegmentLabel(set) {
  const type = normalizeRunSectionType(set?.type);

  if (Number(set?.is_pause) === 1) {
    return "Rest";
  }

  if (type === "WARMUP") {
    return "Warmup";
  }

  if (type === "COOLDOWN") {
    return "Cooldown";
  }

  return "Sprint";
}

export function getWorkingSetPosition(sets, targetIndex) {
  if (targetIndex < 0) {
    return null;
  }

  let workingSetCount = 0;

  for (let index = 0; index <= targetIndex; index++) {
    const set = sets[index];
    const isWorkingSet =
      normalizeRunSectionType(set?.type) === "WORKING_SET" &&
      Number(set?.is_pause) !== 1;

    if (isWorkingSet) {
      workingSetCount += 1;
    }
  }

  return workingSetCount > 0 ? workingSetCount : null;
}

export function getLocationLogTimestamp(log) {
  const timestamp = Number(log?.timestamp);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getLogsFromTimestamp(logs, startTimestampMs) {
  if (!Number.isFinite(startTimestampMs)) {
    return [];
  }

  return logs.filter((log) => {
    const timestamp = getLocationLogTimestamp(log);
    return timestamp !== null && timestamp >= startTimestampMs;
  });
}

export function calculatePaceForLogWindow(logs) {
  const summary = calculateTrackedDistanceSummary(logs);

  if (!Number.isFinite(summary.totalDistanceKm) || summary.totalDistanceKm <= 0) {
    return null;
  }

  const timestamps = logs
    .map(getLocationLogTimestamp)
    .filter((timestamp) => timestamp !== null);

  if (timestamps.length < 2) {
    return null;
  }

  const elapsedMinutes =
    (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;

  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) {
    return null;
  }

  return elapsedMinutes / summary.totalDistanceKm;
}

export function getRecentPaceMinutes(logs, currentTimestampSeconds) {
  const currentTimestampMs = currentTimestampSeconds * 1000;
  const recentLogs = getLogsFromTimestamp(logs, currentTimestampMs - 30000);
  const recentPace = calculatePaceForLogWindow(recentLogs);

  if (recentPace !== null) {
    return recentPace;
  }

  return calculatePaceForLogWindow(
    getLogsFromTimestamp(logs, currentTimestampMs - 60000)
  );
}

export function splitLocationRouteSegments(logs = []) {
  const segments = [];
  let currentSegment = [];

  [...logs]
    .sort(
      (left, right) =>
        (getLocationLogTimestamp(left) ?? 0) -
        (getLocationLogTimestamp(right) ?? 0)
    )
    .forEach((log) => {
      if (log?.latitude === null || log?.longitude === null) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        return;
      }

      const latitude = Number(log?.latitude);
      const longitude = Number(log?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        return;
      }

      currentSegment.push({ latitude, longitude });
    });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

export function buildPaceHistory(logs = []) {
  const orderedLogs = [...logs].sort(
    (left, right) =>
      (getLocationLogTimestamp(left) ?? 0) -
      (getLocationLogTimestamp(right) ?? 0)
  );
  const firstTimestamp = orderedLogs
    .map(getLocationLogTimestamp)
    .find((timestamp) => timestamp !== null);

  if (firstTimestamp === undefined) {
    return [];
  }

  const sampleStep = Math.max(1, Math.ceil(orderedLogs.length / 42));
  const history = [];

  for (let index = sampleStep; index < orderedLogs.length; index += sampleStep) {
    const timestamp = getLocationLogTimestamp(orderedLogs[index]);

    if (timestamp === null) {
      continue;
    }

    const windowLogs = orderedLogs.filter((log) => {
      const logTimestamp = getLocationLogTimestamp(log);
      return (
        logTimestamp !== null &&
        logTimestamp <= timestamp &&
        logTimestamp >= timestamp - 60000
      );
    });
    const pace = calculatePaceForLogWindow(windowLogs);

    if (pace === null || pace < 1.5 || pace > 20) {
      continue;
    }

    history.push({
      x: Math.max(0, (timestamp - firstTimestamp) / 60000),
      y: pace,
    });
  }

  return history;
}

export function getRouteRegion(routeSegments = []) {
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let coordinateCount = 0;

  // Loops instead of Math.min(...array): spreading thousands of tracked
  // points into a function call can overflow the engine's argument limit.
  for (const segment of routeSegments) {
    if (!Array.isArray(segment)) {
      continue;
    }

    for (const coordinate of segment) {
      const latitude = coordinate?.latitude;
      const longitude = coordinate?.longitude;

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        continue;
      }

      coordinateCount += 1;
      if (latitude < minLatitude) minLatitude = latitude;
      if (latitude > maxLatitude) maxLatitude = latitude;
      if (longitude < minLongitude) minLongitude = longitude;
      if (longitude > maxLongitude) maxLongitude = longitude;
    }
  }

  if (coordinateCount === 0) {
    return null;
  }

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.min(
      Math.max((maxLatitude - minLatitude) * 1.45, 0.006),
      120
    ),
    longitudeDelta: Math.min(
      Math.max((maxLongitude - minLongitude) * 1.45, 0.006),
      120
    ),
  };
}

export const MAX_ROUTE_POINTS_PER_SEGMENT = 500;

export function simplifyRouteSegmentForDisplay(segment) {
  if (
    !Array.isArray(segment) ||
    segment.length <= MAX_ROUTE_POINTS_PER_SEGMENT
  ) {
    return segment;
  }

  const stride = Math.ceil(segment.length / MAX_ROUTE_POINTS_PER_SEGMENT);
  const simplified = [];

  for (let index = 0; index < segment.length; index += stride) {
    simplified.push(segment[index]);
  }

  const lastPoint = segment[segment.length - 1];

  if (simplified[simplified.length - 1] !== lastPoint) {
    simplified.push(lastPoint);
  }

  return simplified;
}

export function buildChartPath(
  data,
  {
    invert = false,
    stepped = false,
    durationMinutes = null,
    domainMinY = null,
    domainMaxY = null,
    chartLeft = 14,
    chartRight = 306,
    chartTop = 10,
    chartBottom = 112,
  } = {}
) {
  if (!Array.isArray(data) || data.length < 2) {
    return null;
  }

  const xValues = data.map((point) => Number(point.x));
  const yValues = data.map((point) => Number(point.y));
  const minY = Number.isFinite(domainMinY) ? domainMinY : Math.min(...yValues);
  const maxY = Number.isFinite(domainMaxY) ? domainMaxY : Math.max(...yValues);
  const dataMaxX = Math.max(...xValues);
  const xRange =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : Math.max(dataMaxX, 1);
  const yRange = maxY - minY;
  const normalizedPoints = data.map((point) => {
    const clampedX = Math.min(Math.max(Number(point.x), 0), xRange);
    const x =
      chartLeft + (clampedX / xRange) * (chartRight - chartLeft);
    const clampedY = Math.min(Math.max(Number(point.y), minY), maxY);
    const normalizedY =
      yRange > 0 ? (clampedY - minY) / yRange : 0.5;
    const yRatio = invert ? normalizedY : 1 - normalizedY;
    const y = chartTop + yRatio * (chartBottom - chartTop);

    return { x, y };
  });

  return normalizedPoints.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    if (stepped) {
      const previousPoint = normalizedPoints[index - 1];
      return `${path} L ${point.x} ${previousPoint.y} L ${point.x} ${point.y}`;
    }

    return `${path} L ${point.x} ${point.y}`;
  }, "");
}

export function buildHeartRateZoneSegments(
  data,
  {
    durationMinutes = null,
    domainMinY = 60,
    domainMaxY = FALLBACK_MAX_HEART_RATE,
    chartLeft = 38,
    chartRight = 306,
    chartTop = 10,
    chartBottom = 112,
    zoneBands,
  } = {}
) {
  if (!Array.isArray(data) || data.length < 2) {
    return [];
  }

  const dataMaxX = Math.max(...data.map((point) => Number(point.x) || 0));
  const xRange =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : Math.max(dataMaxX, 1);
  const yRange = domainMaxY - domainMinY;
  const points = data.map((point) => {
    const elapsedMinutes = Math.min(
      Math.max(Number(point?.x) || 0, 0),
      xRange
    );
    const bpm = Math.min(
      Math.max(Number(point?.y) || domainMinY, domainMinY),
      domainMaxY
    );

    return {
      bpm,
      x: chartLeft + (elapsedMinutes / xRange) * (chartRight - chartLeft),
      y:
        chartTop +
        (1 - (bpm - domainMinY) / yRange) * (chartBottom - chartTop),
    };
  });
  const segments = [];
  const zoneThresholds = getHeartRateZoneThresholds(zoneBands);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const bpmDifference = end.bpm - start.bpm;
    const crossingRatios =
      bpmDifference === 0
        ? []
        : zoneThresholds.map(
            (threshold) => (threshold - start.bpm) / bpmDifference
          ).filter((ratio) => ratio > 0 && ratio < 1);
    const ratios = [0, ...crossingRatios.sort((left, right) => left - right), 1];

    for (let ratioIndex = 1; ratioIndex < ratios.length; ratioIndex += 1) {
      const startRatio = ratios[ratioIndex - 1];
      const endRatio = ratios[ratioIndex];
      const segmentStartX = start.x + (end.x - start.x) * startRatio;
      const segmentStartY = start.y + (end.y - start.y) * startRatio;
      const segmentEndX = start.x + (end.x - start.x) * endRatio;
      const segmentEndY = start.y + (end.y - start.y) * endRatio;
      const midpointBpm =
        start.bpm + bpmDifference * ((startRatio + endRatio) / 2);

      segments.push({
        color: getHeartRateZoneColor(midpointBpm, zoneBands),
        path: `M ${segmentStartX} ${segmentStartY} L ${segmentEndX} ${segmentEndY}`,
      });
    }
  }

  return segments;
}
