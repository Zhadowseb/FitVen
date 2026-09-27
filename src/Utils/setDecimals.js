// The two numbers on a set that have decimals: the weight (102.5 kg, and
// 11.25 kg with a weight per side) and RPE (8.5). Every other number on a set
// - reps, 1RM %, the pause, the set number, an AMRAP target - is rounded to a
// whole one on the phone (Utils/setValueLimits.js), so whole is the truth
// there and those stay integers everywhere.
//
// The cloud columns `set.weight` and `set.rpe` were integers until
// 20261003090000_a-set-keeps-its-decimals.sql, and the upload truncated both
// so the column would take them: 102.5 on the phone was 102 on every other
// phone, in the category lists and on a restore. This is how the sync copes
// with the column being either, for as long as the migration may not have
// run.
//
// Pure: no supabase, no database. The sync modules own one handle each
// session and bring the requests.

export const SET_DECIMAL_FIELDS = Object.freeze(["weight", "rpe"]);

// Two places: a quarter kilo a side (11.25) is the finest step the phone
// offers. Anything finer is noise from a division.
const PLACES_FACTOR = 100;

/** A set's weight or RPE with up to two decimals, or null for no value. */
export function normalizeSetDecimal(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const rounded = Math.round(numericValue * PLACES_FACTOR) / PLACES_FACTOR;
  // -0 compares equal to 0 but prints as "-0" in a payload.
  return rounded === 0 ? 0 : rounded;
}

function hasFraction(value) {
  return typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value);
}

/** True when a row carries a weight or an RPE with decimals. */
export function hasSetDecimals(row) {
  return SET_DECIMAL_FIELDS.some((key) => hasFraction(normalizeSetDecimal(row?.[key])));
}

/**
 * The payload as an integer column takes it: weight and RPE cut to whole
 * numbers, the way every upload did before the column kept decimals. The
 * row's own payload is not changed.
 */
export function truncateSetDecimals(payload) {
  if (!payload) {
    return payload;
  }

  const truncated = { ...payload };

  for (const key of SET_DECIMAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(truncated, key)) {
      const value = normalizeSetDecimal(truncated[key]);
      truncated[key] = value === null ? null : Math.trunc(value);
    }
  }

  return truncated;
}

/**
 * The integer column refused a value with decimals: "invalid input syntax for
 * type integer: "102.5"" (22P02). The only numbers with decimals in a set
 * payload are the weight and RPE, so on a set upload this can only be them.
 */
export function isSetDecimalsRefusedError(error) {
  return (
    error?.code === "22P02" &&
    /\btype (smallint|integer|bigint)\b/.test(String(error?.message ?? ""))
  );
}

/**
 * The cloud's value is the phone's with its decimals cut off: 102 for 102.5.
 * Exactly what an upload to the integer column leaves behind, and nothing
 * else - a cloud value that differs by a kilo is a real change.
 */
export function isTruncatedCopy(localValue, cloudValue) {
  const local = normalizeSetDecimal(localValue);
  const cloud = normalizeSetDecimal(cloudValue);

  return hasFraction(local) && cloud !== null && Number.isInteger(cloud) && cloud === Math.trunc(local);
}

/** True when the cloud holds a cut-off copy of this set's weight or RPE. */
export function hasTruncatedSetDecimals(localSnapshot, cloudSnapshot) {
  return SET_DECIMAL_FIELDS.some((key) =>
    isTruncatedCopy(localSnapshot?.[key], cloudSnapshot?.[key])
  );
}

/** The cloud snapshot with the phone's decimals where the cloud's are cut off. */
export function withLocalSetDecimals(localSnapshot, cloudSnapshot) {
  const merged = { ...cloudSnapshot };

  for (const key of SET_DECIMAL_FIELDS) {
    if (isTruncatedCopy(localSnapshot?.[key], cloudSnapshot?.[key])) {
      merged[key] = normalizeSetDecimal(localSnapshot[key]);
    }
  }

  return merged;
}

/**
 * What the reconcile should make of a cloud set against the phone's copy.
 *
 *   cloudSnapshot  what to compare with and, if the cloud wins, write: the
 *                  cloud's, with the phone's decimals kept where the cloud
 *                  only has them cut off and cannot tell us more
 *   reupload       send the phone's copy again - the cloud keeps decimals
 *                  now, and holds this set cut off from before
 *
 * `cloudKeepsDecimals` is the session's answer: true, false, or null while
 * nobody knows yet. `versionOrder` is compareEntitySyncVersions(local, cloud).
 *
 *   - Integer column: the cloud cannot hold more than 102, so 102 against
 *     102.5 is agreement. Otherwise the phone's 102.5 would be overwritten on
 *     every pull, and every other change would be compared against it.
 *   - The cloud edited the set since (a newer version): its value wins, as
 *     any other field's would - somebody may have meant 102.
 *   - The column keeps decimals and the cut-off copy is this very edit: the
 *     phone's is the truth, and it goes up again, once.
 *   - Not known yet: keep the phone's, send nothing, decide when it is known.
 */
export function resolveCloudSetDecimals({
  localSnapshot,
  cloudSnapshot,
  cloudKeepsDecimals,
  versionOrder,
}) {
  if (!hasTruncatedSetDecimals(localSnapshot, cloudSnapshot)) {
    return { cloudSnapshot, reupload: false };
  }

  if (cloudKeepsDecimals === false) {
    return { cloudSnapshot: withLocalSetDecimals(localSnapshot, cloudSnapshot), reupload: false };
  }

  if (versionOrder < 0) {
    return { cloudSnapshot, reupload: false };
  }

  return {
    cloudSnapshot: withLocalSetDecimals(localSnapshot, cloudSnapshot),
    reupload: cloudKeepsDecimals === true,
  };
}

/**
 * The set sync's handle on the two columns, for one app session.
 *
 * The app can reach users before the migration has run. Until then the
 * integer column refuses 102.5, and without this every upload of such a set
 * would fail, and with it the whole set sync. The first upload refused for
 * that reason flips the handle, and `withFallback` runs the request once
 * more; the request reads the handle again, so the second run sends the
 * truncated payload, and so does everything after it until the app starts
 * again. Same shape as createStartedFromCloudColumn in Utils/startedFrom.js.
 *
 * It also learns the other way: a cloud row with decimals, or a probe the
 * column answers without complaint, means the column keeps them.
 *
 * `request` must be safe to run twice. The sync's are: a refused value fails
 * the statement that carries it, before anything is written.
 */
export function createSetDecimalsCloudColumns({ onRefused } = {}) {
  // null: not known yet. Never goes back to null once it is known.
  let keepsDecimals = null;

  function refuse(error) {
    if (keepsDecimals !== false) {
      keepsDecimals = false;
      onRefused?.(error);
    }
  }

  return {
    /** true, false, or null while nobody knows yet. */
    cloudKeepsDecimals() {
      return keepsDecimals;
    },

    sendablePayload(payload) {
      return keepsDecimals === false ? truncateSetDecimals(payload) : payload;
    },

    /** Rows the cloud sent back: one with decimals settles it. */
    learnFrom(rows) {
      if (keepsDecimals === null && (rows ?? []).some(hasSetDecimals)) {
        keepsDecimals = true;
      }
    },

    /**
     * Asks the cloud when nobody knows yet. `probe` is a read that names a
     * value with decimals against the column and throws what the request
     * answers. Anything but the integer refusal leaves the question open -
     * a probe that fails for another reason says nothing about the column.
     */
    async resolve(probe) {
      if (keepsDecimals !== null) {
        return keepsDecimals;
      }

      try {
        await probe();
        keepsDecimals = true;
      } catch (error) {
        if (isSetDecimalsRefusedError(error)) {
          refuse(error);
        }
      }

      return keepsDecimals;
    },

    async withFallback(request) {
      try {
        return await request();
      } catch (error) {
        if (keepsDecimals === false || !isSetDecimalsRefusedError(error)) {
          throw error;
        }

        refuse(error);

        return request();
      }
    },
  };
}
