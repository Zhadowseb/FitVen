# AGENTS.md

## Scope

This file applies to everything inside `src/`.

## Source Layout

- `Pages/`: screen-level UI, local components, and styles
- `Database/`: SQLite schema, database setup, and Supabase wiring
- `Repository/`: data access functions close to persistence concerns
- `Services/`: business logic and multi-step app flows
- `Contexts/`: React context and app-level state
- `Resources/`: shared UI components, theme, icons, and design primitives
- `Sync/`: sync-related flows
- `Utils/`: reusable helpers with minimal side effects

## Structure Rules

- Keep logic close to the feature that owns it before extracting shared abstractions.
- Prefer the existing layer boundaries over bypassing them with shortcut imports or direct database calls from screens.
- When moving or renaming files, update imports in the same change.
- Reuse `Resources` and existing services/repositories before creating parallel patterns.

## Sync Rules

- Treat `Set` as the lowest-level cloud sync boundary for strength workout data.
- Keep `Workout_Type_Instance` cloud sync focused on workout-level fields such as workout type, label, date, completion, and timer state.
- Changes to `Exercise_Instance` should update local state immediately and sync the owning exercise row without bypassing the established repository and service layers.
- Changes to `Set` rows should update local state immediately, keep the owning `Exercise_Instance` derived fields in sync locally, and then sync both levels in the correct parent-first order.
- Keep `Run` data on its own workout-level sync path until a lower-level running sync exists.

## Conventions The Code Depends On

- Every service and repository function takes `db` as its first argument. The
  screen gets it with `useSQLiteContext()` and passes it down.
- Import through the barrel: `from "../../Services"`, not
  `from "../../Services/programService"`. Same for
  `../../Resources/ThemedComponents`.
- Never alias one layer to another layer's name. 45 function names exist in
  both `Services` and `Repository` with the same signature, so
  `import { xService as xRepository }` sends the next reader to the wrong file.
  `npm test` fails if one reappears.
- Folders and component files are PascalCase. Service, repository and utils
  files are camelCase.
- `Utils/` is for helpers with minimal side effects. A helper that opens the
  database belongs in a service.

## What "Exercise" Means

Five names, and they are not interchangeable:

| Name | What it is |
|---|---|
| table `Exercise` | the catalog of exercise names. Was called `Exercise_storage`; `db.js` still handles the rename for old installs, which is why `getExerciseStorage` has that name. |
| table `Exercise_Instance` | one exercise inside one concrete workout. Unrelated to the catalog. |
| `ExerciseCatalogPage` | the screen that shows and picks from the catalog |
| `ExerciseLibraryPage` | the hub screen with shortcuts to calendar, sickness and personal records |
| `ExerciseLibraryList` | the list itself. It lives under `ExerciseLibraryPage` but **both** screens use it. |

## Surprising Placements

- The global bottom navigation and the whole start-a-workout flow live in
  `src/Resources/ThemedComponents/ThemedBottomNavigation.js` and
  `src/Resources/Components/StartWorkoutSheet.js` — not in `src/Pages/`. The
  navigation is mounted in `App.js` outside the navigator.
- `src/Pages/WeekPage/` is outside the active user flow, but it is still a
  registered route.

## Related Guides

- See `src/Pages/AGENTS.md` for UI-specific guidance.
- See `src/Database/AGENTS.md` for schema and persistence guidance.
- See `src/Services/AGENTS.md` for the cloud sync field checklist.
- See `src/Sync/AGENTS.md` for which sync components actually run.
