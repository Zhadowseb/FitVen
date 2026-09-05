# Supabase migrations

Every change to the cloud schema lives here, in the order it was applied.

Until 2026-09-05 these were loose files in `docs/` with no numbering and no
record of which had been run. The ordering was still recoverable from git
history then; in another six months and another twenty files it would not have
been. That is the only reason this move happened when it did.

## State on adoption, 2026-09-05

The timestamps are taken from when each file first landed in git, which is the
closest record we have of when it was run against the project. Where two landed
in the same commit, the order is the one the files themselves declare in their
`Run after` headers.

Every file here is listed below with whether it has been run. `npm test` fails
if a migration exists that this table does not name, so the ledger cannot fall
behind by accident.

| Migration | Applied |
|---|---|
| `20260424004053_social-search.sql` | yes |
| `20260426150442_exercise-order.sql` | yes |
| `20260429131030_workout-types.sql` | yes |
| `20260430152840_exercise-muscle-groups.sql` | yes |
| `20260515150145_side-by-side-sync-migration.sql` | yes |
| `20260518150438_sickness.sql` | yes |
| `20260518150439_day-sickness.sql` | yes |
| `20260519012251_exercise-column-preferences.sql` | yes |
| `20260521173322_body-map-regions.sql` | yes |
| `20260525142801_social-posts.sql` | yes |
| `20260531234750_social-post-visibility.sql` | yes |
| `20260531234751_social-post-hidden-exercises.sql` | yes |
| `20260609112711_push-notifications.sql` | yes |
| `20260609112712_workout-start-notifications.sql` | yes |
| `20260610205948_notification-history.sql` | yes |
| `20260628211540_profile-birthdate.sql` | yes |
| `20260905013310_birth-year-only.sql` | yes |
| `20260905113144_avatar-private-bucket.sql` | yes |
| `20260905113510_drop-unused-template-tables.sql` | no |
| `20260905143000_user-blocks.sql` | no |

`20260905113510_drop-unused-template-tables.sql` is optional: it drops the seven
`*_template` tables, and only if they are genuinely empty. Run it or delete it.

`20260905143000_user-blocks.sql` is **not** optional and has to be run before a
build carrying blocking reaches anyone. Until it is, user search returns an
error, because the app now asks for a function that does not exist yet.

This has not been reconciled with Supabase's own migration tracking
(`supabase_migrations.schema_migrations`), so `supabase db push` would try to
re-apply all of it. Most of these files are written idempotently
(`create table if not exists`, `drop policy if exists` before `create policy`),
but do not rely on that. To adopt the CLI's tracking properly, link the project
and mark each version as already applied:

```
supabase link --project-ref <ref>
supabase migration repair --status applied <version>   # one per file above
```

Until that is done, this folder is a record and a running order, not something
to point a tool at.

## Adding one

1. Name it `<YYYYMMDDHHMMSS>_<what-it-does>.sql`. The timestamp is what orders
   it; nothing else does.
2. Write it so it can run twice without harm: `if not exists`, and
   `drop policy if exists` before every `create policy`.
3. If it depends on an earlier migration, say so in a `Run after` comment at
   the top, the way the existing files do.
4. Run it against the project, and add it to the table above in the same
   commit. A file here that has not been run is worse than no file.
5. If the change adds a column to a synced table, `src/Services/AGENTS.md` has
   the rest of the checklist — the cloud column is only step 11 of 11.

## Not migrations

`docs/export-user-programs.sql` is a read-only query for pulling one user's
program data out by hand. It changes nothing, so it stays in `docs/`.
