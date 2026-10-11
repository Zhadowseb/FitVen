// The Daily_Steps table: one row for each day (see Database/schema/steps.js),
// and a few small facts about this person's steps kept beside it.

export async function getDailySteps(db, { fromIso, toIso }) {
  return db.getAllAsync(
    `SELECT day, steps, source, updated_at, needs_sync
     FROM Daily_Steps
     WHERE day BETWEEN ? AND ?
     ORDER BY day ASC;`,
    [fromIso, toIso]
  );
}

/** Writes a day as it is, replacing the one that was there. `needsSync` says whether the cloud has it. */
export async function writeDailyStep(db, { day, steps, source, updatedAt, needsSync }) {
  await db.runAsync(
    `INSERT INTO Daily_Steps (day, steps, source, updated_at, needs_sync)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       steps = excluded.steps,
       source = excluded.source,
       updated_at = excluded.updated_at,
       needs_sync = excluded.needs_sync;`,
    [day, steps, source, updatedAt, needsSync ? 1 : 0]
  );
}

export async function getDirtyDailySteps(db) {
  return db.getAllAsync(
    `SELECT day, steps, source, updated_at
     FROM Daily_Steps
     WHERE needs_sync = 1
     ORDER BY day ASC;`
  );
}

/**
 * The cloud has the day: clear its flag - but only if the row is still the one
 * that was sent, so a number that changed while the upload was out goes again.
 */
export async function markDailyStepSynced(db, { day, updatedAt }) {
  await db.runAsync(
    `UPDATE Daily_Steps SET needs_sync = 0 WHERE day = ? AND updated_at = ?;`,
    [day, updatedAt]
  );
}

/* ----------------------------------------------------- facts about the steps -- */

async function getMetadata(db, key) {
  const row = await db.getFirstAsync(
    `SELECT metadata_value FROM App_Metadata WHERE metadata_key = ?;`,
    [key]
  );

  return row?.metadata_value ?? null;
}

async function setMetadata(db, key, value) {
  await db.runAsync(
    `INSERT INTO App_Metadata (metadata_key, metadata_value)
     VALUES (?, ?)
     ON CONFLICT(metadata_key) DO UPDATE SET metadata_value = excluded.metadata_value;`,
    [key, String(value)]
  );
}

const STEPS_ENABLED_KEY = "steps_enabled";

/**
 * Whether this person has said yes to their steps being read - the Allow on the
 * steps card or page. Until then no source is read: a permission given for a
 * walk is not a yes to the whole day.
 */
export async function getStepsEnabled(db) {
  return (await getMetadata(db, STEPS_ENABLED_KEY)) === "1";
}

export async function setStepsEnabled(db) {
  await setMetadata(db, STEPS_ENABLED_KEY, "1");
}

const backfillKey = (source) => `steps_backfill_${source}_at`;

/**
 * When a source's history was read (ms), or 0 if it has not been. Once for each
 * source, whatever the table already holds: a better source that answers later
 * still gets its history read.
 */
export async function getBackfillDoneAt(db, source) {
  const value = Number(await getMetadata(db, backfillKey(source)));

  return Number.isFinite(value) ? value : 0;
}

export async function setBackfillDoneAt(db, source, timestamp) {
  await setMetadata(db, backfillKey(source), timestamp);
}
