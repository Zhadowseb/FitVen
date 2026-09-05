# AGENTS.md

## Scope

This file applies to `src/Sync`.

## What Actually Runs

Only what `App.js` mounts. Everything here is a headless React component that
does its work in an effect, so a file in this folder that is not in the list
below never executes — no matter how complete it looks.

| Component | Mounted | What it pushes |
|---|---|---|
| `WorkoutTypeCatalogSync` | yes | the workout type catalog, cloud to local |
| `ExerciseLibrarySync` | yes | the shared exercise catalog, cloud to local |
| `SetSync` | yes | **the whole strength hierarchy**, parent first: program, block, week, day, workout type instance, exercise instance, set |
| `WorkoutTypeInstanceSync` | yes | workout-level fields |
| `PushNotificationRegistrationSync` | yes | the device's push token |

`syncQueue.js` is not a component. It is the entry point every one of them goes
through, and it serialises everything onto a single promise chain.

## Rules

- Before changing sync behaviour, check the table above. If the component you
  are looking at is not in it, the code you are about to change does not run.
- There is deliberately no per-level component for program, block, week, day or
  exercise instance. `SetSync` pushes that whole hierarchy in one pass through
  `programService.pushDirtyStrengthHierarchyWithCloud`, in parent-first order.
  Five per-level components used to exist unmounted and were removed in 0.21.8;
  do not reintroduce them.
- Never call a sync function directly. Go through `syncXInBackground(db)` or
  `enqueueSync()`. Parallel sync calls break the parent-before-child ordering.
- If you add a component here, mount it in `App.js` and add a row to the table
  in the same change. `npm test` fails if the two disagree.
