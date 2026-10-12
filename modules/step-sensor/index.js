// The phone's own step counter (Android), read by the app and, while the app is
// closed, by a periodic job of the system. `src/Services/stepSensorService.js`
// turns the readings into steps for each day; the rules are in
// `src/Utils/stepSensor.js`.
//
// Optional, so a build without the module - an iPhone, Expo Go, a build made
// before it existed - is just a phone with no sensor layer. Nothing here
// throws: counting steps this way is a fallback, and nothing may fail because
// of it.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

// Looked up when used, not when loaded, so a build that has no module (or no
// Android) is simply a phone with no sensor layer.
function getNative() {
  return Platform.OS === "android" ? requireOptionalNativeModule("StepSensor") : null;
}

function warn(what, error) {
  console.warn(`StepSensor.${what} failed:`, error);
}

/** Whether this phone has a step counter, and this build can read it. */
export function isAvailable() {
  const native = getNative();

  if (!native) {
    return false;
  }

  try {
    return Boolean(native.isAvailable());
  } catch (error) {
    warn("isAvailable", error);
    return false;
  }
}

/** Whether the activity-recognition permission the counter needs has been given. */
export function hasPermission() {
  const native = getNative();

  if (!native) {
    return false;
  }

  try {
    return Boolean(native.hasPermission());
  } catch (error) {
    warn("hasPermission", error);
    return false;
  }
}

/** One reading now - { time, counter, bootTime } in ms and steps - or null. */
export async function readNow() {
  const native = getNative();

  if (!native) {
    return null;
  }

  try {
    return (await native.readNow()) ?? null;
  } catch (error) {
    warn("readNow", error);
    return null;
  }
}

/** Starts the periodic read while the app is closed. Asking again changes nothing. */
export async function startRecording() {
  const native = getNative();

  if (!native) {
    return false;
  }

  try {
    await native.startRecording();
    return true;
  } catch (error) {
    warn("startRecording", error);
    return false;
  }
}

export async function stopRecording() {
  const native = getNative();

  if (!native) {
    return;
  }

  try {
    await native.stopRecording();
  } catch (error) {
    warn("stopRecording", error);
  }
}

export async function isRecording() {
  const native = getNative();

  if (!native) {
    return false;
  }

  try {
    return Boolean(await native.isRecording());
  } catch (error) {
    warn("isRecording", error);
    return false;
  }
}

/** The readings taken after `afterTime` (ms), oldest first. */
export async function readSnapshots(afterTime = 0) {
  const native = getNative();

  if (!native) {
    return [];
  }

  try {
    const parsed = JSON.parse((await native.readSnapshots(afterTime)) || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    warn("readSnapshots", error);
    return [];
  }
}

/** Forgets the readings older than `beforeTime` (ms). */
export async function trimSnapshots(beforeTime) {
  const native = getNative();

  if (!native) {
    return;
  }

  try {
    await native.trimSnapshots(beforeTime);
  } catch (error) {
    warn("trimSnapshots", error);
  }
}
