import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./MuscleFilterSheetStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";
import { muscleToneToken } from "@utils/customExercises";
import { EXERCISE_MUSCLE_GROUPS, muscleGroupLabel } from "@utils/exerciseMuscleGroups";

// The sixteen groups under the four training groups their tags are coloured
// by, so the dot beside each name means the same here as on a row.
const TRAINING_GROUPS = [
  { key: "push", labelKey: "exercises.trainingGroups.push" },
  { key: "pull", labelKey: "exercises.trainingGroups.pull" },
  { key: "legs", labelKey: "exercises.trainingGroups.legs" },
  { key: "core", labelKey: "exercises.trainingGroups.core" },
].map((group) => ({
  ...group,
  muscleKeys: EXERCISE_MUSCLE_GROUPS.filter((muscle) => muscle.trainingGroupKey === group.key).map(
    (muscle) => muscle.key
  ),
}));

const CHIP_HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

/**
 * Which muscle group the library shows: all of them, or one. One tap chooses
 * and hands the key to `onSelect` (null for all); the page closes the sheet.
 */
export default function MuscleFilterSheet({ visible, value = null, onSelect, onClose }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const chip = (key) => {
    const selected = (key ?? null) === (value ?? null);
    const label = key ? muscleGroupLabel(key, t) : t("exercises.muscleGroups.all");

    return (
      <TouchableOpacity
        key={key ?? "all"}
        activeOpacity={0.84}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        hitSlop={CHIP_HIT_SLOP}
        onPress={() => onSelect?.(key ?? null)}
        style={[
          styles.chip,
          selected
            ? {
                backgroundColor: withAlpha(theme.primary, 0.12),
                borderColor: withAlpha(theme.primary, 0.4),
              }
            : { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
        ]}
      >
        {key ? <View style={[styles.dot, { backgroundColor: theme[muscleToneToken(key)] }]} /> : null}
        <ThemedText
          style={styles.chipText}
          setColor={selected ? theme.primaryText : theme.mutedStrong}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.overline} setColor={theme.quietText}>
            {t("customExercises.library.filter")}
          </ThemedText>
          <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
            {t("customExercises.library.filterTitle")}
          </ThemedText>
        </View>

        {value ? (
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel={t("customExercises.library.resetFilter")}
            hitSlop={6}
            onPress={() => onSelect?.(null)}
            style={[styles.reset, { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }]}
          >
            <ThemedText style={styles.resetText} setColor={theme.title}>
              {t("customExercises.library.reset")}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.chips}>{chip(null)}</View>
      </View>

      {TRAINING_GROUPS.map((group) => (
        <View key={group.key} style={styles.section}>
          <ThemedText style={styles.sectionLabel} setColor={theme.quietText}>
            {t(group.labelKey)}
          </ThemedText>
          <View style={styles.chips}>{group.muscleKeys.map((key) => chip(key))}</View>
        </View>
      ))}
    </ThemedBottomSheet>
  );
}
