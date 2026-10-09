// The App Group store the Live Activity's buttons work from: the state the
// card was last drawn from, and the queue of taps JavaScript has not handled
// yet. The Expo module (modules/live-workout/ios) reads and writes the same
// keys; the names are the shared brief's and must not change on one side only.
//
// Everything that reads, changes and writes a key runs on the main thread, in
// the app's process: the intents through LiveWorkoutActionHandler, the module
// through the main queue. That keeps a tap and a drain from losing each other.

import Foundation

enum LiveWorkoutStore {
  static let appGroup: String = "group.com.fitven.app"
  static let stateKey: String = "liveWorkoutState"
  static let actionsKey: String = "liveWorkoutActions"
  static let wakeUpNotification: String = "com.fitven.app.liveWorkoutAction"
  static let maxQueuedActions: Int = 50

  private static func defaults() -> UserDefaults? {
    return UserDefaults(suiteName: appGroup)
  }

  /// The state the card was last drawn from, or nil.
  static func loadState() -> LiveWorkoutState? {
    guard let json: String = defaults()?.string(forKey: stateKey) else {
      return nil
    }

    return LiveWorkoutState.decode(json: json)
  }

  static func saveState(_ state: LiveWorkoutState) {
    guard
      let data: Data = try? JSONEncoder().encode(state),
      let json: String = String(data: data, encoding: .utf8)
    else {
      return
    }

    defaults()?.set(json, forKey: stateKey)
  }

  /// Adds a tap to the end of the queue, dropping the oldest past the cap.
  static func enqueue(_ entry: [String: Any]) {
    guard let store: UserDefaults = defaults() else {
      return
    }

    var queue: [Any] = []

    if
      let json: String = store.string(forKey: actionsKey),
      let data: Data = json.data(using: .utf8),
      let parsed: [Any] = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [Any]
    {
      queue = parsed
    }

    queue.append(entry)

    if queue.count > maxQueuedActions {
      queue.removeFirst(queue.count - maxQueuedActions)
    }

    guard
      JSONSerialization.isValidJSONObject(queue),
      let data: Data = try? JSONSerialization.data(withJSONObject: queue, options: []),
      let json: String = String(data: data, encoding: .utf8)
    else {
      return
    }

    store.set(json, forKey: actionsKey)
  }

  /// Tells the Expo module, if it is alive, that a tap is waiting.
  static func postWakeUp() {
    let center: CFNotificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
    let name: CFNotificationName = CFNotificationName(wakeUpNotification as CFString)

    CFNotificationCenterPostNotification(center, name, nil, nil, true)
  }
}
