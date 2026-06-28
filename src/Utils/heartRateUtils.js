export const MIN_MAX_HEART_RATE = 60;
export const MAX_MAX_HEART_RATE = 250;

export function normalizeMaxHeartRate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (
    !Number.isInteger(numericValue) ||
    numericValue < MIN_MAX_HEART_RATE ||
    numericValue > MAX_MAX_HEART_RATE
  ) {
    return null;
  }

  return numericValue;
}

export function resolveMaxHeartRate({
  age,
  manualMaxHeartRate,
  measuredMaxHeartRate,
}) {
  const measured = normalizeMaxHeartRate(measuredMaxHeartRate);

  if (measured !== null) {
    return {
      value: measured,
      source: "measured",
    };
  }

  const manual = normalizeMaxHeartRate(manualMaxHeartRate);

  if (manual !== null) {
    return {
      value: manual,
      source: "manual",
    };
  }

  const numericAge =
    age === null || age === undefined || age === "" ? null : Number(age);
  const calculated =
    numericAge !== null && Number.isInteger(numericAge) && numericAge >= 0
      ? normalizeMaxHeartRate(220 - numericAge)
      : null;

  return {
    value: calculated,
    source: "calculated",
  };
}
