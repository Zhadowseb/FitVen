// Walks recorded with a watch, read from Health Connect and - when the person
// says yes - made into FitVen walks (Services/watchWalkService.js). The rules
// for which sessions are offered live here, without the phone, so they can be
// tested:
//
//   - only walking, and only a walk somebody started: a watch that "auto
//     detects workouts" writes a session for every stroll, and those are not
//     what the person called a walk;
//   - not a short one;
//   - never the same walk twice: not one that was imported before, not one the
//     person deleted afterwards, not one that came back from the cloud on a new
//     phone, and not the same walk written by two apps;
//   - never on top of a walk tracked in FitVen itself.

// Health Connect's ExerciseType.WALKING.
export const WALKING_EXERCISE_TYPE = 79;

// ExerciseSession's metadata.recordingMethod.
export const RECORDING_METHOD = Object.freeze({
  UNKNOWN: 0,
  ACTIVELY_RECORDED: 1,
  AUTOMATICALLY_RECORDED: 2,
  MANUAL_ENTRY: 3,
});

export const MIN_WALK_SECONDS = 5 * 60;

// Two starts this close are the same walk: a watch and a phone do not agree on
// the second, and a synced row has its start in whole seconds.
export const SAME_WALK_TOLERANCE_MS = 2 * 60 * 1000;

// How far back the sessions are looked for. A walk that has been offered and
// answered is remembered, so looking at the same days again asks nothing twice.
export const IMPORT_WINDOW_DAYS = 14;

/**
 * One Health Connect exercise session as { hcId, startMs, endMs, durationSeconds,
 * origin, recordingMethod }, or null when it is not a walk worth keeping.
 */
export function readWalkSession(session) {
  if (!session || session.exerciseType !== WALKING_EXERCISE_TYPE) {
    return null;
  }

  const startMs = Date.parse(session.startTime);
  const endMs = Date.parse(session.endTime);
  const hcId = session.metadata?.id;

  if (!hcId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  const recordingMethod = session.metadata?.recordingMethod ?? RECORDING_METHOD.UNKNOWN;

  if (
    recordingMethod === RECORDING_METHOD.AUTOMATICALLY_RECORDED ||
    recordingMethod === RECORDING_METHOD.MANUAL_ENTRY
  ) {
    return null;
  }

  const durationSeconds = Math.round((endMs - startMs) / 1000);

  if (durationSeconds < MIN_WALK_SECONDS) {
    return null;
  }

  return {
    hcId,
    startMs,
    endMs,
    durationSeconds,
    origin: session.metadata?.dataOrigin ?? null,
    recordingMethod,
  };
}

const overlaps = (left, right, paddingMs) =>
  left.startMs < right.endMs + paddingMs && left.endMs > right.startMs - paddingMs;

/**
 * Which of the sessions become walks. `existing` is every walk FitVen already
 * has a trace of - imported ones (also those deleted since), walks tracked in
 * the app, walks that came back from the cloud - as { hcId?, startMs, endMs }.
 * The oldest session comes first, and one that overlaps an earlier pick is
 * skipped: that is the same walk written by a watch and by a phone.
 */
export function pickWalksToImport({ sessions, existing = [] }) {
  const knownIds = new Set(existing.map((walk) => walk.hcId).filter(Boolean));
  const picked = [];

  const candidates = sessions
    .map(readWalkSession)
    .filter(Boolean)
    .sort((left, right) => left.startMs - right.startMs);

  for (const walk of candidates) {
    if (knownIds.has(walk.hcId)) {
      continue;
    }

    if (existing.some((other) => overlaps(walk, other, SAME_WALK_TOLERANCE_MS))) {
      continue;
    }

    if (picked.some((other) => overlaps(walk, other, 0))) {
      continue;
    }

    picked.push(walk);
  }

  return picked;
}

/**
 * The numbers a walk is made with. A walk the watch gave no distance for has
 * none - never an invented one - and its steps are the phone's count for the
 * same minutes.
 */
export function walkNumbers({ durationSeconds, distanceMeters, steps }) {
  return {
    movingSeconds: Math.max(0, Math.round(durationSeconds)),
    distanceMeters: Number.isFinite(distanceMeters) && distanceMeters > 0 ? distanceMeters : 0,
    steps: Number.isFinite(steps) && steps > 0 ? Math.round(steps) : null,
  };
}

/** The start of the days the sessions are read from. */
export function windowStartMs(now) {
  return now - IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
