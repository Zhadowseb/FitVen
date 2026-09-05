# AGENTS.md

## Scope

This file applies to `src/Database` and all descendant folders.

## Database Rules

- Treat schema changes as compatibility work, not isolated text edits.
- When adding, renaming, or removing schema fields, trace reads and writes through `Repository`, `Services`, and affected screens.
- Prefer additive changes and safe defaults over destructive changes.
- Do not assume existing local SQLite data can be dropped or recreated without explicit approval.
- Keep table and column naming stable unless the task explicitly requires a rename.

## The Schema Lives In Two Files

- `src/Database/schema/*.js` holds `CREATE TABLE IF NOT EXISTS`. It is the truth
  for a **fresh install**.
- `src/Database/db.js` holds the table rebuilds, `ensureTableColumns`, triggers
  and backfills. It is the truth for an **existing install**.

Every schema change has to be made in both, and both have to end up in the same
state. Change only the first and the app works for new users and fails silently
for everyone who already has it. Change only the second and it is the other way
round. Nothing warns you.

If the table is synced, `src/Services/AGENTS.md` has the rest of the checklist.

The **cloud** schema is a third place, and it is not in either of those files:
every change to it is a migration in `supabase/migrations/`. See the README
there for the running order and what has actually been applied.

## SQLite Connection Safety

- Keep `SQLiteProvider` props stable. Memoize `onInit` callbacks with `useCallback` so auth/session re-renders do not close and reopen the active database connection.
- Background tasks that open the same database file and later call `closeAsync()` must use `SQLite.openDatabaseAsync(databaseName, { useNewConnection: true })`.
- Do not close a SQLite connection obtained from `useSQLiteContext()`. That connection is owned by `SQLiteProvider` and closing it can make app screens appear empty until a full app restart.
- If SQLite data disappears from the UI but returns after a full app restart, investigate connection lifecycle, background tasks, and provider remounts before assuming rows were deleted.

## Migration Safety

- Check how existing rows will behave after a schema change, especially defaults and null handling.
- Update dependent insert, select, and update logic in the same task when schema behavior changes.
- If a database change is intended to ship to users, make sure version metadata and `CHANGELOG.md` are updated before release.
