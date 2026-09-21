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
| `20260912220000_ugc-safety.sql` | yes |
| `20260915120000_repair-workout-type-catalog.sql` | yes |
| `20260916140000_terms-of-use.sql` | yes |
| `20260916210000_opt-in-column-defaults.sql` | yes |
| `20260917120000_gyms-and-lift-verification.sql` | yes |
| `20260917120100_workout-music.sql` | yes |
| `20260921120000_hide-a-reported-post.sql` | yes |
| `20260921140000_lift-videos-stay-in-the-centre.sql` | yes |
| `20260921150000_drop-workout-start-coordinates.sql` | yes |
| `20260921160000_friends-surrounding-activity.sql` | yes |
| `20260921170000_blocked-members-cannot-watch.sql` | yes |

`20260917120000_gyms-and-lift-verification.sql` and
`20260917120100_workout-music.sql` carry version 2.0: centres, the workout ->
centre match, per-centre lift leaderboards with video verification, and what
was playing during a workout. **Both have to be run before 2.0 ships**, in
that order, and the first one before the app: it adds three columns to
`workout_type_instance` that the 2.0 client puts in every workout upload, so a
2.0 client against a database without them fails every workout sync with an
unknown-column error. The client reads (Home, Centres) degrade quietly without
them; the writes do not.

After the first one, run `npm run gyms:import -- --dry-run` and then
`npm run gyms:import` with the service role in the environment - see
`data/gyms/README.md`. Without it the `gym` table is empty, and an empty
table is a Centres screen with nothing on it, not an error.

Both were run on 2026-09-17, in that order, and `npm run gyms:import` was run
the same day: 365 centres in `gym`, 326 of them with a photograph in the
`gym-images` bucket (the 39 Fit&Sund centres have none on their site). Verify
over the REST API with the anon key: `gym_lift?select=id` and
`workout_music?select=id` should each answer with an empty array (own or
followed rows only, none yet), and `rpc/national_strongest` should answer
`[]` rather than a missing-function error.

`20260915120000_repair-workout-type-catalog.sql` restores missing built-in and
legacy workout types without changing existing rows or granting catalog writes
to app users. Applied to FitVen on 2026-09-15: before the repair, only Resistance
and Run existed. It added Walk, Upperbody, Legs and StrengthTraining.
If a device still reports an unknown workout type afterwards, inspect that
type's exact value; this migration intentionally does not invent catalog entries
from arbitrary client input.

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

`20260912220000_ugc-safety.sql` was run on 2026-09-12. It carries reporting and
the term filter, the two halves of Apple's guideline 1.2 the app was missing.

Verified afterwards over the REST API with the anon key: `user_reports` answers
with an empty array, so the table is there and row-level security is hiding
everyone's rows, and `blocked_terms` answers `42501 permission denied`. That
second one is the check worth keeping — an empty array there would have meant
the revoke had not taken and the app could read the word list.

It also seeds `public.blocked_terms`. That table has row-level security on and
no policy, which is deliberate: only the security definer function reads it. To
add a term afterwards, use the service role:

```sql
insert into public.blocked_terms (term, language) values ('<term>', 'da')
on conflict (term) do nothing;
```

Reports are read the same way — there is no policy that lets anyone in the app
see another user's report:

```sql
select * from public.user_reports where status = 'open' order by created_at;
```

`20260916140000_terms-of-use.sql` was run on 2026-09-16. It adds the two columns
the consent gate writes the terms acceptance to, and the trigger that raises an
automatic report when somebody blocks an account. Both come from an App Review
rejection under guideline 1.2.

Verified over the REST API with the anon key: `user_reports?select=source` and
`profile_private?select=terms_version,terms_accepted_at` both answer with an
empty array rather than an unknown-column error, so the columns are there and
row-level security is hiding the rows.

`20260916210000_opt-in-column-defaults.sql` was run on 2026-09-16. It turns note,
RPE and 1RM% off in the saved column preferences, which the app's own repair has
been doing locally for a while without the cloud copy ever being corrected. The
preference table syncs both ways, so the device was cleaned and the next sync
put it back - and every exercise added to a workout came with a NOTE column. Run
it together with the app change that guards that repair to run once.

`20260921120000_hide-a-reported-post.sql` was run on 2026-09-21. It adds
`social_post.hidden_at`, hides a post two different accounts have reported,
refuses a report that names a post its author did not write, and locks the
column so only the hide itself can write it. The support page's promise - a
post two people report leaves the feed straight away - is true from this date.

`20260921140000_lift-videos-stay-in-the-centre.sql` was run on 2026-09-21. It
closes three holes the review agents found in the migration above, which was
already live: any signed-in user could read any centre's verification videos,
`gym_lift.video_path` accepted a path belonging to somebody else, and
`request_lift_verification` could be called in a loop. Its three functions are
copied from that file verbatim with one change each, so a diff between the two
shows exactly what moved.

`20260921150000_drop-workout-start-coordinates.sql` was run on 2026-09-21.
Row-level security on `workout_type_instance` is row-based, so the
follower policy that shows yesterday, today and tomorrow was also showing the
start coordinates the centre migration added - and following needs no approval.
Ten centimetres of accuracy on where somebody starts their workout is their
home address. The app never read them from the cloud; the retry that needs them
reads the device's own copy, which stays. The 2.0 client stops writing them in
the same change.

`20260921160000_friends-surrounding-activity.sql` was run on 2026-09-21. The
friends tiles ask how long ago somebody trained, and the follower policy on
`workout_type_instance` only shows yesterday, today and tomorrow - so the
answer for a friend was always empty and every tile fell into the "no activity"
band. Widening that policy would have handed a follower the whole training
history to produce two dates, so this is a security definer function that
returns the two dates and nothing else, for people the viewer actually follows,
with blocks dropped.

`20260921170000_blocked-members-cannot-watch.sql` was run on 2026-09-21.
`private.can_watch_lift_video`, from the migration two rows above,
was the one function in that clean-up that did not ask about blocks - every
other path does. A leaderboard row carries the lifter's id and the lift id, and
the object path is `<user_id>/<lift_id>.<ext>`, so somebody who had seen a row
before blocking could still ask for a signed URL and get one. The function here
is the applied one with that single clause added.

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
