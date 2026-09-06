// Cloud sync for Set: queued deletes, dirty upload, reconcile, and the
// entry points. It syncs its parent first, so the parent row exists in the
// cloud before a child points at it.
import { supabase } from "@database/supaBaseClient";
import { weightliftingRepository } from "@repository";
import { withTransaction } from "@services/shared";
import { startBackgroundSync } from "@services/syncScheduler";
import {
  normalizeDeletedAt,
  normalizeSyncId,
  normalizeSyncVersion,
} from "@utils/syncUtils";
import {
  SET_CLOUD_SYNC_SELECT,
  SET_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableSetsEqual,
  buildCloudSetPayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  createParentCloudIdCache,
  ensureExerciseInstanceCloudIdentity,
  getAuthenticatedUserId,
  getComparableSetSnapshot,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudExerciseInstanceId,
  parseCloudSetId,
  resolveCloudDeleteRequestedAt,
  resolveSetCloudLocalId,
  resolveSideBySideCloudId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncExerciseInstancesWithCloud } from "./exerciseInstanceSync";

export async function processQueuedSetDeletes(db, userId) {
  const queuedDeletes = await weightliftingRepository.getQueuedSetDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: SET_CLOUD_TABLE,
      selectColumns: SET_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudSetId(queuedDelete.cloud_set_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      legacyLocalId: normalizeOptionalInteger(
        queuedDelete.remote_local_set_id,
        null
      ),
      legacyLocalIdColumn: "local_set_id",
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await weightliftingRepository.deleteQueuedSetDelete(
      db,
      queuedDelete.set_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtySets(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localSets, localExercises] = await Promise.all([
    weightliftingRepository.getSetsForCloudSync(db, { dirtyOnly: true }),
    weightliftingRepository.getExercisesForCloudSync(db),
  ]);
  const localExercisesById = new Map(
    localExercises.map((exercise) => [exercise.exercise_instance_id, exercise])
  );
  const resolveParentExerciseCloudId = createParentCloudIdCache(
    ensureExerciseInstanceCloudIdentity
  );
  let uploadedCount = 0;
  let requiresExerciseRepair = false;

  for (const localSet of localSets) {
    if (Number(localSet.needs_sync) !== 1) {
      continue;
    }

    const parentExercise = localExercisesById.get(localSet.exercise_instance_id);
    const parentExerciseCloudId = await resolveParentExerciseCloudId(
      db,
      userId,
      parentExercise,
      localSet.exercise_instance_id
    );

    if (parentExerciseCloudId === null) {
      requiresExerciseRepair = true;
      continue;
    }

    const payload = buildCloudSetPayload(localSet, userId, parentExerciseCloudId);

    if (payload.local_set_id === null) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: SET_CLOUD_TABLE,
      selectColumns: SET_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localSet,
      payload,
      cloudId: parseCloudSetId(
        resolveSideBySideCloudId(localSet, "cloud_set_id")
      ),
      syncId: normalizeSyncId(localSet.sync_id),
      legacyLocalId: payload.local_set_id,
      legacyLocalIdColumn: "local_set_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudSetId = parseCloudSetId(syncResult.cloudRecord?.id);

    if (cloudSetId === null) {
      throw new Error("Could not resolve cloud set id after sync.");
    }

    const remoteLocalSetId =
      resolveSetCloudLocalId(syncResult.cloudRecord) ?? payload.local_set_id;

    await weightliftingRepository.markSetSynced(db, {
      setId: localSet.sets_id,
      cloudSetId,
      remoteLocalSetId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresExerciseRepair && allowParentRepair) {
    await syncExerciseInstancesWithCloud(db);
    uploadedCount += await uploadDirtySets(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileSetsFromCloud(db, userId) {
  const { data: cloudSets, error } = await supabase
    .from(SET_CLOUD_TABLE)
    .select(SET_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_exercise_instance_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: SET_CLOUD_TABLE,
    cloudRecords: cloudSets,
  });

  const [localSets, localExercises] = await Promise.all([
    weightliftingRepository.getSetsForCloudSync(db),
    weightliftingRepository.getExercisesForCloudSync(db),
  ]);
  const queuedDeletes = await weightliftingRepository.getQueuedSetDeletes(db);
  const localExercisesByCloudId = new Map();
  const localSetsByCloudId = new Map();
  const localSetsBySyncId = new Map();
  const localSetsByRemoteLocalId = new Map();
  const localSetsByLocalId = new Map();
  const pendingDeletedSetLocalIds = new Set(
    queuedDeletes
      .map((queuedDelete) =>
        normalizeOptionalInteger(queuedDelete.remote_local_set_id, null)
      )
      .filter((setLocalId) => setLocalId !== null)
  );

  for (const localExercise of localExercises) {
    const cloudExerciseInstanceId = parseCloudExerciseInstanceId(
      resolveSideBySideCloudId(localExercise, "cloud_exercise_instance_id")
    );

    if (cloudExerciseInstanceId !== null) {
      localExercisesByCloudId.set(cloudExerciseInstanceId, localExercise);
    }
  }

  for (const localSet of localSets) {
    const cloudSetId = parseCloudSetId(
      resolveSideBySideCloudId(localSet, "cloud_set_id")
    );
    const syncId = normalizeSyncId(localSet.sync_id);
    const remoteLocalSetId = resolveSetCloudLocalId(localSet);

    if (cloudSetId !== null) {
      localSetsByCloudId.set(cloudSetId, localSet);
    }

    if (syncId) {
      localSetsBySyncId.set(syncId, localSet);
    }

    if (remoteLocalSetId !== null) {
      localSetsByRemoteLocalId.set(remoteLocalSetId, localSet);
    }

    localSetsByLocalId.set(localSet.sets_id, localSet);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudSet of cloudSets ?? []) {
      const cloudSetId = parseCloudSetId(cloudSet.id);
      const cloudSyncId = normalizeSyncId(cloudSet.sync_id);
      const localSetId = normalizeOptionalInteger(cloudSet.local_set_id, null);
      const cloudExerciseInstanceId = normalizeOptionalInteger(
        cloudSet.cloud_exercise_instance_id,
        null
      );
      const parentExercise = localExercisesByCloudId.get(cloudExerciseInstanceId);
      const comparableCloudSet = getComparableSetSnapshot(cloudSet);

      if (
        cloudSetId === null ||
        cloudExerciseInstanceId === null ||
        !parentExercise
      ) {
        continue;
      }

      if (pendingDeletedSetLocalIds.has(localSetId)) {
        continue;
      }

      const localSet =
        localSetsByCloudId.get(cloudSetId) ??
        localSetsBySyncId.get(cloudSyncId) ??
        localSetsByRemoteLocalId.get(localSetId) ??
        localSetsByLocalId.get(localSetId) ??
        null;

      if (isCloudSnapshotDeleted(cloudSet)) {
        pendingDeletionAcks.push({
          userId,
          tableName: SET_CLOUD_TABLE,
          cloudId: cloudSetId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudSet),
        });

        if (localSet) {
          if (shouldKeepLocalEntityForCloudTombstone(localSet, cloudSet)) {
            continue;
          }

          await weightliftingRepository.deleteSetById(db, localSet.sets_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localSet) {
        const result = await weightliftingRepository.createSetFromCloud(db, {
          cloudSetId,
          remoteLocalSetId: localSetId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          exerciseId: parentExercise.exercise_instance_id,
          setNumber: comparableCloudSet.set_number,
          personalRecord: comparableCloudSet.personal_record,
          pause: comparableCloudSet.pause,
          rpe: comparableCloudSet.rpe,
          weight: comparableCloudSet.weight,
          rmPercentage: comparableCloudSet.rm_percentage,
          reps: comparableCloudSet.reps,
          done: comparableCloudSet.done,
          failed: comparableCloudSet.failed,
          amrap: comparableCloudSet.amrap,
          note: comparableCloudSet.note,
        });

        const createdSet = {
          sets_id: result.lastInsertRowId,
          cloud_set_id: cloudSetId,
          remote_local_set_id: localSetId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudSet.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudSet.deleted_at),
          exercise_instance_id: parentExercise.exercise_instance_id,
          ...comparableCloudSet,
          needs_sync: 0,
        };

        localSetsByCloudId.set(cloudSetId, createdSet);
        if (cloudSyncId) {
          localSetsBySyncId.set(cloudSyncId, createdSet);
        }
        localSetsByRemoteLocalId.set(localSetId, createdSet);
        localSetsByLocalId.set(createdSet.sets_id, createdSet);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalSet = getComparableSetSnapshot({
        ...localSet,
        cloud_exercise_instance_id: parseCloudExerciseInstanceId(
          resolveSideBySideCloudId(
            parentExercise,
            "cloud_exercise_instance_id"
          )
        ),
      });

      if (Number(localSet.needs_sync) === 1) {
        if (compareEntitySyncVersions(localSet, cloudSet) < 0) {
          await weightliftingRepository.updateSetFromCloud(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
            exerciseId: parentExercise.exercise_instance_id,
            setNumber: comparableCloudSet.set_number,
            personalRecord: comparableCloudSet.personal_record,
            pause: comparableCloudSet.pause,
            rpe: comparableCloudSet.rpe,
            weight: comparableCloudSet.weight,
            rmPercentage: comparableCloudSet.rm_percentage,
            reps: comparableCloudSet.reps,
            done: comparableCloudSet.done,
            failed: comparableCloudSet.failed,
            amrap: comparableCloudSet.amrap,
            note: comparableCloudSet.note,
          });
          downloadedCount += 1;
        } else if (areComparableSetsEqual(comparableLocalSet, comparableCloudSet)) {
          await weightliftingRepository.markSetSynced(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localSet, "cloud_set_id") === null ||
          resolveSetCloudLocalId(localSet) !== localSetId ||
          normalizeSyncId(localSet.sync_id) !== cloudSyncId
        ) {
          await weightliftingRepository.updateSetCloudIdentity(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        }
        continue;
      }

      if (areComparableSetsEqual(comparableLocalSet, comparableCloudSet)) {
        if (
          resolveSideBySideCloudId(localSet, "cloud_set_id") === null ||
          resolveSetCloudLocalId(localSet) !== localSetId ||
          normalizeSyncId(localSet.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localSet.sync_version, 0) !==
            normalizeSyncVersion(cloudSet.sync_version, 0) ||
          normalizeDeletedAt(localSet.deleted_at) !==
            normalizeDeletedAt(cloudSet.deleted_at)
        ) {
          await weightliftingRepository.markSetSynced(db, {
            setId: localSet.sets_id,
            cloudSetId,
            remoteLocalSetId: localSetId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
          });
        }
        continue;
      }

      await weightliftingRepository.updateSetFromCloud(db, {
        setId: localSet.sets_id,
        cloudSetId,
        remoteLocalSetId: localSetId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudSet.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudSet.deleted_at),
        exerciseId: parentExercise.exercise_instance_id,
        setNumber: comparableCloudSet.set_number,
        personalRecord: comparableCloudSet.personal_record,
        pause: comparableCloudSet.pause,
        rpe: comparableCloudSet.rpe,
        weight: comparableCloudSet.weight,
        rmPercentage: comparableCloudSet.rm_percentage,
        reps: comparableCloudSet.reps,
        done: comparableCloudSet.done,
        failed: comparableCloudSet.failed,
        amrap: comparableCloudSet.amrap,
        note: comparableCloudSet.note,
      });

      const updatedSet = {
        ...localSet,
        cloud_set_id: cloudSetId,
        remote_local_set_id: localSetId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudSet.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudSet.deleted_at),
        exercise_instance_id: parentExercise.exercise_instance_id,
        ...comparableCloudSet,
        needs_sync: 0,
      };

      localSetsByCloudId.set(cloudSetId, updatedSet);
      if (cloudSyncId) {
        localSetsBySyncId.set(cloudSyncId, updatedSet);
      }
      localSetsByRemoteLocalId.set(localSetId, updatedSet);
      localSetsByLocalId.set(localSet.sets_id, updatedSet);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncSetsWithCloudInternal(db) {
  try {
    await syncExerciseInstancesWithCloud(db);
  } catch (error) {
    throw new Error(
      `Set sync prerequisite failed while syncing exercises: ${error?.message ?? error}`
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
    deletedCount = await processQueuedSetDeletes(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while applying queued deletes: ${error?.message ?? error}`
    );
  }

  try {
    initialDownloadedCount = await reconcileSetsFromCloud(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while downloading cloud sets: ${error?.message ?? error}`
    );
  }

  try {
    uploadedCount = await uploadDirtySets(db, userId);
  } catch (error) {
    throw new Error(
      `Set sync failed while uploading local sets: ${error?.message ?? error}`
    );
  }

  try {
    // Only worth a second pass when the first pass had something to push. This
    // download exists to collect the ids the cloud assigned to rows we just
    // sent; with nothing sent, it fetches the entire table to learn nothing -
    // and for sets that is the largest table the user has.
    if (uploadedCount > 0 || deletedCount > 0) {
      finalDownloadedCount = await reconcileSetsFromCloud(db, userId);
    }
  } catch (error) {
    throw new Error(
      `Set sync failed while reconciling cloud sets: ${error?.message ?? error}`
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

export function syncSetsInBackground(db) {
  startBackgroundSync(
    async () => {
      await syncSetsWithCloud(db);
    },
    "Set cloud sync failed:"
  );
}

export async function syncSetsWithCloud(db) {
  return syncSetsWithCloudInternal(db);
}
