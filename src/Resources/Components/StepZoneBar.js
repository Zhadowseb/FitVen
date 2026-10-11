import { StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import ThemedText from "../ThemedComponents/ThemedText";
import { STEP_BAR_TICKS, STEP_ZONES, getZoneBarSegments } from "../../Utils/stepZones";

// The segmented zone bar on Home: a 0-12,000 scale split into the five zones
// with a 3 px gap between them, each segment filling up to the day's active
// steps in its own zone's colour. The steps training added are a 3 px orange
// line under the bar, from where the walked steps ended, and may cross several
// segments. Only the small tick labels sit under it - no zone names.
//
// Colours come from the theme at render time (never from a Style.js), so the
// accent and light mode are followed.

const GAP = 3;

export default function StepZoneBar({ walked, active }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const segments = getZoneBarSegments(walked, active);

  return (
    <View
      // The card around it carries the full sentence.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.row}>
        {segments.map((segment) => (
          <View key={segment.id} style={[styles.segment, { flex: segment.widthShare }]}>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${segment.fill * 100}%`,
                    backgroundColor: theme.stepZones[segment.id],
                  },
                ]}
              />
            </View>
            {segment.trainingTo > segment.trainingFrom ? (
              <View
                style={[
                  styles.training,
                  {
                    left: `${segment.trainingFrom * 100}%`,
                    width: `${(segment.trainingTo - segment.trainingFrom) * 100}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.row}>
        {STEP_ZONES.map((zone, index) => (
          <View key={zone.id} style={{ flex: segments[index].widthShare }}>
            {STEP_BAR_TICKS[index] ? (
              <ThemedText style={styles.tick} setColor={theme.quietText} numberOfLines={1}>
                {STEP_BAR_TICKS[index].label}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: GAP,
  },
  segment: {
    height: 15,
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 8,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  training: {
    position: "absolute",
    top: 11,
    height: 3,
    borderRadius: 1.5,
  },
  tick: {
    textAlign: "right",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
