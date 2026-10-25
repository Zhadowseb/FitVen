import { Platform } from "react-native";

import { healthWalkRepository, locationRepository, workoutRepository } from "../Repository";
import { STARTED_FROM } from "../Utils/startedFrom";
import { pickWalksToImport, walkNumbers, windowStartMs } from "../Utils/watchWalks";
import * as healthWorkoutsService from "./healthWorkoutsService";
import * as programService from "./programService";
import * as walkService from "./walkService";
import { withTransaction } from "./shared";

// A walk recorded with a watch - or any health app - is found in Health Connect
// and OFFERED to the person ("A walk was found on your phone. Add it to
// FitVen?"); it only becomes a walk when they say yes. The steps and the
// distance come from Health Connect, which has already put the watch and the
// phone together; the route is fetched when the person asks for it, because
// Health Connect asks them for each one.
//
// Only if they have said yes to FitVen reading them (the switch on the Steps
// page), only on Android and only walks they started - see Utils/watchWalks.js
// for which sessions are offered. A walk tracked in FitVen is never touched or
// doubled: its own numbers are the ones, and a session on top of it is not
// offered. An answer is remembered, so a walk is asked about once: "Add" makes
// it a walk, "Skip" is "do not ask about this one", and "Not now" is only the
// prompt closing for this time (the prompt, Resources/Components/WatchWalkPrompt).
//
// A walk made this way is finished, like one tracked here: it is in the
// calendar and the statistics, syncs like any workout, and its steps are
// already inside the day's steps (they are the phone's own count), so nothing
// is added to them.

const dateOf = (ms) => {
  const date = new Date(ms);

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
};

/** Whether this phone can have walks from a watch, and whether the person has said yes. */
export async function getWatchWalkState(db) {
  if (Platform.OS !== "android") {
    return { access: "unavailable", enabled: false };
  }

  const [access, enabled] = await Promise.all([
    healthWorkoutsService.getWatchWalkAccess(),
    healthWalkRepository.getWatchWalksEnabled(db),
  ]);

  return { access, enabled: enabled && access === "granted" };
}

/** The yes: asks Health Connect, and looks for walks at once if it said yes. */
export async function enableWatchWalks(db, { now = Date.now() } = {}) {
  const access = await healthWorkoutsService.requestWatchWalkAccess();

  if (access !== "granted") {
    return { access, enabled: false, found: 0 };
  }

  await healthWalkRepository.setWatchWalksEnabled(db, true);

  const found = await refreshPendingWatchWalks(db, { now });

  return { access, enabled: true, found: found.length };
}

/** The walks already in FitVen stay; no new ones are offered. */
export async function disableWatchWalks(db) {
  await healthWalkRepository.setWatchWalksEnabled(db, false);
  setPending([]);
}

/* ------------------------------------------------------------ the offer -- */

let pending = [];
const listeners = new Set();

function setPending(next) {
  pending = next;
  listeners.forEach((listener) => listener(pending));
}

/** The walks that have been found and not answered yet. */
export function getPendingWatchWalks() {
  return pending;
}

/** Calls `listener` with the pending walks every time they change. Returns the way to stop. */
export function subscribePendingWatchWalks(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Looks in Health Connect for walks nobody has answered, with their distance and
 * steps: [{ hcId, startMs, endMs, durationSeconds, origin, distanceMeters, steps }].
 * Empty when it is not switched on or Health Connect cannot be read. Never throws.
 */
export async function findNewWatchWalks(db, { now = Date.now() } = {}) {
  try {
    const state = await getWatchWalkState(db);

    if (!state.enabled) {
      return null;
    }

    const fromMs = windowStartMs(now);
    const sessions = await healthWorkoutsService.readExerciseSessions({ fromMs, toMs: now });

    if (sessions === null) {
      return null;
    }

    const existing = await healthWalkRepository.getExistingWalkWindows(db, { fromMs, toMs: now });
    const found = [];

    for (const walk of pickWalksToImport({ sessions, existing })) {
      const totals = await healthWorkoutsService.readWalkTotals({
        startMs: walk.startMs,
        endMs: walk.endMs,
      });

      found.push({ ...walk, distanceMeters: totals.distanceMeters, steps: totals.steps });
    }

    return found;
  } catch (error) {
    console.warn("Could not look for walks from the watch:", error);
    return null;
  }
}

let refreshing = null;

/**
 * Looks again and publishes what it finds to whoever listens (the prompt). A
 * look that could not be done leaves what was there. Resolves to the pending walks.
 */
export function refreshPendingWatchWalks(db, { now = Date.now() } = {}) {
  if (refreshing) {
    return refreshing;
  }

  refreshing = (async () => {
    try {
      const found = await findNewWatchWalks(db, { now });

      if (found !== null) {
        setPending(found);
      }

      return pending;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

const without = (walks, answered) => {
  const ids = new Set(answered.map((walk) => walk.hcId));

  return walks.filter((walk) => !ids.has(walk.hcId));
};

async function createWalk(db, walk) {
  const numbers = walkNumbers({
    durationSeconds: walk.durationSeconds,
    distanceMeters: walk.distanceMeters,
    steps: walk.steps,
  });

  const created = await programService.createQuickWorkout(db, {
    date: dateOf(walk.startMs),
    workoutType: "Walk",
    label: null,
    // Not a screen the person started it from: the cloud column has no value for
    // a watch, and "other" is the one for anything else.
    startedFrom: STARTED_FROM.OTHER,
  });

  // Not setWorkoutOriginalStartTime of the service: that starts a centre match
  // that asks for the position, and this walk was not started here.
  await workoutRepository.setWorkoutOriginalStartTime(db, {
    workoutId: created.workout_id,
    startTime: Math.floor(walk.startMs / 1000),
  });

  await walkService.finishWalk(db, {
    workoutId: created.workout_id,
    distanceMeters: numbers.distanceMeters,
    movingSeconds: numbers.movingSeconds,
    steps: numbers.steps,
  });

  await healthWalkRepository.insertImportedWalk(db, {
    hcId: walk.hcId,
    workoutId: created.workout_id,
    startMs: walk.startMs,
    endMs: walk.endMs,
    origin: walk.origin,
    importedAt: Date.now(),
    status: "imported",
  });

  return created.workout_id;
}

/** "Add": makes the walks into walks. Resolves to the ids of the walks it made. */
export async function addWatchWalks(db, walks) {
  const made = [];

  for (const walk of walks) {
    try {
      made.push(await createWalk(db, walk));
      setPending(without(pending, [walk]));
    } catch (error) {
      // This one stays on offer; the others go on.
      console.warn("Could not add a walk from the watch:", error);
    }
  }

  return made;
}

/** "Skip": do not ask about these walks again. Nothing is made. */
export async function skipWatchWalks(db, walks) {
  for (const walk of walks) {
    await healthWalkRepository.insertImportedWalk(db, {
      hcId: walk.hcId,
      workoutId: null,
      startMs: walk.startMs,
      endMs: walk.endMs,
      origin: walk.origin,
      importedAt: Date.now(),
      status: "dismissed",
    });
  }

  setPending(without(pending, walks));
}

/* ------------------------------------------------------------- the route -- */

/** Whether a walk came from a watch, and whether its route has been fetched. */
export async function getWatchWalkOrigin(db, workoutId) {
  const row = await healthWalkRepository.getImportedWalkByWorkout(db, workoutId);

  return row ? { hcId: row.hc_id, routeLoaded: row.route_loaded === 1 } : null;
}

/**
 * Asks Health Connect for the route of a walk (it asks the person) and keeps
 * it with the walk, on the phone only, where the route of a walk tracked here
 * is. Resolves to the number of points, 0 when there is none or the person said
 * no.
 */
export async function loadWatchWalkRoute(db, workoutId) {
  const origin = await getWatchWalkOrigin(db, workoutId);

  if (!origin) {
    return 0;
  }

  const points = await healthWorkoutsService.readSessionRoute(origin.hcId);

  if (!points || points.length === 0) {
    return 0;
  }

  await withTransaction(db, async () => {
    await locationRepository.deleteLocationLogsByWorkout(db, workoutId);

    for (const point of points) {
      await locationRepository.createLocationLog(db, {
        workoutId,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        timestamp: point.timestamp,
      });
    }

    await healthWalkRepository.markRouteLoaded(db, origin.hcId);
  });

  return points.length;
}
