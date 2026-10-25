// Keeps the workout post that is going out - or has failed - across a restart of
// the app (Utils/workoutPostEvents.js says what is kept), and gives it back as
// "failed, try again" when the app opens: a post lives in module memory, so an
// app the system closed while a post was in the queue used to lose it without a
// word, and the workout was never shared. Once per launch, from Home's bar.
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getWorkoutPostStatus,
  pendingPostRecord,
  restoredPostStatus,
  setWorkoutPostStatus,
  subscribeWorkoutPost,
} from "@utils/workoutPostEvents";

const STORAGE_KEY = "fitven.pendingWorkoutPost";

let started = false;

function databaseKeyOf(db) {
  return typeof db?.databasePath === "string" && db.databasePath ? db.databasePath : null;
}

export async function keepWorkoutPostAcrossRestarts(db) {
  if (started) {
    return;
  }

  started = true;

  const database = databaseKeyOf(db);

  try {
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "null");
    const restored = restoredPostStatus(stored, database);

    if (restored && !getWorkoutPostStatus()) {
      setWorkoutPostStatus(restored);
    } else if (stored && !restored) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not read the workout post that was pending:", error);
  }

  subscribeWorkoutPost((status) => {
    const record = pendingPostRecord(status, database);

    const write = record
      ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record))
      : AsyncStorage.removeItem(STORAGE_KEY);

    write.catch((error) => {
      console.warn("Could not keep the workout post:", error);
    });
  });
}
