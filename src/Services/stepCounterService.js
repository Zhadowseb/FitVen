import { Platform } from "react-native";

// The phone's step counter, for a walk. expo-sensors is native: a development
// client built before it was declared does not have it, and importing it there
// throws. So it is required here, not imported, and a missing module is the
// same as a phone without a step counter - the walk goes on without steps. It
// is also why the services still load in the Node tests.
let Pedometer = null;
let loadFailed = false;

function getPedometer() {
  if (Pedometer || loadFailed) {
    return Pedometer;
  }

  try {
    Pedometer = require("expo-sensors").Pedometer ?? null;
  } catch (error) {
    loadFailed = true;
    console.warn("The step counter is not in this build:", error);
  }

  return Pedometer;
}

/** Whether this phone, in this build, has a step counter at all. */
export async function isStepCounterAvailable() {
  const pedometer = getPedometer();

  if (!pedometer) {
    return false;
  }

  try {
    return Boolean(await pedometer.isAvailableAsync());
  } catch (error) {
    console.warn("Unable to check the step counter:", error);
    return false;
  }
}

/**
 * "granted", "denied" or "undetermined". Android asks for ACTIVITY_RECOGNITION
 * and iOS for Motion & Fitness, and either only the first time a walk starts -
 * never at launch.
 */
export async function getStepPermission() {
  const pedometer = getPedometer();

  if (!pedometer) {
    return { status: "denied", canAskAgain: false };
  }

  try {
    const result = await pedometer.getPermissionsAsync();

    return {
      status: result.granted ? "granted" : result.status ?? "undetermined",
      canAskAgain: result.canAskAgain !== false,
    };
  } catch (error) {
    console.warn("Unable to read the step permission:", error);
    return { status: "denied", canAskAgain: false };
  }
}

export async function requestStepPermission() {
  const pedometer = getPedometer();

  if (!pedometer) {
    return { status: "denied", canAskAgain: false };
  }

  try {
    const result = await pedometer.requestPermissionsAsync();

    return {
      status: result.granted ? "granted" : result.status ?? "denied",
      canAskAgain: result.canAskAgain !== false,
    };
  } catch (error) {
    console.warn("Unable to ask for the step permission:", error);
    return { status: "denied", canAskAgain: false };
  }
}

/**
 * Calls `onSteps(total)` with the steps taken since this was called, each time
 * there are more. Returns { remove }, or null when there is nothing to watch.
 * Stop it on pause, finish, unmount and when the app goes to the background.
 */
export function watchSteps(onSteps) {
  const pedometer = getPedometer();

  if (!pedometer) {
    return null;
  }

  try {
    const subscription = pedometer.watchStepCount((result) => {
      const steps = Number(result?.steps);

      if (Number.isFinite(steps) && steps >= 0) {
        onSteps(steps);
      }
    });

    return {
      remove: () => {
        try {
          subscription.remove();
        } catch (error) {
          console.warn("Unable to stop the step counter:", error);
        }
      },
    };
  } catch (error) {
    console.warn("Unable to watch the step counter:", error);
    return null;
  }
}

/**
 * Steps taken between two moments, for the time the app was in the background
 * and nothing was watching. Only iOS can answer that; Android cannot, and gets
 * null (the steps of that stretch are lost, as its distance is).
 */
export async function getStepsBetween(startMs, endMs) {
  const pedometer = getPedometer();

  if (!pedometer || Platform.OS !== "ios" || !(endMs > startMs)) {
    return null;
  }

  try {
    const result = await pedometer.getStepCountAsync(
      new Date(startMs),
      new Date(endMs)
    );
    const steps = Number(result?.steps);

    return Number.isFinite(steps) && steps >= 0 ? steps : null;
  } catch (error) {
    console.warn("Unable to read the steps of the gap:", error);
    return null;
  }
}
