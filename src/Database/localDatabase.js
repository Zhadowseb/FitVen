import * as SQLite from "expo-sqlite";

import { initializeDatabase } from "./db";
import { withTransaction } from "./transaction";
import {
  formatDate,
  normalizeLocalDateString,
  parseCustomDate,
} from "../Utils/dateUtils";

const LEGACY_DATABASE_NAME = "datab.db";
const ANONYMOUS_DATABASE_NAME = "datab-anon.db";
const USER_DATABASE_PREFIX = "datab-user";
const ACTIVE_DATABASE_NAME_STORAGE_KEY = "fitapp.active-database-name";
const LEGACY_DATABASE_OWNER_STORAGE_KEY = "fitapp.legacy-database-owner-user-id";

const LEGACY_COPY_TABLE_ORDER = [
  "Program",
  "Program_Sync_Delete",
  "Program_Best_Exercise",
  "Mesocycle",
  "Mesocycle_Sync_Delete",
  "Microcycle",
  "Microcycle_Sync_Delete",
  "Day",
  "Sickness",
  "Workout_Type",
  "Workout_Type_Instance",
  "Workout_Type_Instance_Sync_Delete",
  "Exercise",
  "Exercise_Instance",
  "Exercise_Instance_Sync_Delete",
  "Set",
  "Set_Sync_Delete",
  "Estimated_Set",
  "RMWeightProgression",
  "Run",
  "LocationLog",
  "LocationDebugLog",
];

const USER_DATA_TABLES = [
  "Program",
  "Mesocycle",
  "Microcycle",
  "Day",
  "Sickness",
  "Workout_Type_Instance",
  "Exercise_Instance",
  "Set",
  "Estimated_Set",
  "RMWeightProgression",
  "Run",
];

function getLocalStorage() {
  return globalThis.localStorage ?? null;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

const WEEKDAY_INDEX = new Map([
  ["Monday", 0],
  ["Tuesday", 1],
  ["Wednesday", 2],
  ["Thursday", 3],
  ["Friday", 4],
  ["Saturday", 5],
  ["Sunday", 6],
]);

function getStoredValue(key) {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key, value) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    if (value === null || value === undefined || value === "") {
      storage.removeItem(key);
      return;
    }

    storage.setItem(key, String(value));
  } catch {
    // Ignore local storage write failures so auth still works.
  }
}

function sanitizeUserIdForDatabaseName(userId) {
  return String(userId)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function listTableNames(db) {
  const rows = await db.getAllAsync(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name ASC;`
  );

  return rows.map((row) => row.name).filter(Boolean);
}

async function tableHasRows(db, tableName) {
  const row = await db.getFirstAsync(
    `SELECT 1 AS has_row
     FROM ${quoteIdentifier(tableName)}
     LIMIT 1;`
  );

  return Boolean(row?.has_row);
}

async function databaseHasUserData(db) {
  for (const tableName of USER_DATA_TABLES) {
    if (await tableHasRows(db, tableName)) {
      return true;
    }
  }

  return false;
}

async function copyTableRows(sourceDb, targetDb, tableName) {
  if (tableName === "Day") {
    const targetColumns = await targetDb.getAllAsync(
      `PRAGMA table_info(${quoteIdentifier(tableName)});`
    );
    const targetColumnNames = targetColumns.map((column) => column.name);
    const sourceRows = await sourceDb.getAllAsync(
      `SELECT
         d.*,
         p.start_date AS program_start_date,
         mc.microcycle_number,
         m.mesocycle_number
       FROM Day d
       LEFT JOIN Microcycle mc ON mc.microcycle_id = d.microcycle_id
       LEFT JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       LEFT JOIN Program p ON p.program_id = d.program_id
       ORDER BY d.day_id ASC;`
    );
    const mesocycleRows = await sourceDb.getAllAsync(
      `SELECT program_id, mesocycle_number, weeks
       FROM Mesocycle
       ORDER BY program_id ASC, mesocycle_number ASC;`
    );
    const weeksBeforeByProgramAndMesocycle = new Map();
    const cumulativeWeeksByProgram = new Map();

    for (const row of mesocycleRows) {
      const programId = Number(row.program_id);
      const mesocycleNumber = Number(row.mesocycle_number);
      const weeks = Number(row.weeks) || 0;
      const cumulativeWeeks = cumulativeWeeksByProgram.get(programId) || 0;

      weeksBeforeByProgramAndMesocycle.set(
        `${programId}:${mesocycleNumber}`,
        cumulativeWeeks
      );
      cumulativeWeeksByProgram.set(programId, cumulativeWeeks + weeks);
    }

    for (const row of sourceRows) {
      const normalizedDate = normalizeLocalDateString(row.date);
      const normalizedStartDate = normalizeLocalDateString(row.program_start_date);
      const weekdayIndex = WEEKDAY_INDEX.get(String(row.Weekday ?? "").trim());
      const programId = Number(row.program_id);
      const mesocycleNumber = Number(row.mesocycle_number);
      const microcycleNumber = Number(row.microcycle_number);

      let resolvedDate = normalizedDate;

      if (
        !resolvedDate &&
        normalizedStartDate &&
        weekdayIndex !== undefined &&
        Number.isFinite(programId) &&
        Number.isFinite(mesocycleNumber) &&
        Number.isFinite(microcycleNumber)
      ) {
        const weeksBefore =
          weeksBeforeByProgramAndMesocycle.get(
            `${programId}:${mesocycleNumber}`
          ) || 0;
        const date = parseCustomDate(normalizedStartDate);
        date.setDate(
          date.getDate() + (weeksBefore + microcycleNumber - 1) * 7 + weekdayIndex
        );
        resolvedDate = formatDate(date);
      }

      if (!resolvedDate) {
        continue;
      }

      const sourceColumnNames = targetColumnNames;
      const columnListSql = sourceColumnNames.map(quoteIdentifier).join(", ");
      const placeholdersSql = sourceColumnNames.map(() => "?").join(", ");
      const values = sourceColumnNames.map((columnName) =>
        columnName === "date"
          ? resolvedDate
          : columnName === "is_sick" &&
              !Object.prototype.hasOwnProperty.call(row, columnName)
            ? 0
          : Object.prototype.hasOwnProperty.call(row, columnName)
            ? row[columnName]
            : null
      );

      await targetDb.runAsync(
        `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${columnListSql})
         VALUES (${placeholdersSql});`,
        values
      );
    }

    return;
  }

  const [sourceColumns, targetColumns] = await Promise.all([
    sourceDb.getAllAsync(`PRAGMA table_info(${quoteIdentifier(tableName)});`),
    targetDb.getAllAsync(`PRAGMA table_info(${quoteIdentifier(tableName)});`),
  ]);

  const targetColumnNames = targetColumns.map((column) => column.name);
  const sharedColumnNames = sourceColumns
    .map((column) => column.name)
    .filter((columnName) => targetColumnNames.includes(columnName));

  if (sharedColumnNames.length === 0) {
    return;
  }

  const columnListSql = sharedColumnNames.map(quoteIdentifier).join(", ");
  const placeholdersSql = sharedColumnNames.map(() => "?").join(", ");

  for await (const row of sourceDb.getEachAsync(
    `SELECT ${columnListSql}
     FROM ${quoteIdentifier(tableName)};`
  )) {
    const values = sharedColumnNames.map((columnName) =>
      Object.prototype.hasOwnProperty.call(row, columnName) ? row[columnName] : null
    );

    await targetDb.runAsync(
      `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${columnListSql})
       VALUES (${placeholdersSql});`,
      values
    );
  }
}

export function getLegacyDatabaseName() {
  return LEGACY_DATABASE_NAME;
}

export function getAnonymousDatabaseName() {
  return ANONYMOUS_DATABASE_NAME;
}

export function getDatabaseNameForUserId(userId) {
  if (!userId) {
    return ANONYMOUS_DATABASE_NAME;
  }

  return `${USER_DATABASE_PREFIX}-${sanitizeUserIdForDatabaseName(userId)}.db`;
}

export function getActiveDatabaseName() {
  return (
    getStoredValue(ACTIVE_DATABASE_NAME_STORAGE_KEY) ??
    ANONYMOUS_DATABASE_NAME
  );
}

export function setActiveDatabaseName(databaseName) {
  setStoredValue(ACTIVE_DATABASE_NAME_STORAGE_KEY, databaseName);
}

export async function migrateLegacySharedDatabaseToUserDatabase({
  userId,
  targetDatabaseName,
  targetDb,
}) {
  if (!userId || !targetDb || !targetDatabaseName) {
    return false;
  }

  if (targetDatabaseName === LEGACY_DATABASE_NAME) {
    return false;
  }

  const claimedOwnerUserId = getStoredValue(LEGACY_DATABASE_OWNER_STORAGE_KEY);

  if (claimedOwnerUserId && claimedOwnerUserId !== userId) {
    return false;
  }

  if (await databaseHasUserData(targetDb)) {
    if (!claimedOwnerUserId) {
      setStoredValue(LEGACY_DATABASE_OWNER_STORAGE_KEY, userId);
    }

    return false;
  }

  const legacyDb = await SQLite.openDatabaseAsync(LEGACY_DATABASE_NAME);

  try {
    await initializeDatabase(legacyDb);

    const sourceTableNames = await listTableNames(legacyDb);
    const sourceTableNameSet = new Set(sourceTableNames);
    const orderedTableNames = [
      ...LEGACY_COPY_TABLE_ORDER.filter((tableName) =>
        sourceTableNameSet.has(tableName)
      ),
      ...sourceTableNames.filter(
        (tableName) => !LEGACY_COPY_TABLE_ORDER.includes(tableName)
      ),
    ];

    await withTransaction(targetDb, async () => {
      for (const tableName of orderedTableNames) {
        await copyTableRows(legacyDb, targetDb, tableName);
      }
    });

    setStoredValue(LEGACY_DATABASE_OWNER_STORAGE_KEY, userId);
    return true;
  } finally {
    await legacyDb.closeAsync();
  }
}
