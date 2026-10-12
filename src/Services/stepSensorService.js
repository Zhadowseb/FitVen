import * as StepSensor from "../../modules/step-sensor";
import { stepsRepository } from "../Repository";
import { incrementsFromReadings } from "../Utils/stepSensor";
import { withTransaction } from "./shared";

// The phone's own step counter (Android), as the last of the three step sources:
// for the days no health app has a number for, so nobody has to install
// anything to see their steps.
//
// The counter is hardware and keeps counting while the app is closed. A job the
// system runs every fifteen minutes (modules/step-sensor) takes a reading and
// keeps it; the app takes one when it opens. Here the readings since the last
// one that was counted are turned into steps for each day
// (Utils/stepSensor.js), added to Sensor_Steps, and the reading they were
// counted up to is remembered in the same transaction - so a reading is never
// counted twice, whatever the app was doing when it was killed.
//
// Nothing here asks for a permission. Asking is the Allow on the steps card
// (stepsService.requestStepsAccess), and until the person has said yes nothing
// is read.

// A reading older than this is no longer needed on the native side; the one JS
// counts from is kept here, in the anchor.
const KEEP_READINGS_MS = 24 * 60 * 60 * 1000;

/** This build has the module and the phone has a step counter. */
export function isSensorAvailable() {
  return StepSensor.isAvailable();
}

/** The activity-recognition permission the counter needs has been given. */
export function hasSensorPermission() {
  return StepSensor.hasPermission();
}

/** Counting is possible right now: a sensor, and the permission for it. */
export function canCountSteps() {
  return StepSensor.isAvailable() && StepSensor.hasPermission();
}

/** Starts the periodic read while the app is closed (asking again changes nothing). */
export async function ensureSensorRecording() {
  if (!canCountSteps()) {
    return false;
  }

  return StepSensor.startRecording();
}

/** Stops the periodic read, when something better is giving the steps. */
export async function stopSensorRecording() {
  if (await StepSensor.isRecording()) {
    await StepSensor.stopRecording();
  }
}

/**
 * Takes a reading now and counts every reading since the last one that was
 * counted. Resolves to { touchedFrom } - the oldest day that got steps this
 * time, which can be days back when the app has not been opened for a while -
 * or null when there is nothing to count with.
 */
export async function collectSensorSteps(db) {
  if (!canCountSteps()) {
    return null;
  }

  await StepSensor.readNow();

  const anchor = await stepsRepository.getSensorAnchor(db);
  const readings = await StepSensor.readSnapshots(anchor?.time ?? 0);
  const { days, anchor: next } = incrementsFromReadings(readings, anchor);

  if (!next) {
    return { touchedFrom: null };
  }

  await withTransaction(db, async () => {
    await stepsRepository.addSensorSteps(db, days);
    await stepsRepository.setSensorAnchor(db, next);
  });

  await StepSensor.trimSnapshots(next.time - KEEP_READINGS_MS);

  const touched = Object.keys(days).sort();

  return { touchedFrom: touched.length > 0 ? touched[0] : null };
}

/**
 * The steps the sensor has counted for each day from `fromIso` to `toIso`, as
 * { "2026-10-05": 6482 }. null when there is nothing to count with, so the
 * caller can tell that from a quiet week. Reads what has been counted; the
 * counting is collectSensorSteps.
 */
export async function readSensorDailySteps(db, fromIso, toIso) {
  if (!canCountSteps()) {
    return null;
  }

  const rows = await stepsRepository.getSensorDays(db, { fromIso, toIso });

  return Object.fromEntries(rows.map((row) => [row.day, Math.round(row.steps)]));
}
