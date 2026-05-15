import { workoutRepository } from "../Repository";
import { withTransaction } from "./shared";
import { startBackgroundSync } from "./syncScheduler";

let dirtyWorkoutHierarchyPushScheduled = false;
let dirtyWorkoutHierarchyPushNeedsRerun = false;

function pushDirtyWorkoutHierarchyInBackground(db) {
  if (dirtyWorkoutHierarchyPushScheduled) {
    dirtyWorkoutHierarchyPushNeedsRerun = true;
    return;
  }

  dirtyWorkoutHierarchyPushScheduled = true;
  startBackgroundSync(
    async () => {
      try {
        do {
          dirtyWorkoutHierarchyPushNeedsRerun = false;
          const programServiceModule = await import("./programService");
          await programServiceModule.pushDirtyStrengthHierarchyWithCloud(db);
        } while (dirtyWorkoutHierarchyPushNeedsRerun);
      } finally {
        dirtyWorkoutHierarchyPushScheduled = false;
      }
    },
    "Workout hierarchy cloud push failed:"
  );
}

async function syncWorkoutTypeInstancesInBackground(db) {
  try {
    pushDirtyWorkoutHierarchyInBackground(db);
  } catch (error) {
    console.error("Failed to start workout type instance cloud sync:", error);
  }
}

export async function refreshWorkoutHierarchyCompletionByIds(
  db,
  { dayId, microcycleId, mesocycleId }
) {
  if (dayId) {
    await workoutRepository.updateDayDoneFromWorkouts(db, dayId);
  }

  if (microcycleId) {
    await workoutRepository.updateMicrocycleDoneFromWorkouts(db, microcycleId);
  }

  if (mesocycleId) {
    await workoutRepository.updateMesocycleDoneFromMicrocycles(db, mesocycleId);
  }
}

export async function refreshWorkoutHierarchyCompletion(db, workoutId) {
  const ids = await workoutRepository.getWorkoutHierarchyIds(db, workoutId);

  if (!ids) {
    return;
  }

  await refreshWorkoutHierarchyCompletionByIds(db, {
    dayId: ids.day_id,
    microcycleId: ids.microcycle_id,
    mesocycleId: ids.mesocycle_id,
  });
}

export async function getWorkoutPageMetadata(db, workoutId) {
  return workoutRepository.getWorkoutPageMetadata(db, workoutId);
}

export async function getWorkoutTimerState(db, workoutId) {
  return workoutRepository.getWorkoutTimerState(db, workoutId);
}

export async function updateWorkoutLabel(db, { workoutId, label }) {
  await workoutRepository.updateWorkoutLabel(db, {
    workoutId,
    label,
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function persistWorkoutTimerState(
  db,
  { workoutId, timerStart, elapsedTime }
) {
  await workoutRepository.persistWorkoutTimerState(db, {
    workoutId,
    timerStart,
    elapsedTime,
  });
}

export async function updateWorkoutElapsedTime(
  db,
  { workoutId, elapsedTime }
) {
  await workoutRepository.updateWorkoutElapsedTime(db, {
    workoutId,
    elapsedTime,
  });
}

export async function getWorkoutOriginalStartTime(db, workoutId) {
  return workoutRepository.getWorkoutOriginalStartTime(db, workoutId);
}

export async function setWorkoutOriginalStartTime(
  db,
  { workoutId, startTime }
) {
  await workoutRepository.setWorkoutOriginalStartTime(db, {
    workoutId,
    startTime,
  });
}

export async function getWorkoutStartTimestamp(db, workoutId) {
  return workoutRepository.getWorkoutStartTimestamp(db, workoutId);
}

export async function setWorkoutStartTimestamp(db, { workoutId, startTs }) {
  await workoutRepository.setWorkoutStartTimestamp(db, {
    workoutId,
    startTs,
  });
}

export async function stopWorkoutStopwatch(
  db,
  { workoutId, durationSeconds }
) {
  await workoutRepository.stopWorkoutStopwatch(db, {
    workoutId,
    durationSeconds,
  });
}

export async function setWorkoutDone(db, { workoutId, done }) {
  await withTransaction(db, async () => {
    await workoutRepository.updateWorkoutDone(db, {
      workoutId,
      done,
    });

    await refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function resetWorkoutState(db, workoutId) {
  await withTransaction(db, async () => {
    await workoutRepository.resetWorkoutStateFields(db, workoutId);
    await refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  syncWorkoutTypeInstancesInBackground(db);
}
