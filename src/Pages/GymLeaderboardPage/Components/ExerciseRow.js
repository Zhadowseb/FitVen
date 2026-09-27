import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ExerciseRowStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import { ThemedText } from "@resources/ThemedComponents";
import { formatWeightKg, shortenDisplayName } from "@utils/gymUtils";

/**
 * One exercise ranked at the centre, from gymUtils.listCentreExercises: how
 * many lift it here and who leads, your own place when you have one, and a
 * tap to its list. `divider` draws the hairline under it.
 */
export default function ExerciseRow({ exercise, onPress, divider = false }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const lifters = Number(exercise?.lifterCount) || 0;
  const hasTop = lifters > 0 && Boolean(exercise?.topName) && exercise?.topWeightKg !== null && exercise?.topWeightKg !== undefined;
  const meta =
    lifters > 0
      ? [
          t("gyms.counts.lifters", { count: lifters, value: formatNumber(lifters) }),
          hasTop
            ? t("gyms.centreExercises.topLine", {
                name: shortenDisplayName(exercise.topName),
                weight: formatWeightKg(exercise.topWeightKg),
              })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : t("gyms.noLiftsYet");
  const myRank = Number(exercise?.myRank) || null;
  const label = [exercise?.name, meta, myRank ? t("gyms.centreExercises.yourRankA11y", { rank: myRank }) : null]
    .filter(Boolean)
    .join(", ");

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t("gyms.centreExercises.openHint")}
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.row}
      >
        <View style={[styles.tile, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
          <Dumbbell width={20} height={20} color={theme.primaryText} thickness={1.8} />
        </View>
        <View style={styles.copy}>
          <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
            {exercise?.name}
          </ThemedText>
          <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>
        {myRank ? (
          <ThemedText style={styles.rank} setColor={theme.primaryText} numberOfLines={1}>
            {t("gyms.centreExercises.yourRank", { rank: myRank })}
          </ThemedText>
        ) : null}
        <ChevronRight width={18} height={18} color={theme.chevron} />
      </TouchableOpacity>
      {divider ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
    </View>
  );
}
