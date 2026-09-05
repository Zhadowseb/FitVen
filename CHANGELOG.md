# Changelog

## [0.23.18] - Unreleased
### Changed
- The deletion page says how to delete part of your data without losing the account. That has always been true — a program, a workout, a set, a tracked run and its route, a sickness entry, a post can each go on their own — but the page only described deleting everything, which is the answer Play asks about separately and checks at that address.

---
## [0.23.17] - Unreleased
### Added
- `web/delete-account/`, the account deletion page Google Play requires and links to from the store page. It exists separately from the Delete account button in the app because the people most likely to need it are the ones who have already uninstalled: it names the app, needs no sign-in, and offers an email route as well as the in-app steps.
- `npm test` fails if either page Play links to is missing, or if the deletion page stops naming the app. A 404 on those is a policy violation on a page nobody using the app would notice had gone.

---
## [0.23.16] - Unreleased
### Changed
- The privacy policy and the password reset page are served from `https://fitven.dk/` instead of the netlify.app subdomain. Both hostnames answer, so nothing breaks in either direction.

### Notes
- Supabase must keep `https://fitven.netlify.app/reset-password/` on the redirect allowlist alongside the new one. Somebody on an older build who forgets their password asks the server for the old address; dropping it locks them out with no way back in.
- The Play Console listing carries the policy address and has to be updated with it.

---
## [0.23.15] - Unreleased
### Added
- `supabase/templates/` holds the auth emails — confirm signup, reset password, magic link, change email. They were only ever in the dashboard, which has no history, no review, and nothing to recover from. They still have to be pasted in by hand; the repo is the record of what was pasted.
- `npm test` fails if a template links to `{{ .RedirectTo }}` or leaves a stray quote after an `href`. Those are the two faults that were in the reset template, and neither points at itself: the stray quote makes Go's html/template refuse to render, which surfaces as "Error sending recovery email" and reads like a mail server fault, and the wrong variable produces a link with no token that the reset page reports as expired.

---
## [0.23.14] - Unreleased
### Changed
- Creating an account ends somewhere. It used to print a line of text, empty the form, and leave you on the screen you had just finished with, no way onwards. There is a panel now that says whether the address needs confirming, and a Go to login button.
- The password rule is written under the field from the start instead of appearing as an error once it has been broken.
- The top bar says Create account. It was a back arrow alone in an empty band.
- Field labels are 13 px in the text colour, helper text 12 px in the quiet one. Labels were 11 px uppercase quiet and the helper text below them was larger, which put the hierarchy upside down. Changed on the login screen too, or two screens one tap apart disagree.
- One heading, not three. "Register", "New account" and "Account details" all said the same thing above the same four fields.
- The Create account button no longer greys out until four separate rules pass. Same as the login screen: it is pressable, and pressing it marks whichever field is not right yet.

### Added
- A show/hide toggle on the password fields, matching the login screen.

---
## [0.23.13] - Unreleased
### Fixed
- The password reset page asked Supabase for the PKCE flow, which could never have worked. PKCE keeps a code verifier in the storage of whatever requested the reset — the phone — and the link is opened in a browser that has never seen it. The app does not use PKCE either, so the link arrives as a URL fragment and the page reads that instead.
- The page decided whether the link was valid by calling `getSession()` once, racing the client's own parse of the fragment. It listens for the session and falls back to a delayed check, so a valid link cannot be reported as expired.

---
## [0.23.12] - Unreleased
### Changed
- Forgot password is quiet grey with an underline instead of accent orange. It is the way out for the few people who need it, not something that should pull the eye off the field they were about to fill in.

---
## [0.23.11] - Unreleased
### Added
- Forgot password, under the Login button. It sends a link to set a new one, and says the same thing whether or not the address has an account — anything else turns the login screen into a way to ask which email addresses are registered.
- `web/reset-password/` is where that link lands. A web page rather than a screen in the app: the link has to work from whatever the person opens their mail in, on a phone that may not have FitVen on it any more, and a deep link would need the scheme registered, the app installed and the right build — three ways to leave somebody locked out of their own account.
- `npm test` fails if the reset page points at a different Supabase project or anon key than the app. Nothing else connects the two, and a mismatch would break only for people who are already locked out and cannot report it from inside the app.

### Notes
- **Supabase has to allow the address.** Authentication → URL Configuration → Redirect URLs must list `https://fitven.netlify.app/reset-password/`, or the link in the email refuses to go there.
- Untested end to end: sending a real reset email needs that allowlist entry first.

---
## [0.23.10] - Unreleased
### Changed
- The login screen had two identical orange full-width buttons stacked on each other, so nothing said which one you came here to do. Create account is an outline under a `New here?` label; Login keeps the fill.
- Three headings for two fields — a 42 px "Login", an "Account" label and a 24 px "Sign in" inside the card — are one. The card is fields.
- The Login button no longer greys out until both fields are filled. It stayed at 40% opacity with nothing saying why, which reads as broken rather than as waiting. It is always pressable and marks the fields that are empty.
- An error used to sit between the two buttons, pushing the lower one down and easy to miss. A missing field is now marked on that field, and a failed sign-in sits directly under the Login button with an icon.
- The eyebrow says "FitVen" rather than "FitVen Cloud". There is no cloud from where the user is standing.

### Added
- A show/hide toggle in the password field.
- `ThemedTextInput` takes an `action`: a control inside the field, right of the value. Separate from `suffix`, which is `pointerEvents="none"` on purpose — a unit is not something you tap, and making it tappable would swallow taps meant for the field.

---
## [0.23.9] - Unreleased
### Changed
- `PRIVACY_POLICY_URL` points at https://fitven.netlify.app/privacy/, which serves the generated page and nothing else — the repository root, `docs/` and `google-services.json` all return 404 there.
- The policy check turns from a warning into a hard failure now that a URL claims the policy is published: an unfinished section fails `npm test` outright.
- The header of `privacyPolicy.js` said the text must not ship. It says what actually has to be kept in step instead: the generated page, and the Play Console listing, which Google rejects if its minimum age or policy address disagrees with this file.

---
## [0.23.8] - Unreleased
### Added
- `npm test` fails if `netlify.toml` is missing or publishes anything other than `web/`. Widening it to the repository root would put the security review, the structure audit, the performance audit, an export query and `google-services.json` on the open internet, and nothing would have said so until somebody found them.

---
## [0.23.7] - Unreleased
### Changed
- The privacy policy is finished. The last outstanding statement, the name and postal address of the person responsible, is filled in.
- The public page moved from `docs/privacy-policy.html` to `web/privacy/index.html`, with `netlify.toml` publishing `web/` and nothing else. `docs/` holds the security review, the structure audit, the performance audit and an export query — a static host pointed at that folder would have published all of them next to the policy.

### Fixed
- A single line break inside a paragraph was collapsed by the generated page, so a four-line postal address read as one run-on line on the web while the app showed it correctly. The two copies exist to say the same thing.

### Notes
- `PRIVACY_POLICY_URL` is still empty and is the last step: host `web/`, then set it here and the same address in the Play Console listing.

---
## [0.23.6] - Unreleased
### Changed
- The privacy policy names a contact address (zhadowseb@gmail.com), states that FitVen is run by a private individual with no CVR number, and sets the minimum age at 13 — the age Danish law lets somebody consent to their own data being processed, and the lowest the app can set without a way to ask a parent.
- The section on your rights says plainly that a copy of your data is put together by hand, because there is no export button.

### Fixed
- The policy check counted the marker everywhere in the file, including the comment that explains it and the code that looks for it, so it could never have reached zero and setting `PRIVACY_POLICY_URL` would have failed forever. It counts unfinished sections now.
- A placeholder that named what was missing — `[SKAL UDFYLDES: postadresse]` — read as finished, because the check matched the closing bracket too. It matches the opening.

### Notes
- One statement is left: the full name and postal address of the person responsible. A private individual has to be reachable at a real address, and it will be public on the hosted page.

---
## [0.23.5] - Unreleased
### Added
- `docs/privacy-policy.html`, the public copy Google Play requires, generated from the same file the in-app screen reads. `npm test` fails if it drifts — two hand-maintained copies of a legal document end with nobody able to say which one a user agreed to.

### Changed
- Five of the eight unwritten sections in the privacy policy are filled in from what the code actually does: the third parties (Supabase, Expo, Google Maps, and nothing else — no analytics, no advertising, no crash reporting), that the map request tells Google roughly where a run happened, that there are no backups today, that the dashboard gives direct access to the database, and the one-month deadline for answering a request.

### Notes
- Three statements are still outstanding and are decisions rather than facts about the code: who the data controller is, the contact address for data requests, and the minimum age.

---
## [0.23.4] - Unreleased
### Security
- The sign-in session moved from AsyncStorage to `expo-secure-store`, behind the Android Keystore and the iOS Keychain. What was sitting there in the clear is a refresh token — a working key to the account until it rotates — in a file that is readable on a rooted phone and in a full-device backup.
- **Everyone is signed out once by this update and has to enter their password again.** That is the point rather than a side effect: the old tokens have been readable on disk, so they are treated as spent, and the plaintext copy is deleted on first launch instead of being carried across.

### Added
- `scripts/test-secure-session-storage.js`. Secure storage holds small values — over 2048 bytes may not store at all on Android — and a session is several times that, so it is split across numbered entries. The test drives that against a fake store that enforces the real key charset and byte ceiling: round trips at the chunk boundaries, multi-byte characters, a session that shrinks, one that has lost a piece, and a device with no keystore.
- `loadAppModule.stubModule`, so a test can hand a module a fake package instead of the throwing stub. That is what made the storage adapter testable at all.

### Notes
- If secure storage is unavailable on a device, the session falls back to the old unencrypted storage with a warning rather than failing to sign in.

---
## [0.23.3] - Unreleased
### Security
- `refresh_sync_local_watchers_count` was a callable REST endpoint that took the user id as a parameter and ran without a fixed `search_path`. It is only ever used by a trigger, so it moved to the `private` schema and the endpoint is gone rather than hardened. Row-level security had kept it from touching another user's rows, so nothing was exposed by it.
- A new account no longer takes its public username and display name from the part of the email address before the @. For most people that is their real name, published to every user of the app, from a field they only entered in order to sign in. Existing names are left alone — silently renaming live accounts is worse — and the migration carries the query for finding them.

### Fixed
- Claiming a username tag went through the database's own allocator instead of the client picking one. The client used to read every profile sharing the base and pick a code that was not among them; 0.23.0 stopped profiles answering to strangers, so that read came back empty and the check became a guess. The database has done this under an advisory lock all along.

### Notes
- Requires `supabase/migrations/20260905190000_rpc-hardening.sql`, which has to be run together with `20260905143000_user-blocks.sql`.

---
## [0.23.2] - Unreleased
### Added
- A privacy policy screen, reachable from the profile and from the register screen, and a consent gate that stands in front of the app until the current version has been accepted. Which version was accepted, and when, is stored — a boolean would not survive the policy text changing.
- `scripts/check-privacy-policy.js` in `npm test`. It prints a loud warning while the policy is a draft, and fails outright once `PRIVACY_POLICY_URL` is filled in but placeholders remain, so a published policy cannot keep them.

### Notes
- **The policy text is a skeleton and must not ship as it stands.** Eight statements in `src/Resources/Legal/privacyPolicy.js` are marked `[SKAL UDFYLDES]` and are legal facts nobody but the controller can supply: who is responsible, the contact address, third parties that receive data, retention after backups, and the minimum age.
- Google Play separately requires the policy at a public URL. `PRIVACY_POLICY_URL` is empty.
- Requires `supabase/migrations/20260905174500_privacy-consent.sql`. Without it the gate fails open and nobody is asked, which means no consent is being collected at all.
- The gate also fails open on a network error. Being locked out of your own training data because Supabase is unreachable is the worse failure.

---
## [0.23.1] - Unreleased
### Added
- Delete account, at the bottom of the account card in your profile. It removes your programs, workouts, records, posts, follows, notifications, profile and photo from the cloud, deletes the sign-in itself, and removes this phone's copy of the database. You type DELETE to confirm; there is no undo and no grace period.

### Notes
- Requires `supabase/migrations/20260905161500_delete-account.sql` **and** the `delete-account` Edge Function deployed. Without both, the button fails with a function error and nothing is removed.
- The tables to erase are discovered from the schema, not listed in the code: every table in `public` with a column that names a user. A table added later is covered without anyone remembering to add it. If a foreign key still refuses after three passes the function raises, so a half-erased account reports as a failure rather than a success.

---
## [0.23.0] - Unreleased
### Added
- You can block someone. Tap followers or following on the social page, then Block on their row; Blocked accounts at the bottom of that list is where you undo it. A block removes the follow in both directions, stops them following you again, and takes you out of each other's search results. They are not told.

### Security
- The follow graph was readable in full by any signed-in user. `user_follows` now only answers for rows you are part of.
- The profile table was readable in full, so a client could list the entire user base with one request. Reading a profile now needs a relationship — yours, someone you follow, or someone who follows you — and finding a stranger goes through a search function that caps the result set and hides blocked people.
- User search needs at least two characters. Under that, the old query returned every account in the app in name order, which is the enumeration this closes.
- `profiles` had no DELETE policy, so a user could not remove their own row. Needed for account deletion, and wrong without it.

### Notes
- Requires `supabase/migrations/20260905143000_user-blocks.sql`. Until it is run, user search fails with a message saying so.

---
## [0.22.6] - Unreleased
### Added
- `scripts/check-undeclared.js`, run as part of `npm test`: Babel's own scope analysis over all 310 source files, reporting any name a file uses but never declares or imports. There is no linter and no type checking here, so those failed at runtime, only on the code path that used them.
- `scripts/test-run-display-utils.js`, the first automated coverage the run screen has had: pace and clock formatting, section counts and labels, route splitting and thinning, and the two chart path builders.

### Changed
- `Run.js` drops from 5,172 lines to 4,502. The pure maths moved beside it into `runDisplayUtils.js`, `runFormatUtils.js`, `runEnduranceStats.js` and `runFlowOptions.js`, and `DraggablePriorityRow` into its own component folder. The GPS and Bluetooth hooks stay in the screen; they are wired into its state and cannot move without a device to test against.

### Fixed
- `programService.js` lost its `workoutService` import when the sync engine was split in 0.22.4. Four calls in it would have thrown as soon as a workout hierarchy was refreshed.
- `HeartRateDeviceModal.js` used `StyleSheet.absoluteFill` after its `StyleSheet` import was removed.
- The workout library's option sheet read a colour that is declared in the screen below it, and would have crashed when opened.
- An exercise row measured its layout into a handler that was never written, and drew a wrap arrow from an index that was never computed. Both dated back to the row's introduction and are removed.

---
## [0.22.5] - Unreleased
### Added
- `SYNCED_FIELDS` in `src/Services/cloudSync/cloudSyncFields.js`: one row per synced column, with the snapshot, the comparison and the cloud payload all derived from it. Adding a field to a synced table is now one row instead of three edits that have to agree.
- `scripts/test-cloud-sync-fields.js`, the first automated coverage the sync engine has had. It fails if a field is compared but never uploaded, compared but missing from the snapshot, or not stable under a second normalisation.
- `scripts/lib/loadAppModule.js`, which compiles a real application module through the project's own Babel setup so a test can exercise it. The existing scripts could only read a file as text, which is why anything with an import had no coverage.

### Fixed
- A workout's `timer_start` and `original_start_time` are normalised differently for the comparison and for the upload. The asymmetry is preserved and now documented rather than hidden in two separate function bodies.

---
## [0.22.4] - Unreleased
### Changed
- The cloud sync engine moved out of `programService.js` into `src/Services/cloudSync/`, one module per entity over a shared base. `programService.js` drops from 7,424 lines to 2,164, and the largest sync module is 601. Everything is re-exported, so no caller changed.

---
## [0.22.3] - Unreleased
### Added
- Path aliases `@contexts`, `@database`, `@repository`, `@resources`, `@services` and `@utils`, defined in `babel.config.js` and mirrored in `tsconfig.json`.
- `npm test` now resolves aliased imports too, catches an alias that is neither a package nor defined, and fails if the babel and tsconfig maps disagree.

### Changed
- The five files in the exercise row tree, which had the deepest imports in the project at eight and nine levels of `../`, use aliases. The remaining 149 deep imports were left alone on purpose.

---
## [0.22.2] - Unreleased
### Changed
- The 19 cloud schema files moved from loose `docs/*.sql` into `supabase/migrations/`, timestamped so they carry the order they were applied in.
- `supabase/migrations/README.md` records which migrations have been run. `npm test` fails if a migration is not in that table, so the ledger cannot fall behind.

### Fixed
- `docs/export-user-programs.sql` had a real user's UUID committed in it. It takes a placeholder now.

---
## [0.22.1] - Unreleased
### Added
- `scripts/check-imports.js`, which resolves every relative import with the exact casing on disk and runs as part of `npm test`. Windows is case-insensitive and Android is not, so a wrong-case path used to work locally and fail only in a build.

### Changed
- `PickWorkoutModal` moved from five levels down inside `WeekPage` to `Resources/Components/`. It is used by the microcycle screen, so a cleanup of the "unused" WeekPage folder would have taken a live screen with it.
- The background GPS task moved out of `App.js` into `Services/locationBackgroundTask.js`. `App.js` drops from 487 to 382 lines.
- The muscle mask folders are `MuscleMasks`, matching every other folder in the project.

### Fixed
- The pick-a-workout dialog referenced two style keys that were never defined and coloured a completed workout with a hardcoded green that ignored the theme.

---
## [0.22.0] - Unreleased
### Added
- `npm test` — one command that runs every check, including a new drift check over the agent guides.
- `scripts/check-agent-docs.js`, which fails when a guide names a path that no longer exists, tells you to run a script that is gone, or promises an invariant the code has stopped holding.
- `src/Services/AGENTS.md` with the checklist for adding a field to a synced table, and `src/Sync/AGENTS.md` with the table of which sync components actually run.
- A `scrimSoft` colour token for a tap-catcher that dims rather than darkens.

### Changed
- Thirteen files no longer import a service under a repository's name. 45 function names exist in both layers with the same signature, so the alias sent readers to the wrong file.
- The agent guides now cover what the code depends on and cannot be read from it: the sync field checklist, the two schema files, the theming rule, the layering, and what the five names for "exercise" mean.
- README no longer reproduces the folder tree, no longer claims the app has no backend, and no longer says WeekPage is unused without mentioning that a live screen depends on a component inside it.

---
## [0.21.12] - 2026-09-05
### Security
- Profile pictures are read through short-lived signed URLs instead of permanent public links, so an avatar can no longer be collected once and kept, and deleting one actually takes it away. Requires `docs/supabase-avatar-private-bucket.sql` and, once this version has shipped, the `avatars` bucket set to Private.

### Changed
- The three copies of the avatar URL builder are one shared module that signs a whole list in a single request and caches the result.

---
## [0.21.11] - Released with 0.21.12
### Security
- `console.log`, `.info` and `.debug` are stripped from production bundles. `error` and `warn` stay.
- `LocationDebugLog` is gone. It kept every GPS point the tracker saw, accepted or rejected, with speed and accuracy and no cleanup — a home address sitting unencrypted on the device forever. Existing installs drop the table on the next launch.
- Feedback no longer sends the device's brand, model and OS version.
- Only the birth year is stored. `docs/supabase-birth-year-only.sql` truncates the rows written before this.
- The user search filter allows a known-good set of characters instead of removing a known-bad one.

---
## [0.21.10] - Released with 0.21.12
### Security
- A workout start notification now takes its text from the stored workout row, not from the caller's request, so a sender can no longer put their own wording on every follower's lock screen. A label is capped at 40 characters and stripped to a charset that cannot form a link, and a workout type has to exist in the catalog.
- The notification function is rate limited to 12 events per account per hour.
- The deduplication key is now the database's own row id, or the sender's own id plus their workout id when the row has not synced yet, so nobody can register a key ahead of somebody else and swallow their notification.
- The webhook secret is compared in constant time.
- Registering a push token no longer switches off another account's row on demand. The token is only released once the other account has gone quiet for seven days; until then the new device is registered but left disabled.

---
## [0.21.9] - Released with 0.21.12
### Security
- Removed the one-time program import, which carried a named user's email address, Supabase user id and full training history in the app bundle of every installation.

### Added
- `docs/SIKKERHED-DINE-OPGAVER.md`, the steps for the parts of the security review that live in the Supabase and Google dashboards.

---
## [0.21.8] - Released with 0.21.12
### Removed
- The five unmounted sync components for programs, blocks, weeks, days and exercise instances. `SetSync` already pushes that whole hierarchy in parent-first order, which is what the sync rules now ask for.

### Changed
- The workout-label icon list says which of its icons are placeholders for workout types still to come, so a dead-code sweep does not offer to delete them again.

---
## [0.21.7] - Released with 0.21.12
### Added
- `ThemedText` takes a `type` naming a step on the typography scale, the way `ThemedTitle` already does, plus an `overline` step for the small uppercase label above a page or section title. Existing call sites are untouched.
- `Services/authService`, so the login, register and profile screens no longer reach into `src/Database` directly.

### Changed
- The `rm_list` folder and its two files are PascalCase like the rest of the codebase.
- The padlock and chat-bubble icons moved from the profile screen's own folder into the shared `UI-icons`.
- Five components had their inline `StyleSheet.create` moved to a sibling `Style.js`, matching the other 53 screens.

### Removed
- 16 files nothing imported, including two whole components whose only caller was itself dead.

---
## [0.21.6] - Released with 0.21.12
### Changed
- The last 71 raw `Text` elements are now `ThemedText`, so a line without an explicit colour falls back to the theme's text colour instead of the platform default.

---
## [0.21.5] - Released with 0.21.12
### Changed
- `ThemedCard` is a surface only. It used to bake in 10 px of margin and padding, which every single call site then had to undo, so 69 reset declarations are gone with it.
- `ThemedButton` passes unknown props through to its `Pressable`, so `accessibilityLabel`, `testID` and `onLongPress` reach it, and it announces itself as a button by default.

### Removed
- 93 dead colour fallbacks. Every one sat behind a token that is always defined, and most held a pre-redesign colour — `#f7742e`, `#60daac`, `#0E0F12`, `#ba0000ff` — that read as a valid value to anyone editing the line. Fourteen of them fell back to the dark palette, which would have been the wrong scheme in the light theme.

---
## [0.21.4] - Released with 0.21.12
### Fixed
- The set summary under an exercise no longer draws white on white in the light theme: the compact table's surface, its gridlines, the set bubbles' borders and the connector between them now come from the palette.
- The set cell's status tints are derived from the status colours themselves, so they follow the accent theme.
- The run screen's start button shadow followed a fixed orange under every accent; it now follows the accent.
- Seven bottom-sheet headings used a near-black divider from the pre-redesign palette, which read as a hard black line in the light theme. They use the hairline token now.
- The heart-rate marker ring and the endurance progress track no longer use a fixed white and grey.
- The exercise dropdown's border was a fixed light grey.

### Removed
- 67 style keys nothing referenced, across 13 style files, most of them left behind by the redesign.

---
## [0.21.3] - Released with 0.21.12
### Added
- `ThemedStateBlock`, one component for a screen's loading, empty and error state. Thirteen screens used to spell it out by hand.
- `ThemedSegmentedControl`, which takes any number of options, replacing the two-option `ThemedSegmentedToggle` that had no call sites. The appearance setting is its first user.

### Removed
- `ThemedSegmentedToggle`, `ThemedWorkoutModal` (a pass-through wrapper around `ThemedModal`) and `AppearanceSegmentedControl`, plus 30 style keys the state blocks no longer need.

### Changed
- The appearance segments now carry a 44 px touch target through hitSlop, without the row getting taller.

---
## [0.21.2] - Released with 0.21.12
### Added
- `ThemedSheetHandle`, one grab handle for every bottom sheet. Eight sheets drew their own across three sizes, four radii and seven colours, four of which were hardcoded white and invisible in the light theme.

### Fixed
- The exercise filter sheet and the exercise library no longer tint their selected chips and cards Ember orange regardless of the chosen accent theme; the same applies to the library's green highlights.
- Both sheet palettes fell back to the dark palette when a token was missing, which would have been the wrong scheme in the light theme.
- The accent now reads as text through `primaryText` and as a fill through `primary` in the start-workout sheet and the filter sheet, instead of one colour doing both.

### Changed
- The start-workout sheet and the exercise filter sheet build their styles from the theme directly; the intermediate colour-alias object each of them carried is gone.

---
## [0.21.1] - Released with 0.21.12
### Changed
- The relative timestamp on the feed card and the notification list now comes from one `formatTimeAgo` in `Utils/dateUtils`, in place of two identical copies.
- Number display formatting is now one `formatDisplayNumber` in `Utils/numberUtils`, shared by the RM list, the estimated-set dialogs, the 1RM calculator and the program service. The program service no longer throws on a missing value; it shows the same placeholder as the screens do.
- The suggested program-best weight is now one helper in `Utils/oneRepMaxUtils` instead of a copy in each estimated-set dialog.
- The heart-rate zone colours now come from `Utils/heartRateUtils` through a shared 1-based accessor, in place of a colour map of its own in the run screen and the run set list.
- The four local `colorWithAlpha` helpers are gone; every caller uses `withAlpha` from the colour tokens.

---
## [0.21.0] - Released with 0.21.12
### Added
- Colour tokens for the surfaces that components used to build with a light/dark ternary of their own: table surfaces, gridlines and alternating rows, the record highlight, three neutral overlays, the ink on a danger fill and the two scrim strengths.
- `Spacing`, `Radius` and `Elevation` constants in `GlobalStyling/spacing.js`, for new code and for files another change touches anyway.

### Removed
- Seven palette tokens nothing referenced: `third`, `textMuted`, `plannedLight`, `libraryMetricBackground` and the `NOT_STARTED`/`ACTIVE`/`COMPLETE` status aliases, the last two also from all four accent themes.

---
## [0.20.0] - Released with 0.21.12
### Changed
- Every gesture on a calendar day now opens one day sheet, which holds the day's workouts, its programs and the add, copy and delete actions.
- Calendar month cells now carry the date plus one coloured dot per workout instead of icon cards, the today/sick stamp and the program dot.
- Calendar month cells now show the program span through the date number's colour, in place of the removed program dot.
- Calendar load failures now use the same error pattern as the notification screen: a heading, the explanation and a Try again action.
- Merged the calendar's workout-count pill into the month title's subtext, dropped the header spinner and gave the month arrows a 44 px touch target.
- The workout library's sort and type panels now use the app's shared bottom sheet instead of a panel of their own.
- The workout library's filter pills now read exactly like the option they select, so "Newest first" is no longer shortened to "Newest".
- An empty filter result in the workout library now offers a Reset filters action, and an empty library says so instead of blaming the filters.
- The workout calendar now has the app's standard header with a back arrow.
- Pickers now carry a downward chevron, so a field that opens a list no longer looks like a link onwards.
- Personal records now uses four text sizes, with the record value set well above its label.
- Personal records now shows an en dash for missing values in number columns, explained in a footnote under the table.
- Replaced the personal-record Hide empty / Show all button with a switch labelled Hide empty rep ranges.
- The notification screen now has a single title, Notifications, matching the settings screen, and readable timestamps.
- A failed program load now shows a heading, the reason and a Try again action instead of only reaching the console.
- The program list can now be pulled down to refresh.
- Reworded the No notifications option to describe the setting rather than sell it.
- Renamed the Custom notification option to Pick specific people, and the chosen people now appear as removable chips instead of only a count.
- Lifted the notification settings group labels to 12 px so they are no longer smaller than the body text they head.
- Followers and following on the social screen are now full 44 px buttons on their own row below the activity rail, instead of 30 px chips beside the heading.
- Secondary buttons are now outlined with text-coloured labels, so a Cancel or Close no longer reads as the screen's main action. The filled green fill moved to a new success variant, used by Start workout.
- Renamed the social screen's Stories section to Today's activity, which is what it shows.
- Following now reads as a state with a checkmark, and unfollowing asks for confirmation first.
- Shortened the Find Friends search placeholder, and split its two empty states so the search case repeats the term that found nothing.
- Every page-header eyebrow is now 12 px, so the label above a page title is no longer smaller than the body text on the page.
- The sickness log now shows its history first, with New sickness period as a fixed footer button in the app's primary colour.
- The sickness log uses the app's shared page header and its spinner for loading, and names the flow the same way in the button and the dialog.
- No text on the workout-types screen is under 11 px any more; the 7 px Available label is now just its check icon.
- The exercise-card layout options now preview themselves with the real renderers instead of describing the result in a sentence.
- Split the max heart rate dialog into how it is worked out and a manual value that only appears when it has a part to play.
- Both social post settings screens now open with a line saying what the settings cover, so the two are no longer indistinguishable.
- The posting modes now show a sample of the post a reader would see, instead of describing it.
- Visibility choices are now bare labels with one explanation under the group.
- The 1RM calculator now opens on its two fields; the formula explanation moved below the result, and the units sit inside the fields.
- The 1RM result now appears above the calculate button, and calculating closes the keyboard that used to cover it.
- ThemedTextInput takes a suffix, for a unit shown inside the field to the right of the value.
- Editing a post note now opens a panel over the post instead of a whole screen, so the post stays visible while writing. The SocialPostEditPage screen and its route are gone.
- No text outside the run screens is under 11 px any more, and the app's text sizes are down from 33 values to 12.
- The muted grey used for labels and metadata is now #868C99, which clears 4.5:1 in dark mode where the old #676B76 sat at 3.4:1.
- Added a primaryText accent token, darkened in light mode, and pointed all 95 accent text and icon usages at it; fills keep primary.
- Corner radii for rectangular shapes now snap to a 2/6/10/14/18/22 ladder; circles and pills keep their derived radius.
- The programs and program overview screens now use the shared header, leaving no page with a top bar of its own.
- Touch targets: 25 standalone icon buttons grew to at least 40 px, and the ones in dense rows gained a hit area instead.
- The week overview now has all four states: loading, a failure with Try again, an empty week, and pull to refresh.
- Deleted two stale copies of the colour palette (GlobalStyling/theme.js and spacing.js), neither of which was imported.
- The block screen's weeks are now one grid with a shared, sticky weekday header instead of a card per week, and a day with several workouts shows a count with a dot each and opens them in a dropdown anchored to its cell.
- Each week in the block grid now opens with a filled band and shows a date above every day, so the weeks read as separate groups and each day says which date it is.
- The workout calendar keeps its month grid and lists the month's weeks underneath it in the week-grid style; each month is one page that scrolls as a whole, and the month name and the month arrows live in the header.
- The week lines dropped their workout counter, the date range moved to the right in its place, and a day with no workout shows its date faintly inside the cell.
- The month calendar's workout dots are now 3 px and sit inside the date badge, and the date is 15 px rather than 17.
- The week list under the calendar dropped its week headings: it is now the same grid as the month above it, read the other way round, with the workouts in the cells.
- The month grid now uses the same seven-column geometry as the week grid under it, so the two line up and the gaps between days are even.
- The calendar has a layout pill beside the month heading: Block keeps the two grids, and the new Week layout shows one week as a row per day, with every workout its own tile. In Week the swipe moves a week at a time, and the month follows the week on show, so switching back to Block lands on that week's month.

### Fixed
- Saving a workout-start notification mode no longer rolls the choice back when this device cannot register for push notifications; the preference is already stored, and the screen now says the device may not receive pushes yet.
- The manage-push-token function now answers with the underlying error and its Postgres code instead of an opaque 500, and the client reads that body into the thrown error.
---
## [0.19.1] - Released with 0.21.12
### Changed
- Finish on a strength-workout timer now atomically marks the workout complete, even when planned exercises or sets remain unfinished.
---
## [0.18.12] - Released with 0.21.12
### Changed
- Removed the redundant completed-workout message panel from the home card.
- Show the next planned workout in place of the completed-workout summary action.
- Open the completed workout when tapping anywhere on its home card.

---
## [0.18.11] - Released with 0.21.12
### Changed
- Moved exercise card display settings to Settings > Workout Types > Strength Training.
- Persisted the selected collapsed exercise card view on the device.
- Added standard, compact, and progress-only collapsed exercise card views with a preview.
- Reduced spacing between exercise names and collapsed set summaries.
- Added a Sets toolbar toggle; set summaries are hidden by default and can be shown on demand.
- Moved the expand arrow next to the progress dots and aligned the dots with the exercise title.
- Added a clearer outline to pending set progress dots.
- Added a selectable classic collapsed exercise card layout with the previous rounded set bubbles.
- Tightened vertical alignment inside classic set bubbles.
- Added mandatory branch, version, changelog, and validation preflight checks to the repository guide.

---
## [0.19.0] - Released with 0.21.12
### Added
- Added direct Bluetooth Low Energy pairing for Garmin HRM-Pro and other standard heart-rate monitors.
- Added a remembered heart-rate sensor, automatic workout reconnection, live BPM and heart-rate zone display.
- Feed live heart-rate measurements into run metrics and the existing actual-versus-planned heart-rate charts.
- Added Android nearby-device and iOS Bluetooth configuration through the Expo BLE plugin.

### Changed
- Show a distinct completed-workout card on the home page, with finished time, duration, summary access, and the next planned workout.

---
## [0.18.10] - Released with 0.21.12
### Changed
- Rename the front-page workout action from "Start workout" to "Open workout" to make it clear that the workout opens before it begins.
- Mark the active auto-advance target directly on each Speed & Structure interval and allow Time, Distance, or Automatic selection from the set options.
- Count workouts on past sickness-marked days as completed in program, block, and home progress displays, without changing `Day.done` or its sync state.
- Let Speed & Structure intervals with a distance but no TIME field progress from GPS distance instead of being skipped. When the target is reached, save and show the actual time, distance, and pace without replacing the planned pace.
- Improve Run and Walk distance tracking for phones carried in pockets by accepting moderately degraded GPS accuracy and retaining plausible segments across short background-delivery gaps.
- Populate `LocationDebugLog` when a tracked workout pauses or finishes, including per-point acceptance decisions and rejection reasons for easier device-specific GPS troubleshooting.
- Redesign the Add exercise workout picker with a custom header, body-map exercise rows, primary/secondary muscle labels, a custom-exercise footer, and an exercise detail popup with muscle-group chips and an add action.
- Add an exercise filter bottom sheet with training focus, grouped muscle filters, built-in/custom type filtering, live result counts, and filter badges for both picker and catalog views.
- Redesign the Start workout sheet so planned workouts, fresh starts, and repeated workouts have distinct visual treatments, with dashed plus cards for new workouts and solid replay rows for copied workouts.

---
## [0.18.9] - Released with 0.21.12
### Changed
- Fix the crash when opening a completed Run or Walk workout on Android by configuring the Google Maps Android API key and only mounting the route map when the key is available, with a clear fallback card otherwise.
- Stop losing GPS points during Run and Walk tracking: the background location task now keeps one cached database connection with a busy timeout and writes each GPS batch in a single retried transaction instead of opening, migrating, and closing a new connection per batch.
- Recover automatically when the OS silently stops background location delivery while the phone is locked: returning to a live workout with stale tracking restarts the location provider.
- Harden route-map helpers for long workouts (no argument-spread over thousands of points, clamped map regions, simplified polylines) and remove the duplicated iOS location background mode.

---
## [0.18.8] - Released with 0.21.12
### Changed
- Add the first Walk workout draft with direct GPS tracking, timer controls, distance, pace, heart-rate zones, and completed-workout insights.
- Register Walk as an active local and Supabase workout type.
- Show Walk as a Start fresh option and recognize it in planned and recent workout cards.

---
## [0.18.7] - Released with 0.21.12
### Changed
- Add planned-set and progress cards for the single main Endurance & Base set, including duration, pace, zone, distance, and completion progress.
- Add a persisted drag-and-drop priority list for populated Endurance & Base plan stats.
- Open Custom runs directly on a graph-free workout dashboard with a manual start, live pace metrics, and a transparent, swipeable close-up view of colored heart-rate zones with BPM boundary labels.
- Follow the live pulse in the Custom heart-rate viewport until the user swipes, then preserve manual browsing with a fixed pulse dot and a Recenter action.
- Place the Custom run controls inside the upper metrics card.
- Hide the Workout plan heading and section from completed Custom and legacy blank runs.
- Correct the shared heart-rate boundaries so zone 2 spans 66–81% HRmax and is wider than zone 3 at 82–89% HRmax.
- Keep Endurance & Base plans continuous by omitting automatic rest rows from their workflow.

---
## [0.18.6] - Released with 0.21.12
### Changed
- Remove dashed grid lines from the Run completion charts.

---
## [0.18.5] - Released with 0.21.12
### Changed
- Add selectable max-heart-rate sources and calculate Run chart zones from the resolved profile value.

---
## [0.18.4] - Released with 0.21.12
### Changed
- Keep public profiles and social circles available when private profile settings are missing or using an older Supabase schema cache.
- Stabilize the birth date wheel so drag and momentum events cannot fight over the selected value.

---
## [0.18.3] - Released with 0.21.12
### Changed
- Simplify the completed Run summary and use the secondary color for its border and distance.

---
## [0.18.2] - Released with 0.21.12
### Changed
- Add shared private birth date and max heart rate settings to Public profile and Run settings, including calculated, manual, and measured max-pulse sources.

---
## [0.18.1] - Released with 0.21.12
### Changed
- Add a Workout Types entry under Personal settings with Strength Training and Run, and move Exercises under Strength Training.

---
## [0.18.0] - Released with 0.21.12
### Changed
- Add a fresh-run workout selection flow with persisted run focus choices and Endurance & base, Speed & Structure, Performance & Threshold, and Custom cards.
- Hide empty Speed & Structure warmup and cooldown sections from the run plan once the run starts.
- Add a focused Speed & Structure run timer with active action countdown, live pace, interval count, segment distance, and total progress.
- Show Run workout progress through Plan, Active, and Done stages with a tubelight-style indicator above the timer header.
- Allow tapping the Run workout status indicator to preview Plan, Active, and Done states while testing.
- Move the selected run focus into a centered title above the timer header and simplify the active timer heading.
- Show the Run plan mode start action outside the timer card and style the selected run focus as a centered badge.
- Use the global fields surface color for Run status and focus badge backgrounds.
- Use the global fields surface color for Run warmup and cooldown field controls.
- Automatically add a rest row before new Run interval sets when the previous interval row is not already a rest.
- Delete Run sets directly from the edit sheet without a confirmation alert.

---
## [0.17.35] - Released with 0.21.12
### Changed
- Add a weekly muscle load chart to Personal Records with program selection.

---
## [0.17.34] - Released with 0.21.12
### Changed
- Ask for confirmation before deleting strength sets, strength exercises, run sets, estimated 1RMs, calendar workouts, and before restarting workouts.

---
## [0.17.33] - Released
### Changed
- Auto-classify resistance workout labels from exercise muscle metadata and set volume.
- Speed up Workout Calendar by loading the visible month from local data before cloud sync and prefetching adjacent months afterward.
- Keep Workout Calendar swipe paging to one month at a time while recentering the pager.
- Add calendar database indexes for workout, day, sickness, exercise, and set lookups.
- Replace the registration username placeholder with a neutral example.
- Ask for confirmation before deleting mesocycles, weeks, and workouts from program and workout screens.

---
## [0.17.32] - Released
### Changed
- Redesign the week copy target picker with focused block, week, and day selection, and mark copied weeks with the primary label.

---
## [0.17.31] - Released
### Changed
- Move program import into the Program options menu and remove the standalone import action from the page body.

---
## [0.17.30] - Released
### Changed
- Add a block-level week call to action for adding new program weeks from the Program Overview flow.

---
## [0.17.29] - Released
### Changed
- Send workout-start notifications immediately when workouts start and manage push-token ownership through the `manage-push-token` Edge Function.

---
## [0.17.28] - Released
### Changed
- Ask before adding a standalone workout copy to a program day, while program workout copies automatically use a matching program day or fall back to the workout calendar.
- Add workout copy actions to the Workout Calendar day menu.
- Use field surfaces and focused Block/Week placement text in workout copy prompts, with standalone copies labeled as single workouts.
- Redesign workout copy conflicts as a Date Conflict decision modal with selectable program and standalone cards.

---
## [0.17.27] - Released
### Changed
- Open notification history when a push notification is tapped.
- Keep notification history unread until the user opens it from the Home bell.

---
## [0.17.26] - Released
### Changed
- Add a drawn-tab style indicator around the Rest set header to show it can be tapped.

---
## [0.17.25] - Released
### Changed
- Simplify the Profile About section to show only the FitVen app name and configured app version.

---
## [0.17.24] - Released
### Changed
- Add an About section at the bottom of Profile with app version, build, runtime, and platform details.

---
## [0.17.23] - Released
### Changed
- Add program export/import using FitApp program JSON files, including program structure, workouts, exercises, sets, run rows, estimated 1RMs, and program display settings.

---
## [0.17.22] - Released
### Changed
- Move set rest into an editable overlay pill inside the existing Rest column, tied to the previous set without adding spacing between sets.
- Default rest editing to minutes.
- Add a Rest modal mirror option so editing one rest value can update every set's rest value in the exercise.
- Use the field surface color for Rest modal setting backgrounds.
- Start a rest countdown from the completed set's rest value, including the final set, while the workout is running, and show it in the rest field and active workout menu circle; the rest field border turns primary while counting down and secondary when complete.

---
## [0.17.21] - Released
### Changed
- Move the expanded exercise history action back to the top-right of the exercise card.

---
## [0.17.20] - Released
### Changed
- Add a rest title unit picker for switching set rest entry between minutes and seconds.

---
## [0.17.19] - Released
### Changed
- Use the secondary color treatment for the paused run finish button and match its height to the continue button.

---
## [0.17.18] - Released
### Fixed
- Keep block week counts in sync when deleting a week so later added weeks use the next correct date.

---
## [0.17.17] - Released
### Changed
- Add an auto-push post-commit hook for work branches and document the commit-to-cloud workflow.

---
## [0.17.16] - Released
### Changed
- Add paginated "See all" loading for recent workouts in the quick start sheet.

---
## [0.17.15] - Released
### Changed
- Redesign the program overview header and streamline its stats.
- Create programs as drafts or start them immediately, with draft scheduling
  available from the overview header for both past and future weeks.
- Link the Today shortcut directly to the active program overview.
- Add a Train shortcut and manual estimated 1RM calculator using the existing
  Brzycki formula.
- Base program progress on completed workouts instead of elapsed calendar time.
- Match the Today workout shortcut border to its workout status color.
- Emphasize the Today schedule divider with the primary color.
- Use the primary color for the Home notification bell.

---
## [0.17.14] - Released
### Fixed
- Highlight incomplete workout totals on completed program cards.

---
## [0.17.13] - Released
### Fixed
- Keep valid run distance segments when locked phones deliver background locations less frequently.

---
## [0.17.12] - Released
### Changed
- Redesign program cards as image-backed covers with workout-type badges, schedule details, and progress.
- Use the Resistance Training cover image for programs containing resistance workouts.
- Use the Run cover image for running programs and split mixed-program covers into equal vertical sections.
- Add a soft white edge glow and deep drop shadow to program covers.
- Color completed program-card borders and glows with secondary, highlight cards active on today's date with primary, and stamp completed covers.
- Stamp active program covers and use the default workout-type image when a program has no workouts.
- Calculate program-card progress and completion solely from elapsed calendar days, independent of completed workouts.

---
## [0.17.11] - Released
### Changed
- Reorder the bottom navigation to place Home on the right beside Train.

---
## [0.17.10] - 2026-06-10
### Changed
- Open a durable notification history from the Home bell and store workout-start activity even when push delivery is unavailable.
- Reflect a currently running workout timer in the global center navigation button and reopen that workout when pressed.
- Use the shared fields theme color for Profile fields, actions, empty profile pictures, and expanded notification settings.

---
## [0.17.9] - Released with 0.17.10
### Changed
- Redesigned the empty workout card and replaced legacy add-workout modals with the shared workout starter.
- Add a one-tap first-set action to collapsed Resistance exercises with no sets.

---
## [0.17.8] - Released with 0.17.10
### Changed
- Refined collapsed and expanded resistance exercise cards, set summaries, and exercise actions.

---
## [0.17.7] - Released with 0.17.10
### Changed
- Apply the third accent color to Profile inputs and settings actions.

---
## [0.17.6] - Released with 0.17.10
### Changed
- Let users choose between multiple workouts planned for today from Home and the workout starter.
- Copy recent workouts into a fresh standalone workout with complete exercises and sets.

---
## [0.17.5] - Released with 0.17.10
### Changed
- Use English labels and descriptions for workout summary post visibility settings.

---
## [0.17.4] - Released with 0.17.10
### Changed
- Replace the empty home workout state with a ready-to-train card and Quick Start action.

---
## [0.17.3] - Released with 0.17.10
### Changed
- Show a ring loader while home social circle data is loading.

---
## [0.17.2] - Released with 0.17.10
### Changed
- Add workout-start notification preferences with custom followed-user selection.

---
## [0.17.1] - Released with 0.17.10
### Changed
- Move social user search to its own page opened from the Find Friends card.

---
## [0.17.0] - Released with 0.17.10
### Changed
- Add Expo notification dependencies and push token registration scaffolding.
- Add Supabase SQL for storing authenticated users' Expo push tokens.
- Add a workout-start Edge Function for sending Expo push notifications to followers.
- Show the workout type in workout-start notification copy and configure a FitVen Android notification icon.
- Configure the Android Firebase services file used for Expo push token registration.
- Retry push-token registration when the app becomes active and update registrations when the device push token rotates.
- Prevent workout owners from receiving their own workout-start notifications.
- Sync workout timer starts immediately so workout-start notifications are triggered without waiting for the next app resume.

---
## [0.16.3] - 2026-06-09
### Changed
- Let users long-press dates in the Workout Calendar to add or delete workouts.
- Replace the bottom-navigation plus menu with a start-workout sheet.
- Show today's planned workout, usual workouts, and recent workouts in the start-workout sheet.
- Let users start fresh Resistance and Run workouts from the start-workout sheet.

---
## [0.16.2] - Released with 0.16.3
### Changed
- Let users create custom exercises from the Exercise Catalog by naming them and selecting their targeted muscle groups.
- Label official catalog exercises and user-created custom exercises with color-coded badges.
- Automatically reactivate All muscles when the final muscle filter is deselected.
- Explain the difference between primary and secondary muscles in the Exercise Catalog.

---
## [0.16.1] - Released with 0.16.3
### Changed
- Show a Workout Calendar shortcut beside the compact Today card when no workouts are scheduled.

---
## [0.16.0] - Released with 0.16.3
### Changed
- Redesign the Run workout screen with a compact tracker card, warmup/cooldown cards, and an interval table.
- Improve run distance accuracy across GPS noise, background tracking, pauses, and resumes.

---
## [0.15.16] - Released with 0.16.3
### Changed
- Add a Social posts settings page from the Profile settings section.
- Add social post mode choices for full info, summary only, or automatic posting off.
- Add Supabase SQL for hiding specific exercises from generated social posts.
- Add exercise visibility settings under Social posts for hiding specific exercises from future social posts.
- Add social post audience visibility settings for everyone, followed profiles, or only the author.
- Show workout type beside the workout summary post timestamp again.

---
## [0.15.15] - Released with 0.16.3
### Changed
- Add a delete action for workout summary social posts without deleting the workout.

---
## [0.15.14] - Released with 0.16.3
### Changed
- Add a first Profile settings section with Exercises and Social posts actions.
- Show the EditSocialPost icon on the workout summary edit action.

---
## [0.15.13] - Released with 0.16.3
### Changed
- Add a dedicated edit screen for workout summary social post notes.
- Hide generic workout-type fallback text from workout summary cards when no note is set.

---
## [0.15.12] - Released with 0.16.3
### Changed
- Show Personal Records before Exercise Library on the Train page.

---
## [0.15.11] - Released with 0.16.3
### Changed
- Stop automatically backfilling social posts for every completed workout; workout summaries are only generated from Finish or manual Repost.
- Sort circle stories by activity state: live workouts first, then planned, done, and inactive profiles.

### Fixed
- Pause the Resistance timer when the final set is marked done.
- Add a Repost summary action to the Workout page options for manually regenerating a finished Resistance workout summary.
- Refresh existing workout summary posts when a manual repost has an equally complete or richer payload.

---
## [0.15.10] - Released with 0.16.3
### Changed
- Load Home workout summary posts with paginated infinite scrolling instead of a fixed three-post limit.

---
## [0.15.9] - Released with 0.16.3
### Changed
- Use the exercise catalog as the add-exercise picker inside Resistance workouts, with training-group and multi-select muscle-region filters.

---
## [0.15.8] - Released with 0.16.3
### Fixed
- Retry and backfill missing workout summary social posts for completed Resistance workouts.
- Include top sets from every completed exercise in workout summary posts.

---
## [0.15.7] - Released with 0.16.3
### Changed
- Move the Profile feedback card below Public profile and above Account logout.

---
## [0.15.6] - Released with 0.16.3
### Changed
- Replace Social people search cards with compact Instagram-style list rows.
- Remove bio text from Social people search results.
- Prevent the Social follow button label from wrapping when showing Following.

---
## [0.15.5] - Released with 0.16.3
### Changed
- Move follower and following counts from Profile to the Social header.
- Add compact Social header relationship stats that open the follower/following lists.

---
## [0.15.4] - Released with 0.16.3
### Changed
- Add a static workout summary preview card to Home.
- Show workout summary PR indicators inline with top set exercise names.
- Restyle workout summary top sets to match the workout set list table.
- Simplify workout summary top set columns and place reps before weight.
- Hide unfinished comment and share actions from the workout summary preview.
- Add Supabase setup SQL for workout summary social posts and likes.
- Create workout summary posts automatically after completed Resistance workouts.
- Load real workout summary feed cards on Home with like toggles.
- Soft-delete workout summary posts when completed workouts are reset.
- Keep Home workout summary feed cards below Today and friend stories.

---
## [0.15.3] - Released with 0.16.3
### Changed
- Add stories and a friend-search image card to the top of Social.

---
## [0.15.2] - Released with 0.16.3
### Changed
- Move Sickness Log and Workout Calendar shortcuts from Home to the top of Train.

---
## [0.15.1] - Released with 0.16.3
### Changed
- Move the Send Feedback card from Home to the top of Profile.

---
## [0.15.0] - Released with 0.16.3
### Changed
- Rename the bottom navigation search tab to Social and move it after the create button.
- Move the training tab into the former search tab position and label it Train.
- Use the upward graph icon for the Train tab.

---
## [0.14.15] - Released with 0.16.3
### Changed
- Move workout calendar weekday labels into a shared header row and simplify each day card to the date number.
- Compact workout calendar day cards and workout markers so dense weeks fit better.

---
## [0.14.14] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.13] - Released with 0.16.3
### Changed
- Add a Home screen body map preview test with a lightweight front muscle mask toggle.
- Replace exercise catalog row numbers with body map preview badges.
- Show exercise catalog body maps without circular frames.
- Load the front body map preview from a compressed PNG asset.
- Add Supabase setup SQL for body map muscle-region mappings.
- Highlight mapped primary and secondary muscles on exercise catalog body maps.
- Seed body map region mappings for the current shared muscle catalog.
- Show front or back body map previews per exercise catalog row.
- Render mapped back-view body map muscle overlays.
- Correct left and right muscle mask placement for back-view overlays.
- Open exercise catalog body maps in a full front and back detail modal.
- Keep cropped back muscle masks aligned in full body map previews.
- Stretch body map mask overlays with the same preview frame as the body image.
- Render back body map mask regions in the same full-frame coordinate system as the body preview.
- Align back body map overlays from the combined full-mask export paths.
- Hide secondary muscle badges when an exercise has no secondary muscles.
- Add upper/lower body section metadata to body map regions.
- Crop exercise catalog body map previews to upper or lower body from region metadata.

---
## [0.14.12] - Released with 0.16.3
### Changed
- Remove exercise catalog muscle activation percentages and the related detail modal.
- Show primary and secondary muscle count badges in the exercise catalog.

---
## [0.14.11] - Released with 0.16.3
### Changed
- Reorder workout exercises by long-pressing the exercise card instead of using the corner handle.

---
## [0.14.10] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.9] - Released with 0.16.3
### Changed
- Added day-level sickness marking from the week indicator context menu.
- Added the Sickness table foundation for dated sickness periods.
- Added a continuation prompt when marking sickness after an already sick day.
- Routed the home Sickness log shortcut to a dedicated Sickness screen.
- Added a draft Sickness screen layout for new entries and sickness history.
- Connected the Sickness screen history to local Sickness records.
- Fixed new sickness periods so choosing not to continue from yesterday does not leave overlapping history ranges.
- Added sickness type and note capture when marking a new sick day.
- Updated sick-day clearing so Sickness history removes, trims, or splits affected periods.
- Moved Sickness page registration into a modal opened from a Register new sickness button.
- Changed Sickness page registration dates to use a native calendar picker.
- Synced registered sickness periods into program days and Workout Calendar sick markers.
- Added edit and delete actions for Sickness history records.

---
## [0.14.8] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.7] - Released with 0.16.3
### Changed
- Added a home-screen sickness log card draft using the sickness dark artwork.

---
## [0.14.6] - Released with 0.16.3
### Changed
- Added record-color highlighting for PR sets, exercises, and completed workout indicators.

---
## [0.14.5] - Released with 0.16.3
### Changed
- Removed the one-time saved-program import action from the profile page.

---
## [0.14.4] - Released with 0.16.3
### Changed
- Simplified collapsed resistance set previews by removing the outer frame and moving repeat counts into corner badges.

---
## [0.14.3] - Released with 0.16.3
### Changed
- Added an expandable previous-set history panel behind the replay-history icon on resistance exercise cards.

---
## [0.14.2] - Released with 0.16.3
### Changed
- Redesigned program list cards with status badges, circular progress, completion marks, and workout type badges.

---
## [0.14.1] - Released with 0.16.3
### Changed
- Changed resistance set completion so tapping Done cycles through done, failed, and clear states.
- Colored failed resistance set progress blocks red in exercise headers.

---
## [0.14.0] - Released with 0.16.3
### Changed
- Added soft Run-style glow accents to the Resistance workout timer header.
- Added side-by-side local/cloud sync metadata and Supabase watcher migration support.

---
## [0.13.0] - Released with 0.16.3
### Changed
- Added estimated one-rep-max progression graphs to Personal Records exercise detail views.
- Added a one-time local program import button for the zhadowseb account.

---
## [0.12.3] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.12.2] - Released with 0.16.3
### Changed
- Redesigned the Library Programs card with the generated program hero artwork and compact metric tiles.

---
## [0.12.1] - Released with 0.16.3
### Changed
- Added text labels under the bottom navigation buttons.

---
## [0.12.0] - Released with 0.16.3
### Changed
- Added a large bottom-navigation plus button for creating quick workouts on today's date.
- Added a Quick Workouts program container so quick workouts get real Day rows with dates.

---
## [0.11.1] - Released with 0.16.3
### Changed
- Added a workout calendar program-day modal with navigation to Program Overview.
- Limited workout calendar loading to the visible month plus adjacent months.

---
## [0.11.0] - Released with 0.16.3
### Changed
- Added a workout calendar test entry from Home with open-ended month paging, program-day dots, and workouts from all programs.

---
## [0.10.0] - Released with 0.16.3
### Changed
- Removed the header from the Library bottom-tab page.
- Added a Personal Records card and rep-record view under Library.
- Added a Personal Records toggle for hiding empty rep ranges.
- Updated the Personal Records exercise list to show the latest PR date.
- Redesigned the exercise catalog with search, group filters, and table-style rows.
- Added Supabase SQL for muscle group metadata used by exercise catalog filters.

---
## [0.9.14] - Released with 0.16.3
### Changed
- Refined the microcycle weekday indicator with a raised TODAY badge and month text labels.

---
## [0.9.13] - 2026-04-29
### Changed
- Added a Supabase `workout_type` catalog script with `type`, `display_name`, `is_active`, RLS, and a foreign key from `workout_type_instance.workout_type`.
- Synced active workout types from the cloud catalog into the local picker so visible workout options and display names can be controlled online.
- Added the workout type display name under the resistance workout header start status.
- Renamed the strength workout screen and icon files to `Resistance`.
- Added workout label editing from the workout header options menu.
- Reworked the Home page today shortcut into a compact start-card that opens the next workout directly.

---
## [0.9.12] - 2026-04-29
### Changed
- Redesigned program cards with compact status, progress, summary metrics and date range styling.

---
## [0.9.11] - 2026-04-29
### Fixed
- Fixed today's WeekIndicator workout badges so they use the same rounded-card shape and icon size as workout badges on other days.
- Fixed HomePage crew activity so it only shows followed users and can read today's workout activity for those users through Supabase follow-based access.

---
## [0.9.10] - 2026-04-29
### Added
- Added a Library tab to the bottom navigation that opens the exercise library with a dedicated Library icon.
- Moved the Programs and Exercise Library quick-access cards from the Home page to the Library page, with the Exercise Library card opening a dedicated Catalog screen.

---
## [0.9.9] - 2026-04-29
### Changed
- Redesigned the strength workout timer card with a compact status/header layout, linear set progress, and custom start, pause, continue, and finish actions.
- Refreshed strength exercise cards with Home-style top progress bars, set dividers, cleaner icon controls, and card-colored toolbar actions.
- Reworked collapsed exercise set summaries so matching sets are grouped with the repeat count outside the reps/weight badge and the expand control sits in its own side button.
- Updated the expanded strength set table with themed surfaces, tighter headers, focused edit pills, rest/reps/weight cell styling, and an inline add-set row.
- Reduced workout bottom safe-area spacing so strength and run workout screens no longer leave an empty black bar above the bottom navigation.

---
## [0.9.8] - 2026-04-29
### Changed
- Added drag-and-drop reordering for strength workout exercises with persisted local and cloud ordering.

---
## [0.9.7] - 2026-04-24
### Changed
- Updated the HomePage crew activity strip so your own circle now reflects real local workout states with planned, live, done, and rest styling plus status badges.

---
## [0.9.6] - 2026-04-24
### Changed
- Added profile photo upload backed by Supabase Storage, including avatar previews on the profile page, people search, relationship lists, and the HomePage social circle.

---
## [0.9.5] - 2026-04-24
### Changed
- Added a HomePage social circle strip inspired by the shared `FriendsActivity` reference, using static full rings and generic user icons instead of rotating avatar images or segmented activity rings.

---
## [0.9.4] - 2026-04-24
### Changed
- Added followers and following summary blocks on the profile page, including tappable lists that show which users follow you and which users you follow.

---
## [0.9.3] - 2026-04-24
### Changed
- Reworked social usernames to use an immutable `username_base#1234` format, including signup, profile display, search, and Supabase profile bootstrap logic.

---
## [0.9.2] - 2026-04-24
### Changed
- Added editable profile fields for `display_name` and `bio`, so users can update how they appear in people search directly from the profile page.

---
## [0.9.1] - 2026-04-24
### Changed
- Added a dedicated people search flow in the bottom navigation, including user search plus follow and unfollow actions backed by Supabase profiles and follow relationships.

---
## [0.9.0] - 2026-04-24
### Changed
- Replaced the HomePage top header with a global bottom navigation bar for authenticated screens, adding persistent Home and Profile actions across the app.

---
## [0.8.1] - Released with 0.9.0
### Changed
- Removed the unused local `Set.date` field and set cloud-sync mapping so set dates are derived from the owning workout/day instead of duplicated on each set.

---
## [0.8.0] - Released with 0.9.0
### Changed
- Refreshed the Create Program modal with themed inputs and a start-week picker that supports direct week selection and year navigation.

---
## [0.7.0] - 2026-04-21
### Changed
- Added overdue workout highlighting in the week indicator, so unfinished workouts from previous days now use the danger color.

---
## [0.6.8] - Released with 0.7.0
### Changed
- Restored the normal local-first `Set` sync flow so authenticated sync no longer treats cloud rows as the authoritative source for local SQLite state.
- Added local SQLite support for `sync_id`, `sync_version`, and `deleted_at` across the program hierarchy and strength workout entities, including safe local backfills for existing rows.
- Migrated `Program`, `Mesocycle`, `Microcycle`, `Day`, `workout_type_instance`, `exercise_instance`, and `set` sync to a versioned local-first model that resolves cloud matches by `sync_id` first, falls back to legacy local ids during migration, and uses cloud tombstones instead of hard deletes.
- Updated local edit flows so legacy rows that still lack a `sync_id` get one automatically on first local change, which lets older cloud-backed data enter the new sync model without manual repair.

---
## [0.6.7] - Released with 0.7.0
### Changed
- Temporarily made cloud `Set` rows authoritative during authenticated sync, so local SQLite now pulls cloud sets down, removes stray local-only set rows, and refreshes exercise set counts/completion from the downloaded data.

---
## [0.6.6] - Released with 0.7.0
### Changed
- Added a subtle swipe hint under the ProgramOverviewPage block carousel so it is easier to see that the mesocycle list scrolls horizontally.

---
## [0.6.5] - Released with 0.7.0
### Changed
- Fixed ProgramPage delete navigation so returning from a deleted program now replaces the route instead of leaving a broken overview screen in the stack.
- Hardened SQLite sync transactions to use savepoints, which avoids nested transaction failures during login and cloud sync startup.
- Repaired the Mesocycle cloud insert mapping so older synced programs no longer fail with a column/value mismatch.

---
## [0.6.4] - Released with 0.7.0
### Changed
- Describe pending changes here.

---
## [0.6.3] - Released with 0.7.0
### Changed
- Realigned the post-`0.5.10` development line to `0.6.x`, so new pending work no longer looks like extra `0.5.11+` patches after the `0.5.10` release.
- Updated the release workflow so older pending sections can be marked `Released with x.y.z` when one stable release bundles several earlier work branches.

---
## [0.6.2] - Released with 0.7.0
### Changed
- Refreshed ProgramPage cards with a larger hero section, cleaner metric panels, and automatic refresh when returning from Program Overview.

---
## [0.6.1] - Released with 0.7.0
### Changed
- HomePage quick access is being reshaped into a more informative dashboard layout so programs and exercise tools feel like overview surfaces instead of standalone buttons.

---
## [0.6.0] - Released with 0.7.0
### Changed
- Serialized shared SQLite transactions used by background sync and reconcile flows, so overlapping sync jobs no longer try to open nested transactions on the same connection.

---
## [0.5.10] - 2026-04-12
### Added
- Added the first `set` cloud sync flow with local cloud-id tracking, delete queueing, parent `exercise_instance(id)` repair, and an app-level sync runner that depends on `Exercise_Instance` sync.
### Changed
- Local set edits, set completion toggles, set deletions, and bulk set saves now mark `Set` rows as dirty and can sync in the background without waiting for app restart.
- Strength data sync now treats `Set` as the lowest cloud boundary, while still keeping derived `Exercise_Instance` fields such as set count and completion aligned and synced parent-first.

---
## [0.5.9] - Released with 0.5.10
### Added
- Added the first `exercise_instance` cloud sync flow with local cloud-id tracking, delete queueing, workout-parent repair, and an app-level sync runner that depends on `workout_type_instance` sync.
### Changed
- Local exercise updates now mark `Exercise_Instance` rows as dirty, and exercise creation, deletion, note changes, column changes, and set-derived completion or set-count changes can sync in the background without waiting for app restart.
- Strength workout copy flows now trigger both workout and exercise background sync, so copied exercise rows do not stay local-only after a successful workout copy.

---
## [0.5.8] - Released with 0.5.10
### Added
- Added the first `workout_type_instance` cloud sync flow with local cloud-id tracking, delete queueing, parent `Day.id` mapping, and an app-level sync runner.
### Changed
- Workout timer fields now sync through a safe local timestamp to cloud `time` conversion based on the workout date, so the existing local stopwatch logic can stay unchanged while cloud rows still match the Supabase schema.
- Local workout updates now mark `Workout_Type_Instance` rows as dirty, and finishing or resetting a workout triggers a background workout sync without making `Set` or `Exercise_Instance` write directly to cloud.
- Stale cached cloud ids in the `Program -> Mesocycle -> Microcycle -> Day -> workout_type_instance` sync chain now fall back to `upsert` instead of raw inserts, so parent rows can be repaired safely without duplicate-key failures.
- Local workout deletes now queue a tombstone by local workout sync-id, so deleting a newly created workout no longer waits on cloud sync and no longer risks being re-downloaded immediately after removal.

---
## [0.5.7] - Released with 0.5.10
### Added
- Added the first `Day` cloud sync flow with local cloud-id tracking, dirty-state sync flags, and an app-level sync runner that depends on `Microcycle` sync.
### Changed
- `Day` sync reconciles cloud rows before uploading local dirty rows, so locally generated placeholder days from downloaded microcycles can attach to existing cloud days instead of creating duplicates.
- Workout completion updates now mark the owning local `Day` row as dirty, so `done` can be synced later without making direct child-row cloud writes from `Set` or `Exercise_Instance`.

---
## [0.5.6] - Released with 0.5.10
### Added
- Added the first `Microcycle` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and app-level sync triggers that depend on `Program` and `Mesocycle` sync.
### Changed
- Rebuilds missing local `Day` rows for cloud-downloaded microcycles so remote weeks remain usable locally until `Day` itself gets a dedicated sync layer.
- Aligned local `Program` and `Mesocycle` sync with the new cloud `Mesocycle.cloud_program_id -> Program.id` relationship while keeping local sync-key mappings so stale cloud ids can still be repaired safely.
- Aligned `Microcycle` cloud sync with the new `Microcycle.cloud_mesocycle_id -> Mesocycle.id` relationship, so parent references now use the real cloud mesocycle id instead of the old cloud-local key.
- Keeps local `remote_local_program_id` and `remote_local_mesocycle_id` as sync identities, while cloud relations now use real parent cloud ids.
- Added a one-time local repair that clears stale cached `cloud_program_id`, `cloud_mesocycle_id`, and `cloud_microcycle_id` values and marks the hierarchy dirty so sync can rebuild those ids safely after the cloud FK changes.
- Hardened mesocycle and microcycle uploads so they re-resolve parent cloud ids by sync key before writing children, which prevents stale cached parent ids from causing cloud FK failures.

---
## [0.5.5] - Released with 0.5.10
### Changed
- Switched the changelog workflow from a single global `Unreleased` bucket to versioned sections like `## [0.5.x] - Unreleased`, so pending releases are visible per version and `release:prepare` can convert the same section into a dated release entry.
### Added
- Added `npm run release:android -- <version>`, which prepares a stable release version and starts an Android EAS production build using the current EAS login or `EXPO_TOKEN`, with optional `--prebuild` support.

---

## [0.5.4] - Released with 0.5.10
### Changed
- Hardened program cloud deletes so a local program deletion only clears the local delete queue after the remote row is actually gone, and explicit program deletes now attempt cloud sync immediately while keeping failed deletes queued for retry.

---

## [0.5.3] - Released with 0.5.10
### Changed
- Scoped local SQLite storage to one database file per authenticated user, so logging into another profile no longer exposes the previous user's local programs on the device.

---

## [0.5.2] - Released with 0.5.10
### Added
- Added the first `Mesocycle` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and app-level sync triggers that depend on `Program` sync.
### Changed
- Fixed `Mesocycle` cloud sync parent mapping so cloud writes use the canonical parent program identity instead of the device-local SQLite `program_id`, which avoids Supabase relationship failures across devices.

---

## [0.5.1] - Released with 0.5.10
### Changed
- Updated branch-driven versioning to support `major/...` and `minor/...` feature prefixes, where `minor/...` and `fix/...` both produce patch-level prerelease bumps.

---

## [0.5.0] - Released with 0.5.10
### Added
- Added the first `Program` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and an app-level sync runner that uploads local program changes and pulls remote-only programs.
### Changed
- Normalized `Program.start_date` between local SQLite `dd.MM.yyyy` strings and cloud PostgreSQL `date` values to avoid sync failures and mixed local date formats.

---

## [0.4.2] - 2026-04-09
### Changed
- Renamed the local `Workout` table to `Workout_Type_Instance`, added a local `Workout_Type` table, and introduced a safe migration that preserves existing workout rows while backfilling `workout_type`.
- Aligned the local `Exercise` catalog with the cloud naming model, moved muscle-group counts to runtime calculation, and safely migrated `Exercise_Instance` to `exercise_instance_id` and `workout_type_instance_id` without breaking existing set relationships.
- Renamed the local `Sets` table to `Set` and safely migrated its `exercise_id` relation to `exercise_instance_id` without breaking existing set rows.

---

## [0.4.1] - 2026-04-09
### Changed
- Removed `program_id` from the local `Microcycle` table and added a safe migration that rebuilds the table without changing existing `microcycle_id` relationships.

---

## [0.4.0] - 2026-04-07
### Added
- Branch-based versioning scripts for branch, sync, status, and release workflows.
### Changed
- `CHANGELOG.md` now keeps versioned release entries in git history.

---

## [0.3.0] - 2026-03-25
### Added
- Login page

## [0.2.2.2] - 2026-03-25
### Fix
- Potential fix for location tracking again.
### Added
- Moving timer "restart" button to bottomsheet.
- "finish" timer button now sets workout as done.

---

## [0.2.2.1] - 2026-03-25
### Fix
- Fix bug that corrupted loading of all SQLite info.

---

## [0.2.2] - 2026-03-25
### Added
- Location tracking feature

## [0.2.1] - 2026-03-25
### Added
- Version 0.2 type styling for "Run" type workout.

---

## [0.2.0] - 2026-03-22
### Changed
- Full UI redesign (AI-assisted)

---

## [0.1.0] - 2026-03-XX
### Added
- Initial version
