import { AppState } from "react-native";

import {
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../Utils/timeUtils";
import {
  WALK_TRACKING,
  cadenceStepsPerMinute,
  createWalkState,
  evaluateAutoPause,
  foldWalkPoint,
  isUsableWalkFix,
  replayWalkPoints,
  trimStepSamples,
} from "../Utils/walkTracking";
import * as locationService from "./locationService";
import * as stepCounterService from "./stepCounterService";
import * as walkService from "./walkService";
import * as workoutService from "./workoutService";

// The one walk that is being tracked, kept outside the screen. The screen is a
// view of it: leaving the walk screen for another tab, or the screen being
// rebuilt, does not stop the position or the steps - only pausing, finishing,
// deleting or the app being closed does.
//
// With the screen off it goes on: the position comes from the walk's location
// task (an Android foreground service with a notification, iOS background
// location), started here when the walk runs and stopped when it pauses or
// ends. If that task cannot start, the position is only watched while the app
// is in front, and the app going to the background detaches the sensors as it
// did before the service existed (`backgroundTracking`).
//
// It owns the walk's clock too (the same `Workout_Type_Instance` timer fields
// a strength workout uses, so the square in the bottom navigation and the
// restore after a kill keep working), because pausing and resuming are what
// start and stop the sensors.
//
//   idle ──start──▶ running ◀──resume── paused
//                     │  ▲                ▲
//                     │  └─ step/move ─ autoPaused
//                     └── pause / quiet 10 s ──┘
//   running | autoPaused | paused ──finish──▶ done
//
// `autoPaused` exists only in memory: the clock is banked exactly as for a
// pause, and a walk that is reopened after the app was closed starts as
// `paused`.

const SAVE_EVERY_MS = 15000;

let db = null;
let session = null;
let snapshot = null;
let appStateSubscription = null;
let tickInterval = null;
let saveInterval = null;
let writeChain = Promise.resolve();
const listeners = new Set();

/* --------------------------------------------------------------- publish -- */

function buildSnapshot() {
  if (!session) {
    return null;
  }

  return {
    workoutId: session.workoutId,
    status: session.status,
    originalStart: session.originalStart,
    timerStart: session.timerStart,
    elapsed: session.elapsed,
    distanceMeters: session.walk.distanceMeters,
    walk: session.walk,
    route: session.route,
    fix: session.fix,
    steps: session.stepsAvailable ? session.steps : null,
    stepSamples: session.stepSamples,
    stepsAvailable: session.stepsAvailable,
    location: session.location,
    autoPauseEnabled: session.autoPauseEnabled,
    savedTotals: session.savedTotals,
  };
}

function emit() {
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

// The screen is not looking while the app is behind it, so a position or a step
// there is kept and not announced; the app coming back announces it all.
function emitLive() {
  if (!session?.inBackground) {
    emit();
  }
}

export function subscribeWalkTracker(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** What is being tracked, or null when it is another workout (or none). */
export function getWalkSnapshot(workoutId) {
  return snapshot && Number(snapshot.workoutId) === Number(workoutId)
    ? snapshot
    : null;
}

/* ----------------------------------------------------------------- writes -- */

// Positions, timer rows and the progress snapshot all go through one chain, so
// they land in the order they happened.
function enqueueWrite(task) {
  writeChain = writeChain
    .then(task)
    .catch((error) => {
      console.warn("A walk write failed:", error);
    });

  return writeChain;
}

function currentElapsedSeconds(now = getCurrentStoredTimestampSeconds()) {
  if (!session) {
    return 0;
  }

  const running =
    session.timerStart === null ? 0 : Math.max(0, now - session.timerStart);

  return normalizeElapsedDurationSeconds(session.elapsed + running, 0);
}

function persistTimer() {
  const { workoutId, timerStart, elapsed } = session;

  return enqueueWrite(() =>
    workoutService.persistWorkoutTimerState(db, {
      workoutId,
      timerStart,
      elapsedTime: elapsed,
    })
  );
}

function saveProgress() {
  if (!session || session.status === "done" || session.status === "idle") {
    return Promise.resolve();
  }

  const { workoutId, steps } = session;
  const distanceMeters = session.walk.distanceMeters;
  const movingSeconds = currentElapsedSeconds();

  session.lastSavedAtMs = Date.now();

  return enqueueWrite(() =>
    walkService.saveWalkProgress(db, {
      workoutId,
      distanceMeters,
      movingSeconds,
      steps: session.stepsAvailable ? steps : null,
    })
  );
}

/* ---------------------------------------------------------------- sensors -- */

// Resolves once the position is really stopped - for the walk's location task
// that is the Android service and its notification going away - so a pause
// that is followed by a quick resume starts from nothing.
function detachSensors() {
  const locationSubscription = session?.locationSubscription;
  const stepSubscription = session?.stepSubscription;

  if (session) {
    // The steps counted by a watcher that is gone are in the total already;
    // the next watcher counts from zero again.
    session.stepBase = session.steps;
    session.locationSubscription = null;
    session.stepSubscription = null;
    session.inBackground = false;
  }

  stopTimers();
  stepSubscription?.remove();

  return Promise.resolve(locationSubscription?.remove()).catch((error) => {
    console.warn("Unable to stop the position of the walk:", error);
  });
}

// Whether the position keeps coming with the screen off: only when the walk's
// location task is what delivers it.
function backgroundTracking(target = session) {
  return Boolean(target?.locationSubscription?.background);
}

// A step counter that is delivering right now. Behind the screen the phone's
// counter is stopped by its library (and catches up to the total when the app
// is back), so it is no sign of life there.
function stepsLive(target = session) {
  return Boolean(target?.stepSubscription) && !target.inBackground;
}

function stopTimers() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
}

function startTimers() {
  stopTimers();
  tickInterval = setInterval(tick, 1000);
  saveInterval = setInterval(() => {
    void saveProgress();
  }, SAVE_EVERY_MS);
}

// One attach at a time: Start, "Allow location" and the app coming back to the
// front can all ask for it, and two that overlap would each start a position
// watcher while only one is kept - the other would run on after the walk ended.
function attachSensors() {
  if (!session) {
    return Promise.resolve();
  }

  const sessionRef = session;

  sessionRef.attachChain = (sessionRef.attachChain ?? Promise.resolve()).then(() =>
    attachOnce(sessionRef)
  );

  return sessionRef.attachChain;
}

async function attachOnce(sessionRef) {
  if (
    session !== sessionRef ||
    sessionRef.status === "done" ||
    sessionRef.status === "paused" ||
    sessionRef.status === "idle"
  ) {
    return;
  }

  if (!sessionRef.stepSubscription && sessionRef.stepsAvailable) {
    sessionRef.stepSubscription = stepCounterService.watchSteps((count) => {
      if (session === sessionRef) {
        onSteps(count);
      }
    });

    if (!sessionRef.stepSubscription) {
      sessionRef.stepsAvailable = false;
    }
  }

  if (!sessionRef.locationSubscription && sessionRef.location === "granted") {
    try {
      const subscription = await locationService.startWalkTracking((fix) => {
        if (session === sessionRef) {
          onFix(fix);
        }
      });

      // The walk was paused, finished or left while the watcher was starting.
      if (session !== sessionRef || sessionRef.status === "paused" || sessionRef.status === "done") {
        await subscription.remove();
      } else {
        sessionRef.locationSubscription = subscription;
      }
    } catch (error) {
      console.warn("Unable to watch the position for the walk:", error);
    }
  }

  if (session === sessionRef && sessionRef.status !== "paused" && sessionRef.status !== "done") {
    startTimers();
  }

  emit();
}

function onSteps(count) {
  if (!session || session.status === "paused" || session.status === "done") {
    return;
  }

  const now = Date.now();

  // The first step after standing still is what ends an auto pause; it is the
  // first step of the stretch that follows, so it counts.
  session.lastStepAtMs = now;

  if (session.status === "autoPaused") {
    resumeFromAuto();
  }

  if (session.status !== "running") {
    return;
  }

  session.steps = session.stepBase + count;
  session.stepSamples = trimStepSamples(
    [...session.stepSamples, [now, session.steps]],
    now
  );
  emitLive();
}

function onFix(fix) {
  if (!session || session.status === "paused" || session.status === "done") {
    return;
  }

  const now = Date.now();
  const previousFix = session.lastRawFix;

  if (session.inBackground) {
    // Behind the screen Android does not run the timers, but the positions keep
    // coming: they are what judges an auto pause and saves the walk, then.
    tick();

    if (now - session.lastSavedAtMs >= SAVE_EVERY_MS) {
      void saveProgress();
    }
  }

  session.lastRawFix = fix;

  if (isUsableWalkFix(fix)) {
    session.fix = { latitude: fix.latitude, longitude: fix.longitude };
  }

  if (session.status === "autoPaused") {
    // Ground gained is how a walk without a step counter wakes up again, and
    // nothing is added to the walk meanwhile.
    if (previousFix && isUsableWalkFix(fix) && isUsableWalkFix(previousFix)) {
      const seconds = (fix.timestamp - previousFix.timestamp) / 1000;
      const metres = approximateMetres(previousFix, fix);

      if (seconds > 0 && seconds <= 5 && metres / seconds >= WALK_TRACKING.autoPauseMinSpeedMetersPerSecond) {
        session.lastMoveAtMs = now;

        if (!stepsLive()) {
          resumeFromAuto();
        }
      }
    }

    emitLive();
    return;
  }

  const previous = session.walk;
  const next = foldWalkPoint(previous, fix);

  if (next.anchor !== previous.anchor) {
    // A point the walk kept: written, drawn and, if it went anywhere, movement.
    session.walk = next;

    // After a long silence the walk starts again from here, with no line
    // across it (the same rule routeFromPoints applies to a stored route).
    const gapSeconds = previous.anchor
      ? (fix.timestamp - previous.anchor.timestamp) / 1000
      : Infinity;
    const segments = session.route.length > 0 ? session.route : [[]];
    const last = segments[segments.length - 1];
    const point = { latitude: fix.latitude, longitude: fix.longitude };

    session.route =
      gapSeconds > WALK_TRACKING.maxGapSeconds && last.length > 0
        ? [...segments, [point]]
        : [...segments.slice(0, -1), [...last, point]];

    if (next.distanceMeters > previous.distanceMeters) {
      session.lastMoveAtMs = now;
    }

    const { workoutId } = session;

    void enqueueWrite(() => walkService.recordWalkFix(db, { workoutId, fix }));
  } else if (next !== previous) {
    session.walk = next;
  }

  emitLive();
}

// Good enough to tell walking from standing; the real distance comes from
// Utils/walkTracking.
function approximateMetres(from, to) {
  const metresPerDegree = 111195;
  const dLat = (to.latitude - from.latitude) * metresPerDegree;
  const dLon =
    (to.longitude - from.longitude) *
    metresPerDegree *
    Math.cos((from.latitude * Math.PI) / 180);

  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/* -------------------------------------------------------------- auto pause -- */

function tick() {
  if (!session || (session.status !== "running" && session.status !== "autoPaused")) {
    return;
  }

  const verdict = evaluateAutoPause({
    enabled: session.autoPauseEnabled,
    autoPaused: session.status === "autoPaused",
    nowMs: Date.now(),
    sinceMs: session.sinceMs,
    hasStepCounter: stepsLive(),
    // Until the first fix there is no ground to judge by, so a slow GPS start
    // is not read as standing still.
    hasGps: Boolean(session.locationSubscription) && session.fix !== null,
    lastStepAtMs: session.lastStepAtMs,
    lastMoveAtMs: session.lastMoveAtMs,
  });

  if (verdict === "pause") {
    pauseClock("autoPaused");
    emit();
  } else if (verdict === "resume") {
    resumeFromAuto();
  }
}

function pauseClock(nextStatus) {
  if (!session || session.status !== "running") {
    return;
  }

  session.elapsed = currentElapsedSeconds();
  session.timerStart = null;
  session.status = nextStatus;
  void persistTimer();
  void saveProgress();
}

function resumeFromAuto() {
  if (!session || session.status !== "autoPaused") {
    return;
  }

  startClock();
  session.status = "running";
  session.sinceMs = Date.now();
  void breakRoute();
  emit();
}

function startClock() {
  session.timerStart = getCurrentStoredTimestampSeconds();
  void persistTimer();
}

// Nothing is drawn or added across a stretch where tracking was not running.
async function breakRoute() {
  if (!session) {
    return;
  }

  const { workoutId } = session;
  const timestamp = Date.now();

  session.walk = foldWalkPoint(session.walk, {
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp,
  });

  // The next point opens a new stretch; one that is already open and empty is
  // left as it is.
  const last = session.route[session.route.length - 1];

  if (!last || last.length > 0) {
    session.route = [...session.route, []];
  }

  await enqueueWrite(() => walkService.recordWalkBreak(db, { workoutId, timestamp }));
}

/* ------------------------------------------------------------- app state -- */

function handleAppState(nextState) {
  if (!session) {
    return;
  }

  const tracking = session.status === "running" || session.status === "autoPaused";

  if (nextState === "background" && tracking && backgroundTracking() && !session.inBackground) {
    // The walk's location service keeps the position coming, and with it the
    // app, so nothing is detached and the route is not broken. The step counter
    // is stopped by its library behind the screen and counts up to the total
    // when the app is back: it is not a sign of life meanwhile (stepsLive), and
    // nothing is added for the gap here, which would count those steps twice.
    session.inBackground = true;
    void saveProgress();
    return;
  }

  if (nextState === "active" && session.inBackground) {
    session.inBackground = false;
    // The catch-up of the step counter arrives as one jump: it is no cadence,
    // and the walk is not judged still before it has landed.
    session.stepSamples = [];
    session.sinceMs = Date.now();
    emit();
    return;
  }

  if (nextState === "background" && tracking && !session.backgroundedAt) {
    // Nothing keeps a position or a step counter alive behind the screen when
    // the walk's location task could not start. The clock goes on (it is the
    // time on the wall), the route is broken here, and the walk picks up again
    // when the app comes back.
    session.backgroundedAt = Date.now();
    void detachSensors();
    void breakRoute();
    void saveProgress();
    return;
  }

  if (nextState === "active" && session.backgroundedAt && tracking) {
    const gapStart = session.backgroundedAt;
    const gapEnd = Date.now();

    session.backgroundedAt = null;
    session.sinceMs = gapEnd;

    void (async () => {
      // iOS can say how many steps were taken meanwhile; Android cannot, and
      // those steps are not counted.
      const missed = await stepCounterService.getStepsBetween(gapStart, gapEnd);

      if (session && missed && session.stepsAvailable && session.status === "running") {
        session.steps += missed;
        session.stepBase = session.steps;
        emit();
      }

      await attachSensors();
    })();
  }
}

function ensureAppStateListener() {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener("change", handleAppState);
  }
}

/* ------------------------------------------------------------- the session -- */

function emptySession(workoutId) {
  return {
    workoutId,
    status: "idle",
    originalStart: null,
    timerStart: null,
    elapsed: 0,
    walk: createWalkState(),
    route: [],
    fix: null,
    lastRawFix: null,
    steps: 0,
    stepBase: 0,
    stepsAvailable: false,
    stepSamples: [],
    stepSubscription: null,
    locationSubscription: null,
    location: "unknown",
    lastStepAtMs: null,
    lastMoveAtMs: null,
    sinceMs: Date.now(),
    backgroundedAt: null,
    inBackground: false,
    lastSavedAtMs: 0,
    autoPauseEnabled: true,
    savedTotals: null,
  };
}

function routeFromPoints(points) {
  const segments = [];
  let current = null;
  let previousTimestamp = null;

  for (const point of points ?? []) {
    if (point.latitude === null || point.longitude === null) {
      current = null;
      previousTimestamp = null;
      continue;
    }

    // The same rule as onFix: a long silence ends the stretch.
    if (
      current &&
      previousTimestamp !== null &&
      (point.timestamp - previousTimestamp) / 1000 > WALK_TRACKING.maxGapSeconds
    ) {
      current = null;
    }

    if (!current) {
      current = [];
      segments.push(current);
    }

    current.push({ latitude: point.latitude, longitude: point.longitude });
    previousTimestamp = point.timestamp;
  }

  return segments;
}

/**
 * Makes `workoutId` the walk in front of the screen. If it is already the one
 * being tracked nothing is reloaded - the sensors never stopped. Otherwise it
 * is read from the phone: a walk whose clock was running when the app was
 * closed comes back paused (its clock is not moved to now), with its route
 * and steps from the last save.
 */
export async function openWalk(database, workoutId) {
  if (session && Number(session.workoutId) === Number(workoutId) && db === database) {
    emit();
    return snapshot;
  }

  if (session) {
    await leaveWalk();
  }

  db = database;
  ensureAppStateListener();

  const [timerRow, stored, autoPauseEnabled, stepsAvailable, location] =
    await Promise.all([
      workoutService.getWorkoutTimerState(db, workoutId),
      walkService.loadWalk(db, workoutId),
      walkService.getAutoPauseEnabled(),
      stepCounterService.isStepCounterAvailable(),
      locationService.getWalkLocationPermission(),
    ]);

  const next = emptySession(workoutId);
  const done = Number(timerRow?.done) === 1;
  const originalStart = normalizeStoredTimestampSeconds(timerRow?.original_start_time);
  const timerStart = normalizeStoredTimestampSeconds(timerRow?.timer_start);
  let elapsed = normalizeElapsedDurationSeconds(timerRow?.elapsed_time, 0);

  // A clock that was running when the app went away has the time up to now
  // banked, as Resistance does when it reopens: the walker kept walking, but
  // nothing was watching, so it comes back paused rather than running blind.
  let staleRunning = false;

  if (!done && timerStart !== null) {
    elapsed = normalizeElapsedDurationSeconds(
      elapsed + Math.max(0, getCurrentStoredTimestampSeconds() - timerStart),
      0
    );
    staleRunning = true;
  }

  next.status = done ? "done" : originalStart === null ? "idle" : "paused";

  // A walk that has not been started has nothing of its own: a copy of an older
  // walk can carry a segment, and its numbers are not this walk's.
  if (next.status === "idle") {
    stored.points = [];
    stored.segment = null;
  }

  next.originalStart = originalStart;
  next.elapsed = elapsed;
  next.walk = replayWalkPoints(stored.points);
  next.route = routeFromPoints(stored.points);
  next.fix =
    next.route.length > 0 && next.route[next.route.length - 1].length > 0
      ? next.route[next.route.length - 1][next.route[next.route.length - 1].length - 1]
      : null;
  next.stepsAvailable = stepsAvailable;
  next.steps = Number(stored.segment?.actual_steps) || 0;
  next.stepBase = next.steps;
  next.autoPauseEnabled = autoPauseEnabled;
  next.location = location.status === "granted" ? "granted" : location.canAskAgain ? "denied" : "blocked";
  next.savedTotals = done ? stored.totals : null;
  session = next;

  if (staleRunning) {
    // Bank the time that passed (the clock is stopped, not discarded).
    await persistTimer();
  }

  emit();
  return snapshot;
}

/** Lets go of the sensors and the walk, writing what it has. */
export async function leaveWalk() {
  if (!session) {
    return;
  }

  const leaving = session;

  if (leaving.status === "running" || leaving.status === "autoPaused") {
    // Left running means left paused: nobody is watching any more.
    pauseClock("paused");
  }

  await detachSensors();
  await writeChain;
  session = null;
  snapshot = null;
  listeners.forEach((listener) => listener(null));
}

/** For a walk that was deleted: nothing is written for it any more. */
export async function releaseWalk(workoutId) {
  if (!session || Number(session.workoutId) !== Number(workoutId)) {
    return;
  }

  const detached = detachSensors();

  session = null;
  snapshot = null;
  listeners.forEach((listener) => listener(null));

  // A position or a save that was already queued is written before this
  // returns, so deleting the workout afterwards leaves nothing behind it.
  await detached;
  await writeChain;
}

// Asks only for what has not been decided, and only here - the first time a
// walk starts or resumes, never when the app opens.
async function askForAccess(target) {
  if (target.location !== "granted") {
    const current = await locationService.getWalkLocationPermission();
    const result =
      current.status === "granted"
        ? current
        : current.canAskAgain
          ? await locationService.requestWalkLocationPermission()
          : current;

    target.location =
      result.status === "granted" ? "granted" : result.canAskAgain ? "denied" : "blocked";
  }

  if (target.stepsAvailable) {
    const current = await stepCounterService.getStepPermission();
    const result =
      current.status === "granted"
        ? current
        : current.canAskAgain
          ? await stepCounterService.requestStepPermission()
          : current;

    if (result.status !== "granted") {
      target.stepsAvailable = false;
    }
  }
}

/** The first Start: asks for what the walk can use, then goes. */
export async function startWalk() {
  if (!session || session.status !== "idle" || session.starting) {
    return;
  }

  const sessionRef = session;

  sessionRef.starting = true;

  try {
    await askForAccess(sessionRef);
  } finally {
    sessionRef.starting = false;
  }

  if (session !== sessionRef || sessionRef.status !== "idle") {
    return;
  }

  const now = getCurrentStoredTimestampSeconds();

  session.originalStart = now;
  session.timerStart = now;
  session.status = "running";
  session.sinceMs = Date.now();

  const { workoutId } = session;

  await enqueueWrite(() => walkService.clearWalk(db, workoutId));

  await enqueueWrite(async () => {
    await workoutService.setWorkoutOriginalStartTime(db, {
      workoutId,
      startTime: now,
    });
  });
  await persistTimer();
  workoutService.notifyWorkoutStartedInBackground(db, {
    workoutId,
    startedAt: now,
  });

  await breakRoute();
  await attachSensors();
}

export async function pauseWalk() {
  if (!session || (session.status !== "running" && session.status !== "autoPaused")) {
    return;
  }

  if (session.status === "running") {
    pauseClock("paused");
  } else {
    session.status = "paused";
  }

  await detachSensors();
  await breakRoute();
  await saveProgress();
  emit();
}

export async function resumeWalk() {
  // The walker taps Resume on an auto pause: the sensors are still running, so
  // it is only the clock that starts again.
  if (session?.status === "autoPaused") {
    resumeFromAuto();
    return;
  }

  if (!session || session.status !== "paused" || session.starting) {
    return;
  }

  const sessionRef = session;

  sessionRef.starting = true;

  try {
    await askForAccess(sessionRef);
  } finally {
    sessionRef.starting = false;
  }

  if (session !== sessionRef || sessionRef.status !== "paused") {
    return;
  }

  session.status = "running";
  session.sinceMs = Date.now();
  startClock();
  await breakRoute();
  await attachSensors();
}

/** Allow location from the screen's empty state, then start watching. */
export async function requestLocationAccess() {
  if (!session) {
    return "unknown";
  }

  const result = await locationService.requestWalkLocationPermission();

  session.location =
    result.status === "granted" ? "granted" : result.canAskAgain ? "denied" : "blocked";
  emit();

  if (session.location === "granted") {
    await attachSensors();
  }

  return session.location;
}

export async function setAutoPause(enabled) {
  const next = await walkService.setAutoPauseEnabled(enabled);

  if (session) {
    session.autoPauseEnabled = next;

    if (!next && session.status === "autoPaused") {
      resumeFromAuto();
    }

    emit();
  }

  return next;
}

/**
 * Finishes the walk. Returns what to show in the summary, or null when there
 * was nothing to finish.
 */
export async function finishWalk() {
  if (!session || session.status === "done" || session.status === "idle") {
    return null;
  }

  const movingSeconds = currentElapsedSeconds();
  const distanceMeters = session.walk.distanceMeters;
  const steps = session.stepsAvailable ? session.steps : null;
  const { workoutId } = session;

  session.elapsed = movingSeconds;
  session.timerStart = null;
  session.status = "done";

  const detached = detachSensors();

  session.savedTotals = {
    distanceKm: distanceMeters / 1000,
    durationSeconds: movingSeconds,
    steps,
    segments: 1,
  };
  emit();

  await detached;
  await writeChain;
  await walkService.finishWalk(db, {
    workoutId,
    distanceMeters,
    movingSeconds,
    steps,
  });

  return { movingSeconds, distanceMeters, steps };
}

/** A restart from the workout's options: everything back to before Start. */
export async function restartWalk() {
  if (!session) {
    return;
  }

  const { workoutId } = session;
  const keep = {
    stepsAvailable: session.stepsAvailable,
    location: session.location,
    autoPauseEnabled: session.autoPauseEnabled,
  };

  await detachSensors();
  await writeChain;
  await walkService.restartWalk(db, workoutId);

  session = { ...emptySession(workoutId), ...keep };
  emit();
}

/* ------------------------------------------------------------- derived -- */

/** Steps per minute right now, or null when there is no step counter. */
export function cadenceOf(snapshotValue, nowMs = Date.now()) {
  if (!snapshotValue?.stepsAvailable || snapshotValue.status === "idle") {
    return null;
  }

  return cadenceStepsPerMinute(snapshotValue.stepSamples, nowMs);
}
