import { View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./DaysSinceCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Fire from "@resources/Icons/UI-icons/Fire";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * Whole days since the last finished workout, of any type.
 *
 * The number is the point of the box, so it is the only thing drawn large. Zero
 * days is not "0 days since" - it is today, and the label says so instead of
 * making the reader work out that zero means well done.
 *
 * `days` is null when there has never been a workout: a dash, not a zero.
 */
export default function DaysSinceCard({ days = null }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const hasWorkouts = Number.isFinite(days);
  const value = hasWorkouts ? String(days) : t("home.daysSince.neverValue");
  const label = !hasWorkouts
    ? t("home.daysSince.never")
    : days === 0
      ? t("home.daysSince.today")
      : t("home.daysSince.days");

  return (
    <View
      style={[
        styles.card,
        {
          // The gradient in the design is three stops of the same green over
          // the card colour. A flat tint at the middle stop is the same
          // reading at this size and costs no extra view.
          backgroundColor: withAlpha(theme.secondary, 0.08),
          borderColor: withAlpha(theme.secondary, 0.22),
        },
      ]}
    >
      <Fire width={20} height={20} color={theme.secondary} />

      <ThemedText style={styles.value} setColor={theme.secondary}>
        {value}
      </ThemedText>

      <ThemedText style={styles.label} setColor={theme.quietText}>
        {label}
      </ThemedText>
    </View>
  );
}
