// The rules for recording that the app was opened (src/Sync/AppOpenSync.js):
// how often, under which key, and on which platforms. Pure, so they can be
// tested; the write itself is appOpenService.recordAppOpen.
//
// What is recorded is "opened at least once in the last hour", not every
// open. The developer overview counts people who opened the app within 14
// days, so a finer record would say nothing more and cost a request per
// return to the foreground.

export const APP_OPEN_INTERVAL_MS = 60 * 60 * 1000;

// The two the cloud column's check constraint accepts. A web build in
// development records nothing.
export const APP_OPEN_PLATFORMS = Object.freeze(["ios", "android"]);

/** Per user, so a second account on the same phone is recorded on its own. */
export function getAppOpenStorageKey(userId) {
  return `fitven.appOpen.lastRecordedAt.${userId}`;
}

/** `Platform.OS` when it is one the cloud takes, null otherwise. */
export function normalizeAppOpenPlatform(os) {
  return APP_OPEN_PLATFORMS.includes(os) ? os : null;
}

// The cloud column's check constraint (profile_private_last_app_version_length).
export const APP_VERSION_MAX_LENGTH = 40;

/**
 * The version as the cloud takes it: the same "v2.13.0 | build 24" the
 * feedback carries, cut to the column's limit. A longer one would fail the
 * write on every open, forever, without anything saying why.
 */
export function normalizeAppVersionForCloud(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, APP_VERSION_MAX_LENGTH).trim() : null;
}

/** The stored "last recorded" time as epoch ms, or null when there is none. */
export function parseLastRecordedAt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const time = Number(value);
  return Number.isFinite(time) && time > 0 ? time : null;
}

/**
 * Whether this open should be recorded: never recorded, or not within the
 * interval. A time in the future - the clock was set back since - does not
 * hold the next record back until the clock catches up with it.
 */
export function shouldRecordAppOpen({
  lastRecordedAt,
  now,
  intervalMs = APP_OPEN_INTERVAL_MS,
}) {
  const last = parseLastRecordedAt(lastRecordedAt);

  if (last === null || last > now) {
    return true;
  }

  return now - last >= intervalMs;
}

/** The migration adding the three columns has not run: 42703 on a read, PGRST204 on a write. */
export function isMissingAppOpenColumnError(error) {
  return error?.code === "42703" || error?.code === "PGRST204";
}
