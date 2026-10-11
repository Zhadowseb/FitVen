export const stepsSchemaSql = `

  -- One row for each day: the number of steps FitVen shows for it, and which
  -- source it came from (Utils/dailyStepLog.js: "health", "motion" or
  -- "sensor", best first). Only the day's steps - the phone's own count, read
  -- from its health app or its motion sensor - never the training added on top
  -- of it, which is computed. The history the health apps keep is longer than
  -- what can be read back later, so a day is kept here once it has been seen.
  -- It follows the person to the cloud (public.daily_steps) and back.
  CREATE TABLE IF NOT EXISTS Daily_Steps (
    day TEXT PRIMARY KEY NOT NULL,
    steps INTEGER NOT NULL,
    source TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    needs_sync INTEGER NOT NULL DEFAULT 1
  );
`;
