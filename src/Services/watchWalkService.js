import { Platform } from "react-native";

import { healthWalkRepository, locationRepository, workoutRepository } from "../Repository";
import { STARTED_FROM } from "../Utils/startedFrom";
import { importFromMs, pickWalksToImport, walkNumbers } from "../Utils/watchWalks";
import * as healthWorkoutsService from "./healthWorkoutsService";
import * as programService from "./programService";
import * as walkService from "./walkService";
import { withTransaction } from "./shared";

// Walks recorded with a watch - or any health app - become walks in FitVen, so
// the person who starts their walks on the watch has them next to the ones they
// start here. The steps and the distance come from Health Connect, which has
// already put the watch and the phone together; the route is fetched when the
// person asks for it, because Health Connect asks them for each one.
//
// Only if they have said yes (the switch on the Steps page), only on Android
// and only walks they started - see Utils/watchWalks.js for which sessions
// count. A walk tracked in FitVen is never touched or doubled: its own
// numbers are the ones, and a session on top of it is skipped.
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

/** The yes: asks Health Connect, and reads the walks at once if it said yes. */
export async function enableWatchWalks(db) {
  const access = await healthWorkoutsService.requestWatchWalkAccess();

  if (access !== "granted") {
    return { access, enabled: false, imported: 0 };
  }

  await healthWalkRepository.setWatchWalksEnabled(db, true);

  const imported = await importWatchWalks(db);

  return { access, enabled: true, imported };
}

/** The walks that are already in FitVen stay; no new ones are read. */
export async function disableWatchWalks(db) {
  await healthWalkRepository.setWatchWalksEnabled(db, false);
}

async function importOne(db, walk, totals) {
  const numbers = walkNumbers({
    durationSeconds: walk.durationSeconds,
    distanceMeters: totals.distanceMeters,
    steps: totals.steps,
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
  });

  return created.workout_id;
}

let importing = null;

/**
 * Reads the walks since the last time (the first time, a couple of weeks) and
 * makes the new ones into walks. Resolves to how many it made; 0 when it is not
 * switched on, there is nothing to read or Health Connect cannot be read.
 * Never throws: the steps do not wait for it.
 */
export function importWatchWalks(db, { now = Date.now() } = {}) {
  if (importing) {
    return importing;
  }

  importing = (async () => {
    try {
      const state = await getWatchWalkState(db);

      if (!state.enabled) {
        return 0;
      }

      const lastImportAt = await healthWalkRepository.getLastImportAt(db);
      const fromMs = importFromMs({ lastImportMs: lastImportAt, now });
      const sessions = await healthWorkoutsService.readExerciseSessions({ fromMs, toMs: now });

      if (sessions === null) {
        return 0;
      }

      const existing = await healthWalkRepository.getExistingWalkWindows(db, {
        fromMs,
        toMs: now,
      });
      const picks = pickWalksToImport({ sessions, existing });
      let made = 0;

      for (const walk of picks) {
        const totals = await healthWorkoutsService.readWalkTotals({
          startMs: walk.startMs,
          endMs: walk.endMs,
        });

        await importOne(db, walk, totals);
        made += 1;
      }

      await healthWalkRepository.setLastImportAt(db, now);

      return made;
    } catch (error) {
      console.warn("Could not import the walks from the watch:", error);
      return 0;
    } finally {
      importing = null;
    }
  })();

  return importing;
}

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
