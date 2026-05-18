import { normalizeLocalDateString } from "../Utils/dateUtils";
import { createNextSyncVersion } from "../Utils/syncUtils";
import { withTransaction } from "./shared";
import zhadowsebProgramImportPayload from "./zhadowsebProgramImportPayload";

export const ZHADOWSEB_PROGRAM_IMPORT_EMAIL = "zhadowseb@gmail.com";

const ZHADOWSEB_PROGRAM_IMPORT_METADATA_KEY =
  "one_time_import.zhadowseb_programs_v1";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isZhadowsebProgramImportTarget(user) {
  return normalizeEmail(user?.email) === ZHADOWSEB_PROGRAM_IMPORT_EMAIL;
}

function getTable(tableName) {
  const value = zhadowsebProgramImportPayload?.tables?.[tableName];
  return Array.isArray(value) ? value : [];
}

function createLocalUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = char === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
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

function normalizeVisibleColumns(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalizeProgramDate(value) {
  return normalizeLocalDateString(value) ?? value ?? null;
}

function cloudTimeToLocalTimestamp(dateValue, timeValue) {
  const normalizedDate = normalizeLocalDateString(dateValue);

  if (!normalizedDate || typeof timeValue !== "string") {
    return null;
  }

  const timeMatch = timeValue.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!timeMatch) {
    return null;
  }

  const [day, month, year] = normalizedDate.split(".").map(Number);
  const [, hours, minutes, seconds = "00"] = timeMatch;
  const date = new Date(
    year,
    month - 1,
    day,
    Number(hours),
    Number(minutes),
    Number(seconds),
    0
  );

  return Number.isNaN(date.getTime()) ? null : Math.trunc(date.getTime() / 1000);
}

async function getImportMetadata(db) {
  const row = await db.getFirstAsync(
    `SELECT metadata_value
     FROM App_Metadata
     WHERE metadata_key = ?;`,
    [ZHADOWSEB_PROGRAM_IMPORT_METADATA_KEY]
  );

  return row?.metadata_value ?? null;
}

async function setImportMetadata(db, metadataValue) {
  await db.runAsync(
    `INSERT INTO App_Metadata (metadata_key, metadata_value)
     VALUES (?, ?)
     ON CONFLICT(metadata_key)
     DO UPDATE SET metadata_value = excluded.metadata_value;`,
    [ZHADOWSEB_PROGRAM_IMPORT_METADATA_KEY, JSON.stringify(metadataValue)]
  );
}

export async function getZhadowsebProgramImportStatus(db, user) {
  if (!isZhadowsebProgramImportTarget(user)) {
    return {
      isTargetUser: false,
      isImported: false,
      importedAt: null,
      counts: null,
    };
  }

  const metadata = await getImportMetadata(db);

  if (!metadata) {
    return {
      isTargetUser: true,
      isImported: false,
      importedAt: null,
      counts: zhadowsebProgramImportPayload.counts ?? null,
    };
  }

  try {
    const parsedMetadata = JSON.parse(metadata);

    return {
      isTargetUser: true,
      isImported: true,
      importedAt: parsedMetadata.importedAt ?? null,
      counts: parsedMetadata.counts ?? zhadowsebProgramImportPayload.counts ?? null,
    };
  } catch {
    return {
      isTargetUser: true,
      isImported: true,
      importedAt: null,
      counts: zhadowsebProgramImportPayload.counts ?? null,
    };
  }
}

function requireMappedId(map, oldId, label) {
  const mappedId = map.get(oldId);

  if (!mappedId) {
    throw new Error(`Missing imported parent for ${label} ${oldId}.`);
  }

  return mappedId;
}

function buildAncestorMaps({ mesocycles, microcycles, days }) {
  const mesocycleById = new Map(
    mesocycles.map((mesocycle) => [mesocycle.id, mesocycle])
  );
  const microcycleById = new Map(
    microcycles.map((microcycle) => [microcycle.id, microcycle])
  );
  const dayById = new Map(days.map((day) => [day.id, day]));

  return {
    getProgramCloudIdForDay(day) {
      const microcycle = microcycleById.get(day.cloud_microcycle_id);
      const mesocycle = mesocycleById.get(microcycle?.cloud_mesocycle_id);
      return mesocycle?.cloud_program_id ?? null;
    },
    getDateForWorkout(workout) {
      return dayById.get(workout.cloud_day_id)?.date ?? workout.date;
    },
  };
}

export async function importZhadowsebProgramsOnce(db, user) {
  if (!isZhadowsebProgramImportTarget(user)) {
    throw new Error("This import can only run for zhadowseb@gmail.com.");
  }

  const existingMetadata = await getImportMetadata(db);

  if (existingMetadata) {
    return {
      imported: false,
      alreadyImported: true,
      counts: zhadowsebProgramImportPayload.counts ?? null,
    };
  }

  const programs = getTable("Program").sort((left, right) =>
    `${left.start_date ?? ""}:${left.id}`.localeCompare(
      `${right.start_date ?? ""}:${right.id}`
    )
  );
  const mesocycles = getTable("Mesocycle").sort((left, right) =>
    `${left.cloud_program_id}:${left.mesocycle_number}:${left.id}`.localeCompare(
      `${right.cloud_program_id}:${right.mesocycle_number}:${right.id}`
    )
  );
  const microcycles = getTable("Microcycle").sort((left, right) =>
    `${left.cloud_mesocycle_id}:${left.microcycle_number}:${left.id}`.localeCompare(
      `${right.cloud_mesocycle_id}:${right.microcycle_number}:${right.id}`
    )
  );
  const days = getTable("Day").sort((left, right) =>
    `${left.cloud_microcycle_id}:${left.date}:${left.id}`.localeCompare(
      `${right.cloud_microcycle_id}:${right.date}:${right.id}`
    )
  );
  const workouts = getTable("workout_type_instance").sort((left, right) =>
    `${left.cloud_day_id}:${left.date}:${left.id}`.localeCompare(
      `${right.cloud_day_id}:${right.date}:${right.id}`
    )
  );
  const exercises = getTable("exercise_instance").sort((left, right) =>
    `${left.cloud_workout_type_instance_id}:${left.exercise_order}:${left.id}`.localeCompare(
      `${right.cloud_workout_type_instance_id}:${right.exercise_order}:${right.id}`
    )
  );
  const sets = getTable("set").sort((left, right) =>
    `${left.cloud_exercise_instance_id}:${left.set_number}:${left.id}`.localeCompare(
      `${right.cloud_exercise_instance_id}:${right.set_number}:${right.id}`
    )
  );
  const ancestors = buildAncestorMaps({ mesocycles, microcycles, days });
  const programIdMap = new Map();
  const mesocycleIdMap = new Map();
  const microcycleIdMap = new Map();
  const dayIdMap = new Map();
  const workoutIdMap = new Map();
  const exerciseIdMap = new Map();

  await withTransaction(db, async () => {
    for (const program of programs) {
      const result = await db.runAsync(
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          program.program_name,
          normalizeProgramDate(program.start_date),
          program.status ?? "NOT_STARTED",
        ]
      );

      programIdMap.set(program.id, result.lastInsertRowId);
    }

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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            programIdMap,
            mesocycle.cloud_program_id,
            "program"
          ),
          toIntegerOrNull(mesocycle.mesocycle_number) ?? 0,
          toIntegerOrNull(mesocycle.weeks) ?? 0,
          mesocycle.focus ?? null,
          toBooleanInt(mesocycle.done),
        ]
      );

      mesocycleIdMap.set(mesocycle.id, result.lastInsertRowId);
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            mesocycleIdMap,
            microcycle.cloud_mesocycle_id,
            "mesocycle"
          ),
          toIntegerOrNull(microcycle.microcycle_number) ?? 0,
          microcycle.focus ?? null,
          toBooleanInt(microcycle.done),
        ]
      );

      microcycleIdMap.set(microcycle.id, result.lastInsertRowId);
    }

    for (const day of days) {
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            microcycleIdMap,
            day.cloud_microcycle_id,
            "microcycle"
          ),
          requireMappedId(
            programIdMap,
            ancestors.getProgramCloudIdForDay(day),
            "program"
          ),
          day.weekday,
          normalizeProgramDate(day.date),
          toBooleanInt(day.done),
          toBooleanInt(day.is_sick),
        ]
      );

      dayIdMap.set(day.id, result.lastInsertRowId);
    }

    for (const workout of workouts) {
      const workoutDate = normalizeProgramDate(
        ancestors.getDateForWorkout(workout)
      );
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(dayIdMap, workout.cloud_day_id, "day"),
          workout.workout_type,
          workoutDate,
          workout.label ?? null,
          toBooleanInt(workout.done),
          cloudTimeToLocalTimestamp(workoutDate, workout.original_start_time),
          toIntegerOrNull(workout.elapsed_time) ?? 0,
        ]
      );

      workoutIdMap.set(workout.id, result.lastInsertRowId);
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          requireMappedId(
            workoutIdMap,
            exercise.cloud_workout_type_instance_id,
            "workout"
          ),
          exercise.exercise_name,
          toIntegerOrNull(exercise.exercise_order) ?? 0,
          toIntegerOrNull(exercise.sets) ?? 0,
          normalizeVisibleColumns(exercise.visible_columns),
          exercise.note ?? null,
          toBooleanInt(exercise.done),
        ]
      );

      exerciseIdMap.set(exercise.id, result.lastInsertRowId);
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
        [
          createLocalUuid(),
          createNextSyncVersion(),
          toIntegerOrNull(set.set_number),
          requireMappedId(
            exerciseIdMap,
            set.cloud_exercise_instance_id,
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
          set.note ?? null,
        ]
      );
    }

    await setImportMetadata(db, {
      importedAt: new Date().toISOString(),
      sourceUserId: zhadowsebProgramImportPayload.sourceUserId,
      counts: {
        programs: programs.length,
        mesocycles: mesocycles.length,
        microcycles: microcycles.length,
        days: days.length,
        workouts: workouts.length,
        exercises: exercises.length,
        sets: sets.length,
      },
    });
  });

  return {
    imported: true,
    alreadyImported: false,
    counts: {
      programs: programs.length,
      mesocycles: mesocycles.length,
      microcycles: microcycles.length,
      days: days.length,
      workouts: workouts.length,
      exercises: exercises.length,
      sets: sets.length,
    },
  };
}
