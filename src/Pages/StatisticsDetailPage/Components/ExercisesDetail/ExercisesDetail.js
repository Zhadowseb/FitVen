import { useMemo } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import localStyles from "./ExercisesDetailStyle";
import { EmptyState, Section } from "../DetailBlocks/DetailBlocks";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "@resources/ThemedComponents";
import { formatRelativeDay } from "@utils/dateUtils";
import { buildPeriodExercises } from "@utils/statisticsInsights";

function formatKg(value) {
  return formatNumber(Math.round(value * 2) / 2, { maximumFractionDigits: 1 });
}

/**
 * Every exercise trained in the period, most recently trained first: its
 * heaviest lift in the period, when it was last trained, and which way it is
 * going. A row opens the exercise.
 */
export default function ExercisesDetail({ sets, period, now, onSelectExercise, emptyBody }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const quiet = theme.quietText;
  const title = theme.title;
  const hairline = theme.hairline;
  const up = theme.secondary;
  // A decline is not an error, so not `danger`: the overview's own muted red.
  const down = scheme === "dark" ? "#D4685C" : "#B4503F";
  const exercises = useMemo(
    () => buildPeriodExercises(sets, { period, now }),
    [sets, period, now]
  );

  if (exercises.length === 0) {
    return <EmptyState title={t("statistics.exercises.empty")} body={emptyBody} />;
  }

  const directionMark = (direction) =>
    direction === "up"
      ? { glyph: "↑", tone: up, label: t("statistics.exercises.up") }
      : direction === "down"
        ? { glyph: "↓", tone: down, label: t("statistics.exercises.down") }
        : direction === "flat"
          ? { glyph: "→", tone: quiet, label: t("statistics.exercises.flat") }
          : null;

  return (
    <Section label={t("statistics.exercises.listTitle")} note={formatNumber(exercises.length)}>
      <View
        style={[
          localStyles.listCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        {exercises.map((exercise, index) => {
          const mark = directionMark(exercise.direction);

          return (
            <TouchableOpacity
              key={exercise.name}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("statistics.exercises.open", { name: exercise.name })}
              onPress={() => onSelectExercise?.(exercise.name)}
              style={[
                localStyles.exerciseRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: hairline },
              ]}
            >
              <View style={localStyles.exerciseCopy}>
                <ThemedText style={localStyles.exerciseName} setColor={title} numberOfLines={1}>
                  {exercise.name}
                </ThemedText>
                <ThemedText style={localStyles.caption} setColor={quiet} numberOfLines={1}>
                  {t("statistics.exercises.heaviest", {
                    lift: `${formatKg(exercise.heaviest.weight)} ${t("common.kg")} × ${exercise.heaviest.reps}`,
                  })}
                  {` · ${formatRelativeDay(exercise.lastAt, now)}`}
                </ThemedText>
              </View>
              {mark ? (
                <View
                  accessibilityLabel={mark.label}
                  style={[localStyles.directionPill, { backgroundColor: withAlpha(mark.tone, 0.14) }]}
                >
                  <ThemedText style={localStyles.directionText} setColor={mark.tone}>
                    {mark.glyph}
                  </ThemedText>
                </View>
              ) : null}
              <ChevronRight width={15} height={15} color={quiet} />
            </TouchableOpacity>
          );
        })}
      </View>
    </Section>
  );
}
