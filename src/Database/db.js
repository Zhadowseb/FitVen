import { programSchemaSql } from './schema/program';
import {
  initializeWeightliftingData,
  weightliftingSchemaSql,
} from './schema/weightlifting';
import { runningSchemaSql } from './schema/running';
import { locationSchemaSql } from './schema/location';
import { SQLITE_UUID_SQL } from "../Utils/syncUtils";
import { withTransaction } from "./transaction";

const DEFAULT_WORKOUT_TYPES = [
  ["Resistance", "Resistance", 1],
  ["Upperbody", "Upperbody", 0],
  ["Legs", "Legs", 0],
  ["StrengthTraining", "StrengthTraining", 0],
  ["Run", "Run", 1],
];

const DEFAULT_ACTIVE_WORKOUT_TYPES = DEFAULT_WORKOUT_TYPES
  .filter(([, , isActive]) => isActive === 1)
  .map(([name]) => name);
const DEFAULT_ACTIVE_WORKOUT_TYPES_SQL = DEFAULT_ACTIVE_WORKOUT_TYPES.map(
  (name) => `'${name.replace(/'/g, "''")}'`
).join(", ");

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function ensureColumnExists(db, tableName, columnName, columnDefinition) {
  const columns = await db.getAllAsync(
    `PRAGMA table_info(${quoteIdentifier(tableName)});`
  );

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await db.execAsync(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${columnName} ${columnDefinition};`
  );
}

async function ensureTableColumns(db, tableName, columns) {
  for (const [columnName, columnDefinition] of columns) {
    await ensureColumnExists(db, tableName, columnName, columnDefinition);
  }
}

async function getTableColumns(db, tableName) {
  return db.getAllAsync(`PRAGMA table_info(${quoteIdentifier(tableName)});`);
}

function hasColumn(columns, columnName) {
  return columns.some((column) => column.name === columnName);
}

async function backfillSyncStateColumns(db, tableName) {
  await db.execAsync(`
    UPDATE ${quoteIdentifier(tableName)}
    SET sync_id = COALESCE(NULLIF(TRIM(sync_id), ''), ${SQLITE_UUID_SQL}),
        sync_version = CASE
          WHEN sync_version IS NULL OR sync_version <= 0 THEN 1
          ELSE sync_version
        END,
        deleted_at = NULLIF(TRIM(deleted_at), '')
    WHERE sync_id IS NULL
       OR TRIM(sync_id) = ''
       OR sync_version IS NULL
       OR sync_version <= 0
       OR (deleted_at IS NOT NULL AND TRIM(deleted_at) = '');

    UPDATE ${quoteIdentifier(tableName)}
    SET sync_id = ${SQLITE_UUID_SQL}
    WHERE sync_id IS NULL OR TRIM(sync_id) = '';
  `);
}

function syncVersionToLastUpdatedSql(syncVersionExpression) {
  return `CASE
    WHEN ${syncVersionExpression} IS NULL OR ${syncVersionExpression} <= 0
    THEN CAST(strftime('%s', 'now') AS INTEGER)
    WHEN ${syncVersionExpression} >= 100000000000
    THEN CAST(${syncVersionExpression} / 1000 AS INTEGER)
    ELSE CAST(${syncVersionExpression} AS INTEGER)
  END`;
}

async function backfillSideBySideSyncMetadata(
  db,
  tableName,
  legacyCloudIdColumn
) {
  await db.execAsync(`
    UPDATE ${quoteIdentifier(tableName)}
    SET cloud_id = COALESCE(cloud_id, ${quoteIdentifier(legacyCloudIdColumn)}),
        last_updated = CASE
          WHEN last_updated IS NULL OR last_updated <= 0
          THEN ${syncVersionToLastUpdatedSql("sync_version")}
          ELSE last_updated
        END;
  `);
}

async function createSideBySideSyncMetadataTriggers(
  db,
  tableName,
  primaryKeyColumn,
  legacyCloudIdColumn
) {
  const tableIdentifier = quoteIdentifier(tableName);
  const primaryKeyIdentifier = quoteIdentifier(primaryKeyColumn);
  const legacyCloudIdIdentifier = quoteIdentifier(legacyCloudIdColumn);
  const insertTriggerName = quoteIdentifier(`${tableName}_sync_metadata_ai`);
  const updateTriggerName = quoteIdentifier(`${tableName}_sync_metadata_au`);
  const lastUpdatedExpression = syncVersionToLastUpdatedSql("NEW.sync_version");

  await db.execAsync(`
    CREATE TRIGGER IF NOT EXISTS ${insertTriggerName}
    AFTER INSERT ON ${tableIdentifier}
    BEGIN
      UPDATE ${tableIdentifier}
      SET cloud_id = COALESCE(NEW.cloud_id, NEW.${legacyCloudIdIdentifier}, cloud_id),
          last_updated = CASE
            WHEN NEW.last_updated IS NULL OR NEW.last_updated <= 0
            THEN ${lastUpdatedExpression}
            ELSE NEW.last_updated
          END
      WHERE ${primaryKeyIdentifier} = NEW.${primaryKeyIdentifier}
        AND (
          cloud_id IS NOT COALESCE(NEW.cloud_id, NEW.${legacyCloudIdIdentifier}, cloud_id)
          OR last_updated IS NOT CASE
            WHEN NEW.last_updated IS NULL OR NEW.last_updated <= 0
            THEN ${lastUpdatedExpression}
            ELSE NEW.last_updated
          END
        );
    END;

    CREATE TRIGGER IF NOT EXISTS ${updateTriggerName}
    AFTER UPDATE OF sync_version, ${legacyCloudIdIdentifier} ON ${tableIdentifier}
    BEGIN
      UPDATE ${tableIdentifier}
      SET cloud_id = COALESCE(NEW.cloud_id, NEW.${legacyCloudIdIdentifier}, cloud_id),
          last_updated = ${lastUpdatedExpression}
      WHERE ${primaryKeyIdentifier} = NEW.${primaryKeyIdentifier}
        AND (
          cloud_id IS NOT COALESCE(NEW.cloud_id, NEW.${legacyCloudIdIdentifier}, cloud_id)
          OR last_updated IS NOT ${lastUpdatedExpression}
        );
    END;
  `);
}

async function initializeSideBySideSyncMetadata(db) {
  const syncTables = [
    ["Program", "program_id", "cloud_program_id"],
    ["Mesocycle", "mesocycle_id", "cloud_mesocycle_id"],
    ["Microcycle", "microcycle_id", "cloud_microcycle_id"],
    ["Day", "day_id", "cloud_day_id"],
    ["Sickness", "sickness_id", "cloud_sickness_id"],
    [
      "Workout_Type_Instance",
      "workout_id",
      "cloud_workout_type_instance_id",
    ],
    [
      "Exercise_Instance",
      "exercise_instance_id",
      "cloud_exercise_instance_id",
    ],
    ["Set", "sets_id", "cloud_set_id"],
  ];

  for (const [tableName, primaryKeyColumn, legacyCloudIdColumn] of syncTables) {
    await ensureTableColumns(db, tableName, [
      ["cloud_id", "INTEGER"],
      ["last_updated", "INTEGER NOT NULL DEFAULT 0"],
    ]);
    await backfillSideBySideSyncMetadata(db, tableName, legacyCloudIdColumn);
    await createSideBySideSyncMetadataTriggers(
      db,
      tableName,
      primaryKeyColumn,
      legacyCloudIdColumn
    );
  }
}

function isExerciseCatalogTable(columns) {
  return (
    (hasColumn(columns, "exercise_name") || hasColumn(columns, "name")) &&
    !hasColumn(columns, "workout_id") &&
    !hasColumn(columns, "workout_type_instance_id")
  );
}

function isExerciseInstanceTable(columns) {
  return hasColumn(columns, "workout_id") || hasColumn(columns, "workout_type_instance_id");
}

async function migrateWeightliftingTableNames(db) {
  await withTransaction(db, async () => {
    const legacyExerciseColumns = await getTableColumns(db, "Exercise");
    const legacyExerciseStorageColumns = await getTableColumns(db, "Exercise_storage");
    const exerciseInstanceColumns = await getTableColumns(db, "Exercise_Instance");

    if (
      legacyExerciseColumns.length &&
      isExerciseInstanceTable(legacyExerciseColumns) &&
      !exerciseInstanceColumns.length
    ) {
      await db.execAsync(`
        ALTER TABLE Exercise RENAME TO Exercise_Instance;
      `);
    }

    const exerciseColumns = await getTableColumns(db, "Exercise");

    if (legacyExerciseStorageColumns.length) {
      if (!exerciseColumns.length) {
        await db.execAsync(`
          ALTER TABLE Exercise_storage RENAME TO Exercise;
        `);
      } else if (!isExerciseCatalogTable(exerciseColumns)) {
        throw new Error(
          "Could not rename Exercise_storage to Exercise because the Exercise table name is already occupied."
        );
      }
    }
  });
}

async function migrateWorkoutTableName(db) {
  await withTransaction(db, async () => {
    const legacyWorkoutColumns = await getTableColumns(db, "Workout");
    const workoutTypeInstanceColumns = await getTableColumns(
      db,
      "Workout_Type_Instance"
    );

    if (legacyWorkoutColumns.length && !workoutTypeInstanceColumns.length) {
      await db.execAsync(`
        ALTER TABLE Workout RENAME TO Workout_Type_Instance;
      `);
    }
  });
}

async function migrateExerciseCatalogSchema(db) {
  const exerciseColumns = await getTableColumns(db, "Exercise");

  if (!exerciseColumns.length) {
    return;
  }

  const hasLegacyNameColumn = hasColumn(exerciseColumns, "exercise_name");
  const hasNameColumn = hasColumn(exerciseColumns, "name");
  const hasNicknameColumn = hasColumn(exerciseColumns, "nickname");

  if (
    !hasLegacyNameColumn &&
    hasNameColumn &&
    hasNicknameColumn &&
    !hasColumn(exerciseColumns, "primary_muscle_group_count") &&
    !hasColumn(exerciseColumns, "secondary_muscle_group_count")
  ) {
    return;
  }

  const nameColumn = hasNameColumn ? "name" : hasLegacyNameColumn ? "exercise_name" : null;

  if (!nameColumn) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS Exercise_next;

      CREATE TABLE Exercise_next (
        exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        nickname TEXT
      );

      INSERT OR IGNORE INTO Exercise_next (
        exercise_id,
        name,
        nickname
      )
      SELECT
        exercise_id,
        ${nameColumn},
        ${hasNicknameColumn ? "nickname" : "NULL"}
      FROM Exercise
      WHERE TRIM(COALESCE(${nameColumn}, '')) <> ''
      ORDER BY exercise_id ASC;

      DROP TABLE Exercise;
      ALTER TABLE Exercise_next RENAME TO Exercise;
    `);
  });
}

async function migrateExerciseInstanceSchema(db) {
  const exerciseInstanceColumns = await getTableColumns(db, "Exercise_Instance");

  if (!exerciseInstanceColumns.length) {
    return;
  }

  const hasLegacyIdColumn = hasColumn(exerciseInstanceColumns, "exercise_id");
  const hasNewIdColumn = hasColumn(
    exerciseInstanceColumns,
    "exercise_instance_id"
  );
  const hasLegacyWorkoutColumn = hasColumn(
    exerciseInstanceColumns,
    "workout_id"
  );
  const hasNewWorkoutColumn = hasColumn(
    exerciseInstanceColumns,
    "workout_type_instance_id"
  );

  if (
    !hasLegacyIdColumn &&
    hasNewIdColumn &&
    !hasLegacyWorkoutColumn &&
    hasNewWorkoutColumn
  ) {
    return;
  }

  const idColumn = hasNewIdColumn
    ? "exercise_instance_id"
    : hasLegacyIdColumn
      ? "exercise_id"
      : null;
  const workoutColumn = hasNewWorkoutColumn
    ? "workout_type_instance_id"
    : hasLegacyWorkoutColumn
      ? "workout_id"
      : null;

  if (!idColumn || !workoutColumn) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS Exercise_Instance_next;

      CREATE TABLE Exercise_Instance_next (
        exercise_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_exercise_instance_id INTEGER,
        remote_local_exercise_instance_id INTEGER,
        workout_type_instance_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        exercise_order INTEGER NOT NULL DEFAULT 0,
        sets INTEGER NOT NULL DEFAULT 0,
        visible_columns TEXT,
        note TEXT,
        done INTEGER NOT NULL DEFAULT 0,
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO Exercise_Instance_next (
        exercise_instance_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        workout_type_instance_id,
        exercise_name,
        exercise_order,
        sets,
        visible_columns,
        note,
        done,
        needs_sync
      )
      SELECT
        ${idColumn},
        ${hasColumn(exerciseInstanceColumns, "cloud_exercise_instance_id") ? "cloud_exercise_instance_id" : "NULL"},
        ${hasColumn(exerciseInstanceColumns, "remote_local_exercise_instance_id") ? "remote_local_exercise_instance_id" : "NULL"},
        ${workoutColumn},
        exercise_name,
        CASE
          WHEN ${hasColumn(exerciseInstanceColumns, "exercise_order") ? "COALESCE(exercise_order, 0)" : "0"} > 0
          THEN ${hasColumn(exerciseInstanceColumns, "exercise_order") ? "exercise_order" : "0"}
          ELSE ${idColumn}
        END,
        COALESCE(sets, 0),
        ${hasColumn(exerciseInstanceColumns, "visible_columns") ? "visible_columns" : "NULL"},
        ${hasColumn(exerciseInstanceColumns, "note") ? "note" : "NULL"},
        ${hasColumn(exerciseInstanceColumns, "done") ? "COALESCE(done, 0)" : "0"},
        ${hasColumn(exerciseInstanceColumns, "needs_sync") ? "COALESCE(needs_sync, 1)" : "1"}
      FROM Exercise_Instance;

      DROP TABLE Exercise_Instance;
      ALTER TABLE Exercise_Instance_next RENAME TO Exercise_Instance;
    `);
  });
}

async function migrateSetSchema(db) {
  const legacySetColumns = await getTableColumns(db, "Sets");
  const setColumns = await getTableColumns(db, "Set");
  const sourceTable = setColumns.length ? "Set" : legacySetColumns.length ? "Sets" : null;
  const sourceColumns = setColumns.length ? setColumns : legacySetColumns;

  if (!sourceTable || !sourceColumns.length) {
    return;
  }

  const hasLegacyExerciseColumn = hasColumn(sourceColumns, "exercise_id");
  const hasNewExerciseColumn = hasColumn(sourceColumns, "exercise_instance_id");
  const hasLegacyDateColumn = hasColumn(sourceColumns, "date");

  if (
    sourceTable === "Set" &&
    !hasLegacyExerciseColumn &&
    hasNewExerciseColumn &&
    !hasLegacyDateColumn
  ) {
    return;
  }

  const exerciseColumn = hasNewExerciseColumn
    ? "exercise_instance_id"
    : hasLegacyExerciseColumn
      ? "exercise_id"
      : null;

  if (!exerciseColumn) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS "Set_next";

      CREATE TABLE "Set_next" (
        sets_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_set_id INTEGER,
        remote_local_set_id INTEGER,
        sync_id TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        set_number INTEGER NOT NULL,
        exercise_instance_id INTEGER NOT NULL,
        personal_record INTEGER NOT NULL DEFAULT 0,
        pause INTEGER,
        rpe INTEGER,
        weight INTEGER,
        rm_percentage INTEGER,
        reps INTEGER,
        done INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        amrap INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO "Set_next" (
        sets_id,
        cloud_set_id,
        remote_local_set_id,
        sync_id,
        sync_version,
        deleted_at,
        set_number,
        exercise_instance_id,
        personal_record,
        pause,
        rpe,
        weight,
        rm_percentage,
        reps,
        done,
        failed,
        amrap,
        note,
        needs_sync
      )
      SELECT
        sets_id,
        ${hasColumn(sourceColumns, "cloud_set_id") ? "cloud_set_id" : "NULL"},
        ${hasColumn(sourceColumns, "remote_local_set_id") ? "remote_local_set_id" : "NULL"},
        ${hasColumn(sourceColumns, "sync_id") ? "sync_id" : "NULL"},
        ${hasColumn(sourceColumns, "sync_version") ? "COALESCE(sync_version, 0)" : "0"},
        ${hasColumn(sourceColumns, "deleted_at") ? "deleted_at" : "NULL"},
        set_number,
        ${exerciseColumn},
        ${hasColumn(sourceColumns, "personal_record") ? "COALESCE(personal_record, 0)" : "0"},
        ${hasColumn(sourceColumns, "pause") ? "pause" : "NULL"},
        ${hasColumn(sourceColumns, "rpe") ? "rpe" : "NULL"},
        ${hasColumn(sourceColumns, "weight") ? "weight" : "NULL"},
        ${hasColumn(sourceColumns, "rm_percentage") ? "rm_percentage" : "NULL"},
        ${hasColumn(sourceColumns, "reps") ? "reps" : "NULL"},
        ${hasColumn(sourceColumns, "done") ? "COALESCE(done, 0)" : "0"},
        ${hasColumn(sourceColumns, "failed") ? "COALESCE(failed, 0)" : "0"},
        ${hasColumn(sourceColumns, "amrap") ? "COALESCE(amrap, 0)" : "0"},
        ${hasColumn(sourceColumns, "note") ? "note" : "NULL"},
        ${hasColumn(sourceColumns, "needs_sync") ? "COALESCE(needs_sync, 1)" : "1"}
      FROM ${quoteIdentifier(sourceTable)};

      DROP TABLE ${quoteIdentifier(sourceTable)};
      ALTER TABLE "Set_next" RENAME TO "Set";
    `);
  });
}

async function migrateMicrocycleProgramIdRemoval(db) {
  const microcycleColumns = await getTableColumns(db, "Microcycle");

  if (
    !microcycleColumns.length ||
    !microcycleColumns.some((column) => column.name === "program_id")
  ) {
    return;
  }

  await withTransaction(db, async () => {
    const hasCloudMicrocycleId = hasColumn(
      microcycleColumns,
      "cloud_microcycle_id"
    );
    const hasNeedsSync = hasColumn(microcycleColumns, "needs_sync");

    await db.execAsync(`
      DROP TABLE IF EXISTS Microcycle_next;

      CREATE TABLE Microcycle_next (
        microcycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_microcycle_id INTEGER,
        mesocycle_id INTEGER NOT NULL,
        microcycle_number INTEGER NOT NULL,
        focus TEXT DEFAULT "No focus",
        done INTEGER NOT NULL DEFAULT 0,
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO Microcycle_next (
        microcycle_id,
        cloud_microcycle_id,
        mesocycle_id,
        microcycle_number,
        focus,
        done,
        needs_sync
      )
      SELECT
        microcycle_id,
        ${hasCloudMicrocycleId ? "cloud_microcycle_id" : "NULL"},
        mesocycle_id,
        microcycle_number,
        focus,
        done,
        ${hasNeedsSync ? "needs_sync" : "1"}
      FROM Microcycle;

      DROP TABLE Microcycle;
      ALTER TABLE Microcycle_next RENAME TO Microcycle;
    `);
  });
}

async function migrateDayOptionalProgramHierarchy(db) {
  const dayColumns = await getTableColumns(db, "Day");

  if (!dayColumns.length) {
    return;
  }

  const microcycleColumn = dayColumns.find(
    (column) => column.name === "microcycle_id"
  );
  const programColumn = dayColumns.find((column) => column.name === "program_id");
  const microcycleIsRequired = Number(microcycleColumn?.notnull ?? 0) === 1;
  const programIsRequired = Number(programColumn?.notnull ?? 0) === 1;

  if (!microcycleIsRequired && !programIsRequired) {
    return;
  }

  const hasCloudDayId = hasColumn(dayColumns, "cloud_day_id");
  const hasRemoteLocalDayId = hasColumn(dayColumns, "remote_local_day_id");
  const hasSyncId = hasColumn(dayColumns, "sync_id");
  const hasSyncVersion = hasColumn(dayColumns, "sync_version");
  const hasDeletedAt = hasColumn(dayColumns, "deleted_at");
  const hasDone = hasColumn(dayColumns, "done");
  const hasIsSick = hasColumn(dayColumns, "is_sick");
  const hasNeedsSync = hasColumn(dayColumns, "needs_sync");

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS Day_next;

      CREATE TABLE Day_next (
        day_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_day_id INTEGER,
        remote_local_day_id INTEGER,
        sync_id TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        microcycle_id INTEGER,
        program_id INTEGER,
        Weekday TEXT NOT NULL,
        date TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        is_sick INTEGER NOT NULL DEFAULT 0,
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO Day_next (
        day_id,
        cloud_day_id,
        remote_local_day_id,
        sync_id,
        sync_version,
        deleted_at,
        microcycle_id,
        program_id,
        Weekday,
        date,
        done,
        is_sick,
        needs_sync
      )
      SELECT
        day_id,
        ${hasCloudDayId ? "cloud_day_id" : "NULL"},
        ${hasRemoteLocalDayId ? "remote_local_day_id" : "NULL"},
        ${hasSyncId ? "sync_id" : "NULL"},
        ${hasSyncVersion ? "COALESCE(sync_version, 0)" : "0"},
        ${hasDeletedAt ? "deleted_at" : "NULL"},
        microcycle_id,
        program_id,
        Weekday,
        date,
        ${hasDone ? "COALESCE(done, 0)" : "0"},
        ${hasIsSick ? "COALESCE(is_sick, 0)" : "0"},
        ${hasNeedsSync ? "COALESCE(needs_sync, 1)" : "1"}
      FROM Day;

      DROP TABLE Day;
      ALTER TABLE Day_next RENAME TO Day;
    `);
  });
}

async function migrateLegacyQuickWorkoutProgram(db) {
  const legacyProgramRows = await db.getAllAsync(
    `SELECT program_id
     FROM Program
     WHERE program_name = 'Quick Workouts';`
  );

  if (!legacyProgramRows.length) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      INSERT OR IGNORE INTO Microcycle_Sync_Delete (
        cloud_microcycle_id,
        sync_id,
        sync_version,
        deleted_at
      )
      SELECT
        mc.cloud_microcycle_id,
        mc.sync_id,
        COALESCE(mc.sync_version, 0) + 1,
        datetime('now')
      FROM Microcycle mc
      JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
      JOIN Program p ON p.program_id = m.program_id
      WHERE p.program_name = 'Quick Workouts'
        AND (mc.cloud_microcycle_id IS NOT NULL OR mc.sync_id IS NOT NULL);

      INSERT OR IGNORE INTO Mesocycle_Sync_Delete (
        cloud_mesocycle_id,
        sync_id,
        sync_version,
        deleted_at
      )
      SELECT
        m.cloud_mesocycle_id,
        m.sync_id,
        COALESCE(m.sync_version, 0) + 1,
        datetime('now')
      FROM Mesocycle m
      JOIN Program p ON p.program_id = m.program_id
      WHERE p.program_name = 'Quick Workouts'
        AND (m.cloud_mesocycle_id IS NOT NULL OR m.sync_id IS NOT NULL);

      INSERT OR IGNORE INTO Program_Sync_Delete (
        cloud_program_id,
        sync_id,
        sync_version,
        deleted_at
      )
      SELECT
        p.cloud_program_id,
        p.sync_id,
        COALESCE(p.sync_version, 0) + 1,
        datetime('now')
      FROM Program p
      WHERE p.program_name = 'Quick Workouts'
        AND (p.cloud_program_id IS NOT NULL OR p.sync_id IS NOT NULL);

      UPDATE Day
      SET microcycle_id = NULL,
          program_id = NULL,
          needs_sync = 1
      WHERE program_id IN (
        SELECT program_id
        FROM Program
        WHERE program_name = 'Quick Workouts'
      );

      DELETE FROM Microcycle
      WHERE mesocycle_id IN (
        SELECT m.mesocycle_id
        FROM Mesocycle m
        JOIN Program p ON p.program_id = m.program_id
        WHERE p.program_name = 'Quick Workouts'
      );

      DELETE FROM Mesocycle
      WHERE program_id IN (
        SELECT program_id
        FROM Program
        WHERE program_name = 'Quick Workouts'
      );

      DELETE FROM Program
      WHERE program_name = 'Quick Workouts';

      DELETE FROM App_Metadata
      WHERE metadata_key = 'quick_workout_program_id_v1';
    `);
  });
}

async function migrateProgramRemoteLocalIdRemoval(db) {
  const programColumns = await getTableColumns(db, "Program");

  if (!programColumns.length || !hasColumn(programColumns, "remote_local_program_id")) {
    return;
  }

  const hasCloudProgramId = hasColumn(programColumns, "cloud_program_id");
  const hasProgramName = hasColumn(programColumns, "program_name");
  const hasStartDate = hasColumn(programColumns, "start_date");
  const hasStatus = hasColumn(programColumns, "status");
  const hasNeedsSync = hasColumn(programColumns, "needs_sync");

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS Program_next;

      CREATE TABLE Program_next (
        program_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_program_id INTEGER,
        program_name TEXT,
        start_date TEXT NOT NULL,
        status TEXT
          DEFAULT 'NOT_STARTED'
          NOT NULL
          CHECK (status IN ('COMPLETE', 'ACTIVE', 'NOT_STARTED')),
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO Program_next (
        program_id,
        cloud_program_id,
        program_name,
        start_date,
        status,
        needs_sync
      )
      SELECT
        program_id,
        ${hasCloudProgramId ? "cloud_program_id" : "NULL"},
        ${hasProgramName ? "program_name" : "NULL"},
        ${hasStartDate ? "start_date" : "''"},
        ${hasStatus ? "status" : "'NOT_STARTED'"},
        ${hasNeedsSync ? "needs_sync" : "1"}
      FROM Program;

      DROP TABLE Program;
      ALTER TABLE Program_next RENAME TO Program;
    `);
  });
}

async function migrateMesocycleRemoteLocalIdRemoval(db) {
  const mesocycleColumns = await getTableColumns(db, "Mesocycle");

  if (
    !mesocycleColumns.length ||
    !hasColumn(mesocycleColumns, "remote_local_mesocycle_id")
  ) {
    return;
  }

  const hasCloudMesocycleId = hasColumn(mesocycleColumns, "cloud_mesocycle_id");
  const hasProgramId = hasColumn(mesocycleColumns, "program_id");
  const hasMesocycleNumber = hasColumn(mesocycleColumns, "mesocycle_number");
  const hasWeeks = hasColumn(mesocycleColumns, "weeks");
  const hasFocus = hasColumn(mesocycleColumns, "focus");
  const hasDone = hasColumn(mesocycleColumns, "done");

  await withTransaction(db, async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS Mesocycle_next;

      CREATE TABLE Mesocycle_next (
        mesocycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_mesocycle_id INTEGER,
        program_id INTEGER NOT NULL,
        mesocycle_number INTEGER NOT NULL,
        weeks INTEGER NOT NULL DEFAULT 0,
        focus TEXT DEFAULT "No focus set",
        done INTEGER NOT NULL DEFAULT 0,
        needs_sync INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO Mesocycle_next (
        mesocycle_id,
        cloud_mesocycle_id,
        program_id,
        mesocycle_number,
        weeks,
        focus,
        done,
        needs_sync
      )
      SELECT
        mesocycle_id,
        ${hasCloudMesocycleId ? "cloud_mesocycle_id" : "NULL"},
        ${hasProgramId ? "program_id" : "0"},
        ${hasMesocycleNumber ? "mesocycle_number" : "0"},
        ${hasWeeks ? "weeks" : "0"},
        ${hasFocus ? "focus" : "'No focus set'"},
        ${hasDone ? "done" : "0"},
        1
      FROM Mesocycle;

      DROP TABLE Mesocycle;
      ALTER TABLE Mesocycle_next RENAME TO Mesocycle;

      UPDATE Microcycle
      SET needs_sync = 1;
    `);
  });
}

async function backfillWorkoutTypeInstances(db) {
  await db.execAsync(`
    UPDATE Workout_Type_Instance
    SET workout_type = label
    WHERE TRIM(COALESCE(workout_type, '')) = ''
      AND TRIM(COALESCE(label, '')) <> '';

    UPDATE Workout_Type_Instance
    SET label = workout_type
    WHERE TRIM(COALESCE(label, '')) = ''
      AND TRIM(COALESCE(workout_type, '')) <> '';
  `);
}

async function restoreLocalWorkoutTypeCatalogSchema(db) {
  const workoutTypeColumns = await getTableColumns(db, "Workout_Type");

  if (!workoutTypeColumns.length) {
    return;
  }

  const hasLegacyId = hasColumn(workoutTypeColumns, "workout_type_id");
  const hasId = hasColumn(workoutTypeColumns, "id");
  const hasName = hasColumn(workoutTypeColumns, "name");
  const hasDisplayName = hasColumn(workoutTypeColumns, "display_name");
  const hasIsActive = hasColumn(workoutTypeColumns, "is_active");

  if (hasLegacyId && hasName && hasDisplayName && hasIsActive) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Workout_Type_next (
        workout_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      INSERT OR IGNORE INTO Workout_Type_next (
        workout_type_id,
        name,
        display_name,
        is_active
      )
      SELECT
        ${
          hasLegacyId
              ? "workout_type_id"
            : hasId
              ? "id"
              : "NULL"
        },
        name,
        ${
          hasDisplayName
            ? "COALESCE(display_name, name)"
            : "name"
        },
        ${
          hasIsActive
            ? "COALESCE(is_active, 0)"
            : `CASE WHEN name IN (${DEFAULT_ACTIVE_WORKOUT_TYPES_SQL}) THEN 1 ELSE 0 END`
        }
      FROM Workout_Type
      WHERE TRIM(COALESCE(name, '')) <> '';

      DROP TABLE Workout_Type;
      ALTER TABLE Workout_Type_next RENAME TO Workout_Type;
    `);
  });
}

async function activateDefaultWorkoutTypes(db) {
  const metadataKey = "workout_type_active_defaults_v1";
  const alreadyApplied = await getAppMetadataValue(db, metadataKey);

  if (alreadyApplied === "done") {
    return;
  }

  await withTransaction(db, async () => {
    for (const workoutTypeName of DEFAULT_ACTIVE_WORKOUT_TYPES) {
      await db.runAsync(
        `UPDATE Workout_Type
         SET is_active = 1
         WHERE name = ?;`,
        [workoutTypeName]
      );
    }

    await setAppMetadataValue(db, metadataKey, "done");
  });
}

async function initializeWorkoutTypes(db) {
  for (const [name, displayName, isActive] of DEFAULT_WORKOUT_TYPES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO Workout_Type (name, display_name, is_active)
       VALUES (?, ?, ?);`,
      [name, displayName, isActive]
    );
  }

  await db.execAsync(`
    INSERT OR IGNORE INTO Workout_Type (name, display_name, is_active)
    SELECT DISTINCT workout_type, workout_type, 0
    FROM Workout_Type_Instance
    WHERE TRIM(COALESCE(workout_type, '')) <> '';
  `);

  await activateDefaultWorkoutTypes(db);
}

async function repairWorkoutTrackingState(db) {
  await db.execAsync(`
    UPDATE Workout_Type_Instance
    SET is_active = 0
    WHERE is_active = 1
      AND (timer_start IS NULL OR done = 1);
  `);

  const activeWorkouts = await db.getAllAsync(`
    SELECT workout_id
    FROM Workout_Type_Instance
    WHERE is_active = 1
      AND timer_start IS NOT NULL
      AND done = 0
    ORDER BY timer_start DESC, workout_id DESC;
  `);

  if (activeWorkouts.length <= 1) {
    return;
  }

  const [, ...staleWorkouts] = activeWorkouts;

  for (const staleWorkout of staleWorkouts) {
    await db.runAsync(
      `UPDATE Workout_Type_Instance
       SET is_active = 0
       WHERE workout_id = ?;`,
      [staleWorkout.workout_id]
    );
  }
}

async function repairResistanceTrainingState(db) {
  await db.execAsync(`
    UPDATE Exercise_Instance
    SET visible_columns = NULL
    WHERE TRIM(COALESCE(visible_columns, '')) IN ('', 'undefined', 'null', '[object Object]');

    UPDATE Exercise_Instance
    SET done = (
      NOT EXISTS (
        SELECT 1
        FROM "Set"
        WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
          AND "Set".done = 0
      )
    );

    UPDATE Workout_Type_Instance
    SET done = (
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM Run
          WHERE Run.workout_id = Workout_Type_Instance.workout_id
        ) THEN Workout_Type_Instance.done
        ELSE NOT EXISTS (
          SELECT 1
          FROM Exercise_Instance
          WHERE Exercise_Instance.workout_type_instance_id = Workout_Type_Instance.workout_id
            AND Exercise_Instance.done = 0
        )
      END
    )
    WHERE EXISTS (
      SELECT 1
      FROM Exercise_Instance
      WHERE Exercise_Instance.workout_type_instance_id = Workout_Type_Instance.workout_id
    );
  `);
}

async function repairRunSetState(db) {
  await db.execAsync(`
    UPDATE Run
    SET type = CASE
      WHEN type IS NULL THEN 'WORKING_SET'
      WHEN UPPER(REPLACE(REPLACE(TRIM(type), '-', '_'), ' ', '_')) IN ('WARMUP', 'WARM_UP')
        THEN 'WARMUP'
      WHEN UPPER(REPLACE(REPLACE(TRIM(type), '-', '_'), ' ', '_')) IN ('COOLDOWN', 'COOL_DOWN')
        THEN 'COOLDOWN'
      ELSE 'WORKING_SET'
    END;

    UPDATE Run
    SET done = COALESCE(done, 0),
        is_pause = COALESCE(is_pause, 0)
    WHERE done IS NULL
       OR is_pause IS NULL;
  `);
}

async function repairProgramDateFormats(db) {
  await db.execAsync(`
    UPDATE Program
    SET start_date = substr(start_date, 9, 2) || '.' || substr(start_date, 6, 2) || '.' || substr(start_date, 1, 4)
    WHERE start_date LIKE '____-__-__';
  `);
}

async function repairExerciseOrders(db) {
  const exercises = await db.getAllAsync(`
    SELECT exercise_instance_id, workout_type_instance_id, exercise_order
    FROM Exercise_Instance
    ORDER BY
      workout_type_instance_id ASC,
      CASE
        WHEN COALESCE(exercise_order, 0) > 0 THEN exercise_order
        ELSE exercise_instance_id
      END ASC,
      exercise_instance_id ASC;
  `);

  let currentWorkoutId = null;
  let nextExerciseOrder = 1;
  const orderUpdates = [];

  for (const exercise of exercises) {
    if (currentWorkoutId !== exercise.workout_type_instance_id) {
      currentWorkoutId = exercise.workout_type_instance_id;
      nextExerciseOrder = 1;
    }

    if (Number(exercise.exercise_order) !== nextExerciseOrder) {
      orderUpdates.push({
        exerciseId: exercise.exercise_instance_id,
        exerciseOrder: nextExerciseOrder,
      });
    }

    nextExerciseOrder += 1;
  }

  if (orderUpdates.length === 0) {
    return;
  }

  await withTransaction(db, async () => {
    for (const update of orderUpdates) {
      await db.runAsync(
        `UPDATE Exercise_Instance
         SET exercise_order = ?,
             sync_id = COALESCE(sync_id, ${SQLITE_UUID_SQL}),
             sync_version = COALESCE(sync_version, 0) + 1,
             deleted_at = NULL,
             needs_sync = 1
         WHERE exercise_instance_id = ?;`,
        [update.exerciseOrder, update.exerciseId]
      );
    }
  });
}

async function migrateWorkoutTypeInstanceDeleteQueueSchema(db) {
  const queueColumns = await getTableColumns(db, "Workout_Type_Instance_Sync_Delete");

  if (!queueColumns.length) {
    return;
  }

  const hasCloudId = hasColumn(queueColumns, "cloud_workout_type_instance_id");
  const hasRemoteLocalId = hasColumn(
    queueColumns,
    "remote_local_workout_type_instance_id"
  );
  const cloudIdColumn = queueColumns.find(
    (column) => column.name === "cloud_workout_type_instance_id"
  );
  const cloudIdIsRequired = Number(cloudIdColumn?.notnull ?? 0) === 1;

  if (hasCloudId && hasRemoteLocalId && !cloudIdIsRequired) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Workout_Type_Instance_Sync_Delete_next (
        workout_type_instance_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_workout_type_instance_id INTEGER UNIQUE,
        remote_local_workout_type_instance_id INTEGER UNIQUE,
        deleted_at TEXT
      );

      INSERT OR IGNORE INTO Workout_Type_Instance_Sync_Delete_next (
        workout_type_instance_sync_delete_id,
        cloud_workout_type_instance_id,
        remote_local_workout_type_instance_id,
        deleted_at
      )
      SELECT
        workout_type_instance_sync_delete_id,
        ${
          hasCloudId ? "cloud_workout_type_instance_id" : "NULL"
        },
        ${
          hasRemoteLocalId ? "remote_local_workout_type_instance_id" : "NULL"
        },
        deleted_at
      FROM Workout_Type_Instance_Sync_Delete;

      DROP TABLE Workout_Type_Instance_Sync_Delete;
      ALTER TABLE Workout_Type_Instance_Sync_Delete_next RENAME TO Workout_Type_Instance_Sync_Delete;
    `);
  });
}

async function migrateExerciseInstanceDeleteQueueSchema(db) {
  const queueColumns = await getTableColumns(db, "Exercise_Instance_Sync_Delete");

  if (!queueColumns.length) {
    return;
  }

  const hasCloudId = hasColumn(queueColumns, "cloud_exercise_instance_id");
  const hasRemoteLocalId = hasColumn(
    queueColumns,
    "remote_local_exercise_instance_id"
  );
  const cloudIdColumn = queueColumns.find(
    (column) => column.name === "cloud_exercise_instance_id"
  );
  const cloudIdIsRequired = Number(cloudIdColumn?.notnull ?? 0) === 1;

  if (hasCloudId && hasRemoteLocalId && !cloudIdIsRequired) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Exercise_Instance_Sync_Delete_next (
        exercise_instance_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_exercise_instance_id INTEGER UNIQUE,
        remote_local_exercise_instance_id INTEGER UNIQUE,
        deleted_at TEXT
      );

      INSERT OR IGNORE INTO Exercise_Instance_Sync_Delete_next (
        exercise_instance_sync_delete_id,
        cloud_exercise_instance_id,
        remote_local_exercise_instance_id,
        deleted_at
      )
      SELECT
        exercise_instance_sync_delete_id,
        ${hasCloudId ? "cloud_exercise_instance_id" : "NULL"},
        ${hasRemoteLocalId ? "remote_local_exercise_instance_id" : "NULL"},
        deleted_at
      FROM Exercise_Instance_Sync_Delete;

      DROP TABLE Exercise_Instance_Sync_Delete;
      ALTER TABLE Exercise_Instance_Sync_Delete_next RENAME TO Exercise_Instance_Sync_Delete;
    `);
  });
}

async function migrateSetDeleteQueueSchema(db) {
  const queueColumns = await getTableColumns(db, "Set_Sync_Delete");

  if (!queueColumns.length) {
    return;
  }

  const hasCloudId = hasColumn(queueColumns, "cloud_set_id");
  const hasRemoteLocalId = hasColumn(queueColumns, "remote_local_set_id");
  const cloudIdColumn = queueColumns.find(
    (column) => column.name === "cloud_set_id"
  );
  const cloudIdIsRequired = Number(cloudIdColumn?.notnull ?? 0) === 1;

  if (hasCloudId && hasRemoteLocalId && !cloudIdIsRequired) {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Set_Sync_Delete_next (
        set_sync_delete_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cloud_set_id INTEGER UNIQUE,
        remote_local_set_id INTEGER UNIQUE,
        deleted_at TEXT
      );

      INSERT OR IGNORE INTO Set_Sync_Delete_next (
        set_sync_delete_id,
        cloud_set_id,
        remote_local_set_id,
        deleted_at
      )
      SELECT
        set_sync_delete_id,
        ${hasCloudId ? "cloud_set_id" : "NULL"},
        ${hasRemoteLocalId ? "remote_local_set_id" : "NULL"},
        deleted_at
      FROM Set_Sync_Delete;

      DROP TABLE Set_Sync_Delete;
      ALTER TABLE Set_Sync_Delete_next RENAME TO Set_Sync_Delete;
    `);
  });
}

async function getAppMetadataValue(db, metadataKey) {
  const row = await db.getFirstAsync(
    `SELECT metadata_value
     FROM App_Metadata
     WHERE metadata_key = ?;`,
    [metadataKey]
  );

  return row?.metadata_value ?? null;
}

async function setAppMetadataValue(db, metadataKey, metadataValue) {
  await db.runAsync(
    `INSERT INTO App_Metadata (metadata_key, metadata_value)
     VALUES (?, ?)
     ON CONFLICT(metadata_key)
     DO UPDATE SET metadata_value = excluded.metadata_value;`,
    [metadataKey, metadataValue]
  );
}

async function repairCloudParentForeignKeySyncState(db) {
  const metadataKey = "cloud_parent_fk_resync_v1";
  const alreadyApplied = await getAppMetadataValue(db, metadataKey);

  if (alreadyApplied === "done") {
    return;
  }

  await withTransaction(db, async () => {
    await db.execAsync(`
      UPDATE Program
      SET cloud_program_id = NULL,
          needs_sync = 1
      WHERE cloud_program_id IS NOT NULL;

      UPDATE Mesocycle
      SET cloud_mesocycle_id = NULL,
          needs_sync = 1
      WHERE cloud_mesocycle_id IS NOT NULL;

      UPDATE Microcycle
      SET cloud_microcycle_id = NULL,
          needs_sync = 1
      WHERE cloud_microcycle_id IS NOT NULL;
    `);

    await setAppMetadataValue(db, metadataKey, "done");
  });
}

export async function initializeDatabase(db) {
  await migrateWeightliftingTableNames(db);
  await migrateWorkoutTableName(db);
  await migrateExerciseCatalogSchema(db);
  await migrateExerciseInstanceSchema(db);
  await migrateSetSchema(db);

  await db.execAsync(`
    ${programSchemaSql}
    ${weightliftingSchemaSql}
    ${runningSchemaSql}
    ${locationSchemaSql}

    PRAGMA journal_mode = WAL;
  `);

  await ensureTableColumns(db, "Program", [
    ["cloud_program_id", "INTEGER"],
    ["remote_local_program_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["status", "TEXT NOT NULL DEFAULT 'NOT_STARTED'"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await ensureTableColumns(db, "Program_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);

  await ensureTableColumns(db, "Mesocycle", [
    ["cloud_mesocycle_id", "INTEGER"],
    ["remote_local_mesocycle_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["weeks", "INTEGER NOT NULL DEFAULT 0"],
    ["focus", 'TEXT DEFAULT "No focus set"'],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await ensureTableColumns(db, "Mesocycle_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);

  await ensureTableColumns(db, "Microcycle", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["focus", 'TEXT DEFAULT "No focus"'],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await migrateMicrocycleProgramIdRemoval(db);
  await ensureTableColumns(db, "Microcycle", [
    ["cloud_microcycle_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["focus", 'TEXT DEFAULT "No focus"'],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await ensureTableColumns(db, "Microcycle_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);

  await db.execAsync(`
    UPDATE Program
    SET remote_local_program_id = COALESCE(remote_local_program_id, program_id)
    WHERE remote_local_program_id IS NULL;

    UPDATE Mesocycle
    SET remote_local_mesocycle_id = COALESCE(remote_local_mesocycle_id, mesocycle_id)
    WHERE remote_local_mesocycle_id IS NULL;
  `);

  await ensureTableColumns(db, "Day", [
    ["cloud_day_id", "INTEGER"],
    ["remote_local_day_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["is_sick", "INTEGER NOT NULL DEFAULT 0"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await migrateDayOptionalProgramHierarchy(db);
  await migrateLegacyQuickWorkoutProgram(db);

  await db.execAsync(`
    UPDATE Day
    SET remote_local_day_id = COALESCE(remote_local_day_id, day_id)
    WHERE remote_local_day_id IS NULL;
  `);

  await ensureTableColumns(db, "Sickness", [
    ["cloud_id", "INTEGER"],
    ["last_updated", "INTEGER NOT NULL DEFAULT 0"],
    ["cloud_sickness_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["end_date", "TEXT"],
    ["sickness_type", "TEXT"],
    ["note", "TEXT"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);

  await ensureTableColumns(db, "Workout_Type_Instance", [
    ["cloud_workout_type_instance_id", "INTEGER"],
    ["remote_local_workout_type_instance_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["workout_type", "TEXT"],
    ["label", "TEXT"],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
    ["is_active", "INTEGER DEFAULT 0"],
    ["original_start_time", "INTEGER"],
    ["timer_start", "INTEGER"],
    ["elapsed_time", "INTEGER DEFAULT 0"],
  ]);
  await restoreLocalWorkoutTypeCatalogSchema(db);
  await ensureTableColumns(db, "Workout_Type", [
    ["display_name", "TEXT"],
    ["is_active", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await migrateWorkoutTypeInstanceDeleteQueueSchema(db);
  await ensureTableColumns(db, "Workout_Type_Instance_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await db.execAsync(`
    UPDATE Workout_Type_Instance
    SET remote_local_workout_type_instance_id = COALESCE(remote_local_workout_type_instance_id, workout_id)
    WHERE remote_local_workout_type_instance_id IS NULL;
  `);
  await backfillWorkoutTypeInstances(db);
  await initializeWorkoutTypes(db);

  await ensureTableColumns(db, "Exercise", [["nickname", "TEXT"]]);

  await ensureTableColumns(db, "Exercise_Instance", [
    ["cloud_exercise_instance_id", "INTEGER"],
    ["remote_local_exercise_instance_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["exercise_name", "TEXT NOT NULL DEFAULT ''"],
    ["exercise_order", "INTEGER NOT NULL DEFAULT 0"],
    ["sets", "INTEGER NOT NULL DEFAULT 0"],
    ["visible_columns", "TEXT"],
    ["note", "TEXT"],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await migrateExerciseInstanceDeleteQueueSchema(db);
  await ensureTableColumns(db, "Exercise_Instance_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await db.execAsync(`
    UPDATE Exercise_Instance
    SET remote_local_exercise_instance_id = COALESCE(
      remote_local_exercise_instance_id,
      exercise_instance_id
    )
    WHERE remote_local_exercise_instance_id IS NULL;

    UPDATE Exercise_Instance
    SET needs_sync = COALESCE(needs_sync, 1)
    WHERE needs_sync IS NULL;
  `);

  await ensureTableColumns(db, "Set", [
    ["cloud_set_id", "INTEGER"],
    ["remote_local_set_id", "INTEGER"],
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
    ["deleted_at", "TEXT"],
    ["personal_record", "INTEGER NOT NULL DEFAULT 0"],
    ["pause", "INTEGER"],
    ["rpe", "INTEGER"],
    ["weight", "INTEGER"],
    ["rm_percentage", "INTEGER"],
    ["reps", "INTEGER"],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
    ["failed", "INTEGER NOT NULL DEFAULT 0"],
    ["amrap", "INTEGER NOT NULL DEFAULT 0"],
    ["note", "TEXT"],
    ["needs_sync", "INTEGER NOT NULL DEFAULT 1"],
  ]);
  await migrateSetDeleteQueueSchema(db);
  await ensureTableColumns(db, "Set_Sync_Delete", [
    ["sync_id", "TEXT"],
    ["sync_version", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await db.execAsync(`
    UPDATE "Set"
    SET remote_local_set_id = COALESCE(remote_local_set_id, sets_id)
    WHERE remote_local_set_id IS NULL;

    UPDATE "Set"
    SET needs_sync = COALESCE(needs_sync, 1)
    WHERE needs_sync IS NULL;
  `);

  await backfillSyncStateColumns(db, "Program");
  await backfillSyncStateColumns(db, "Mesocycle");
  await backfillSyncStateColumns(db, "Microcycle");
  await backfillSyncStateColumns(db, "Day");
  await backfillSyncStateColumns(db, "Sickness");
  await backfillSyncStateColumns(db, "Workout_Type_Instance");
  await backfillSyncStateColumns(db, "Exercise_Instance");
  await backfillSyncStateColumns(db, "Set");
  await initializeSideBySideSyncMetadata(db);

  await ensureTableColumns(db, "Run", [
    ["type", "TEXT NOT NULL DEFAULT 'WORKING_SET'"],
    ["is_pause", "INTEGER NOT NULL DEFAULT 0"],
    ["distance", "INTEGER"],
    ["pace", "TEXT"],
    ["time", "INTEGER"],
    ["heartrate", "INTEGER"],
    ["done", "INTEGER NOT NULL DEFAULT 0"],
  ]);

  await db.execAsync(`
    UPDATE Exercise_Instance
    SET sets = (
      SELECT COUNT(*)
      FROM "Set"
      WHERE "Set".exercise_instance_id = Exercise_Instance.exercise_instance_id
    );
  `);

  await repairWorkoutTrackingState(db);
  await repairResistanceTrainingState(db);
  await repairExerciseOrders(db);
  await repairRunSetState(db);
  await repairProgramDateFormats(db);
  await repairCloudParentForeignKeySyncState(db);

  await initializeWeightliftingData(db);

  /*
  await db.execAsync(`
    ALTER TABLE Workout_Type_Instance ADD COLUMN is_active INTEGER DEFAULT 0;
  `);
  */

  /*
  await db.execAsync(`
    ALTER TABLE Exercise_Instance ADD COLUMN visible_columns TEXT;

  `);
  */

  /*
  await db.execAsync(`
    DROP TABLE IF EXISTS Run;
  `);
  /*


  //Drop all tables:
  /*
  await db.execAsync(`
    DROP TABLE IF EXISTS Program;
    DROP TABLE IF EXISTS "Set";
    DROP TABLE IF EXISTS Exercise;
    DROP TABLE IF EXISTS Exercise_Instance;
    DROP TABLE IF EXISTS Workout_Type_Instance;
    DROP TABLE IF EXISTS Day;
    DROP TABLE IF EXISTS Microcycle;
    DROP TABLE IF EXISTS Mesocycle;
  `);
  */
}
