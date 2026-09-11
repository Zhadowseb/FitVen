// Reasonableness limits for the numbers a user types into a set.
//
// Format validation already existed and is good: the fields take a numeric
// keyboard and reject text. Nothing checked whether the number made sense, so
// a slipped keypress - 999999 instead of 99 - went straight through to the
// personal records, the Brzycki estimate, the weekly volume and every chart
// built on them. One typo permanently rewrote the user's history.
//
// These are ceilings, not opinions about training. The heaviest lifts ever
// performed by a human are around 500 kg, so 1000 kg cannot be reached by
// anybody and can only be a typo. Reps are capped well above any real set for
// the same reason.
//
// Clamping rather than rejecting is deliberate: the value the user sees after
// committing is the value that was stored, so a correction is visible
// immediately instead of failing silently or blocking the field.

export const MIN_SET_WEIGHT = 0;
export const MAX_SET_WEIGHT = 1000;
export const MIN_SET_REPS = 0;
export const MAX_SET_REPS = 200;
export const MIN_SET_RPE = 0;
export const MAX_SET_RPE = 10;
export const MIN_SET_RM_PERCENTAGE = 0;
export const MAX_SET_RM_PERCENTAGE = 200;
export const MIN_SET_PAUSE_SECONDS = 0;
export const MAX_SET_PAUSE_SECONDS = 3600;

const SET_FIELD_LIMITS = {
  weight: { min: MIN_SET_WEIGHT, max: MAX_SET_WEIGHT, decimals: 1 },
  reps: { min: MIN_SET_REPS, max: MAX_SET_REPS, decimals: 0 },
  rpe: { min: MIN_SET_RPE, max: MAX_SET_RPE, decimals: 1 },
  rm_percentage: {
    min: MIN_SET_RM_PERCENTAGE,
    max: MAX_SET_RM_PERCENTAGE,
    decimals: 0,
  },
  pause: {
    min: MIN_SET_PAUSE_SECONDS,
    max: MAX_SET_PAUSE_SECONDS,
    decimals: 0,
  },
};

// The weight keyboard offers both "," and "." and a leading "-". A comma is a
// decimal separator here, and a minus sign on a weight or a rep count is not a
// value - it is a stray keypress, so it is dropped rather than clamped to zero
// through a negative number.
export function parseSetNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clampSetValue(field, value) {
  const limits = SET_FIELD_LIMITS[field];
  const parsed = parseSetNumber(value);

  if (parsed === null) {
    return null;
  }

  if (!limits) {
    return parsed;
  }

  const bounded = Math.min(Math.max(parsed, limits.min), limits.max);
  const factor = 10 ** limits.decimals;

  return Math.round(bounded * factor) / factor;
}

// True when the value the user typed is not the value that will be stored, so
// a caller can show the correction rather than let the number change silently.
export function isSetValueOutOfRange(field, value) {
  const parsed = parseSetNumber(value);

  if (parsed === null) {
    return false;
  }

  return clampSetValue(field, value) !== parsed;
}

export function isClampedSetField(field) {
  return Object.prototype.hasOwnProperty.call(SET_FIELD_LIMITS, field);
}
