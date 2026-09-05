import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

import { locationSchemaSql } from "../Database/schema/location";
import { getActiveDatabaseName } from "../Database/localDatabase";
import * as locationService from "./locationService";

// Registers the background location task. This used to sit in App.js, where it
// was a third of the file and had nothing to do with app setup.
//
// Importing this module registers the task as a side effect - that is how
// expo-task-manager works, and the registration has to happen at module scope
// so the OS can find the task when it wakes the app with no UI running.

// The location task fires roughly every second while a run is tracked, so it
// keeps one cached connection per database instead of opening, migrating, and
// closing a fresh connection for every GPS batch. The old approach raced the
// foreground app for the write lock and made whole batches of points disappear
// whenever SQLite reported "database is locked".
const locationTaskDatabaseCache = {
  name: null,
  openPromise: null,
};

async function openLocationTaskDatabase(databaseName) {
  const db = await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });

  // busy_timeout is a per-connection setting: without it a concurrent write
  // from the app connection makes inserts fail instantly instead of waiting.
  // The location tables are created idempotently so the task never has to run
  // the full migration suite inside a headless background invocation.
  await db.execAsync(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    ${locationSchemaSql}
  `);

  return db;
}

function getLocationTaskDatabase(databaseName) {
  if (
    locationTaskDatabaseCache.name !== databaseName ||
    !locationTaskDatabaseCache.openPromise
  ) {
    const staleOpenPromise = locationTaskDatabaseCache.openPromise;

    locationTaskDatabaseCache.name = databaseName;
    locationTaskDatabaseCache.openPromise = (async () => {
      if (staleOpenPromise) {
        try {
          const staleDb = await staleOpenPromise;
          await staleDb.closeAsync();
        } catch {
          // The stale connection is unusable either way.
        }
      }

      return openLocationTaskDatabase(databaseName);
    })();
  }

  return locationTaskDatabaseCache.openPromise;
}

function resetLocationTaskDatabaseCache() {
  locationTaskDatabaseCache.name = null;
  locationTaskDatabaseCache.openPromise = null;
}

function isUnusableDatabaseConnectionError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    message.includes("closed resource") ||
    message.includes("database is closed") ||
    message.includes("access to closed") ||
    message.includes("connection") ||
    message.includes("nullpointer")
  );
}

TaskManager.defineTask(locationService.RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data?.locations?.length) return;

  const persistLocations = async () => {
    const databaseName = await getActiveDatabaseName();
    const db = await getLocationTaskDatabase(databaseName);
    await locationService.recordTrackedLocations(db, data.locations);
  };

  try {
    await persistLocations();
  } catch (taskError) {
    if (!isUnusableDatabaseConnectionError(taskError)) {
      console.error("Failed to persist tracked run locations:", taskError);
      return;
    }

    // The OS can recycle the background process and leave a dead cached
    // handle behind. Reopen once and retry so a single stale connection
    // cannot break tracking for the rest of the run.
    resetLocationTaskDatabaseCache();

    try {
      await persistLocations();
    } catch (retryError) {
      console.error("Failed to persist tracked run locations:", retryError);
    }
  }
});
