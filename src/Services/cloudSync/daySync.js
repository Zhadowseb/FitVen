// Cloud sync for Day: queued deletes, dirty upload, reconcile, and the
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
  DAY_CLOUD_SYNC_SELECT,
  DAY_CLOUD_TABLE,
  ackCloudDeletionCascade,
  areComparableDaysEqual,
  buildCloudDayPayload,
  claimCloudWatchers,
  compareEntitySyncVersions,
  deleteLocalDayHierarchy,
  ensureMicrocycleCloudIdentity,
  getAuthenticatedUserId,
  getComparableDaySnapshot,
  getDayIdentityKey,
  getStandaloneDayIdentityKey,
  isCloudSnapshotDeleted,
  normalizeOptionalInteger,
  parseCloudDayId,
  parseCloudMicrocycleId,
  resolveCloudDeleteRequestedAt,
  resolveDayCloudLocalId,
  resolveDayDateFallback,
  resolveSideBySideCloudId,
  shouldKeepLocalEntityForCloudTombstone,
  syncDirtyLocalRowToCloud,
} from "./cloudSyncShared";
import { syncMicrocyclesWithCloud } from "./microcycleSync";

export async function uploadDirtyDays(
  db,
  userId,
  { allowParentRepair = true } = {}
) {
  const [localDays, localMicrocycles] = await Promise.all([
    programRepository.getDaysForCloudSync(db),
    programRepository.getMicrocyclesForCloudSync(db),
  ]);
  const [localPrograms, localMesocycles] = await Promise.all([
    programRepository.getProgramsForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localMicrocyclesById = new Map(
    localMicrocycles.map((microcycle) => [microcycle.microcycle_id, microcycle])
  );
  let uploadedCount = 0;
  let requiresMicrocycleRepair = false;

  for (const localDay of localDays) {
    if (Number(localDay.needs_sync) !== 1) {
      continue;
    }

    const parentMicrocycleId = normalizeOptionalInteger(
      localDay.microcycle_id,
      null
    );
    const parentMicrocycle =
      parentMicrocycleId !== null
        ? localMicrocyclesById.get(parentMicrocycleId)
        : null;
    const parentMicrocycleCloudId =
      parentMicrocycleId !== null
        ? await ensureMicrocycleCloudIdentity(db, userId, parentMicrocycle)
        : null;

    if (parentMicrocycleId !== null && parentMicrocycleCloudId === null) {
      requiresMicrocycleRepair = true;
      continue;
    }

    const payload = buildCloudDayPayload(localDay, userId, parentMicrocycleCloudId);
    const resolvedPayloadDate =
      payload.date ??
      (await resolveDayDateFallback(db, {
        programId: localDay.program_id,
        programStartDate: localProgramsById.get(localDay.program_id)?.start_date,
        mesocycleNumber:
          localMesocyclesById.get(parentMicrocycle?.mesocycle_id)?.mesocycle_number,
        microcycleNumber: parentMicrocycle?.microcycle_number,
        weekday: localDay.weekday ?? localDay.Weekday,
      }));

    if (
      payload.local_day_id === null ||
      !payload.weekday ||
      !resolvedPayloadDate
    ) {
      continue;
    }

    const syncResult = await syncDirtyLocalRowToCloud({
      tableName: DAY_CLOUD_TABLE,
      selectColumns: DAY_CLOUD_SYNC_SELECT,
      userId,
      localEntity: localDay,
      payload: {
        ...payload,
        date: resolvedPayloadDate,
      },
      cloudId: parseCloudDayId(
        resolveSideBySideCloudId(localDay, "cloud_day_id")
      ),
      syncId: normalizeSyncId(localDay.sync_id),
      legacyLocalId: payload.local_day_id,
      legacyLocalIdColumn: "local_day_id",
    });

    if (!syncResult.uploaded) {
      continue;
    }

    const cloudDayId = parseCloudDayId(syncResult.cloudRecord?.id);

    if (cloudDayId === null) {
      throw new Error("Could not resolve cloud day id after sync.");
    }

    const remoteLocalDayId =
      resolveDayCloudLocalId(syncResult.cloudRecord) ?? payload.local_day_id;

    await programRepository.markDaySynced(db, {
      dayId: localDay.day_id,
      cloudDayId,
      remoteLocalDayId,
      syncId: normalizeSyncId(syncResult.cloudRecord?.sync_id),
      syncVersion: normalizeSyncVersion(syncResult.cloudRecord?.sync_version, 0),
      deletedAt: normalizeDeletedAt(syncResult.cloudRecord?.deleted_at),
    });
    uploadedCount += 1;
  }

  if (requiresMicrocycleRepair && allowParentRepair) {
    await syncMicrocyclesWithCloud(db);
    uploadedCount += await uploadDirtyDays(db, userId, {
      allowParentRepair: false,
    });
  }

  return uploadedCount;
}

async function reconcileDaysFromCloud(db, userId) {
  const { data: cloudDays, error } = await supabase
    .from(DAY_CLOUD_TABLE)
    .select(DAY_CLOUD_SYNC_SELECT)
    .eq("user_id", userId)
    .order("cloud_microcycle_id", { ascending: true })
    .order("weekday", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  await claimCloudWatchers({
    userId,
    tableName: DAY_CLOUD_TABLE,
    cloudRecords: cloudDays,
  });

  const [localPrograms, localDays, localMicrocycles, localMesocycles] = await Promise.all([
    programRepository.getProgramsForCloudSync(db),
    programRepository.getDaysForCloudSync(db),
    programRepository.getMicrocyclesForCloudSync(db),
    programRepository.getMesocyclesForCloudSync(db),
  ]);
  const localProgramsById = new Map(
    localPrograms.map((program) => [program.program_id, program])
  );
  const localMicrocyclesByCloudId = new Map();
  const localMesocyclesById = new Map(
    localMesocycles.map((mesocycle) => [mesocycle.mesocycle_id, mesocycle])
  );
  const localDaysByCloudId = new Map();
  const localDaysBySyncId = new Map();
  const localDaysByRemoteLocalId = new Map();
  const localDaysByLocalId = new Map();
  const localDaysByIdentityKey = new Map();

  for (const localMicrocycle of localMicrocycles) {
    const cloudMicrocycleId = parseCloudMicrocycleId(
      resolveSideBySideCloudId(localMicrocycle, "cloud_microcycle_id")
    );

    if (cloudMicrocycleId !== null) {
      localMicrocyclesByCloudId.set(cloudMicrocycleId, localMicrocycle);
    }
  }

  for (const localDay of localDays) {
    const cloudDayId = parseCloudDayId(
      resolveSideBySideCloudId(localDay, "cloud_day_id")
    );
    const syncId = normalizeSyncId(localDay.sync_id);
    const remoteLocalDayId = resolveDayCloudLocalId(localDay);
    const identityKey =
      normalizeOptionalInteger(localDay.microcycle_id, null) === null
        ? getStandaloneDayIdentityKey(localDay.date)
        : getDayIdentityKey(
            localDay.microcycle_id,
            localDay.weekday ?? localDay.Weekday
          );

    if (cloudDayId !== null) {
      localDaysByCloudId.set(cloudDayId, localDay);
    }

    if (syncId) {
      localDaysBySyncId.set(syncId, localDay);
    }

    if (remoteLocalDayId !== null) {
      localDaysByRemoteLocalId.set(remoteLocalDayId, localDay);
    }

    localDaysByLocalId.set(localDay.day_id, localDay);

    if (identityKey && !localDaysByIdentityKey.has(identityKey)) {
      localDaysByIdentityKey.set(identityKey, localDay);
    }
  }

  let downloadedCount = 0;
  const pendingDeletionAcks = [];

  await withTransaction(db, async () => {
    for (const cloudDay of cloudDays ?? []) {
      const cloudDayId = parseCloudDayId(cloudDay.id);
      const cloudSyncId = normalizeSyncId(cloudDay.sync_id);
      const localDayId = normalizeOptionalInteger(cloudDay.local_day_id, null);
      const cloudMicrocycleId = normalizeOptionalInteger(
        cloudDay.cloud_microcycle_id,
        null
      );
      const isStandaloneCloudDay = cloudMicrocycleId === null;
      const parentMicrocycle = isStandaloneCloudDay
        ? null
        : localMicrocyclesByCloudId.get(cloudMicrocycleId);
      const parentMesocycle = isStandaloneCloudDay
        ? null
        : localMesocyclesById.get(parentMicrocycle?.mesocycle_id);
      const comparableCloudDay = getComparableDaySnapshot(cloudDay);
      const parentProgram = localProgramsById.get(parentMesocycle?.program_id);
      const resolvedCloudDayDate =
        comparableCloudDay.date ??
        (await resolveDayDateFallback(db, {
          programId: parentMesocycle?.program_id,
          programStartDate: parentProgram?.start_date,
          mesocycleNumber: parentMesocycle?.mesocycle_number,
          microcycleNumber: parentMicrocycle?.microcycle_number,
          weekday: comparableCloudDay.weekday,
        }));
      const normalizedCloudDay = {
        ...comparableCloudDay,
        date: resolvedCloudDayDate,
      };
      const identityKey = isStandaloneCloudDay
        ? getStandaloneDayIdentityKey(normalizedCloudDay.date)
        : getDayIdentityKey(
            parentMicrocycle?.microcycle_id,
            normalizedCloudDay.weekday
          );

      if (
        cloudDayId === null ||
        localDayId === null ||
        !normalizedCloudDay.weekday ||
        !normalizedCloudDay.date ||
        (!isStandaloneCloudDay && (!parentMicrocycle || !parentMesocycle))
      ) {
        continue;
      }

      const localDay =
        localDaysByCloudId.get(cloudDayId) ??
        localDaysBySyncId.get(cloudSyncId) ??
        localDaysByRemoteLocalId.get(localDayId) ??
        localDaysByLocalId.get(localDayId) ??
        (identityKey ? localDaysByIdentityKey.get(identityKey) : null) ??
        null;

      if (isCloudSnapshotDeleted(cloudDay)) {
        pendingDeletionAcks.push({
          userId,
          tableName: DAY_CLOUD_TABLE,
          cloudId: cloudDayId,
          deleteRequestedAt: resolveCloudDeleteRequestedAt(cloudDay),
        });

        if (localDay) {
          if (shouldKeepLocalEntityForCloudTombstone(localDay, cloudDay)) {
            continue;
          }

          await deleteLocalDayHierarchy(db, localDay.day_id);
          downloadedCount += 1;
        }

        continue;
      }

      if (!localDay) {
        const result = await programRepository.createDayFromCloud(db, {
          cloudDayId,
          remoteLocalDayId: localDayId,
          syncId: cloudSyncId,
          syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
          deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          microcycleId: parentMicrocycle?.microcycle_id ?? null,
          programId: parentMesocycle?.program_id ?? null,
          weekday: normalizedCloudDay.weekday,
          date: normalizedCloudDay.date,
          done: normalizedCloudDay.done,
          isSick: normalizedCloudDay.is_sick,
        });

        const createdDay = {
          day_id: result.lastInsertRowId,
          cloud_day_id: cloudDayId,
          remote_local_day_id: localDayId,
          sync_id: cloudSyncId,
          sync_version: normalizeSyncVersion(cloudDay.sync_version, 0),
          deleted_at: normalizeDeletedAt(cloudDay.deleted_at),
          microcycle_id: parentMicrocycle?.microcycle_id ?? null,
          program_id: parentMesocycle?.program_id ?? null,
          weekday: normalizedCloudDay.weekday,
          date: normalizedCloudDay.date,
          done: normalizedCloudDay.done ? 1 : 0,
          is_sick: normalizedCloudDay.is_sick ? 1 : 0,
          needs_sync: 0,
        };

        localDaysByCloudId.set(cloudDayId, createdDay);
        if (cloudSyncId) {
          localDaysBySyncId.set(cloudSyncId, createdDay);
        }
        localDaysByRemoteLocalId.set(localDayId, createdDay);
        localDaysByLocalId.set(createdDay.day_id, createdDay);
        if (identityKey) {
          localDaysByIdentityKey.set(identityKey, createdDay);
        }
        downloadedCount += 1;
        continue;
      }

      const comparableLocalDay = getComparableDaySnapshot({
        ...localDay,
        cloud_microcycle_id: isStandaloneCloudDay
          ? null
          : parseCloudMicrocycleId(
              resolveSideBySideCloudId(parentMicrocycle, "cloud_microcycle_id")
            ),
      });

      if (Number(localDay.needs_sync) === 1) {
        if (compareEntitySyncVersions(localDay, cloudDay) < 0) {
          await programRepository.updateDayFromCloud(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
            microcycleId: parentMicrocycle?.microcycle_id ?? null,
            programId: parentMesocycle?.program_id ?? null,
            weekday: normalizedCloudDay.weekday,
            date: normalizedCloudDay.date,
            done: normalizedCloudDay.done,
            isSick: normalizedCloudDay.is_sick,
          });
          downloadedCount += 1;
        } else if (areComparableDaysEqual(comparableLocalDay, normalizedCloudDay)) {
          await programRepository.markDaySynced(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        } else if (
          resolveSideBySideCloudId(localDay, "cloud_day_id") === null ||
          resolveDayCloudLocalId(localDay) !== localDayId ||
          normalizeSyncId(localDay.sync_id) !== cloudSyncId
        ) {
          await programRepository.updateDayCloudIdentity(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        }
        continue;
      }

      if (areComparableDaysEqual(comparableLocalDay, normalizedCloudDay)) {
        if (
          resolveSideBySideCloudId(localDay, "cloud_day_id") === null ||
          resolveDayCloudLocalId(localDay) !== localDayId ||
          normalizeSyncId(localDay.sync_id) !== cloudSyncId ||
          normalizeSyncVersion(localDay.sync_version, 0) !==
            normalizeSyncVersion(cloudDay.sync_version, 0) ||
          normalizeDeletedAt(localDay.deleted_at) !==
            normalizeDeletedAt(cloudDay.deleted_at)
        ) {
          await programRepository.markDaySynced(db, {
            dayId: localDay.day_id,
            cloudDayId,
            remoteLocalDayId: localDayId,
            syncId: cloudSyncId,
            syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
            deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
          });
        }
        continue;
      }

      await programRepository.updateDayFromCloud(db, {
        dayId: localDay.day_id,
        cloudDayId,
        remoteLocalDayId: localDayId,
        syncId: cloudSyncId,
        syncVersion: normalizeSyncVersion(cloudDay.sync_version, 0),
        deletedAt: normalizeDeletedAt(cloudDay.deleted_at),
        microcycleId: parentMicrocycle?.microcycle_id ?? null,
        programId: parentMesocycle?.program_id ?? null,
        weekday: normalizedCloudDay.weekday,
        date: normalizedCloudDay.date,
        done: normalizedCloudDay.done,
        isSick: normalizedCloudDay.is_sick,
      });

      const updatedDay = {
        ...localDay,
        cloud_day_id: cloudDayId,
        remote_local_day_id: localDayId,
        sync_id: cloudSyncId,
        sync_version: normalizeSyncVersion(cloudDay.sync_version, 0),
        deleted_at: normalizeDeletedAt(cloudDay.deleted_at),
        microcycle_id: parentMicrocycle?.microcycle_id ?? null,
        program_id: parentMesocycle?.program_id ?? null,
        weekday: normalizedCloudDay.weekday,
        date: normalizedCloudDay.date,
        done: normalizedCloudDay.done ? 1 : 0,
        is_sick: normalizedCloudDay.is_sick ? 1 : 0,
        needs_sync: 0,
      };

      localDaysByCloudId.set(cloudDayId, updatedDay);
      if (cloudSyncId) {
        localDaysBySyncId.set(cloudSyncId, updatedDay);
      }
      localDaysByRemoteLocalId.set(localDayId, updatedDay);
      localDaysByLocalId.set(localDay.day_id, updatedDay);
      if (identityKey) {
        localDaysByIdentityKey.set(identityKey, updatedDay);
      }
      downloadedCount += 1;
    }
  });

  for (const deletionAck of pendingDeletionAcks) {
    await ackCloudDeletionCascade(deletionAck);
  }

  return downloadedCount;
}

async function syncDaysWithCloudInternal(db) {
  await syncMicrocyclesWithCloud(db);

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      changed: false,
      downloadedCount: 0,
      uploadedCount: 0,
    };
  }

  const initialDownloadedCount = await reconcileDaysFromCloud(db, userId);
  const uploadedCount = await uploadDirtyDays(db, userId);
  const finalDownloadedCount = await reconcileDaysFromCloud(db, userId);
  const downloadedCount = initialDownloadedCount + finalDownloadedCount;

  return {
    changed: uploadedCount > 0 || downloadedCount > 0,
    downloadedCount,
    uploadedCount,
  };
}

export function syncDaysInBackground(db) {
  startBackgroundSync(
    () => syncDaysWithCloud(db),
    "Day cloud sync failed:"
  );
}

export async function syncDaysWithCloud(db) {
  return syncDaysWithCloudInternal(db);
}
