# AGENTS.md

## Scope

This file applies to `src/Database` and all descendant folders.

## Database Rules

- Treat schema changes as compatibility work, not isolated text edits.
- When adding, renaming, or removing schema fields, trace reads and writes through `Repository`, `Services`, and affected screens.
- Prefer additive changes and safe defaults over destructive changes.
- Do not assume existing local SQLite data can be dropped or recreated without explicit approval.
- Keep table and column naming stable unless the task explicitly requires a rename.

## SQLite Connection Safety

- Keep `SQLiteProvider` props stable. Memoize `onInit` callbacks with `useCallback` so auth/session re-renders do not close and reopen the active database connection.
- Background tasks that open the same database file and later call `closeAsync()` must use `SQLite.openDatabaseAsync(databaseName, { useNewConnection: true })`.
- Do not close a SQLite connection obtained from `useSQLiteContext()`. That connection is owned by `SQLiteProvider` and closing it can make app screens appear empty until a full app restart.
- If SQLite data disappears from the UI but returns after a full app restart, investigate connection lifecycle, background tasks, and provider remounts before assuming rows were deleted.

## Migration Safety

- Check how existing rows will behave after a schema change, especially defaults and null handling.
- Update dependent insert, select, and update logic in the same task when schema behavior changes.
- If a database change is intended to ship to users, make sure version metadata and `CHANGELOG.md` are updated before release.
