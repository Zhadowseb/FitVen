import { View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ExerciseTagsStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import {
  equipmentLabelKey,
  muscleToneToken,
  primaryMuscleKey,
  weightModeLabelKey,
} from "@utils/customExercises";
import { muscleGroupLabel } from "@utils/exerciseMuscleGroups";

/**
 * The primary muscle group of a shared exercise: a dot and the name in its
 * training group's colour, on a 12 % tint of it. The tone tokens are chosen to
 * hold 4.5:1 as text on exactly that tint, in both themes.
 */
export function MuscleTag({ muscleKey, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (!muscleKey) {
    return null;
  }

  const tone = theme[muscleToneToken(muscleKey)] ?? theme.primaryText;

  return (
    <View style={[styles.tag, { backgroundColor: withAlpha(tone, 0.12) }, style]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <ThemedText style={styles.tagText} setColor={tone} numberOfLines={1}>
        {muscleGroupLabel(muscleKey, t)}
      </ThemedText>
    </View>
  );
}

/**
 * What an exercise is, in three tags that wrap: the primary muscle, then the
 * equipment (when the owner said) and how its weight is counted.
 *
 * `muscles` is { primary, secondary } (or any shape the normaliser takes).
 */
export default function ExerciseTags({ muscles, equipment, weightMode, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const muscleKey = primaryMuscleKey(muscles);
  const details = [equipmentLabelKey(equipment), weightModeLabelKey(weightMode)].filter(Boolean);

  return (
    <View style={[styles.tags, style]}>
      <MuscleTag muscleKey={muscleKey} />
      {details.map((key) => (
        <View key={key} style={[styles.tag, { backgroundColor: theme.chipBackground }]}>
          <ThemedText style={styles.tagText} setColor={theme.mutedStrong} numberOfLines={1}>
            {t(key)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
