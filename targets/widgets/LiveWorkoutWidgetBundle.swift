// The widget extension's entry point. It holds only the Live Activity for a
// running strength workout; FitVen has no home screen widgets.

import SwiftUI
import WidgetKit

@main
struct FitVenWidgetBundle: WidgetBundle {
  var body: some Widget {
    LiveWorkoutLiveActivity()
  }
}
