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
| `20260905143000_user-blocks.sql` | yes |
| `20260905161500_delete-account.sql` | yes |
| `20260905174500_privacy-consent.sql` | yes |
| `20260905190000_rpc-hardening.sql` | yes |
| `20260906091500_fix-watcher-trigger-permissions.sql` | yes |
| `20260907110000_exercise-favourites.sql` | yes |
| `20260912120000_content-moderation.sql` | **no - run this before the next store submission** |

`20260905113510_drop-unused-template-tables.sql` is optional: it drops the seven
`*_template` tables, and only if they are genuinely empty. Run it or delete it.

## The five from the security review, applied 2026-09-10

They were run against the project in this order, through the SQL editor, one at
a time. The order is not arbitrary — `rpc-hardening` restores a function that
`user-blocks` takes away, and `fix-watcher-trigger-permissions` repairs a break
that `rpc-hardening` causes, so a run that stops halfway leaves the app worse
than before it started:

1. `20260905143000_user-blocks.sql` — blocking, the tightened `profiles` and
   `user_follows` policies, `search_profiles`, `list_blocked_profiles`.
2. `20260905190000_rpc-hardening.sql` — adds `claim_username_code`, the function
   the client uses to claim a username tag, which the policy above took away.
3. `20260906091500_fix-watcher-trigger-permissions.sql` — the watcher functions
   were left security invoker in the `private` schema, which `authenticated`
   cannot reach, so every write to `sync_local_watchers` failed with 42501 and
   workout sync stopped.
4. `20260905161500_delete-account.sql` — `purge_user_account`, the doorway the
   `delete-account` Edge Function calls. **That Function still has to be
   deployed**; until it is, Delete account fails even though the SQL side is
   ready.
5. `20260905174500_privacy-consent.sql` — the two columns the consent gate
   writes to. Without them the gate failed open and nobody was ever asked.

Verified afterwards by querying the catalog: `user_blocks`, `search_profiles`,
`claim_username_code`, `purge_user_account`, `list_blocked_profiles`, both
`privacy_policy_*` columns, the watcher function's `prosecdef` flag and the
trigger on `sync_local_watchers` all present.

`20260907110000_exercise-favourites.sql` was run the same day, after the five
above. It had been committed a ledger entry short, and the table turned out not
to exist — favourites were being starred locally and refused on every sync. This
is exactly the drift the ledger is meant to catch, and it did: `npm test` was
failing on the missing entry the whole time.

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
