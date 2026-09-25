// The Train tab's library tiles and tools: the numbers they show, from the
// local database, shaped by Utils/trainLibrary.
import { normalizeRecordRows } from "@utils/recordsInsights";
import { dayOf } from "@utils/statisticsInsights";
import {
  MUSCLE_GROUP_DAYS,
  ONE_REP_MAX_DAYS,
  buildMuscleGroupShares,
  buildTrainLibrary,
  buildTrainTools,
  isoDay,
  windowStartIso,
} from "@utils/trainLibrary";
import {
  programRepository,
  trainRepository,
  weightliftingRepository,
} from "@repository";
import * as statisticsService from "./statisticsService";
import * as weightliftingService from "./weightliftingService";

// Sickness is read straight from the repository. programService's
// getSicknessPeriods first repairs overlapping periods in a write
// transaction, which a screen that only counts days has no reason to start on
// every visit - and the counting takes each day once, overlaps or not.

/**
 * Everything the library grid shows but the muscle groups: the Workouts and
 * Records tiles, "Your form", the catalog count and the Programs tile. All of
 * it local, so it answers at once.
 *
 * The workouts are statisticsService's finished workouts of every kind - the
 * list the rest of the app counts "Workouts" from - and the Workouts tile and
 * "Your form" share them.
 */
export async function getLibraryOverview(db, { now = Date.now() } = {}) {
  const [workoutRows, recordDayRows, sicknessRows, programs, microcycleRows, catalogRows] =
    await Promise.all([
      statisticsService.getCompletedWorkouts(db),
      trainRepository.getPersonalRecordCountsByDay(db),
      programRepository.getSicknessPeriods(db),
      programRepository.getProgramsOverview(db),
      trainRepository.getProgramMicrocycleProgress(db, { todayIso: isoDay(dayOf(now)) }),
      weightliftingRepository.getExerciseStorage(db),
    ]);

  return buildTrainLibrary(
    { workoutRows, recordDayRows, sicknessRows, programs, microcycleRows, catalogRows },
    { now }
  );
}

/**
 * The Exercises tile's muscle groups over the last ninety days. Apart from
 * the rest because the exercise-to-group mapping comes from the cloud
 * catalog: the grid is not held back while it arrives, and offline it is
 * empty and the tile shows no groups.
 */
export async function getLibraryMuscleGroups(db, { now = Date.now() } = {}) {
  const { rows, groupsByExercise } = await weightliftingService.getRecordsSourceData(db, {
    sinceIsoDate: windowStartIso(now, MUSCLE_GROUP_DAYS),
  });

  return buildMuscleGroupShares(normalizeRecordRows(rows), { groupsByExercise, now });
}

/** The two tools: the best estimated 1RM of the last thirty days, and this year's sick days. */
export async function getToolsOverview(db, { now = Date.now() } = {}) {
  const [setRows, sicknessRows, catalogRows] = await Promise.all([
    weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db, {
      sinceIsoDate: windowStartIso(now, ONE_REP_MAX_DAYS),
    }),
    programRepository.getSicknessPeriods(db),
    weightliftingRepository.getExerciseStorage(db),
  ]);

  return buildTrainTools(
    { sets: normalizeRecordRows(setRows), sicknessRows, catalogRows },
    { now }
  );
}
