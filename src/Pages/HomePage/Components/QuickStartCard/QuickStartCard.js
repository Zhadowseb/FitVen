import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import FirstWorkoutButton from "./FirstWorkoutButton";
import LivePanel from "./LivePanel";
import PlannedWorkoutCard from "./PlannedWorkoutCard";
import styles from "./QuickStartCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Plus from "@resources/Icons/UI-icons/Plus";
import Resistance from "@resources/Icons/WorkoutLabels/Resistance";
import { ThemedText } from "@resources/ThemedComponents";
import { workoutDisplayName } from "@utils/workoutTypeLabel";

/**
 * The one thing to press on Home.
 *
 * No box around it. The outline was a border around a border - every button
 * inside it already has one - and it made the block read as a widget rather
 * than as the screen's main action.
 *
 * The block is whichever of these is true first:
 *
 *   1. Today's workout is running. The whole block is one live panel that
 *      opens it - the set that is next, the rest counting down (LivePanel).
 *      `live` is what Home has read of that workout's sets.
 *   2. Something unfinished is already on today - planned in the calendar or
 *      a program, or started and paused. The whole block is that workout, in
 *      the accent, under "Planned today" or "Continue" (PlannedWorkoutCard).
 *   3. The split says whose turn it is. Start that, with the empty workout
 *      under it.
 *   4. Neither. Then the empty workout is all there is, and it stops being
 *      the quiet button under a primary one: it is the first workout, in the
 *      accent, filling the block (FirstWorkoutButton).
 *
 * Today's workout wins over the split deliberately, and it is shown alone.
 * Somebody who planned her week wants Home to say so; the split's name and an
 * empty workout beside it read as "nothing is planned". A fresh workout is
 * still the plus in the bottom bar, and any split card below still starts
 * that session - the deliberate way to train something other than the plan.
 */
export default function QuickStartCard({
  openToday = null,
  upNext = null,
  live = null,
  onContinueToday,
  onStartSplit,
  onStartEmpty,
  hasTrained = false,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const runningWorkout = openToday?.first?.isRunning ? openToday.first : null;

  if (runningWorkout) {
    return (
      <View style={styles.card}>
        <LivePanel
          workout={runningWorkout}
          live={live}
          onOpen={() => onContinueToday?.(runningWorkout)}
        />
      </View>
    );
  }

  // Planned, or started and paused: that workout is the block, and nothing
  // else is offered beside it. The eyebrow says which of the two it is.
  const todayWorkout = openToday?.first ?? null;

  if (todayWorkout) {
    return (
      <View style={styles.card}>
        <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
          {t(
            todayWorkout.isStarted
              ? "home.quickStart.continueEyebrow"
              : "home.quickStart.plannedEyebrow"
          )}
        </ThemedText>

        <PlannedWorkoutCard
          workout={todayWorkout}
          count={openToday?.count ?? 1}
          onPress={() => onContinueToday?.(todayWorkout)}
        />
      </View>
    );
  }

  // The same fallback SplitCards uses. pickGroupName returns null when nobody
  // named the session - which is what a session started from this button ends
  // up as - and without it the button draws no text at all, while the screen
  // reader reads the placeholder out literally.
  // A name that is only a stored type id ("Resistance") is drawn as the
  // type's name in the app's language (Utils/workoutTypeLabel).
  const upNextName =
    workoutDisplayName(upNext?.name, t) ??
    t("home.split.unnamed", { number: (upNext?.historyOrder ?? 0) + 1 });

  const primary = upNext
    ? {
        label: upNextName,
        accessibilityLabel: t("home.quickStart.startNamed", { name: upNextName }),
        onPress: () => onStartSplit?.(upNext),
      }
    : null;

  // The eyebrow names the block, not the button under it. It stays QUICK
  // START whether that button starts the one the split is due or starts the
  // first - what changed is which workout, and the button already says which.
  const eyebrow = (
    <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
      {t("home.quickStart.eyebrow")}
    </ThemedText>
  );

  // Nothing on today and nothing due: the empty workout is the only choice.
  if (!primary) {
    return (
      <View style={styles.card}>
        {eyebrow}
        <FirstWorkoutButton onPress={onStartEmpty} isFirst={!hasTrained} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {eyebrow}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={primary.accessibilityLabel}
        activeOpacity={0.85}
        onPress={primary.onPress}
        style={[
          styles.primaryButton,
          {
            backgroundColor: isLight ? theme.background : "#0F1116",
            borderColor: theme.primaryText,
          },
        ]}
      >
        <Resistance width={19} height={19} color={theme.primaryText} />

        <ThemedText
          style={styles.primaryLabel}
          setColor={theme.primaryText}
          numberOfLines={1}
        >
          {primary.label}
        </ThemedText>

        <View
          style={[
            styles.chevron,
            { borderLeftColor: withAlpha(theme.primaryText, 0.6) },
          ]}
        />
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("home.quickStart.startEmpty")}
        activeOpacity={0.85}
        onPress={onStartEmpty}
        style={[
          styles.secondaryButton,
          {
            backgroundColor: withAlpha(theme.title, isLight ? 0.04 : 0.05),
            borderColor: withAlpha(theme.title, isLight ? 0.08 : 0.1),
          },
        ]}
      >
        <Plus width={19} height={19} color={theme.mutedStrong} thickness={2.2} />

        <ThemedText style={styles.secondaryLabel} setColor={theme.text}>
          {t("home.quickStart.emptyWorkout")}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}
