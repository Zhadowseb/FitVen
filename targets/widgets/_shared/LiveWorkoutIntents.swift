// The Live Activity's buttons (iOS 17+). They are compiled into the app as
// well as the widget extension, so the system runs them in the app's process,
// even when the app has to be launched in the background for it.
//
// A tap changes the card at once, without JavaScript (the Reducer in
// LiveWorkoutRules.swift), and always lands on the queue, which JavaScript
// drains the next time it runs. The titles below are required metadata that
// no screen shows: the intents are not discoverable.
//
// No Activity.request here: it is unavailable in app extensions. Starting a
// card is the Expo module's job.

import ActivityKit
import AppIntents
import Foundation

@available(iOS 17.0, *)
struct CompleteSetIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Complete set"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Set")
  var setId: String

  init() {}

  init(setId: String) {
    self.setId = setId
  }

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "completeSet", setId: setId, seconds: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
struct PrevExerciseIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Previous exercise"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "prev", setId: nil, seconds: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
struct NextExerciseIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Next exercise"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "next", setId: nil, seconds: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
struct AdjustRestIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Adjust rest"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Seconds")
  var seconds: Int

  init() {}

  init(seconds: Int) {
    self.seconds = seconds
  }

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "adjustRest", setId: nil, seconds: seconds)
    return .result()
  }
}

@available(iOS 17.0, *)
struct SkipRestIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Skip rest"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "skipRest", setId: nil, seconds: nil)
    return .result()
  }
}

/// "Afslut pause" on a rest being counted up, on the lock screen only.
@available(iOS 17.0, *)
struct EndCountUpIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "End rest"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Set")
  var setId: String

  init() {}

  init(setId: String) {
    self.setId = setId
  }

  func perform() async throws -> some IntentResult {
    await LiveWorkoutActionHandler.handle(type: "endCountUp", setId: setId, seconds: nil)
    return .result()
  }
}

@available(iOS 17.0, *)
enum LiveWorkoutActionHandler {
  /// After any tap: store the new state, redraw the card, queue the tap and
  /// wake the module. Prev / next change nothing and are only queued.
  @MainActor
  static func handle(type: String, setId: String?, seconds: Int?) async {
    let now: Double = Date().timeIntervalSince1970
    var entry: [String: Any] = [
      "id": UUID().uuidString.lowercased(),
      "type": type,
      "at": now,
    ]

    if let setId: String = setId {
      entry["setId"] = setId
    }

    if let seconds: Int = seconds {
      entry["seconds"] = seconds
    }

    if let state: LiveWorkoutState = LiveWorkoutStore.loadState() {
      let action: LiveWorkoutAction = LiveWorkoutAction(
        type: type,
        setId: setId,
        seconds: seconds.map { (value: Int) -> Double in Double(value) },
        at: now
      )
      let changed: LiveWorkoutState = LiveWorkoutReducer.apply(state, action: action, now: now)

      if changed != state {
        LiveWorkoutStore.saveState(changed)
        await LiveWorkoutActivitySync.redraw(changed)
      }
    }

    LiveWorkoutStore.enqueue(entry)
    LiveWorkoutStore.postWakeUp()
  }
}

@available(iOS 16.2, *)
enum LiveWorkoutActivitySync {
  /// The end of the rest while resting, so the card leaves rest mode by
  /// itself; 15 s after the tap while a count-up waits to show, so the card
  /// turns to it by itself; otherwise none.
  static func staleDate(for state: LiveWorkoutState, now: Double) -> Date? {
    if let rest: LiveWorkoutState.Rest = state.rest, rest.endsAt > now {
      return Date(timeIntervalSince1970: rest.endsAt)
    }

    if let countUp: LiveWorkoutState.CountUp = state.countUp {
      let showsAt: Double = countUp.startedAt + LiveWorkoutDisplay.countUpGraceSeconds

      if showsAt > now {
        return Date(timeIntervalSince1970: showsAt)
      }
    }

    return nil
  }

  /// Redraws the card for `state.workoutId`, if it is still there. One the
  /// user swiped away stays away.
  @MainActor
  static func redraw(_ state: LiveWorkoutState) async {
    let now: Double = Date().timeIntervalSince1970
    let content: ActivityContent<LiveWorkoutState> = ActivityContent(
      state: state,
      staleDate: staleDate(for: state, now: now)
    )

    for activity in Activity<LiveWorkoutAttributes>.activities {
      guard activity.attributes.workoutId == state.workoutId else {
        continue
      }

      guard activity.activityState == .active || activity.activityState == .stale else {
        continue
      }

      await activity.update(content)
    }
  }
}
