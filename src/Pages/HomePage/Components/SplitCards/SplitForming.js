import { View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SplitCardsStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { SPLIT_FORMING_DAYS } from "@utils/splitForming";

const DAYS = Array.from({ length: SPLIT_FORMING_DAYS }, (_, index) => index);

/**
 * The split before there is one to show: a dot for each day of the first
 * week, filled from the day of the first finished workout on
 * (splitFormingState), and a line saying when it will be ready.
 *
 * It says what the block will become rather than leaving a hole, and there is
 * nothing to open yet, so it is not a button and has no chevron. A screen
 * reader hears which day of the seven it is; with no workout yet there is no
 * day to count, and it hears the line instead. After the week, with still no
 * split to show, the dots are full and the line says a split needs sessions
 * that repeat.
 */
export default function SplitForming({ filledDots = 0, weekIsOver = false }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Past the first week with nothing to show yet, the week has already been
  // waited for; what is missing is a session done twice.
  const message = weekIsOver ? t("home.split.waiting") : t("home.split.forming");

  return (
    <View
      accessible
      accessibilityLabel={
        !weekIsOver && filledDots > 0
          ? t("home.split.formingA11y", { count: filledDots })
          : message
      }
      style={[
        styles.forming,
        {
          backgroundColor: withAlpha(theme.title, 0.04),
          borderColor: withAlpha(theme.title, 0.07),
        },
      ]}
    >
      <View style={styles.formingDots}>
        {DAYS.map((day) => (
          <View
            key={day}
            style={[
              styles.formingDot,
              day < filledDots
                ? { backgroundColor: theme.primary }
                : [styles.formingDotEmpty, { borderColor: withAlpha(theme.title, 0.22) }],
            ]}
          />
        ))}
      </View>

      <ThemedText style={styles.formingText} setColor={theme.text} numberOfLines={1}>
        {message}
      </ThemedText>
    </View>
  );
}
