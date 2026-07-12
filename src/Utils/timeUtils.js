const MAX_POSTGRES_INTEGER = 2147483647;
const LIKELY_MILLISECONDS_THRESHOLD = 100000000000;
const MAX_REASONABLE_WORKOUT_DURATION_SECONDS = 48 * 60 * 60;

export const normalizeStoredTimestampSeconds = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const truncatedValue = Math.trunc(numericValue);

  if (truncatedValue <= 0) {
    return null;
  }

  if (truncatedValue >= LIKELY_MILLISECONDS_THRESHOLD) {
    return Math.trunc(truncatedValue / 1000);
  }

  if (truncatedValue > MAX_POSTGRES_INTEGER) {
    return null;
  }

  return truncatedValue;
};

export const getCurrentStoredTimestampSeconds = () =>
  Math.trunc(Date.now() / 1000);

export const storedTimestampSecondsToMilliseconds = (value) => {
  const normalizedValue = normalizeStoredTimestampSeconds(value);
  return normalizedValue === null ? null : normalizedValue * 1000;
};

export const normalizeElapsedDurationSeconds = (value, fallbackValue = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallbackValue;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  const truncatedValue = Math.trunc(numericValue);

  if (truncatedValue < 0) {
    return fallbackValue;
  }

  if (
    truncatedValue > MAX_REASONABLE_WORKOUT_DURATION_SECONDS &&
    Math.trunc(truncatedValue / 1000) < truncatedValue
  ) {
    const durationFromMilliseconds = Math.trunc(truncatedValue / 1000);

    if (
      durationFromMilliseconds >= 0 &&
      durationFromMilliseconds <= MAX_REASONABLE_WORKOUT_DURATION_SECONDS
    ) {
      return durationFromMilliseconds;
    }

    return fallbackValue;
  }

  if (truncatedValue > MAX_POSTGRES_INTEGER) {
    return fallbackValue;
  }

  return truncatedValue;
};

export const formatTime = (totalSeconds) => {
  const safeTotalSeconds = normalizeElapsedDurationSeconds(totalSeconds, 0);
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;

  const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  if (hours > 0) {
    return `${hours}:${paddedMinutes}.${paddedSeconds}`;
  }

  return `${minutes}.${paddedSeconds}`;
};

// Redesign format: "mm:ss" with zero-padded minutes, "h:mm:ss" past an hour.
export const formatElapsedTime = (totalSeconds) => {
  const safeTotalSeconds = normalizeElapsedDurationSeconds(totalSeconds, 0);
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;

  const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
};

// Rest countdowns read best without a leading zero: "2:30", "0:45".
export const formatCountdownTime = (totalSeconds) => {
  const safeTotalSeconds = normalizeElapsedDurationSeconds(totalSeconds, 0);
  const minutes = Math.floor(safeTotalSeconds / 60);
  const seconds = safeTotalSeconds % 60;
  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

  return `${minutes}:${paddedSeconds}`;
};

export const formatClockTime = (timestamp) => {
  const timestampMs = storedTimestampSecondsToMilliseconds(timestamp);

  if (!timestampMs) return "";

  const date = new Date(timestampMs);
  const pad = (num) => String(num).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatWorkoutStart = (timestamp) => {
  const timestampMs = storedTimestampSecondsToMilliseconds(timestamp);

  if (!timestampMs) return "";

  const date = new Date(timestampMs);

  const pad = (num) => String(num).padStart(2, "0");

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // måneder starter fra 0
  const year = date.getFullYear();

  return `${hours}:${minutes} - ${day}-${month}-${year}`;
};
