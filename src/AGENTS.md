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

## Related Guides

- See `src/Pages/AGENTS.md` for UI-specific guidance.
- See `src/Database/AGENTS.md` for schema and persistence guidance.
