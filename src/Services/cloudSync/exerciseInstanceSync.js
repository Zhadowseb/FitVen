// Cloud sync for ExerciseInstance: queued deletes, dirty upload, reconcile, and the
// entry points. It syncs its parent first, so the parent row exists in the
// cloud before a child points at it.
import { supabase } from "@database/supaBaseClient";
import {
  programRepository,
  weightliftingRepository,
} from "@repository";
import { withTransaction } from "@services/shared";
import { startBackgroundSync } from "@services/syncScheduler";
import {
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "@utils/syncUtils";
import {
  EXERCISE_INSTANCE_CLOUD_SYNC_SELECT,
  EXERCISE_INSTANCE_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableExerciseInstancesEqual,
  buildCloudExerciseInstancePayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  ensureWorkoutTypeInstanceCloudIdentity,
  getAuthenticatedUserId,
  getComparableExerciseInstanceSnapshot,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudExerciseInstanceId,
  parseCloudWorkoutTypeInstanceId,
  resolveCloudDeleteRequestedAt,
  resolveExerciseInstanceCloudLocalId,
  resolveSideBySideCloudId,
  serializeExerciseVisibleColumns,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncWorkoutTypeInstancesWithCloud } from "./workoutTypeInstanceSync";

export async function processQueuedExerciseInstanceDeletes(db, userId) {
  const queuedDeletes =
    await weightliftingRepository.getQueuedExerciseInstanceDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
      selectColumns: EXERCISE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudExerciseInstanceId(
        queuedDelete.cloud_exercise_instance_id
      ),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_exercise_instance_id,
        null
      ),
      legacyLocalIdColumn: "local_exercise_instance_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await weightliftingRepository.deleteQueuedExerciseInstanceDelete(
      db,
      queuedDelete.exercise_instance_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtyExerciseInstances(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localExercises, localWorkouts] = await Promise.all([
    weightliftingRepository.getExercisesForCloudSync(db),
    programRepository.getWorkoutsForCloudSync(db),
  ]);
  const localWorkoutsById = new Map(
    localWorkouts.map((workout) => [workout.workout_id, workout])
  );
  let uploadedCount = 0;
  let requiresWorkoutRepair = false;

  for (const localExercise of localExercises) {
    if (Number(localExercise.needs_sync) !== 1) {
      continue;
    }

    const parentWorkout = localWorkoutsById.get(
      localExercise.workout_type_instance_id
    );
    const parentWorkoutCloudId = await ensureWorkoutTypeInstanceCloudIdentity(
      db,
      userId,
      parentWorkout
    );

    if (parentWorkoutCloudId === null) {
      requiresWorkoutRepair = true;
      continue;
    }

    const payload = buildCloudExerciseInstancePayload(
      localExercise,
      userId,
      parentWorkoutCloudId
    );

    if (
      payload.local_exercise_instance_id === null ||
      !payload.exercise_name
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
      selectColumns: EXERCISE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localExercise,
      payload,
      cloudId: parseCloudExerciseInstanceId(
        resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
      ),
      syncId: normalizeSyncId(localExercise.sync_id),
      legacyLocalId: payload.local_exercise_instance_id,
      legacyLocalIdColumn: "local_exercise_instance_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      syncResult.cloudRecord?.id
    );

    if (cloudExerciseInstanceId === null) {
      throw new Error(
        "Could not resolve cloud exercise instance id after sync."
      );
    }

    const remoteLocalExerciseInstanceId =
      resolveExerciseInstanceCloudLocalId(syncResult.cloudRecord) ??
      payload.local_exercise_instance_id;

    await weightliftingRepository.markExerciseSynced(db, {
      exerciseId: localExercise.exercise_instance_id,
      cloudExerciseInstanceId,
      remoteLocalExerciseInstanceId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresWorkoutRepair && allowParentRepair) {
    await syncWorkoutTypeInstancesWithCloud(db);
    uploadedCount += await uploadDirtyExerciseInstances(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileExerciseInstancesFromCloud(db, userId) {
  const { data: cloudExercises, error } = await supabase
    .from(EXERCISE_INSTANCE_CLOUD_TABLE)
    .select(EXERCISE_INSTANCE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_workout_type_instance_id", { ascending: true })
    .order("exercise_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
    cloudRecords: cloudExercises,
  });

  const [localExercises, localWorkouts] = await Promise.all([
    weightliftingRepository.getExercisesForCloudSync(db),
    programRepository.getWorkoutsForCloudSync(db),
  ]);
  const queuedDeletes =
    await weightliftingRepository.getQueuedExerciseInstanceDeletes(db);
  const localWorkoutsByCloudId = new Map();
  const localExercisesByCloudId = new Map();
  const localExercisesBySyncId = new Map();
  const localExercisesByRemoteLocalId = new Map();
  const localExercisesByLocalId = new Map();
  const pendingDeletedExerciseLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(
          queuedDelete.remote_local_exercise_instance_id,
          null
        )
      )
      .filter((exerciseLocalId) => exerciseLocalId !== null)
  );

  for (const localWorkout of localWorkouts) {
    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      resolveSideBySideCloudId(
        localWorkout,
        "cloud_workout_type_instance_id"
      )
    );

    if (cloudWorkoutTypeInstanceId !== null) {
      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, localWorkout);
    }
  }

  for (const localExercise of localExercises) {
    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
    );
    const syncId = normalizeSyncId(localExercise.sync_id);
    const remoteLocalExerciseInstanceId =
      resolveExerciseInstanceCloudLocalId(localExercise);

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudId.set(cloudExerciseInstanceId, localExercise);
    }

    if (syncId) {
      localExercisesBySyncId.set(syncId, localExercise);
    }

    if (remoteLocalExerciseInstanceId !== null) {
      localExercisesByRemoteLocalId.set(
        remoteLocalExerciseInstanceId,
        localExercise
      );
    }

    localExercisesByLocalId.set(
      localExercise.exercise_instance_id,
      localExercise
    );
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudExercise of cloudExercises ?? []) {
      const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
        cloudExercise.id
      );
      const cloudSyncId = normalizeSyncId(cloudExercise.sync_id);
      const localExerciseInstanceId = normalizeOptionalInteger(
        cloudExercise.local_exercise_instance_id,
        null
      );
      const cloudWorkoutTypeInstanceId = normalizeOptionalInteger(
        cloudExercise.cloud_workout_type_instance_id,
        null
      );
      const parentWorkout = localWorkoutsByCloudId.get(cloudWorkoutTypeInstanceId);
      const comparableCloudExercise =
        getComparableExerciseInstanceSnapshot(cloudExercise);

      if (
        cloudExerciseInstanceId === null ||
        cloudWorkoutTypeInstanceId === null ||
        !parentWorkout ||
        !comparableCloudExercise.exercise_name
      ) {
        continue;
      }

      if (pendingDeletedExerciseLocalIds.has(localExerciseInstanceId)) {
        continue;
      }

      const localExercise =
        localExercisesByCloudId.get(cloudExerciseInstanceId) ??
        localExercisesBySyncId.get(cloudSyncId) ??
        localExercisesByRemoteLocalId.get(localExerciseInstanceId) ??
        localExercisesByLocalId.get(localExerciseInstanceId) ??
        null;

      if (isCloudSnapshotDeleted(cloudExercise)) {
        pendingDeletionAcks.push({
          userId,
          tableName: EXERCISE_INSTANCE_CLOUD_TABLE,
          cloudId: cloudExerciseInstanceId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudExercise),
        });

        if (localExercise) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localExercise,
              cloudExercise
            )
          ) {
            continue;
          }

          await weightliftingRepository.deleteSetsByExercise(
            db,
            localExercise.exercise_instance_id
          );
          await weightliftingRepository.deleteExerciseById(
            db,
            localExercise.exercise_instance_id
          );
          downloadedCount += 1;
        }

        continue;
      }

      if (!localExercise) {
        const result = await weightliftingRepository.createExerciseFromCloud(db, {
          cloudExerciseInstanceId,
          remoteLocalExerciseInstanceId: localExerciseInstanceId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
          workoutId: parentWorkout.workout_id,
          exerciseName: comparableCloudExercise.exercise_name,
          exerciseOrder: comparableCloudExercise.exercise_order,
          sets: comparableCloudExercise.sets,
          visibleColumns: serializeExerciseVisibleColumns(
            comparableCloudExercise.visible_columns
          ),
          note: comparableCloudExercise.note,
          done: comparableCloudExercise.done,
        });

        const createdExercise = {
          exercise_instance_id: result.lastInsertRowId,
          cloud_exercise_instance_id: cloudExerciseInstanceId,
          remote_local_exercise_instance_id: localExerciseInstanceId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudExercise.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudExercise.deleted_at),
          workout_type_instance_id: parentWorkout.workout_id,
          exercise_name: comparableCloudExercise.exercise_name,
          exercise_order: comparableCloudExercise.exercise_order,
          sets: comparableCloudExercise.sets,
          visible_columns: serializeExerciseVisibleColumns(
            comparableCloudExercise.visible_columns
          ),
          note: comparableCloudExercise.note,
          done: comparableCloudExercise.done ? 1 : 0,
          needs_sync: 0,
        };

        localExercisesByCloudId.set(
          cloudExerciseInstanceId,
          createdExercise
        );
        if (cloudSyncId) {
          localExercisesBySyncId.set(cloudSyncId, createdExercise);
        }
        localExercisesByRemoteLocalId.set(
          localExerciseInstanceId,
          createdExercise
        );
        localExercisesByLocalId.set(
          createdExercise.exercise_instance_id,
          createdExercise
        );
        downloadedCount += 1;
        continue;
      }

      const comparableLocalExercise = getComparableExerciseInstanceSnapshot({
        ...localExercise,
        cloud_workout_type_instance_id: parseCloudWorkoutTypeInstanceId(
          resolveSideBySideCloudId(
            parentWorkout,
            "cloud_workout_type_instance_id"
          )
        ),
      });

      if (Number(localExercise.needs_sync) === 1) {
        if (compareEntitySyncVersions(localExercise, cloudExercise) < 0) {
          await weightliftingRepository.updateExerciseFromCloud(db, {
            exerciseId: localExercise.exercise_instance_id,
            cloudExerciseInstanceId,
            remoteLocalExerciseInstanceId: localExerciseInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
            workoutId: parentWorkout.workout_id,
            exerciseName: comparableCloudExercise.exercise_name,
            exerciseOrder: comparableCloudExercise.exercise_order,
            sets: comparableCloudExercise.sets,
            visibleColumns: serializeExerciseVisibleColumns(
              comparableCloudExercise.visible_columns
            ),
            note: comparableCloudExercise.note,
            done: comparableCloudExercise.done,
          });
          downloadedCount += 1;
        }

        continue;
      }

      if (
        areComparableExerciseInstancesEqual(
          comparableLocalExercise,
          comparableCloudExercise
        )
      ) {
        if (
          resolveSideBySideCloudId(
            localExercise,
            "cloud_exercise_instance_id"
          ) === null ||
          resolveExerciseInstanceCloudLocalId(localExercise) !==
            localExerciseInstanceId ||
          normalizeSyncId(localExercise.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localExercise.sync_version, 0) !==
            normalizeSyncVersion(cloudExercise.sync_version, 0) ||
          normalizeDeletedAt(localExercise.deleted_at) !==
            normalizeDeletedAt(cloudExercise.deleted_at)
        ) {
          await weightliftingRepository.markExerciseSynced(db, {
            exerciseId: localExercise.exercise_instance_id,
            cloudExerciseInstanceId,
            remoteLocalExerciseInstanceId: localExerciseInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
          });
        }
        if (
          compareEntitySyncVersions(localExercise, cloudExercise) > 0
        ) {
          continue;
        }

        continue;
      }

      await weightliftingRepository.updateExerciseFromCloud(db, {
        exerciseId: localExercise.exercise_instance_id,
        cloudExerciseInstanceId,
        remoteLocalExerciseInstanceId: localExerciseInstanceId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudExercise.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudExercise.deleted_at),
        workoutId: parentWorkout.workout_id,
        exerciseName: comparableCloudExercise.exercise_name,
        exerciseOrder: comparableCloudExercise.exercise_order,
        sets: comparableCloudExercise.sets,
        visibleColumns: serializeExerciseVisibleColumns(
          comparableCloudExercise.visible_columns
        ),
        note: comparableCloudExercise.note,
        done: comparableCloudExercise.done,
      });

      const updatedExercise = {
        ...localExercise,
        cloud_exercise_instance_id: cloudExerciseInstanceId,
        remote_local_exercise_instance_id: localExerciseInstanceId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudExercise.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudExercise.deleted_at),
        workout_type_instance_id: parentWorkout.workout_id,
        exercise_name: comparableCloudExercise.exercise_name,
        exercise_order: comparableCloudExercise.exercise_order,
        sets: comparableCloudExercise.sets,
        visible_columns: serializeExerciseVisibleColumns(
          comparableCloudExercise.visible_columns
        ),
        note: comparableCloudExercise.note,
        done: comparableCloudExercise.done ? 1 : 0,
        needs_sync: 0,
      };

      localExercisesByCloudId.set(cloudExerciseInstanceId, updatedExercise);
      if (cloudSyncId) {
        localExercisesBySyncId.set(cloudSyncId, updatedExercise);
      }
      localExercisesByRemoteLocalId.set(
        localExerciseInstanceId,
        updatedExercise
      );
      localExercisesByLocalId.set(
        localExercise.exercise_instance_id,
        updatedExercise
      );
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncExerciseInstancesWithCloudInternal(db) {
  try {
    await syncWorkoutTypeInstancesWithCloud(db);
  } catch (error) {
    throw new Error(
      `Exercise sync prerequisite failed while syncing workouts: ${error?.message ?? error}`
    );
  }

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
  let initialDownloadedCount = 0;
  let uploadedCount = 0;
  let finalDownloadedCount = 0;

  try {
    deletedCount = await processQueuedExerciseInstanceDeletes(db, userId);
  } catch (error) {
    throw new Error(
      `Exercise sync failed while applying queued deletes: ${error?.message ?? error}`
    );
  }

  try {
    initialDownloadedCount = await reconcileExerciseInstancesFromCloud(
      db,
      userId
    );
  } catch (error) {
    throw new Error(
      `Exercise sync failed while downloading cloud exercises: ${error?.message ?? error}`
    );
  }

  try {
    uploadedCount = await uploadDirtyExerciseInstances(db, userId);
  } catch (error) {
    throw new Error(
      `Exercise sync failed while uploading local exercises: ${error?.message ?? error}`
    );
  }

  try {
    // Only worth a second pass when the first pass had something to push. This
    // download exists to collect the ids the cloud assigned to rows we just
    // sent; with nothing sent, it fetches the entire table to learn nothing.
    if (uploadedCount > 0 || deletedCount > 0) {
      finalDownloadedCount = await reconcileExerciseInstancesFromCloud(
        db,
        userId
      );
    }
  } catch (error) {
    throw new Error(
      `Exercise sync failed while reconciling cloud exercises: ${error?.message ?? error}`
    );
  }
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

export function syncExerciseInstancesInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncExerciseInstancesWithCloud(db);
    },
    "Exercise instance cloud sync failed:"
  );
}

export async function syncExerciseInstancesWithCloud(db) {
  return syncExerciseInstancesWithCloudInternal(db);
}
