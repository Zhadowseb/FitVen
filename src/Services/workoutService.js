import { weightliftingRepository, workoutRepository } from "../Repository";
import { guessSplitGroups } from "@utils/splitGuess";
import * as gymService from "./gymService";
import * as notificationService from "./notificationService";
import { withTransaction } from "./shared";
import { enqueueSync, startBackgroundSync } from "./syncScheduler";

let dirtyWorkoutHierarchyPushScheduled = false;
let dirtyWorkoutHierarchyPushNeedsRerun = false;

function pushDirtyWorkoutHierarchyInBackground(db) {
  if (dirtyWorkoutHierarchyPushScheduled) {
    dirtyWorkoutHierarchyPushNeedsRerun = true;
    return;
  }

  dirtyWorkoutHierarchyPushScheduled = true;
  startBackgroundSync(
    async () => {
      try {
        do {
          dirtyWorkoutHierarchyPushNeedsRerun = false;
          const programServiceModule = await import("./programService");
          await programServiceModule.pushDirtyStrengthHierarchyWithCloud(db);
        } while (dirtyWorkoutHierarchyPushNeedsRerun);
      } finally {
        dirtyWorkoutHierarchyPushScheduled = false;
      }
    },
    "Workout hierarchy cloud push failed:"
  );
}

async function createCompletedWorkoutPost(
  db,
  workoutId,
  { source = "automatic", note = null } = {}
) {
  return enqueueSync(async () => {
    const socialPostServiceModule = await import("./socialPostService");
    // A published summary uses local sets. Only its owning cloud workout must
    // exist; uploading every other workout makes unrelated FK errors block Post.
    let result =
      await socialPostServiceModule.createWorkoutSummaryPostForCompletedWorkout(
        db,
        { workoutId, source, note }
      );

    if (result?.skipped && result.reason === "missing_cloud_workout_id") {
      const programServiceModule = await import("./programService");
      await programServiceModule.prepareWorkoutForSummaryPost(db, workoutId);
      result =
        await socialPostServiceModule.createWorkoutSummaryPostForCompletedWorkout(
          db,
          { workoutId, source, note }
        );
    }

    return result;
  });
}

async function createCompletedWorkoutPostBestEffort(
  db,
  workoutId,
  options = {}
) {
  try {
    const result = await createCompletedWorkoutPost(db, workoutId, options);

    if (result?.skipped) {
      console.info(
        "Workout summary post skipped:",
        result.reason ?? "unknown"
      );
    }

    return result;
  } catch (error) {
    console.error("Workout summary social post failed:", error);
    return { skipped: true, reason: "error" };
  }
}

async function syncWorkoutTypeInstancesInBackground(db) {
  try {
    pushDirtyWorkoutHierarchyInBackground(db);
  } catch (error) {
    console.error("Failed to start workout type instance cloud sync:", error);
  }
}

export function notifyWorkoutStartedInBackground(
  db,
  { workoutId, startedAt } = {}
) {
  if (!workoutId) {
    return;
  }

  void (async () => {
    try {
      const workout =
        await workoutRepository.getWorkoutStartNotificationDetails(
          db,
          workoutId
        );
      const result = await notificationService.notifyWorkoutStarted({
        workout,
        startedAt,
      });

      if (result?.skipped) {
        console.info(
          "Workout start notification skipped:",
          result.reason ?? "unknown"
        );
      }
    } catch (error) {
      console.warn("Workout start notification failed:", error);
    }
  })();
}

export async function refreshWorkoutHierarchyCompletionByIds(
  db,
  { dayId, microcycleId, mesocycleId }
) {
  if (dayId) {
    await workoutRepository.updateDayDoneFromWorkouts(db, dayId);
  }

  if (microcycleId) {
    await workoutRepository.updateMicrocycleDoneFromWorkouts(db, microcycleId);
  }

  if (mesocycleId) {
    await workoutRepository.updateMesocycleDoneFromMicrocycles(db, mesocycleId);
  }
}

export async function refreshWorkoutHierarchyCompletion(db, workoutId) {
  const ids = await workoutRepository.getWorkoutHierarchyIds(db, workoutId);

  if (!ids) {
    return;
  }

  await refreshWorkoutHierarchyCompletionByIds(db, {
    dayId: ids.day_id,
    microcycleId: ids.microcycle_id,
    mesocycleId: ids.mesocycle_id,
  });
}

export async function getWorkoutPageMetadata(db, workoutId) {
  return workoutRepository.getWorkoutPageMetadata(db, workoutId);
}

export async function getWorkoutTimerState(db, workoutId) {
  return workoutRepository.getWorkoutTimerState(db, workoutId);
}

export async function updateWorkoutRunFocusType(
  db,
  { workoutId, runFocusType }
) {
  await workoutRepository.updateWorkoutRunFocusType(db, {
    workoutId,
    runFocusType,
  });
}

export async function getActiveWorkoutTimer(db) {
  return workoutRepository.getActiveWorkoutTimer(db);
}

export async function getStartableWorkout(db, { date }) {
  return workoutRepository.getStartableWorkout(db, { date });
}

export async function updateWorkoutLabel(db, { workoutId, label }) {
  await workoutRepository.updateWorkoutLabel(db, {
    workoutId,
    label,
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function persistWorkoutTimerState(
  db,
  { workoutId, timerStart, elapsedTime }
) {
  await workoutRepository.persistWorkoutTimerState(db, {
    workoutId,
    timerStart,
    elapsedTime,
  });

  syncWorkoutTypeInstancesInBackground(db);
}

export async function updateWorkoutElapsedTime(
  db,
  { workoutId, elapsedTime }
) {
  await workoutRepository.updateWorkoutElapsedTime(db, {
    workoutId,
    elapsedTime,
  });
}

export async function getWorkoutOriginalStartTime(db, workoutId) {
  return workoutRepository.getWorkoutOriginalStartTime(db, workoutId);
}

export async function setWorkoutOriginalStartTime(
  db,
  { workoutId, startTime }
) {
  await workoutRepository.setWorkoutOriginalStartTime(db, {
    workoutId,
    startTime,
  });

  syncWorkoutTypeInstancesInBackground(db);

  // The first start is when the phone is most likely to be inside the centre.
  // One position fix, matched against the centre list; the row is synced
  // again once it has an answer, because the sync above has already gone.
  void enqueueSync(() =>
    gymService.matchWorkoutToGym(db, workoutId, { requestPermission: true })
  )
    .then((result) => {
      if (result?.position) {
        syncWorkoutTypeInstancesInBackground(db);
      }
    })
    .catch((error) => {
      console.warn("Centre match at workout start failed:", error);
    });
}

export async function getWorkoutStartTimestamp(db, workoutId) {
  return workoutRepository.getWorkoutStartTimestamp(db, workoutId);
}

export async function setWorkoutStartTimestamp(db, { workoutId, startTs }) {
  await workoutRepository.setWorkoutStartTimestamp(db, {
    workoutId,
    startTs,
  });
}

export async function stopWorkoutStopwatch(
  db,
  { workoutId, durationSeconds }
) {
  await workoutRepository.stopWorkoutStopwatch(db, {
    workoutId,
    durationSeconds,
  });
}

export async function setWorkoutDone(db, { workoutId, done }) {
  await withTransaction(db, async () => {
    await workoutRepository.updateWorkoutDone(db, {
      workoutId,
      done,
    });

    await refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  await syncWorkoutSummaryPostForCompletionState(db, { workoutId, done });
}

// A user finishing the timer is an explicit workout-level completion. Keep it
// independent from the derived completion state of exercises and sets.
/**
 * `createPost: false` finishes the workout without publishing anything, for
 * screens that ask the user first. The cloud identity sync still runs, so a
 * later manual post can find the workout.
 */
export async function finishWorkout(
  db,
  { workoutId, elapsedTime, createPost = true }
) {
  await withTransaction(db, async () => {
    await workoutRepository.persistWorkoutTimerState(db, {
      workoutId,
      timerStart: null,
      elapsedTime,
    });

    await workoutRepository.updateWorkoutDone(db, {
      workoutId,
      done: true,
    });

    await refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  await syncWorkoutSummaryPostForCompletionState(db, {
    workoutId,
    done: true,
    createPost,
  });

  // Centre match (if the start did not get one) and the best set per exercise
  // to the centre leaderboard. Not awaited: a position fix can take seconds
  // and the finish screen must not wait for it. Never throws.
  void enqueueSync(() => gymService.finishWorkoutGymSyncBestEffort(db, workoutId))
    .finally(() => {
      syncWorkoutTypeInstancesInBackground(db);
    });
}

const WORKOUT_SUMMARY_REPOST_SKIP_MESSAGES = {
  signed_out: "You need to be signed in to repost a workout summary.",
  not_completed: "Finish the workout before reposting its summary.",
  no_sets_logged:
    "There is nothing to post yet - this workout has no completed sets.",
  unsupported_workout_type:
    "Workout summaries can only be posted for Resistance workouts right now.",
  missing_cloud_workout_id:
    "This workout has not synced to Supabase yet. Try again in a moment.",
  error: "Could not repost the workout summary.",
};

function getWorkoutSummaryRepostErrorMessage(result) {
  return (
    WORKOUT_SUMMARY_REPOST_SKIP_MESSAGES[result?.reason] ??
    "Could not repost the workout summary."
  );
}

export async function repostWorkoutSummaryPost(db, { workoutId, note = null }) {
  const result = await createCompletedWorkoutPost(db, workoutId, {
    source: "manual",
    note,
  });

  if (result?.skipped) {
    throw new Error(getWorkoutSummaryRepostErrorMessage(result));
  }

  return result;
}

export async function syncWorkoutSummaryPostForCompletionState(
  db,
  { workoutId, done, createPost = true }
) {
  if (done && createPost) {
    await createCompletedWorkoutPostBestEffort(db, workoutId);
  }
  // Completion must still sync when posting is skipped or fails, including
  // workout types without summaries. It must not gate the post attempt.
  syncWorkoutTypeInstancesInBackground(db);
}

export async function resetWorkoutState(db, workoutId) {
  await withTransaction(db, async () => {
    await workoutRepository.resetWorkoutStateFields(db, workoutId);
    await refreshWorkoutHierarchyCompletion(db, workoutId);
  });

  syncWorkoutTypeInstancesInBackground(db);
}

/* ------------------------------------------------------ home, at a glance -- */

// The split is read out of the last sixty days: far enough back that a holiday
// does not erase it, close enough that a split somebody has moved on from
// stops counting.
const SPLIT_GUESS_DAYS = 60;
const SPLIT_GUESS_WORKOUT_LIMIT = 200;

// The types that are strength training. The same set weightliftingService
// classifies by; a run has no exercises to compare.
const SPLIT_GUESS_WORKOUT_TYPES = [
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Legs",
];

function isoDateDaysAgo(days, now = Date.now()) {
  const date = new Date(now);

  date.setDate(date.getDate() - days);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function startOfLocalDay(isoDate) {
  const [year, month, day] = String(isoDate ?? "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day).getTime();
}

/**
 * Whole days since the last finished workout of any type, or null when there
 * has never been one.
 *
 * Calendar days, not elapsed milliseconds: a workout finished yesterday
 * evening is one day ago at nine this morning, not zero.
 */
export async function getDaysSinceLastWorkout(db, { now = Date.now() } = {}) {
  const lastDate = await weightliftingRepository.getLastCompletedWorkoutDate(db);
  const lastAt = startOfLocalDay(lastDate);

  if (lastAt === null) {
    return null;
  }

  const today = new Date(now);

  today.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((today.getTime() - lastAt) / 86400000));
}

/**
 * The split the person is actually running, as far as their history shows one.
 *
 * Empty when there is no recognisable split - Home then offers an empty
 * workout and leaves the row out rather than filling it with a guess.
 */
export async function getSplitGroups(db, { now = Date.now() } = {}) {
  const rows = await weightliftingRepository.getCompletedStrengthWorkoutsWithExercises(
    db,
    {
      sinceIsoDate: isoDateDaysAgo(SPLIT_GUESS_DAYS, now),
      workoutTypes: SPLIT_GUESS_WORKOUT_TYPES,
      limit: SPLIT_GUESS_WORKOUT_LIMIT,
    }
  );

  const workouts = rows
    .map((row) => {
      const at = startOfLocalDay(row?.performed_date_sort);

      if (at === null) {
        return null;
      }

      return {
        workoutId: row.workout_id,
        name: row.label ?? "",
        at,
        exerciseIds: String(row.exercise_names ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        exerciseCount: Number(row.exercise_count) || 0,
        setCount: Number(row.set_count) || 0,
      };
    })
    .filter(Boolean);

  return guessSplitGroups(workouts, { now });
}
