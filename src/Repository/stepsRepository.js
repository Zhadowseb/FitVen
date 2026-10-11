// The Daily_Steps table: one row for each day (see Database/schema/steps.js).

export async function getDailySteps(db, { fromIso, toIso }) {
  return db.getAllAsync(
    `SELECT day, steps, source, updated_at, needs_sync
     FROM Daily_Steps
     WHERE day BETWEEN ? AND ?
     ORDER BY day ASC;`,
    [fromIso, toIso]
  );
}

/** How many days older than `beforeIso` are kept: nothing means no history was ever read. */
export async function countDailyStepsBefore(db, beforeIso) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS count FROM Daily_Steps WHERE day < ?;`,
    [beforeIso]
  );

  return Number(row?.count) || 0;
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

const BACKFILL_TRIED_KEY = "steps_backfill_tried_at";

/** When the history was last asked for (ms), or 0: kept in this person's own database. */
export async function getBackfillTriedAt(db) {
  const row = await db.getFirstAsync(
    `SELECT metadata_value FROM App_Metadata WHERE metadata_key = ?;`,
    [BACKFILL_TRIED_KEY]
  );
  const value = Number(row?.metadata_value);

  return Number.isFinite(value) ? value : 0;
}

export async function setBackfillTriedAt(db, timestamp) {
  await db.runAsync(
    `INSERT INTO App_Metadata (metadata_key, metadata_value)
     VALUES (?, ?)
     ON CONFLICT(metadata_key) DO UPDATE SET metadata_value = excluded.metadata_value;`,
    [BACKFILL_TRIED_KEY, String(timestamp)]
  );
}
