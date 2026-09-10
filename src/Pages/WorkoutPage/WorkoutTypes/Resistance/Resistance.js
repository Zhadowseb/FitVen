import { StatusBar } from "expo-status-bar";
import {
  AppState,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import ExerciseList from "./Components/ExerciseList/ExerciseList";
import { useColorScheme } from "react-native";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";

import styles from "./ResistanceStyle.js";
import {
  ThemedConfirmModal,
  ThemedKeyboardProtection,
  ThemedTextInput,
  ThemedView,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import {
  formatElapsedTime,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../../../Utils/timeUtils";
import {
  clearActiveRestTimer,
  startActiveRestTimer,
  subscribeRestTimer,
} from "../../../../Utils/restTimerEvents";
import {
  socialPostService,
  weightliftingService,
  workoutService,
} from "../../../../Services";
import { useAuth } from "../../../../Contexts/AuthContext";
import { useExerciseViewSettings } from "../../../../Contexts/ExerciseViewSettingsContext";

//Icons:
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import ArrowDoubleDown from "../../../../Resources/Icons/UI-icons/ArrowDoubleDown";
import ArrowDoubleUp from "../../../../Resources/Icons/UI-icons/ArrowDoubleUp";
import Eye from "../../../../Resources/Icons/UI-icons/Eye";
import ChevronLeft from "../../../../Resources/Icons/UI-icons/ChevronLeft";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";

const Resistance = ({
  workout_id,
  date,
  workoutLabel,
  workoutSubtitle,
  workoutInstanceLabel,
  restartRequestKey,
  onWorkoutMetadataChange,
  onOpenOptions,
}) =>  {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const db = useSQLiteContext();
  const { user } = useAuth();
  const { collapsedExerciseView, collapsedExerciseCardLayout } =
    useExerciseViewSettings();
  const [showCollapsedSets, setShowCollapsedSets] = useState(false);
  const [finishConfirmVisible, setFinishConfirmVisible] = useState(false);
  const [startTimerConfirmVisible, setStartTimerConfirmVisible] =
    useState(false);
  const [allSetsDoneConfirmVisible, setAllSetsDoneConfirmVisible] =
    useState(false);
  const [postConfirmVisible, setPostConfirmVisible] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [isPostingSummary, setIsPostingSummary] = useState(false);
  useEffect(() => {
    if (collapsedExerciseCardLayout === "classic") {
      setShowCollapsedSets(true);
      return;
    }

    if (collapsedExerciseView === "progressOnly") {
      setShowCollapsedSets(false);
    }
  }, [collapsedExerciseCardLayout, collapsedExerciseView]);

  const [refreshing, set_refreshing] = useState(0);
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
  const [workoutTick, setWorkoutTick] = useState(() =>
    getCurrentStoredTimestampSeconds()
  );
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


  // Both counters from one query. There used to be one loader per counter,
  // each asking getStrengthWorkoutSummary the same question and keeping one
  // field of the answer, so every place that wanted both ran it twice.
  const loadSetSummary = useCallback(async () => {
    try {
      const result = await weightliftingService.getStrengthWorkoutSummary(
        db,
        workout_id
      );

      set_totalSets(result.totalSets);
      set_doneSets(result.doneSets);
    } catch (err) {
      console.error("Failed to load the set counts for this workout:", err);
    }
  }, [db, workout_id]);

  // The header used to hold whatever the counts were when the screen was last
  // focused, so adding a set left it saying 0 / 1 with two sets on screen.
  const handleWorkoutMetadataChange = useCallback(() => {
    loadSetSummary();
    onWorkoutMetadataChange?.();
  }, [loadSetSummary, onWorkoutMetadataChange]);


  //Focus coming back to the page
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      loadSetSummary();

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
    loadSetSummary();
  }, [refreshing, loadSetSummary]);

  // The clock's own second hand. It used to advance by bumping
  // `refreshing`, which is the same signal that tells the exercise list to
  // re-read itself from SQLite - so a running workout re-loaded every
  // exercise and every set once a second, and handed every row a new object
  // identity, to move one digit. `refreshing` is now bumped only by actual
  // changes: a set ticked off, added, deleted or edited, all of which
  // already call updateUI.
  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    setWorkoutTick(getCurrentStoredTimestampSeconds());

    const interval = setInterval(() => {
      setWorkoutTick(getCurrentStoredTimestampSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timer_start]);

  // The workout tick only runs while the workout is running, so the rest
  // countdown gets its own second hand.
  const [restTick, setRestTick] = useState(() =>
    getCurrentStoredTimestampSeconds()
  );

  useEffect(() => {
    if (!activeRestTimer) {
      return;
    }

    setRestTick(getCurrentStoredTimestampSeconds());

    const interval = setInterval(() => {
      setRestTick(getCurrentStoredTimestampSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRestTimer]);

  const computeCurrentElapsed = (
    nowSeconds = getCurrentStoredTimestampSeconds()
  ) => {
      const resolvedTimerStart = normalizeTimerStartValue(timer_start);

      if (resolvedTimerStart === null) return 0;

      return Math.max(0, nowSeconds - resolvedTimerStart);
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
      await workoutService.finishWorkout(db, {
        workoutId: workout_id,
        elapsedTime: finalElapsed,
        createPost: false,
      });

      refresh();
      await offerToPostSummary();
    } catch (error) {
      console.error("Failed to finish workout:", error);
    }
  };

  // Posting used to happen silently on finish. Now the user is asked, unless
  // they have turned workout posts off in settings.
  const offerToPostSummary = async () => {
    if (!user?.id) {
      return;
    }

    try {
      const postMode = await socialPostService.getWorkoutSummaryPostMode({
        user,
      });

      if (postMode === socialPostService.WORKOUT_SUMMARY_POST_MODES.OFF) {
        return;
      }

      setPostNote("");
      setPostConfirmVisible(true);
    } catch (error) {
      console.error("Could not read the workout post setting:", error);
    }
  };

  const postWorkoutSummary = async () => {
    if (isPostingSummary) {
      return;
    }

    try {
      setIsPostingSummary(true);
      await workoutService.repostWorkoutSummaryPost(db, {
        workoutId: workout_id,
        note: postNote,
      });
      setPostConfirmVisible(false);
    } catch (error) {
      console.error("Could not post the workout summary:", error);
      setPostConfirmVisible(false);
    } finally {
      setIsPostingSummary(false);
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

  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary ?? primaryColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background;

  const currentElapsed = normalizeElapsedDurationSeconds(
    elapsed_time + computeCurrentElapsed(workoutTick),
    0
  );
  const resolvedTotalSets = Math.max(Number(totalSets) || 0, 0);
  const resolvedDoneSets = Math.max(Number(doneSets) || 0, 0);

  const primaryActionTitle = isRunning
    ? "Pause"
    : original_start_time !== null
      ? "Continue"
      : "Start";
  const primaryActionHandler = isRunning ? pauseWorkout : startWorkout;
  const showFinishButton = !isDone && original_start_time !== null;

  const confirmEndWorkout = () => {
    setFinishConfirmVisible(true);
  };

  // Completing a set on a workout that was never started is almost always a
  // forgotten start, so offer the timer instead of silently logging without it.
  const handleSetCompleted = useCallback(() => {
    if (isRunning || isDone || original_start_time !== null) {
      return;
    }

    if (resolvedDoneSets > 0) {
      return;
    }

    setStartTimerConfirmVisible(true);
  }, [isDone, isRunning, original_start_time, resolvedDoneSets]);

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

    if (!isDone) {
      setAllSetsDoneConfirmVisible(true);
    }
  }, [isDone, resolvedDoneSets, resolvedTotalSets]);

  const restRemaining = activeRestTimer
    ? Math.max(0, activeRestTimer.endsAt - restTick)
    : 0;
  const isResting = restRemaining > 0;
  const elapsedDisplay = formatElapsedTime(currentElapsed);
  const restDisplay = formatElapsedTime(restRemaining);

  const primaryTimerDisplay = isResting ? restDisplay : elapsedDisplay;
  // "00:00" fits at 52. "1:00:00" does not, and "10:00:00" is wider
  // still. Stepping by length keeps the digits from resizing as they roll
  // over, which continuous auto-fitting would do once a second.
  const timerFontSize =
    primaryTimerDisplay.length >= 8
      ? 36
      : primaryTimerDisplay.length >= 7
        ? 42
        : 52;
  const secondaryTimerLabel = isResting ? "Total" : "Rest";
  const secondaryTimerDisplay = isResting ? elapsedDisplay : restDisplay;

  const setsProgress =
    resolvedTotalSets > 0
      ? Math.min(1, Math.max(0, resolvedDoneSets / resolvedTotalSets))
      : 0;
  const navButtonBackground =
    colorScheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,17,22,0.05)";
  const progressTrackColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,17,22,0.08)";
  const glowOpacity = colorScheme === "dark" ? 0.22 : 0.12;

  return (
    <ThemedView safe={false} style={{ flex: 1 }}>
      <View
        style={[
          styles.statusBarStrip,
          { height: insets.top, backgroundColor: theme.background },
        ]}
      />

      <View style={[styles.topArea, { backgroundColor: cardSurface }]}>
        <Svg
          pointerEvents="none"
          style={styles.topGlow}
          width={280}
          height={230}
        >
          <Defs>
            <RadialGradient id="workoutGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={primaryColor} stopOpacity={glowOpacity} />
              <Stop offset="72%" stopColor={primaryColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={280} height={230} fill="url(#workoutGlow)" />
        </Svg>

        <View style={styles.navRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => navigation.goBack()}
            style={[styles.navButton, { backgroundColor: navButtonBackground }]}
          >
            <ChevronLeft width={18} height={18} color={titleColor} thickness={2} />
          </TouchableOpacity>

          <ThemedText
            style={styles.navTitle}
            setColor={titleColor}
            numberOfLines={1}
          >
            {workoutLabel ?? "Workout"}
          </ThemedText>

          {!!workoutSubtitle && (
            <ThemedText style={styles.navDate} setColor={quietText} numberOfLines={1}>
              {workoutSubtitle}
            </ThemedText>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Workout options"
            hitSlop={10}
            onPress={onOpenOptions}
            style={[styles.navButton, { backgroundColor: navButtonBackground }]}
          >
            <ThreeDots width={18} height={18} color={quietText} />
          </TouchableOpacity>
        </View>

        <View style={styles.timerRow}>
          {/* The clock gains two characters the moment a workout passes an
              hour - "59:59" becomes "1:00:00" - and at 52 px that was wide
              enough to push the pause and finish buttons off the right edge.
              Somebody who left a workout running could no longer end it.
              The size steps down with the length instead. */}
          <ThemedText
            style={[styles.timerValue, { fontSize: timerFontSize }]}
            setColor={isResting ? primaryColor : titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {primaryTimerDisplay}
          </ThemedText>

          <View style={styles.timerMeta}>
            <View style={styles.timerMetaRow}>
              <ThemedText style={styles.timerMetaLabel} setColor={quietText}>
                {secondaryTimerLabel}
              </ThemedText>
              <ThemedText
                style={styles.timerMetaValue}
                setColor={isResting ? titleColor : quietText}
              >
                {secondaryTimerDisplay}
              </ThemedText>
            </View>

            <View style={styles.timerMetaRow}>
              <ThemedText style={styles.timerMetaLabel} setColor={quietText}>
                Sets
              </ThemedText>
              <ThemedText style={styles.timerMetaValue} setColor={primaryTextColor}>
                {resolvedDoneSets}
                <ThemedText style={styles.timerMetaTotal} setColor={quietText}>
                  {` / ${resolvedTotalSets}`}
                </ThemedText>
              </ThemedText>
            </View>
          </View>

          <View style={styles.timerSpacer} />

          {!isDone && (
            <View style={styles.timerActions}>
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={primaryActionTitle}
                onPress={primaryActionHandler}
                style={[
                  styles.timerActionButton,
                  isRunning
                    ? { backgroundColor: primaryColor }
                    : { backgroundColor: withAlpha(primaryColor, 0.18) },
                ]}
              >
                {isRunning ? (
                  <View style={styles.timerPauseIcon}>
                    <View
                      style={[styles.timerPauseBar, { backgroundColor: invertedText }]}
                    />
                    <View
                      style={[styles.timerPauseBar, { backgroundColor: invertedText }]}
                    />
                  </View>
                ) : (
                  <View
                    style={[styles.timerPlayIcon, { borderLeftColor: primaryColor }]}
                  />
                )}
              </TouchableOpacity>

              {showFinishButton && (
                <TouchableOpacity
                  activeOpacity={0.86}
                  accessibilityRole="button"
                  accessibilityLabel="Finish workout"
                  onPress={confirmEndWorkout}
                  style={[
                    styles.timerActionButton,
                    { backgroundColor: secondaryColor },
                  ]}
                >
                  <Checkmark
                    width={19}
                    height={19}
                    color={invertedText}
                    thickness={2.8}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.topAreaSpacer} />

        <View style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${setsProgress * 100}%`,
                backgroundColor: primaryColor,
              },
            ]}
          />
        </View>
      </View>

      <ThemedKeyboardProtection
        scroll
        bottomOffset={96}
        scrollViewProps={{ scrollEnabled: !isReorderingExercises }}
      >
        <View style={styles.toolbar}>
          <View style={styles.toolbarLabel}>
            <ThemedText style={styles.toolbarLabelText} setColor={quietText}>
              Exercises:{" "}
              <ThemedText style={styles.toolbarLabelNumber} setColor={primaryTextColor}>
                {exerciseCount}
              </ThemedText>
            </ThemedText>
          </View>

          <View style={styles.toolbarActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: showCollapsedSets }}
              accessibilityLabel={
                showCollapsedSets ? "Hide set details" : "Show set details"
              }
              onPress={() => setShowCollapsedSets((current) => !current)}
              style={[
                styles.toolbarButton,
                showCollapsedSets
                  ? {
                      backgroundColor: withAlpha(primaryColor, 0.14),
                      borderColor: withAlpha(primaryColor, 0.45),
                    }
                  : {
                      backgroundColor: cardSurface,
                      borderColor: cardBorder,
                    },
              ]}
            >
              <Eye width={24} height={24} color={primaryTextColor} />
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
                  type: "expand",
                  key: Date.now(),
                });
              }}
            >
              <ArrowDoubleDown width={24} height={24} color={primaryTextColor} />
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
              <ArrowDoubleUp width={24} height={24} color={primaryTextColor} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: showCompletedExercises }}
              accessibilityLabel={
                showCompletedExercises
                  ? "Hide finished exercises"
                  : "Show finished exercises"
              }
              onPress={() => setShowCompletedExercises((current) => !current)}
              style={[
                styles.toolbarButton,
                showCompletedExercises
                  ? {
                      backgroundColor: withAlpha(primaryColor, 0.14),
                      borderColor: withAlpha(primaryColor, 0.45),
                    }
                  : {
                      backgroundColor: cardSurface,
                      borderColor: cardBorder,
                    },
              ]}
            >
              <Checkmark
                width={22}
                height={22}
                color={primaryTextColor}
                thickness={2.6}
              />
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
            onWorkoutMetadataChange={handleWorkoutMetadataChange}
            onExerciseCountChange={setExerciseCount}
            onSetCompleted={handleSetCompleted}
            collapsedSetsVisible={showCollapsedSets}
            collapsedCardLayout={collapsedExerciseCardLayout}
            isWorkoutDone={isDone}
          />
        </View>

      </ThemedKeyboardProtection>

      <ThemedConfirmModal
        visible={finishConfirmVisible}
        title="Finish workout?"
        message="This will mark the workout as complete."
        confirmLabel="Finish"
        tone="positive"
        onConfirm={() => {
          setFinishConfirmVisible(false);
          void endWorkout();
        }}
        onClose={() => setFinishConfirmVisible(false)}
      />

      <ThemedConfirmModal
        visible={allSetsDoneConfirmVisible}
        title="All sets are done"
        message="Stop the timer and finish the workout?"
        confirmLabel="Finish workout"
        cancelLabel="Keep going"
        tone="positive"
        onConfirm={() => {
          setAllSetsDoneConfirmVisible(false);
          void endWorkout();
        }}
        onClose={() => setAllSetsDoneConfirmVisible(false)}
      />

      <ThemedConfirmModal
        visible={postConfirmVisible}
        title="Share this workout?"
        message="Post the summary to your feed so the people who follow you can see it."
        confirmLabel={isPostingSummary ? "Posting..." : "Post it"}
        cancelLabel="Keep it private"
        tone="positive"
        isWorking={isPostingSummary}
        onConfirm={postWorkoutSummary}
        onClose={() => {
          if (!isPostingSummary) {
            setPostConfirmVisible(false);
          }
        }}
      >
        <ThemedTextInput
          value={postNote}
          onChangeText={setPostNote}
          placeholder="Add a note (optional)"
          multiline
          editable={!isPostingSummary}
          inputStyle={styles.postNoteInput}
        />
      </ThemedConfirmModal>

      <ThemedConfirmModal
        visible={startTimerConfirmVisible}
        title="Start the timer?"
        message="You just completed a set, but the workout timer has not been started."
        confirmLabel="Start timer"
        cancelLabel="Not now"
        tone="positive"
        onConfirm={() => {
          setStartTimerConfirmVisible(false);
          void startWorkout();
        }}
        onClose={() => setStartTimerConfirmVisible(false)}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}

export default Resistance;
