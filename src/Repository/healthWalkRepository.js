// Walks that came from a watch, through Health Connect: which sessions have
// been made into walks (Imported_Health_Walk, on the phone only), and the few
// facts kept beside it. The rules are in Utils/watchWalks.js and the work in
// Services/watchWalkService.js.

const ENABLED_KEY = "watch_walks_enabled";
const LAST_IMPORT_KEY = "watch_walks_last_import_at";

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

/** Whether this person has said yes to walks being read from their watch. */
export async function getWatchWalksEnabled(db) {
  return (await getMetadata(db, ENABLED_KEY)) === "1";
}

export async function setWatchWalksEnabled(db, enabled) {
  await setMetadata(db, ENABLED_KEY, enabled ? "1" : "0");
}

/** When the sessions were last read (ms), or 0. */
export async function getLastImportAt(db) {
  const value = Number(await getMetadata(db, LAST_IMPORT_KEY));

  return Number.isFinite(value) ? value : 0;
}

export async function setLastImportAt(db, timestamp) {
  await setMetadata(db, LAST_IMPORT_KEY, timestamp);
}

/**
 * Every trace FitVen has of a walk between two times (ms), as
 * { hcId, startMs, endMs }: the sessions imported before - also when the walk
 * has been deleted since, so it is not brought back - and every walk with a
 * start, deleted or not, whether it was tracked here or came back from the
 * cloud on this phone (those have no session id).
 */
export async function getExistingWalkWindows(db, { fromMs, toMs }) {
  const imported = await db.getAllAsync(
    `SELECT hc_id, started_at, ended_at
     FROM Imported_Health_Walk
     WHERE ended_at >= ? AND started_at <= ?;`,
    [fromMs, toMs]
  );
  const walks = await db.getAllAsync(
    `SELECT original_start_time, elapsed_time
     FROM Workout_Type_Instance
     WHERE workout_type = 'Walk'
       AND original_start_time IS NOT NULL
       AND original_start_time BETWEEN ? AND ?;`,
    [Math.floor(fromMs / 1000) - 24 * 3600, Math.ceil(toMs / 1000)]
  );

  return [
    ...imported.map((row) => ({ hcId: row.hc_id, startMs: row.started_at, endMs: row.ended_at })),
    ...walks.map((row) => {
      const startMs = Number(row.original_start_time) * 1000;
      const seconds = Math.max(60, Number(row.elapsed_time) || 0);

      return { hcId: null, startMs, endMs: startMs + seconds * 1000 };
    }),
  ];
}

export async function insertImportedWalk(db, { hcId, workoutId, startMs, endMs, origin, importedAt }) {
  await db.runAsync(
    `INSERT OR IGNORE INTO Imported_Health_Walk
       (hc_id, workout_id, started_at, ended_at, origin, imported_at, route_loaded)
     VALUES (?, ?, ?, ?, ?, ?, 0);`,
    [hcId, workoutId, startMs, endMs, origin ?? null, importedAt]
  );
}

/** The session a walk came from, or null for a walk that is not one of them. */
export async function getImportedWalkByWorkout(db, workoutId) {
  return db.getFirstAsync(
    `SELECT hc_id, workout_id, started_at, ended_at, origin, route_loaded
     FROM Imported_Health_Walk
     WHERE workout_id = ?;`,
    [workoutId]
  );
}

export async function markRouteLoaded(db, hcId) {
  await db.runAsync(`UPDATE Imported_Health_Walk SET route_loaded = 1 WHERE hc_id = ?;`, [hcId]);
}
