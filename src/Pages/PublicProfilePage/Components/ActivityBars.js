import { StyleSheet, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ACTIVITY_WEEKS, buildActivityBars } from "@utils/publicProfileUtils";

const BAR_HEIGHT = 40;
// A week without a workout still has its place in the row, so a gap in the
// training reads as a gap rather than as a missing bar.
const EMPTY_BAR_HEIGHT = 4;

/**
 * Twelve weeks of finished workouts as bars: taller and stronger for a busier
 * week, this week in the accent. No dates and no number on a bar - the section
 * answers "does she train regularly", not "what did she do in week 34".
 */
export default function ActivityBars({ weeks }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const bars = buildActivityBars(weeks);
  // The ink the palette puts text in, faint: 0.08-0.18 on dark, 0.10-0.22 on
  // light, where a faint bar needs a little more to show on white.
  const [faintest, strongest] = colorScheme === "light" ? [0.1, 0.22] : [0.08, 0.18];

  return (
    <View
      style={styles.bars}
      accessible
      accessibilityLabel={t("publicProfile.activity.barsLabel", {
        count: ACTIVITY_WEEKS,
        weeks: bars.map((bar) => bar.count).join(", "),
      })}
    >
      {bars.map((bar, index) => (
        <View key={index} style={styles.slot}>
          <View
            style={[
              styles.bar,
              {
                height: Math.max(EMPTY_BAR_HEIGHT, Math.round(bar.level * BAR_HEIGHT)),
                backgroundColor: bar.isLatest
                  ? theme.primary
                  : withAlpha(theme.title, faintest + (strongest - faintest) * bar.level),
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

// Layout only.
const styles = StyleSheet.create({
  bars: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  slot: {
    flex: 1,
    height: BAR_HEIGHT,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
  },
});
