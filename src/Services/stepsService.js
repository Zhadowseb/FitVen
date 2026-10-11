import AsyncStorage from "@react-native-async-storage/async-storage";

import { runningRepository, workoutRepository } from "../Repository";
import { buildDay, datesBetween, localIsoDate } from "../Utils/dailySteps";
import { LIVE_STRENGTH_WORKOUT_TYPES } from "../Utils/liveWorkout";
import { getTargetSteps, normalizeTargetZoneId } from "../Utils/stepZones";
import * as healthStepsService from "./healthStepsService";

// The steps of a day, as FitVen shows them: the phone's own count (Apple
// Health / Health Connect), with the finished strength workouts added on top as
// step equivalents. The walks only say how much of the phone's number was
// "Walks" rather than "Everyday" - their steps are in the phone's count already
// and are never added to it (Utils/dailySteps.js).
//
// Nothing is stored here: the phone keeps the history, the workouts are in the
// database, and the training part is computed, so changing the rate or the
// "Count training as steps" switch recomputes every day at once.

const COUNT_TRAINING_KEY = "fitven.steps.countTraining";
const TARGET_KEY = "fitven.steps.target";
const CACHE_MS = 20000;

const STRENGTH_TYPES = [...LIVE_STRENGTH_WORKOUT_TYPES];

let cache = null;

/* -------------------------------------------------------------- settings -- */

/** "Count training as steps" is on until somebody turns it off. */
export async function getStepsSettings() {
  try {
    const [countTraining, target] = await Promise.all([
      AsyncStorage.getItem(COUNT_TRAINING_KEY),
      AsyncStorage.getItem(TARGET_KEY),
    ]);
    const targetZoneId = normalizeTargetZoneId(target);

    return {
      countTraining: countTraining === null ? true : countTraining === "1",
      targetZoneId,
      targetSteps: getTargetSteps(targetZoneId),
    };
  } catch (error) {
    console.warn("Could not read the steps settings:", error);

    return {
      countTraining: true,
      targetZoneId: normalizeTargetZoneId(null),
      targetSteps: getTargetSteps(null),
    };
  }
}

export async function setCountTraining(enabled) {
  try {
    await AsyncStorage.setItem(COUNT_TRAINING_KEY, enabled ? "1" : "0");
  } catch (error) {
    console.warn("Could not save the steps setting:", error);
  }
}

export async function setTargetZone(zoneId) {
  try {
    await AsyncStorage.setItem(TARGET_KEY, normalizeTargetZoneId(zoneId));
  } catch (error) {
    console.warn("Could not save the steps target:", error);
  }
}

/* ---------------------------------------------------------------- access -- */

export function getStepsAccess() {
  return healthStepsService.getHealthStepsStatus();
}

/** Asks for the steps, and forgets what was read, so the answer shows at once. */
export async function requestStepsAccess() {
  const status = await healthStepsService.requestHealthStepsAccess();

  cache = null;

  return status;
}

export function openStepsSettings() {
  return healthStepsService.openHealthSettings();
}

/* ------------------------------------------------------------------ days -- */

async function readRows(db, { fromIso, toIso }) {
  const key = `${fromIso}:${toIso}`;

  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.rows;
  }

  const [phone, walks, workouts] = await Promise.all([
    healthStepsService.readDailySteps(fromIso, toIso),
    runningRepository.getWalkTotalsByDay(db, { fromIso, toIso }),
    workoutRepository.getFinishedWorkoutsOfTypesBetween(db, {
      types: STRENGTH_TYPES,
      fromIso,
      toIso,
    }),
  ]);
  const walkByDate = new Map(walks.map((row) => [row.date, row]));
  const workoutsByDate = new Map();

  for (const workout of workouts) {
    workoutsByDate.set(workout.date, [
      ...(workoutsByDate.get(workout.date) ?? []),
      {
        id: workout.workout_id,
        label: workout.label,
        type: workout.workout_type,
        seconds: Number(workout.elapsed_time) || 0,
      },
    ]);
  }

  const rows = {
    hasPhoneSource: phone !== null,
    days: datesBetween(fromIso, toIso).map((date) => ({
      date,
      phoneSteps: phone === null ? null : phone[date] ?? 0,
      walkSteps: Number(walkByDate.get(date)?.steps) || 0,
      walkDistanceKm: Number(walkByDate.get(date)?.distance_km) || 0,
      workouts: workoutsByDate.get(date) ?? [],
    })),
  };

  cache = { key, at: Date.now(), rows };

  return rows;
}

/**
 * The days from `fromIso` to `toIso` (a day in the future is left out), built
 * the way the settings say. `hasPhoneSource` is false when there is no health
 * app to read, so a screen can say that instead of showing a quiet week.
 */
export async function loadStepDays(db, { fromIso, toIso, countTraining = true, theme }) {
  const today = localIsoDate();
  const rows = await readRows(db, { fromIso, toIso: toIso > today ? today : toIso });

  return {
    hasPhoneSource: rows.hasPhoneSource,
    days: rows.days.map((row) => buildDay(row, { countTraining, theme })),
  };
}

export function clearStepsCache() {
  cache = null;
}
