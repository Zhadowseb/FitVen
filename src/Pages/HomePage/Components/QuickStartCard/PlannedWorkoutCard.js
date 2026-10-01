import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import quickStartStyles from "./QuickStartCardStyle";
import styles from "./PlannedWorkoutCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import { ThemedText } from "@resources/ThemedComponents";
import { workoutDisplayName } from "@utils/workoutTypeLabel";

/**
 * The workout already planned for today, as Quick start's only action.
 *
 * Somebody who planned her week wants Home to say so, not to offer the split's
 * next session and an empty workout beside it - both read as "nothing is
 * planned". So the block is one card in the accent: where it comes from (the
 * program, or the calendar), its name, and how big it is. A new workout is
 * still one press away on the plus in the bottom bar.
 *
 * The same card continues a workout that was started and paused, with the
 * time it has run instead of its size. A running one is the live panel, not
 * this.
 *
 * The whole card is what is pressed; the circle is only a picture of a button.
 * `count` is how many open workouts today has, this one included.
 */
export default function PlannedWorkoutCard({ workout, count = 1, onPress }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const ink = theme.textInverted;
  const quietInk = withAlpha(ink, 0.7);

  const name =
    workoutDisplayName(workout?.name, t, workout?.workoutType) ??
    t("home.quickStart.todaysWorkout");
  const exerciseCount = Number(workout?.exerciseCount) || 0;
  const setCount = Number(workout?.setCount) || 0;
  const isStarted = Boolean(workout?.isStarted);

  const source = workout?.programName
    ? t("home.quickStart.fromProgram", { program: workout.programName })
    : t("home.quickStart.fromCalendar");

  let meta;

  if (isStarted) {
    meta = t("home.quickStart.elapsed", {
      minutes: Math.max(0, Math.floor((Number(workout?.elapsedTime) || 0) / 60)),
    });
  } else if (exerciseCount === 0) {
    meta = t("home.quickStart.noExercises");
  } else if (count > 1) {
    meta = t("home.quickStart.moreToday", { n: exerciseCount, count: count - 1 });
  } else {
    meta = t("home.split.meta", { exercises: exerciseCount, sets: setCount });
  }

  const accessibilityLabel = isStarted
    ? t("home.quickStart.continueNamed", { name })
    : t("home.quickStart.startPlanned", { name, n: exerciseCount });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
    >
      <View style={styles.sourceRow}>
        <Calender width={13} height={13} color={ink} thickness={2} />

        <ThemedText style={styles.source} setColor={quietInk} numberOfLines={1}>
          {source}
        </ThemedText>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.text}>
          <ThemedText style={styles.name} setColor={ink} numberOfLines={1}>
            {name}
          </ThemedText>

          <ThemedText style={styles.meta} setColor={quietInk} numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>

        <View style={[styles.playCircle, { backgroundColor: ink }]}>
          <View
            style={[quickStartStyles.chevron, styles.play, { borderLeftColor: theme.primary }]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
