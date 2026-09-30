# Where Things Live

A lookup table, so you open the right file instead of searching for it. Read it
after the root `AGENTS.md` and before you grep. Rules and layering live in the
`AGENTS.md` files; this file only says *where*.

Every name below is checked by `npm test` (`scripts/check-agent-docs.js`): a
path that does not exist, or a `function()` that no source file mentions, fails
the build. There are no line numbers on purpose - they rot. To jump into a big
file, grep for the function (`grep -n "function name" <file>`) and read a slice
with offset and limit. Do not read a 3,000-line file from the top.

## Skip Unless The Task Is About Them

- `.claude/worktrees/` - other agents' checkouts. Full copies of this repo, so
  every search finds every file six times. Never search or edit there.
- `data/` - gym catalog data, ~30 MB. Not app code.
- `docs/*.html`, `docs/PERFORMANCE-AUDIT-2026-08-31.md`,
  `docs/STRUKTUR-AUDIT-2026-09-05.md`, `docs/TESTPLAN-2026-09-04.md`,
  `docs/tastatur-gennemgang.md` - point-in-time reviews. History, not rules.
- `docs/*.sql`, `docs/muscle_group_assignment_rows.csv` - exports.
- `android/`, `dist/`, `node_modules/` - generated.
- `CHANGELOG.md` - read only the top: `sed -n '1,60p' CHANGELOG.md`.

## One Feature, Its Files

A feature is usually one service, one repository and one page folder, named
alike. The service and repository share function names on purpose (see the
aliasing rule in the root guide).

| Feature | Service | Repository | Screens / UI |
|---|---|---|---|
| Programs, mesocycles, weeks, days | `src/Services/programService.js` | `src/Repository/programRepository.js` | `src/Pages/ProgramPage/`, `src/Pages/ProgramOverviewPage/`, `src/Pages/ProgramSettingsPage/`, `src/Pages/ProgramsBrowsePage/`, `src/Pages/MicrocyclePage/` |
| Sickness periods | `src/Services/programService.js` | `src/Repository/programRepository.js` | `src/Pages/SicknessPage/` |
| Strength workouts (exercises, sets) | `src/Services/weightliftingService.js` | `src/Repository/weightliftingRepository.js` | `src/Pages/WorkoutPage/WorkoutTypes/Resistance/` |
| Running | `src/Services/runningService.js` | `src/Repository/runningRepository.js` | `src/Pages/WorkoutPage/WorkoutTypes/Run/` |
| Walking | `src/Services/workoutService.js` | `src/Repository/workoutRepository.js` | `src/Pages/WorkoutPage/WorkoutTypes/Walk/` |
| Workout page shell, start-a-workout | `src/Services/workoutService.js` | `src/Repository/workoutRepository.js` | `src/Pages/WorkoutPage/WorkoutPage.js`, `src/Resources/Components/StartWorkoutSheet.js` |
| Workout library, calendar | `src/Services/programService.js` | `src/Repository/programRepository.js` | `src/Pages/WorkoutLibraryPage/`, `src/Pages/WorkoutCalendarPage/` |
| Exercise library, favourites, custom exercises | `src/Services/weightliftingService.js`, `src/Services/exerciseService.js` | `src/Repository/weightliftingRepository.js`, `src/Repository/customExerciseRepository.js` | `src/Pages/ExerciseLibraryPage/`, `src/Pages/ExerciseCatalogPage/`, `src/Pages/CustomExercisesPage/`, `src/Pages/MyExercisePage/` |
| Personal records | `src/Services/weightliftingService.js` | `src/Repository/weightliftingRepository.js` | `src/Pages/PersonalRecordsPage/`, `src/Pages/RecordsExercisePage/` |
| Statistics | `src/Services/statisticsService.js` | - | `src/Pages/StatisticsPage/`, `src/Pages/StatisticsDetailPage/` |
| Train tab (library, splits) | `src/Services/trainService.js`, `src/Services/splitService.js` | `src/Repository/trainRepository.js` | `src/Utils/trainLibrary.js`, `src/Utils/splitCard.js` |
| Home | `src/Services/homeExploreService.js` | - | `src/Pages/HomePage/` |
| Social: feed, posts, friends | `src/Services/socialService.js`, `src/Services/socialPostService.js`, `src/Services/ownWorkoutPostService.js` | - | `src/Pages/FeedPage/`, `src/Pages/SocialPage/`, `src/Pages/UserPostsPage/`, `src/Pages/WorkoutPostsPage/`, `src/Pages/CenterPostsPage/` |
| Public profiles | `src/Services/publicProfileService.js` | - | `src/Pages/PublicProfilePage/`, `src/Pages/SocialUserListPage/` |
| Explore, gyms, leaderboards | `src/Services/gymService.js`, `src/Services/categoryLeaderboardService.js` | - | `src/Pages/ExplorePage/`, `src/Pages/GymsPage/`, `src/Pages/GymLeaderboardPage/`, `src/Pages/CategoryLeaderboardPage/`, `src/Pages/NationalExerciseLeaderboardPage/` |
| Login, register, profile | `src/Services/authService.js` | - | `src/Pages/LoginPage/`, `src/Pages/RegisterPage/`, `src/Pages/ProfilePage/`, `src/Pages/EditProfilePage/` |
| Notifications | `src/Services/notificationService.js` | - | `src/Pages/NotificationSettingsPage/`, `src/Pages/NotificationHistoryPage/` |
| Heart rate (Bluetooth) | `src/Services/heartRateService.js` | - | `src/Utils/bleHeartRateUtils.js`, `src/Pages/WorkoutPage/WorkoutTypes/Run/HeartRateDeviceModal.js` |
| Music | `src/Services/musicService.js` | - | `src/Pages/MusicSettingsPage/` |
| Lock-screen workout card | `src/Services/liveWorkoutService.js` | - | `src/Utils/liveWorkout.js`, `modules/live-workout/`, `targets/` |
| Privacy, terms | - | - | `src/Pages/PrivacyPolicyPage/`, `src/Pages/TermsOfUsePage/` |
| Dev dashboard, admin | `src/Services/adminService.js` | - | `src/Pages/DevDashboardPage/` |

Shared UI is in `src/Resources/` (`Components/`, `ThemedComponents/`,
`GlobalStyling/`, `Icons/`, `BodyMap/`). Translations are in
`src/Localization/`. Small pure helpers are in `src/Utils/`, named for what
they compute; most have a test in `scripts/`, named `test-<thing>.js`.

## Cloud Sync

Sync is a separate stack from the services above. Read `src/Services/AGENTS.md`
and `src/Sync/AGENTS.md` first.

- Per-table upload/download: `src/Services/cloudSync/` - one file per table
  (`programSync.js`, `mesocycleSync.js`, `microcycleSync.js`, `daySync.js`,
  `workoutTypeInstanceSync.js`, `exerciseInstanceSync.js`, `setSync.js`).
  The field lists are in `src/Services/cloudSync/cloudSyncFields.js`.
- What triggers sync: `src/Services/syncScheduler.js` and the components in
  `src/Sync/` that `App.js` mounts.
- Cloud schema and functions: `supabase/`.
- The local schema, in two places that must agree: `src/Database/schema/` and
  `src/Database/db.js`.

## The Big Files, By Section

These four files are too large to read whole. Each is ordered by topic; jump to
the topic you need.

### `src/Services/weightliftingService.js` (~5,100 lines)

Top to bottom:
1. Exercise catalog and custom exercises: `getExerciseStorage()`,
   `createCustomExercise()`
2. Personal records and history: `getPersonalRecordExerciseSummaries()`,
   `getExerciseHistoryTable()`, `getHeaviestLift()`
3. Exercise library, recents, favourites: `getExerciseLibraryEntries()`,
   `syncExerciseLibraryFromCloud()`, `setExerciseFavourite()`,
   `syncExerciseFavouritesWithCloud()`
4. Estimated sets and program muscle load: `createEstimatedSet()`,
   `getProgramWeeklyMuscleLoad()`
5. Column preferences sync: `syncExerciseColumnPreferencesWithCloud()`
6. Cloud download of strength data: `syncStrengthWorkoutDataFromCloud()`,
   `hydrateStrengthWorkoutDataForWorkout()`
7. Workout exercises (add, reorder, delete, note, columns):
   `addExerciseToWorkout()`, `reorderWorkoutExercises()`, `deleteExercise()`,
   `updateExerciseNote()`
8. Weight mode switch and undo: `switchExerciseWeightMode()`,
   `undoExerciseWeightModeSwitch()`
9. Sets (done, type, field, weight, delete): `updateStrengthSetDone()`,
   `addSetToExercise()`, `updateSetField()`, `updateSetWeights()`,
   `deleteSet()`, `saveExerciseSets()`
10. Restart and live progress: `restartStrengthWorkout()`,
    `getLiveWorkoutProgress()`

### `src/Repository/weightliftingRepository.js` (~3,000 lines)

1. Catalog and read queries for PRs and history: `getExerciseCatalogEntryByName()`,
   `getCompletedStrengthSetsForPersonalRecords()`, `getPreviousExerciseSession()`
2. Column preferences, favourites, estimated sets, RM progressions:
   `upsertExerciseColumnPreference()`, `upsertExerciseFavourite()`,
   `insertRmWeightProgression()`
3. Exercise rows: queries, create, cloud create/update, sync marks, queued
   deletes: `getExercisesByWorkout()`, `createExercise()`,
   `createExerciseFromCloud()`, `queueExerciseInstanceDeleteSync()`
4. Set rows: same shape: `createSet()`, `createSetFromCloud()`,
   `markSetForUpload()`, `queueSetDeleteSync()`
5. Derived fields and done-state roll-up: `refreshExerciseDerivedFieldsFromSets()`,
   `updateWorkoutDoneFromExercises()`
6. Set edits and personal-record flags: `updateSetField()`, `updateSetType()`,
   `updateSetPersonalRecord()`
7. Statistics and retry helpers: `getCompletedStrengthWorkoutsWithExercises()`,
   `markUnsyncedStrengthDataForRetry()`

### `src/Services/programService.js` (~2,700 lines)

1. Focus options and pickers: `getFocusPickerItems()`
2. Program lifecycle: `createProgram()`, `startProgram()`,
   `completeExpiredPrograms()`, `deleteProgram()`
3. Home and today snapshots: `getTodayProgramSnapshot()`,
   `getActiveProgramCard()`, `getTodayActivitySummary()`
4. Workout library and calendar: `getWorkoutLibrary()`, `getUsualWorkouts()`,
   `getWorkoutCalendarWorkouts()`, `getNextUnfinishedCalendarWorkout()`
5. Mesocycles: `createMesocycle()`, `addWeekToMesocycle()`, `deleteMesocycle()`
6. Microcycles (weeks): `copyMicrocycleWorkouts()`, `deleteMicrocycle()`,
   `getMicrocycleDayDetails()`
7. Sickness: `markDaySick()`, `createSicknessPeriod()`, `deleteSicknessPeriod()`
8. Creating and copying workouts: `createQuickWorkout()`, `repeatWorkoutToday()`,
   `copyWorkoutToDate()`, `deleteWorkout()`
9. Metadata getters: `getProgramMetadata()`

### `src/Repository/programRepository.js` (~3,500 lines)

Grouped by table, each group with the same shape (read, create, update-from-cloud,
mark-synced, cloud identity, queued deletes):
1. Programs: `getProgramsForCloudSync()`, `createProgramFromCloud()`,
   `queueProgramDeleteSync()`
2. Mesocycles: `getMesocyclesForCloudSync()`, `createMesocycleFromCloud()`
3. Microcycles: `getMicrocyclesForCloudSync()`, `createMicrocycleFromCloud()`
4. Program queries (overview, status, days, workouts between dates):
   `getProgramsOverview()`, `getWorkoutsBetweenDates()`, `getWorkoutLibrary()`
5. Cascading deletes by program, mesocycle and microcycle:
   `deleteWorkoutsByProgram()`, `deleteProgramById()`, `deleteMesocycleById()`
6. Days: `getDaysForCloudSync()`, `createDayFromCloud()`, `updateDaySick()`
7. Sickness periods: `createSicknessPeriod()`, `extendSicknessPeriod()`
8. Workouts: `getWorkoutsForCloudSync()`, `createWorkoutFromCloud()`,
   `createWorkout()`, `copyWorkoutIntoDay()`

Also big, but with their own structure: `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js`
(see `src/AGENTS.md`, "Surprising Placements"), `src/Database/db.js` (migrations
in order; see `src/Database/AGENTS.md`).

## Keeping This True

Add a row when you add a feature; move a `function()` if you move it. If a name
stops existing, `npm test` says which one.
