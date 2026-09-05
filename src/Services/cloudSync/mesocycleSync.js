// Cloud sync for Mesocycle: queued deletes, dirty upload, reconcile, and the
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
  MESOCYCLE_CLOUD_SYNC_SELECT,
  MESOCYCLE_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableMesocyclesEqual,
  buildCloudMesocyclePayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  deleteLocalMesocycleHierarchy,
  ensureProgramCloudIdentity,
  getAuthenticatedUserId,
  getComparableMesocycleSnapshot,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudMesocycleId,
  parseCloudProgramId,
  resolveCloudDeleteRequestedAt,
  resolveMesocycleCloudLocalId,
  resolveSideBySideCloudId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncProgramsWithCloud } from "./programSync";

export async function processQueuedMesocycleDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedMesocycleDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: MESOCYCLE_CLOUD_TABLE,
      selectColumns: MESOCYCLE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudMesocycleId(queuedDelete.cloud_mesocycle_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedMesocycleDelete(
      db,
      queuedDelete.mesocycle_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtyMesocycles(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  let uploadedCount = 0;
  let requiresProgramRepair = false;

  for (const localMesocycle of localMesocycles) {
    if (Number(localMesocycle.needs_sync) !== 1) {
      continue;
    }

    const parentProgram = localProgramsById.get(localMesocycle.program_id);
    const parentProgramCloudId = await ensureProgramCloudIdentity(
      db,
      userId,
      parentProgram
    );

    if (parentProgramCloudId === null) {
      requiresProgramRepair = true;
      continue;
    }

    const payload = buildCloudMesocyclePayload(
      localMesocycle,
      userId,
      parentProgramCloudId
    );

    if (payload.local_mesocycle_id === null) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: MESOCYCLE_CLOUD_TABLE,
      selectColumns: MESOCYCLE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localMesocycle,
      payload,
      cloudId: parseCloudMesocycleId(
        resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
      ),
      syncId: normalizeSyncId(localMesocycle.sync_id),
      legacyLocalId: payload.local_mesocycle_id,
      legacyLocalIdColumn: "local_mesocycle_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudMesocycleId = parseCloudMesocycleId(syncResult.cloudRecord?.id);

    if (cloudMesocycleId === null) {
      throw new Error("Could not resolve cloud mesocycle id after sync.");
    }

    const remoteLocalMesocycleId =
      resolveMesocycleCloudLocalId(syncResult.cloudRecord) ??
      payload.local_mesocycle_id;

    await programRepository.markMesocycleSynced(db, {
      mesocycleId: localMesocycle.mesocycle_id,
      cloudMesocycleId,
      remoteLocalMesocycleId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresProgramRepair && allowParentRepair) {
    await syncProgramsWithCloud(db);
    uploadedCount += await uploadDirtyMesocycles(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileMesocyclesFromCloud(db, userId) {
  const { data: cloudMesocycles, error } = await supabase
    .from(MESOCYCLE_CLOUD_TABLE)
    .select(MESOCYCLE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_program_id", { ascending: true })
    .order("mesocycle_number", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: MESOCYCLE_CLOUD_TABLE,
    cloudRecords: cloudMesocycles,
  });

  const [localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localMesocyclesByCloudId = new Map();
  const localMesocyclesBySyncId = new Map();
  const localMesocyclesByRemoteLocalId = new Map();
  const localMesocyclesByLocalId = new Map();
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localProgramsByCloudId = new Map();

  for (const localProgram of localPrograms) {
    const cloudProgramId = parseCloudProgramId(
      resolveSideBySideCloudId(localProgram, "cloud_program_id")
    );

    if (cloudProgramId !== null) {
      localProgramsByCloudId.set(cloudProgramId, localProgram);
    }
  }

  for (const localMesocycle of localMesocycles) {
    const cloudMesocycleId = parseCloudMesocycleId(
      resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
    );
    const syncId = normalizeSyncId(localMesocycle.sync_id);
    const remoteLocalMesocycleId = resolveMesocycleCloudLocalId(localMesocycle);

    if (cloudMesocycleId !== null) {
      localMesocyclesByCloudId.set(cloudMesocycleId, localMesocycle);
    }

    if (syncId) {
      localMesocyclesBySyncId.set(syncId, localMesocycle);
    }

    if (remoteLocalMesocycleId !== null) {
      localMesocyclesByRemoteLocalId.set(remoteLocalMesocycleId, localMesocycle);
    }

    localMesocyclesByLocalId.set(localMesocycle.mesocycle_id, localMesocycle);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudMesocycle of cloudMesocycles ?? []) {
      const cloudMesocycleId = parseCloudMesocycleId(cloudMesocycle.id);
      const cloudSyncId = normalizeSyncId(cloudMesocycle.sync_id);
      const localMesocycleId = normalizeOptionalInteger(
        cloudMesocycle.local_mesocycle_id,
        null
      );
      const cloudProgramId = normalizeOptionalInteger(
        cloudMesocycle.cloud_program_id,
        null
      );
      const parentProgram = localProgramsByCloudId.get(cloudProgramId);
      const comparableCloudMesocycle = getComparableMesocycleSnapshot(
        cloudMesocycle
      );

      if (
        cloudMesocycleId === null ||
        localMesocycleId === null ||
        cloudProgramId === null ||
        !parentProgram
      ) {
        continue;
      }

      const localMesocycle =
        localMesocyclesByCloudId.get(cloudMesocycleId) ??
        localMesocyclesBySyncId.get(cloudSyncId) ??
        localMesocyclesByRemoteLocalId.get(localMesocycleId) ??
        localMesocyclesByLocalId.get(localMesocycleId) ??
        null;

      if (isCloudSnapshotDeleted(cloudMesocycle)) {
        pendingDeletionAcks.push({
          userId,
          tableName: MESOCYCLE_CLOUD_TABLE,
          cloudId: cloudMesocycleId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudMesocycle),
        });

        if (localMesocycle) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localMesocycle,
              cloudMesocycle
            )
          ) {
            continue;
          }

          await deleteLocalMesocycleHierarchy(db, localMesocycle.mesocycle_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localMesocycle) {
        await programRepository.createMesocycleFromCloud(db, {
          localMesocycleId,
          cloudMesocycleId,
          remoteLocalMesocycleId: localMesocycleId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          programId: parentProgram.program_id,
          mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
          weeks: comparableCloudMesocycle.weeks,
          focus: comparableCloudMesocycle.focus,
          done: comparableCloudMesocycle.done,
        });

        const createdMesocycle = {
          mesocycle_id: localMesocycleId,
          cloud_mesocycle_id: cloudMesocycleId,
          remote_local_mesocycle_id: localMesocycleId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudMesocycle.deleted_at),
          program_id: parentProgram.program_id,
          mesocycle_number: comparableCloudMesocycle.mesocycle_number,
          weeks: comparableCloudMesocycle.weeks,
          focus: comparableCloudMesocycle.focus,
          done: comparableCloudMesocycle.done ? 1 : 0,
          needs_sync: 0,
        };

        localMesocyclesByCloudId.set(cloudMesocycleId, createdMesocycle);
        if (cloudSyncId) {
          localMesocyclesBySyncId.set(cloudSyncId, createdMesocycle);
        }
        localMesocyclesByRemoteLocalId.set(localMesocycleId, createdMesocycle);
        localMesocyclesByLocalId.set(localMesocycleId, createdMesocycle);
        downloadedCount += 1;
        continue;
      }

      const comparableLocalMesocycle = getComparableMesocycleSnapshot({
        ...localMesocycle,
        cloud_program_id: parseCloudProgramId(
          resolveSideBySideCloudId(
            localProgramsById.get(localMesocycle.program_id),
            "cloud_program_id"
          )
        ),
      });

      if (Number(localMesocycle.needs_sync) === 1) {
        if (compareEntitySyncVersions(localMesocycle, cloudMesocycle) < 0) {
          await programRepository.updateMesocycleFromCloud(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
            programId: parentProgram.program_id,
            mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
            weeks: comparableCloudMesocycle.weeks,
            focus: comparableCloudMesocycle.focus,
            done: comparableCloudMesocycle.done,
          });
          downloadedCount += 1;
        } else if (
          areComparableMesocyclesEqual(
            comparableLocalMesocycle,
            comparableCloudMesocycle
          )
        ) {
          await programRepository.markMesocycleSynced(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id") === null ||
          resolveMesocycleCloudLocalId(localMesocycle) !== localMesocycleId ||
          normalizeSyncId(localMesocycle.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateMesocycleCloudIdentity(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        }

        continue;
      }

      if (
        areComparableMesocyclesEqual(
          comparableLocalMesocycle,
          comparableCloudMesocycle
        )
      ) {
        if (
          resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id") === null ||
          resolveMesocycleCloudLocalId(localMesocycle) !== localMesocycleId ||
          normalizeSyncId(localMesocycle.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localMesocycle.sync_version, 0) !==
            normalizeSyncVersion(cloudMesocycle.sync_version, 0) ||
          normalizeDeletedAt(localMesocycle.deleted_at) !==
            normalizeDeletedAt(cloudMesocycle.deleted_at)
        ) {
          await programRepository.markMesocycleSynced(db, {
            mesocycleId: localMesocycle.mesocycle_id,
            cloudMesocycleId,
            remoteLocalMesocycleId: localMesocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateMesocycleFromCloud(db, {
        mesocycleId: localMesocycle.mesocycle_id,
        cloudMesocycleId,
        remoteLocalMesocycleId: localMesocycleId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMesocycle.deleted_at),
        programId: parentProgram.program_id,
        mesocycleNumber: comparableCloudMesocycle.mesocycle_number,
        weeks: comparableCloudMesocycle.weeks,
        focus: comparableCloudMesocycle.focus,
        done: comparableCloudMesocycle.done,
      });

      const updatedMesocycle = {
        ...localMesocycle,
        cloud_mesocycle_id: cloudMesocycleId,
        remote_local_mesocycle_id: localMesocycleId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudMesocycle.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudMesocycle.deleted_at),
        program_id: parentProgram.program_id,
        mesocycle_number: comparableCloudMesocycle.mesocycle_number,
        weeks: comparableCloudMesocycle.weeks,
        focus: comparableCloudMesocycle.focus,
        done: comparableCloudMesocycle.done ? 1 : 0,
        needs_sync: 0,
      };

      localMesocyclesByCloudId.set(cloudMesocycleId, updatedMesocycle);
      if (cloudSyncId) {
        localMesocyclesBySyncId.set(cloudSyncId, updatedMesocycle);
      }
      localMesocyclesByRemoteLocalId.set(localMesocycleId, updatedMesocycle);
      localMesocyclesByLocalId.set(localMesocycle.mesocycle_id, updatedMesocycle);
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncMesocyclesWithCloudInternal(db) {
  await syncProgramsWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedMesocycleDeletes(db, userId);
  const uploadedCount = await uploadDirtyMesocycles(db, userId);
  const downloadedCount = await reconcileMesocyclesFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

export function syncMesocyclesInBackground(db) {
  startBackgroundSync(
    () => syncMesocyclesWithCloud(db),
    "Mesocycle cloud sync failed:"
  );
}

export async function syncMesocyclesWithCloud(db) {
  return syncMesocyclesWithCloudInternal(db);
}
