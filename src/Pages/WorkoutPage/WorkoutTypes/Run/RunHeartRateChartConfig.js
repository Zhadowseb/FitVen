export const TEST_MAX_HEART_RATE = 220;

export const HEART_RATE_ZONE_BANDS = [
  { zone: 1, min: 0, max: 143, color: "#9CA3AF" },
  { zone: 2, min: 143, max: 178, color: "#22C7F2" },
  { zone: 3, min: 178, max: 196, color: "#10B981" },
  { zone: 4, min: 196, max: 213, color: "#F7742E" },
  { zone: 5, min: 213, max: 220, color: "#EF4444" },
];

export const HEART_RATE_ZONE_THRESHOLDS = HEART_RATE_ZONE_BANDS.slice(0, -1).map(
  (band) => band.max
);

export function getHeartRateZoneColor(bpm) {
  const numericBpm = Number(bpm);

  if (!Number.isFinite(numericBpm)) {
    return HEART_RATE_ZONE_BANDS[0].color;
  }

  return (
    HEART_RATE_ZONE_BANDS.find((band) => numericBpm <= band.max)?.color ??
    HEART_RATE_ZONE_BANDS[HEART_RATE_ZONE_BANDS.length - 1].color
  );
}

const HEART_RATE_ZONE_TARGET_BPM = HEART_RATE_ZONE_BANDS.reduce(
  (targets, band) => ({
    ...targets,
    [band.zone]: (band.min + band.max) / 2,
  }),
  {}
);

export function buildTargetHeartRateHistory(sets = []) {
  let elapsedMinutes = 0;
  const history = [];

  sets.forEach((set) => {
    const durationMinutes = Number(set?.time);
    const targetZone = Number(set?.heartrate);
    const safeDuration =
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : 0;

    if (targetZone >= 1 && targetZone <= 5 && safeDuration > 0) {
      const targetBpm = HEART_RATE_ZONE_TARGET_BPM[targetZone];
      history.push({ x: elapsedMinutes, y: targetBpm, zone: targetZone });
      history.push({
        x: elapsedMinutes + safeDuration,
        y: targetBpm,
        zone: targetZone,
      });
    }

    elapsedMinutes += safeDuration;
  });

  return history;
}
