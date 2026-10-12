import { Platform } from "react-native";

import { prepareHealthConnect } from "./healthStepsService";

// Reads the walks recorded with a watch (or a health app) out of Health
// Connect - Android only. What a session has to say, and which sessions are
// walks worth keeping, is Utils/watchWalks.js; making them walks is
// Services/watchWalkService.js. This file only talks to Health Connect, and
// every answer is "nothing" rather than an error: a phone with no Health
// Connect, or a refusal, is a phone with no watch walks.
//
// Needs the exercise permission (the sessions) and the distance permission
// (how far the walk went); the steps permission is the one the daily steps
// already have. The route is a separate thing: Health Connect asks the person,
// for one session at a time, whether FitVen may see it (readSessionRoute).

const PERMISSIONS = [
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "read", recordType: "Distance" },
  { accessType: "read", recordType: "Steps" },
];

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

const has = (granted, recordType) =>
  granted.some((permission) => permission.recordType === recordType && permission.accessType === "read");

/**
 * "granted" when both the sessions and the distance can be read, "denied"
 * when one of them cannot, "unavailable" when there is no Health Connect (or
 * this is not an Android phone).
 */
export async function getWatchWalkAccess() {
  if (Platform.OS !== "android") {
    return "unavailable";
  }

  try {
    const connect = await prepareHealthConnect();

    if (!connect) {
      return "unavailable";
    }

    const granted = await connect.getGrantedPermissions();

    return has(granted, "ExerciseSession") && has(granted, "Distance") ? "granted" : "denied";
  } catch (error) {
    console.warn("Could not read the watch walk permissions:", error);
    return "unavailable";
  }
}

/** Asks Health Connect, then says how it went. */
export async function requestWatchWalkAccess() {
  try {
    const connect = await prepareHealthConnect();

    if (connect) {
      await connect.requestPermission(PERMISSIONS);
    }
  } catch (error) {
    console.warn("Could not ask for the watch walks:", error);
  }

  return getWatchWalkAccess();
}

/** The exercise sessions between two times (ms), as Health Connect gives them. null when they cannot be read. */
export async function readExerciseSessions({ fromMs, toMs }) {
  try {
    const connect = await prepareHealthConnect();

    if (!connect) {
      return null;
    }

    const sessions = [];
    let pageToken;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await connect.readRecords("ExerciseSession", {
        timeRangeFilter: {
          operator: "between",
          startTime: new Date(fromMs).toISOString(),
          endTime: new Date(toMs).toISOString(),
        },
        ascendingOrder: true,
        pageSize: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      });

      sessions.push(...(result?.records ?? []));
      pageToken = result?.pageToken;

      if (!pageToken) {
        break;
      }
    }

    return sessions;
  } catch (error) {
    console.warn("Could not read the exercise sessions:", error);
    return null;
  }
}

async function aggregate(connect, recordType, { startMs, endMs }) {
  try {
    return await connect.aggregateRecord({
      recordType,
      timeRangeFilter: {
        operator: "between",
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
      },
    });
  } catch (error) {
    console.warn(`Could not add up ${recordType} for a walk:`, error);
    return null;
  }
}

/**
 * How far and how many steps between two times, as { distanceMeters, steps },
 * each null when Health Connect has nothing. Health Connect adds up the
 * sources itself - the watch and the phone are not counted twice.
 */
export async function readWalkTotals({ startMs, endMs }) {
  try {
    const connect = await prepareHealthConnect();

    if (!connect) {
      return { distanceMeters: null, steps: null };
    }

    const [distance, steps] = await Promise.all([
      aggregate(connect, "Distance", { startMs, endMs }),
      aggregate(connect, "Steps", { startMs, endMs }),
    ]);
    const meters = Number(distance?.DISTANCE?.inMeters);
    const count = Number(steps?.COUNT_TOTAL);

    return {
      distanceMeters: Number.isFinite(meters) && meters > 0 ? meters : null,
      steps: Number.isFinite(count) && count > 0 ? count : null,
    };
  } catch (error) {
    console.warn("Could not read the totals of a walk:", error);
    return { distanceMeters: null, steps: null };
  }
}

/**
 * The route of one session, as [{ latitude, longitude, timestamp }] oldest
 * first. Health Connect puts a question to the person first - may FitVen see
 * this route? - and the answer is null when they say no, or there is no route.
 */
export async function readSessionRoute(hcId) {
  try {
    const connect = await prepareHealthConnect();

    if (!connect) {
      return null;
    }

    const route = await connect.requestExerciseRoute(hcId);

    if (!Array.isArray(route) || route.length === 0) {
      return null;
    }

    return route
      .map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        timestamp: Date.parse(point.time),
        accuracy: Number(point.horizontalAccuracy?.inMeters) || null,
      }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Number.isFinite(point.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp);
  } catch (error) {
    // Refused, or no route: the walk stays as it is.
    return null;
  }
}
