// The running strength workout on the lock screen: a Live Activity (and the
// Dynamic Island) on iOS, an ongoing notification on Android. The native side
// draws the card from the state it is given and can change it by itself when
// a button on it is tapped; `src/Services/liveWorkoutService.js` decides what
// it shows, and `src/Utils/liveWorkout.js` builds the state and holds the
// rules both native sides follow.
//
// Optional, so a build without the module - Expo Go, the web, any build made
// before it existed - is just a phone without the card. Nothing here throws:
// the lock screen is a nicety, and a workout must never fail because of it.
import { requireOptionalNativeModule } from "expo";

const native = requireOptionalNativeModule("LiveWorkout");

export const LIVE_WORKOUT_ACTION_EVENT = "onLiveWorkoutAction";

function warn(what, error) {
  console.warn(`LiveWorkout.${what} failed:`, error);
}

/** Whether a card can be shown on this phone right now. */
export function isSupported() {
  if (!native) {
    return false;
  }

  try {
    return Boolean(native.isSupported());
  } catch (error) {
    warn("isSupported", error);
    return false;
  }
}

/** Replaces whatever card there is with one for `state`. */
export async function start(state) {
  if (!native) {
    return false;
  }

  try {
    return Boolean(await native.start(JSON.stringify(state)));
  } catch (error) {
    warn("start", error);
    return false;
  }
}

/**
 * Redraws the card for `state.workoutId`. On iOS a card the user swiped away
 * stays away and this answers false; on Android the notification is posted
 * again.
 */
export async function update(state) {
  if (!native) {
    return false;
  }

  try {
    return Boolean(await native.update(JSON.stringify(state)));
  } catch (error) {
    warn("update", error);
    return false;
  }
}

/** Takes the card away at once, with what it had queued. */
export async function end() {
  if (!native) {
    return;
  }

  try {
    await native.end();
  } catch (error) {
    warn("end", error);
  }
}

/** The buttons tapped since the last call, oldest first. */
export async function drainActions() {
  if (!native) {
    return [];
  }

  try {
    const parsed = JSON.parse((await native.drainActions()) || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    warn("drainActions", error);
    return [];
  }
}

/**
 * Called when a button on the card has queued something. It is a wake-up,
 * not the action: drain the queue to get it, so an action is never handled
 * twice.
 */
export function addActionListener(listener) {
  if (!native || typeof listener !== "function") {
    return { remove() {} };
  }

  try {
    return native.addListener(LIVE_WORKOUT_ACTION_EVENT, listener);
  } catch (error) {
    warn("addActionListener", error);
    return { remove() {} };
  }
}

export default {
  isSupported,
  start,
  update,
  end,
  drainActions,
  addActionListener,
};
