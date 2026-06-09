import { useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";

import { Colors } from "../../../../Resources/GlobalStyling/colors";
import { getTodaysDate } from "../../../../Utils/dateUtils";
import { programService } from "../../../../Services";
import ArrowDoubleDown from "../../../../Resources/Icons/UI-icons/ArrowDoubleDown";
import ArrowDoubleUp from "../../../../Resources/Icons/UI-icons/ArrowDoubleUp";
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

export default function TodayShortcut({
  program_id,
  snapshot = null,
  headerEyebrow = null,
  headerTitle = "Today",
}) {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [day, setDay] = useState(snapshot?.day ?? null);
  const [workouts, setWorkouts] = useState(snapshot?.workouts ?? []);
  const [showWorkoutChoices, setShowWorkoutChoices] = useState(false);

  const date = getTodaysDate();

  const getToday = async () => {
    try {
      if (snapshot) {
        setDay(snapshot.day ?? null);
        setWorkouts(snapshot.workouts ?? []);
        return;
      }

      const nextSnapshot = await programService.getTodayProgramSnapshot(db, {
        programId: program_id,
        date,
      });

      if (!nextSnapshot) {
        setDay(null);
        setWorkouts([]);
        return;
      }

      setDay(nextSnapshot.day);
      setWorkouts(nextSnapshot.workouts);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getToday();
  }, [db, program_id, date, snapshot]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      getToday();
    });
    return unsubscribe;
  }, [navigation, db, program_id, date, snapshot]);

  const workoutCount = workouts.length;
  const completedWorkoutCount = workouts.filter(
    (workout) => Number(workout.done) === 1
  ).length;
  const hasWorkouts = workoutCount > 0;
  const allWorkoutsDone = hasWorkouts && completedWorkoutCount === workoutCount;
  const remainingWorkoutCount = workoutCount - completedWorkoutCount;
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
  const quietText = theme.iconColor ?? theme.quietText ?? theme.text;
  const titleColor = theme.title ?? theme.text ?? "#ffffff";
  const playButtonTextColor = theme.textInverted ?? "#201e2b";
  const workoutTypeLabel = getWorkoutTypeLabel(targetWorkout);
  const exerciseCount = targetWorkout?.previewItems?.length ?? 0;
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
    workoutCount > 1
      ? allWorkoutsDone
        ? `${workoutCount} completed`
        : `${remainingWorkoutCount} remaining`
      : hasWorkouts && exerciseCount > 0
      ? `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`
      : hasWorkouts
        ? "Ready"
        : "No workout";
  const canOpenWorkout = Boolean(targetWorkout);
  const displayTitle =
    workoutCount > 1 ? `${workoutCount} workouts today` : title;
  const displayWorkoutType =
    workoutCount > 1 ? "Training" : workoutTypeLabel;

  useEffect(() => {
    if (workoutCount <= 1) {
      setShowWorkoutChoices(false);
    }
  }, [workoutCount]);

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
        onPress={() => {
          if (workoutCount > 1) {
            setShowWorkoutChoices((currentValue) => !currentValue);
            return;
          }

          openWorkout(targetWorkout);
        }}
        style={[
          styles.cardButton,
          !canOpenWorkout && styles.cardButtonDisabled,
        ]}
      >
        <View
          style={[
            styles.playButton,
            {
              backgroundColor: hasWorkouts ? accentColor : cardBorder,
              shadowColor: accentColor,
            },
          ]}
        >
          <View
            style={[
              styles.playTriangle,
              { borderLeftColor: playButtonTextColor },
            ]}
          />
        </View>

        <View style={styles.mainContent}>
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
              · {eyebrowDetail}
            </ThemedText>
          </View>

          <ThemedTitle
            type="h3"
            style={[styles.title, { color: titleColor }]}
            numberOfLines={1}
          >
            {displayTitle}
          </ThemedTitle>

          <View style={styles.metaRow}>
            {hasWorkouts ? (
              <>
                <ThemedText
                  style={styles.metaType}
                  setColor={accentColor}
                  numberOfLines={1}
                >
                  {displayWorkoutType}
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

        {workoutCount > 1 ? (
          <View style={styles.expandIcon}>
            {showWorkoutChoices ? (
              <ArrowDoubleUp width={20} height={20} color={quietText} />
            ) : (
              <ArrowDoubleDown width={20} height={20} color={quietText} />
            )}
          </View>
        ) : null}
      </TouchableOpacity>

      {showWorkoutChoices ? (
        <View style={[styles.workoutChoices, { borderTopColor: cardBorder }]}>
          {workouts.map((workout) => {
            const workoutDone = Number(workout.done) === 1;

            return (
              <TouchableOpacity
                key={workout.workout_id}
                activeOpacity={0.86}
                onPress={() => openWorkout(workout)}
                style={[styles.workoutChoice, { borderColor: cardBorder }]}
              >
                <View style={styles.workoutChoiceCopy}>
                  <ThemedText
                    style={styles.workoutChoiceTitle}
                    setColor={titleColor}
                    numberOfLines={1}
                  >
                    {workout.label ?? getWorkoutTypeLabel(workout)}
                  </ThemedText>
                  <ThemedText
                    style={styles.workoutChoiceDetail}
                    setColor={quietText}
                    numberOfLines={1}
                  >
                    {getWorkoutTypeLabel(workout)}
                  </ThemedText>
                </View>
                <ThemedText
                  style={styles.workoutChoiceStatus}
                  setColor={
                    workoutDone
                      ? theme.secondary ?? "#60daac"
                      : theme.primary ?? "#f7742e"
                  }
                >
                  {workoutDone ? "DONE" : "OPEN"}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </ThemedCard>
  );
}
