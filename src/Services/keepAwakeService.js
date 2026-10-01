import AsyncStorage from "@react-native-async-storage/async-storage";

// The sun in a strength workout's header: keep the screen on while the
// workout runs. On this phone only, like the lock-screen card, and off until
// somebody turns it on - then it stays on for the next workout too.
//
// Only the choice lives here. Holding the screen on is the screen's job
// (useWorkoutKeepAwake beside Resistance.js), because it depends on whether
// the workout is running and whether the screen is in front - and because
// expo-keep-awake is native, and the services load in the Node tests.
const ENABLED_STORAGE_KEY = "fitven.workout.keepAwake";

let enabledCache = null;

/** The setting, off by default. */
export async function getKeepAwakeEnabled() {
  if (enabledCache !== null) {
    return enabledCache;
  }

  try {
    const stored = await AsyncStorage.getItem(ENABLED_STORAGE_KEY);
    enabledCache = stored === "1";
  } catch (error) {
    console.warn("Could not read the keep-screen-on setting:", error);
    enabledCache = false;
  }

  return enabledCache;
}

export async function setKeepAwakeEnabled(enabled) {
  const next = Boolean(enabled);

  enabledCache = next;

  try {
    await AsyncStorage.setItem(ENABLED_STORAGE_KEY, next ? "1" : "0");
  } catch (error) {
    console.warn("Could not save the keep-screen-on setting:", error);
  }

  return next;
}
