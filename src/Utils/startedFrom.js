// Where a workout was started from: what the developer overview's "Startet
// fra" tile counts, to see how people actually begin a workout.
//
// Set once, by the client, when the workout row is created - by the caller
// that knows, never worked out afterwards from the row - and synced as
// `workout_type_instance.started_from`. Rows from before it existed stay
// null, and the overview does not count them.
//
// It records the screen the person started from, not where the workout ended
// up: a recent workout repeated onto today's program day is `recent`, and one
// added from the calendar to a program day is `calendar`.

export const STARTED_FROM = Object.freeze({
  // Built as part of a program: its weeks, a copied week, an imported program.
  PROGRAM: "program",
  // Repeated from a list of earlier workouts: your split, the Train tab, the
  // workout library, the start sheet's repeat list.
  RECENT: "recent",
  // Added or copied in the calendar.
  CALENDAR: "calendar",
  // An empty workout from a quick start.
  EMPTY: "empty",
  // Anything else - copying a workout from its own page, say.
  OTHER: "other",
});

// Exactly the five the cloud column's check constraint accepts.
export const STARTED_FROM_VALUES = Object.freeze(Object.values(STARTED_FROM));

const CLOUD_COLUMN = "started_from";

/** One of the five, or null - for an older row and for anything unrecognised. */
export function normalizeStartedFrom(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return STARTED_FROM_VALUES.includes(normalized) ? normalized : null;
}

/**
 * The cloud has no `started_from` column yet: the migration that adds it
 * (20261001090000_dev-kpis.sql) has not been run against the project.
 *
 * A read says so in "column workout_type_instance.started_from does not
 * exist" (42703), a write in "Could not find the 'started_from' column of
 * 'workout_type_instance' in the schema cache" (PGRST204). A word match, so
 * another missing column is not mistaken for this one.
 */
export function isMissingStartedFromColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`;

  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    /\bstarted_from\b/.test(message)
  );
}

/**
 * The payload as it may be sent. `started_from` is left out when the cloud
 * has no such column, and when it is null: null means "not known" - an older
 * row, or one that reached this phone while the column was missing - and an
 * update that sent it would erase the value the phone that created the
 * workout sent.
 */
export function withSendableStartedFrom(payload, { cloudHasColumn = true } = {}) {
  if (
    !payload ||
    !Object.prototype.hasOwnProperty.call(payload, CLOUD_COLUMN) ||
    (cloudHasColumn && payload[CLOUD_COLUMN] != null)
  ) {
    return payload;
  }

  const { [CLOUD_COLUMN]: _left, ...sendable } = payload;
  return sendable;
}

/**
 * The workout sync's handle on the column, for one app session.
 *
 * The app can reach users before the migration has run, and a select or a
 * payload that names a missing column fails the whole request - so without
 * this, shipping first would stop every workout from syncing. Until the cloud
 * says the column is missing, `selectColumns` and `sendablePayload` name it.
 * The first request that fails for that reason flips the handle, and
 * `withFallback` runs the request once more; the request reads the handle
 * again, so the second run leaves the column out, and so does everything
 * after it until the app starts again.
 *
 * `request` must be safe to run twice. The sync's are: a missing column fails
 * the first statement a request sends, before anything is written.
 */
export function createStartedFromCloudColumn({ onMissing } = {}) {
  let missing = false;

  return {
    isAvailable() {
      return !missing;
    },

    selectColumns(baseColumns) {
      return missing ? baseColumns : `${baseColumns}, ${CLOUD_COLUMN}`;
    },

    sendablePayload(payload) {
      return withSendableStartedFrom(payload, { cloudHasColumn: !missing });
    },

    async withFallback(request) {
      try {
        return await request();
      } catch (error) {
        if (missing || !isMissingStartedFromColumnError(error)) {
          throw error;
        }

        missing = true;
        onMissing?.(error);

        return request();
      }
    },
  };
}
