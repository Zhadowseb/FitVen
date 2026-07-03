# FitVen

FitApp is an Expo / React Native training app for planning and tracking workouts with a local SQLite database on the device.

The app started as a replacement for spreadsheet-based training programs and is currently centered around:
- Program planning with `Program -> Mesocycle -> Microcycle -> Day -> Workout`
- Strength training workouts with exercises, sets, reps, weight, notes, failed sets, and workout timer
- Running workouts with structured run sets, timer, and background location logging
- Program-specific "Program bests" and estimated 1RM tracking

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [ER diagram](#ER-diagram)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Development Workflow](#development-workflow)
- [Versioning](#versioning)
- [Notes](#notes)

---

## Tech Stack

- Framework: Expo + React Native
- Database: `expo-sqlite`

Main entry points:
- `App.js`: navigation, SQLite provider, background location task
- `src/Database/db.js`: database initialization

---

## Architecture

The app is structured in three layers around the local database:

- `src/Database`
  Contains schema definitions and database initialization only.
- `src/Repository`
  Contains raw SQL queries and persistence operations.
- `src/Services`
  Contains app-level workflows, calculations, transactions, and multi-step domain logic.

---

## Project Structure

```text
FitApp/
|-- App.js
|-- src/
|   |-- Database/
|   |   |-- db.js
|   |   `-- schema/
|   |       |-- location.js
|   |       |-- program.js
|   |       |-- running.js
|   |       `-- weightlifting.js
|   |-- Repository/
|   |   |-- index.js
|   |   |-- locationRepository.js
|   |   |-- programRepository.js
|   |   |-- runningRepository.js
|   |   |-- weightliftingRepository.js
|   |   `-- workoutRepository.js
|   |-- Services/
|   |   |-- index.js
|   |   |-- locationService.js
|   |   |-- programService.js
|   |   |-- runningService.js
|   |   |-- shared.js
|   |   |-- weightliftingService.js
|   |   `-- workoutService.js
|   |-- Pages/
|   |   |-- ExerciseStoragePage/
|   |   |-- HomePage/
|   |   |-- MicrocyclePage/
|   |   |-- ProgramOverviewPage/
|   |   |-- ProgramPage/
|   |   |-- SetPage/
|   |   |-- WeekPage/
|   |   `-- WorkoutPage/
|   |-- Resources/
|   `-- Utils/
`-- README.md
```

---

## Data Model

The schema is initialized in `src/Database/db.js`.

## ER Diagram

<p align="center">
  <img src="detailed new FitVen ER diagram.drawio.png" width="800"/>
</p>

### Program hierarchy
- `Program`
- `Mesocycle`
- `Microcycle`
- `Day`
- `Workout`

### Strength training hierarchy
- `Exercise`
  Exercises attached to a workout
- `Sets`
  Set data such as set number, reps, weight, pause, RPE, note, done, and failed
- `Estimated_Set`
  Estimated working weights / estimated 1RM support per program and exercise
- `Exercise_storage`
  Stored exercise names for dropdowns and reuse
- `Program_Best_Exercise`
  Program-specific selection of which exercises should be shown in "Program bests"

### Running
- `Run`
  Structured run sets for a workout

### Location (development currently paused)
- `LocationLog`
  GPS points logged while an active workout is running

---

## Feature Notes

### Program Overview
- Shows mesocycles for the current program
- Shows "Program bests" for selected exercises
- Lets the user choose which exercises should be tracked in "Program bests"
- Shows estimated 1RM entries per program

### Program bests
- Exercise visibility is persisted per program in the database
- Best set values are calculated in `programService`
- Strength bests are based on completed sets only
- Multi-rep bests use the Brzycki formula to estimate 1RM

### Strength training
- Exercise list can hide or show completed exercises
- Set rows support marking a set as failed
- Workout timer state is persisted so the timer can recover after app restarts

### Running
- Supports warmup, working sets, cooldown, and pauses
- Tracks workout timer and location data while active

---

## Getting Started

### Requirements
- Node.js
- npm
- Android Studio and/or Xcode for local native builds

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run start
```

### Run on device / emulator

```bash
npm run android
npm run ios
```

---

## Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run version:status
npm run version:auto
npm run release:prepare -- 0.4.0
npm run release:android -- 0.4.0
```

---

## Development Workflow

### Branch safety

- No code changes should be made directly on `master` or `main`.
- If a new code task starts while the repo is on `master` or `main`, the next step is to create a work branch first.
- Recommended branch prefixes:
  - `major/...` for larger features
  - `minor/...` for smaller features
  - `fix/...` for bug fixes
  - `release/x.y.z` for stable release preparation

### Commit checkpoints

- When one task is done and a new unrelated task starts, commit the finished work before mixing in the next change.
- If Codex proposes a new branch or a commit checkpoint, it is to keep versioning and history clean.
- The intended behavior is:
  - propose branch name first when on `master`
  - run versioning on the work branch
  - suggest a commit before moving to the next unit of work

---

## Versioning

Versioning is branch-driven so you do not have to manage it manually for normal development work.

### Quick checks

- `npm run version:status`
  Shows current branch, current app versions, whether `package.json` and `app.json` match, and what to run next.

### Normal work branches

- `npm run version:auto`
  Reads the current branch name and updates versioning automatically.

Branch behavior:

- `minor/...` or `minor-feature/...` -> next `patch` prerelease
- `fix/...`, `bugfix/...`, `hotfix/...`, `quickfix/...` -> next `patch` prerelease
- `major/...` or `major-feature/...` -> next `minor` prerelease
- `feat/...` or `feature/...` -> next `minor` prerelease as a supported alias for `major/...`
- `breaking/...` -> next `major` prerelease
- `release/x.y.z` -> exact stable release version

Examples:

- `major/program-calendar` from `0.3.1` becomes `0.4.0-major-program-calendar.1`
- `minor/program-sync` from `0.5.0` becomes `0.5.1-minor-program-sync.1`
- `fix/set-counter` from `0.5.1` becomes `0.5.2-fix-set-counter.1`
- `release/0.4.0` becomes `0.4.0`

### Stable releases

- `npm run release:prepare -- 0.4.0`
  Updates:
  - `package.json > version`
  - `app.json > expo.version`
  - `app.json > expo.android.versionCode`
  - `app.json > expo.ios.buildNumber`
  - the release section in `CHANGELOG.md`
  - older pending sections that were shipped together, which are marked `Released with x.y.z`

- `npm run release:android -- 0.4.0`
  Runs release preparation and starts an Android EAS production build using the current EAS login or `EXPO_TOKEN`.
  Add `--prebuild` if you explicitly want to run `expo prebuild` before the EAS build.

### Recommended routine

1. Create or switch to a work branch.
2. Run `npm run version:auto`.
3. Use `npm run version:status` if you want to verify the current state.
4. Do the work.
5. Replace placeholder text in `CHANGELOG.md` before shipping.
6. Commit before moving on to a new unrelated task.

If a stable release closes one line and you want the next work to start the next minor line, sync the first follow-up branch explicitly, for example:

```bash
npm run version:sync -- 0.6.0
```

For the detailed rules, see `docs/VERSIONING.md`.

---

## Notes

- The app currently uses a local SQLite database, not a remote backend, but will in the future as the app develops to the next stage.
- `WeekPage` still exists in the codebase, but the main flow from `MicrocyclePage` now navigates more directly into workouts. This means WeekPage currently isn't used, but will potentially be reintroduced at some point.
- Larger schema changes may require explicit migrations or a reset of local app data during development.
