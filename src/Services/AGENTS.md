# AGENTS.md

## Scope

This file applies to `src/Services`.

## What Lives Here

Business logic and multi-step flows, plus the cloud sync engine.
`programService.js` carries both: the sync engine for seven entities, and the
program domain. Note that **`Set` and `Exercise_Instance` sync live in
`programService.js`, not in `weightliftingService.js`** — the file name does not
tell you that.

## Adding A Field To A Synced Table

This is the checklist. A field that only gets half of it works perfectly on the
phone you tested on and disappears on the next one, after the cloud answers.
Nothing in the code connects step 1 to step 7, and nothing fails loudly.

Synced tables: `Program`, `Mesocycle`, `Microcycle`, `Day`, `Sickness`,
`Workout_Type_Instance`, `Exercise_Instance`, `Set`.

Using `Set` as the example:

| # | Where | What |
|---|---|---|
| 1 | `src/Database/schema/weightlifting.js` | add the column to `CREATE TABLE "Set"` — this is the truth for a **fresh install** |
| 2 | `src/Database/db.js` | add it to the table rebuild — the truth for an **existing install**. Both, always. |
| 3 | `src/Repository/weightliftingRepository.js` | add it to every SELECT that reads the row |
| 4 | `src/Repository/weightliftingRepository.js` | add it to INSERT/UPDATE, and keep the sync bookkeeping (see below) |
| 5 | `src/Services/programService.js` `getComparableSetSnapshot` | otherwise a change to the field never counts as a change |
| 6 | `src/Services/programService.js` `areComparableSetsEqual` | same |
| 7 | `src/Services/programService.js` `buildCloudSetPayload` | otherwise the field is never uploaded |
| 8 | `src/Services/programService.js` `reconcileSetsFromCloud` | otherwise the next pull overwrites it locally |
| 9 | `src/Services/weightliftingService.js` | normalisation or derived fields, if any |
| 10 | the screen | display |
| 11 | **the Supabase table** | a SQL migration, and somebody has to run it against the project |

Steps 5 to 8 are the ones that get skipped. They are the cloud half.

For another entity, swap `Set` for its name: the same four functions exist per
entity, named `getComparableXSnapshot`, `areComparableXsEqual`,
`buildCloudXPayload` and `reconcileXsFromCloud`.

## Rules That The Code Depends On

- Every service and repository function takes `db` as its first argument. The
  screen gets it from `useSQLiteContext()` and passes it down.
- Writes are wrapped in `withTransaction` from `Services/shared.js`. It guards
  against nested transactions with a global map and retries on
  "database is locked"; a nested call fails in a way that does not look like a
  layer problem.
- A repository write to a synced table must set `needs_sync = 1`, bump
  `sync_version` and fill `sync_id` with `COALESCE(sync_id, <uuid>)`. The
  pattern is `updateSetField` in `src/Repository/weightliftingRepository.js`.
  Forget it and the change is saved locally and lost on the next pull.
- Cloud sync is never triggered directly. Always `syncXInBackground(db)` or
  `enqueueSync()`, which serialise everything through one promise chain in
  `Services/syncScheduler.js`. Parallel calls break parent-before-child upload.
- Never alias a layer to another layer's name. 45 function names exist in both
  `Services` and `Repository` with the same signature.

## Known Gaps

- `Sickness` appears in the sync metadata list in `src/Database/db.js` but has
  no sync implementation. It is local-only today. Do not assume it syncs.
