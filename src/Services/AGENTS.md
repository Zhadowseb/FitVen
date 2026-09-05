# AGENTS.md

## Scope

This file applies to `src/Services`.

## What Lives Here

Business logic and multi-step flows. The cloud sync engine is
`src/Services/cloudSync/`, one module per entity over a shared base:

```
cloudSyncFields.js  the field tables: how a row is normalised, compared, uploaded
cloudSyncShared.js  identity, watcher/cascade, local deletes
programSync.js      ─┐
mesocycleSync.js     │ each syncs its parent first, so the chain runs
microcycleSync.js    │ parent to child and the modules stay acyclic
daySync.js           │
workoutTypeInstanceSync.js
exerciseInstanceSync.js
setSync.js          ─┘
hierarchy.js        pushes all seven in one pass - this is what SetSync mounts
workoutTypes.js     the workout type catalog
index.js            re-exported by programService, so callers see no change
```

Note that **`Set` and `Exercise_Instance` sync live here, not in
`weightliftingService.js`** — the names do not tell you that.

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
| 5-7 | `src/Services/cloudSync/cloudSyncFields.js` `SYNCED_FIELDS.Set` | **one row**, and the snapshot, the comparison and the payload all follow from it |
| 8 | `src/Services/cloudSync/setSync.js` `reconcileSetsFromCloud` | otherwise the next pull overwrites it locally |
| 9 | `src/Services/weightliftingService.js` | normalisation or derived fields, if any |
| 10 | the screen | display |
| 11 | **the Supabase table** | a migration in `supabase/migrations/`, and somebody has to run it against the project |

Steps 5 to 8 are the ones that get skipped. They are the cloud half.

For another entity, swap `Set` for its name. `SYNCED_FIELDS` has a table per
entity, and `getComparableXSnapshot`, `areComparableXsEqual` and
`buildCloudXPayload` are all derived from it. `reconcileXsFromCloud` lives in
that entity's own module and still has to be updated by hand.

A row looks like this:

```js
field("weight", int())                       // read, normalise, compare, upload
field("date", normalizeDayDate, {            // different normaliser for the cloud
  cloud: normalizeDayDateForCloud,
})
field("cloud_day_id", int(), {               // the payload builder sets this one
  payload: "head",
})
```

`npm test` runs `scripts/test-cloud-sync-fields.js`, which fails if a field is
compared but never uploaded, compared but not in the snapshot, or not stable
under a second normalisation.

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
