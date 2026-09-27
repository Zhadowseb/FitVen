// The iOS half of modules/live-workout: starts, updates and ends the Live
// Activity for a running strength workout, and hands JavaScript the taps its
// buttons queued. The card itself - its views and its buttons' intents - is
// in targets/widgets; see the shared brief and src/Utils/liveWorkout.js.
//
// The buttons run in the app's process (targets/widgets/_shared), change the
// card at once, queue the tap in the App Group and post a Darwin notification.
// This module turns that notification into `onLiveWorkoutAction`, a wake-up:
// JavaScript then calls drainActions() and only ever handles what that
// returns, so no tap is handled twice.

import ActivityKit
import ExpoModulesCore
import Foundation

public class LiveWorkoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveWorkout")

    Events("onLiveWorkoutAction")

    OnCreate {
      LiveWorkoutWakeUps.shared.attach(self)
    }

    OnDestroy {
      LiveWorkoutWakeUps.shared.detach(self)
    }

    /// iOS 16.2+ with Live Activities switched on for FitVen.
    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }

      return false
    }

    /// Ends every card there is, then shows one for `stateJson`.
    AsyncFunction("start") { (stateJson: String) async -> Bool in
      if #available(iOS 16.2, *) {
        return await LiveWorkoutActivities.start(stateJson: stateJson)
      }

      return false
    }

    /// Redraws the card for the state's workout. A card the user swiped away
    /// stays away: then nothing happens, and the answer is false.
    AsyncFunction("update") { (stateJson: String) async -> Bool in
      if #available(iOS 16.2, *) {
        return await LiveWorkoutActivities.update(stateJson: stateJson)
      }

      return false
    }

    /// Takes every card away at once, with the stored state and the queue.
    AsyncFunction("end") { () async -> Void in
      if #available(iOS 16.2, *) {
        await LiveWorkoutActivities.end()
      } else {
        await MainActor.run {
          LiveWorkoutSharedStore.clear()
        }
      }
    }

    /// The queued taps as a JSON array, oldest first, and an empty queue.
    AsyncFunction("drainActions") { () -> String in
      return LiveWorkoutSharedStore.drainActions()
    }
    .runOnQueue(.main)
  }

  fileprivate func emitActionQueued(_ type: String) {
    sendEvent("onLiveWorkoutAction", ["type": type])
  }
}

/// ActivityKit's side. Main actor, like the intents in the app, so a write
/// here and a tap there never interleave.
@available(iOS 16.2, *)
@MainActor
enum LiveWorkoutActivities {
  static func start(stateJson: String) async -> Bool {
    guard let state: LiveWorkoutState = LiveWorkoutState.decode(json: stateJson) else {
      return false
    }

    for activity in Activity<LiveWorkoutAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }

    LiveWorkoutSharedStore.saveState(json: stateJson)

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return false
    }

    let attributes: LiveWorkoutAttributes = LiveWorkoutAttributes(
      workoutId: state.workoutId,
      workoutType: state.workoutType
    )
    let content: ActivityContent<LiveWorkoutState> = ActivityContent(
      state: state,
      staleDate: staleDate(for: state)
    )

    do {
      _ = try Activity<LiveWorkoutAttributes>.request(attributes: attributes, content: content, pushType: nil)
      return true
    } catch {
      return false
    }
  }

  static func update(stateJson: String) async -> Bool {
    guard let state: LiveWorkoutState = LiveWorkoutState.decode(json: stateJson) else {
      return false
    }

    let live: [Activity<LiveWorkoutAttributes>] = Activity<LiveWorkoutAttributes>.activities.filter {
      (activity: Activity<LiveWorkoutAttributes>) -> Bool in
      activity.attributes.workoutId == state.workoutId
        && (activity.activityState == .active || activity.activityState == .stale)
    }

    if live.isEmpty {
      return false
    }

    LiveWorkoutSharedStore.saveState(json: stateJson)

    let content: ActivityContent<LiveWorkoutState> = ActivityContent(
      state: state,
      staleDate: staleDate(for: state)
    )

    for activity in live {
      await activity.update(content)
    }

    return true
  }

  static func end() async {
    for activity in Activity<LiveWorkoutAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }

    LiveWorkoutSharedStore.clear()
  }

  /// The end of the rest while resting, so the card leaves rest mode by
  /// itself if the app is not there to say so; otherwise none.
  static func staleDate(for state: LiveWorkoutState) -> Date? {
    guard let rest: LiveWorkoutState.Rest = state.rest, rest.endsAt > Date().timeIntervalSince1970 else {
      return nil
    }

    return Date(timeIntervalSince1970: rest.endsAt)
  }
}

/// The App Group store, with the same keys as
/// targets/widgets/_shared/LiveWorkoutStore.swift. Used on the main thread.
enum LiveWorkoutSharedStore {
  static let appGroup: String = "group.com.fitven.app"
  static let stateKey: String = "liveWorkoutState"
  static let actionsKey: String = "liveWorkoutActions"
  static let wakeUpNotification: String = "com.fitven.app.liveWorkoutAction"

  private static func defaults() -> UserDefaults? {
    return UserDefaults(suiteName: appGroup)
  }

  /// The state exactly as JavaScript sent it; the buttons work from it.
  static func saveState(json: String) {
    defaults()?.set(json, forKey: stateKey)
  }

  static func clear() {
    guard let store: UserDefaults = defaults() else {
      return
    }

    store.removeObject(forKey: stateKey)
    store.removeObject(forKey: actionsKey)
  }

  /// The queue as it was, and an empty one in its place. "[]" when there is
  /// nothing, or nothing readable.
  static func drainActions() -> String {
    guard let store: UserDefaults = defaults() else {
      return "[]"
    }

    let json: String? = store.string(forKey: actionsKey)
    store.removeObject(forKey: actionsKey)

    guard
      let text: String = json,
      let data: Data = text.data(using: .utf8),
      let parsed: Any = try? JSONSerialization.jsonObject(with: data, options: []),
      parsed is [Any]
    else {
      return "[]"
    }

    return text
  }

  /// The type of the newest queued tap, for the wake-up event.
  static func newestActionType() -> String? {
    guard
      let json: String = defaults()?.string(forKey: actionsKey),
      let data: Data = json.data(using: .utf8),
      let parsed: [Any] = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [Any],
      let newest: [String: Any] = parsed.last as? [String: Any],
      let type: String = newest["type"] as? String
    else {
      return nil
    }

    return type
  }
}

/// Listens for the buttons' Darwin notification for the whole process. It is
/// registered once and never goes away, so the C callback can never reach a
/// module that has; the module it wakes is held weakly and swapped on reload.
final class LiveWorkoutWakeUps {
  static let shared: LiveWorkoutWakeUps = LiveWorkoutWakeUps()

  private let lock: NSLock = NSLock()
  private weak var module: LiveWorkoutModule?
  private var registered: Bool = false

  func attach(_ module: LiveWorkoutModule) {
    lock.lock()
    self.module = module
    let needsRegistering: Bool = !registered
    registered = true
    lock.unlock()

    if needsRegistering {
      register()
    }
  }

  func detach(_ module: LiveWorkoutModule) {
    lock.lock()
    if self.module === module {
      self.module = nil
    }
    lock.unlock()
  }

  fileprivate func fire() {
    lock.lock()
    let module: LiveWorkoutModule? = self.module
    lock.unlock()

    guard let module: LiveWorkoutModule = module else {
      return
    }

    // The store is only read on the main thread.
    DispatchQueue.main.async {
      module.emitActionQueued(LiveWorkoutSharedStore.newestActionType() ?? "")
    }
  }

  private func register() {
    let center: CFNotificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
    let observer: UnsafeRawPointer = UnsafeRawPointer(Unmanaged.passUnretained(self).toOpaque())

    CFNotificationCenterAddObserver(
      center,
      observer,
      { (_: CFNotificationCenter?, _: UnsafeMutableRawPointer?, _: CFNotificationName?, _: UnsafeRawPointer?, _: CFDictionary?) -> Void in
        LiveWorkoutWakeUps.shared.fire()
      },
      LiveWorkoutSharedStore.wakeUpNotification as CFString,
      nil,
      .deliverImmediately
    )
  }
}
