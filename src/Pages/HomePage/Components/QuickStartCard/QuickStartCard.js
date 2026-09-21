import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./QuickStartCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Plus from "@resources/Icons/UI-icons/Plus";
import Resistance from "@resources/Icons/WorkoutLabels/Resistance";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * Two buttons: the session that is next in the split, and an empty workout.
 *
 * Both open the workout straight away. There is no sheet in between, because
 * the whole point of the box is that somebody who already knows what they are
 * doing does not have to answer a question first.
 *
 * `upNext` is null when there is no recognisable split, and then the empty
 * workout takes the whole box rather than leaving a gap where a guess would go.
 */
export default function QuickStartCard({ upNext = null, onStartSplit, onStartEmpty }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  // The same fallback SplitCards uses. pickGroupName returns null when nobody
  // named the session - which is exactly what a session started from this
  // button ends up as - and without it the main button on Home draws no text
  // at all, while the screen reader reads the placeholder out literally.
  const upNextName =
    upNext?.name ?? t("home.split.unnamed", { number: (upNext?.historyOrder ?? 0) + 1 });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
        {t("home.quickStart.eyebrow")}
      </ThemedText>

      {upNext ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("home.quickStart.startNamed", { name: upNextName })}
          activeOpacity={0.85}
          onPress={() => onStartSplit?.(upNext)}
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
            {upNextName}
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
          // With nothing above it, the empty workout fills the box rather than
          // sitting at the bottom of an oddly tall card.
          upNext ? null : styles.secondaryButtonAlone,
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
