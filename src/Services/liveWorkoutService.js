// The running strength workout on the lock screen - a Live Activity on iOS, an
// ongoing notification on Android - kept in step with the workout.
//
// It does not follow the screens. It rebuilds the card from the database
// whenever something could have changed it - a set ticked off, a set or an
// exercise edited, the workout started, paused, finished, reset or deleted
// (workoutDataEvents), the rest timer, the app coming back - and the card
// shows whatever the one running strength workout looks like then. So a card
// can never outlive its workout because some screen forgot to say goodbye.
//
// The buttons on the card change it by themselves at once (the native side
// follows `applyLiveWorkoutAction` in Utils/liveWorkout) and queue what was
// tapped. This drains the queue - the moment the app hears about it, or the
// next time it comes to the front - and does the real thing: the same writes
// a tap on the workout screen makes.
//
// Mounted once, by Sync/LiveWorkoutSync. Nothing in it may throw at a caller:
// the lock screen is a nicety, and a workout must never fail because of it.
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatNumber, subscribeToLanguage, t } from "@localization";
import { weightliftingRepository, workoutRepository } from "@repository";
import {
  LIVE_STRENGTH_WORKOUT_TYPES,
  LIVE_WORKOUT_MAX_SECONDS,
  LIVE_WORKOUT_VIEW_ACTION_MAX_AGE_SECONDS,
  buildLiveWorkoutState,
  groupLiveWorkoutRows,
  resolveLiveFocus,
} from "@utils/liveWorkout";
import {
  adjustActiveRestTimer,
  clearActiveRestTimer,
  getActiveRestTimer,
  startActiveRestTimer,
  subscribeRestTimer,
} from "@utils/restTimerEvents";
import { getCurrentStoredTimestampSeconds, normalizeStoredTimestampSeconds } from "@utils/timeUtils";
import { subscribeWorkoutDataChanges } from "@utils/workoutDataEvents";
import { subscribeWorkoutSetChanges } from "@utils/workoutSetEvents";
import LiveWorkout from "../../modules/live-workout";
import * as notificationService from "./notificationService";
import * as weightliftingService from "./weightliftingService";

// Profile → Notifications → "Show the workout on the lock screen". On this
// phone only: the card is this phone's.
const ENABLED_STORAGE_KEY = "fitven.liveWorkout.lockScreen";
// Which workout the card was last started for. `update` never brings back a
// card somebody swiped away on iOS, so a card is started once per workout -
// and remembering it across launches keeps a relaunch from starting it again.
const STARTED_FOR_STORAGE_KEY = "fitven.liveWorkout.startedFor";
// Every change a set makes arrives as several signals - the set, its
// exercise, the workout, the rest timer - within a few milliseconds.
const UPDATE_DEBOUNCE_MS = 300;

let controller = null;
let enabledCache = null;

async function readEnabled() {
  if (enabledCache !== null) {
    return enabledCache;
  }

  try {
    const stored = await AsyncStorage.getItem(ENABLED_STORAGE_KEY);
    enabledCache = stored === null ? true : stored === "1";
  } catch (error) {
    console.warn("Could not read the lock-screen setting:", error);
    enabledCache = true;
  }

  return enabledCache;
}

async function readStartedFor() {
  try {
    return await AsyncStorage.getItem(STARTED_FOR_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeStartedFor(workoutId) {
  try {
    if (workoutId === null) {
      await AsyncStorage.removeItem(STARTED_FOR_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STARTED_FOR_STORAGE_KEY, String(workoutId));
    }
  } catch (error) {
    console.warn("Could not remember the lock-screen card:", error);
  }
}

/** Whether this phone can show the card at all: the build has it, and on iOS Live Activities are on. */
export function isLockScreenCardSupported() {
  return LiveWorkout.isSupported();
}

/** The setting, on by default. */
export async function getLockScreenCardEnabled() {
  return readEnabled();
}

export async function setLockScreenCardEnabled(enabled) {
  const next = Boolean(enabled);

  enabledCache = next;

  try {
    await AsyncStorage.setItem(ENABLED_STORAGE_KEY, next ? "1" : "0");
  } catch (error) {
    console.warn("Could not save the lock-screen setting:", error);
  }

  // Switched back on in the middle of a workout: the card comes back for it.
  if (next) {
    await writeStartedFor(null);
  }

  controller?.reconcileNow();

  return next;
}

/**
 * The strength workout the card is about: started, not finished, and started
 * less than eight hours ago - a paused one left behind yesterday is not being
 * trained. Newest start first.
 */
async function findLiveWorkout(db, nowSeconds) {
  const candidates = await workoutRepository.getOpenStartedWorkoutsOfTypes(db, {
    types: LIVE_STRENGTH_WORKOUT_TYPES,
  });

  return (
    (candidates ?? []).find((row) => {
      const startedAt = normalizeStoredTimestampSeconds(row.original_start_time);

      return startedAt !== null && nowSeconds - startedAt <= LIVE_WORKOUT_MAX_SECONDS;
    }) ?? null
  );
}

function restSecondsOf(value) {
  const seconds = Math.round(Number(value));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

// --- The controller ---------------------------------------------------------

function createController(db) {
  let stopped = false;
  let chain = Promise.resolve();
  let debounce = null;
  // What the card was last given, so an unchanged state is not sent again.
  let lastJson = null;
  // The workout the card shows, or null. `endedOnce` makes sure a card left
  // over from before the app was killed is taken away on the first look.
  let shownWorkoutId = null;
  let endedOnce = false;
  // Forrige / Næste, and the set ticked off last - which exercise the card is
  // about. Reset when the workout changes.
  let focusWorkoutId = null;
  let recentSetId = null;
  let viewOffset = 0;
  // The scheduled rest-is-over notification: its id, and which rest it is for.
  // Its own chain, so a quick +15, +15 cannot schedule two.
  let restNotification = null;
  let restChain = Promise.resolve();

  // One thing at a time: a drain and a rebuild must not interleave.
  const serial = (task) => {
    chain = chain.then(task).catch((error) => {
      console.error("The lock-screen card failed to update:", error);
    });

    return chain;
  };

  async function endCard() {
    if (shownWorkoutId !== null || !endedOnce) {
      await LiveWorkout.end();
    }

    // Finished, deleted, reset or switched off: the next time this workout
    // runs - a reset one starts again under the same id - it gets a new card.
    if (shownWorkoutId !== null) {
      await writeStartedFor(null);
    }

    shownWorkoutId = null;
    endedOnce = true;
    lastJson = null;
  }

  async function rebuild() {
    if (stopped) {
      return;
    }

    const now = getCurrentStoredTimestampSeconds();
    const enabled = await readEnabled();
    const workout = enabled && LiveWorkout.isSupported() ? await findLiveWorkout(db, now) : null;

    if (!workout) {
      await endCard();
      return;
    }

    const rows = await weightliftingRepository.getLiveWorkoutSets(db, workout.workout_id);

    if (focusWorkoutId !== workout.workout_id) {
      focusWorkoutId = workout.workout_id;
      recentSetId = null;
      viewOffset = 0;
    }

    // Keep the offset to what exists: tapping Næste past the last exercise
    // must not have to be undone by as many Forrige.
    viewOffset = resolveLiveFocus(groupLiveWorkoutRows(rows), { recentSetId, viewOffset }).offset;

    const state = buildLiveWorkoutState(
      {
        workout: {
          workoutId: workout.workout_id,
          workoutType: workout.workout_type,
          timerStart: workout.timer_start,
          elapsedTime: workout.elapsed_time,
        },
        rows,
        restTimer: getActiveRestTimer(),
        focus: { recentSetId, viewOffset },
        now,
      },
      { t, formatNumber }
    );
    const json = JSON.stringify(state);
    const startedFor = await readStartedFor();

    if (startedFor !== String(workout.workout_id)) {
      // Not shown - Live Activities switched off a moment ago, say - is tried
      // again on the next change rather than taken as done.
      if (!(await LiveWorkout.start(state))) {
        return;
      }

      await writeStartedFor(workout.workout_id);
    } else if (json !== lastJson || shownWorkoutId !== workout.workout_id) {
      await LiveWorkout.update(state);
    }

    lastJson = json;
    shownWorkoutId = workout.workout_id;
    endedOnce = true;
  }

  function rebuildSoon() {
    if (stopped) {
      return;
    }

    clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      serial(rebuild);
    }, UPDATE_DEBOUNCE_MS);
  }

  function rebuildNow() {
    clearTimeout(debounce);
    debounce = null;

    return serial(rebuild);
  }

  // What a tap on the workout screen does, done for a tap on the card.
  async function completeSet(action, workout, now) {
    const setId = Number(action.setId);
    const rows = await weightliftingRepository.getLiveWorkoutSets(db, workout.workout_id);
    const row = rows.find((candidate) => Number(candidate.sets_id) === setId);

    // Gone, or already done - by an earlier drain, or on the workout screen
    // in the meantime. Doing it again would start a second rest.
    if (!row || Number(row.done) === 1) {
      return;
    }

    await weightliftingService.updateStrengthSetDone(db, {
      workoutId: workout.workout_id,
      setId,
      done: 1,
      failed: 0,
      source: "lockScreen",
    });

    recentSetId = setId;
    viewOffset = 0;

    const at = Math.trunc(Number(action.at) || now);
    const restSeconds = restSecondsOf(row.pause);
    const running = normalizeStoredTimestampSeconds(workout.timer_start) !== null;

    // A rest that would already be over - the tap was handled late, when the
    // app came back - is not started.
    if (running && restSeconds > 0 && at + restSeconds > now) {
      startActiveRestTimer({
        setId,
        exerciseId: Number(row.exercise_instance_id),
        exerciseName: row.exercise_name,
        setNumber: row.set_number,
        durationSeconds: restSeconds,
        workoutId: workout.workout_id,
        startedAt: at,
        navigationTarget: {
          workout_id: workout.workout_id,
          workout_label: workout.label ?? workout.workout_type,
          workout_type: workout.workout_type,
          date: workout.date,
        },
      });
    }
  }

  async function handle(action, workout, now) {
    const ownRest = () => {
      const timer = getActiveRestTimer();

      return timer && Number(timer.workoutId) === Number(workout.workout_id) ? timer : null;
    };

    switch (action?.type) {
      case "completeSet":
        await completeSet(action, workout, now);
        return;

      case "skipRest": {
        const timer = ownRest();

        if (timer) {
          clearActiveRestTimer(timer.id);
        }

        return;
      }

      case "adjustRest": {
        const timer = ownRest();

        if (timer) {
          adjustActiveRestTimer(action.seconds, timer.id);
        }

        return;
      }

      case "prev":
      case "next": {
        const age = now - (Number(action.at) || 0);

        if (age <= LIVE_WORKOUT_VIEW_ACTION_MAX_AGE_SECONDS) {
          viewOffset += action.type === "next" ? 1 : -1;
        }

        return;
      }

      default:
        return;
    }
  }

  async function drain() {
    if (stopped) {
      return;
    }

    const actions = await LiveWorkout.drainActions();

    if (!actions.length) {
      return;
    }

    const now = getCurrentStoredTimestampSeconds();
    const workout = await findLiveWorkout(db, now);

    // The workout was finished or deleted before the tap was handled: there
    // is nothing left to tick off.
    if (!workout) {
      return;
    }

    for (const action of actions) {
      try {
        await handle(action, workout, now);
      } catch (error) {
        console.error(`Could not handle "${action?.type}" from the lock screen:`, error);
      }
    }

    await rebuild();
  }

  const drainNow = () => serial(drain);

  // The rest-is-over notification: the card counts the rest down by itself,
  // but a phone face down on a bench needs a sound. notificationService
  // schedules it; this moves or cancels it with the rest.
  async function moveRestNotification(timer) {
    const enabled = await readEnabled();
    const key = timer ? `${timer.id}:${timer.endsAt}` : null;

    if (restNotification?.key === key) {
      return;
    }

    if (restNotification) {
      const { id } = restNotification;

      restNotification = null;

      try {
        await notificationService.cancelScheduledNotification(id);
      } catch (error) {
        console.warn("Could not cancel the rest notification:", error);
      }
    }

    const secondsLeft = timer ? timer.endsAt - getCurrentStoredTimestampSeconds() : 0;

    if (!timer || !enabled || stopped || secondsLeft < 3) {
      return;
    }

    try {
      const id = await notificationService.scheduleRestFinishedNotification({
        endsAt: timer.endsAt,
        workoutId: timer.workoutId ?? null,
      });

      if (id) {
        restNotification = { id, key };
      }
    } catch (error) {
      console.warn("Could not schedule the rest notification:", error);
    }
  }

  const syncRestNotification = (timer) => {
    restChain = restChain.then(() => moveRestNotification(timer)).catch(() => {});
  };

  const unsubscribers = [
    subscribeWorkoutDataChanges(rebuildSoon),
    subscribeWorkoutSetChanges((change) => {
      if (!change) {
        return;
      }

      // Ticked off on the workout screen: the card follows it there, and
      // Forrige / Næste are forgotten.
      if (change.done && Number(change.workoutId) === Number(focusWorkoutId)) {
        recentSetId = change.setId;
        viewOffset = 0;
      }

      rebuildSoon();
    }),
    subscribeRestTimer((timer) => {
      syncRestNotification(timer);
      rebuildSoon();
    }),
    // The card's words are translated when it is built.
    subscribeToLanguage(() => {
      lastJson = null;
      rebuildSoon();
    }),
  ];

  const actionSubscription = LiveWorkout.addActionListener(() => {
    drainNow();
  });

  const appStateSubscription = AppState.addEventListener("change", (next) => {
    if (next === "active") {
      // Taps from while the app was away first, so the card is rebuilt once
      // with them in it.
      drainNow();
      rebuildNow();
    } else if (next === "background" && debounce) {
      // Leaving with an update still waiting: send it before JavaScript is
      // paused.
      rebuildNow();
    }
  });

  drainNow();
  rebuildNow();

  return {
    reconcileNow: rebuildNow,
    stop() {
      stopped = true;
      clearTimeout(debounce);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      actionSubscription.remove();
      appStateSubscription.remove();

      syncRestNotification(null);

      // Signed out, or another account's database: this card is not theirs,
      // and the next one is started afresh.
      chain = chain
        .then(async () => {
          await LiveWorkout.end();
          await writeStartedFor(null);
        })
        .catch(() => {});
    },
  };
}

/**
 * Starts keeping the card in step with `db`'s running workout. Returns the
 * function that stops it and takes the card away.
 */
export function startLiveWorkoutController(db) {
  controller?.stop();
  controller = createController(db);

  const own = controller;

  return () => {
    own.stop();

    if (controller === own) {
      controller = null;
    }
  };
}
