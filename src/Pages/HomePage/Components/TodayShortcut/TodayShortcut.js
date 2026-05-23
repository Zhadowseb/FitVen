import { useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";

import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import { getWorkoutIconConfig } from "../../../../Resources/Icons/WorkoutLabels";
import { getTodaysDate } from "../../../../Utils/dateUtils";
import { programService } from "../../../../Services";
import styles from "./TodayShortcutStyle";
import {
  ThemedCard,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getWorkoutTypeLabel(workout) {
  const workoutType = getWorkoutType(workout);

  if (workoutType === "StrengthTraining") {
    return "Resistance";
  }

  return workoutType ?? "Workout";
}

function getWorkoutTitle({ workout, workoutCount, allWorkoutsDone }) {
  if (!workout) {
    return "Rest day";
  }

  if (workoutCount > 1) {
    return allWorkoutsDone
      ? "Today's training is done"
      : workout.label ?? "Next workout";
  }

  return workout.label ?? getWorkoutTypeLabel(workout);
}

function getProgressLabel({
  hasWorkouts,
  previewDoneCount,
  previewItems,
  completedWorkoutCount,
  workoutCount,
}) {
  if (!hasWorkouts) {
    return "No workout today";
  }

  if (previewItems.length > 0) {
    return `${previewDoneCount}/${previewItems.length} exercises done`;
  }

  return `${completedWorkoutCount}/${workoutCount} workouts done`;
}

export default function TodayShortcut({
  program_id,
  headerEyebrow = null,
  headerTitle = "Today",
}) {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [day, setDay] = useState(null);
  const [workouts, setWorkouts] = useState([]);

  const date = getTodaysDate();

  const getToday = async () => {
    try {
      const snapshot = await programService.getTodayProgramSnapshot(db, {
        programId: program_id,
        date,
      });

      if (!snapshot) {
        setDay(null);
        setWorkouts([]);
        return;
      }

      setDay(snapshot.day);
      setWorkouts(snapshot.workouts);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getToday();
  }, [db, program_id, date]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      getToday();
    });
    return unsubscribe;
  }, [navigation, db, program_id, date]);

  const workoutCount = workouts.length;
  const completedWorkoutCount = workouts.filter(
    (workout) => Number(workout.done) === 1
  ).length;
  const hasWorkouts = workoutCount > 0;
  const allWorkoutsDone = hasWorkouts && completedWorkoutCount === workoutCount;
  const targetWorkout = useMemo(
    () =>
      workouts.find((workout) => Number(workout.done) !== 1) ??
      workouts[0] ??
      null,
    [workouts]
  );

  const openWorkout = (workout) => {
    if (!workout) {
      return;
    }

    navigation.navigate("WorkoutPage", {
      workout_id: workout.workout_id,
      workout_label: workout.label,
      workout_type: getWorkoutType(workout),
      day: day?.Weekday,
      date,
      program_id,
    });
  };

  const accentColor = allWorkoutsDone
    ? theme.secondary ?? "#60daac"
    : hasWorkouts
      ? theme.primary ?? "#f7742e"
      : theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const cardBackground = theme.cardBackground ?? theme.background;
  const cardBorder =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.08)"
      : theme.cardBorder ?? theme.border ?? accentColor;
  const innerSurface = theme.uiBackground ?? cardBackground;
  const quietText = theme.iconColor ?? theme.quietText ?? theme.text;
  const titleColor = theme.title ?? theme.text ?? "#ffffff";
  const playButtonTextColor = theme.textInverted ?? "#201e2b";
  const progressTrackColor =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(32, 30, 43, 0.12)";
  const workoutTypeLabel = getWorkoutTypeLabel(targetWorkout);
  const workoutIconConfig = getWorkoutIconConfig(getWorkoutType(targetWorkout));
  const WorkoutIcon = workoutIconConfig?.Icon ?? null;
  const previewItems = Array.isArray(targetWorkout?.previewItems)
    ? targetWorkout.previewItems
    : [];
  const visiblePreviewItems = previewItems.slice(0, 2);
  const hiddenPreviewCount = Math.max(
    previewItems.length - visiblePreviewItems.length,
    0
  );
  const previewDoneCount = previewItems.filter((item) => item.done).length;
  const progressTotal = previewItems.length > 0 ? previewItems.length : workoutCount;
  const progressDone = previewItems.length > 0
    ? previewDoneCount
    : completedWorkoutCount;
  const progressPercent =
    progressTotal > 0
      ? Math.min(100, Math.round((progressDone / progressTotal) * 100))
      : 0;
  const title = getWorkoutTitle({
    workout: targetWorkout,
    workoutCount,
    allWorkoutsDone,
  });
  const weekdayLabel = day?.Weekday?.toUpperCase?.() ?? "TODAY";
  const eyebrowPrefix = headerEyebrow ?? "TODAY";
  const eyebrowDetail =
    headerEyebrow && headerTitle !== "Today"
      ? headerTitle
      : `${weekdayLabel} ${date}`;
  const detailLabel =
    hasWorkouts && previewItems.length > 0
      ? `${previewItems.length} ${previewItems.length === 1 ? "exercise" : "exercises"}`
      : hasWorkouts
        ? "Ready"
        : "No workout";
  const statusLabel = !hasWorkouts
    ? "Rest"
    : allWorkoutsDone
      ? "Done"
      : workoutCount > 1
        ? `${completedWorkoutCount}/${workoutCount} workouts`
        : previewItems.length > 0
          ? `${previewDoneCount}/${previewItems.length} done`
          : "Planned";
  const progressLabel = getProgressLabel({
    hasWorkouts,
    previewDoneCount,
    previewItems,
    completedWorkoutCount,
    workoutCount,
  });
  const actionLabel = !hasWorkouts
    ? "Rest day"
    : allWorkoutsDone
      ? "Review workout"
      : completedWorkoutCount > 0 || previewDoneCount > 0
        ? "Continue"
        : "Start workout";
  const canOpenWorkout = Boolean(targetWorkout);

  return (
    <ThemedCard
      style={[
        styles.shortcutCard,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.topAccent, { backgroundColor: accentColor }]}
      />

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canOpenWorkout}
        onPress={() => openWorkout(targetWorkout)}
        style={[
          styles.cardButton,
          !canOpenWorkout && styles.cardButtonDisabled,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.eyebrowRow}>
            <ThemedText
              style={styles.eyebrow}
              setColor={hasWorkouts ? accentColor : quietText}
              numberOfLines={1}
            >
              {eyebrowPrefix}
            </ThemedText>
            <ThemedText
              style={styles.eyebrowDetail}
              setColor={quietText}
              numberOfLines={1}
            >
              - {eyebrowDetail}
            </ThemedText>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: innerSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText
              style={styles.statusPillText}
              setColor={allWorkoutsDone ? theme.secondary ?? accentColor : accentColor}
              numberOfLines={1}
            >
              {statusLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.heroRow}>
          <View
            style={[
              styles.playButton,
              {
                backgroundColor: hasWorkouts ? accentColor : cardBorder,
                shadowColor: accentColor,
              },
            ]}
          >
            {allWorkoutsDone ? (
              <Checkmark
                width={34}
                height={34}
                color={playButtonTextColor}
                thickness={2.6}
              />
            ) : WorkoutIcon ? (
              <WorkoutIcon
                width={34}
                height={34}
                color={playButtonTextColor}
              />
            ) : (
              <View
                style={[
                  styles.playTriangle,
                  { borderLeftColor: playButtonTextColor },
                ]}
              />
            )}
          </View>

          <View style={styles.mainContent}>
            <ThemedTitle
              type="h3"
              style={[styles.title, { color: titleColor }]}
              numberOfLines={2}
            >
              {title}
            </ThemedTitle>

            <View style={styles.metaRow}>
              {hasWorkouts ? (
                <>
                  <ThemedText
                    style={styles.metaType}
                    setColor={accentColor}
                    numberOfLines={1}
                  >
                    {workoutTypeLabel}
                  </ThemedText>
                  <View
                    style={[
                      styles.metaDot,
                      { backgroundColor: quietText },
                    ]}
                  />
                  <ThemedText
                    style={styles.metaText}
                    setColor={quietText}
                    numberOfLines={1}
                  >
                    {detailLabel}
                  </ThemedText>
                </>
              ) : (
                <ThemedText
                  style={styles.metaText}
                  setColor={quietText}
                  numberOfLines={1}
                >
                  {detailLabel}
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        {visiblePreviewItems.length > 0 && (
          <View style={styles.previewList}>
            {visiblePreviewItems.map((item, index) => (
              <View
                key={`${item.label ?? "preview"}-${index}`}
                style={[
                  styles.previewItem,
                  {
                    backgroundColor: innerSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewDot,
                    {
                      backgroundColor: item.done
                        ? theme.secondary ?? accentColor
                        : accentColor,
                      opacity: item.done ? 1 : 0.72,
                    },
                  ]}
                />
                <ThemedText
                  style={styles.previewLabel}
                  setColor={titleColor}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
                <ThemedText
                  style={styles.previewDetail}
                  setColor={quietText}
                  numberOfLines={1}
                >
                  {item.detail}
                </ThemedText>
              </View>
            ))}

            {hiddenPreviewCount > 0 && (
              <View
                style={[
                  styles.previewMore,
                  {
                    backgroundColor: innerSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <ThemedText
                  style={styles.previewMoreText}
                  setColor={quietText}
                  numberOfLines={1}
                >
                  +{hiddenPreviewCount}
                </ThemedText>
              </View>
            )}
          </View>
        )}

        <View style={styles.progressFooter}>
          <View style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: accentColor,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>

          <View style={styles.footerTextRow}>
            <ThemedText
              style={styles.progressLabel}
              setColor={quietText}
              numberOfLines={1}
            >
              {progressLabel}
            </ThemedText>
            <ThemedText
              style={styles.actionLabel}
              setColor={hasWorkouts ? accentColor : quietText}
              numberOfLines={1}
            >
              {actionLabel}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    </ThemedCard>
  );
}
