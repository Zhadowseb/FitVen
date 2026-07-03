import {
  buildHeartRateZones,
  DEFAULT_MAX_HEART_RATE,
} from "../../../../Utils/heartRateUtils";

export const FALLBACK_MAX_HEART_RATE = DEFAULT_MAX_HEART_RATE;
export const FALLBACK_HEART_RATE_ZONE_BANDS = buildHeartRateZones(
  FALLBACK_MAX_HEART_RATE
);

export function getHeartRateZoneThresholds(
  zoneBands = FALLBACK_HEART_RATE_ZONE_BANDS
) {
  return zoneBands.slice(0, -1).map((band) => band.max);
}

export function getHeartRateZoneColor(
  bpm,
  zoneBands = FALLBACK_HEART_RATE_ZONE_BANDS
) {
  const numericBpm = Number(bpm);

  if (!Number.isFinite(numericBpm)) {
    return zoneBands[0].color;
  }

  return (
    zoneBands.find((band) => numericBpm <= band.max)?.color ??
    zoneBands[zoneBands.length - 1].color
  );
}

export function buildTargetHeartRateHistory(
  sets = [],
  zoneBands = FALLBACK_HEART_RATE_ZONE_BANDS
) {
  let elapsedMinutes = 0;
  const history = [];
  const targetBpmByZone = zoneBands.reduce(
    (targets, band) => ({
      ...targets,
      [band.zone]: (band.min + band.max) / 2,
    }),
    {}
  );

  sets.forEach((set) => {
    const durationMinutes = Number(set?.time);
    const targetZone = Number(set?.heartrate);
    const safeDuration =
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : 0;

    if (targetZone >= 1 && targetZone <= 5 && safeDuration > 0) {
      const targetBpm = targetBpmByZone[targetZone];
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
