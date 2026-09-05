// The program domain: programs, blocks, weeks, days, sickness, workout copying
// and the calendar.
//
// The cloud sync engine used to live in the top of this file - roughly 5,300 of
// its 7,400 lines, seven near-identical entity pipelines deep. It is
// src/Services/cloudSync/ now, and re-exported below so no caller changed.
import {
  formatDate,
  normalizeIsoDateString,
  normalizeLocalDateString,
  parseCustomDate,
} from "@utils/dateUtils";
import {
  programRepository,
  runningRepository,
  weightliftingRepository,
  workoutRepository,
} from "@repository";
import { withTransaction } from "@services/shared";
import {
  createNextSyncVersion,
  normalizeSyncId,
} from "@utils/syncUtils";
import { calculateBrzyckiOneRepMax } from "@utils/oneRepMaxUtils";
import { formatDisplayNumber } from "@utils/numberUtils";
import {
  WEEK_DAYS,
  formatElapsedWorkoutDetail,
  getWeekdayLabel,
  getWeeksBeforeMesocycle,
  isWorkoutLive,
  normalizeExerciseOrder,
  normalizeOptionalInteger,
  normalizeProgramStatus,
  resolveSideBySideCloudId,
  resolveWorkoutTypeInstanceCloudLocalId,
} from "./cloudSync/cloudSyncShared";
import { syncDaysInBackground } from "./cloudSync/daySync";
import { syncExerciseInstancesInBackground } from "./cloudSync/exerciseInstanceSync";
import { syncMesocyclesInBackground } from "./cloudSync/mesocycleSync";
import {
  syncMicrocyclesInBackground,
  syncMicrocyclesWithCloud,
} from "./cloudSync/microcycleSync";
import {
  syncProgramsInBackground,
  syncProgramsWithCloud,
} from "./cloudSync/programSync";
import { syncSetsInBackground } from "./cloudSync/setSync";
import { syncWorkoutTypeInstancesInBackground } from "./cloudSync/workoutTypeInstanceSync";
import { LOCATION_WORKOUT_TYPES } from "./cloudSync/workoutTypes";
// Re-exported so every existing import of programService still works.
export {
  getSelectableWorkoutTypes,
  getWeeksBeforeMesocycle,
  pushDirtyStrengthHierarchyWithCloud,
  refreshSelectableWorkoutTypes,
  syncDaysWithCloud,
  syncExerciseInstancesWithCloud,
  syncMesocyclesWithCloud,
  syncMicrocyclesWithCloud,
  syncProgramsWithCloud,
  syncSetsWithCloud,
  syncWorkoutTypeInstancesWithCloud,
  syncWorkoutTypesWithCloud,
} from "./cloudSync";

function formatProgramBestDisplay({ weight, reps, estimatedOneRepMax }) {
  const setText = `${reps} x ${formatDisplayNumber(weight)} kg`;

  if (reps === 1) {
    return {
      setDisplayValue: setText,
      rmDisplayValue: `${formatDisplayNumber(weight)} kg`,
      isEstimated: false,
      estimatedLabel: null,
    };
  }

  return {
    setDisplayValue: setText,
    rmDisplayValue: `${formatDisplayNumber(Math.round(estimatedOneRepMax))} kg`,
    isEstimated: true,
    estimatedLabel: "estimated",
  };
}

async function cloneWorkoutContents(
  db,
  { sourceWorkoutId, targetWorkoutId, resetPersonalRecords = false }
) {
  const exercises = await weightliftingRepository.getExercisesByWorkoutId(
    db,
    sourceWorkoutId
  );

  for (const exercise of exercises) {
    const exerciseResult = await weightliftingRepository.createExercise(db, {
      workoutId: targetWorkoutId,
      exerciseName: exercise.exercise_name,
      sets: exercise.sets,
      visibleColumns: exercise.visible_columns,
      note: exercise.note,
      done: 0,
      exerciseOrder: normalizeExerciseOrder(exercise.exercise_order),
    });

    const sets = await weightliftingRepository.getSetsByExercise(
      db,
      exercise.exercise_id
    );

    for (const set of sets) {
      await weightliftingRepository.createSet(db, {
        setNumber: set.set_number,
        exerciseId: exerciseResult.lastInsertRowId,
        personalRecord: resetPersonalRecords ? 0 : set.personal_record,
        pause: set.pause,
        rpe: set.rpe,
        weight: set.weight,
        rmPercentage: set.rm_percentage,
        reps: set.reps,
        done: 0,
        failed: 0,
        amrap: set.amrap,
        note: set.note,
      });
    }
  }

  const runSets = await runningRepository.getOrderedRunSetsForWorkout(
    db,
    sourceWorkoutId
  );

  for (const runSet of runSets) {
    await runningRepository.createRunSet(db, {
      workoutId: targetWorkoutId,
      type: runSet.type,
      setNumber: runSet.set_number,
      isPause: runSet.is_pause,
      distance: runSet.distance,
      pace: runSet.pace,
      time: runSet.time,
      heartrate: runSet.heartrate,
      statPriority: runSet.stat_priority,
      done: 0,
    });
  }
}

function formatSetCountLabel(count) {
  return count === 1 ? "1 set" : `${count} sets`;
}

function formatExerciseRepSummary(exercise, exerciseSets) {
  const numericSetCount = Number(exercise.sets);
  const setCount =
    Number.isFinite(numericSetCount) && numericSetCount > 0
      ? numericSetCount
      : exerciseSets.length;
  const validReps = exerciseSets
    .map((set) => Number(set.reps))
    .filter((reps) => Number.isFinite(reps) && reps > 0);

  if (validReps.length === 0) {
    return setCount > 0 ? formatSetCountLabel(setCount) : null;
  }

  const firstReps = validReps[0];
  const allSame = validReps.every((reps) => reps === firstReps);

  if (allSame && setCount > 0) {
    return `${setCount} x ${firstReps}`;
  }

  const preview = validReps.slice(0, 4).join("/");
  return validReps.length > 4 ? `${preview}/...` : preview;
}

function buildRunPreviewItems(runSets) {
  const activeCounts = {
    WARMUP: 0,
    WORKING_SET: 0,
    COOLDOWN: 0,
  };
  const activeDoneCounts = {
    WARMUP: 0,
    WORKING_SET: 0,
    COOLDOWN: 0,
  };

  for (const runSet of runSets) {
    if (Number(runSet.is_pause) === 1) {
      continue;
    }

    if (activeCounts[runSet.type] !== undefined) {
      activeCounts[runSet.type] += 1;
      if (Number(runSet.done) === 1) {
        activeDoneCounts[runSet.type] += 1;
      }
    }
  }

  const previewItems = [];

  if (activeCounts.WARMUP > 0) {
    previewItems.push({
      label: "Warmup",
      detail: formatSetCountLabel(activeCounts.WARMUP),
      done: activeDoneCounts.WARMUP === activeCounts.WARMUP,
    });
  }

  if (activeCounts.WORKING_SET > 0) {
    previewItems.push({
      label: "Working sets",
      detail: formatSetCountLabel(activeCounts.WORKING_SET),
      done: activeDoneCounts.WORKING_SET === activeCounts.WORKING_SET,
    });
  }

  if (activeCounts.COOLDOWN > 0) {
    previewItems.push({
      label: "Cooldown",
      detail: formatSetCountLabel(activeCounts.COOLDOWN),
      done: activeDoneCounts.COOLDOWN === activeCounts.COOLDOWN,
    });
  }

  if (previewItems.length > 0) {
    return previewItems;
  }

  if (runSets.length > 0) {
    return [
      {
        label: "Running session",
        detail: formatSetCountLabel(runSets.length),
        done: runSets.every((runSet) => Number(runSet.done) === 1),
      },
    ];
  }

  return [];
}

async function buildWorkoutPreview(db, workout) {
  const exercises = await weightliftingRepository.getExercisesByWorkout(
    db,
    workout.workout_id
  );

  if (exercises.length > 0) {
    const sets = await weightliftingRepository.getSetsByWorkout(db, workout.workout_id);
    const setsByExerciseId = {};

    for (const set of sets) {
      if (!setsByExerciseId[set.exercise_instance_id]) {
        setsByExerciseId[set.exercise_instance_id] = [];
      }

      setsByExerciseId[set.exercise_instance_id].push(set);
    }

    return {
      ...workout,
      previewItems: exercises.map((exercise) => ({
        label: exercise.exercise_name,
        detail: formatExerciseRepSummary(
          exercise,
          setsByExerciseId[exercise.exercise_id] ?? []
        ),
        done: Number(exercise.done) === 1,
      })),
    };
  }

  const runSets = await runningRepository.getOrderedRunSetsForWorkout(
    db,
    workout.workout_id
  );

  return {
    ...workout,
    previewItems: buildRunPreviewItems(runSets),
  };
}

export async function createProgram(db, { programName, startDate, status }) {
  await programRepository.createProgram(db, { programName, startDate, status });
  syncProgramsInBackground(db);
}

export async function getProgramsOverview(db) {
  return programRepository.getProgramsOverview(db);
}

export async function getProgramOptions(db) {
  return programRepository.getProgramOptions(db);
}

export async function getActiveProgram(db) {
  return programRepository.getActiveProgram(db);
}

export async function getProgramStatus(db, programId) {
  return programRepository.getProgramStatus(db, programId);
}

export async function getProgramName(db, programId) {
  return programRepository.getProgramName(db, programId);
}

export async function getProgramBestExerciseOptions(db, programId) {
  const exercises = await weightliftingRepository.getProgramExerciseNames(
    db,
    programId
  );
  const selections = await programRepository.getProgramBestExerciseSelections(
    db,
    programId
  );
  const selectionMap = new Map(
    selections.map((selection) => [
      selection.exercise_name,
      Number(selection.is_selected) === 1,
    ])
  );

  for (const exercise of exercises) {
    if (!selectionMap.has(exercise.exercise_name)) {
      await programRepository.insertProgramBestExerciseSelection(db, {
        programId,
        exerciseName: exercise.exercise_name,
        isSelected: true,
      });
    }
  }

  return exercises.map((exercise) => ({
    exercise_name: exercise.exercise_name,
    is_selected: selectionMap.get(exercise.exercise_name) ?? true,
  }));
}

export async function setProgramBestExerciseSelection(
  db,
  { programId, exerciseName, isSelected }
) {
  await programRepository.upsertProgramBestExerciseSelection(db, {
    programId,
    exerciseName,
    isSelected,
  });
}

export async function updateProgramStatus(db, { programId, status }) {
  await programRepository.updateProgramStatus(db, { programId, status });
  syncProgramsInBackground(db);
}

export async function startProgram(db, { programId, startDate }) {
  const normalizedStartDate = normalizeLocalDateString(startDate);

  if (!normalizedStartDate) {
    throw new Error("A valid program start date is required.");
  }

  await withTransaction(db, async () => {
    const programMetadata = await programRepository.getProgramMetadata(
      db,
      programId
    );
    const previousStartDate = normalizeLocalDateString(
      programMetadata?.start_date
    );

    if (normalizeProgramStatus(programMetadata?.status) !== "NOT_STARTED") {
      throw new Error("Only draft programs can be started.");
    }

    if (!previousStartDate) {
      throw new Error("The program does not have a valid draft start date.");
    }

    const previousStart = parseCustomDate(previousStartDate);
    const nextStart = parseCustomDate(normalizedStartDate);
    if (nextStart.getDay() !== 1) {
      throw new Error("Programs must start on a Monday.");
    }

    const dayOffset = Math.round(
      (Date.UTC(
        nextStart.getFullYear(),
        nextStart.getMonth(),
        nextStart.getDate()
      ) -
        Date.UTC(
          previousStart.getFullYear(),
          previousStart.getMonth(),
          previousStart.getDate()
        )) /
        (24 * 60 * 60 * 1000)
    );

    await programRepository.updateProgramStartAndStatus(db, {
      programId,
      startDate: normalizedStartDate,
      status: "ACTIVE",
    });

    if (dayOffset === 0) {
      return;
    }

    const days = await programRepository.getProgramDaysForScheduleShift(
      db,
      programId
    );

    for (const day of days) {
      const shiftedDate = parseCustomDate(day.date);
      shiftedDate.setDate(shiftedDate.getDate() + dayOffset);

      await programRepository.updateProgramDayDate(db, {
        dayId: day.day_id,
        date: formatDate(shiftedDate),
      });
    }

    await programRepository.alignProgramWorkoutDates(db, programId);
  });

  syncProgramsInBackground(db);
  syncDaysInBackground(db);
  syncWorkoutTypeInstancesInBackground(db);
}

export async function updateProgramName(db, { programId, programName }) {
  await programRepository.updateProgramName(db, { programId, programName });
  syncProgramsInBackground(db);
}

export async function getProgramDayCount(db, programId) {
  return programRepository.getProgramDayCount(db, programId);
}

export async function getTodayProgramSnapshot(db, { programId, date }) {
  const programStatus = await programRepository.getProgramStatus(db, programId);

  if (normalizeProgramStatus(programStatus?.status) === "NOT_STARTED") {
    return null;
  }

  const day = await programRepository.getDayByProgramAndDate(db, {
    programId,
    date,
  });

  if (!day) {
    return null;
  }

  const workouts = await programRepository.getWorkoutsByDayId(db, day.day_id);
  const sets = await programRepository.getSetDoneStatesByDayId(db, day.day_id);
  const workoutsWithPreview = await Promise.all(
    workouts.map((workout) => buildWorkoutPreview(db, workout))
  );

  return {
    day,
    workouts: workoutsWithPreview,
    counts: {
      total: sets.length,
      done: sets.filter((set) => set.done === 1).length,
    },
  };
}

export async function getTodayActivitySummary(db, { date }) {
  const todaySnapshots = await getTodayWorkoutSnapshots(db, { date });
  const todaysWorkouts = todaySnapshots.flatMap((snapshot) => snapshot.workouts);

  if (!todaysWorkouts.length) {
    return {
      activityState: "rest",
      detail: "Rest day",
      workoutType: null,
      workoutLabel: null,
    };
  }

  const liveWorkout = todaysWorkouts.find((workout) => isWorkoutLive(workout));

  if (liveWorkout) {
    return {
      activityState: "live",
      detail: formatElapsedWorkoutDetail(liveWorkout),
      workoutType: liveWorkout.workout_type ?? null,
      workoutLabel: liveWorkout.label ?? liveWorkout.workout_type ?? null,
    };
  }

  const plannedWorkouts = todaysWorkouts.filter(
    (workout) => Number(workout.done) !== 1
  );

  if (plannedWorkouts.length > 0) {
    const nextPlannedWorkout = plannedWorkouts[0];

    return {
      activityState: "planned",
      detail: plannedWorkouts.length > 1 ? `${plannedWorkouts.length} planned` : "Planned",
      workoutType: nextPlannedWorkout.workout_type ?? null,
      workoutLabel:
        nextPlannedWorkout.label ?? nextPlannedWorkout.workout_type ?? null,
    };
  }

  const completedWorkout = todaysWorkouts[todaysWorkouts.length - 1];

  return {
    activityState: "done",
    detail: todaysWorkouts.length > 1 ? `${todaysWorkouts.length} done` : "Done today",
    workoutType: completedWorkout?.workout_type ?? null,
    workoutLabel: completedWorkout?.label ?? completedWorkout?.workout_type ?? null,
  };
}

export async function getTodayProgramSnapshots(db, { date }) {
  const programs = (await programRepository.getProgramsOverview(db)).filter(
    (program) => normalizeProgramStatus(program.status) !== "NOT_STARTED"
  );
  const snapshots = await Promise.all(
    programs.map(async (program) => {
      const snapshot = await getTodayProgramSnapshot(db, {
        programId: program.program_id,
        date,
      });

      if (!snapshot || snapshot.workouts.length === 0) {
        return null;
      }

      return {
        ...snapshot,
        program,
      };
    })
  );

  return snapshots.filter(Boolean);
}

export async function getTodayWorkoutSnapshots(db, { date }) {
  const programSnapshots = await getTodayProgramSnapshots(db, { date });
  const normalizedLocalDate = normalizeLocalDateString(date);
  const normalizedIsoDate = normalizeIsoDateString(date);

  if (!normalizedLocalDate || !normalizedIsoDate) {
    return programSnapshots;
  }

  const calendarWorkouts = await programRepository.getWorkoutsBetweenDates(db, {
    startIsoDate: normalizedIsoDate,
    endIsoDate: normalizedIsoDate,
  });
  const standaloneWorkouts = calendarWorkouts.filter(
    (workout) => workout.program_id == null
  );

  if (standaloneWorkouts.length === 0) {
    return programSnapshots;
  }

  const workoutsWithPreview = await Promise.all(
    standaloneWorkouts.map((workout) => buildWorkoutPreview(db, workout))
  );
  const standaloneDay = {
    day_id: standaloneWorkouts[0]?.day_id ?? null,
    date: normalizedLocalDate,
    Weekday: standaloneWorkouts[0]?.weekday ?? null,
    program_id: null,
  };

  return [
    ...programSnapshots,
    {
      day: standaloneDay,
      workouts: workoutsWithPreview,
      program: null,
    },
  ];
}

export async function getRecentWorkouts(
  db,
  { date = formatDate(new Date()), limit = 2, offset = 0 } = {}
) {
  const localDate = normalizeLocalDateString(date) ?? formatDate(new Date());
  const maxIsoDate =
    normalizeIsoDateString(localDate) ??
    normalizeIsoDateString(formatDate(new Date()));
  const workouts = await programRepository.getRecentWorkouts(db, {
    maxIsoDate,
    limit,
    offset,
  });

  return Promise.all(workouts.map((workout) => buildWorkoutPreview(db, workout)));
}

export async function getWorkoutLibrary(db, { limit = 500, offset = 0 } = {}) {
  const rows = await programRepository.getWorkoutLibrary(db, { limit, offset });

  return rows.map((row) => ({
    ...row,
    exerciseCount: Number(row.exercise_count) || 0,
    setCount: Number(row.set_count) || 0,
    completedSetCount: Number(row.completed_set_count) || 0,
    hasPersonalRecord: Number(row.has_personal_record) === 1,
    isCompleted: Number(row.done) === 1,
    isFavorite: Number(row.is_favorite) === 1,
  }));
}

export async function setWorkoutFavorite(db, { workoutId, isFavorite }) {
  await programRepository.setWorkoutFavorite(db, { workoutId, isFavorite });
}

export async function getDaysByMicrocycle(db, microcycleId) {
  return programRepository.getDaysByMicrocycle(db, microcycleId);
}

export async function getWorkoutLibraryCounts(db) {
  return programRepository.getWorkoutLibraryCounts(db);
}

export async function getWorkoutExercisePreview(db, workoutId) {
  const preview = await buildWorkoutPreview(db, { workout_id: workoutId });

  return preview.previewItems ?? [];
}

function normalizeUsualExerciseName(exerciseName) {
  return String(exerciseName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function buildWorkoutTypeLabel(workoutType) {
  if (workoutType === "StrengthTraining") {
    return "Resistance";
  }

  return workoutType ?? "Workout";
}

function compareUsualWorkoutGroups(left, right, todayWeekday) {
  const leftMatchesToday = left.weekdays.has(todayWeekday) ? 1 : 0;
  const rightMatchesToday = right.weekdays.has(todayWeekday) ? 1 : 0;

  if (leftMatchesToday !== rightMatchesToday) {
    return rightMatchesToday - leftMatchesToday;
  }

  if (left.occurrenceCount !== right.occurrenceCount) {
    return right.occurrenceCount - left.occurrenceCount;
  }

  return right.latestWorkout.date_iso.localeCompare(left.latestWorkout.date_iso);
}

export async function getUsualWorkouts(
  db,
  {
    date = formatDate(new Date()),
    limit = 2,
    historyLimit = 120,
    minOccurrences = 2,
  } = {}
) {
  const localDate = normalizeLocalDateString(date) ?? formatDate(new Date());
  const maxIsoDate =
    normalizeIsoDateString(localDate) ??
    normalizeIsoDateString(formatDate(new Date()));
  const todayWeekday = getWeekdayLabel(parseCustomDate(localDate));
  const rows = await programRepository.getCompletedWorkoutExerciseHistory(db, {
    maxIsoDate,
    limit: historyLimit,
  });
  const workoutsById = new Map();

  for (const row of rows) {
    if (!workoutsById.has(row.workout_id)) {
      workoutsById.set(row.workout_id, {
        workout_id: row.workout_id,
        workout_type: row.workout_type,
        label: row.label,
        date: row.date,
        date_iso: row.date_iso,
        weekday: row.weekday,
        program_id: row.program_id,
        program_name: row.program_name,
        exerciseNames: new Map(),
      });
    }

    const workout = workoutsById.get(row.workout_id);
    const normalizedExerciseName = normalizeUsualExerciseName(row.exercise_name);

    if (normalizedExerciseName) {
      workout.exerciseNames.set(
        normalizedExerciseName,
        String(row.exercise_name).trim()
      );
    }
  }

  const groups = new Map();

  for (const workout of workoutsById.values()) {
    const exerciseSignature = [...workout.exerciseNames.keys()].sort();

    if (exerciseSignature.length === 0) {
      continue;
    }

    const signatureKey = `${workout.workout_type}::${exerciseSignature.join("|")}`;

    if (!groups.has(signatureKey)) {
      groups.set(signatureKey, {
        id: signatureKey,
        workoutType: workout.workout_type,
        title: workout.label ?? buildWorkoutTypeLabel(workout.workout_type),
        exerciseCount: exerciseSignature.length,
        occurrenceCount: 0,
        latestWorkout: workout,
        weekdays: new Set(),
      });
    }

    const group = groups.get(signatureKey);
    group.occurrenceCount += 1;
    group.weekdays.add(workout.weekday);

    if (workout.date_iso > group.latestWorkout.date_iso) {
      group.latestWorkout = workout;
      group.title = workout.label ?? buildWorkoutTypeLabel(workout.workout_type);
    }
  }

  return [...groups.values()]
    .filter((group) => group.occurrenceCount >= minOccurrences)
    .sort((left, right) => compareUsualWorkoutGroups(left, right, todayWeekday))
    .slice(0, limit)
    .map((group) => ({
      id: group.id,
      workout_id: group.latestWorkout.workout_id,
      title: group.title,
      label: group.title,
      workout_type: group.workoutType,
      exerciseCount: group.exerciseCount,
      occurrenceCount: group.occurrenceCount,
      date: group.latestWorkout.date,
      date_iso: group.latestWorkout.date_iso,
      latestDate: group.latestWorkout.date,
      latestDateIso: group.latestWorkout.date_iso,
      suggested: group.weekdays.has(todayWeekday),
      previewItems: [...group.latestWorkout.exerciseNames.values()].map(
        (exerciseName) => ({ label: exerciseName })
      ),
    }));
}

export async function getWorkoutCalendarWorkouts(
  db,
  { startIsoDate, endIsoDate }
) {
  const normalizedStartDate = normalizeIsoDateString(startIsoDate);
  const normalizedEndDate = normalizeIsoDateString(endIsoDate);

  if (!normalizedStartDate || !normalizedEndDate) {
    return [];
  }

  return programRepository.getWorkoutsBetweenDates(db, {
    startIsoDate: normalizedStartDate,
    endIsoDate: normalizedEndDate,
  });
}

export async function getWorkoutCalendarProgramDays(
  db,
  { startIsoDate, endIsoDate }
) {
  const normalizedStartDate = normalizeIsoDateString(startIsoDate);
  const normalizedEndDate = normalizeIsoDateString(endIsoDate);

  if (!normalizedStartDate || !normalizedEndDate) {
    return [];
  }

  return programRepository.getProgramDaysBetweenDates(db, {
    startIsoDate: normalizedStartDate,
    endIsoDate: normalizedEndDate,
  });
}

export async function getProgramExerciseBests(db, programId) {
  const sets = await programRepository.getCompletedStrengthSetsByProgram(
    db,
    programId
  );
  const bestsByExercise = {};

  for (const set of sets) {
    const weight = Number(set.weight);
    const reps = Number(set.reps);

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) {
      continue;
    }

    const estimatedOneRepMax = calculateBrzyckiOneRepMax(weight, reps);

    if (estimatedOneRepMax === null) {
      continue;
    }

    const currentBest = bestsByExercise[set.exercise_name];

    if (
      !currentBest ||
      estimatedOneRepMax > currentBest.estimatedOneRepMax
    ) {
      bestsByExercise[set.exercise_name] = {
        exercise_name: set.exercise_name,
        weight,
        reps,
        performedDate: set.performed_date ?? null,
        estimatedOneRepMax,
        ...formatProgramBestDisplay({
          weight,
          reps,
          estimatedOneRepMax,
        }),
      };
    }
  }

  return Object.values(bestsByExercise).sort((left, right) =>
    left.exercise_name.localeCompare(right.exercise_name)
  );
}

export async function deleteProgram(db, programId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getProgramSyncMetadata(
      db,
      programId
    );

    const cloudProgramId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_program_id"
    );

    if (cloudProgramId !== null) {
      await programRepository.queueProgramDeleteSync(db, {
        cloudProgramId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await programRepository.deleteSetsByProgram(db, programId);
    await programRepository.deleteExercisesByProgram(db, programId);
    await programRepository.deleteRunsByProgram(db, programId);
    await programRepository.deleteWorkoutsByProgram(db, programId);
    await programRepository.deleteDaysByProgram(db, programId);
    await programRepository.deleteMicrocyclesByProgram(db, programId);
    await programRepository.deleteEstimatedSetsByProgram(db, programId);
    await weightliftingRepository.deleteRmWeightProgressionsByProgram(
      db,
      programId
    );
    await programRepository.deleteProgramBestExercisesByProgram(db, programId);
    await programRepository.deleteMesocyclesByProgram(db, programId);
    await programRepository.deleteProgramById(db, programId);
  });

  try {
    await syncProgramsWithCloud(db);
  } catch (error) {
    console.error(
      "Program cloud delete sync failed after local delete; the delete remains queued for retry:",
      error
    );
  }
}

export async function createMesocycle(
  db,
  { programId, startDate, weeks = 0, focus }
) {
  const mesocycleId = await withTransaction(db, async () => {
    const weekTotal = Math.max(0, Number(weeks) || 0);
    const mesocycleCount = await programRepository.countMesocyclesByProgram(
      db,
      programId
    );
    const weekCount = await programRepository.countMicrocyclesByProgram(
      db,
      programId
    );

    const mesocycleResult = await programRepository.insertMesocycle(db, {
      programId,
      mesocycleNumber: (mesocycleCount?.count ?? 0) + 1,
      weeks: weekTotal,
      focus,
    });
    const mesocycleNumber = (mesocycleCount?.count ?? 0) + 1;
    const estimatedSets = await weightliftingRepository.getEstimatedSets(
      db,
      programId
    );

    for (const estimatedSet of estimatedSets) {
      const previousProgression =
        await weightliftingRepository.getLatestRmProgressionWeightBeforeMesocycle(
          db,
          {
            programId,
            exerciseName: estimatedSet.exercise_name,
            mesocycleNumber,
          }
        );

      await weightliftingRepository.insertRmWeightProgression(db, {
        mesocycleId: mesocycleResult.lastInsertRowId,
        exerciseName: estimatedSet.exercise_name,
        progressionWeight:
          mesocycleNumber > 1
            ? Number(previousProgression?.progression_weight || 0) + 2.5
            : 0,
      });
    }

    for (let week = 1; week <= weekTotal; week += 1) {
      const microcycleResult = await programRepository.insertMicrocycle(db, {
        mesocycleId: mesocycleResult.lastInsertRowId,
        microcycleNumber: week,
      });

      for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
        const currentDay =
          (weekCount?.count ?? 0) * 7 +
          (week * 7 - 7) +
          dayIndex;

        const date = parseCustomDate(startDate);
        date.setDate(date.getDate() + currentDay);

        await programRepository.insertDay(db, {
          microcycleId: microcycleResult.lastInsertRowId,
          programId,
          weekday: WEEK_DAYS[dayIndex],
          date: formatDate(date),
        });
      }
    }

    return mesocycleResult.lastInsertRowId;
  });

  syncMesocyclesInBackground(db);
  syncMicrocyclesInBackground(db);
  syncDaysInBackground(db);
  return mesocycleId;
}

export async function getMesocyclesByProgram(db, programId) {
  return programRepository.getMesocyclesByProgram(db, programId);
}

export async function getMesocycleWorkoutCountsByProgram(db, programId) {
  return programRepository.getMesocycleWorkoutCountsByProgram(db, programId);
}

export async function getProgramStats(db, programId) {
  const [overview, weekRows] = await Promise.all([
    programRepository.getProgramOverviewStats(db, programId),
    programRepository.getProgramWeekCompletionStats(db, programId),
  ]);
  const totalWorkouts = Number(overview?.total_workouts) || 0;
  const completedWorkouts = Number(overview?.completed_workouts) || 0;
  const today = parseCustomDate(formatDate(new Date()));
  let streakWeeks = 0;

  const activeWeekRows = weekRows.filter((week) => {
    if (!week.period_start) {
      return false;
    }

    const weekStart = parseCustomDate(week.period_start);
    return !Number.isNaN(weekStart.getTime()) && weekStart <= today;
  });

  for (let index = activeWeekRows.length - 1; index >= 0; index -= 1) {
    const week = activeWeekRows[index];
    const weekWorkoutCount = Number(week.total_workouts) || 0;
    const weekCompletedWorkoutCount = Number(week.completed_workouts) || 0;
    const maintainsStreak =
      weekWorkoutCount === 0 || weekCompletedWorkoutCount >= weekWorkoutCount;

    if (!maintainsStreak) {
      break;
    }

    streakWeeks += 1;
  }

  return {
    totalVolume: Math.round(Number(overview?.total_volume) || 0),
    avgSessionMinutes: Math.round(
      (Number(overview?.avg_session_seconds) || 0) / 60
    ),
    completionPercent:
      totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0,
    completedWorkouts,
    totalWorkouts,
    streakWeeks,
  };
}

export async function updateMesocycleFocus(db, { mesocycleId, focus }) {
  await programRepository.updateMesocycleFocus(db, { mesocycleId, focus });
  syncMesocyclesInBackground(db);
}

export async function addWeekToMesocycle(db, { mesocycleId, programId }) {
  const insertedMicrocycleId = await withTransaction(db, async () => {
    const weeks = await programRepository.getMicrocyclesByMesocycleForInsert(
      db,
      mesocycleId
    );
    const lastWeek = weeks[weeks.length - 1];
    const lastDay = lastWeek
      ? await programRepository.getLastSundayByMicrocycle(
          db,
          lastWeek.microcycle_id
        )
      : null;
    const mesocycleMetadata =
      !lastDay?.date
        ? await programRepository.getMesocycleMetadata(db, {
            mesocycleId,
            programId,
          })
        : null;
    const programMetadata =
      !lastDay?.date
        ? await programRepository.getProgramMetadata(db, programId)
        : null;
    const weeksBefore =
      !lastDay?.date && mesocycleMetadata
        ? await getWeeksBeforeMesocycle(db, {
            programId,
            mesocycleNumber: mesocycleMetadata.mesocycle_number,
          })
        : 0;

    if (!lastDay?.date && !mesocycleMetadata) {
      throw new Error("Block not found for new week.");
    }

    if (!lastDay?.date && !programMetadata?.start_date) {
      throw new Error("Program start date not found for new block week.");
    }

    const microcycleResult = await programRepository.insertMicrocycle(db, {
      mesocycleId,
      microcycleNumber: weeks.length + 1,
    });

    for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
      const date = parseCustomDate(lastDay?.date ?? programMetadata?.start_date);

      if (!lastDay?.date) {
        date.setDate(
          date.getDate() + (weeksBefore + weeks.length) * 7 + dayIndex
        );
      } else {
        date.setDate(date.getDate() + dayIndex + 1);
      }

      await programRepository.insertDay(db, {
        microcycleId: microcycleResult.lastInsertRowId,
        programId,
        weekday: WEEK_DAYS[dayIndex],
        date: formatDate(date),
      });
    }

    await programRepository.incrementMesocycleWeeks(db, mesocycleId);

    return microcycleResult.lastInsertRowId;
  });

  syncMesocyclesInBackground(db);
  syncMicrocyclesInBackground(db);
  syncDaysInBackground(db);
  return insertedMicrocycleId;
}

export async function deleteMesocycle(db, mesocycleId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getMesocycleSyncMetadata(
      db,
      mesocycleId
    );

    const cloudMesocycleId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_mesocycle_id"
    );

    if (cloudMesocycleId !== null) {
      await programRepository.queueMesocycleDeleteSync(db, {
        cloudMesocycleId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await programRepository.deleteSetsByMesocycle(db, mesocycleId);
    await programRepository.deleteExercisesByMesocycle(db, mesocycleId);
    await programRepository.deleteRunsByMesocycle(db, mesocycleId);
    await programRepository.deleteWorkoutsByMesocycle(db, mesocycleId);
    await programRepository.deleteDaysByMesocycle(db, mesocycleId);
    await programRepository.deleteMicrocyclesByMesocycle(db, mesocycleId);
    await weightliftingRepository.deleteRmWeightProgressionsByMesocycle(
      db,
      mesocycleId
    );
    await programRepository.deleteMesocycleById(db, mesocycleId);
  });

  syncMesocyclesInBackground(db);
}

export async function getMesocycleOptions(db, programId) {
  return programRepository.getMesocycleOptions(db, programId);
}

export async function getGlobalWeekIndexFromMicrocycle(
  db,
  { programId, microcycleId }
) {
  const microcycle = await programRepository.getMicrocycleNumberAndMesocycleNumber(
    db,
    {
      programId,
      microcycleId,
    }
  );

  if (!microcycle) {
    throw new Error("Microcycle not found");
  }

  const weeksBefore = await getWeeksBeforeMesocycle(db, {
    programId,
    mesocycleNumber: microcycle.mesocycle_number,
  });

  return weeksBefore + (microcycle.microcycle_number - 1);
}

export async function getMicrocyclesByMesocycle(db, mesocycleId) {
  return programRepository.getMicrocyclesByMesocycle(db, mesocycleId);
}

export async function updateMicrocycleFocus(db, { microcycleId, focus }) {
  await programRepository.updateMicrocycleFocus(db, { microcycleId, focus });
  syncMicrocyclesInBackground(db);
}

export async function getMicrocycleWorkoutCounts(db, microcycleId) {
  const total = await programRepository.getTotalWorkoutCountByMicrocycle(
    db,
    microcycleId
  );
  const done = await programRepository.getDoneWorkoutCountByMicrocycle(
    db,
    microcycleId
  );

  return {
    total: total?.count ?? 0,
    done: done?.count ?? 0,
  };
}

export async function getDayByMicrocycleAndDate(
  db,
  { microcycleId, date }
) {
  return programRepository.getDayByMicrocycleAndDate(db, {
    microcycleId,
    date,
  });
}

export async function getWorkoutLabelsByDay(db, dayId) {
  return programRepository.getWorkoutLabelsByDay(db, dayId);
}

export async function getMicrocycleOptions(db, programId) {
  const mesocycles = await programRepository.getMesocycleOptions(db, programId);
  const microcycles = await programRepository.getAllMicrocyclesByProgram(
    db,
    programId
  );

  return { mesocycles, microcycles };
}

export async function copyMicrocycleWorkouts(
  db,
  { sourceMicrocycleId, targetMicrocycleId }
) {
  await withTransaction(db, async () => {
    const sourceDays = await programRepository.getDaysByMicrocycle(
      db,
      sourceMicrocycleId
    );
    const targetDays = await programRepository.getDaysByMicrocycle(
      db,
      targetMicrocycleId
    );

    const targetDayMap = {};
    for (const day of targetDays) {
      targetDayMap[day.Weekday] = day;
    }

    for (const sourceDay of sourceDays) {
      const targetDay = targetDayMap[sourceDay.Weekday];
      if (!targetDay) {
        continue;
      }

      const workouts = await programRepository.getWorkoutsByDay(
        db,
        sourceDay.day_id
      );

      for (const workout of workouts) {
        const workoutResult = await programRepository.createWorkout(db, {
          date: targetDay.date,
          dayId: targetDay.day_id,
          workoutType: workout.workout_type,
          label: workout.label,
        });

        await cloneWorkoutContents(db, {
          sourceWorkoutId: workout.workout_id,
          targetWorkoutId: workoutResult.lastInsertRowId,
        });
      }

      const hierarchy = await workoutRepository.getDayHierarchyIds(
        db,
        targetDay.day_id
      );
      await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
        dayId: hierarchy?.day_id,
        microcycleId: hierarchy?.microcycle_id,
        mesocycleId: hierarchy?.mesocycle_id,
      });
    }
  });

  syncWorkoutTypeInstancesInBackground(db);
  syncExerciseInstancesInBackground(db);
  syncSetsInBackground(db);
}

export async function deleteMicrocycle(db, microcycleId) {
  let mesocycleId = null;

  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getMicrocycleSyncMetadata(
      db,
      microcycleId
    );
    const metadata = await programRepository.getMicrocycleMetadata(db, microcycleId);
    mesocycleId = metadata?.mesocycle_id ?? null;

    const cloudMicrocycleId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_microcycle_id"
    );

    if (cloudMicrocycleId !== null) {
      await programRepository.queueMicrocycleDeleteSync(db, {
        cloudMicrocycleId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await programRepository.deleteSetsByMicrocycle(db, microcycleId);
    await programRepository.deleteExercisesByMicrocycle(db, microcycleId);
    await programRepository.deleteRunsByMicrocycle(db, microcycleId);
    await programRepository.deleteWorkoutsByMicrocycle(db, microcycleId);
    await programRepository.deleteDaysByMicrocycle(db, microcycleId);
    await programRepository.deleteMicrocycleById(db, microcycleId);

    if (mesocycleId) {
      await programRepository.syncMesocycleWeeksFromMicrocycles(db, mesocycleId);
      await workoutRepository.updateMesocycleDoneFromMicrocycles(db, mesocycleId);
    }
  });

  syncMesocyclesInBackground(db);

  try {
    await syncMicrocyclesWithCloud(db);
  } catch (error) {
    console.error(
      "Microcycle cloud delete sync failed after local delete; the delete remains queued for retry:",
      error
    );
  }
}

export async function getDayDetails(db, { microcycleId, weekday }) {
  const day = await programRepository.getDayByWeekdayAndMicrocycle(db, {
    weekday,
    microcycleId,
  });

  if (!day?.day_id) {
    return null;
  }

  const workouts = await programRepository.getWorkoutsByDayId(db, day.day_id);
  const workoutExercises = [];

  for (const workout of workouts) {
    const exercises = await weightliftingRepository.getExerciseSummariesByWorkout(
      db,
      workout.workout_id
    );

    workoutExercises.push({
      workout_id: workout.workout_id,
      label: workout.label,
      exercises,
    });
  }

  return {
    ...day,
    workouts,
    workoutExercises,
    workoutsDone: day.done === 1,
  };
}

async function persistSicknessPeriodForDay(
  db,
  {
    date,
    previousDate = null,
    continuesPrevious = false,
    sicknessType = null,
    note = null,
  }
) {
  if (!date) {
    return;
  }

  if (!continuesPrevious && previousDate) {
    const previousPeriod =
      await programRepository.getSicknessPeriodCoveringDate(db, {
        date: previousDate,
      });
    const previousPeriodEndDate =
      previousPeriod?.end_date ?? previousPeriod?.start_date ?? null;
    const previousPeriodAlreadyCoversDate =
      !previousPeriod?.end_date ||
      (previousPeriodEndDate &&
        parseCustomDate(previousPeriodEndDate) >= parseCustomDate(date));

    if (previousPeriod?.sickness_id && previousPeriodAlreadyCoversDate) {
      await programRepository.trimSicknessPeriodEndDate(db, {
        sicknessId: previousPeriod.sickness_id,
        endDate: previousDate,
      });
    }
  }

  if (continuesPrevious && previousDate) {
    let previousPeriod =
      await programRepository.getSicknessPeriodEndingOnDate(db, {
        date: previousDate,
      });

    if (!previousPeriod?.sickness_id) {
      previousPeriod =
        await programRepository.getSicknessPeriodCoveringDate(db, {
          date: previousDate,
        });
    }

    if (previousPeriod?.sickness_id) {
      if (
        !previousPeriod.end_date ||
        parseCustomDate(previousPeriod.end_date) >= parseCustomDate(date)
      ) {
        return;
      }

      await programRepository.extendSicknessPeriod(db, {
        sicknessId: previousPeriod.sickness_id,
        endDate: date,
      });
      return;
    }

    await programRepository.createSicknessPeriod(db, {
      startDate: previousDate,
      endDate: date,
    });
    return;
  }

  const existingPeriod =
    await programRepository.getSicknessPeriodStartingOnDate(db, { date });

  if (existingPeriod?.sickness_id) {
    return;
  }

  await programRepository.createSicknessPeriod(db, {
    startDate: date,
    endDate: date,
    sicknessType,
    note,
  });
}

export async function markDaySick(
  db,
  {
    dayId,
    isSick,
    date = null,
    previousDate = null,
    continuesPrevious = false,
    sicknessType = null,
    note = null,
  }
) {
  if (!dayId) {
    return;
  }

  await withTransaction(db, async () => {
    await programRepository.updateDaySick(db, { dayId, isSick });

    if (isSick) {
      await persistSicknessPeriodForDay(db, {
        date,
        previousDate,
        continuesPrevious,
        sicknessType,
        note,
      });
    } else {
      await removeDateFromSicknessPeriods(db, { date });
    }
  });

  syncDaysInBackground(db);
}

function getNextLocalDate(date) {
  const nextDate = parseCustomDate(date);
  nextDate.setDate(nextDate.getDate() + 1);
  return formatDate(nextDate);
}

function getPreviousLocalDate(date) {
  const previousDate = parseCustomDate(date);
  previousDate.setDate(previousDate.getDate() - 1);
  return formatDate(previousDate);
}

function compareLocalDates(leftDate, rightDate) {
  return parseCustomDate(leftDate) - parseCustomDate(rightDate);
}

function getSicknessPeriodRebuildRange(periods) {
  let startDate = null;
  let endDate = null;
  let hasOpenEnd = false;

  for (const period of periods) {
    if (!period?.start_date) {
      continue;
    }

    if (!startDate || compareLocalDates(period.start_date, startDate) < 0) {
      startDate = period.start_date;
    }

    if (!period.end_date) {
      hasOpenEnd = true;
      continue;
    }

    if (!endDate || compareLocalDates(period.end_date, endDate) > 0) {
      endDate = period.end_date;
    }
  }

  if (!startDate) {
    return null;
  }

  return {
    startDate,
    endDate: hasOpenEnd ? null : endDate ?? startDate,
  };
}

async function rebuildDaySicknessFlags(db, { previousPeriods = [] } = {}) {
  const activePeriods = await programRepository.getSicknessPeriods(db);
  const rebuildRange = getSicknessPeriodRebuildRange([
    ...previousPeriods,
    ...activePeriods,
  ]);

  if (!rebuildRange) {
    return;
  }

  await programRepository.updateDaysSickBetweenDates(db, {
    startDate: rebuildRange.startDate,
    endDate: rebuildRange.endDate,
    isSick: false,
  });

  for (const period of activePeriods) {
    await programRepository.updateDaysSickBetweenDates(db, {
      startDate: period.start_date,
      endDate: period.end_date,
      isSick: true,
    });
  }
}

async function removeDateFromSicknessPeriods(db, { date }) {
  if (!date) {
    return;
  }

  const sicknessPeriods =
    await programRepository.getSicknessPeriodsCoveringDate(db, { date });

  for (const period of sicknessPeriods) {
    const startsOnDate = compareLocalDates(period.start_date, date) === 0;
    const endsOnDate = period.end_date
      ? compareLocalDates(period.end_date, date) === 0
      : false;
    const singleDayPeriod =
      startsOnDate &&
      (endsOnDate || (!period.end_date && period.start_date === date));

    if (singleDayPeriod) {
      await programRepository.markSicknessPeriodDeleted(db, {
        sicknessId: period.sickness_id,
        deletedAt: new Date().toISOString(),
      });
      continue;
    }

    if (startsOnDate) {
      await programRepository.updateSicknessPeriodStartDate(db, {
        sicknessId: period.sickness_id,
        startDate: getNextLocalDate(date),
      });
      continue;
    }

    if (endsOnDate) {
      await programRepository.trimSicknessPeriodEndDate(db, {
        sicknessId: period.sickness_id,
        endDate: getPreviousLocalDate(date),
      });
      continue;
    }

    await programRepository.trimSicknessPeriodEndDate(db, {
      sicknessId: period.sickness_id,
      endDate: getPreviousLocalDate(date),
    });
    await programRepository.createSicknessPeriod(db, {
      startDate: getNextLocalDate(date),
      endDate: period.end_date,
      sicknessType: period.sickness_type,
      note: period.note,
    });
  }
}

async function trimOverlappingSicknessPeriods(db) {
  const sicknessPeriods = await programRepository.getSicknessPeriods(db);
  const sortedPeriods = [...sicknessPeriods].sort((leftPeriod, rightPeriod) => {
    const dateComparison = compareLocalDates(
      leftPeriod.start_date,
      rightPeriod.start_date
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return leftPeriod.sickness_id - rightPeriod.sickness_id;
  });

  for (const period of sortedPeriods) {
    const overlappingNextPeriod = sortedPeriods.find((candidatePeriod) => {
      if (candidatePeriod.sickness_id === period.sickness_id) {
        return false;
      }

      if (compareLocalDates(candidatePeriod.start_date, period.start_date) <= 0) {
        return false;
      }

      return (
        !period.end_date ||
        compareLocalDates(candidatePeriod.start_date, period.end_date) <= 0
      );
    });

    if (!overlappingNextPeriod) {
      continue;
    }

    await programRepository.trimSicknessPeriodEndDate(db, {
      sicknessId: period.sickness_id,
      endDate: getPreviousLocalDate(overlappingNextPeriod.start_date),
    });
  }
}

export async function createSicknessPeriod(
  db,
  { startDate, endDate = null, sicknessType = null, note = null }
) {
  const sicknessPeriod = await withTransaction(db, async () => {
    const createdSicknessPeriod = await programRepository.createSicknessPeriod(db, {
      startDate,
      endDate,
      sicknessType,
      note,
    });

    await programRepository.updateDaysSickBetweenDates(db, {
      startDate,
      endDate,
      isSick: true,
    });

    return createdSicknessPeriod;
  });

  syncDaysInBackground(db);
  return sicknessPeriod;
}

export async function updateSicknessPeriod(
  db,
  { sicknessId, startDate, endDate = null, sicknessType = null, note = null }
) {
  let didUpdate = false;

  await withTransaction(db, async () => {
    const previousPeriods = await programRepository.getSicknessPeriods(db);
    const previousPeriod = previousPeriods.find(
      (period) => Number(period.sickness_id) === Number(sicknessId)
    );

    if (!previousPeriod?.sickness_id) {
      return;
    }

    await programRepository.updateSicknessPeriod(db, {
      sicknessId,
      startDate,
      endDate,
      sicknessType,
      note,
    });
    await trimOverlappingSicknessPeriods(db);
    await rebuildDaySicknessFlags(db, {
      previousPeriods,
    });
    didUpdate = true;
  });

  if (didUpdate) {
    syncDaysInBackground(db);
  }
}

export async function deleteSicknessPeriod(db, { sicknessId }) {
  let didDelete = false;

  await withTransaction(db, async () => {
    const previousPeriods = await programRepository.getSicknessPeriods(db);
    const previousPeriod = previousPeriods.find(
      (period) => Number(period.sickness_id) === Number(sicknessId)
    );

    if (!previousPeriod?.sickness_id) {
      return;
    }

    await programRepository.markSicknessPeriodDeleted(db, {
      sicknessId,
      deletedAt: new Date().toISOString(),
    });
    await rebuildDaySicknessFlags(db, {
      previousPeriods,
    });
    didDelete = true;
  });

  if (didDelete) {
    syncDaysInBackground(db);
  }
}

export async function getSicknessPeriods(db) {
  await withTransaction(db, async () => {
    await trimOverlappingSicknessPeriods(db);
  });

  return programRepository.getSicknessPeriods(db);
}

export async function getDayByDate(db, { programId, date }) {
  return programRepository.getDayByDate(db, { programId, date });
}

export async function getWorkoutCopyProgramTargets(db, { date }) {
  const normalizedDate =
    date instanceof Date ? formatDate(date) : normalizeLocalDateString(date);
  const normalizedIsoDate = normalizeIsoDateString(normalizedDate);

  if (!normalizedIsoDate) {
    return [];
  }

  return programRepository.getActiveProgramDaysByIsoDate(db, {
    isoDate: normalizedIsoDate,
  });
}

export async function createWorkoutForDay(
  db,
  { date, dayId, workoutType, label }
) {
  const workout = await withTransaction(db, async () => {
    const workout = await programRepository.createWorkout(db, {
      date,
      dayId,
      workoutType,
      label,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return workout;
  });

  syncWorkoutTypeInstancesInBackground(db);
  return workout;
}

export async function createQuickWorkout(
  db,
  { date = new Date(), workoutType, label }
) {
  const workoutDate = date instanceof Date ? date : parseCustomDate(date);
  const normalizedDate = formatDate(workoutDate);
  const weekday = getWeekdayLabel(workoutDate);

  const createdWorkout = await withTransaction(db, async () => {
    const existingDay = await programRepository.getStandaloneDayByDate(db, {
      date: normalizedDate,
    });
    let dayId = existingDay?.day_id ?? null;

    if (!dayId) {
      const dayResult = await programRepository.insertDay(db, {
        microcycleId: null,
        programId: null,
        weekday,
        date: normalizedDate,
      });

      dayId = dayResult.lastInsertRowId;
    }

    const workoutResult = await programRepository.createWorkout(db, {
      date: normalizedDate,
      dayId,
      workoutType,
      label,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return {
      workout_id: workoutResult.lastInsertRowId,
      workout_type: workoutType,
      workout_label: label ?? workoutType,
      date: normalizedDate,
      day: weekday,
      program_id: null,
      program_name: null,
    };
  });

  syncDaysInBackground(db);
  syncWorkoutTypeInstancesInBackground(db);

  return createdWorkout;
}

export async function copyWorkoutToProgramDay(db, { workoutId, dayId, date }) {
  const normalizedDate =
    date instanceof Date ? formatDate(date) : normalizeLocalDateString(date);

  if (!normalizedDate) {
    throw new Error("A valid workout date is required.");
  }

  const copiedWorkoutId = await withTransaction(db, async () => {
    if (!dayId) {
      return null;
    }

    const workoutResult = await programRepository.copyWorkoutIntoDay(db, {
      date: normalizedDate,
      dayId,
      workoutId,
    });

    await cloneWorkoutContents(db, {
      sourceWorkoutId: workoutId,
      targetWorkoutId: workoutResult.lastInsertRowId,
    });

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return workoutResult.lastInsertRowId;
  });

  if (copiedWorkoutId) {
    syncWorkoutTypeInstancesInBackground(db);
    syncExerciseInstancesInBackground(db);
    syncSetsInBackground(db);
  }

  return copiedWorkoutId;
}

export async function copyWorkoutToDate(
  db,
  { workoutId, programId, date }
) {
  const normalizedDate =
    date instanceof Date ? formatDate(date) : normalizeLocalDateString(date);

  if (!normalizedDate) {
    throw new Error("A valid workout date is required.");
  }

  if (!programId) {
    return null;
  }

  const targetDay = await programRepository.getDayByDate(db, {
    programId,
    date: normalizedDate,
  });

  if (!targetDay?.day_id) {
    return null;
  }

  return copyWorkoutToProgramDay(db, {
    workoutId,
    dayId: targetDay.day_id,
    date: normalizedDate,
  });
}

export async function copyProgramWorkoutToDate(
  db,
  { workoutId, programId, date }
) {
  const programTargets = await getWorkoutCopyProgramTargets(db, { date });
  const preferredProgramTarget =
    programTargets.find(
      (target) => Number(target.program_id) === Number(programId)
    ) ?? programTargets[0];

  if (preferredProgramTarget?.day_id) {
    return copyWorkoutToProgramDay(db, {
      workoutId,
      dayId: preferredProgramTarget.day_id,
      date: preferredProgramTarget.date ?? date,
    });
  }

  const copiedWorkout = await copyWorkoutToStandaloneDate(db, {
    workoutId,
    date,
  });

  return copiedWorkout?.workout_id ?? null;
}

export async function copyWorkoutToStandaloneDate(
  db,
  { workoutId, date = new Date() }
) {
  const normalizedDate =
    date instanceof Date ? formatDate(date) : normalizeLocalDateString(date);

  if (!normalizedDate) {
    throw new Error("A valid workout date is required.");
  }

  const workoutDate = parseCustomDate(normalizedDate);
  const weekday = getWeekdayLabel(workoutDate);
  const sourceMetadata = await workoutRepository.getWorkoutPageMetadata(
    db,
    workoutId
  );

  if (!sourceMetadata) {
    throw new Error("The recent workout could not be found.");
  }

  if (!LOCATION_WORKOUT_TYPES.has(sourceMetadata.workout_type)) {
    const localExercises =
      await weightliftingRepository.getExercisesByWorkoutId(db, workoutId);
    const localSetCountRow =
      await weightliftingRepository.getTotalPlannedSetsByWorkout(db, workoutId);
    const localSetCount = Number(localSetCountRow?.count) || 0;
    const plannedSetCount = localExercises.reduce(
      (total, exercise) => total + (Number(exercise.sets) || 0),
      0
    );
    const weightliftingServiceModule = await import("./weightliftingService");

    try {
      await weightliftingServiceModule.hydrateStrengthWorkoutDataForWorkout(
        db,
        workoutId,
        { forceTargetedHydration: true }
      );
    } catch (error) {
      if (localSetCount < plannedSetCount) {
        throw error;
      }

      console.warn(
        "Could not refresh recent workout sets before copying; using complete local data:",
        error
      );
    }
  }

  const sourceSetCountRow =
    await weightliftingRepository.getTotalPlannedSetsByWorkout(db, workoutId);
  const sourceSetCount = Number(sourceSetCountRow?.count) || 0;

  const copiedWorkout = await withTransaction(db, async () => {
    const existingDay = await programRepository.getStandaloneDayByDate(db, {
      date: normalizedDate,
    });
    let dayId = existingDay?.day_id ?? null;

    if (!dayId) {
      const dayResult = await programRepository.insertDay(db, {
        microcycleId: null,
        programId: null,
        weekday,
        date: normalizedDate,
      });

      dayId = dayResult.lastInsertRowId;
    }

    const workoutResult = await programRepository.copyWorkoutIntoDay(db, {
      date: normalizedDate,
      dayId,
      workoutId,
    });

    if (!workoutResult.changes) {
      throw new Error("The recent workout could not be copied.");
    }

    await cloneWorkoutContents(db, {
      sourceWorkoutId: workoutId,
      targetWorkoutId: workoutResult.lastInsertRowId,
      resetPersonalRecords: true,
    });
    const copiedSetCountRow =
      await weightliftingRepository.getTotalPlannedSetsByWorkout(
        db,
        workoutResult.lastInsertRowId
      );
    const copiedSetCount = Number(copiedSetCountRow?.count) || 0;

    if (copiedSetCount !== sourceSetCount) {
      throw new Error("The recent workout sets could not be copied completely.");
    }

    const hierarchy = await workoutRepository.getDayHierarchyIds(db, dayId);
    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });

    return {
      workout_id: workoutResult.lastInsertRowId,
      workout_type: sourceMetadata.workout_type,
      workout_label: sourceMetadata.workout_label,
      date: normalizedDate,
      day: weekday,
      program_id: null,
      program_name: null,
    };
  });

  if (copiedWorkout) {
    syncDaysInBackground(db);
    syncWorkoutTypeInstancesInBackground(db);
    syncExerciseInstancesInBackground(db);
    syncSetsInBackground(db);
  }

  return copiedWorkout;
}

export async function deleteWorkout(db, workoutId) {
  await withTransaction(db, async () => {
    const syncMetadata = await programRepository.getWorkoutSyncMetadata(
      db,
      workoutId
    );
    const hierarchy = await workoutRepository.getWorkoutHierarchyIds(
      db,
      workoutId
    );
    const remoteLocalWorkoutTypeInstanceId =
      resolveWorkoutTypeInstanceCloudLocalId(syncMetadata) ??
      normalizeOptionalInteger(workoutId, null);

    const cloudWorkoutTypeInstanceId = resolveSideBySideCloudId(
      syncMetadata,
      "cloud_workout_type_instance_id"
    );

    if (
      cloudWorkoutTypeInstanceId !== null ||
      remoteLocalWorkoutTypeInstanceId !== null
    ) {
      await programRepository.queueWorkoutTypeInstanceDeleteSync(db, {
        cloudWorkoutTypeInstanceId,
        remoteLocalWorkoutTypeInstanceId,
        syncId: normalizeSyncId(syncMetadata?.sync_id),
        syncVersion: createNextSyncVersion(syncMetadata?.sync_version),
        deletedAt: new Date().toISOString(),
      });
    }

    await weightliftingRepository.deleteSetsByWorkout(db, workoutId);
    await weightliftingRepository.deleteExercisesByWorkout(db, workoutId);
    await runningRepository.deleteRunSetsByWorkout(db, workoutId);
    await programRepository.deleteWorkoutById(db, workoutId);

    await workoutService.refreshWorkoutHierarchyCompletionByIds(db, {
      dayId: hierarchy?.day_id,
      microcycleId: hierarchy?.microcycle_id,
      mesocycleId: hierarchy?.mesocycle_id,
    });
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function getWorkoutOptions(db, programId) {
  return programRepository.getWorkoutOptions(db, programId);
}

export async function getMicrocycleMetadata(db, microcycleId) {
  return programRepository.getMicrocycleMetadata(db, microcycleId);
}

export async function getMesocycleMetadata(
  db,
  { mesocycleId, programId }
) {
  return programRepository.getMesocycleMetadata(db, {
    mesocycleId,
    programId,
  });
}

export async function getProgramMetadata(db, programId) {
  return programRepository.getProgramMetadata(db, programId);
}
