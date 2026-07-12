import { Image, Text, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./TodayHeroCardStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import CoverGradient from "../../../../Resources/Components/CoverGradient";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import Calender from "../../../../Resources/Icons/UI-icons/Calender";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import { getWorkoutCoverImage } from "../../../../Utils/workoutCoverImages";

// Spec one-offs that don't map onto a theme token (see FOUNDATION.md rule).
const GLASS_PILL_DARK = { background: "rgba(10, 11, 15, 0.72)", border: "rgba(255, 255, 255, 0.14)" };
const GLASS_PILL_LIGHT = { background: "rgba(255, 255, 255, 0.88)", border: "rgba(15, 17, 22, 0.14)" };
const META_TEXT_DARK = "#C4C7CF";

export default function TodayHeroCard({
  workout = null,
  onStartWorkout,
  nextWorkout = null,
  onOpenNextWorkout,
  onQuickStart,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const glassPill = isLight ? GLASS_PILL_LIGHT : GLASS_PILL_DARK;
  const metaTextColor = isLight ? theme.text : META_TEXT_DARK;

  if (!workout) {
    return (
      <View
        style={[
          styles.card,
          styles.emptyCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: theme.chipBackground },
          ]}
        >
          <Calender width={26} height={26} color={theme.quietText} thickness={1.7} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.title }]}>
          Nothing scheduled today
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.quietText }]}>
          Rest up, or jump into a quick workout.
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Quick start workout"
          onPress={onQuickStart}
          style={[
            styles.startButton,
            styles.emptyStartButton,
            {
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
        >
          <Text style={[styles.startButtonText, { color: theme.textInverted }]}>
            Quick start
          </Text>
        </TouchableOpacity>

        {nextWorkout ? (
          <UpNextRow
            theme={theme}
            nextWorkout={nextWorkout}
            onPress={onOpenNextWorkout}
            bare
          />
        ) : null}
      </View>
    );
  }

  if (workout.isCompleted) {
    return (
      <CompletedWorkoutCard
        workout={workout}
        nextWorkout={nextWorkout}
        onViewSummary={onStartWorkout}
        onOpenNextWorkout={onOpenNextWorkout}
        theme={theme}
      />
    );
  }

  const coverImage = getWorkoutCoverImage(workout.workoutType);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View style={styles.imageZone}>
        <Image source={coverImage} style={styles.image} resizeMode="cover" />
        <CoverGradient color={theme.cardBackground} />

        <View
          style={[
            styles.chip,
            styles.chipLeft,
            {
              backgroundColor: glassPill.background,
              borderColor: glassPill.border,
            },
          ]}
        >
          <View style={[styles.chipDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.chipLabel, { color: theme.title }]}>
            Today's workout
          </Text>
        </View>

        <View
          style={[
            styles.chip,
            styles.chipRight,
            { backgroundColor: withAlpha(theme.primary, 0.95) },
          ]}
        >
          <Text style={[styles.typeChipLabel, { color: theme.textInverted }]}>
            {workout.typeLabel}
          </Text>
        </View>

        <View style={styles.overlayText}>
          <Text style={[styles.heroTitle, { color: theme.title }]} numberOfLines={1}>
            {workout.title}
          </Text>
          <View style={styles.metaRow}>
            {workout.metaItems.map((metaItem, index) => (
              <View key={metaItem} style={styles.metaItemRow}>
                {index > 0 ? (
                  <View style={[styles.metaDot, { backgroundColor: theme.quietText }]} />
                ) : null}
                <Text style={[styles.metaText, { color: metaTextColor }]}>
                  {metaItem}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.buttonZone}>
        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Open workout"
          onPress={onStartWorkout}
          style={[
            styles.startButton,
            {
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
        >
          <View style={[styles.playTriangle, { borderLeftColor: theme.textInverted }]} />
          <Text style={[styles.startButtonText, { color: theme.textInverted }]}>
            Open workout
          </Text>
        </TouchableOpacity>
      </View>

      {nextWorkout ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
          <UpNextRow theme={theme} nextWorkout={nextWorkout} onPress={onOpenNextWorkout} />
        </>
      ) : null}
    </View>
  );
}

function CompletedWorkoutCard({
  workout,
  nextWorkout,
  onViewSummary,
  onOpenNextWorkout,
  theme,
}) {
  const coverImage = getWorkoutCoverImage(workout.workoutType);
  const completionColor = theme.COMPLETE ?? theme.secondary;
  const completionText = theme.inkOnSecondary ?? theme.ink;
  const completionMeta = [
    workout.completedAt ? `Finished ${workout.completedAt}` : "Finished",
    workout.durationLabel,
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        styles.completedCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: withAlpha(completionColor, 0.62),
        },
      ]}
    >
      <View style={[styles.imageZone, styles.completedImageZone]}>
        <Image source={coverImage} style={styles.image} resizeMode="cover" />
        <View
          pointerEvents="none"
          style={[
            styles.completedImageTint,
            { backgroundColor: withAlpha(completionColor, 0.2) },
          ]}
        />
        <CoverGradient color={theme.cardBackground} />

        <View
          style={[
            styles.chip,
            styles.chipLeft,
            styles.completedChip,
            {
              backgroundColor: withAlpha(theme.cardBackground, 0.78),
              borderColor: withAlpha(completionColor, 0.8),
            },
          ]}
        >
          <Checkmark width={14} height={14} color={completionColor} thickness={2.8} />
          <Text style={[styles.chipLabel, { color: completionColor }]}>Completed</Text>
        </View>

        <View
          style={[
            styles.completedCheckCircle,
            {
              backgroundColor: withAlpha(completionColor, 0.16),
              borderColor: withAlpha(completionColor, 0.76),
            },
          ]}
        >
          <Checkmark width={31} height={31} color={completionColor} thickness={2.7} />
        </View>

        <View style={styles.overlayText}>
          <Text style={[styles.heroTitle, { color: theme.title }]} numberOfLines={1}>
            {workout.title}
          </Text>
          <View style={styles.metaRow}>
            {completionMeta.map((metaItem, index) => (
              <View key={metaItem} style={styles.metaItemRow}>
                {index > 0 ? (
                  <View style={[styles.metaDot, { backgroundColor: theme.quietText }]} />
                ) : null}
                <Text
                  style={[
                    styles.metaText,
                    index === 0 && styles.completedMetaText,
                    { color: index === 0 ? completionColor : theme.title },
                  ]}
                >
                  {metaItem}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.completedBody}>
        <View
          style={[
            styles.completedSummary,
            {
              backgroundColor: withAlpha(completionColor, 0.1),
              borderColor: withAlpha(completionColor, 0.46),
            },
          ]}
        >
          <View style={[styles.completedSummaryIcon, { backgroundColor: completionColor }]}>
            <Checkmark width={29} height={29} color={completionText} thickness={3.1} />
          </View>
          <View style={styles.completedSummaryCopy}>
            <Text style={[styles.completedSummaryTitle, { color: theme.title }]}>
              Workout complete
            </Text>
            <Text style={[styles.completedSummarySubtitle, { color: theme.text }]}>
              Great work — you're done for today.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel={`View summary for ${workout.title}`}
          onPress={onViewSummary}
          style={[styles.summaryButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.summaryButtonText, { color: theme.title }]}>View summary</Text>
          <ChevronRight width={20} height={20} color={theme.title} thickness={2.4} />
        </TouchableOpacity>
      </View>

      {nextWorkout ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
          <UpNextRow theme={theme} nextWorkout={nextWorkout} onPress={onOpenNextWorkout} />
        </>
      ) : null}
    </View>
  );
}

function UpNextRow({ theme, nextWorkout, onPress, bare = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={`Open planned workout ${nextWorkout.title}`}
      onPress={onPress}
      style={[styles.upNextRow, bare && styles.upNextRowBare]}
    >
      <View
        style={[
          styles.dateBadge,
          {
            backgroundColor: theme.uiBackground,
            borderColor: theme.hairline,
          },
        ]}
      >
        <Text style={[styles.dateBadgeWeekday, { color: theme.primary }]}>
          {nextWorkout.weekday}
        </Text>
        <Text style={[styles.dateBadgeNumber, { color: theme.title }]}>
          {nextWorkout.day}
        </Text>
      </View>

      <View style={styles.upNextTextColumn}>
        <Text style={[styles.upNextEyebrow, { color: theme.quietText }]}>UP NEXT</Text>
        <Text style={[styles.upNextTitle, { color: theme.title }]} numberOfLines={1}>
          {nextWorkout.title}
        </Text>
      </View>

      <ChevronRight width={18} height={18} color={theme.quietText} thickness={2} />
    </TouchableOpacity>
  );
}
