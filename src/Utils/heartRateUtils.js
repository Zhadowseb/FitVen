export const MIN_MAX_HEART_RATE = 60;
export const MAX_MAX_HEART_RATE = 250;
export const DEFAULT_MAX_HEART_RATE = 220;
export const MAX_HEART_RATE_SOURCE_AUTO = "auto";
export const MAX_HEART_RATE_SOURCES = [
  MAX_HEART_RATE_SOURCE_AUTO,
  "manual",
  "calculated",
  "measured",
];

export const HEART_RATE_ZONE_COLORS = [
  "#9CA3AF",
  "#22C7F2",
  "#10B981",
  "#F7742E",
  "#EF4444",
];

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

export function normalizeMaxHeartRateSource(value) {
  const normalizedValue =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  return MAX_HEART_RATE_SOURCES.includes(normalizedValue)
    ? normalizedValue
    : MAX_HEART_RATE_SOURCE_AUTO;
}

export function resolveMaxHeartRate({
  age,
  manualMaxHeartRate,
  measuredMaxHeartRate,
  preferredSource = MAX_HEART_RATE_SOURCE_AUTO,
}) {
  const manual = normalizeMaxHeartRate(manualMaxHeartRate);
  const numericAge =
    age === null || age === undefined || age === "" ? null : Number(age);
  const calculated =
    numericAge !== null && Number.isInteger(numericAge) && numericAge >= 0
      ? normalizeMaxHeartRate(220 - numericAge)
      : null;
  const measured = normalizeMaxHeartRate(measuredMaxHeartRate);
  const normalizedPreferredSource =
    normalizeMaxHeartRateSource(preferredSource);
  const valuesBySource = {
    manual,
    calculated,
    measured,
  };
  const automaticPriority = ["manual", "calculated", "measured"];
  const sourcePriority =
    normalizedPreferredSource === MAX_HEART_RATE_SOURCE_AUTO
      ? automaticPriority
      : [
          normalizedPreferredSource,
          ...automaticPriority.filter(
            (source) => source !== normalizedPreferredSource
          ),
        ];
  const resolvedSource = sourcePriority.find(
    (source) => valuesBySource[source] !== null
  );

  return {
    value: resolvedSource ? valuesBySource[resolvedSource] : null,
    source: resolvedSource ?? null,
    preferredSource: normalizedPreferredSource,
  };
}

export function buildHeartRateZones(maxHeartRate) {
  const normalizedMaxHeartRate =
    normalizeMaxHeartRate(maxHeartRate) ?? DEFAULT_MAX_HEART_RATE;
  const upperBounds = [
    Math.floor(normalizedMaxHeartRate * 0.65),
    Math.floor(normalizedMaxHeartRate * 0.81),
    Math.floor(normalizedMaxHeartRate * 0.89),
    Math.floor(normalizedMaxHeartRate * 0.97),
    normalizedMaxHeartRate,
  ];

  return upperBounds.map((max, index) => ({
    zone: index + 1,
    min: index === 0 ? 0 : upperBounds[index - 1] + 1,
    max,
    color: HEART_RATE_ZONE_COLORS[index],
  }));
}
