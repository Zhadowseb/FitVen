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
| `20260921180000_music-opt-in.sql` | yes |
| `20260921180100_lift-video-index.sql` | yes |
| `20260921190000_one-verification-request-per-window.sql` | yes |
| `20260921200000_let-the-policy-call-its-own-check.sql` | yes |
| `20260921220000_dev-dashboard.sql` | yes |
| `20260921230000_the-admin-guard-asks-who-is-asking.sql` | yes |
| `20260922090000_a-feedback-message-has-a-status.sql` | yes |
| `20260922100000_the-note-column-leaves-the-old-exercises.sql` | yes |
| `20260923100000_a-set-has-a-type.sql` | yes |
| `20260924090000_a-friend-can-see-a-record-was-set-today.sql` | yes |
| `20260925100000_explore-counts-your-centres-new-records.sql` | yes |
| `20260925110000_a-post-knows-its-centre.sql` | yes |
| `20260926090000_your-split-follows-you.sql` | yes |
| `20260927090000_a-lifter-can-give-their-sex.sql` | yes |
| `20260927100000_public-profiles.sql` | yes |
| `20260927110000_a-block-hides-public-posts-too.sql` | yes |
| `20260928090000_custom-exercises-can-be-shared.sql` | yes |
| `20260929090000_gym-scope-and-categories.sql` | yes |
| `20260930090000_store-stats-ios-daily.sql` | yes |
| `20261001080000_the-admin-guard-runs-as-its-caller.sql` | yes |
| `20261001090000_dev-kpis.sql` | yes |
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

`20260921180000_music-opt-in.sql` and `20260921180100_lift-video-index.sql`
were both run on 2026-09-21. They were one file first, and that file
deadlocked: it held the lock a policy swap needs on `workout_music` while
asking for the one `create index` needs on `gym_lift`, against a live app
session holding them the other way round, and Postgres killed it. Two tables in
one transaction for two unrelated changes. Split into one table each, the index
as `create index concurrently` - which takes no lock that stops writes, and
which therefore has to be run on its own, outside a transaction block. The
policy file sets a `lock_timeout` so a busy moment makes it give up rather than
queue. **Worth copying next time a migration touches two tables.**

The change itself: the insert policy on `workout_music` asked whether the row
was yours and whether the workout was yours, but not whether you had turned
sharing on - only the client did, and the select policy shows the table to
every follower. And `private.can_watch_lift_video` filters on
`gym_lift.video_path`, which no index covered, so every signed video URL was a
sequential scan and the client signs a whole queue at once.

`20260921190000_one-verification-request-per-window.sql` was run on 2026-09-21.
The ten-minute limit added in `20260921140000` was a select followed by an
insert: two calls a second apart both passed the select, because neither sees
the other's uncommitted row under read committed, and both filled ten inboxes.
The unique index on `event_key` would have stopped them, except the key carried
the epoch second and so only caught calls inside the same second. The key now
names a ten-minute bucket and the insert is `on conflict do nothing`, so the
index is the limit and nothing sits between deciding and writing.

`20260921200000_let-the-policy-call-its-own-check.sql` was run on 2026-09-21.
`20260921140000` put `private.can_watch_lift_video` behind the
select policy on `storage.objects` and revoked execute on it from
`authenticated` in the same file. A policy expression runs as the querying
user - `security definer` says what the body may read, not who may call it -
so every signed-in read of `storage.objects` fails with "permission denied for
function can_watch_lift_video". That is the whole table, so avatars stopped
signing and the Friends tiles said "no activity" for everybody.

The revokes were copied from `private.contains_blocked_term`, where they are
right because it is called from a trigger and a trigger does not check execute.
A policy does. **Anything used from inside a policy needs execute granted to
`authenticated`, however definer it is.**
`20260921220000_dev-dashboard.sql` was run on 2026-09-21. It adds
`profile_private.is_admin`, gives the existing `Feedback` table the columns and
the policies the dev dashboard reads, and creates `store_stats`. The one part
to read is the pair of column revokes on `is_admin`: that table's update policy
is scoped to the row and says nothing about columns, so without them every
signed-in account can make itself an admin with one PATCH.

`20260921230000_the-admin-guard-asks-who-is-asking.sql` was run on 2026-09-21.
The guard trigger in the file above asked whether the caller was
`pg_catalog.current_user`; `current_user` is a keyword rather than a function
in a schema, so the parser read it as a column on a table called `pg_catalog`
and the trigger failed on every write to the column it guards - including the
one that grants the flag. It failed closed, which is the right way round.
The same file also drops a `timezone('utc', now())` from
`admin_active_users`, which compared a `timestamp` against a `timestamptz` and
so answered differently depending on the caller's own time zone.

The flag is set by hand:

```sql
update public.profile_private set is_admin = true where user_id = '<uuid>';
```

That statement has to be run as the service role or from the SQL editor - the
guard trigger refuses it from an app connection, which is the point.
`20260922090000_a-feedback-message-has-a-status.sql` was run on 2026-09-22.
It gives a feedback message one of four states - `new`, `planned`, `fixed`,
`not_fixed` - so the dev dashboard can say what was decided about a message
rather than only that it was read. A trigger forces every new row to `new`:
the insert policy lets any signed-in account write its own row, and without it
somebody could post a suggestion already marked `fixed`. Column grants cannot
do that job, because Postgres ignores a column-level revoke when the role holds
the privilege on the table.

`20260922100000_the-note-column-leaves-the-old-exercises.sql` was run on
2026-09-22. `20260916210000` corrected `exercise_column_preferences` and stopped
there; `exercise_instance` still held 26 rows with note on. Copying a workout
clones `visible_columns` verbatim - correctly, a copy should look like what it
came from - so every copy of an old session carried the NOTE column into a
brand new exercise, and the copy became another legacy row. The fix is the
data, not the copy. The app's matching half runs under
`opt_in_visible_columns_v2`, so the device cleans its own rows once more and
both sides land on the same answer.

`20260923100000_a-set-has-a-type.sql` was run on 2026-09-24, before any phone
ran 2.2.0 - which it had to be. The app now names `set_type` and
`amrap_target` when it reads sets, and PostgREST refuses a select that names a
column which does not exist - on a project without them, every set pull fails
and no set reaches any device. It adds both columns, a check on the four
values, and backfills `set_type = 'amrap'` from the old `amrap` flag with the
same rule the app applies locally, so the two sides agree without a row being
re-uploaded. `amrap` stays as a mirror for older app versions.

`20260924090000_a-friend-can-see-a-record-was-set-today.sql` was run on
2026-09-24. It adds `workout_record_counts`, a function that tells the friends
strip how many personal records a workout it can already see holds - the
count only, never the sets - so a tile can wear a crown. Nothing depends on
it: on a project without it the app gets "function does not exist" and shows
no crowns.

`20260925100000_explore-counts-your-centres-new-records.sql` was run on
2026-09-25. It adds `gym_recent_records`, which tells Explore's "Your centre" card
how many of the centre's records - rank 1 on its leaderboard, by the
leaderboard's own rules - were set since the viewer last opened the centre,
and which one is newest. Nothing depends on it: without it the app gets
"function does not exist" and the card shows the centre without its records.

`20260925110000_a-post-knows-its-centre.sql` was run on 2026-09-25. It gives
`social_post` a `gym_id` - the centre the post's workout was done in - kept in
step with the workout by two triggers and filled in once for the posts that
exist, so a card can say where and Explore can show posts from your centres.
Without it the app shows posts without a centre and no centre posts; nothing
else changes.

`20260926090000_your-split-follows-you.sql` was run on 2026-09-25. It gives
`profile_private` a `split_names` column - the two to six sessions somebody
chose as their split on the Train tab, by name - so the choice follows them to
a new phone. Without it the choice is kept on the phone only.

`20260927090000_a-lifter-can-give-their-sex.sql`,
`20260927100000_public-profiles.sql` and
`20260927110000_a-block-hides-public-posts-too.sql` were run on 2026-09-25,
checked afterwards against what each one creates - the function, column,
trigger, constraint or policy - and the public profile against its latest
body. The first gives `profile_private` a `sex` column - private, never on a profile,
there so records can be split by sex later. The second adds `public_profile`,
the one way to read a stranger's profile: security definer, a fixed set of
fields, nothing from `profile_private`, null across a block either way; until it
runs, a profile opened from a name says it is not available. The third makes a
block hide public posts as well as followers-only ones.

`20260928090000_custom-exercises-can-be-shared.sql` was run on 2026-09-26. It
gives custom exercises a cloud half, `custom_exercise` - readable only by its
owner, private until shared - with the saved list, the reports and a daily
cache of each exercise's numbers beside it, five security definer functions
that are the only way to read somebody else's exercise, and the
`exercise-videos` bucket. Without it the library and an exercise page say they
are not available yet, and custom exercises stay on the phone.

`20260929090000_gym-scope-and-categories.sql` was run on 2026-09-26 and checked
afterwards: every Danish centre has a region, the four regions are there, all
three calisthenics movements matched the catalogue, and only signed-in users
may call the three new functions. It gives `gym` a country and a region -
Denmark's four landsdele, from the postal code - adds `gym_region` and
`private.calisthenics_event`, and the security definer functions
`gym_scope_summary`, `gym_category_cards` and `gym_category_leaderboard` behind
Centres' levels and the four category pages. The gym importer now writes the
two new columns, so it needs this to have run.

`20260930090000_store-stats-ios-daily.sql` was run on 2026-09-26: pg_cron and
pg_net were switched on in the dashboard - creating pg_cron from the SQL
editor had failed inside Supabase's own grant routine - and the job
`store-stats-ios-daily` was scheduled for 06:15 UTC every day. It POSTs to the
`store-stats` Edge Function with the address and the shared secret read from
Vault by name. What each run answered is in `net._http_response`.

```sql
select jobname, schedule, active from cron.job where jobname = 'store-stats-ios-daily';
select status_code, content from net._http_response order by created desc limit 1;
```

`20261001080000_the-admin-guard-runs-as-its-caller.sql` was run on 2026-09-26.
It makes `private.reject_self_appointed_admin` security invoker. Under security
definer `current_user` was the function's owner, so the guard on
`profile_private.is_admin` never fired, and the column revokes from
20260921220000 did not stand in for it while `authenticated` held update on
the whole table: any signed-in account could make itself admin. Who holds
the flag is worth checking now and then:
`select user_id from public.profile_private where is_admin;`.

`20261001090000_dev-kpis.sql` was run on 2026-09-26. It gives
`workout_type_instance` its `started_from`, `profile_private` the app-open
columns, `store_stats` the crash and ANR columns, adds the admin-only
`dev_metrics` and the nine admin functions behind Dev · Overblik - each checks
`is_admin` in its own body and returns only aggregates. Until it had run the
page said its numbers were not available yet, and the app left the new
columns out of what it wrote.

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
