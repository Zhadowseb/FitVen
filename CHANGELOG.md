# Changelog

## [0.18.9] - Unreleased
### Changed
- Fix the crash when opening a completed Run or Walk workout on Android by configuring the Google Maps Android API key and only mounting the route map when the key is available, with a clear fallback card otherwise.
- Stop losing GPS points during Run and Walk tracking: the background location task now keeps one cached database connection with a busy timeout and writes each GPS batch in a single retried transaction instead of opening, migrating, and closing a new connection per batch.
- Recover automatically when the OS silently stops background location delivery while the phone is locked: returning to a live workout with stale tracking restarts the location provider.
- Harden route-map helpers for long workouts (no argument-spread over thousands of points, clamped map regions, simplified polylines) and remove the duplicated iOS location background mode.

---
## [0.18.8] - Unreleased
### Changed
- Add the first Walk workout draft with direct GPS tracking, timer controls, distance, pace, heart-rate zones, and completed-workout insights.
- Register Walk as an active local and Supabase workout type.
- Show Walk as a Start fresh option and recognize it in planned and recent workout cards.

---
## [0.18.7] - Unreleased
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
## [0.18.6] - Unreleased
### Changed
- Remove dashed grid lines from the Run completion charts.

---
## [0.18.5] - Unreleased
### Changed
- Add selectable max-heart-rate sources and calculate Run chart zones from the resolved profile value.

---
## [0.18.4] - Unreleased
### Changed
- Keep public profiles and social circles available when private profile settings are missing or using an older Supabase schema cache.
- Stabilize the birth date wheel so drag and momentum events cannot fight over the selected value.

---
## [0.18.3] - Unreleased
### Changed
- Simplify the completed Run summary and use the secondary color for its border and distance.

---
## [0.18.2] - Unreleased
### Changed
- Add shared private birth date and max heart rate settings to Public profile and Run settings, including calculated, manual, and measured max-pulse sources.

---
## [0.18.1] - Unreleased
### Changed
- Add a Workout Types entry under Personal settings with Strength Training and Run, and move Exercises under Strength Training.

---
## [0.18.0] - Unreleased
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
## [0.17.35] - Unreleased
### Changed
- Add a weekly muscle load chart to Personal Records with program selection.

---
## [0.17.34] - Unreleased
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
