import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import LivePanel from "./LivePanel";
import styles from "./QuickStartCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Plus from "@resources/Icons/UI-icons/Plus";
import Resistance from "@resources/Icons/WorkoutLabels/Resistance";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * The one thing to press on Home.
 *
 * No box around it. The outline was a border around a border - every button
 * inside it already has one - and it made the block read as a widget rather
 * than as the screen's main action.
 *
 * The top button is whichever of these is true first:
 *
 *   1. Something unfinished is already on today. Continue that.
 *   2. The split says whose turn it is. Start that.
 *   3. Neither, and the empty workout is the only button, filling the block.
 *
 * Today's workout wins over the split deliberately. Somebody who planned a
 * session this morning, or left one half-done at lunch, wants that one back;
 * offering to start a second one beside it is almost never what was meant.
 * The empty workout is always there, because sometimes it is.
 *
 * Except while today's workout is running. Then the whole block is one live
 * panel that opens it - the set that is next, the rest counting down - and
 * starting a second, empty one is not offered (LivePanel). `live` is what
 * Home has read of that workout's sets.
 */
export default function QuickStartCard({
  openToday = null,
  upNext = null,
  live = null,
  onContinueToday,
  onStartSplit,
  onStartEmpty,
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

  // The same fallback SplitCards uses. pickGroupName returns null when nobody
  // named the session - which is what a session started from this button ends
  // up as - and without it the button draws no text at all, while the screen
  // reader reads the placeholder out literally.
  const upNextName =
    upNext?.name ?? t("home.split.unnamed", { number: (upNext?.historyOrder ?? 0) + 1 });

  const todayWorkout = openToday?.first ?? null;
  const todayName = todayWorkout?.name ?? t("home.quickStart.todaysWorkout");
  const primary = todayWorkout
    ? {
        label: todayName,
        accessibilityLabel: t("home.quickStart.continueNamed", { name: todayName }),
        onPress: () => onContinueToday?.(todayWorkout),
      }
    : upNext
      ? {
          label: upNextName,
          accessibilityLabel: t("home.quickStart.startNamed", { name: upNextName }),
          onPress: () => onStartSplit?.(upNext),
        }
      : null;

  return (
    <View style={styles.card}>
      {/* The eyebrow names the block, not the button under it. It stays
          QUICK START whether that button continues today's workout or starts
          the one the split is due - what changed is which workout, and the
          button already says which. */}
      <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
        {t("home.quickStart.eyebrow")}
      </ThemedText>

      {primary ? (
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
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("home.quickStart.startEmpty")}
        activeOpacity={0.85}
        onPress={onStartEmpty}
        style={[
          styles.secondaryButton,
          // With nothing above it, the empty workout fills the block rather
          // than sitting at the bottom of an oddly tall one.
          primary ? null : styles.secondaryButtonAlone,
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
