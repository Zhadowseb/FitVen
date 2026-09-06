// Cloud sync for Program: queued deletes, dirty upload, reconcile, and the
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
  PROGRAM_CLOUD_SYNC_SELECT,
  PROGRAM_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableProgramsEqual,
  buildCloudProgramPayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  getAuthenticatedUserId,
  getComparableProgramSnapshot,
  isCloudSnapshotDeleted,
  parseCloudProgramId,
  resolveCloudDeleteRequestedAt,
  resolveProgramCloudLocalId,
  resolveSideBySideCloudId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";

export async function processQueuedProgramDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedProgramDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: PROGRAM_CLOUD_TABLE,
      selectColumns: PROGRAM_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudProgramId(queuedDelete.cloud_program_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedProgramDelete(
      db,
      queuedDelete.program_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtyPrograms(db, userId) {
  const localPrograms = await programRepository.getProgramsForCloudSync(db, {
    dirtyOnly: true,
  });
  let uploadedCount = 0;

  for (const localProgram of localPrograms) {
    if (Number(localProgram.needs_sync) !== 1) {
      continue;
    }

    const payload = buildCloudProgramPayload(localProgram, userId);

    if (payload.local_program_id === null || !payload.start_date) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: PROGRAM_CLOUD_TABLE,
      selectColumns: PROGRAM_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localProgram,
      payload,
      cloudId: parseCloudProgramId(
        resolveSideBySideCloudId(localProgram, "cloud_program_id")
      ),
      syncId: normalizeSyncId(localProgram.sync_id),
      legacyLocalId: payload.local_program_id,
      legacyLocalIdColumn: "local_program_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudProgramId = parseCloudProgramId(syncResult.cloudRecord?.id);

    if (cloudProgramId === null) {
      throw new Error("Could not resolve cloud program id after sync.");
    }

    const remoteLocalProgramId =
      resolveProgramCloudLocalId(syncResult.cloudRecord) ?? payload.local_program_id;

    await programRepository.markProgramSynced(db, {
      programId: localProgram.program_id,
      cloudProgramId,
      remoteLocalProgramId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  return uploadedCount;
}

async function reconcileProgramsFromCloud(db, userId) {
  const { data: cloudPrograms, error } = await supabase
    .from(PROGRAM_CLOUD_TABLE)
    .select(PROGRAM_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: PROGRAM_CLOUD_TABLE,
    cloudRecords: cloudPrograms,
  });

  const localPrograms = await programRepository.getProgramsForCloudSync(db);
  const localProgramsByCloudId = new Map();
  const localProgramsBySyncId = new Map();
  const localProgramsByRemoteLocalId = new Map();

  for (const localProgram of localPrograms) {
    const cloudProgramId = parseCloudProgramId(
      resolveSideBySideCloudId(localProgram, "cloud_program_id")
    );
    const syncId = normalizeSyncId(localProgram.sync_id);
    const remoteLocalProgramId = resolveProgramCloudLocalId(localProgram);

    if (cloudProgramId !== null) {
      localProgramsByCloudId.set(cloudProgramId, localProgram);
    }

    if (syncId) {
      localProgramsBySyncId.set(syncId, localProgram);
    }

    if (remoteLocalProgramId !== null) {
      localProgramsByRemoteLocalId.set(remoteLocalProgramId, localProgram);
    }
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudProgram of cloudPrograms ?? []) {
      const cloudProgramId = parseCloudProgramId(cloudProgram.id);
      const comparableCloudProgram = getComparableProgramSnapshot(cloudProgram);
      const cloudSyncId = normalizeSyncId(cloudProgram.sync_id);

      if (
        cloudProgramId === null ||
        comparableCloudProgram.local_program_id === null ||
        !comparableCloudProgram.start_date
      ) {
        continue;
      }

      const localProgram =
        localProgramsByCloudId.get(cloudProgramId) ??
        localProgramsBySyncId.get(cloudSyncId) ??
        localProgramsByRemoteLocalId.get(comparableCloudProgram.local_program_id) ??
        null;

      if (isCloudSnapshotDeleted(cloudProgram)) {
        pendingDeletionAcks.push({
          userId,
          tableName: PROGRAM_CLOUD_TABLE,
          cloudId: cloudProgramId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudProgram),
        });

        if (localProgram) {
          if (
            shouldKeepLocalEntityForCloudTombstone(localProgram, cloudProgram)
          ) {
            continue;
          }

          await programRepository.deleteSetsByProgram(db, localProgram.program_id);
          await programRepository.deleteExercisesByProgram(db, localProgram.program_id);
          await programRepository.deleteRunsByProgram(db, localProgram.program_id);
          await programRepository.deleteWorkoutsByProgram(db, localProgram.program_id);
          await programRepository.deleteDaysByProgram(db, localProgram.program_id);
          await programRepository.deleteMicrocyclesByProgram(db, localProgram.program_id);
          await programRepository.deleteEstimatedSetsByProgram(
            db,
            localProgram.program_id
          );
          await weightliftingRepository.deleteRmWeightProgressionsByProgram(
            db,
            localProgram.program_id
          );
          await programRepository.deleteProgramBestExercisesByProgram(
            db,
            localProgram.program_id
          );
          await programRepository.deleteMesocyclesByProgram(db, localProgram.program_id);
          await programRepository.deleteProgramById(db, localProgram.program_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localProgram) {
        const result = await programRepository.createProgramFromCloud(db, {
          cloudProgramId,
          remoteLocalProgramId: comparableCloudProgram.local_program_id,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
          programName: comparableCloudProgram.program_name,
          startDate: comparableCloudProgram.start_date,
          status: comparableCloudProgram.status,
        });

        const createdProgram = {
          program_id: result.lastInsertRowId,
          cloud_program_id: cloudProgramId,
          remote_local_program_id: comparableCloudProgram.local_program_id,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
          ...comparableCloudProgram,
          needs_sync: 0,
        };

        localProgramsByCloudId.set(cloudProgramId, createdProgram);
        if (cloudSyncId) {
          localProgramsBySyncId.set(cloudSyncId, createdProgram);
        }
        localProgramsByRemoteLocalId.set(
          comparableCloudProgram.local_program_id,
          createdProgram
        );
        downloadedCount += 1;
        continue;
      }

      if (Number(localProgram.needs_sync) === 1) {
        if (compareEntitySyncVersions(localProgram, cloudProgram) < 0) {
          await programRepository.updateProgramFromCloud(db, {
            programId: localProgram.program_id,
            cloudProgramId,
            remoteLocalProgramId: comparableCloudProgram.local_program_id,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
            programName: comparableCloudProgram.program_name,
            startDate: comparableCloudProgram.start_date,
            status: comparableCloudProgram.status,
          });
          downloadedCount += 1;
        }

        continue;
      }

      if (areComparableProgramsEqual(localProgram, comparableCloudProgram)) {
        if (
          resolveSideBySideCloudId(localProgram, "cloud_program_id") === null ||
          resolveProgramCloudLocalId(localProgram) !==
            comparableCloudProgram.local_program_id ||
          normalizeSyncId(localProgram.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localProgram.sync_version, 0) !==
            normalizeSyncVersion(cloudProgram.sync_version, 0) ||
          normalizeDeletedAt(localProgram.deleted_at) !==
            normalizeDeletedAt(cloudProgram.deleted_at)
        ) {
          await programRepository.markProgramSynced(db, {
            programId: localProgram.program_id,
            cloudProgramId,
            remoteLocalProgramId: comparableCloudProgram.local_program_id,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateProgramFromCloud(db, {
        programId: localProgram.program_id,
        cloudProgramId,
        remoteLocalProgramId: comparableCloudProgram.local_program_id,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudProgram.deleted_at),
        programName: comparableCloudProgram.program_name,
        startDate: comparableCloudProgram.start_date,
        status: comparableCloudProgram.status,
      });

      localProgramsByCloudId.set(cloudProgramId, {
        ...localProgram,
        cloud_program_id: cloudProgramId,
        remote_local_program_id: comparableCloudProgram.local_program_id,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
        ...comparableCloudProgram,
        needs_sync: 0,
      });
      localProgramsByRemoteLocalId.set(comparableCloudProgram.local_program_id, {
        ...localProgram,
        cloud_program_id: cloudProgramId,
        remote_local_program_id: comparableCloudProgram.local_program_id,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudProgram.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudProgram.deleted_at),
        ...comparableCloudProgram,
        needs_sync: 0,
      });
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncProgramsWithCloudInternal(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedProgramDeletes(db, userId);
  const uploadedCount = await uploadDirtyPrograms(db, userId);
  const downloadedCount = await reconcileProgramsFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

export function syncProgramsInBackground(db) {
  startBackgroundSync(
    () => syncProgramsWithCloud(db),
    "Program cloud sync failed:"
  );
}

export async function syncProgramsWithCloud(db) {
  return syncProgramsWithCloudInternal(db);
}
