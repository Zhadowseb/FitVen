import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { withTransaction } from "./shared";
import { createNextSyncVersion } from "../Utils/syncUtils";

const EXPORT_TYPE = "fitapp_program";
const EXPORT_VERSION = 1;
const EXPORT_FILE_EXTENSION = "fitprogram.json";
const EXPORT_MIME_TYPE = "application/json";
const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function normalizeSqliteParam(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function sqliteParams(values) {
  return values.map(normalizeSqliteParam);
}

function toBooleanInt(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return value === 0 ? 0 : 1;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes"].includes(value.trim().toLowerCase()) ? 1 : 0;
  }

  return 0;
}

function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeText(value, fallbackValue = null) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallbackValue;
}

function normalizeStatus(value) {
  const normalizedStatus =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return ["COMPLETE", "ACTIVE", "NOT_STARTED"].includes(normalizedStatus)
    ? normalizedStatus
    : "NOT_STARTED";
}

function normalizeWeekday(value, fallbackIndex = 0) {
  const normalizedValue = normalizeText(value);

  if (WEEK_DAYS.includes(normalizedValue)) {
    return normalizedValue;
  }

  return WEEK_DAYS[fallbackIndex % WEEK_DAYS.length] ?? WEEK_DAYS[0];
}

function normalizeRunType(value) {
  const normalizedValue =
    typeof value === "string"
      ? value.trim().toUpperCase().replace(/[-\s]+/g, "_")
      : "";

  if (["WARMUP", "WARM_UP"].includes(normalizedValue)) {
    return "WARMUP";
  }

  if (["COOLDOWN", "COOL_DOWN"].includes(normalizedValue)) {
    return "COOLDOWN";
  }

  return "WORKING_SET";
}

function normalizeVisibleColumns(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function createLocalUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = char === "x" ? randomValue : (randomValue & 0x3) | 0x8;

    return value.toString(16);
  });
}

function requireMappedId(map, oldId, label) {
  const mappedId = map.get(toIntegerOrNull(oldId));

  if (!mappedId) {
    throw new Error(`Missing imported parent for ${label} ${oldId}.`);
  }

  return mappedId;
}

function getTable(payload, tableName) {
  const rows = payload?.tables?.[tableName];
  return Array.isArray(rows) ? rows : [];
}

function getRowId(row) {
  return toIntegerOrNull(row?.id);
}

function sortBy(...keys) {
  return (left, right) => {
    for (const key of keys) {
      const leftValue = left?.[key] ?? "";
      const rightValue = right?.[key] ?? "";

      if (leftValue < rightValue) {
        return -1;
      }

      if (leftValue > rightValue) {
        return 1;
      }
    }

    return 0;
  };
}

function countRows(tables) {
  return Object.fromEntries(
    Object.entries(tables).map(([tableName, rows]) => [
      tableName,
      Array.isArray(rows) ? rows.length : 0,
    ])
  );
}

function sanitizeFileName(value) {
  const sanitizedValue = String(value ?? "program")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return sanitizedValue || "program";
}

function getTransferDirectory() {
  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!baseDirectory) {
    throw new Error("No local file directory is available for program export.");
  }

  return `${baseDirectory}program-exports/`;
}

async function ensureTransferDirectory() {
  const transferDirectory = getTransferDirectory();

  await FileSystem.makeDirectoryAsync(transferDirectory, {
    intermediates: true,
  });

  return transferDirectory;
}

function buildExportFileName(programName) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .replace("Z", "");

  return `${sanitizeFileName(programName)}-${timestamp}.${EXPORT_FILE_EXTENSION}`;
}

async function getProgramExportTables(db, programId) {
  const program = await db.getFirstAsync(
    `SELECT
        program_id AS id,
        program_name,
        start_date,
        status
     FROM Program
     WHERE program_id = ?
       AND COALESCE(deleted_at, '') = ''
     LIMIT 1;`,
    [programId]
  );

  if (!program?.id) {
    throw new Error("Programmet blev ikke fundet.");
  }

  const [
    mesocycles,
    microcycles,
    days,
    workouts,
    exercises,
    sets,
    runs,
    estimatedSets,
    rmWeightProgressions,
    programBestExercises,
  ] = await Promise.all([
    db.getAllAsync(
      `SELECT
          mesocycle_id AS id,
          program_id,
          mesocycle_number,
          weeks,
          focus,
          done
       FROM Mesocycle
       WHERE program_id = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY mesocycle_number ASC, mesocycle_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          mc.microcycle_id AS id,
          mc.mesocycle_id,
          mc.microcycle_number,
          mc.focus,
          mc.done
       FROM Microcycle mc
       JOIN Mesocycle m ON m.mesocycle_id = mc.mesocycle_id
       WHERE m.program_id = ?
         AND COALESCE(mc.deleted_at, '') = ''
         AND COALESCE(m.deleted_at, '') = ''
       ORDER BY m.mesocycle_number ASC, mc.microcycle_number ASC, mc.microcycle_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          d.day_id AS id,
          d.microcycle_id,
          d.program_id,
          d.Weekday AS weekday,
          d.date,
          d.done,
          d.is_sick
       FROM Day d
       WHERE d.program_id = ?
         AND COALESCE(d.deleted_at, '') = ''
       ORDER BY d.date ASC, d.day_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          w.workout_id AS id,
          w.day_id,
          w.workout_type,
          w.date,
          w.label,
          w.done,
          w.is_active,
          w.original_start_time,
          w.elapsed_time
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.program_id = ?
         AND COALESCE(w.deleted_at, '') = ''
         AND COALESCE(d.deleted_at, '') = ''
       ORDER BY w.date ASC, w.workout_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          e.exercise_instance_id AS id,
          e.workout_type_instance_id,
          e.exercise_name,
          e.exercise_order,
          e.sets,
          e.visible_columns,
          e.note,
          e.done
       FROM Exercise_Instance e
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.program_id = ?
         AND COALESCE(e.deleted_at, '') = ''
         AND COALESCE(w.deleted_at, '') = ''
         AND COALESCE(d.deleted_at, '') = ''
       ORDER BY w.date ASC, e.exercise_order ASC, e.exercise_instance_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          s.sets_id AS id,
          s.exercise_instance_id,
          s.set_number,
          s.personal_record,
          s.pause,
          s.rpe,
          s.weight,
          s.rm_percentage,
          s.reps,
          s.done,
          s.failed,
          s.amrap,
          s.note
       FROM "Set" s
       JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
       JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.program_id = ?
         AND COALESCE(s.deleted_at, '') = ''
         AND COALESCE(e.deleted_at, '') = ''
         AND COALESCE(w.deleted_at, '') = ''
         AND COALESCE(d.deleted_at, '') = ''
       ORDER BY w.date ASC, e.exercise_order ASC, s.set_number ASC, s.sets_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          r.Run_id AS id,
          r.workout_id,
          r.type,
          r.set_number,
          r.is_pause,
          r.distance,
          r.pace,
          r.time,
          r.heartrate,
          r.stat_priority,
          r.done
       FROM Run r
       JOIN Workout_Type_Instance w ON w.workout_id = r.workout_id
       JOIN Day d ON d.day_id = w.day_id
       WHERE d.program_id = ?
         AND COALESCE(w.deleted_at, '') = ''
         AND COALESCE(d.deleted_at, '') = ''
       ORDER BY w.date ASC, r.type ASC, r.set_number ASC, r.Run_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          estimated_set_id AS id,
          program_id,
          exercise_name,
          estimated_weight
       FROM Estimated_Set
       WHERE program_id = ?
       ORDER BY exercise_name COLLATE NOCASE ASC, estimated_set_id ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          rmp.rm_weight_progression_id AS id,
          rmp.mesocycle_id,
          rmp.exercise_name,
          rmp.progression_weight
       FROM RMWeightProgression rmp
       JOIN Mesocycle m ON m.mesocycle_id = rmp.mesocycle_id
       WHERE m.program_id = ?
       ORDER BY m.mesocycle_number ASC, rmp.exercise_name COLLATE NOCASE ASC;`,
      [programId]
    ),
    db.getAllAsync(
      `SELECT
          program_best_exercise_id AS id,
          program_id,
          exercise_name,
          is_selected
       FROM Program_Best_Exercise
       WHERE program_id = ?
       ORDER BY exercise_name COLLATE NOCASE ASC;`,
      [programId]
    ),
  ]);

  return {
    Program: [program],
    Mesocycle: mesocycles,
    Microcycle: microcycles,
    Day: days,
    workout_type_instance: workouts,
    exercise_instance: exercises,
    set: sets,
    Run: runs,
    Estimated_Set: estimatedSets,
    RMWeightProgression: rmWeightProgressions,
    Program_Best_Exercise: programBestExercises,
  };
}

export async function buildProgramExportPayload(db, programId) {
  const tables = await getProgramExportTables(db, programId);
  const program = tables.Program[0];

  return {
    export_type: EXPORT_TYPE,
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    program_name: program.program_name,
    counts: countRows(tables),
    tables,
  };
}

export async function exportProgramToFile(db, programId) {
  const payload = await buildProgramExportPayload(db, programId);
  const exportDirectory = await ensureTransferDirectory();
  const fileName = buildExportFileName(payload.program_name);
  const fileUri = `${exportDirectory}${fileName}`;
  const contents = JSON.stringify(payload, null, 2);

  await FileSystem.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: EXPORT_MIME_TYPE,
      UTI: "public.json",
      dialogTitle: "Export program",
    });
  }

  return {
    fileName,
    fileUri,
    shared: canShare,
    programName: payload.program_name,
    counts: payload.counts,
  };
}

function validateProgramImportPayload(payload) {
  const exportType = payload?.export_type ?? payload?.exportType;
  const exportVersion = payload?.export_version ?? payload?.exportVersion;

  if (exportType !== EXPORT_TYPE || Number(exportVersion) !== EXPORT_VERSION) {
    throw new Error("Filen er ikke en gyldig FitApp program-export.");
  }

  const programs = getTable(payload, "Program");

  if (programs.length !== 1) {
    throw new Error("The program file must contain exactly one program.");
  }

  return payload;
}

function parseProgramImportPayload(rawFileContents) {
  const trimmedContents = rawFileContents.replace(/^\uFEFF/, "").trim();

  if (!trimmedContents) {
    throw new Error("Program-filen er tom.");
  }

  return validateProgramImportPayload(JSON.parse(trimmedContents));
}

async function readPickedFile(asset) {
  if (typeof asset?.file?.text === "function") {
    return asset.file.text();
  }

  if (!asset?.uri) {
    throw new Error("The selected file could not be read.");
  }

  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function insertImportedProgram(db, payload) {
  const tables = payload.tables ?? {};
  const program = getTable(payload, "Program")[0];
  const mesocycles = getTable(payload, "Mesocycle").sort(
    sortBy("mesocycle_number", "id")
  );
  const microcycles = getTable(payload, "Microcycle").sort(
    sortBy("mesocycle_id", "microcycle_number", "id")
  );
  const days = getTable(payload, "Day").sort(sortBy("date", "id"));
  const workouts = getTable(payload, "workout_type_instance").sort(
    sortBy("date", "id")
  );
  const exercises = getTable(payload, "exercise_instance").sort(
    sortBy("workout_type_instance_id", "exercise_order", "id")
  );
  const sets = getTable(payload, "set").sort(
    sortBy("exercise_instance_id", "set_number", "id")
  );
  const runs = getTable(payload, "Run").sort(
    sortBy("workout_id", "type", "set_number", "id")
  );
  const estimatedSets = getTable(payload, "Estimated_Set").sort(
    sortBy("exercise_name", "id")
  );
  const rmWeightProgressions = getTable(payload, "RMWeightProgression").sort(
    sortBy("mesocycle_id", "exercise_name", "id")
  );
  const programBestExercises = getTable(payload, "Program_Best_Exercise").sort(
    sortBy("exercise_name", "id")
  );
  const mesocycleIdMap = new Map();
  const microcycleIdMap = new Map();
  const dayIdMap = new Map();
  const workoutIdMap = new Map();
  const exerciseIdMap = new Map();
  let importedProgramId = null;

  await withTransaction(db, async () => {
    const programResult = await db.runAsync(
      `INSERT INTO Program (
        cloud_program_id,
        remote_local_program_id,
        sync_id,
        sync_version,
        deleted_at,
        program_name,
        start_date,
        status,
        needs_sync
      ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, 1);`,
      sqliteParams([
        createLocalUuid(),
        createNextSyncVersion(),
        normalizeText(program.program_name, "Imported program"),
        normalizeText(program.start_date, "01.01.1970"),
        normalizeStatus(program.status),
      ])
    );

    importedProgramId = programResult.lastInsertRowId;
    for (const mesocycle of mesocycles) {
      const result = await db.runAsync(
        `INSERT INTO Mesocycle (
          cloud_mesocycle_id,
          remote_local_mesocycle_id,
          sync_id,
          sync_version,
          deleted_at,
          program_id,
          mesocycle_number,
          weeks,
          focus,
          done,
          needs_sync
        ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, 1);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          importedProgramId,
          toIntegerOrNull(mesocycle.mesocycle_number) ?? 0,
          toIntegerOrNull(mesocycle.weeks) ?? 0,
          normalizeText(mesocycle.focus, "No focus set"),
          toBooleanInt(mesocycle.done),
        ])
      );

      mesocycleIdMap.set(getRowId(mesocycle), result.lastInsertRowId);
    }

    for (const microcycle of microcycles) {
      const result = await db.runAsync(
        `INSERT INTO Microcycle (
          cloud_microcycle_id,
          sync_id,
          sync_version,
          deleted_at,
          mesocycle_id,
          microcycle_number,
          focus,
          done,
          needs_sync
        ) VALUES (NULL, ?, ?, NULL, ?, ?, ?, ?, 1);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            mesocycleIdMap,
            microcycle.mesocycle_id,
            "mesocycle"
          ),
          toIntegerOrNull(microcycle.microcycle_number) ?? 0,
          normalizeText(microcycle.focus, "No focus"),
          toBooleanInt(microcycle.done),
        ])
      );

      microcycleIdMap.set(getRowId(microcycle), result.lastInsertRowId);
    }

    for (const [index, day] of days.entries()) {
      const result = await db.runAsync(
        `INSERT INTO Day (
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
        ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 1);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(microcycleIdMap, day.microcycle_id, "microcycle"),
          importedProgramId,
          normalizeWeekday(day.weekday, index),
          normalizeText(day.date, program.start_date ?? "01.01.1970"),
          toBooleanInt(day.done),
          toBooleanInt(day.is_sick),
        ])
      );

      dayIdMap.set(getRowId(day), result.lastInsertRowId);
    }

    for (const workout of workouts) {
      const result = await db.runAsync(
        `INSERT INTO Workout_Type_Instance (
          cloud_workout_type_instance_id,
          remote_local_workout_type_instance_id,
          sync_id,
          sync_version,
          deleted_at,
          day_id,
          workout_type,
          date,
          label,
          done,
          needs_sync,
          is_active,
          original_start_time,
          timer_start,
          elapsed_time
        ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, 1, 0, ?, NULL, ?);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(dayIdMap, workout.day_id, "day"),
          normalizeText(workout.workout_type, workout.label ?? "Workout"),
          normalizeText(workout.date, program.start_date ?? "01.01.1970"),
          normalizeText(workout.label),
          toBooleanInt(workout.done),
          toIntegerOrNull(workout.original_start_time),
          toIntegerOrNull(workout.elapsed_time) ?? 0,
        ])
      );

      workoutIdMap.set(getRowId(workout), result.lastInsertRowId);
    }

    for (const exercise of exercises) {
      const result = await db.runAsync(
        `INSERT INTO Exercise_Instance (
          cloud_exercise_instance_id,
          remote_local_exercise_instance_id,
          sync_id,
          sync_version,
          deleted_at,
          workout_type_instance_id,
          exercise_name,
          exercise_order,
          sets,
          visible_columns,
          note,
          done,
          needs_sync
        ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 1);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            workoutIdMap,
            exercise.workout_type_instance_id,
            "workout"
          ),
          normalizeText(exercise.exercise_name, "Exercise"),
          toIntegerOrNull(exercise.exercise_order) ?? 0,
          toIntegerOrNull(exercise.sets) ?? 0,
          normalizeVisibleColumns(exercise.visible_columns),
          normalizeText(exercise.note),
          toBooleanInt(exercise.done),
        ])
      );

      exerciseIdMap.set(getRowId(exercise), result.lastInsertRowId);
    }

    for (const set of sets) {
      await db.runAsync(
        `INSERT INTO "Set" (
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
        ) VALUES (NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
        sqliteParams([
          createLocalUuid(),
          createNextSyncVersion(),
          toIntegerOrNull(set.set_number) ?? 0,
          requireMappedId(
            exerciseIdMap,
            set.exercise_instance_id,
            "exercise"
          ),
          toBooleanInt(set.personal_record),
          toIntegerOrNull(set.pause),
          toIntegerOrNull(set.rpe),
          toIntegerOrNull(set.weight),
          toIntegerOrNull(set.rm_percentage),
          toIntegerOrNull(set.reps),
          toBooleanInt(set.done),
          toBooleanInt(set.failed),
          toBooleanInt(set.amrap),
          normalizeText(set.note),
        ])
      );
    }

    for (const run of runs) {
      await db.runAsync(
        `INSERT INTO Run (
          workout_id,
          type,
          set_number,
          is_pause,
          distance,
          pace,
          time,
          heartrate,
          stat_priority,
          done
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        sqliteParams([
          requireMappedId(workoutIdMap, run.workout_id, "workout"),
          normalizeRunType(run.type),
          toIntegerOrNull(run.set_number) ?? 0,
          toBooleanInt(run.is_pause),
          toIntegerOrNull(run.distance),
          normalizeText(run.pace),
          toIntegerOrNull(run.time),
          toIntegerOrNull(run.heartrate),
          normalizeText(run.stat_priority),
          toBooleanInt(run.done),
        ])
      );
    }

    for (const estimatedSet of estimatedSets) {
      await db.runAsync(
        `INSERT INTO Estimated_Set (
          program_id,
          exercise_name,
          estimated_weight
        ) VALUES (?, ?, ?);`,
        sqliteParams([
          importedProgramId,
          normalizeText(estimatedSet.exercise_name, "Exercise"),
          toIntegerOrNull(estimatedSet.estimated_weight) ?? 0,
        ])
      );
    }

    for (const progression of rmWeightProgressions) {
      await db.runAsync(
        `INSERT OR IGNORE INTO RMWeightProgression (
          mesocycle_id,
          exercise_name,
          progression_weight
        ) VALUES (?, ?, ?);`,
        sqliteParams([
          requireMappedId(
            mesocycleIdMap,
            progression.mesocycle_id,
            "mesocycle"
          ),
          normalizeText(progression.exercise_name, "Exercise"),
          toNumberOrNull(progression.progression_weight) ?? 0,
        ])
      );
    }

    for (const selection of programBestExercises) {
      await db.runAsync(
        `INSERT OR IGNORE INTO Program_Best_Exercise (
          program_id,
          exercise_name,
          is_selected
        ) VALUES (?, ?, ?);`,
        sqliteParams([
          importedProgramId,
          normalizeText(selection.exercise_name, "Exercise"),
          toBooleanInt(selection.is_selected),
        ])
      );
    }
  });

  return {
    programId: importedProgramId,
    programName: normalizeText(program.program_name, "Imported program"),
    counts: {
      ...countRows(tables),
      Program: 1,
    },
  };
}

export async function importProgramPayload(db, payload) {
  return insertImportedProgram(db, validateProgramImportPayload(payload));
}

export async function importProgramFromFilePicker(db) {
  const pickResult = await DocumentPicker.getDocumentAsync({
    type: [EXPORT_MIME_TYPE, "text/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });

  if (pickResult.canceled) {
    return {
      canceled: true,
    };
  }

  const asset = pickResult.assets?.[0];
  const rawFileContents = await readPickedFile(asset);
  const payload = parseProgramImportPayload(rawFileContents);
  const importedProgram = await insertImportedProgram(db, payload);

  return {
    canceled: false,
    sourceFileName: asset?.name ?? null,
    ...importedProgram,
  };
}
