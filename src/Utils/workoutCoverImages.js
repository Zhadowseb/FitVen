const DEFAULT_WORKOUT_COVER = require("../Resources/Images/WorkoutTypes/Default/download.jpg");
const RESISTANCE_WORKOUT_COVER = require("../Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-e32a-48a8-a731-95ca73deeabd.png");
const RUN_WORKOUT_COVER = require("../Resources/Images/WorkoutTypes/Run/program-cover-run.jpg");

const RESISTANCE_TYPES = new Set([
  "resistance",
  "strengthtraining",
  "strength",
  "upperbody",
  "legs",
  "weightlifting",
]);

const RUN_TYPES = new Set(["run", "running", "walk", "interval", "cardio"]);

// Cover image for a workout/program by its workout type. Mirrors the mapping
// the handoff prototype uses (resistance PNG / run JPG / default fallback).
export function getWorkoutCoverImage(workoutType) {
  const normalizedType = String(workoutType ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (RESISTANCE_TYPES.has(normalizedType)) {
    return RESISTANCE_WORKOUT_COVER;
  }

  if (RUN_TYPES.has(normalizedType)) {
    return RUN_WORKOUT_COVER;
  }

  return DEFAULT_WORKOUT_COVER;
}

export { DEFAULT_WORKOUT_COVER, RESISTANCE_WORKOUT_COVER, RUN_WORKOUT_COVER };
