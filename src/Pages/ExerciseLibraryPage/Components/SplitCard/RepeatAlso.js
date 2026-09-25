import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SplitCardStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import ReplayHistory from "@resources/Icons/UI-icons/ReplayHistory";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * "Repeat also": favourites outside the split, then the latest workouts, as
 * chips. A chip opens the repeat sheet for that workout.
 */
export default function RepeatAlso({ items = [], onPress }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (items.length === 0) {
    return null;
  }

  const when = (daysSince) =>
    daysSince <= 0
      ? t("train.repeatAlso.today")
      : daysSince === 1
        ? t("train.repeatAlso.yesterday")
        : t("train.repeatAlso.daysAgo", { count: daysSince });

  return (
    <View>
      <ThemedText style={styles.alsoHead} setColor={theme.quietText}>
        {t("train.repeatAlso.eyebrow")}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.alsoScroll}
        contentContainerStyle={styles.alsoRail}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${when(item.daysSince)}`}
            onPress={() => onPress?.(item)}
            style={[styles.chip, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
          >
            <ReplayHistory width={14} height={14} color={theme.primaryText ?? theme.primary} />
            <View style={styles.chipCopy}>
              <ThemedText style={styles.chipName} setColor={theme.title} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText style={styles.chipMeta} setColor={theme.quietText} numberOfLines={1}>
                {when(item.daysSince)}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
