import { Colors } from "../Resources/GlobalStyling/colors";

// The five step zones, in one place: the Home card, the Steps page, the
// Statistics section and the Knowledge articles all read their names, ranges
// and colours from here, so they cannot drift apart.
//
// The colours are fixed zone colours (Colors[scheme].stepZones), never accent
// colours, and a zone is never told by its colour alone - it has a name.
//
// "Inactive" is the name of the lowest zone, not "Resting" or "Unhealthy".

export const STEP_ZONES = Object.freeze([
  { id: "inactive", labelKey: "steps.zones.inactive", min: 0, max: 1999 },
  { id: "moving", labelKey: "steps.zones.moving", min: 2000, max: 3999 },
  { id: "active", labelKey: "steps.zones.active", min: 4000, max: 6999 },
  { id: "sweetSpot", labelKey: "steps.zones.sweetSpot", min: 7000, max: 9999 },
  { id: "bonus", labelKey: "steps.zones.bonus", min: 10000, max: null },
]);

// The zones somebody can aim for. The default is the sweet spot.
export const TARGET_ZONE_IDS = Object.freeze(["active", "sweetSpot", "bonus"]);
export const DEFAULT_TARGET_ZONE_ID = "sweetSpot";

// A minute of finished strength training counts as this many steps (Tæl Skridt,
// Dansk Firmaidrætsforbund, hard strength training). It is computed, never
// stored, so changing it recomputes history.
export const TRAINING_STEPS_PER_MINUTE = 115;
const TRAINING_ROUNDING = 25;

// The bar on Home is drawn on this scale; the last zone is cut off at it.
export const STEP_BAR_MAX = 12000;

const zoneIndexOf = (steps) => {
  const value = Number(steps);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  let index = 0;

  STEP_ZONES.forEach((zone, position) => {
    if (value >= zone.min) {
      index = position;
    }
  });

  return index;
};

/**
 * The zone a day's steps are in, as { id, labelKey, min, max, color }. The
 * colour follows the theme it is asked for (dark by default).
 */
export function getStepZone(steps, theme = Colors.dark) {
  const zone = STEP_ZONES[zoneIndexOf(steps)];

  return { ...zone, color: theme?.stepZones?.[zone.id] ?? Colors.dark.stepZones[zone.id] };
}

export function getZoneById(id) {
  return STEP_ZONES.find((zone) => zone.id === id) ?? STEP_ZONES[3];
}

/** The number of steps a target zone asks for: where that zone begins. */
export function getTargetSteps(zoneId) {
  const zone = getZoneById(TARGET_ZONE_IDS.includes(zoneId) ? zoneId : DEFAULT_TARGET_ZONE_ID);

  return zone.min;
}

export function normalizeTargetZoneId(value) {
  return TARGET_ZONE_IDS.includes(value) ? value : DEFAULT_TARGET_ZONE_ID;
}

/**
 * The steps a finished strength workout counts as: 115 a minute, to the
 * nearest 25 (30 min is 3,450; 45 min is 5,175). A workout with no time, or no
 * valid time, counts as nothing.
 */
export function trainingStepsForSeconds(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const steps = (value / 60) * TRAINING_STEPS_PER_MINUTE;

  return Math.round(steps / TRAINING_ROUNDING) * TRAINING_ROUNDING;
}

/**
 * The five segments of the bar on Home, on a 0-12,000 scale. Each segment's
 * width follows its zone's range, and fills up to the day's active steps in its
 * own zone's colour. `training` is the stretch the training added (from the
 * walked steps to the active ones) as a 0-1 share of each segment it crosses.
 */
export function getZoneBarSegments(walked, active) {
  const walkedSteps = Math.max(0, Number(walked) || 0);
  const activeSteps = Math.max(walkedSteps, Number(active) || 0);

  return STEP_ZONES.map((zone) => {
    const end = zone.max === null ? STEP_BAR_MAX : zone.max + 1;
    const span = end - zone.min;
    const share = (steps) => Math.min(1, Math.max(0, (steps - zone.min) / span));

    return {
      id: zone.id,
      widthShare: span / STEP_BAR_MAX,
      fill: share(activeSteps),
      trainingFrom: share(walkedSteps),
      trainingTo: share(activeSteps),
    };
  });
}

// The labels under the bar: where each of the first four segments ends.
export const STEP_BAR_TICKS = Object.freeze([
  { label: "2k", segment: 0 },
  { label: "4k", segment: 1 },
  { label: "7k", segment: 2 },
  { label: "10k", segment: 3 },
]);
