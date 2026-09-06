// Cloud sync for Microcycle: queued deletes, dirty upload, reconcile, and the
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
  MICROCYCLE_CLOUD_SYNC_SELECT,
  MICROCYCLE_CLOUD_TABLE,
  ackCloudDeletionCascade,
  applyQueuedCloudDelete,
  areComparableMicrocyclesEqual,
  buildCloudMicrocyclePayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  deleteLocalMicrocycleHierarchy,
  ensureDefaultDaysForMicrocycle,
  createParentCloudIdCache,
  ensureMesocycleCloudIdentity,
  getAuthenticatedUserId,
  getComparableMicrocycleSnapshot,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudMesocycleId,
  parseCloudMicrocycleId,
  resolveCloudDeleteRequestedAt,
  resolveSideBySideCloudId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncMesocyclesWithCloud } from "./mesocycleSync";

export async function processQueuedMicrocycleDeletes(db, userId) {
  const queuedDeletes = await programRepository.getQueuedMicrocycleDeletes(db);
  let deletedCount = 0;

  for (const queuedDelete of queuedDeletes) {
    const wasDeletedNow = await applyQueuedCloudDelete({
      tableName: MICROCYCLE_CLOUD_TABLE,
      selectColumns: MICROCYCLE_CLOUD_SYNC_SELECT,
      userId,
      cloudId: parseCloudMicrocycleId(queuedDelete.cloud_microcycle_id),
      syncId: normalizeSyncId(queuedDelete.sync_id),
      deletedAt: normalizeDeletedAt(queuedDelete.deleted_at),
      syncVersion: normalizeSyncVersion(queuedDelete.sync_version, 0),
    });

    await programRepository.deleteQueuedMicrocycleDelete(
      db,
      queuedDelete.microcycle_sync_delete_id
    );
    deletedCount += wasDeletedNow ? 1 : 0;
  }

  return deletedCount;
}

export async function uploadDirtyMicrocycles(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localMicrocycles, localMesocycles] = await Promise.all([
    programRepository.getMicrocyclesForCloudSync(db, { dirtyOnly: true }),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const resolveParentMesocycleCloudId = createParentCloudIdCache(
    ensureMesocycleCloudIdentity
  );
  let uploadedCount = 0;
  let requiresMesocycleRepair = false;

  for (const localMicrocycle of localMicrocycles) {
    if (Number(localMicrocycle.needs_sync) !== 1) {
      continue;
    }

    const parentMesocycle = localMesocyclesById.get(
      localMicrocycle.mesocycle_id
    );
    const parentMesocycleCloudId = await resolveParentMesocycleCloudId(
      db,
      userId,
      parentMesocycle,
      localMicrocycle.mesocycle_id
    );

    if (parentMesocycleCloudId === null) {
      requiresMesocycleRepair = true;
      continue;
    }

    const payload = buildCloudMicrocyclePayload(
      localMicrocycle,
      userId,
      parentMesocycleCloudId
    );

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: MICROCYCLE_CLOUD_TABLE,
      selectColumns: MICROCYCLE_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localMicrocycle,
      payload,
      cloudId: parseCloudMicrocycleId(
        resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
      ),
      syncId: normalizeSyncId(localMicrocycle.sync_id),
      legacyLocalId: payload.local_microcycle_id,
      legacyLocalIdColumn: "local_microcycle_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudMicrocycleId = parseCloudMicrocycleId(syncResult.cloudRecord?.id);

    if (cloudMicrocycleId === null) {
      throw new Error("Could not resolve cloud microcycle id after sync.");
    }

    await programRepository.markMicrocycleSynced(db, {
      microcycleId: localMicrocycle.microcycle_id,
      cloudMicrocycleId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresMesocycleRepair && allowParentRepair) {
    await syncMesocyclesWithCloud(db);
    uploadedCount += await uploadDirtyMicrocycles(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileMicrocyclesFromCloud(db, userId) {
  const { data: cloudMicrocycles, error } = await supabase
    .from(MICROCYCLE_CLOUD_TABLE)
    .select(MICROCYCLE_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_mesocycle_id", { ascending: true })
    .order("microcycle_number", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: MICROCYCLE_CLOUD_TABLE,
    cloudRecords: cloudMicrocycles,
  });

  const [localMicrocycles, localMesocycles, localPrograms] = await Promise.all([
    programRepository.getMicrocyclesForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
    programRepository.getProgramsForCloudSync(db),
  ]);
  const localMicrocyclesByCloudId = new Map();
  const localMicrocyclesBySyncId = new Map();
  const localMicrocyclesByLocalId = new Map();
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localMesocyclesByCloudId = new Map();
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );

  for (const localMesocycle of localMesocycles) {
    const cloudMesocycleId = parseCloudMesocycleId(
      resolveSideBySideCloudId(localMesocycle, "cloud_mesocycle_id")
    );

    if (cloudMesocycleId !== null) {
      localMesocyclesByCloudId.set(cloudMesocycleId, localMesocycle);
    }
  }

  for (const localMicrocycle of localMicrocycles) {
    const cloudMicrocycleId = parseCloudMicrocycleId(
      resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
    );
    const syncId = normalizeSyncId(localMicrocycle.sync_id);

    if (cloudMicrocycleId !== null) {
      localMicrocyclesByCloudId.set(cloudMicrocycleId, localMicrocycle);
    }

    if (syncId) {
      localMicrocyclesBySyncId.set(syncId, localMicrocycle);
    }

    localMicrocyclesByLocalId.set(localMicrocycle.microcycle_id, localMicrocycle);
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudMicrocycle of cloudMicrocycles ?? []) {
      const cloudMicrocycleId = parseCloudMicrocycleId(cloudMicrocycle.id);
      const cloudSyncId = normalizeSyncId(cloudMicrocycle.sync_id);
      const localMicrocycleId = normalizeOptionalInteger(
        cloudMicrocycle.local_microcycle_id,
        null
      );
      const cloudMesocycleId = normalizeOptionalInteger(
        cloudMicrocycle.cloud_mesocycle_id,
        null
      );
      const parentMesocycle = localMesocyclesByCloudId.get(cloudMesocycleId);
      const parentProgram = localProgramsById.get(parentMesocycle?.program_id);
      const comparableCloudMicrocycle = getComparableMicrocycleSnapshot(
        cloudMicrocycle
      );

      if (
        cloudMicrocycleId === null ||
        localMicrocycleId === null ||
        cloudMesocycleId === null ||
        !parentMesocycle ||
        !parentProgram?.start_date
      ) {
        continue;
      }

      const localMicrocycle =
        localMicrocyclesByCloudId.get(cloudMicrocycleId) ??
        localMicrocyclesBySyncId.get(cloudSyncId) ??
        localMicrocyclesByLocalId.get(localMicrocycleId) ??
        null;

      if (isCloudSnapshotDeleted(cloudMicrocycle)) {
        pendingDeletionAcks.push({
          userId,
          tableName: MICROCYCLE_CLOUD_TABLE,
          cloudId: cloudMicrocycleId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudMicrocycle),
        });

        if (localMicrocycle) {
          if (
            shouldKeepLocalEntityForCloudTombstone(
              localMicrocycle,
              cloudMicrocycle
            )
          ) {
            continue;
          }

          await deleteLocalMicrocycleHierarchy(db, localMicrocycle.microcycle_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localMicrocycle) {
        await programRepository.createMicrocycleFromCloud(db, {
          localMicrocycleId,
          cloudMicrocycleId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          mesocycleId: parentMesocycle.mesocycle_id,
          microcycleNumber: comparableCloudMicrocycle.microcycle_number,
          focus: comparableCloudMicrocycle.focus,
          done: comparableCloudMicrocycle.done,
        });

        await ensureDefaultDaysForMicrocycle(db, {
          microcycleId: localMicrocycleId,
          programId: parentProgram.program_id,
          mesocycleNumber: parentMesocycle.mesocycle_number,
          microcycleNumber: comparableCloudMicrocycle.microcycle_number,
          startDate: parentProgram.start_date,
        });

        const createdMicrocycle = {
          microcycle_id: localMicrocycleId,
          cloud_microcycle_id: cloudMicrocycleId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          mesocycle_id: parentMesocycle.mesocycle_id,
          microcycle_number: comparableCloudMicrocycle.microcycle_number,
          focus: comparableCloudMicrocycle.focus,
          done: comparableCloudMicrocycle.done ? 1 : 0,
          needs_sync: 0,
        };

        localMicrocyclesByCloudId.set(cloudMicrocycleId, createdMicrocycle);
        if (cloudSyncId) {
          localMicrocyclesBySyncId.set(cloudSyncId, createdMicrocycle);
        }
        localMicrocyclesByLocalId.set(localMicrocycleId, createdMicrocycle);
        downloadedCount += 1;
        continue;
      }

      await ensureDefaultDaysForMicrocycle(db, {
        microcycleId: localMicrocycle.microcycle_id,
        programId: parentProgram.program_id,
        mesocycleNumber: parentMesocycle.mesocycle_number,
        microcycleNumber: comparableCloudMicrocycle.microcycle_number,
        startDate: parentProgram.start_date,
      });

      const comparableLocalMicrocycle = getComparableMicrocycleSnapshot({
        ...localMicrocycle,
        cloud_mesocycle_id: parseCloudMesocycleId(
          resolveSideBySideCloudId(parentMesocycle, "cloud_mesocycle_id")
        ),
      });

      if (Number(localMicrocycle.needs_sync) === 1) {
        if (compareEntitySyncVersions(localMicrocycle, cloudMicrocycle) < 0) {
          await programRepository.updateMicrocycleFromCloud(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
            mesocycleId: parentMesocycle.mesocycle_id,
            microcycleNumber: comparableCloudMicrocycle.microcycle_number,
            focus: comparableCloudMicrocycle.focus,
            done: comparableCloudMicrocycle.done,
          });
          downloadedCount += 1;
        } else if (
          areComparableMicrocyclesEqual(
            comparableLocalMicrocycle,
            comparableCloudMicrocycle
          )
        ) {
          await programRepository.markMicrocycleSynced(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id") === null ||
          normalizeSyncId(localMicrocycle.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateMicrocycleCloudIdentity(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        }

        continue;
      }

      if (
        areComparableMicrocyclesEqual(
          comparableLocalMicrocycle,
          comparableCloudMicrocycle
        )
      ) {
        if (
          resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id") === null ||
          normalizeSyncId(localMicrocycle.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localMicrocycle.sync_version, 0) !==
            normalizeSyncVersion(cloudMicrocycle.sync_version, 0) ||
          normalizeDeletedAt(localMicrocycle.deleted_at) !==
            normalizeDeletedAt(cloudMicrocycle.deleted_at)
        ) {
          await programRepository.markMicrocycleSynced(db, {
            microcycleId: localMicrocycle.microcycle_id,
            cloudMicrocycleId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateMicrocycleFromCloud(db, {
        microcycleId: localMicrocycle.microcycle_id,
        cloudMicrocycleId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudMicrocycle.deleted_at),
        mesocycleId: parentMesocycle.mesocycle_id,
        microcycleNumber: comparableCloudMicrocycle.microcycle_number,
        focus: comparableCloudMicrocycle.focus,
        done: comparableCloudMicrocycle.done,
      });

      const updatedMicrocycle = {
        ...localMicrocycle,
        cloud_microcycle_id: cloudMicrocycleId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudMicrocycle.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudMicrocycle.deleted_at),
        mesocycle_id: parentMesocycle.mesocycle_id,
        microcycle_number: comparableCloudMicrocycle.microcycle_number,
        focus: comparableCloudMicrocycle.focus,
        done: comparableCloudMicrocycle.done ? 1 : 0,
        needs_sync: 0,
      };

      localMicrocyclesByCloudId.set(cloudMicrocycleId, updatedMicrocycle);
      if (cloudSyncId) {
        localMicrocyclesBySyncId.set(cloudSyncId, updatedMicrocycle);
      }
      localMicrocyclesByLocalId.set(
        localMicrocycle.microcycle_id,
        updatedMicrocycle
      );
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncMicrocyclesWithCloudInternal(db) {
  await syncMesocyclesWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      deletedCount: 0,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const deletedCount = await processQueuedMicrocycleDeletes(db, userId);
  const uploadedCount = await uploadDirtyMicrocycles(db, userId);
  const downloadedCount = await reconcileMicrocyclesFromCloud(db, userId);

  return {
    changed: deletedCount > 0 || uploadedCount > 0 || downloadedCount > 0,
    deletedCount,
    downloadedCount,
    uploadedCount,
  };
}

export function syncMicrocyclesInBackground(db) {
  startBackgroundSync(
    () => syncMicrocyclesWithCloud(db),
    "Microcycle cloud sync failed:"
  );
}

export async function syncMicrocyclesWithCloud(db) {
  return syncMicrocyclesWithCloudInternal(db);
}
