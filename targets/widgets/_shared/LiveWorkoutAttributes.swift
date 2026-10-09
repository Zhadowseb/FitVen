// What ActivityKit keeps for the lock screen card of a running strength
// workout: the attributes, and the state JSON from JavaScript that the card is
// drawn from (`buildLiveWorkoutState` in src/Utils/liveWorkout.js).
//
// modules/live-workout/ios/LiveWorkoutAttributes.swift holds a byte-for-byte
// copy of the block between the markers. The Expo module cannot see this
// folder, and ActivityKit matches the two by the type's name, so they must
// decode and encode exactly alike. Change both, or the test fails.

import ActivityKit
import Foundation

// BEGIN LiveWorkoutAttributes
/// The state JSON JavaScript sends (version 1). Unknown keys are ignored. A
/// key that is missing, null or of another type reads as null, false, 0 or
/// "": a card drawn from part of the state beats no card at all.
///
/// Every time and number that a tap can turn into a fraction is a Double.
struct LiveWorkoutState: Codable, Hashable {
  struct SetEntry: Codable, Hashable {
    var id: String
    var text: String
    var short: String
    var done: Bool
    var rest: Double

    enum CodingKeys: String, CodingKey {
      case id, text, short, done, rest
    }
  }

  struct Exercise: Codable, Hashable {
    var name: String
    var index: Int
    var total: Int
    var sets: [SetEntry]

    enum CodingKeys: String, CodingKey {
      case name, index, total, sets
    }
  }

  struct Rest: Codable, Hashable {
    var startedAt: Double
    var endsAt: Double
    var duration: Double

    enum CodingKeys: String, CodingKey {
      case startedAt, endsAt, duration
    }
  }

  /// The rest counted up after a set with none written: from `startedAt`,
  /// shown from 15 s after it.
  struct CountUp: Codable, Hashable {
    var setId: String
    var startedAt: Double

    enum CodingKeys: String, CodingKey {
      case setId, startedAt
    }
  }

  struct Totals: Codable, Hashable {
    var done: Double
    var all: Double
    var exercisesDone: Double

    enum CodingKeys: String, CodingKey {
      case done, all, exercisesDone
    }
  }

  var v: Int
  var workoutId: String
  var workoutType: String
  var startedAt: Double
  var pausedElapsed: Double?
  var exercise: Exercise?
  var next: Exercise?
  var rest: Rest?
  var countUp: CountUp?
  var totals: Totals
  var canPrev: Bool
  var canNext: Bool
  var strings: [String: String]
  /// The link the all-done card's button opens the app with, to finish the
  /// workout there: `fitven://live-workout/finish?workoutId=7&type=Resistance`.
  var finishUrl: String?

  enum CodingKeys: String, CodingKey {
    case v, workoutId, workoutType, startedAt, pausedElapsed, exercise, next, rest, countUp, totals, canPrev, canNext, strings, finishUrl
  }

  /// The state in `json`, or nil when it is not a JSON object.
  static func decode(json: String) -> LiveWorkoutState? {
    guard let data: Data = json.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(LiveWorkoutState.self, from: data)
  }
}

extension LiveWorkoutState {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    v = container.liveWorkoutInt(.v) ?? 1
    workoutId = container.liveWorkoutString(.workoutId) ?? ""
    workoutType = container.liveWorkoutString(.workoutType) ?? ""
    startedAt = container.liveWorkoutDouble(.startedAt) ?? 0
    pausedElapsed = container.liveWorkoutDouble(.pausedElapsed)
    exercise = (try? container.decodeIfPresent(Exercise.self, forKey: .exercise)) ?? nil
    next = (try? container.decodeIfPresent(Exercise.self, forKey: .next)) ?? nil
    rest = (try? container.decodeIfPresent(Rest.self, forKey: .rest)) ?? nil
    countUp = (try? container.decodeIfPresent(CountUp.self, forKey: .countUp)) ?? nil
    totals = (try? container.decodeIfPresent(Totals.self, forKey: .totals)) ?? Totals(done: 0, all: 0, exercisesDone: 0)
    canPrev = container.liveWorkoutBool(.canPrev) ?? false
    canNext = container.liveWorkoutBool(.canNext) ?? false

    if let all: [String: String] = try? container.decodeIfPresent([String: String].self, forKey: .strings) {
      strings = all
    } else if let loose: [String: String?] = try? container.decodeIfPresent([String: String?].self, forKey: .strings) {
      strings = loose.compactMapValues { (value: String?) -> String? in value }
    } else {
      strings = [:]
    }

    finishUrl = container.liveWorkoutString(.finishUrl)
  }
}

extension LiveWorkoutState.SetEntry {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    id = container.liveWorkoutString(.id) ?? ""
    text = container.liveWorkoutString(.text) ?? ""
    short = container.liveWorkoutString(.short) ?? ""
    done = container.liveWorkoutBool(.done) ?? false
    rest = container.liveWorkoutDouble(.rest) ?? 0
  }
}

extension LiveWorkoutState.Exercise {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    name = container.liveWorkoutString(.name) ?? ""
    index = container.liveWorkoutInt(.index) ?? 0
    total = container.liveWorkoutInt(.total) ?? 0
    sets = (try? container.decodeIfPresent([LiveWorkoutState.SetEntry].self, forKey: .sets)) ?? []
  }
}

extension LiveWorkoutState.Rest {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    startedAt = container.liveWorkoutDouble(.startedAt) ?? 0
    endsAt = container.liveWorkoutDouble(.endsAt) ?? 0
    duration = container.liveWorkoutDouble(.duration) ?? 0
  }
}

extension LiveWorkoutState.CountUp {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    setId = container.liveWorkoutString(.setId) ?? ""
    startedAt = container.liveWorkoutDouble(.startedAt) ?? 0
  }
}

extension LiveWorkoutState.Totals {
  init(from decoder: Decoder) throws {
    let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)

    done = container.liveWorkoutDouble(.done) ?? 0
    all = container.liveWorkoutDouble(.all) ?? 0
    exercisesDone = container.liveWorkoutDouble(.exercisesDone) ?? 0
  }
}

/// The lenient reads behind the decoders above: a value of the wrong type is
/// converted when that makes sense, and is nil otherwise.
extension KeyedDecodingContainer {
  func liveWorkoutDouble(_ key: Key) -> Double? {
    if let value: Double = try? decodeIfPresent(Double.self, forKey: key) {
      return value.isFinite ? value : nil
    }

    if let text: String = try? decodeIfPresent(String.self, forKey: key), let value: Double = Double(text), value.isFinite {
      return value
    }

    return nil
  }

  func liveWorkoutInt(_ key: Key) -> Int? {
    if let value: Int = try? decodeIfPresent(Int.self, forKey: key) {
      return value
    }

    if let value: Double = liveWorkoutDouble(key), abs(value) < 1e15 {
      return Int(value.rounded(.towardZero))
    }

    return nil
  }

  func liveWorkoutBool(_ key: Key) -> Bool? {
    if let value: Bool = try? decodeIfPresent(Bool.self, forKey: key) {
      return value
    }

    if let value: Double = try? decodeIfPresent(Double.self, forKey: key) {
      return value != 0
    }

    return nil
  }

  func liveWorkoutString(_ key: Key) -> String? {
    if let value: String = try? decodeIfPresent(String.self, forKey: key) {
      return value
    }

    if let value: Double = try? decodeIfPresent(Double.self, forKey: key) {
      return LiveWorkoutNumber.text(value)
    }

    return nil
  }
}

enum LiveWorkoutNumber {
  /// A number the way JavaScript's String() writes it, near enough: "5", "11.5".
  static func text(_ value: Double) -> String {
    if value.isFinite && value == value.rounded() && abs(value) < 1e15 {
      return String(Int64(value))
    }

    return String(value)
  }
}

/// The card's attributes. Whatever can change lives in `ContentState`.
@available(iOS 16.1, *)
struct LiveWorkoutAttributes: ActivityAttributes {
  typealias ContentState = LiveWorkoutState

  var workoutId: String
  var workoutType: String
}
// END LiveWorkoutAttributes
