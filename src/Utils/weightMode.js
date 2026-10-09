// Weight per side or for both sides (4d): how a weight is written, how it is
// converted when somebody switches, what it adds up to, and how it is shown.
//
// Two modes an exercise in a workout can be written in:
//
//   total     the weight on both sides together - a barbell, or two
//             dumbbells counted as one number. The default.
//   per_side  the weight on one side - one dumbbell, one handle.
//
// `Exercise_Instance.weight_mode` says which one a workout's sets were written
// in, and NULL - a row from before the column, or from an older app - means
// total. `Exercise.weight_mode` is the exercise's current choice, which the
// next workout copies. (A custom exercise may also say `bodyweight`; for the
// numbers here that is total, and the card offers no switch for it.)
//
// Pure: no database, no React Native, so scripts/test-weight-mode.js loads it
// on its own. The SQL fragments below are the same rules written for SQLite,
// and the test runs both against each other.
import { formatNumber } from "@localization";

export const PER_SIDE = "per_side";
export const TOTAL = "total";
// The two a workout's exercise can be written in: the cloud column's check.
export const INSTANCE_WEIGHT_MODES = Object.freeze([TOTAL, PER_SIDE]);

// What a switch rounds to. kg only in the app today; lb is here so a unit
// setting can be added without touching the rule.
const ROUNDING_BY_UNIT = Object.freeze({ kg: 0.25, lb: 0.5 });

function readMode(value) {
  if (value && typeof value === "object") {
    return readMode(value.weight_mode ?? value.weightMode ?? null);
  }

  if (typeof value !== "string") {
    return null;
  }

  const mode = value.trim().toLowerCase();

  return INSTANCE_WEIGHT_MODES.includes(mode) ? mode : mode === "bodyweight" ? TOTAL : null;
}

/** 'total' | 'per_side' as stored and synced, or null for "not known". */
export function normalizeInstanceWeightMode(value) {
  return readMode(value);
}

/** The mode a stored value means: NULL and anything unknown are total. */
export function weightModeOf(value) {
  return readMode(value) ?? TOTAL;
}

/**
 * The mode an exercise in a workout is written in: its own when it has one,
 * else the exercise's current choice, else total. Either argument may be the
 * mode itself or a row carrying `weight_mode`.
 *
 * Every local instance has its own (db.js fills NULL in as total, which is
 * what NULL means), so the exercise only decides for one being created.
 */
export function resolveWeightMode(instance, exercise) {
  return readMode(instance) ?? readMode(exercise) ?? TOTAL;
}

export function isPerSide(mode) {
  return weightModeOf(mode) === PER_SIDE;
}

function toNumber(weight) {
  if (weight === null || weight === undefined || weight === "") {
    return null;
  }

  const numeric = Number(weight);

  return Number.isFinite(numeric) ? numeric : null;
}

/** To the nearest `step`, without the float dust (22.499999...). */
export function roundToStep(value, step) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return null;
  }

  if (!(step > 0)) {
    return numeric;
  }

  return Number((Math.round(numeric / step) * step).toFixed(4));
}

/**
 * A weight written in `from`, as it is written in `to`, exactly: ×2 or ÷2.
 * What the records compare with, so the order between two sets never
 * changes because of a switch. Null stays null.
 */
export function convertWeight(weight, from, to) {
  const numeric = toNumber(weight);

  if (numeric === null) {
    return null;
  }

  const fromMode = weightModeOf(from);
  const toMode = weightModeOf(to);

  if (fromMode === toMode) {
    return numeric;
  }

  return toMode === PER_SIDE ? numeric / 2 : numeric * 2;
}

/**
 * What the switch writes: the weight converted and rounded to 0.25 kg (lb:
 * 0.5). Null stays null, and the same mode leaves the weight as it is.
 */
export function toggleWeight(weight, from, to, unit = "kg") {
  const numeric = toNumber(weight);

  if (numeric === null) {
    return null;
  }

  if (weightModeOf(from) === weightModeOf(to)) {
    return numeric;
  }

  return roundToStep(convertWeight(numeric, from, to), ROUNDING_BY_UNIT[unit] ?? ROUNDING_BY_UNIT.kg);
}

/** What was actually lifted: a weight per side counts twice. */
export function totalLoad(weight, mode) {
  const numeric = toNumber(weight);

  if (numeric === null) {
    return null;
  }

  return weightModeOf(mode) === PER_SIDE ? numeric * 2 : numeric;
}

/**
 * A set's %1RM: the weight as it is written over the 1RM estimate, in whole
 * percent - 22,5 kg per side is 22,5 against the estimate, not 45. The owner
 * decided it: the %1RM column reads the number in the form the set is
 * written in, as the 1RM calculator does, so a switch between per side and
 * both sides moves it with the number. Null without a weight or an estimate.
 */
export function rmPercentageOf(weight, estimatedWeight) {
  const written = toNumber(weight);
  const estimate = toNumber(estimatedWeight);

  if (written === null || estimate === null || !(estimate > 0)) {
    return null;
  }

  return Math.round((written / estimate) * 100);
}

/**
 * The weight at a %1RM, in whole kilos, written as it stands - the other half
 * of rmPercentageOf, so per side it is the number for one side. Null without
 * both.
 */
export function weightAtRmPercentage(rmPercentage, estimatedWeight) {
  const percentage = toNumber(rmPercentage);
  const estimate = toNumber(estimatedWeight);

  if (percentage === null || estimate === null || !(estimate > 0)) {
    return null;
  }

  return Math.round(estimate * (percentage / 100));
}

/** A weight for reading, "22,5". Empty for none. */
export function formatWeightNumber(weight) {
  const numeric = toNumber(weight);

  return numeric === null ? "" : formatNumber(numeric, { maximumFractionDigits: 2 });
}

/** "pr. side" to put after a number written per side; empty for both sides. */
export function weightModeSuffix(mode, t) {
  return isPerSide(mode) ? t("workout.weightMode.suffix") : "";
}

/** "22,5 kg pr. side" or "45 kg". Empty for no weight. */
export function formatWeight(weight, mode, t) {
  const number = formatWeightNumber(weight);

  if (!number) {
    return "";
  }

  const suffix = weightModeSuffix(mode, t);

  return `${number} ${t("common.kg")}${suffix ? ` ${suffix}` : ""}`;
}

/* ------------------------------------------------------------ the card -- */

/**
 * The set whose weight the two tabs show: the first one not ticked off, in
 * the order the card lists them, or the last set when all of them are.
 */
export function pickTabWeight(orderedSets = []) {
  const sets = Array.isArray(orderedSets) ? orderedSets : [];
  const set = sets.find((candidate) => Number(candidate?.done) !== 1) ?? sets[sets.length - 1] ?? null;

  return set ? toNumber(set.weight) : null;
}

/** The two tabs' numbers, from a weight written in `mode`. Null for none. */
export function tabWeights(weight, mode, unit = "kg") {
  const numeric = toNumber(weight);

  if (numeric === null) {
    return { perSide: null, bothSides: null };
  }

  return {
    perSide: toggleWeight(numeric, mode, PER_SIDE, unit),
    bothSides: toggleWeight(numeric, mode, TOTAL, unit),
  };
}

/**
 * What a switch from `from` to `to` does to an exercise's sets: every set,
 * ticked off or not, converted the same way, and nothing else about it
 * touched. `previous` is kept exactly as it was, so the undo can put it back
 * rather than convert it back through the rounding.
 */
export function planWeightModeSwitch(sets = [], from, to, unit = "kg") {
  const fromMode = weightModeOf(from);
  const toMode = weightModeOf(to);

  return (Array.isArray(sets) ? sets : [])
    .filter((set) => set && set.sets_id !== null && set.sets_id !== undefined)
    .map((set) => {
      const previous = toNumber(set.weight);

      return {
        setId: set.sets_id,
        previous,
        next: fromMode === toMode ? previous : toggleWeight(previous, fromMode, toMode, unit),
      };
    });
}

/* ------------------------------------------------------------- the SQL -- */

// The same rules for SQLite, for the queries that sum and compare in SQL.
// `weight` and the modes are column expressions, never user input.

function modeSql(expression) {
  return `(CASE WHEN ${expression} = '${PER_SIDE}' THEN '${PER_SIDE}' ELSE '${TOTAL}' END)`;
}

/** totalLoad in SQL: the weight, twice when it was written per side. */
export function totalLoadSql(weight, mode) {
  return `(CAST(${weight} AS REAL) * (CASE WHEN ${modeSql(mode)} = '${PER_SIDE}' THEN 2.0 ELSE 1.0 END))`;
}

/** convertWeight in SQL: a weight written in `from`, as written in `to`. */
export function convertWeightSql(weight, from, to) {
  return `(CAST(${weight} AS REAL) * (CASE
    WHEN ${modeSql(from)} = ${modeSql(to)} THEN 1.0
    WHEN ${modeSql(to)} = '${PER_SIDE}' THEN 0.5
    ELSE 2.0
  END))`;
}

/**
 * Every exercise name with its current mode, one row a name however it is
 * spelled - the table can hold two that differ only in case, and a join on
 * each would count a set twice. Per side wins a tie. Join it on
 * `lower(<exercise name>) = name_key`.
 */
export const CURRENT_WEIGHT_MODES_SQL = `SELECT
    lower(name) AS name_key,
    MAX(CASE WHEN weight_mode = '${PER_SIDE}' THEN 1 ELSE 0 END) AS is_per_side
  FROM Exercise
  GROUP BY lower(name)`;

/** The current mode from a row of CURRENT_WEIGHT_MODES_SQL aliased `alias`. */
export function currentWeightModeSql(alias) {
  return `(CASE WHEN COALESCE(${alias}.is_per_side, 0) = 1 THEN '${PER_SIDE}' ELSE '${TOTAL}' END)`;
}

/* ------------------------------------------------------- the cloud column -- */

const CLOUD_COLUMN = "weight_mode";

/**
 * The cloud has no `weight_mode` column on this table yet: the migration that
 * adds it (20261002090000_weight-mode-per-instance.sql) has not been run.
 * The same two errors as started_from - 42703 on a read, PGRST204 on a write -
 * and a word match, so another missing column is not mistaken for this one.
 */
export function isMissingWeightModeColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`;

  return (error?.code === "42703" || error?.code === "PGRST204") && /\bweight_mode\b/.test(message);
}

/**
 * The payload as it may be sent. `weight_mode` is left out when the cloud has
 * no such column, and when it is null: null means "not known" - a row from an
 * older app - and sending it would erase what another phone wrote.
 */
export function withSendableWeightMode(payload, { cloudHasColumn = true } = {}) {
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
 * One table's handle on the column for one app session, the same pattern as
 * createStartedFromCloudColumn in ./startedFrom.js: the column is named until
 * the cloud says it is missing, then the request runs once more without it,
 * and so does everything after it until the app starts again. So a phone on
 * this version keeps syncing against a project the migration has not reached;
 * only the mode stays on the phone meanwhile.
 *
 * `request` must be safe to run twice. A missing column fails the first
 * statement a request sends, before anything is written.
 */
export function createWeightModeCloudColumn({ onMissing } = {}) {
  let missing = false;

  return {
    isAvailable() {
      return !missing;
    },

    selectColumns(baseColumns) {
      return missing ? baseColumns : `${baseColumns}, ${CLOUD_COLUMN}`;
    },

    sendablePayload(payload) {
      return withSendableWeightMode(payload, { cloudHasColumn: !missing });
    },

    async withFallback(request) {
      try {
        return await request();
      } catch (error) {
        if (missing || !isMissingWeightModeColumnError(error)) {
          throw error;
        }

        missing = true;
        onMissing?.(error);

        return request();
      }
    },
  };
}
