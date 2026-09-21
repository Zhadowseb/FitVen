// Pushes the whole strength hierarchy in one pass, parent before child.
// This is what SetSync mounts; there is deliberately no per-level component.
import { weightliftingRepository } from "@repository";
import { getAuthenticatedUserId } from "./cloudSyncShared";
import { uploadDirtyDays } from "./daySync";
import {
  processQueuedExerciseInstanceDeletes,
  uploadDirtyExerciseInstances,
} from "./exerciseInstanceSync";
import {
  processQueuedMesocycleDeletes,
  uploadDirtyMesocycles,
} from "./mesocycleSync";
import {
  processQueuedMicrocycleDeletes,
  uploadDirtyMicrocycles,
} from "./microcycleSync";
import {
  processQueuedProgramDeletes,
  uploadDirtyPrograms,
} from "./programSync";
import {
  processQueuedSetDeletes,
  uploadDirtySets,
} from "./setSync";
import {
  processQueuedWorkoutTypeInstanceDeletes,
  uploadDirtyWorkoutTypeInstances,
} from "./workoutTypeInstanceSync";

async function pushDirtyProgramHierarchyWithCloudInternal(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  let deletedCount = 0;
  deletedCount += await processQueuedProgramDeletes(db, userId);
  deletedCount += await processQueuedMesocycleDeletes(db, userId);
  deletedCount += await processQueuedMicrocycleDeletes(db, userId);
  deletedCount += await processQueuedWorkoutTypeInstanceDeletes(db, userId);
  deletedCount += await processQueuedExerciseInstanceDeletes(db, userId);
  deletedCount += await processQueuedSetDeletes(db, userId);

  // Before anything is pushed, take back the rows an earlier pass dropped. An
  // exercise skipped because its workout had no cloud id at that moment keeps
  // needs_sync = 0 and is never looked at again, so the workout syncs on as an
  // empty shell. This re-marks those and lets the upload below carry them.
  await weightliftingRepository.markUnsyncedStrengthDataForRetry(db);

  let uploadedCount = 0;
  uploadedCount += await uploadDirtyPrograms(db, userId);
  uploadedCount += await uploadDirtyMesocycles(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyMicrocycles(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyDays(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtyWorkoutTypeInstances(db, userId, {
    allowParentRepair: false,
  });
  // The two lowest levels repair their parent rather than give up. Everything
  // above them was just pushed in order by the lines over this one, but a
  // workout that is not dirty and has no cloud row is not reached by any of
  // them, and without the repair its exercises and sets stay on the device
  // permanently. The repair only runs when a row was actually skipped.
  uploadedCount += await uploadDirtyExerciseInstances(db, userId, {
    allowParentRepair: true,
  });
  uploadedCount += await uploadDirtySets(db, userId, {
    allowParentRepair: true,
  });

  return {
    changed: deletedCount > 0 || uploadedCount > 0,
    deletedCount,
    downloadedCount: 0,
    uploadedCount,
  };
}

export async function pushDirtyStrengthHierarchyWithCloud(db) {
  return pushDirtyProgramHierarchyWithCloudInternal(db);
}
