// Cloud sync for WorkoutTypeInstance: queued deletes, dirty upload, reconcile, and the
// entry points. It syncs its parent first, so the parent row exists in the
// cloud before a child points at it.
import { supabase } from "@database/supaBaseClient";
import { programRepository } from "@repository";
import { withTransaction } from "@services/shared";
import { startBackgroundSync } from "@services/syncScheduler";
import {
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "@utils/syncUtils";
import {
  WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT,
  WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableWorkoutTypeInstancesEqual,
  buildCloudWorkoutTypeInstancePayload,
  claimCloudWatchers,
  cloudTimeStringToLocalTimestamp,
  compareEntitySyncVersions,
  deleteLocalWorkoutHierarchy,
  ensureDayCloudIdentity,
  getAuthenticatedUserId,
  getComparableWorkoutTypeInstanceSnapshot,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudDayId,
  parseCloudWorkoutTypeInstanceId,
  resolveCloudDeleteRequestedAt,
  resolveSideBySideCloudId,
  resolveWorkoutTypeInstanceCloudLocalId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncDaysWithCloud } from "./daySync";

export async function processQueuedWorkoutTypeInstanceDeletes(db, userId) {
  const queuedDeletes =
    await programRepository.getQueuedWorkoutTypeInstanceDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
      selectColumns: WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudWorkoutTypeInstanceId(
        queuedDelete.cloud_workout_type_instance_id
      ),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_workout_type_instance_id,
        null
      ),
      legacyLocalIdColumn: "local_workout_type_instance_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedWorkoutTypeInstanceDelete(
      db,
      queuedDelete.workout_type_instance_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtyWorkoutTypeInstances(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localWorkouts, localDays] = await Promise.all([
    programRepository.getWorkoutsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
  ]);
  const localDaysById = new Map(localDays.map((day) => [day.day_id, day]));
  let uploadedCount = 0;
  let requiresDayRepair = false;

  for (const localWorkout of localWorkouts) {
    if (Number(localWorkout.needs_sync) !== 1) {
      continue;
    }

    const parentDay = localDaysById.get(localWorkout.day_id);
    const parentDayCloudId = await ensureDayCloudIdentity(db, userId, parentDay);

    if (parentDayCloudId === null) {
      requiresDayRepair = true;
      continue;
    }

    const payload = buildCloudWorkoutTypeInstancePayload(
      localWorkout,
      userId,
      parentDayCloudId
    );

    if (
      payload.local_workout_type_instance_id === null ||
      !payload.date
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
      selectColumns: WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localWorkout,
      payload,
      cloudId: parseCloudWorkoutTypeInstanceId(
        resolveSideBySideCloudId(
          localWorkout,
          "cloud_workout_type_instance_id"
        )
      ),
      syncId: normalizeSyncId(localWorkout.sync_id),
      legacyLocalId: payload.local_workout_type_instance_id,
      legacyLocalIdColumn: "local_workout_type_instance_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      syncResult.cloudRecord?.id
    );

    if (cloudWorkoutTypeInstanceId === null) {
      throw new Error("Could not resolve cloud workout type instance id after sync.");
    }

    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(syncResult.cloudRecord) ??
      payload.local_workout_type_instance_id;

    await programRepository.markWorkoutSynced(db, {
      workoutId: localWorkout.workout_id,
      cloudWorkoutTypeInstanceId,
      remoteLocalWorkoutTypeInstanceId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresDayRepair && allowParentRepair) {
    await syncDaysWithCloud(db);
    uploadedCount += await uploadDirtyWorkoutTypeInstances(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileWorkoutTypeInstancesFromCloud(db, userId) {
  const { data: cloudWorkouts, error } = await supabase
    .from(WORKOUT_TYPE_INSTANCE_CLOUD_TABLE)
    .select(WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_day_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
    cloudRecords: cloudWorkouts,
  });

  const [localWorkouts, localDays] = await Promise.all([
    programRepository.getWorkoutsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
  ]);
  const queuedDeletes =
    await programRepository.getQueuedWorkoutTypeInstanceDeletes(db);
  const localDaysByCloudId = new Map();
  const localWorkoutsByCloudId = new Map();
  const localWorkoutsBySyncId = new Map();
  const localWorkoutsByRemoteLocalId = new Map();
  const localWorkoutsByLocalId = new Map();
  const pendingDeletedWorkoutLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(
          queuedDelete.remote_local_workout_type_instance_id,
          null
        )
      )
      .filter((workoutLocalId) => workoutLocalId !== null)
  );

  for (const localDay of localDays) {
    const cloudDayId = parseCloudDayId(
      resolveSideBySideCloudId(localDay, "cloud_day_id")
    );

    if (cloudDayId !== null) {
      localDaysByCloudId.set(cloudDayId, localDay);
    }
  }

  for (const localWorkout of localWorkouts) {
    const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
      resolveSideBySideCloudId(
        localWorkout,
        "cloud_workout_type_instance_id"
      )
    );
    const syncId = normalizeSyncId(localWorkout.sync_id);
    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(localWorkout);

    if (cloudWorkoutTypeInstanceId !== null) {
      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, localWorkout);
    }

    if (syncId) {
      localWorkoutsBySyncId.set(syncId, localWorkout);
    }

    if (remoteLocalWorkoutTypeInstanceId !== null) {
      localWorkoutsByRemoteLocalId.set(
        remoteLocalWorkoutTypeInstanceId,
        localWorkout
      );
    }

    localWorkoutsByLocalId.set(localWorkout.workout_id, localWorkout);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudWorkout of cloudWorkouts ?? []) {
      const cloudWorkoutTypeInstanceId = parseCloudWorkoutTypeInstanceId(
        cloudWorkout.id
      );
      const cloudSyncId = normalizeSyncId(cloudWorkout.sync_id);
      const localWorkoutTypeInstanceId = normalizeOptionalInteger(
        cloudWorkout.local_workout_type_instance_id,
        null
      );
      const cloudDayId = normalizeOptionalInteger(cloudWorkout.cloud_day_id, null);
      const parentDay = localDaysByCloudId.get(cloudDayId);
      const comparableCloudWorkout =
        getComparableWorkoutTypeInstanceSnapshot(cloudWorkout);

      if (
        cloudWorkoutTypeInstanceId === null ||
        localWorkoutTypeInstanceId === null ||
        cloudDayId === null ||
        !parentDay ||
        !comparableCloudWorkout.date
      ) {
        continue;
      }

      if (pendingDeletedWorkoutLocalIds.has(localWorkoutTypeInstanceId)) {
        continue;
      }

      const localWorkout =
        localWorkoutsByCloudId.get(cloudWorkoutTypeInstanceId) ??
        localWorkoutsBySyncId.get(cloudSyncId) ??
        localWorkoutsByRemoteLocalId.get(localWorkoutTypeInstanceId) ??
        localWorkoutsByLocalId.get(localWorkoutTypeInstanceId) ??
        null;

      if (isCloudSnapshotDeleted(cloudWorkout)) {
        pendingDeletionAcks.push({
          userId,
          tableName: WORKOUT_TYPE_INSTANCE_CLOUD_TABLE,
          cloudId: cloudWorkoutTypeInstanceId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudWorkout),
        });

        if (localWorkout) {
          if (
            shouldKeepLocalEntityForCloudTombstone(localWorkout, cloudWorkout)
          ) {
            continue;
          }

          await deleteLocalWorkoutHierarchy(db, localWorkout.workout_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localWorkout) {
        const result = await programRepository.createWorkoutFromCloud(db, {
          cloudWorkoutTypeInstanceId,
          remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          dayId: parentDay.day_id,
          workoutType: comparableCloudWorkout.workout_type,
          date: comparableCloudWorkout.date,
          label: comparableCloudWorkout.label,
          done: comparableCloudWorkout.done,
          isActive: comparableCloudWorkout.is_active,
          originalStartTime: cloudTimeStringToLocalTimestamp(
            comparableCloudWorkout.date,
            comparableCloudWorkout.original_start_time
          ),
          timerStart: cloudTimeStringToLocalTimestamp(
            comparableCloudWorkout.date,
            comparableCloudWorkout.timer_start
          ),
          elapsedTime: comparableCloudWorkout.elapsed_time,
        });

        const createdWorkout = {
          workout_id: result.lastInsertRowId,
          cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
          remote_local_workout_type_instance_id: localWorkoutTypeInstanceId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudWorkout.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudWorkout.deleted_at),
          day_id: parentDay.day_id,
          ...comparableCloudWorkout,
          needs_sync: 0,
        };

        localWorkoutsByCloudId.set(
          cloudWorkoutTypeInstanceId,
          createdWorkout
        );
        if (cloudSyncId) {
          localWorkoutsBySyncId.set(cloudSyncId, createdWorkout);
        }
        localWorkoutsByRemoteLocalId.set(
          localWorkoutTypeInstanceId,
          createdWorkout
        );
        localWorkoutsByLocalId.set(createdWorkout.workout_id, createdWorkout);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalWorkout = getComparableWorkoutTypeInstanceSnapshot({
        ...localWorkout,
        cloud_day_id: parseCloudDayId(
          resolveSideBySideCloudId(parentDay, "cloud_day_id")
        ),
      });

      if (Number(localWorkout.needs_sync) === 1) {
        if (compareEntitySyncVersions(localWorkout, cloudWorkout) < 0) {
          await programRepository.updateWorkoutFromCloud(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
            dayId: parentDay.day_id,
            workoutType: comparableCloudWorkout.workout_type,
            date: comparableCloudWorkout.date,
            label: comparableCloudWorkout.label,
            done: comparableCloudWorkout.done,
            isActive: comparableCloudWorkout.is_active,
            originalStartTime: cloudTimeStringToLocalTimestamp(
              comparableCloudWorkout.date,
              comparableCloudWorkout.original_start_time
            ),
            timerStart: cloudTimeStringToLocalTimestamp(
              comparableCloudWorkout.date,
              comparableCloudWorkout.timer_start
            ),
            elapsedTime: comparableCloudWorkout.elapsed_time,
          });
          downloadedCount += 1;
        } else if (
          areComparableWorkoutTypeInstancesEqual(
            comparableLocalWorkout,
            comparableCloudWorkout
          )
        ) {
          await programRepository.markWorkoutSynced(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(
            localWorkout,
            "cloud_workout_type_instance_id"
          ) === null ||
          resolveWorkoutTypeInstanceCloudLocalId(localWorkout) !==
            localWorkoutTypeInstanceId ||
          normalizeSyncId(localWorkout.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateWorkoutCloudIdentity(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        }
        continue;
      }

      if (
        areComparableWorkoutTypeInstancesEqual(
          comparableLocalWorkout,
          comparableCloudWorkout
        )
      ) {
        if (
          resolveSideBySideCloudId(
            localWorkout,
            "cloud_workout_type_instance_id"
          ) === null ||
          resolveWorkoutTypeInstanceCloudLocalId(localWorkout) !==
            localWorkoutTypeInstanceId ||
          normalizeSyncId(localWorkout.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localWorkout.sync_version, 0) !==
            normalizeSyncVersion(cloudWorkout.sync_version, 0) ||
          normalizeDeletedAt(localWorkout.deleted_at) !==
            normalizeDeletedAt(cloudWorkout.deleted_at)
        ) {
          await programRepository.markWorkoutSynced(db, {
            workoutId: localWorkout.workout_id,
            cloudWorkoutTypeInstanceId,
            remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateWorkoutFromCloud(db, {
        workoutId: localWorkout.workout_id,
        cloudWorkoutTypeInstanceId,
        remoteLocalWorkoutTypeInstanceId: localWorkoutTypeInstanceId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudWorkout.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudWorkout.deleted_at),
        dayId: parentDay.day_id,
        workoutType: comparableCloudWorkout.workout_type,
        date: comparableCloudWorkout.date,
        label: comparableCloudWorkout.label,
        done: comparableCloudWorkout.done,
        isActive: comparableCloudWorkout.is_active,
        originalStartTime: cloudTimeStringToLocalTimestamp(
          comparableCloudWorkout.date,
          comparableCloudWorkout.original_start_time
        ),
        timerStart: cloudTimeStringToLocalTimestamp(
          comparableCloudWorkout.date,
          comparableCloudWorkout.timer_start
        ),
        elapsedTime: comparableCloudWorkout.elapsed_time,
      });

      const updatedWorkout = {
        ...localWorkout,
        cloud_workout_type_instance_id: cloudWorkoutTypeInstanceId,
        remote_local_workout_type_instance_id: localWorkoutTypeInstanceId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudWorkout.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudWorkout.deleted_at),
        day_id: parentDay.day_id,
        ...comparableCloudWorkout,
        needs_sync: 0,
      };

      localWorkoutsByCloudId.set(cloudWorkoutTypeInstanceId, updatedWorkout);
      if (cloudSyncId) {
        localWorkoutsBySyncId.set(cloudSyncId, updatedWorkout);
      }
      localWorkoutsByRemoteLocalId.set(
        localWorkoutTypeInstanceId,
        updatedWorkout
      );
      localWorkoutsByLocalId.set(localWorkout.workout_id, updatedWorkout);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncWorkoutTypeInstancesWithCloudInternal(db) {
  await syncDaysWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedWorkoutTypeInstanceDeletes(db, userId);
  const initialDownloadedCount = await reconcileWorkoutTypeInstancesFromCloud(
    db,
    userId
  );
  const uploadedCount = await uploadDirtyWorkoutTypeInstances(db, userId);
  const finalDownloadedCount = await reconcileWorkoutTypeInstancesFromCloud(
    db,
    userId
  );
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

export function syncWorkoutTypeInstancesInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncWorkoutTypeInstancesWithCloud(db);
    },
    "Workout type instance cloud sync failed:"
  );
}

export async function syncWorkoutTypeInstancesWithCloud(db) {
  return syncWorkoutTypeInstancesWithCloudInternal(db);
}
