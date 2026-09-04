const toPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const getRunSetPlannedDurationSeconds = (runSet) =>
  Math.round(toPositiveNumber(runSet?.time) * 60);

export const getRunSetDistanceTargetKm = (runSet) =>
  toPositiveNumber(runSet?.distance);

export const getRunSetCompletionMode = (runSet) => {
  const completionTarget = String(runSet?.completion_target ?? "")
    .trim()
    .toLowerCase();

  if (
    completionTarget === "time" &&
    getRunSetPlannedDurationSeconds(runSet) > 0
  ) {
    return "time";
  }

  if (
    completionTarget === "distance" &&
    getRunSetDistanceTargetKm(runSet) > 0
  ) {
    return "distance";
  }

  if (getRunSetPlannedDurationSeconds(runSet) > 0) {
    return "time";
  }

  if (getRunSetDistanceTargetKm(runSet) > 0) {
    return "distance";
  }

  return "manual";
};

export const getRunSetRecordedDurationSeconds = (runSet) => {
  const recordedDuration = Number(runSet?.actual_duration_seconds);

  if (Number.isFinite(recordedDuration) && recordedDuration > 0) {
    return Math.max(0, Math.round(recordedDuration));
  }

  return getRunSetPlannedDurationSeconds(runSet);
};

export const getDistanceIntervalProgress = ({
  targetDistanceKm,
  completedDistanceKm,
} = {}) => {
  const targetKm = toPositiveNumber(targetDistanceKm);
  const completedKm = Math.max(0, Number(completedDistanceKm) || 0);
  const remainingKm = Math.max(0, targetKm - completedKm);

  return {
    targetKm,
    completedKm,
    remainingKm,
    isComplete: targetKm > 0 && completedKm >= targetKm,
  };
};

export const getActualPaceMinutesPerKm = ({
  durationSeconds,
  distanceKm,
} = {}) => {
  const safeDurationSeconds = Number(durationSeconds);
  const safeDistanceKm = Number(distanceKm);

  if (
    !Number.isFinite(safeDurationSeconds) ||
    safeDurationSeconds <= 0 ||
    !Number.isFinite(safeDistanceKm) ||
    safeDistanceKm <= 0
  ) {
    return null;
  }

  return safeDurationSeconds / 60 / safeDistanceKm;
};
