import AsyncStorage from "@react-native-async-storage/async-storage";

import { locationRepository, runningRepository } from "../Repository";
import { averagePaceSecondsPerKm } from "../Utils/walkTracking";
import * as workoutService from "./workoutService";

// What a walk keeps. The distance, time and steps of a finished walk live in
// one row of `Run` (a working segment), which is where the statistics already
// read the distance of runs and walks from; the route lives in `LocationLog`,
// as it did for runs. Both stay on the phone: Run and Walk are not in the
// cloud, and the route is never uploaded.

const AUTO_PAUSE_STORAGE_KEY = "fitven.walk.autoPause";

let autoPauseCache = null;

/**
 * Whether the walk stops its clock by itself when the walker stops. On by
 * default, and remembered on this phone after that.
 */
export async function getAutoPauseEnabled() {
  if (autoPauseCache !== null) {
    return autoPauseCache;
  }

  try {
    const stored = await AsyncStorage.getItem(AUTO_PAUSE_STORAGE_KEY);
    autoPauseCache = stored === null ? true : stored === "1";
  } catch (error) {
    console.warn("Could not read the auto pause setting:", error);
    autoPauseCache = true;
  }

  return autoPauseCache;
}

export async function setAutoPauseEnabled(enabled) {
  const next = Boolean(enabled);

  autoPauseCache = next;

  try {
    await AsyncStorage.setItem(AUTO_PAUSE_STORAGE_KEY, next ? "1" : "0");
  } catch (error) {
    console.warn("Could not save the auto pause setting:", error);
  }

  return next;
}

/**
 * What is stored for a walk: its route points, oldest first, and what its
 * segments added up to. For a walk that is open this is where it picks up
 * after the app was closed; for a finished one it is all there is to show.
 */
export async function loadWalk(db, workoutId) {
  const [points, totals, segment] = await Promise.all([
    locationRepository.getLocationLogsByWorkout(db, workoutId),
    runningRepository.getWalkTotals(db, workoutId),
    runningRepository.getWalkSegment(db, workoutId),
  ]);

  return {
    points,
    totals: {
      distanceKm: Number(totals?.distance_km) || 0,
      durationSeconds: Number(totals?.duration_seconds) || 0,
      steps: totals?.steps === null || totals?.steps === undefined ? null : Number(totals.steps),
      segments: Number(totals?.segments) || 0,
    },
    segment,
  };
}

/** One position the walk kept. */
export async function recordWalkFix(db, { workoutId, fix }) {
  await locationRepository.createLocationLog(db, {
    workoutId,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    timestamp: fix.timestamp,
  });
}

/**
 * Marks that tracking stopped here: a pause, or the app going to the
 * background. The next fix starts a new stretch, so no line is drawn across
 * the gap.
 */
export async function recordWalkBreak(db, { workoutId, timestamp = Date.now() }) {
  await locationRepository.createLocationTrackingBreak(db, {
    workoutId,
    timestamp,
  });
}

function segmentValues({ distanceMeters, movingSeconds, steps }) {
  const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : 0;
  const paceSeconds = averagePaceSecondsPerKm(distanceMeters, movingSeconds);

  return {
    distanceKm,
    durationSeconds: Math.max(0, Math.round(movingSeconds)),
    paceMinutes: paceSeconds === null ? null : paceSeconds / 60,
    steps: steps === null || steps === undefined ? null : Math.max(0, Math.round(steps)),
  };
}

/**
 * Writes the walk so far into its segment, so an app that is closed mid-walk
 * keeps its steps and the rest is rebuilt from the route.
 */
export async function saveWalkProgress(
  db,
  { workoutId, distanceMeters, movingSeconds, steps }
) {
  await runningRepository.saveWalkSegment(db, {
    workoutId,
    ...segmentValues({ distanceMeters, movingSeconds, steps }),
    done: false,
  });
}

/**
 * Finishes the walk: the segment is closed with its final numbers and the
 * workout is finished like any other, without a post (a walk has no summary to
 * post yet), so it counts in the statistics and the calendar.
 */
export async function finishWalk(
  db,
  { workoutId, distanceMeters, movingSeconds, steps }
) {
  await runningRepository.saveWalkSegment(db, {
    workoutId,
    ...segmentValues({ distanceMeters, movingSeconds, steps }),
    done: true,
  });

  await workoutService.finishWorkout(db, {
    workoutId,
    elapsedTime: Math.max(0, Math.round(movingSeconds)),
    createPost: false,
  });
}

/** No route and nothing covered: what a walk has before it is started. */
export async function clearWalk(db, workoutId) {
  await locationRepository.deleteLocationLogsByWorkout(db, workoutId);
  await runningRepository.resetWalkSegments(db, workoutId);
}

/** Back to a walk that has not started: no route, nothing covered, no clock. */
export async function restartWalk(db, workoutId) {
  await clearWalk(db, workoutId);
  await workoutService.resetWorkoutState(db, workoutId);
}
