import * as Location from "expo-location";
import { t } from "@localization";

import { locationRepository, workoutRepository } from "../Repository";
import { calculateTrackedDistanceSummary } from "../Utils/locationUtils";

// Run and Walk used to track GPS through a background location task with an
// Android foreground service. The app no longer declares the
// FOREGROUND_SERVICE_LOCATION permission, so starting that service would
// crash on Android 14+, and Run is still switched off (see
// Utils/workoutTypeAvailability.js): starting a run fails with
// RUN_TRACKING_UNAVAILABLE, and a run that is already recorded keeps its route
// and distance.
//
// A Walk watches the position only while its screen is open and the app is in
// front (startWalkTracking): when-in-use permission, no task, no service.
//
// The task name stays only so a task an older build left registered can be
// found and stopped (see stopLegacyRunLocationTask).
const LEGACY_RUN_LOCATION_TASK = "background-location-task";

// The message is shown to the person, so it is translated; the code is what
// callers compare (see getRunTrackingStartMessage in the run screen).
export const LOCATION_ERROR_CODES = {
  RUN_TRACKING_UNAVAILABLE: "location-run-tracking-unavailable",
};

function createLocationError(code, messageKey) {
  const error = new Error(t(messageKey));
  error.code = code;
  return error;
}

export async function clearTrackedRunData(db, workoutId) {
  await locationRepository.deleteLocationLogsByWorkout(db, workoutId);
}

export async function getLocationLogsByWorkout(db, workoutId) {
  return locationRepository.getLocationLogsByWorkout(db, workoutId);
}

export async function getTrackedRunSummary(db, workoutId) {
  const logs = await locationRepository.getLocationLogsByWorkout(db, workoutId);
  return calculateTrackedDistanceSummary(logs);
}

// Throws before any Location API is touched, so the run screen's existing
// catch rolls the timer back and shows the message.
export async function startRunTracking() {
  throw createLocationError(
    LOCATION_ERROR_CODES.RUN_TRACKING_UNAVAILABLE,
    "run.location.errors.trackingUnavailable"
  );
}

/**
 * The when-in-use permission, as "granted", "denied" or "undetermined", with
 * whether the system will still ask. Never throws: an unreadable permission is
 * one that is not granted.
 */
export async function getWalkLocationPermission() {
  try {
    const result = await Location.getForegroundPermissionsAsync();

    return {
      status: result.granted ? "granted" : result.status ?? "undetermined",
      canAskAgain: result.canAskAgain !== false,
    };
  } catch (error) {
    console.warn("Unable to read the location permission:", error);
    return { status: "denied", canAskAgain: false };
  }
}

export async function requestWalkLocationPermission() {
  try {
    const result = await Location.requestForegroundPermissionsAsync();

    return {
      status: result.granted ? "granted" : result.status ?? "denied",
      canAskAgain: result.canAskAgain !== false,
    };
  } catch (error) {
    console.warn("Unable to ask for the location permission:", error);
    return { status: "denied", canAskAgain: false };
  }
}

/**
 * Watches the position for a walk, while the walk screen is open and the app
 * is in front. `onFix` gets { latitude, longitude, accuracy, speed, timestamp }.
 * Returns { remove } - call it on pause, finish, unmount and when the app goes
 * to the background, since nothing keeps this alive behind the screen: there
 * is no task and no foreground service here, by design.
 */
export async function startWalkTracking(onFix) {
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      // Android takes the time, iOS the distance; both are small, since a
      // walking pace is slow and the filter in Utils/walkTracking decides
      // what counts.
      timeInterval: 1000,
      distanceInterval: 1,
    },
    (location) => {
      const coords = location?.coords;

      if (!coords) {
        return;
      }

      onFix({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        timestamp: location.timestamp ?? Date.now(),
      });
    }
  );

  return {
    remove: () => {
      try {
        subscription.remove();
      } catch (error) {
        console.warn("Unable to stop watching the position:", error);
      }
    },
  };
}

export async function syncRunTrackingState(db) {
  await workoutRepository.normalizeActiveWorkoutFlags(db);
}

export async function stopRunTracking(db) {
  await workoutRepository.clearActiveWorkoutFlags(db);
}

// expo-task-manager persists registered tasks and re-registers them natively
// on launch. A run task an older build left running carries the
// foregroundService option, and restarting it without the permission is a
// SecurityException on Android 14+. Called once at startup; it only ever stops.
export async function stopLegacyRunLocationTask() {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LEGACY_RUN_LOCATION_TASK
    );

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LEGACY_RUN_LOCATION_TASK);
    }
  } catch (error) {
    console.warn("Unable to stop the legacy run location task:", error);
  }
}
