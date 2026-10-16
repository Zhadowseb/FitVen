import * as Location from "expo-location";
import { t } from "@localization";

import { locationRepository, workoutRepository } from "../Repository";
import { calculateTrackedDistanceSummary } from "../Utils/locationUtils";

// Run and Walk used to track GPS through a background location task with an
// Android foreground service. Run is still switched off (see
// Utils/workoutTypeAvailability.js): starting a run fails with
// RUN_TRACKING_UNAVAILABLE, and a run that is already recorded keeps its route
// and distance.
//
// A Walk is the one thing that may track with the screen off
// (startWalkTracking): a location task of its own, WALK_LOCATION_TASK, which
// is an Android location foreground service (with a notification) and iOS
// background location updates, on the when-in-use permission. It is started
// when a walk runs and stopped when it pauses or ends. The task itself is
// defined in walkLocationTask.js, which App.js imports.
//
// The older task name stays only so a task an older build left registered can
// be found and stopped (see stopLegacyRunLocationTask).
const LEGACY_RUN_LOCATION_TASK = "background-location-task";

export const WALK_LOCATION_TASK = "walk-location-task";

// The accent colour as the notification's tint, the same as expo-notifications' in app.json.
const WALK_NOTIFICATION_COLOR = "#ff7a2a";

// The one walk that wants positions, and the one start or stop that is in
// flight: starting and stopping the same task out of order would leave a
// service running (or not running) that nobody asked for.
let walkFixListener = null;
let taskChain = Promise.resolve();

function inTaskOrder(job) {
  const result = taskChain.then(job);

  taskChain = result.catch(() => {});

  return result;
}

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

function toWalkFix(location) {
  const coords = location?.coords;

  if (!coords) {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    timestamp: location.timestamp ?? Date.now(),
  };
}

/**
 * The positions the walk's location task delivers, handed to the walk that
 * asked for them, oldest first (a task can deliver several at once). Called by
 * walkLocationTask.js.
 */
export function deliverWalkLocations(locations) {
  const listener = walkFixListener;

  if (!listener) {
    // A task that outlived its walk - the app was relaunched, say - and nobody
    // is waiting for it: it is not left running.
    void stopWalkLocationTask();
    return;
  }

  [...(locations ?? [])]
    .sort((a, b) => (a?.timestamp ?? 0) - (b?.timestamp ?? 0))
    .forEach((location) => {
      const fix = toWalkFix(location);

      if (fix) {
        listener(fix);
      }
    });
}

let currentWalkTracking = null;

// With a token it stops that start. Without one it stops whatever walk task
// there is, which is what the launch cleanup and an orphaned task need - but
// only if no walk owns the task by the time it runs: a late batch from a task
// that was just stopped must not stop the one a quick resume started behind it.
function stopWalkTask(token) {
  return inTaskOrder(async () => {
    if (token ? currentWalkTracking !== token : currentWalkTracking !== null) {
      return;
    }

    currentWalkTracking = null;
    walkFixListener = null;

    try {
      if (await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK);
      }
    } catch (error) {
      console.warn("Unable to stop the walk location task:", error);
    }
  });
}

/** Called once at startup: a walk task an earlier launch left registered is stopped. */
export function stopWalkLocationTask() {
  return stopWalkTask(null);
}

// Android only starts a foreground service while the app is in front, and the
// app is not counted as in front for a moment after a permission dialog closes
// - which is exactly when the first walk starts. A refusal for that reason is
// tried again a few times before it is given up on.
const FOREGROUND_RETRY_MS = 500;
const FOREGROUND_RETRIES = 4;

async function startWalkTask(options) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, options);
      return;
    } catch (error) {
      const notInFront = /START_NOT_ALLOWED|in the background/i.test(`${error?.code} ${error?.message}`);

      if (!notInFront || attempt >= FOREGROUND_RETRIES) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, FOREGROUND_RETRY_MS));
    }
  }
}

/**
 * Starts the position for a walk, with the screen on or off. `onFix` gets
 * { latitude, longitude, accuracy, speed, timestamp }. Resolves to
 * { background, remove }: call `remove` on pause, finish and when the walk is
 * left or deleted. It is what stops the Android service and its notification
 * (and the iPhone's location indicator), and it returns a promise that settles
 * once it has.
 *
 * `background` says whether the position keeps coming with the screen off. It
 * is false when the task could not be started - a build made before the
 * foreground service was declared, or the service not being allowed to start
 * from where the app is - and the position is then watched only while the app
 * is in front, as it was before.
 *
 * Start it from the front only: Android refuses to start a foreground service
 * from the background.
 */
export function startWalkTracking(onFix) {
  return inTaskOrder(async () => {
    const token = {};

    currentWalkTracking = token;
    walkFixListener = onFix;

    try {
      await startWalkTask({
        accuracy: Location.Accuracy.BestForNavigation,
        // Android takes the time, iOS the distance; both are small, since a
        // walking pace is slow and the filter in Utils/walkTracking decides
        // what counts.
        timeInterval: 1000,
        // No distance filter: standing still is what an auto pause judges, and
        // behind the screen Android does not run the timers, so it has to be
        // judged by positions that keep arriving.
        distanceInterval: 0,
        // iOS stops delivering when it decides the phone stands still, and
        // does not start again behind the screen; a walk decides that itself.
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: t("walk.tracking.notificationTitle"),
          notificationBody: t("walk.tracking.notificationBody"),
          notificationColor: WALK_NOTIFICATION_COLOR,
          // Closing the app ends the service with it; a walk that is opened
          // again comes back paused.
          killServiceOnDestroy: true,
        },
      });

      return { background: true, remove: () => stopWalkTask(token) };
    } catch (error) {
      console.warn("The walk cannot be tracked with the screen off:", error);
      currentWalkTracking = null;
      walkFixListener = null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const fix = toWalkFix(location);

        if (fix) {
          onFix(fix);
        }
      }
    );

    return {
      background: false,
      remove: async () => {
        try {
          subscription.remove();
        } catch (error) {
          console.warn("Unable to stop watching the position:", error);
        }
      },
    };
  });
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
