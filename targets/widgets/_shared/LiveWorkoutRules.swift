// The two sets of rules the lock screen card follows, in Swift. They mirror
// src/Utils/liveWorkout.js rule by rule - `deriveLiveWorkoutView` (what the
// card draws from a state) and `applyLiveWorkoutAction` (what a tap does to
// the stored state before JavaScript knows) - and so does the Android module.
// Change the JavaScript first, and then all three.
//
// Pure: no store, no clock and no ActivityKit, so it is safe in the widget
// extension and in the app alike.

import Foundation

enum LiveWorkoutText {
  /// Plain `{key}` substitution, in the order given, as `fillTemplate` does.
  static func fill(_ template: String?, _ values: [(String, String)]) -> String {
    var text: String = template ?? ""

    for (key, value) in values {
      text = text.replacingOccurrences(of: "{" + key + "}", with: value)
    }

    return text
  }

  /// "1:24", and "1:02:05" from an hour, as `formatLiveClock` does.
  static func clock(_ totalSeconds: Double) -> String {
    let bounded: Double = totalSeconds.isFinite ? min(max(0, totalSeconds), 1e9) : 0
    let seconds: Int = Int(bounded.rounded(.down))
    let hours: Int = seconds / 3600
    let minutes: Int = (seconds % 3600) / 60
    let rest: Int = seconds % 60

    if hours > 0 {
      return String(hours) + ":" + twoDigits(minutes) + ":" + twoDigits(rest)
    }

    return String(minutes) + ":" + twoDigits(rest)
  }

  private static func twoDigits(_ value: Int) -> String {
    return value < 10 ? "0" + String(value) : String(value)
  }
}

/// What the card draws, derived from a state at a moment (Derive).
struct LiveWorkoutDisplay {
  enum Mode {
    case empty
    case allDone
    case set
    case rest
  }

  var mode: Mode = .empty
  var title: String = ""
  var subtitle: String = ""
  /// Just the exercise's name: the Dynamic Island's expanded centre.
  var exerciseName: String = ""
  var setOfTitle: String = ""
  var nowSetId: String? = nil
  var ringFraction: Double = 0
  var ringText: String = ""
  var ringLabel: String = ""
  var setsCount: String = ""
  var hasSets: Bool = false
  /// The workout clock counts up from here, unless it is stopped.
  var clockStartedAt: Double = 0
  /// The paused workout clock, as text; nil while it runs.
  var clockStopped: String? = nil
  var restEndsAt: Double = 0
  var restDuration: Double = 1
  var restOf: String = ""
  var canPrev: Bool = false
  var canNext: Bool = false
  /// All done: the link the one button opens the app with to finish the
  /// workout. Nil in every other mode, and when the state has no valid one.
  var finishUrl: URL? = nil
  var strings: [String: String] = [:]

  /// The set and rest buttons: App Intents, so iOS 17 and later only.
  var hasIntentButtons: Bool {
    return mode == .set || mode == .rest
  }

  /// The all-done card's finish button: a plain link, so any iOS.
  var hasFinishLink: Bool {
    return mode == .allDone && finishUrl != nil
  }

  /// `state.finishUrl` when it is a URL with a scheme, otherwise nil.
  static func finishLink(_ text: String?) -> URL? {
    guard
      let text: String = text,
      !text.isEmpty,
      let url: URL = URL(string: text),
      let scheme: String = url.scheme,
      !scheme.isEmpty
    else {
      return nil
    }

    return url
  }

  func string(_ key: String) -> String {
    return strings[key] ?? ""
  }

  /// The index of the first set not done, or nil (JavaScript's `firstToDo` < 0).
  static func firstToDo(_ exercise: LiveWorkoutState.Exercise?) -> Int? {
    guard let exercise: LiveWorkoutState.Exercise = exercise else {
      return nil
    }

    return exercise.sets.firstIndex(where: { (entry: LiveWorkoutState.SetEntry) -> Bool in !entry.done })
  }

  /// `deriveLiveWorkoutView(state, now)`. `isStale` is iOS's extra rule: a
  /// card past its stale date (the end of the rest) is no longer resting.
  static func derive(_ state: LiveWorkoutState, now: Double, isStale: Bool) -> LiveWorkoutDisplay {
    var display: LiveWorkoutDisplay = LiveWorkoutDisplay()
    let strings: [String: String] = state.strings
    var exercise: LiveWorkoutState.Exercise? = state.exercise
    var canPrev: Bool = state.canPrev
    var canNext: Bool = state.canNext

    // Rule 2: an exercise with nothing left to do (after a tap without
    // JavaScript) gives way to the next one, as a rebuilt state would.
    if exercise != nil && firstToDo(exercise) == nil {
      if let upcoming: LiveWorkoutState.Exercise = state.next, firstToDo(upcoming) != nil {
        exercise = upcoming
      } else {
        exercise = nil
      }

      canPrev = false
      canNext = false
    }

    display.strings = strings
    display.canPrev = canPrev
    display.canNext = canNext
    display.hasSets = state.totals.all > 0
    display.setsCount = LiveWorkoutText.fill(strings["setsCount"], [
      ("done", LiveWorkoutNumber.text(state.totals.done)),
      ("total", LiveWorkoutNumber.text(state.totals.all)),
    ])

    // Rule 7: the workout clock.
    display.clockStartedAt = state.startedAt
    if let paused: Double = state.pausedElapsed {
      display.clockStopped = LiveWorkoutText.clock(paused)
    }

    // Rule 1 and 8: no exercise is `allDone` or `empty`. Empty has no
    // buttons; all done asks to finish, with one button that opens the app
    // on `finishUrl` - a link, not a queued tap.
    guard
      let shown: LiveWorkoutState.Exercise = exercise,
      let nowIndex: Int = firstToDo(shown)
    else {
      if state.totals.all > 0 {
        display.mode = .allDone
        display.title = strings["allDone"] ?? ""
        display.subtitle = strings["allDoneQuestion"] ?? ""
        display.finishUrl = finishLink(state.finishUrl)
      } else {
        display.mode = .empty
        display.title = strings["noSets"] ?? ""
        display.subtitle = ""
      }

      return display
    }

    let nowSet: LiveWorkoutState.SetEntry = shown.sets[nowIndex]
    let doneCount: Int = shown.sets.filter { (entry: LiveWorkoutState.SetEntry) -> Bool in entry.done }.count
    let position: [(String, String)] = [("n", String(nowIndex + 1)), ("total", String(shown.sets.count))]
    var resting: Bool = false

    if let rest: LiveWorkoutState.Rest = state.rest, rest.endsAt > now, !isStale {
      resting = true
      display.restEndsAt = rest.endsAt
      display.restDuration = max(1, rest.duration)
      display.restOf = LiveWorkoutText.fill(strings["of"], [("duration", LiveWorkoutText.clock(rest.duration))])
    }

    // Rules 1, 3 and 5.
    display.mode = resting ? .rest : .set
    display.nowSetId = nowSet.id
    display.title = resting ? LiveWorkoutText.fill(strings["nextSet"], [("set", nowSet.text)]) : nowSet.text
    display.subtitle = shown.name + " · " + LiveWorkoutText.fill(strings["setOf"], position)
    display.setOfTitle = LiveWorkoutText.fill(strings["setOfTitle"], position)
    display.exerciseName = shown.name
    display.ringFraction = shown.sets.isEmpty ? 0 : Double(doneCount) / Double(shown.sets.count)
    display.ringText = String(doneCount) + "/" + String(shown.sets.count)
    display.ringLabel = strings["sets"] ?? ""

    return display
  }
}

/// A tap on the card.
struct LiveWorkoutAction {
  var type: String
  var setId: String?
  var seconds: Double?
  /// Unix seconds, when it was tapped.
  var at: Double
}

/// `applyLiveWorkoutAction(state, action, now)` (Reducer).
enum LiveWorkoutReducer {
  static func apply(_ state: LiveWorkoutState, action: LiveWorkoutAction, now: Double) -> LiveWorkoutState {
    let at: Double = action.at
    let display: LiveWorkoutDisplay = LiveWorkoutDisplay.derive(state, now: now, isStale: false)

    switch action.type {
    case "completeSet":
      guard display.mode == .set, let setId: String = action.setId, setId == display.nowSetId else {
        return state
      }

      // The exercise the card really shows: after an earlier tap it can be
      // `next` standing in for a finished one.
      var exercise: LiveWorkoutState.Exercise? = state.exercise
      var next: LiveWorkoutState.Exercise? = state.next
      var canPrev: Bool = state.canPrev
      var canNext: Bool = state.canNext

      if LiveWorkoutDisplay.firstToDo(exercise) == nil {
        exercise = next
        next = nil
        canPrev = false
        canNext = false
      }

      guard
        var shown: LiveWorkoutState.Exercise = exercise,
        let nowIndex: Int = LiveWorkoutDisplay.firstToDo(shown)
      else {
        return state
      }

      let nowSet: LiveWorkoutState.SetEntry = shown.sets[nowIndex]
      shown.sets[nowIndex].done = true

      let finishedExercise: Bool = shown.sets.allSatisfy { (entry: LiveWorkoutState.SetEntry) -> Bool in entry.done }
      let running: Bool = state.pausedElapsed == nil
      var rest: LiveWorkoutState.Rest? = nil

      if running && nowSet.rest > 0 {
        rest = LiveWorkoutState.Rest(startedAt: at, endsAt: at + nowSet.rest, duration: nowSet.rest)
      }

      var result: LiveWorkoutState.Exercise? = shown

      if finishedExercise {
        if let upcoming: LiveWorkoutState.Exercise = next, LiveWorkoutDisplay.firstToDo(upcoming) != nil {
          result = upcoming
        } else {
          result = nil
        }

        next = nil
        canPrev = false
        canNext = false
      }

      var changed: LiveWorkoutState = state
      changed.exercise = result
      changed.next = next
      changed.canPrev = canPrev
      changed.canNext = canNext
      changed.rest = rest
      changed.totals.done = state.totals.done + 1
      changed.totals.exercisesDone = state.totals.exercisesDone + (finishedExercise ? 1 : 0)
      return changed

    case "skipRest":
      guard state.rest != nil else {
        return state
      }

      var changed: LiveWorkoutState = state
      changed.rest = nil
      return changed

    case "adjustRest":
      guard let rest: LiveWorkoutState.Rest = state.rest else {
        return state
      }

      let seconds: Double = (action.seconds ?? 0).rounded(.towardZero)
      let endsAt: Double = rest.endsAt + seconds
      var changed: LiveWorkoutState = state

      if endsAt <= now {
        changed.rest = nil
        return changed
      }

      changed.rest = LiveWorkoutState.Rest(
        startedAt: rest.startedAt,
        endsAt: endsAt,
        duration: max(1, rest.duration + seconds)
      )
      return changed

    default:
      // prev / next only move what the card shows, and that is JavaScript's.
      return state
    }
  }
}
