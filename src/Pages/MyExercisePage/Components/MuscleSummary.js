import { useMemo } from "react";
import { View, useColorScheme } from "react-native";

import styles from "./MuscleSummaryStyle";
import { useTranslation } from "@localization";
import BodyMapPreview from "@resources/Components/BodyMapPreview/BodyMapPreview";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { muscleToneToken, normalizeCustomExerciseMuscles } from "@utils/customExercises";
import {
  buildCustomExerciseMuscleMetadata,
  muscleGroupLabel,
} from "@utils/exerciseMuscleGroups";

function MuscleTag({ muscleKey, isPrimary, theme }) {
  const { t } = useTranslation();
  const tone = theme[muscleToneToken(muscleKey)] ?? theme.primaryText;

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: isPrimary ? withAlpha(tone, 0.12) : theme.chipBackground },
      ]}
    >
      <View
        style={
          isPrimary
            ? [styles.dot, { backgroundColor: tone }]
            : [styles.dotRing, { borderColor: tone }]
        }
      />
      <ThemedText
        style={styles.tagText}
        setColor={isPrimary ? tone : theme.mutedStrong}
        numberOfLines={1}
      >
        {muscleGroupLabel(muscleKey, t)}
      </ThemedText>
    </View>
  );
}

/**
 * What the exercise works: the primary muscles as tags in their training
 * group's colour, the secondary ones quieter, and the body from the front and
 * the back beside them - the same figure the create modal draws.
 *
 * Props: `muscles` - { primary: string[], secondary: string[] } muscle keys.
 */
export default function MuscleSummary({ muscles }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { primary, secondary } = useMemo(
    () => normalizeCustomExerciseMuscles(muscles),
    [muscles]
  );
  const metadata = useMemo(
    () => buildCustomExerciseMuscleMetadata({ primary, secondary }),
    [primary, secondary]
  );
  const hasMuscles = primary.length > 0 || secondary.length > 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.groups}>
        {primary.length > 0 ? (
          <View style={styles.group}>
            <ThemedText style={styles.groupLabel} setColor={theme.quietText}>
              {t("exercises.primary")}
            </ThemedText>
            <View style={styles.tags}>
              {primary.map((key) => (
                <MuscleTag key={key} muscleKey={key} isPrimary theme={theme} />
              ))}
            </View>
          </View>
        ) : null}

        {secondary.length > 0 ? (
          <View style={styles.group}>
            <ThemedText style={styles.groupLabel} setColor={theme.quietText}>
              {t("exercises.secondary")}
            </ThemedText>
            <View style={styles.tags}>
              {secondary.map((key) => (
                <MuscleTag key={key} muscleKey={key} isPrimary={false} theme={theme} />
              ))}
            </View>
          </View>
        ) : null}

        {!hasMuscles ? (
          <ThemedText style={styles.none} setColor={theme.quietText}>
            {t("myExercise.muscles.none")}
          </ThemedText>
        ) : null}
      </View>

      {/* The tags say it in words; the figure is the picture of the same
          thing, so a screen reader hears it once, as one image. */}
      <View
        style={styles.maps}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("myExercise.muscles.bodyMapA11y")}
      >
        <View style={styles.figure}>
          <BodyMapPreview
            bodyView="front"
            primaryRegionKeys={metadata.primary_front_body_map_region_keys}
            secondaryRegionKeys={metadata.secondary_front_body_map_region_keys}
            style={styles.map}
          />
          <ThemedText style={styles.mapLabel} setColor={theme.quietText}>
            {t("exercises.front")}
          </ThemedText>
        </View>
        <View style={styles.figure}>
          <BodyMapPreview
            bodyView="back"
            primaryRegionKeys={metadata.primary_back_body_map_region_keys}
            secondaryRegionKeys={metadata.secondary_back_body_map_region_keys}
            style={styles.map}
          />
          <ThemedText style={styles.mapLabel} setColor={theme.quietText}>
            {t("exercises.back")}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}
