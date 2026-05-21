# Changelog

## [0.14.13] - Unreleased
### Changed
- Add a Home screen body map preview test with a lightweight front muscle mask toggle.
- Replace exercise catalog row numbers with body map preview badges.
- Show exercise catalog body maps without circular frames.
- Load the front body map preview from a compressed PNG asset.
- Add Supabase setup SQL for body map muscle-region mappings.
- Highlight mapped primary and secondary muscles on exercise catalog body maps.

---
## [0.14.12] - Unreleased
### Changed
- Remove exercise catalog muscle activation percentages and the related detail modal.
- Show primary and secondary muscle count badges in the exercise catalog.

---
## [0.14.11] - Unreleased
### Changed
- Reorder workout exercises by long-pressing the exercise card instead of using the corner handle.

---
## [0.14.10] - Unreleased
### Changed
- Describe pending changes here.

---
## [0.14.9] - Unreleased
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
## [0.14.8] - Unreleased
### Changed
- Describe pending changes here.

---
## [0.14.7] - Unreleased
### Changed
- Added a home-screen sickness log card draft using the sickness dark artwork.

---
## [0.14.6] - Unreleased
### Changed
- Added record-color highlighting for PR sets, exercises, and completed workout indicators.

---
## [0.14.5] - Unreleased
### Changed
- Removed the one-time saved-program import action from the profile page.

---
## [0.14.4] - Unreleased
### Changed
- Simplified collapsed resistance set previews by removing the outer frame and moving repeat counts into corner badges.

---
## [0.14.3] - Unreleased
### Changed
- Added an expandable previous-set history panel behind the replay-history icon on resistance exercise cards.

---
## [0.14.2] - Unreleased
### Changed
- Redesigned program list cards with status badges, circular progress, completion marks, and workout type badges.

---
## [0.14.1] - Unreleased
### Changed
- Changed resistance set completion so tapping Done cycles through done, failed, and clear states.
- Colored failed resistance set progress blocks red in exercise headers.

---
## [0.14.0] - Unreleased
### Changed
- Added soft Run-style glow accents to the Resistance workout timer header.
- Added side-by-side local/cloud sync metadata and Supabase watcher migration support.

---
## [0.13.0] - Unreleased
### Changed
- Added estimated one-rep-max progression graphs to Personal Records exercise detail views.
- Added a one-time local program import button for the zhadowseb account.

---
## [0.12.3] - Unreleased
### Changed
- Describe pending changes here.

---
## [0.12.2] - Unreleased
### Changed
- Redesigned the Library Programs card with the generated program hero artwork and compact metric tiles.

---
## [0.12.1] - Unreleased
### Changed
- Added text labels under the bottom navigation buttons.

---
## [0.12.0] - Unreleased
### Changed
- Added a large bottom-navigation plus button for creating quick workouts on today's date.
- Added a Quick Workouts program container so quick workouts get real Day rows with dates.

---
## [0.11.1] - Unreleased
### Changed
- Added a workout calendar program-day modal with navigation to Program Overview.
- Limited workout calendar loading to the visible month plus adjacent months.

---
## [0.11.0] - Unreleased
### Changed
- Added a workout calendar test entry from Home with open-ended month paging, program-day dots, and workouts from all programs.

---
## [0.10.0] - Unreleased
### Changed
- Removed the header from the Library bottom-tab page.
- Added a Personal Records card and rep-record view under Library.
- Added a Personal Records toggle for hiding empty rep ranges.
- Updated the Personal Records exercise list to show the latest PR date.
- Redesigned the exercise catalog with search, group filters, and table-style rows.
- Added Supabase SQL for muscle group metadata used by exercise catalog filters.

---
## [0.9.14] - Unreleased
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
