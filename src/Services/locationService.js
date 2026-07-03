import * as Location from "expo-location";
import { Platform } from "react-native";

import { locationRepository, workoutRepository } from "../Repository";
import {
  calculateTrackedDistanceSummary,
  isSameLocationPoint,
  normalizeLocationPoint,
} from "../Utils/locationUtils";
import { withTransaction } from "./shared";

export const RUN_LOCATION_TASK = "background-location-task";

function normalizeExpoLocationObject(location) {
  return normalizeLocationPoint({
    latitude: location?.coords?.latitude,
    longitude: location?.coords?.longitude,
    accuracy: location?.coords?.accuracy,
    timestamp: location?.timestamp,
  });
}

function getLocationTrackingOptions() {
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 3,
    mayShowUserSettingsDialog: true,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "FitVen is tracking your run",
      notificationBody: "Distance and pace update while your workout is running.",
      notificationColor: "#d97706",
      killServiceOnDestroy: false,
    },
  };
}

function hasPreciseForegroundPermission(permission) {
  if (!permission?.granted) {
    return false;
  }

  if (Platform.OS !== "android") {
    return true;
  }

  const androidAccuracy = permission?.android?.accuracy;
  return androidAccuracy === undefined || androidAccuracy === "fine";
}

async function ensureForegroundLocationPermission() {
  let foregroundPermission = await Location.getForegroundPermissionsAsync();

  if (!foregroundPermission.granted || !hasPreciseForegroundPermission(foregroundPermission)) {
    foregroundPermission = await Location.requestForegroundPermissionsAsync();
  }

  if (!foregroundPermission.granted) {
    throw new Error("Location permission was not granted.");
  }

  if (!hasPreciseForegroundPermission(foregroundPermission)) {
    throw new Error("Precise location permission is required for run tracking.");
  }
}

async function ensureBackgroundLocationPermission({ requestIfMissing = true } = {}) {
  const backgroundLocationAvailable =
    await Location.isBackgroundLocationAvailableAsync();

  if (!backgroundLocationAvailable) {
    throw new Error("Background location is not available on this device.");
  }

  let backgroundPermission = await Location.getBackgroundPermissionsAsync();

  if (!backgroundPermission.granted && requestIfMissing) {
    backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  }

  if (!backgroundPermission.granted) {
    throw new Error("Background location permission was not granted.");
  }
}

async function ensureLocationServicesEnabled() {
  let servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled && Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // If the user dismisses the dialog we fall through to the final check.
    }

    servicesEnabled = await Location.hasServicesEnabledAsync();
  }

  if (!servicesEnabled) {
    throw new Error("Location services are turned off.");
  }
}

async function setActiveWorkout(db, workoutId) {
  await withTransaction(db, async () => {
    await workoutRepository.clearActiveWorkoutFlags(db);
    await workoutRepository.setWorkoutActiveFlag(db, {
      workoutId,
      isActive: true,
    });
  });
}

export async function clearTrackedRunData(db, workoutId) {
  await locationRepository.deleteLocationLogsByWorkout(db, workoutId);
  await locationRepository.deleteLocationDebugLogsByWorkout(db, workoutId);
}

export async function getLocationLogsByWorkout(db, workoutId) {
  return locationRepository.getLocationLogsByWorkout(db, workoutId);
}

export async function getTrackedRunSummary(db, workoutId) {
  const logs = await locationRepository.getLocationLogsByWorkout(db, workoutId);
  return calculateTrackedDistanceSummary(logs);
}

export async function recordTrackedLocations(db, locations) {
  const workout = await workoutRepository.getActiveWorkoutForTracking(db);

  if (!workout?.workout_id) {
    return;
  }

  const normalizedLocations = locations
    .map(normalizeExpoLocationObject)
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (!normalizedLocations.length) {
    return;
  }

  let previousStoredPoint = normalizeLocationPoint(
    await locationRepository.getLatestLocationLogByWorkout(db, workout.workout_id)
  );

  for (const location of normalizedLocations) {
    if (isSameLocationPoint(previousStoredPoint, location)) {
      continue;
    }

    await locationRepository.createLocationLog(db, {
      workoutId: workout.workout_id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp,
    });

    previousStoredPoint = location;
  }
}

export async function startRunTracking(db, workoutId, { resetLogs = false } = {}) {
  await ensureLocationServicesEnabled();
  await ensureForegroundLocationPermission();
  await ensureBackgroundLocationPermission();

  if (resetLogs) {
    await clearTrackedRunData(db, workoutId);
  }

  await locationRepository.createLocationTrackingBreak(db, { workoutId });
  await setActiveWorkout(db, workoutId);

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);

  if (!hasStarted) {
    await Location.startLocationUpdatesAsync(
      RUN_LOCATION_TASK,
      getLocationTrackingOptions()
    );
  }
}

export async function ensureRunTracking(db, workoutId) {
  await ensureLocationServicesEnabled();
  await ensureForegroundLocationPermission();
  await ensureBackgroundLocationPermission({ requestIfMissing: false });
  await setActiveWorkout(db, workoutId);

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);

  if (!hasStarted) {
    await locationRepository.createLocationTrackingBreak(db, { workoutId });
    await Location.startLocationUpdatesAsync(
      RUN_LOCATION_TASK,
      getLocationTrackingOptions()
    );
  }
}

export async function syncRunTrackingState(db) {
  await workoutRepository.normalizeActiveWorkoutFlags(db);

  const activeWorkout = await workoutRepository.getActiveWorkoutForTracking(db);
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);

  if (activeWorkout?.workout_id || !hasStarted) {
    return;
  }

  await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
}

export async function stopRunTracking(db) {
  await workoutRepository.clearActiveWorkoutFlags(db);

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);

  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
  }
}
