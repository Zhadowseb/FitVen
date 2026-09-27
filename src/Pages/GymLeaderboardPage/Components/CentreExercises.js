import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CentreExercisesStyle";
import ExerciseRow from "./ExerciseRow";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Layers from "@resources/Icons/UI-icons/Layers";
import { ThemedText } from "@resources/ThemedComponents";

// How many of the centre's exercises the section lists before "All exercises".
export const EXERCISE_PREVIEW_COUNT = 5;

/**
 * The centre's exercises as a section of their own, under the categories:
 * the ones most people lift here, each a tap from its list, and "All
 * exercises" - every exercise ranked here, a chip each on the exercise page.
 * `exercises` is gymUtils.listCentreExercises, most lifters first.
 */
export default function CentreExercises({ exercises = [], onOpen, onOpenAll }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const lifted = exercises.filter((exercise) => exercise.lifterCount > 0);
  const preview = lifted.slice(0, EXERCISE_PREVIEW_COUNT);

  if (exercises.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionLabel} setColor={theme.quietText} numberOfLines={1} accessibilityRole="header">
          {t("gyms.centreExercises.title")}
        </ThemedText>
        <ThemedText style={styles.sectionHint} setColor={theme.quietText} numberOfLines={1}>
          {t("gyms.centreExercises.sortedByLifters")}
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        {preview.length === 0 ? (
          <View style={styles.emptyLine}>
            <ThemedText style={styles.emptyTitle} setColor={theme.title}>
              {t("gyms.noLiftsYet")}
            </ThemedText>
            <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
              {t("gyms.centreExercises.emptyBody")}
            </ThemedText>
          </View>
        ) : (
          preview.map((exercise) => (
            <ExerciseRow key={exercise.id} exercise={exercise} onPress={() => onOpen?.(exercise.id)} divider />
          ))
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityHint={t("gyms.centreExercises.allHint")}
          activeOpacity={0.85}
          onPress={onOpenAll}
          style={[styles.allRow, preview.length === 0 ? { borderTopWidth: 1, borderTopColor: theme.hairline } : null]}
        >
          <View style={[styles.allTile, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
            <Layers width={19} height={19} color={theme.primaryText} />
          </View>
          <View style={styles.allCopy}>
            <ThemedText style={styles.allTitle} setColor={theme.primaryText} numberOfLines={1}>
              {t("gyms.overview.allExercises")}
            </ThemedText>
            <ThemedText style={styles.allDetail} setColor={theme.quietText} numberOfLines={1}>
              {t("gyms.centreExercises.allDetail", { count: exercises.length })}
            </ThemedText>
          </View>
          <ChevronRight width={18} height={18} color={theme.primaryText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
