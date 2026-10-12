# AGENTS.md

## Scope

This file applies to `modules/step-sensor`: Android's own step counter, the
last layer of the daily steps for a phone with no health app.

## What Is Where

| Part | Where |
|---|---|
| The JS API (`isAvailable`, `hasPermission`, `readNow`, `startRecording`, `stopRecording`, `isRecording`, `readSnapshots`, `trimSnapshots`) | `modules/step-sensor/index.js` |
| Readings turned into steps for each day, and the anchor that says what has been counted | `src/Utils/stepSensor.js`, tested by `scripts/test-step-sensor.js` |
| When it reads, counts and writes `Sensor_Steps`, `Daily_Steps` | `src/Services/stepSensorService.js`, `src/Services/dailyStepsService.js` |
| The Allow and the permission | `src/Services/stepsService.js` (`requestStepsAccess`) |
| One reading of `TYPE_STEP_COUNTER` | `android/.../StepSensorReader.kt` |
| The readings kept while the app is closed | `android/.../StepSensorStore.kt` (SharedPreferences, at most 3000) |
| The periodic job | `StepSensorWorker.kt`, scheduled by `StepSensorWork.kt` (WorkManager, 15 minutes) |

## Rules

- **The counter only grows until the phone restarts.** A reading is
  `{ time, counter, bootTime }`; a different `bootTime` is a restart, and the
  counter starts over from nothing. Never subtract across a restart.
- **JS does the counting, native only keeps readings.** The rules exist once, in
  `src/Utils/stepSensor.js`, and are tested there. Do not copy them to Kotlin.
- **Nothing is counted twice.** The steps added to `Sensor_Steps` and the anchor
  they were counted up to are written in one transaction.
- **No foreground service, no notification, no background location.** The
  periodic read is WorkManager. `scripts/test-no-foreground-service.js` guards
  it.
- **Nothing throws into the app.** Counting steps this way is a fallback: every
  function in `index.js` returns an empty answer instead, and a build without the
  module is simply a phone with no sensor layer.
- **The permission is asked by Allow and nowhere else.** `ACTIVITY_RECOGNITION`
  is in `app.json`; the module only checks it.
- **The Kotlin is not compiled on Windows.** `.github/workflows/android-native-check.yml`
  is the compiler; a development build is the proof that it counts.
