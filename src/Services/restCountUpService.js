// The rest counted up after a set with no rest written - the rules are in
// Utils/restCountUp.js. This runs the one count-up there can be at a time:
// starts it when such a set is ticked off, ends it and writes what it counted
// into that set's rest field, and tells the workout screen and the lock-screen
// card about it.
//
// It is not the rest timer (Utils/restTimerEvents.js): that one feeds the
// bottom menu's square, Home's panel and the "rest is over" reminder, and a
// count-up must reach none of them.
//
// Kept across a restart of the app (AsyncStorage), since iOS can end the app
// while the phone is locked between two sets, and the rest would be lost.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { weightliftingRepository } from "@repository";
import {
  countedRestSeconds,
  plannedRestSeconds,
} from "@utils/restCountUp";
import { getCurrentStoredTimestampSeconds, normalizeStoredTimestampSeconds } from "@utils/timeUtils";
import { notifyLockScreenEdit } from "@utils/workoutDataEvents";
import { syncSetsInBackground } from "./cloudSync/setSync";
import { withTransaction } from "./shared";

const STORAGE_KEY = "fitven.restCountUp";
// A count-up older than this is from a workout left behind, not a rest.
const MAX_AGE_SECONDS = 8 * 60 * 60;

const listeners = new Set();
let active = null;
let restored = false;

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(active);
    } catch (error) {
      console.warn("A rest count-up listener failed:", error);
    }
  });
}

async function persist() {
  try {
    if (active) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(active));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not keep the rest count-up:", error);
  }
}

function setActive(next) {
  active = next;
  emit();
  void persist();
}

function sameId(left, right) {
  return left !== null && left !== undefined && Number(left) === Number(right);
}

/** The count-up running now - `{ id, workoutId, setId, startedAt }` - or null. */
export function getActiveRestCountUp() {
  return active;
}

/** Hears every start and end; called at once with what is running. */
export function subscribeRestCountUp(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  listener(active);

  return () => {
    listeners.delete(listener);
  };
}

/** Takes back a count-up kept from before the app was closed. Once per launch. */
export async function restoreRestCountUp(now = getCurrentStoredTimestampSeconds()) {
  if (restored) {
    return active;
  }

  restored = true;

  try {
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "null");
    const startedAt = Number(stored?.startedAt);

    if (
      !active &&
      stored &&
      Number.isFinite(startedAt) &&
      Number.isFinite(Number(stored.setId)) &&
      now - startedAt >= 0 &&
      now - startedAt <= MAX_AGE_SECONDS
    ) {
      active = {
        id: String(stored.id ?? `${stored.workoutId}:${stored.setId}:${startedAt}`),
        workoutId: Number(stored.workoutId),
        setId: Number(stored.setId),
        startedAt,
        database: typeof stored.database === "string" ? stored.database : null,
      };
      emit();
    } else if (stored && !active) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not read the rest count-up:", error);
  }

  return active;
}

// Which database a count-up was started in. Set ids are per database, and a
// count-up kept across a sign-out must never be written into another
// account's set that happens to have the same id.
function databaseKeyOf(db) {
  return typeof db?.databasePath === "string" && db.databasePath ? db.databasePath : null;
}

/** Starts counting after `setId`, from `startedAt`. Replaces any other. */
export function startRestCountUp({ db = null, workoutId, setId, startedAt }) {
  const at = Number(startedAt);

  if (!Number.isFinite(at) || !Number.isFinite(Number(setId))) {
    return null;
  }

  setActive({
    id: `${workoutId}:${setId}:${at}`,
    workoutId: Number(workoutId),
    setId: Number(setId),
    startedAt: at,
    database: databaseKeyOf(db),
  });

  return active;
}

/**
 * Stops the count-up without writing anything: its set was unticked, the
 * workout was restarted or deleted, or somebody signed out. With `workoutId`
 * or `setId` only one that belongs to them.
 */
export function cancelRestCountUp({ workoutId = null, setId = null } = {}) {
  if (!active) {
    return;
  }

  if (workoutId !== null && !sameId(active.workoutId, workoutId)) {
    return;
  }

  if (setId !== null && !sameId(active.setId, setId)) {
    return;
  }

  setActive(null);
}

/**
 * Ends the count-up at `at` and writes what it counted into its set's rest
 * field - nothing under 15 seconds. The next set ticked off, the workout
 * paused or finished, or "Afslut pause" on the lock screen. With `workoutId`
 * or `setId` only one that belongs to them. Resolves with the seconds written,
 * or null.
 */
export async function finishRestCountUp(
  db,
  { at = getCurrentStoredTimestampSeconds(), workoutId = null, setId = null } = {}
) {
  const countUp = active;

  if (!countUp) {
    return null;
  }

  if (workoutId !== null && !sameId(countUp.workoutId, workoutId)) {
    return null;
  }

  if (setId !== null && !sameId(countUp.setId, setId)) {
    return null;
  }

  setActive(null);

  const seconds = countedRestSeconds(countUp.startedAt, at);
  const database = databaseKeyOf(db);

  if (seconds === null || (countUp.database && database && countUp.database !== database)) {
    return null;
  }

  let written = false;

  try {
    await withTransaction(db, async () => {
      written = await weightliftingRepository.updateCountedRest(db, {
        setId: countUp.setId,
        pause: seconds,
      });
    });
  } catch (error) {
    console.error("Could not save the counted rest:", error);
    return null;
  }

  if (!written) {
    return null;
  }

  syncSetsInBackground(db);
  // The workout screen reads its sets again, so the rest is in the field.
  notifyLockScreenEdit({ workoutId: countUp.workoutId });

  return seconds;
}

/**
 * A set ticked off or unticked - on the workout screen or on the lock screen,
 * at `at`. Called by weightliftingService.updateStrengthSetDone after the
 * write. Ticking any set ends a running count-up (and writes it); ticking a
 * set without a planned rest while the workout clock runs starts one for it;
 * unticking the set being counted after drops it.
 */
export async function handleSetCompletion(
  db,
  { workoutId, setId, done, failed = false, at = getCurrentStoredTimestampSeconds() }
) {
  if (!done) {
    cancelRestCountUp({ setId });
    return;
  }

  // The rest after the set before ends here, in whatever exercise it was.
  await finishRestCountUp(db, { at, workoutId });

  if (failed) {
    return;
  }

  const context = await weightliftingRepository.getSetRestContext(db, setId);

  if (!context || Number(context.workout_done) === 1) {
    return;
  }

  const running = normalizeStoredTimestampSeconds(context.timer_start) !== null;

  if (!running || plannedRestSeconds(context) > 0) {
    return;
  }

  startRestCountUp({ db, workoutId: workoutId ?? context.workout_id, setId, startedAt: at });
}
