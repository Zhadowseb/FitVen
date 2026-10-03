import * as Location from "expo-location";
import { t } from "@localization";

import { locationRepository, workoutRepository } from "../Repository";
import { calculateTrackedDistanceSummary } from "../Utils/locationUtils";

// Run and Walk used to track GPS through a background location task with an
// Android foreground service. Neither type can be started any more (see
// Utils/workoutTypeAvailability.js), and the app no longer declares the
// FOREGROUND_SERVICE_LOCATION permission, so starting that service would
// crash on Android 14+. Nothing here starts location updates: a run that is
// already recorded keeps its route and distance, and starting a new one fails
// with RUN_TRACKING_UNAVAILABLE.
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
