// Pushes the whole strength hierarchy in one pass, parent before child.
// This is what SetSync mounts; there is deliberately no per-level component.
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
  uploadedCount += await uploadDirtyExerciseInstances(db, userId, {
    allowParentRepair: false,
  });
  uploadedCount += await uploadDirtySets(db, userId, {
    allowParentRepair: false,
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
