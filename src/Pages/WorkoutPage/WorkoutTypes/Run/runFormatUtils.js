// Pace, clock and distance formatting for the run screen.
//
// These sat in the middle of Run.js between a component and a constant, which
// is how they ended up swept into the wrong file when the screen was first
// split. Pure, and covered by scripts/test-run-display-utils.js.
import { normalizeElapsedDurationSeconds } from "@utils/timeUtils";

export const parsePaceToMinutes = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(",", ".")
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, "")
    .replace(/\s+/g, "");

  const splitMatch = normalized.match(/^(\d+)[\:'](\d{1,2})$/);

  if (splitMatch) {
    const minutes = Number(splitMatch[1]);
    const seconds = Number(splitMatch[2]);

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes + seconds / 60;
    }
  }

  const numericValue = Number(normalized.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const parsePositiveRunValue = (value) => {
  const numericValue = Number(String(value ?? "").trim().replace(",", "."));

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
};

export const formatPaceDisplay = (paceMinutes) => {
  if (!Number.isFinite(paceMinutes) || paceMinutes <= 0) {
    return "--'--''";
  }

  const totalSeconds = Math.round(paceMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}'${String(seconds).padStart(2, "0")}`;
};

export const formatPaceAxisLabel = (paceMinutes) => {
  const totalSeconds = Math.max(0, Math.round(Number(paceMinutes) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const formatSignedPaceDelta = (seconds) => {
  const numericSeconds = Number(seconds);

  if (!Number.isFinite(numericSeconds)) {
    return "--";
  }

  const roundedSeconds = Math.round(numericSeconds);
  const sign = roundedSeconds > 0 ? "+" : roundedSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(roundedSeconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;

  return `${sign}${String(minutes).padStart(2, "0")}'${String(
    remainingSeconds
  ).padStart(2, "0")}"`;
};

export const formatRunClock = (totalSeconds) => {
  const safeTotalSeconds = normalizeElapsedDurationSeconds(totalSeconds, 0);
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
};

export const formatRunDistance = (distanceKm) => {
  const safeDistance = Number(distanceKm);

  if (!Number.isFinite(safeDistance) || safeDistance <= 0) {
    return "0.00";
  }

  return safeDistance.toFixed(2);
};

export const getRunTrackingStartMessage = (error, activityLabel = "run") => {
  const message = String(error?.message ?? "");

  if (message.includes("Precise location permission")) {
    return `FitVen needs Precise/Fine location permission to track ${activityLabel} distance accurately. Enable precise location for FitVen and try again.`;
  }

  if (message.includes("Background location permission")) {
    return "FitVen needs background location permission so distance continues tracking while the app is not in front.";
  }

  return "Check that location is allowed and turned on, then try again.";
};
