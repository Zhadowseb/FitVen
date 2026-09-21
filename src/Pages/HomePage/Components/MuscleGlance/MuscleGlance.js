import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./MuscleGlanceStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

const TRACK_HEIGHT = 38;

/**
 * Last month against the month before, one bar per muscle group.
 *
 * It has to be readable in half a second, so there are no axes, no legend and
 * no card around it. Anything that needs explaining belongs in Records, and
 * the whole block opens Records when tapped.
 *
 * A group with too little to compare draws a low grey bar and a dash rather
 * than an empty column: a gap in the row reads as an error, not as "no data".
 */
export default function MuscleGlance({ groups = [], headline = null, onOpen }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (!groups.length) {
    return null;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("home.muscleGlance.open")}
      activeOpacity={0.9}
      onPress={onOpen}
      style={styles.container}
    >
      <View style={styles.header}>
        <ThemedText style={styles.title} setColor={theme.quietText}>
          {t("home.muscleGlance.title")}
        </ThemedText>

        <ThemedText
          style={styles.headline}
          setColor={headline ? theme.secondary : theme.quietText}
          numberOfLines={1}
        >
          {headline
            ? t("home.muscleGlance.gaining", { group: headline })
            : t("home.muscleGlance.noGain")}
        </ThemedText>
      </View>

      <View style={styles.bars}>
        {groups.map((group) => (
          <View key={group.label} style={styles.column}>
            <ThemedText
              style={styles.value}
              setColor={group.isGain ? theme.secondary : theme.quietText}
            >
              {group.deltaPercent === null
                ? t("home.muscleGlance.noData")
                : `+${group.deltaPercent}%`}
            </ThemedText>

            <View
              style={[
                styles.track,
                { backgroundColor: withAlpha(theme.title, 0.05) },
              ]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    height: Math.round(TRACK_HEIGHT * group.fill),
                    backgroundColor: group.isGain
                      ? theme.secondary
                      : withAlpha(theme.title, 0.14),
                  },
                ]}
              />
            </View>

            <ThemedText
              style={styles.name}
              setColor={theme.quietText}
              numberOfLines={1}
            >
              {group.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}
