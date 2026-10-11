import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { runningRepository, stepsRepository, workoutRepository } from "../Repository";
import {
  addDays,
  buildDay,
  datesBetween,
  localIsoDate,
  startOfWeek,
  weeklyWalkedAverages,
} from "../Utils/dailySteps";
import { LIVE_STRENGTH_WORKOUT_TYPES } from "../Utils/liveWorkout";
import { getTargetSteps, normalizeTargetZoneId } from "../Utils/stepZones";
import * as dailyStepsService from "./dailyStepsService";
import * as healthStepsService from "./healthStepsService";
import * as stepCounterService from "./stepCounterService";
import * as stepSensorService from "./stepSensorService";

// The steps of a day, as FitVen shows them: the day's kept number (the phone's
// own count - its health app, its motion history or, on Android with neither,
// FitVen's own sensor count; see dailyStepsService), with the finished strength
// workouts added on top as step equivalents. The walks only say how much of the
// phone's number was "Walks" rather than "Everyday" - their steps are in the
// phone's count already and are never added to it (Utils/dailySteps.js).
//
// The training part is computed, never stored, so changing the rate or the
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

/**
 * Where the steps can come from on this phone, as one answer for the screens:
 * "undetermined" until the person has said yes, "granted" when something can be
 * read, "denied" when they said yes and nothing can be, "unavailable" when
 * there is nothing on this phone to read.
 *
 * On Android the phone's own step sensor is always a way in, so nobody is sent
 * to install a health app: the yes is asked for once, and a health app, if
 * there is one, is used when it has something to say.
 */
export async function getStepsAccess(db) {
  const health = await healthStepsService.getHealthStepsStatus();

  if (Platform.OS !== "android" || !db || !stepSensorService.isSensorAvailable()) {
    return health;
  }

  if (!(await stepsRepository.getStepsEnabled(db))) {
    return "undetermined";
  }

  return health === "granted" || stepSensorService.hasSensorPermission() ? "granted" : "denied";
}

/**
 * Which kind of "no" the screens are looking at: on an Android phone with no
 * health app but a step counter, it is the counter's permission that is missing,
 * and the way to fix it is the app's own settings, not Health Connect.
 */
export async function getStepsAccessKind() {
  if (
    Platform.OS === "android" &&
    stepSensorService.isSensorAvailable() &&
    (await healthStepsService.getHealthStepsStatus()) === "unavailable"
  ) {
    return "sensor";
  }

  return "health";
}

/**
 * Asks for the steps, reads them at once, and forgets what was cached so the
 * answer shows. On an iPhone, Apple Health does not say whether a read was
 * refused - so when a week has no number after the question, the phone's own
 * motion history is asked for instead, the next best source, and only then.
 */
export async function requestStepsAccess(db) {
  // Tapping Allow is the yes: from here the steps are read. Before it, nothing is.
  if (db) {
    await stepsRepository.setStepsEnabled(db);
  }

  await healthStepsService.requestHealthStepsAccess();

  cache = null;

  if (db) {
    await dailyStepsService.refreshRecentDailySteps(db);

    // Android with nothing from a health app this week: FitVen counts with the
    // phone's own step sensor. Its permission is asked once, here, and only
    // then - and the counting starts at once, so the first steps already count.
    if (Platform.OS === "android" && stepSensorService.isSensorAvailable()) {
      const todayIso = localIsoDate();
      const week = await dailyStepsService.readDailyStepRows(db, {
        fromIso: addDays(todayIso, -6),
        toIso: todayIso,
      });

      if (!stepSensorService.hasSensorPermission() && ![...week.values()].some((day) => day.source === "health")) {
        await stepCounterService.requestStepPermission();
      }

      if (stepSensorService.hasSensorPermission()) {
        await dailyStepsService.refreshRecentDailySteps(db);
      }
    }

    if (Platform.OS === "ios") {
      const todayIso = localIsoDate();
      const week = await dailyStepsService.readDailyStepRows(db, {
        fromIso: addDays(todayIso, -6),
        toIso: todayIso,
      });

      if (week.size === 0) {
        const motion = await stepCounterService.requestStepPermission();

        if (motion.status === "granted") {
          await dailyStepsService.refreshDailySteps(db, { fromIso: addDays(todayIso, -6), toIso: todayIso });
        }
      }
    }
  }

  return getStepsAccess(db);
}

export function openStepsSettings(kind = "health") {
  if (kind === "sensor") {
    return Linking.openSettings();
  }

  return healthStepsService.openHealthSettings();
}

/* ------------------------------------------------------------------ days -- */

async function readRows(db, { fromIso, toIso }) {
  const key = `${fromIso}:${toIso}`;

  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.rows;
  }

  // The sources are read into the table (the last few days each time, the
  // history once), and the screens read the table: a day stays when the health
  // app is switched off, and the history of a new phone comes from the cloud.
  await dailyStepsService.refreshRecentDailySteps(db);

  const [kept, walks, workouts] = await Promise.all([
    dailyStepsService.readDailyStepRows(db, { fromIso, toIso }),
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

  // A day nobody has counted is not a day of zero steps - except today, which
  // simply has not had them yet when a source has been answering this week.
  const todayIso = localIsoDate();
  const answeredRecently = [...kept.keys()].some((day) => day >= addDays(todayIso, -6));
  // The step sensor has been counting since it was allowed: today has no steps
  // yet, which is not the same as nothing being counted.
  const sensorCounting =
    stepSensorService.canCountSteps() && (await stepsRepository.getStepsEnabled(db));

  const rows = {
    hasPhoneSource: kept.size > 0 || sensorCounting,
    days: datesBetween(fromIso, toIso).map((date) => ({
      date,
      phoneSource: kept.get(date)?.source ?? null,
      phoneSteps: kept.has(date)
        ? kept.get(date).steps
        : date === todayIso && (answeredRecently || sensorCounting)
          ? 0
          : null,
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

/**
 * What the Home card needs: the access, the settings, today, and whether the
 * phone has said anything in the last week. iOS does not tell a refusal from a
 * quiet week, so a week without a single step reads as "no data" - the card
 * then asks instead of showing a zero as if it were real.
 */
export async function loadHomeSteps(db, { theme } = {}) {
  const [status, kind, settings] = await Promise.all([getStepsAccess(db), getStepsAccessKind(), getStepsSettings()]);
  const today = localIsoDate();
  const { days, hasPhoneSource } = await loadStepDays(db, {
    fromIso: addDays(today, -6),
    toIso: today,
    countTraining: settings.countTraining,
    theme,
  });

  return {
    status,
    kind,
    settings,
    today: days[days.length - 1],
    hasPhoneSource,
    // Something counted this week, or the sensor counting: either way a zero
    // today is a morning that has not had its steps yet, not a refusal.
    hasPhoneData: days.some((day) => day.source === "phone" && day.walked > 0) || (hasPhoneSource && status === "granted"),
  };
}

/**
 * The Statistics section: the walked steps per day, averaged per week over the
 * last 12 weeks, with the target it is held against. Null when the phone has
 * said nothing in any of them, so the section is left out rather than empty.
 */
export async function loadWeeklySteps(db, { weeks = 12, theme } = {}) {
  const [status, settings] = await Promise.all([getStepsAccess(db), getStepsSettings()]);

  if (status === "undetermined") {
    return null;
  }

  const todayIso = localIsoDate();
  const fromIso = addDays(startOfWeek(todayIso), -7 * (weeks - 1));
  const { days } = await loadStepDays(db, { fromIso, toIso: todayIso, countTraining: false, theme });
  const series = weeklyWalkedAverages(days, { todayIso, weeks });

  return series.some((week) => week.average !== null)
    ? { weeks: series, targetSteps: settings.targetSteps, targetZoneId: settings.targetZoneId }
    : null;
}

export function clearStepsCache() {
  cache = null;
}
