// The rest counted up after a set that has no rest written.
//
// Ticking a set off with a rest in it counts that rest down (the bottom menu's
// square, the lock-screen ring, the "rest is over" reminder). A set without
// one used to give nothing; now the app counts up from the tick, to show how
// long the rest between sets really was, and keeps it.
//
// - Nothing for the first 15 seconds. Somebody who ticks off every set at once
//   after the exercise has not rested between them, and none of those gets a
//   rest recorded.
// - After that it counts up in the set's rest field - the workout screen's
//   rest bubble, and the lock screen - but never in the bottom menu's square,
//   and it never schedules the reminder: it is a record, not a plan.
// - It ends when the next set is ticked off (any exercise), when the workout is
//   paused or finished, and on the lock screen with "Afslut pause". The rest
//   taken is then written in that set's rest field, with `rest_counted` = 1,
//   through the ordinary set write, so it syncs.
// - A counted rest is not a planned one: ticking the set off again counts up
//   again rather than down, and a new set - the next one, a copied workout,
//   the first set of the exercise next week - does not inherit it. Typing a
//   rest by hand makes it planned again.
//
// Pure: no clock, no database. The service that runs it is
// Services/restCountUpService.js.
import { MAX_SET_PAUSE_SECONDS } from "./setValueLimits";

export const REST_COUNT_UP_GRACE_SECONDS = 15;

const flag = (value) => Number(value) === 1 || value === true;

/** Whether a set's rest is one the app counted, rather than one that was planned. */
export function isCountedRest(set) {
  return flag(set?.rest_counted);
}

/**
 * The rest to count down after a set, in whole seconds - 0 for none, and for a
 * rest the app counted, which is a record of the last time rather than a plan.
 */
export function plannedRestSeconds(set) {
  if (isCountedRest(set)) {
    return 0;
  }

  const seconds = Math.round(Number(set?.pause));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** The rest a set carries forward to a new one: none when the app counted it. */
export function carriedRestOf(set) {
  return isCountedRest(set) ? null : set?.pause ?? null;
}

/**
 * The whole seconds to write for a count-up that ran from `startedAt` to
 * `endedAt` (Unix seconds), or null under the 15 s grace - then nothing is
 * written. Capped at the rest field's own ceiling.
 */
export function countedRestSeconds(startedAt, endedAt) {
  const started = Number(startedAt);
  const ended = Number(endedAt);

  if (!Number.isFinite(started) || !Number.isFinite(ended)) {
    return null;
  }

  const seconds = Math.floor(ended - started);

  if (seconds < REST_COUNT_UP_GRACE_SECONDS) {
    return null;
  }

  return Math.min(MAX_SET_PAUSE_SECONDS, seconds);
}

/** Whether a count-up shows yet, at `now`: from 15 s after the tick. */
export function isRestCountUpVisible(countUp, now) {
  if (!countUp) {
    return false;
  }

  return Number(now) - Number(countUp.startedAt) >= REST_COUNT_UP_GRACE_SECONDS;
}

/** The seconds a count-up shows at `now`, never below zero. */
export function restCountUpElapsed(countUp, now) {
  if (!countUp) {
    return 0;
  }

  return Math.max(0, Math.floor(Number(now) - Number(countUp.startedAt)));
}

/* ------------------------------------------------------ the cloud column -- */

const CLOUD_COLUMN = "rest_counted";

/**
 * The cloud has no `set.rest_counted` yet: the migration that adds it
 * (20261005090000_a-set-knows-a-counted-rest.sql) has not been run. 42703 on
 * a read, PGRST204 on a write, and a word match - as started_from and
 * weight_mode - so another missing column is not taken for this one, and the
 * decimals' 22P02 (setDecimals.js) never is.
 */
export function isMissingRestCountedColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`;

  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    /\brest_counted\b/.test(message)
  );
}

/** The payload as it may be sent: without `rest_counted` while the cloud has no such column. */
export function withSendableRestCounted(payload, { cloudHasColumn = true } = {}) {
  if (
    cloudHasColumn ||
    !payload ||
    !Object.prototype.hasOwnProperty.call(payload, CLOUD_COLUMN)
  ) {
    return payload;
  }

  const { [CLOUD_COLUMN]: _left, ...sendable } = payload;
  return sendable;
}

/**
 * A cloud set that does not say whether its rest was counted - no column yet,
 * or a row an older app created - says nothing about it: the phone's own flag
 * stands, so that alone is never a difference to download.
 */
export function withKnownRestCounted(cloudSet, localSet) {
  const value = cloudSet?.[CLOUD_COLUMN];

  if (value !== null && value !== undefined) {
    return cloudSet;
  }

  return { ...cloudSet, [CLOUD_COLUMN]: isCountedRest(localSet) };
}

/**
 * The set sync's handle on the column for one app session, the pattern of
 * createStartedFromCloudColumn (./startedFrom.js): named in the selects and
 * the payload until the cloud says it is missing, then the request runs once
 * more without it, and so does everything after it until the app starts
 * again. Until the migration has run a counted rest syncs as a plain rest, and
 * the flag stays on the phone.
 *
 * `request` must be safe to run twice. A missing column fails the first
 * statement a request sends, before anything is written.
 */
export function createRestCountedCloudColumn({ onMissing } = {}) {
  let missing = false;

  return {
    isAvailable() {
      return !missing;
    },

    selectColumns(baseColumns) {
      return missing ? baseColumns : `${baseColumns}, ${CLOUD_COLUMN}`;
    },

    sendablePayload(payload) {
      return withSendableRestCounted(payload, { cloudHasColumn: !missing });
    },

    async withFallback(request) {
      try {
        return await request();
      } catch (error) {
        if (missing || !isMissingRestCountedColumnError(error)) {
          throw error;
        }

        missing = true;
        onMissing?.(error);

        return request();
      }
    },
  };
}
