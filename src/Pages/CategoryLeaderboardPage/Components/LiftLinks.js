import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./LiftLinksStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "@resources/ThemedComponents";

export const POWERLIFTING_LIFTS = ["bench", "squat", "deadlift"];

/**
 * Under Powerlifting: the three lifts the total is made of, each to its own
 * board - the centre's at a centre, the national one above it. The page
 * finds the exercise behind each one; the buttons only say which was pressed.
 */
export default function LiftLinks({ atGym = false, onOpen }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.block}>
      <ThemedText style={styles.overline} setColor={theme.quietText} numberOfLines={1}>
        {t("category.lifts.title")}
      </ThemedText>
      <View style={styles.buttons}>
        {POWERLIFTING_LIFTS.map((lift) => (
          <TouchableOpacity
            key={lift}
            accessibilityRole="button"
            accessibilityHint={atGym ? t("category.lifts.gymHint") : t("category.lifts.nationalHint")}
            activeOpacity={0.82}
            onPress={() => onOpen?.(lift)}
            style={[styles.button, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
          >
            <ThemedText
              style={styles.label}
              setColor={theme.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t(`category.lifts.${lift}`)}
            </ThemedText>
            <ChevronRight width={12} height={12} color={theme.chevron} thickness={2.4} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
