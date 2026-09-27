// The Live Activity for a running strength workout: the lock screen card
// (1a set, 1b rest) and the Dynamic Island (1d: compact, minimal, expanded).
// Everything it draws is derived from the state by LiveWorkoutDisplay.derive,
// the same rules Android and src/Utils/liveWorkout.js follow.
//
// A tap on the card itself opens the app; there is no deep link.

import ActivityKit
import SwiftUI
import WidgetKit

struct LiveWorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveWorkoutAttributes.self) { context in
      LiveWorkoutLockScreenView(state: context.state, isStale: context.isStale)
        .activityBackgroundTint(LiveWorkoutColors.background.opacity(0.88))
        .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      LiveWorkoutIsland.make(state: context.state, isStale: context.isStale)
    }
  }
}

enum LiveWorkoutIsland {
  static func make(state: LiveWorkoutState, isStale: Bool) -> DynamicIsland {
    let display: LiveWorkoutDisplay = LiveWorkoutDisplay.derive(
      state,
      now: Date().timeIntervalSince1970,
      isStale: isStale
    )

    return DynamicIsland {
      // Row 1: ring 44 · title and exercise · clock and "11/18 sæt".
      DynamicIslandExpandedRegion(.leading) {
        LiveWorkoutRing(display: display, size: 44, lineWidth: 4, textSize: 14, showsLabel: false)
          .padding(.leading, 4)
      }

      DynamicIslandExpandedRegion(.trailing) {
        LiveWorkoutTrailingColumn(display: display, width: 72)
          .padding(.trailing, 4)
      }

      DynamicIslandExpandedRegion(.center) {
        LiveWorkoutTitles(title: display.title, subtitle: display.exerciseName)
      }

      // Row 2: "Sæt 3 af 4" and the orange pill.
      DynamicIslandExpandedRegion(.bottom) {
        LiveWorkoutIslandBottom(display: display)
      }
    } compactLeading: {
      LiveWorkoutTypeIcon(size: 22)
    } compactTrailing: {
      LiveWorkoutIslandCompactTime(display: display)
    } minimal: {
      LiveWorkoutTypeIcon(size: 22)
    }
    .keylineTint(LiveWorkoutColors.orange)
  }
}

/// The expanded island's bottom row. Nothing when there is nothing to do.
struct LiveWorkoutIslandBottom: View {
  let display: LiveWorkoutDisplay

  var body: some View {
    if display.hasButtons {
      HStack(alignment: .center, spacing: 12) {
        Text(display.setOfTitle)
          .font(.system(size: 17, weight: .heavy))
          .tracking(-0.3)
          .foregroundColor(LiveWorkoutColors.textPrimary)
          .lineLimit(1)
          .minimumScaleFactor(0.8)

        Spacer(minLength: 0)

        LiveWorkoutButtonsGate(display: display, island: true)
      }
      .padding(.horizontal, 4)
    }
  }
}

/// Compact trailing: the workout clock (14/700), or the rest countdown in
/// orange while resting.
struct LiveWorkoutIslandCompactTime: View {
  let display: LiveWorkoutDisplay

  var body: some View {
    if display.mode == .rest {
      LiveWorkoutRestCountdown(display: display, fontSize: 14, weight: .bold, width: 44)
    } else {
      LiveWorkoutClock(display: display, fontSize: 14, weight: .bold, width: 52)
    }
  }
}
