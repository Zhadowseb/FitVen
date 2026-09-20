// What a friend's tile says when the tile has to work it out from raw workout
// rows: which of live, done, planned or rest the person is in, how long a
// running workout has been going, and what the centre and the music are.
//
// This is the fallback path. getCirclePreview asks the cloud for the finished
// shape, and this is what runs when that request cannot be made - which is
// every client whose database has not had the 2.0 migrations yet, so it is
// what most people see until they have.
//
// It lives here rather than in socialService for one reason: socialService
// imports the Supabase client, which imports react-native, so nothing in it
// can be loaded by a test. These are pure functions over a row, the same as
// gymUtils and friendsActivityUtils, and scripts/test-gym-leaderboard.js
// drives them directly.
import { t } from "@localization";

import { normalizeLocalDateString } from "./dateUtils";
import { classifyMusicRow } from "./friendsActivityUtils";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "./timeUtils";

export function isCloudWorkoutLive(workout) {
  const timerStartSeconds = getCloudWorkoutTimerStartSeconds(workout);

  return (
    Number(workout?.done) !== 1 &&
    (Number(workout?.is_active) === 1 || timerStartSeconds !== null)
  );
}

export function normalizeCloudTimeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "00");

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

export function getCloudWorkoutTimerStartSeconds(workout) {
  const storedTimerStartSeconds = normalizeStoredTimestampSeconds(
    workout?.timer_start
  );

  if (storedTimerStartSeconds !== null) {
    return storedTimerStartSeconds;
  }

  const normalizedDate = normalizeLocalDateString(workout?.date);
  const normalizedTime = normalizeCloudTimeString(workout?.timer_start);

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  const [day, month, year] = normalizedDate.split(".").map(Number);
  const [hours, minutes, seconds] = normalizedTime.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  const timestampMs = date.getTime();

  return Number.isNaN(timestampMs) ? null : Math.trunc(timestampMs / 1000);
}

export function formatCloudWorkoutElapsedDetail(workout) {
  const storedElapsedSeconds = normalizeElapsedDurationSeconds(
    workout?.elapsed_time,
    0
  );
  const timerStartSeconds = getCloudWorkoutTimerStartSeconds(workout);
  const runningElapsedSeconds =
    timerStartSeconds !== null
      ? Math.max(0, Math.trunc(Date.now() / 1000) - timerStartSeconds)
      : 0;
  const totalElapsedSeconds = storedElapsedSeconds + runningElapsedSeconds;
  const totalElapsedMinutes = Math.max(1, Math.floor(totalElapsedSeconds / 60));

  return t("friends.status.minutesIn", { count: totalElapsedMinutes });
}

export function createRestActivityPreview() {
  return {
    activityState: "rest",
    activityDetail: t("friends.status.restDay"),
    workoutType: null,
    workoutLabel: null,
    workoutId: null,
    activityAt: null,
    gym: null,
    music: null,
    lastWorkoutAt: null,
    nextWorkoutAt: null,
  };
}

export function mapCloudWorkoutGym(workout) {
  const gym = Array.isArray(workout?.gym) ? workout.gym[0] : workout?.gym;
  const gymId = Number(gym?.id ?? workout?.gym_id);

  if (!Number.isFinite(gymId) || gymId <= 0) {
    return null;
  }

  return {
    id: gymId,
    shortName: gym?.short_name ?? null,
    isHomeGym: false,
  };
}

export function mapCloudWorkoutMusic(workout, activityState) {
  const rows = Array.isArray(workout?.workout_music)
    ? workout.workout_music
    : workout?.workout_music
      ? [workout.workout_music]
      : [];
  const newest = [...rows].sort(
    (left, right) =>
      new Date(right?.played_at ?? 0).getTime() -
      new Date(left?.played_at ?? 0).getTime()
  )[0];

  return classifyMusicRow(newest, { activityState });
}

export function getCloudWorkoutActivityAt(workout) {
  return workout?.last_updated ?? null;
}

export function getCloudWorkoutDisplayLabel(workout) {
  const workoutType = workout?.workout_type?.trim?.() ?? workout?.workout_type;
  const label = workout?.label?.trim?.() ?? workout?.label;
  const displayName =
    workout?.workout_catalog?.display_name?.trim?.() ??
    workout?.workout_catalog?.display_name;

  if (label && label !== workoutType) {
    return label;
  }

  return displayName || label || workoutType || null;
}

export function buildCloudActivityPreview(workouts) {
  if (!workouts.length) {
    return createRestActivityPreview();
  }

  const liveWorkout = workouts.find((workout) => isCloudWorkoutLive(workout));

  if (liveWorkout) {
    return {
      activityState: "live",
      activityDetail: formatCloudWorkoutElapsedDetail(liveWorkout),
      workoutType: liveWorkout.workout_type ?? null,
      workoutLabel: getCloudWorkoutDisplayLabel(liveWorkout),
      workoutId: liveWorkout.id ?? null,
      activityAt: getCloudWorkoutActivityAt(liveWorkout),
      gym: mapCloudWorkoutGym(liveWorkout),
      music: mapCloudWorkoutMusic(liveWorkout, "live"),
    };
  }

  const plannedWorkouts = workouts.filter(
    (workout) => Number(workout.done) !== 1
  );

  if (plannedWorkouts.length > 0) {
    const nextPlannedWorkout = plannedWorkouts[0];

    return {
      activityState: "planned",
      activityDetail:
        plannedWorkouts.length > 1
          ? t("friends.status.plannedCount", { count: plannedWorkouts.length })
          : t("friends.status.planned"),
      workoutType: nextPlannedWorkout.workout_type ?? null,
      workoutLabel: getCloudWorkoutDisplayLabel(nextPlannedWorkout),
      workoutId: nextPlannedWorkout.id ?? null,
      activityAt: getCloudWorkoutActivityAt(nextPlannedWorkout),
      // A planned workout normally has no position yet; the tile falls back
      // to the person's own centre, which getCirclePreview fills in.
      gym: mapCloudWorkoutGym(nextPlannedWorkout),
      music: null,
    };
  }

  const completedWorkout = workouts[workouts.length - 1];

  return {
    activityState: "done",
    activityDetail:
      workouts.length > 1
        ? t("friends.status.doneCount", { count: workouts.length })
        : t("friends.status.doneToday"),
    workoutType: completedWorkout?.workout_type ?? null,
    workoutLabel: getCloudWorkoutDisplayLabel(completedWorkout),
    workoutId: completedWorkout?.id ?? null,
    activityAt: getCloudWorkoutActivityAt(completedWorkout),
    gym: mapCloudWorkoutGym(completedWorkout),
    music: mapCloudWorkoutMusic(completedWorkout, "done"),
  };
}
