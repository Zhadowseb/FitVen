import { Image, Text, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./TodayHeroCardStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import CoverGradient from "../../../../Resources/Components/CoverGradient";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
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
        <View style={styles.emptyCopy}>
          <Text
            style={[styles.emptyTitle, { color: theme.title }]}
            numberOfLines={1}
          >
            Nothing scheduled today
          </Text>

          <Text
            style={[styles.emptySubtitle, { color: theme.quietText }]}
            numberOfLines={2}
          >
            Rest up, or start a workout.
          </Text>

          <TouchableOpacity
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Quick start workout"
            onPress={onQuickStart}
            style={[
              styles.emptyStartButton,
              { backgroundColor: theme.primary },
            ]}
          >
            <Text
              style={[
                styles.emptyStartButtonText,
                { color: theme.textInverted },
              ]}
            >
              Quick start
            </Text>
          </TouchableOpacity>
        </View>

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
        onOpenWorkout={onStartWorkout}
        theme={theme}
      />
    );
  }

  const coverImage = getWorkoutCoverImage(workout.workoutType);
  // "Open" says nothing about what happens; the play icon promises a start.
  const primaryActionLabel = workout.isRunning
    ? "Continue"
    : workout.isStarted
      ? "Resume workout"
      : "Start workout";

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
          accessibilityLabel={primaryActionLabel}
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
            {primaryActionLabel}
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
  onOpenWorkout,
  theme,
}) {
  const coverImage = getWorkoutCoverImage(workout.workoutType);
  const completionColor = theme.COMPLETE ?? theme.secondary;
  const completionMeta = [
    workout.completedAt ? `Finished ${workout.completedAt}` : "Finished",
    workout.durationLabel,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Open completed workout ${workout.title}`}
      onPress={onOpenWorkout}
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

      {nextWorkout ? (
        <View style={styles.completedBody}>
          <UpNextRow
            theme={theme}
            nextWorkout={nextWorkout}
            bare
            interactive={false}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function UpNextRow({
  theme,
  nextWorkout,
  onPress,
  bare = false,
  interactive = true,
}) {
  const Container = interactive ? TouchableOpacity : View;

  return (
    <Container
      {...(interactive
        ? {
            activeOpacity: 0.84,
            accessibilityRole: "button",
            accessibilityLabel: `Open planned workout ${nextWorkout.title}`,
            onPress,
          }
        : {})}
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
    </Container>
  );
}
