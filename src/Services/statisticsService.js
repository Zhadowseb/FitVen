// The raw material for the statistics and the trophy room beyond the strength
// sets, which weightliftingService.getRecordsSourceData already reads: every
// finished workout, the distance and time of every finished run, and the type
// of every finished set. Shaped into numbers by Utils/statisticsInsights and
// Utils/trophyRoom, where it can be tested without a database.
import {
  runningRepository,
  weightliftingRepository,
  workoutRepository,
} from "../Repository";

export function getCompletedWorkouts(db) {
  return workoutRepository.getCompletedWorkoutsForStatistics(db);
}

export function getCompletedRunSegments(db) {
  return runningRepository.getCompletedRunSegmentsForStatistics(db);
}

export function getCompletedSetTypes(db) {
  return weightliftingRepository.getCompletedSetTypesForStatistics(db);
}

/**
 * The strength sets on their own - the rows getRecordsSourceData returns,
 * without the muscle-group mapping it builds beside them. That mapping comes
 * from the exercise catalog in the cloud, and a deep dive that never shows a
 * muscle group should not wait on the network for one.
 */
export function getCompletedStrengthSets(db) {
  return weightliftingRepository.getCompletedStrengthSetsForPersonalRecords(db);
}
