import {
  AppState,
  TouchableOpacity,
  View,
  Vibration,
  Alert,
} from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";

import ExerciseList from "./Components/ExerciseList/ExerciseList";
import { useColorScheme } from "react-native";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";

import pageStyles from "../../WorkoutPageStyle";
import styles from "./ResistanceStyle.js";
import {
  ThemedCard,
  ThemedBottomSheet,
  ThemedKeyboardProtection,
  ThemedView,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import StatusPill from "../../../../Resources/Components/StatusPill";
import {
  formatElapsedTime,
  formatClockTime,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../../../Utils/timeUtils";
import {
  clearActiveRestTimer,
  startActiveRestTimer,
  subscribeRestTimer,
} from "../../../../Utils/restTimerEvents";
import { weightliftingService, workoutService } from "../../../../Services";

//Icons:
import Filter from "../../../../Resources/Icons/UI-icons/Filter";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import ArrowDoubleDown from "../../../../Resources/Icons/UI-icons/ArrowDoubleDown";
import ArrowDoubleUp from "../../../../Resources/Icons/UI-icons/ArrowDoubleUp";

const Resistance = ({
  workout_id,
  date,
  workoutInstanceLabel,
  restartRequestKey,
  onWorkoutMetadataChange,
}) =>  {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const db = useSQLiteContext();

  const [refreshing, set_refreshing] = useState(0);
  const [filterBottomsheetVisible, setFilterBottomsheetVisible] = useState(false);
  const [showCompletedExercises, setShowCompletedExercises] = useState(true);
  const [expansionAction, setExpansionAction] = useState(null);
  const [isReorderingExercises, setIsReorderingExercises] = useState(false);
  const [exerciseCount, setExerciseCount] = useState(0);

  const [totalSets, set_totalSets] = useState(0);
  const [doneSets, set_doneSets] = useState(0);

  //Workout timer state:
  const [original_start_time, set_original_start_time] = useState(null);
  const [timer_start, set_timer_start] = useState(null);
  const [elapsed_time, set_elapsed_time] = useState(0);
  const [isDone, set_isDone] = useState(false);
  const [isRunning, set_isRunning] = useState(false);
  const [activeRestTimer, setActiveRestTimer] = useState(null);
  const timerStartRef = useRef(null);
  const elapsedTimeRef = useRef(0);
  const wasAllSetsDoneRef = useRef(false);

  const normalizeTimerStartValue = (value) =>
    normalizeStoredTimestampSeconds(value);

  const refresh = () => {
    set_refreshing(prev => prev + 1);
  }

  useEffect(() => {
    timerStartRef.current = timer_start;
  }, [timer_start]);

  useEffect(() => {
    elapsedTimeRef.current = elapsed_time;
  }, [elapsed_time]);

  useEffect(() => {
    return subscribeRestTimer((timer) => {
      setActiveRestTimer(
        Number(timer?.workoutId) === Number(workout_id) ? timer : null
      );
    });
  }, [workout_id]);

  const persistCurrentTimerState = useCallback(async () => {
    await workoutService.persistWorkoutTimerState(db, {
      workoutId: workout_id,
      timerStart: timerStartRef.current,
      elapsedTime: elapsedTimeRef.current,
    });
  }, [db, workout_id]);

  const loadTotalSets = async () => {
    try {
      const result =
        await weightliftingService.getStrengthWorkoutSummary(db, workout_id);
      set_totalSets(result.totalSets);
    } catch (err) {
      console.error("Failed to load the amount of sets to do for this workout:", err);
    }
  };

  const loadCompletedSets = async () => {
    try {
      const result =
        await weightliftingService.getStrengthWorkoutSummary(db, workout_id);
      set_doneSets(result.doneSets);
    } catch (err) {
      console.error("Failed to load the done sets for this workout:", err);
    }
  };

  //Focus coming back to the page
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      loadTotalSets();
      loadCompletedSets();

      const reload = async () => {
          const row = await workoutService.getWorkoutTimerState(db, workout_id);
          const nextIsDone = Number(row.done) === 1;
          const resolvedOriginalStartTime = normalizeStoredTimestampSeconds(
            row.original_start_time
          );
          const resolvedTimerStart = normalizeTimerStartValue(row.timer_start);
          const resolvedElapsedTime = normalizeElapsedDurationSeconds(
            row.elapsed_time,
            0
          );

          if (!isActive) {
            return;
          }

          set_isRunning(resolvedTimerStart !== null && !nextIsDone);
          set_isDone(nextIsDone);
          set_original_start_time(resolvedOriginalStartTime);
          set_timer_start(resolvedTimerStart);
          set_elapsed_time(resolvedElapsedTime);
      }
      void reload();

      return () => {
        isActive = false;
      };
    }, [db, workout_id])
  );  

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "inactive" || nextAppState === "background") {
        persistCurrentTimerState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [persistCurrentTimerState]);

  useEffect(() => {
    return () => {
      persistCurrentTimerState();
    };
  }, [persistCurrentTimerState]);

  useEffect(() => {
    loadCompletedSets();
    loadTotalSets();
  }, [refreshing]);

  //Time loop
  useEffect(() => {
    if(!isRunning) return;

    const interval = setInterval(() => {
      refresh()
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isRunning, timer_start]);

  const computeCurrentElapsed = () => {
      const resolvedTimerStart = normalizeTimerStartValue(timer_start);

      if (resolvedTimerStart === null) return 0;

      return Math.max(
          0,
          getCurrentStoredTimestampSeconds() - resolvedTimerStart
      );
  };

  const updateElapsed = async () => {
      const newElapsed = normalizeElapsedDurationSeconds(
          elapsed_time + computeCurrentElapsed(),
          0
      );

      elapsedTimeRef.current = newElapsed;
      timerStartRef.current = null;
      set_timer_start(null);
      set_elapsed_time(newElapsed);

      await workoutService.persistWorkoutTimerState(db, {
          workoutId: workout_id,
          timerStart: null,
          elapsedTime: newElapsed,
      });

      return newElapsed;
  };

  const startWorkout = async () => {
    const row = await workoutService.getWorkoutOriginalStartTime(db, workout_id);

    //Miliseconds since 1. januar 1970 at 00:00:00 UTC
    const start_time = getCurrentStoredTimestampSeconds();
    const isFreshStart = row.original_start_time === null;

    if(isFreshStart){
        set_original_start_time(start_time);
        await workoutService.setWorkoutOriginalStartTime(db, {
            workoutId: workout_id,
            startTime: start_time,
        });
    } 

    await workoutService.persistWorkoutTimerState(db, {
      workoutId: workout_id,
      timerStart: start_time,
      elapsedTime: elapsed_time,
    });

    if (isFreshStart) {
      workoutService.notifyWorkoutStartedInBackground(db, {
        workoutId: workout_id,
        startedAt: start_time,
      });
    }

    timerStartRef.current = start_time;
    set_isRunning(true);
    set_timer_start(start_time);
    Vibration.vibrate(500);
  };

  const handleRestTimerStart = useCallback((timer) => {
    if (!isRunning || isDone) {
      return;
    }

    const startedAt = getCurrentStoredTimestampSeconds();

    startActiveRestTimer({
      ...timer,
      workoutId: workout_id,
      startedAt,
      navigationTarget: {
        workout_id,
        workout_label: workoutInstanceLabel ?? "Resistance",
        workout_type: "Resistance",
        date,
      },
    });
  }, [date, isDone, isRunning, workoutInstanceLabel, workout_id]);

  const handleRestTimerCancel = useCallback((setId) => {
    if (Number(activeRestTimer?.setId) === Number(setId)) {
      clearActiveRestTimer(activeRestTimer.id);
    }
  }, [activeRestTimer]);

  const pauseWorkout = async () => {
      if (activeRestTimer) {
        clearActiveRestTimer(activeRestTimer.id);
      }
      set_isRunning(false);
      const newElapsed = await updateElapsed();
      set_timer_start(null);
      set_elapsed_time(newElapsed);
      Vibration.vibrate([0, 100, 100, 100]);
  };

  const endWorkout = async () => {
    const finalElapsed = normalizeElapsedDurationSeconds(
      elapsed_time + (timer_start ? computeCurrentElapsed() : 0),
      0
    );

    elapsedTimeRef.current = finalElapsed;
    timerStartRef.current = null;
    if (activeRestTimer) {
      clearActiveRestTimer(activeRestTimer.id);
    }
    set_isRunning(false);
    set_isDone(true);
    set_timer_start(null);
    set_elapsed_time(finalElapsed);

    try {
      await workoutService.persistWorkoutTimerState(db, {
        workoutId: workout_id,
        timerStart: null,
        elapsedTime: finalElapsed,
      });

      await workoutService.setWorkoutDone(db, {
        workoutId: workout_id,
        done: true,
      });

      refresh();
    } catch (error) {
      console.error("Failed to finish workout:", error);
    }
  };

  const restartWorkout = async () => {
    await workoutService.resetWorkoutState(db, workout_id);
    if (activeRestTimer) {
      clearActiveRestTimer(activeRestTimer.id);
    }
    set_original_start_time(null);
    set_timer_start(null);
    set_elapsed_time(0);
    set_isRunning(false);
    set_isDone(false);
    refresh();
  };

  useEffect(() => {
    if (!restartRequestKey) {
      return;
    }

    restartWorkout();
  }, [restartRequestKey]);

  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const secondaryColor = theme.secondary ?? primaryColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const chipBackground = theme.chipBackground ?? theme.uiBackground;
  const hairlineBorder = theme.border ?? theme.cardBorder;
  const segmentRemainingColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 17, 22, 0.10)";
  const statusPillBackground = withAlpha(theme.secondary, 0.12);

  const currentElapsed = normalizeElapsedDurationSeconds(
    elapsed_time + computeCurrentElapsed(),
    0
  );
  const resolvedTotalSets = Math.max(Number(totalSets) || 0, 0);
  const resolvedDoneSets = Math.max(Number(doneSets) || 0, 0);

  const statusLabel = isDone
    ? "Complete"
    : isRunning
      ? "In progress"
      : original_start_time !== null
        ? "Paused"
        : "Ready";
  const statusIsPositive = isDone || isRunning;
  const statusPillColor = statusIsPositive ? secondaryColor : theme.text;
  const statusPillBg = statusIsPositive ? statusPillBackground : chipBackground;
  const startedDisplay =
    original_start_time !== null
      ? `Started ${formatClockTime(original_start_time)}`
      : "Not started yet";
  const workoutInstanceLabelText =
    workoutInstanceLabel?.trim?.() ?? workoutInstanceLabel;
  const primaryActionTitle = isRunning
    ? "Pause"
    : original_start_time !== null
      ? "Continue"
      : "Start";
  const primaryActionHandler = isRunning ? pauseWorkout : startWorkout;
  const showFinishButton = !isDone && original_start_time !== null;

  const confirmEndWorkout = () => {
    Alert.alert(
      "Finish workout?",
      "This will mark the workout as complete.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Finish", style: "destructive", onPress: () => void endWorkout() },
      ]
    );
  };

  useEffect(() => {
    const allSetsDone =
      resolvedTotalSets > 0 && resolvedDoneSets >= resolvedTotalSets;

    if (!allSetsDone) {
      wasAllSetsDoneRef.current = false;
      return;
    }

    if (wasAllSetsDoneRef.current) {
      return;
    }

    wasAllSetsDoneRef.current = true;

    if (isRunning && !isDone) {
      void pauseWorkout();
    }
  }, [isDone, isRunning, resolvedDoneSets, resolvedTotalSets, pauseWorkout]);

  return (
    <ThemedView safe={false} style={{ flex: 1 }}>
      <ThemedKeyboardProtection
        scroll
        scrollViewProps={{ scrollEnabled: !isReorderingExercises }}
      >
        <View style={styles.heroShell}>
          <ThemedCard
            style={[
              styles.heroCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <StatusPill
                label={statusLabel}
                color={statusPillColor}
                backgroundColor={statusPillBg}
              />

              <ThemedText style={styles.heroStartedValue} setColor={quietText} numberOfLines={1}>
                {startedDisplay}
              </ThemedText>
            </View>

            <View style={styles.heroTimerBlock}>
              <ThemedText style={styles.heroTimerValue} setColor={titleColor}>
                {formatElapsedTime(currentElapsed)}
              </ThemedText>
              <ThemedText style={styles.heroTimerLabel} setColor={quietText}>
                Elapsed time
              </ThemedText>
            </View>

            <View style={styles.heroSetsBlock}>
              <View style={styles.heroSetsRow}>
                <View style={styles.heroSetsCount}>
                  <ThemedText style={styles.heroSetsCountDone} setColor={titleColor}>
                    {resolvedDoneSets}
                  </ThemedText>
                  <ThemedText style={styles.heroSetsCountTotal} setColor={quietText}>
                    {` of ${resolvedTotalSets} sets`}
                  </ThemedText>
                </View>

                {!!workoutInstanceLabelText && (
                  <ThemedText
                    style={styles.heroWorkoutInstanceLabel}
                    setColor={primaryColor}
                    numberOfLines={1}
                  >
                    {workoutInstanceLabelText}
                  </ThemedText>
                )}
              </View>

              {resolvedTotalSets > 0 && (
                <View style={styles.heroSegmentBar}>
                  {Array.from({ length: resolvedTotalSets }).map((_, index) => {
                    const isSegmentDone = index < resolvedDoneSets;
                    const isCurrentSegment =
                      index === resolvedDoneSets && isRunning && !isDone;

                    return (
                      <View
                        key={index}
                        style={[
                          styles.heroSegment,
                          isCurrentSegment && styles.heroSegmentGlow,
                          isCurrentSegment && {
                            shadowOpacity: colorScheme === "dark" ? 0.6 : 0.5,
                          },
                          {
                            backgroundColor: isSegmentDone
                              ? secondaryColor
                              : isCurrentSegment
                                ? primaryColor
                                : segmentRemainingColor,
                            shadowColor: isCurrentSegment ? primaryColor : undefined,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}
            </View>

            {!isDone && (
              <View style={styles.heroActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={primaryActionHandler}
                  style={[
                    styles.heroActionButton,
                    styles.heroActionSecondary,
                    { backgroundColor: chipBackground, borderColor: hairlineBorder },
                  ]}
                >
                  {isRunning ? (
                    <View style={styles.heroPauseIcon}>
                      <View
                        style={[
                          styles.heroPauseBar,
                          { backgroundColor: titleColor },
                        ]}
                      />
                      <View
                        style={[
                          styles.heroPauseBar,
                          { backgroundColor: titleColor },
                        ]}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.heroPlayIcon,
                        { borderLeftColor: titleColor },
                      ]}
                    />
                  )}
                  <ThemedText style={styles.heroActionText} setColor={titleColor}>
                    {primaryActionTitle}
                  </ThemedText>
                </TouchableOpacity>

                {showFinishButton && (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={[
                      styles.heroActionButton,
                      styles.heroActionPrimary,
                      { backgroundColor: primaryColor, shadowColor: primaryColor },
                    ]}
                    onPress={confirmEndWorkout}
                  >
                    <Checkmark
                      width={15}
                      height={15}
                      color={invertedText}
                      thickness={2.8}
                    />
                    <ThemedText style={styles.heroActionText} setColor={invertedText}>
                      Finish
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ThemedCard>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.toolbarLabel}>
            <ThemedText style={styles.toolbarLabelText} setColor={quietText}>
              Exercises:{" "}
              <ThemedText style={styles.toolbarLabelNumber} setColor={primaryColor}>
                {exerciseCount}
              </ThemedText>
            </ThemedText>
          </View>

          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={[
                styles.toolbarButton,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
              onPress={() => {
                setExpansionAction({
                  type: "expand",
                  key: Date.now(),
                });
              }}
            >
              <ArrowDoubleDown width={24} height={24} color={primaryColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toolbarButton,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
              onPress={() => {
                setExpansionAction({
                  type: "collapse",
                  key: Date.now(),
                });
              }}
            >
              <ArrowDoubleUp width={24} height={24} color={primaryColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toolbarButton,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
              onPress={() => {
                setFilterBottomsheetVisible(true);
              }}
            >
              <Filter width={24} height={24} color={primaryColor} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.workingSets}>
          <ExerciseList
            workout_id={workout_id}
            refreshing={refreshing}
            updateUI={refresh}
            showCompletedExercises={showCompletedExercises}
            expansionAction={expansionAction}
            onReorderDragChange={setIsReorderingExercises}
            onRestTimerStart={handleRestTimerStart}
            onRestTimerCancel={handleRestTimerCancel}
            onWorkoutMetadataChange={onWorkoutMetadataChange}
            onExerciseCountChange={setExerciseCount}
          />
        </View>

      </ThemedKeyboardProtection>

      <ThemedBottomSheet
        visible={filterBottomsheetVisible}
        onClose={() => setFilterBottomsheetVisible(false)}
      >
        <View style={pageStyles.bottomsheetTitle}>
          <ThemedText>Filter exercises</ThemedText>
        </View>

        <View style={pageStyles.bottomsheetBody}>
          <TouchableOpacity
            style={[pageStyles.option, pageStyles.filterOption]}
            onPress={() => {
              setShowCompletedExercises((prev) => !prev);
            }}
          >
            <ThemedText style={pageStyles.filterOptionText}>
              Show completed exercises
            </ThemedText>

            {showCompletedExercises && (
              <Checkmark
                width={24}
                height={24}/>
            )}
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>
    </ThemedView>
  );
}

export default Resistance;
