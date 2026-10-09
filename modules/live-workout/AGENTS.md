# AGENTS.md

## Scope

This file applies to `modules/live-workout` and to `targets/widgets`: the
card on the lock screen during a strength workout.

## What Is Where

| Part | Where |
|---|---|
| The JS API (`isSupported`, `start`, `update`, `end`, `drainActions`, `addActionListener`) | `modules/live-workout/index.js` |
| The state the card is drawn from, what is drawn (Derive) and what a tap does to it before JS knows (Reducer) | `src/Utils/liveWorkout.js`, tested by `scripts/test-live-workout.js` |
| When the card starts, updates and ends, and what a queued tap does | `src/Services/liveWorkoutService.js`, mounted by `src/Sync/LiveWorkoutSync.js` |
| **iOS:** the pod that starts and ends the Live Activity | `modules/live-workout/ios` |
| **iOS:** the widget extension (Live Activity, Dynamic Island), through `@bacons/apple-targets` | `targets/widgets` |
| **iOS:** the state type, the store, the rules and the button intents, compiled into the app **and** the extension | `targets/widgets/_shared` |
| **Android:** the notification, its layouts and the button receiver | `modules/live-workout/android` |

## Rules

- **The native sides draw from data.** JS sends data and translated
  templates (`state.strings`), never a finished card, because the card has to
  change when a button is tapped while JS is not running.
  - Derive and Reducer exist three times: in JS, in Swift
    (`LiveWorkoutRules.swift`) and in Kotlin (`LiveWorkoutView.kt`,
    `LiveWorkoutReducer.kt`). A change to a rule is a change to all three, and
    the JS version is the reference.
- **Native never translates.** Every word is in `liveWorkout.*` in both
  languages, and a placeholder such as `{set}` has to be the same in both.
  `npm test` checks this.
- **`LiveWorkoutAttributes` exists twice on iOS:** in
  `targets/widgets/_shared/LiveWorkoutAttributes.swift` and
  `modules/live-workout/ios/LiveWorkoutAttributes.swift`. The pod cannot see
  the app target's types, and ActivityKit matches the two by name.
  - Keep them byte-identical between the `BEGIN` and `END` markers. `npm test`
    fails otherwise.
- **`Activity.request` belongs in the pod only.** Everything in `_shared` is
  also built into the extension.
- **Adding, renaming or removing a file in `_shared` needs a new
  `npx expo prebuild`.** Its membership in the two targets is set there.
- **The weight buttons (`adjustWeight`) are Android only,** on the open card between sets. iOS neither draws nor reduces them. Their queue entry carries the final weight, merged per set, so handling it twice is harmless.
- **A set without a rest written counts its rest up (`countUp`).** The
  rules are `src/Utils/restCountUp.js`, the one running count-up is
  `src/Services/restCountUpService.js`, and it is not the rest timer: it
  never reaches the bottom menu's square or the rest-is-over reminder. The
  card shows it from 15 s after the tap and turns to it by itself - iOS by
  the stale date (in the intents' redraw and in the pod), Android by a
  re-post from `LiveWorkoutCard` - counting up natively
  (`Text(timerInterval:)`, a Chronometer). Its one button, `endCountUp`
  ("Afslut pause"), is on the lock screen only. The 15 is written in JS,
  Swift (twice) and Kotlin; `npm test` checks all of them.
- **JS only processes what `drainActions()` returns.** The event is a
  wake-up. A tap for a set that is already done is a no-op.
- **The state stays under 4 KB,** because ActivityKit refuses anything larger.
  That is why it carries two exercises of at most 10 sets.
- **Swift cannot be compiled on Windows.**
  `.github/workflows/ios-native-check.yml` builds the app for the iOS
  simulator on every PR that touches `modules/`, `targets/` or the prebuild
  config.
  - Android compiles locally: prebuild in a throwaway worktree, then
    `gradlew :live-workout:compileDebugKotlin`.
- **Nothing here reaches a phone without a new native build.** Changing
  anything under `targets/` or the entitlements also needs the extension's
  bundle id (`com.fitven.app.widget`) and the App Group
  (`group.com.fitven.app`) on the Apple account; EAS asks for them.
