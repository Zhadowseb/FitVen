// The pieces the lock screen card (1a, 1b) and the Dynamic Island (1d) are
// built from. Sizes, weights and colours are the spec's: "17/800" is 17 pt at
// weight 800 (.heavy), 700 is .bold and 600 is .semibold.
//
// Every word comes from the state's strings; only numbers, "−15" / "+15" and
// SF Symbols are written here.

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

enum LiveWorkoutColors {
  static let orange: Color = Color(liveWorkoutHex: 0xF7742E)
  static let textPrimary: Color = Color(liveWorkoutHex: 0xF2F3F5)
  static let textSecondary: Color = Color(liveWorkoutHex: 0x9CA0AB)
  static let buttonInk: Color = Color(liveWorkoutHex: 0x14100C)
  static let background: Color = Color(liveWorkoutHex: 0x16181E)
  static let ringTrack: Color = Color.white.opacity(0.14)
  static let circleButton: Color = Color.white.opacity(0.10)
}

extension Color {
  init(liveWorkoutHex hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255.0,
      green: Double((hex >> 8) & 0xFF) / 255.0,
      blue: Double(hex & 0xFF) / 255.0
    )
  }
}

enum LiveWorkoutButtons {
  /// `Button(intent:)` and LiveActivityIntent are iOS 17. Before that the
  /// card has no buttons, and a tap on it opens the app.
  static var available: Bool {
    if #available(iOS 17.0, *) {
      return true
    }

    return false
  }
}

/// The workout type's icon (WorkoutLabels/Resistance). Every strength type
/// uses it. A template vector in Assets.xcassets, tinted orange.
struct LiveWorkoutTypeIcon: View {
  let size: CGFloat

  var body: some View {
    Image("workout.resistance")
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .foregroundColor(LiveWorkoutColors.orange)
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

/// The workout clock: counts up from `startedAt` by itself, or stands still
/// as text while the workout is paused.
struct LiveWorkoutClock: View {
  let display: LiveWorkoutDisplay
  let fontSize: CGFloat
  let weight: Font.Weight
  let width: CGFloat

  var body: some View {
    Group {
      if let stopped: String = display.clockStopped {
        Text(stopped)
      } else {
        Text(timerInterval: LiveWorkoutClock.countingRange(from: display.clockStartedAt), countsDown: false)
      }
    }
    .font(.system(size: fontSize, weight: weight).monospacedDigit())
    .foregroundColor(LiveWorkoutColors.textPrimary)
    .multilineTextAlignment(.trailing)
    .lineLimit(1)
    .frame(width: width, alignment: .trailing)
  }

  static func countingRange(from startedAt: Double) -> ClosedRange<Date> {
    let end: Date = Date.distantFuture
    let start: Date = Date(timeIntervalSince1970: min(startedAt, end.timeIntervalSince1970 - 1))

    return start...end
  }
}

/// The rest counting down to its end by itself, in orange.
struct LiveWorkoutRestCountdown: View {
  let display: LiveWorkoutDisplay
  let fontSize: CGFloat
  let weight: Font.Weight
  let width: CGFloat

  var body: some View {
    Text(timerInterval: LiveWorkoutRestCountdown.range(for: display), countsDown: true)
      .font(.system(size: fontSize, weight: weight).monospacedDigit())
      .foregroundColor(LiveWorkoutColors.orange)
      .multilineTextAlignment(.trailing)
      .lineLimit(1)
      .frame(width: width, alignment: .trailing)
  }

  /// From `endsAt − duration` to `endsAt`, so what is left, as a fraction, is
  /// JavaScript's (endsAt − now) / duration.
  static func range(for display: LiveWorkoutDisplay) -> ClosedRange<Date> {
    let end: Date = Date(timeIntervalSince1970: display.restEndsAt)
    let start: Date = Date(timeIntervalSince1970: display.restEndsAt - max(1, display.restDuration))

    return start...end
  }
}

/// The ring on the left: done sets over all sets in the exercise, with "3/4"
/// and "SÆT" in it; the rest counting down while resting; full with a tick
/// when every set is done; empty with the workout icon when there are none.
struct LiveWorkoutRing: View {
  let display: LiveWorkoutDisplay
  let size: CGFloat
  let lineWidth: CGFloat
  let textSize: CGFloat
  let showsLabel: Bool

  var body: some View {
    ZStack {
      switch display.mode {
      case .rest:
        ProgressView(
          timerInterval: LiveWorkoutRestCountdown.range(for: display),
          countsDown: true,
          label: { EmptyView() },
          currentValueLabel: { EmptyView() }
        )
        .progressViewStyle(.circular)
        .tint(LiveWorkoutColors.orange)

      case .set:
        Circle()
          .stroke(LiveWorkoutColors.ringTrack, lineWidth: lineWidth)

        if display.ringFraction > 0 {
          Circle()
            .trim(from: 0, to: CGFloat(min(1, display.ringFraction)))
            .stroke(LiveWorkoutColors.orange, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            .rotationEffect(.degrees(-90))
        }

        VStack(spacing: 0) {
          Text(display.ringText)
            .font(.system(size: textSize, weight: .heavy).monospacedDigit())
            .foregroundColor(LiveWorkoutColors.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)

          if showsLabel {
            Text(display.ringLabel)
              .font(.system(size: 8, weight: .heavy))
              .tracking(0.6)
              .foregroundColor(LiveWorkoutColors.textSecondary)
              .lineLimit(1)
          }
        }
        .padding(.horizontal, lineWidth)

      case .allDone:
        Circle()
          .stroke(LiveWorkoutColors.orange, lineWidth: lineWidth)

        Image(systemName: "checkmark")
          .font(.system(size: textSize, weight: .heavy))
          .foregroundColor(LiveWorkoutColors.orange)

      case .empty:
        Circle()
          .stroke(LiveWorkoutColors.ringTrack, lineWidth: lineWidth)

        LiveWorkoutTypeIcon(size: size * 0.46)
      }
    }
    .padding(lineWidth / 2)
    .frame(width: size, height: size)
  }
}

/// A round 44 button face: an SF Symbol, or a number such as "−15".
struct LiveWorkoutCircleFace: View {
  let systemImage: String?
  let text: String?
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle()
        .fill(LiveWorkoutColors.circleButton)

      if let systemImage: String = systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 16, weight: .bold))
          .foregroundColor(LiveWorkoutColors.textPrimary)
          .frame(width: 20, height: 20)
      } else if let text: String = text {
        Text(text)
          .font(.system(size: 14, weight: .heavy).monospacedDigit())
          .foregroundColor(LiveWorkoutColors.textPrimary)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
    }
    .frame(width: size, height: size)
  }
}

/// The orange pill: "Sæt færdigt" with a tick, or "Spring over" with skip.
struct LiveWorkoutPillFace: View {
  let systemImage: String
  let text: String
  let height: CGFloat
  let iconSize: CGFloat
  let textSize: CGFloat
  let expands: Bool

  var body: some View {
    let maxWidth: CGFloat? = expands ? CGFloat.infinity : nil

    HStack(spacing: 6) {
      Image(systemName: systemImage)
        .font(.system(size: iconSize * 0.85, weight: .heavy))
        .frame(width: iconSize, height: iconSize)

      Text(text)
        .font(.system(size: textSize, weight: .heavy))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .foregroundColor(LiveWorkoutColors.buttonInk)
    .padding(.horizontal, 16)
    .frame(maxWidth: maxWidth)
    .frame(height: height)
    .background(Capsule().fill(LiveWorkoutColors.orange))
  }
}

/// The lock screen card's bottom row (44): prev · complete · next while a set
/// is going, −15 · skip · +15 while resting.
@available(iOS 17.0, *)
struct LiveWorkoutButtonRow: View {
  let display: LiveWorkoutDisplay

  var body: some View {
    HStack(spacing: 10) {
      if display.mode == .rest {
        Button(intent: AdjustRestIntent(seconds: -15)) {
          LiveWorkoutCircleFace(systemImage: nil, text: "\u{2212}15", size: 44)
        }
        .buttonStyle(.plain)

        Button(intent: SkipRestIntent()) {
          LiveWorkoutPillFace(
            systemImage: "forward.end.fill",
            text: display.string("skip"),
            height: 44,
            iconSize: 18,
            textSize: 14,
            expands: true
          )
        }
        .buttonStyle(.plain)

        Button(intent: AdjustRestIntent(seconds: 15)) {
          LiveWorkoutCircleFace(systemImage: nil, text: "+15", size: 44)
        }
        .buttonStyle(.plain)
      } else {
        if display.canPrev {
          Button(intent: PrevExerciseIntent()) {
            LiveWorkoutCircleFace(systemImage: "chevron.left", text: nil, size: 44)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(Text(display.string("prev")))
        } else {
          LiveWorkoutCircleFace(systemImage: "chevron.left", text: nil, size: 44)
            .opacity(0.4)
            .accessibilityLabel(Text(display.string("prev")))
        }

        Button(intent: CompleteSetIntent(setId: display.nowSetId ?? "")) {
          LiveWorkoutPillFace(
            systemImage: "checkmark",
            text: display.string("complete"),
            height: 44,
            iconSize: 18,
            textSize: 14,
            expands: true
          )
        }
        .buttonStyle(.plain)

        if display.canNext {
          Button(intent: NextExerciseIntent()) {
            LiveWorkoutCircleFace(systemImage: "chevron.right", text: nil, size: 44)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(Text(display.string("next")))
        } else {
          LiveWorkoutCircleFace(systemImage: "chevron.right", text: nil, size: 44)
            .opacity(0.4)
            .accessibilityLabel(Text(display.string("next")))
        }
      }
    }
  }
}

/// The Dynamic Island's expanded pill (40): complete while a set is going,
/// skip while resting.
@available(iOS 17.0, *)
struct LiveWorkoutIslandButton: View {
  let display: LiveWorkoutDisplay

  var body: some View {
    if display.mode == .rest {
      Button(intent: SkipRestIntent()) {
        LiveWorkoutPillFace(
          systemImage: "forward.end.fill",
          text: display.string("skip"),
          height: 40,
          iconSize: 16,
          textSize: 13.5,
          expands: false
        )
      }
      .buttonStyle(.plain)
    } else if display.mode == .set {
      Button(intent: CompleteSetIntent(setId: display.nowSetId ?? "")) {
        LiveWorkoutPillFace(
          systemImage: "checkmark",
          text: display.string("complete"),
          height: 40,
          iconSize: 16,
          textSize: 13.5,
          expands: false
        )
      }
      .buttonStyle(.plain)
    }
  }
}

/// All done: the orange pill "Afslut" that opens the app on `finishUrl`,
/// where JavaScript finishes the workout and asks about the post. A plain
/// link, not an intent, so it works before iOS 17 too, and nothing is queued.
struct LiveWorkoutFinishLink: View {
  let url: URL
  let label: String
  let island: Bool

  var body: some View {
    Link(destination: url) {
      LiveWorkoutPillFace(
        systemImage: "flag.checkered",
        text: label,
        height: island ? 40 : 44,
        iconSize: island ? 16 : 18,
        textSize: island ? 13.5 : 14,
        expands: !island
      )
    }
  }
}

/// The card's buttons: the finish link when every set is done, otherwise the
/// set and rest buttons from iOS 17, and nothing before that.
struct LiveWorkoutButtonsGate: View {
  let display: LiveWorkoutDisplay
  let island: Bool

  var body: some View {
    if let url: URL = display.finishUrl {
      LiveWorkoutFinishLink(url: url, label: display.string("finish"), island: island)
    } else {
      LiveWorkoutIntentButtonsGate(display: display, island: island)
    }
  }
}

/// The set and rest buttons (App Intents): iOS 17 and later only.
struct LiveWorkoutIntentButtonsGate: View {
  let display: LiveWorkoutDisplay
  let island: Bool

  var body: some View {
    if display.hasIntentButtons {
      if #available(iOS 17.0, *) {
        if island {
          LiveWorkoutIslandButton(display: display)
        } else {
          LiveWorkoutButtonRow(display: display)
        }
      }
    }
  }
}

/// The right side: the workout clock and "11/18 sæt", or the rest countdown
/// and "af 3:00".
struct LiveWorkoutTrailingColumn: View {
  let display: LiveWorkoutDisplay
  let width: CGFloat

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      if display.mode == .rest {
        LiveWorkoutRestCountdown(display: display, fontSize: 17, weight: .heavy, width: width)

        Text(display.restOf)
          .font(.system(size: 11.5, weight: .bold))
          .foregroundColor(LiveWorkoutColors.textSecondary)
          .lineLimit(1)
      } else {
        LiveWorkoutClock(display: display, fontSize: 17, weight: .heavy, width: width)

        if display.hasSets {
          Text(display.setsCount)
            .font(.system(size: 11.5, weight: .bold).monospacedDigit())
            .foregroundColor(LiveWorkoutColors.textSecondary)
            .lineLimit(1)
        }
      }
    }
  }
}

/// The title and subtitle between the ring and the right side.
struct LiveWorkoutTitles: View {
  let title: String
  let subtitle: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(title)
        .font(.system(size: 17, weight: .heavy))
        .tracking(-0.3)
        .foregroundColor(LiveWorkoutColors.textPrimary)
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      if !subtitle.isEmpty {
        Text(subtitle)
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(LiveWorkoutColors.textSecondary)
          .lineLimit(1)
          .truncationMode(.tail)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// 1a / 1b: the card on the lock screen. 132 pt with buttons: padding 14,
/// the content row (48), a gap and the buttons (44). Without buttons (set or
/// rest before iOS 17, no sets, or all done without a finish link) it is only
/// the content row. No progress bar.
struct LiveWorkoutLockScreenView: View {
  let state: LiveWorkoutState
  let isStale: Bool

  var body: some View {
    let display: LiveWorkoutDisplay = LiveWorkoutDisplay.derive(
      state,
      now: Date().timeIntervalSince1970,
      isStale: isStale
    )
    let showsButtons: Bool = display.hasFinishLink || (LiveWorkoutButtons.available && display.hasIntentButtons)
    let height: CGFloat? = showsButtons ? 132 : nil

    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center, spacing: 12) {
        LiveWorkoutRing(display: display, size: 48, lineWidth: 4, textSize: 14, showsLabel: true)
        LiveWorkoutTitles(title: display.title, subtitle: display.subtitle)
        LiveWorkoutTrailingColumn(display: display, width: 76)
      }
      .frame(height: 48)

      if showsButtons {
        Spacer(minLength: 0)

        LiveWorkoutButtonsGate(display: display, island: false)
          .frame(height: 44)
      }
    }
    .padding(.vertical, 14)
    .padding(.horizontal, 16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .frame(height: height)
  }
}
