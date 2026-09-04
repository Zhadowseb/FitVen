import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import StartWorkoutSheet from "../Components/StartWorkoutSheet";
import {
  isWorkoutComingSoon,
  isWorkoutTypeComingSoon,
} from "../../Utils/workoutTypeAvailability";
import { usePulseAnimation } from "../Components/animationHooks";
import Home from "../Icons/UI-icons/Home";
import Male from "../Icons/UI-icons/Male";
import Plus from "../Icons/UI-icons/Plus";
import Social from "../Icons/UI-icons/Social";
import UpwardGraf from "../Icons/UI-icons/UpwardGraf";
import { programService, workoutService } from "../../Services";
import {
  getTodaysDate,
  normalizeLocalDateString,
  parseCustomDate,
} from "../../Utils/dateUtils";
import {
  formatCountdownTime,
  formatElapsedTime,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../Utils/timeUtils";
import { subscribeQuickWorkoutMenu } from "../../Utils/quickWorkoutMenuEvents";
import {
  clearActiveRestTimer,
  getActiveRestTimer,
  subscribeRestTimer,
} from "../../Utils/restTimerEvents";

const RECENT_WORKOUT_PREVIEW_LIMIT = 2;
const RECENT_WORKOUT_PAGE_SIZE = 10;

const LIVE_TIMER_SIZE = 66;
const LIVE_RING_RADIUS = 30;
const LIVE_RING_STROKE = 3;
const LIVE_RING_CIRCUMFERENCE = 2 * Math.PI * LIVE_RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getPlannedShortcut(snapshots, date) {
  const workouts = snapshots.flatMap((snapshot) =>
    snapshot.workouts
      .filter((workout) => Number(workout.done) !== 1)
      .map((workout) => ({
        date,
        day: snapshot.day,
        programId: snapshot.program?.program_id ?? null,
        programName: snapshot.program?.program_name ?? "Workout calendar",
        workout,
      }))
  );

  return workouts.length > 0 ? { date, workouts } : null;
}

function ThemedBottomNavigation({ currentRouteName, navigationRef }) {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const [quickWorkoutModalVisible, setQuickWorkoutModalVisible] =
    useState(false);
  const [isCreatingQuickWorkout, setIsCreatingQuickWorkout] = useState(false);
  const [plannedTodayShortcut, setPlannedTodayShortcut] = useState(null);
  const [usualWorkouts, setUsualWorkouts] = useState([]);
  const [isLoadingUsualWorkouts, setIsLoadingUsualWorkouts] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [isLoadingRecentWorkouts, setIsLoadingRecentWorkouts] = useState(false);
  const [hasMoreRecentWorkouts, setHasMoreRecentWorkouts] = useState(false);
  const [isLoadingMoreRecentWorkouts, setIsLoadingMoreRecentWorkouts] =
    useState(false);
  const [activeWorkoutTimer, setActiveWorkoutTimer] = useState(null);
  const [startableWorkout, setStartableWorkout] = useState(null);
  const [isStartingWorkoutTimer, setIsStartingWorkoutTimer] = useState(false);
  const [activeRestTimer, setActiveRestTimer] = useState(() =>
    getActiveRestTimer()
  );
  const [timerTick, setTimerTick] = useState(getCurrentStoredTimestampSeconds());
  const quickWorkoutDateRef = useRef(getTodaysDate());
  const quickWorkoutTargetRef = useRef(null);
  const activeWorkoutLoadRef = useRef(false);
  const recentWorkoutLoadRequestRef = useRef(0);
  const recentWorkoutAppendLoadRef = useRef(false);

  const isProfileActive = [
    "ProfilePage",
    "NotificationSettingsPage",
    "SocialPostSettingsPage",
    "ExerciseSocialPostSettingsPage",
    "WorkoutTypesSettingsPage",
  ].includes(currentRouteName);
  const isSocialActive = ["SearchPage", "SocialUserListPage"].includes(
    currentRouteName
  );
  const isLibraryActive = [
    "ExerciseLibraryPage",
    "ExerciseCatalogPage",
    "PersonalRecordsPage",
    "ProgramPage",
    "ProgramOverviewPage",
    "MicrocyclePage",
    "WeekPage",
    "WorkoutCalendarPage",
    "SicknessPage",
    "OneRepMaxCalculatorPage",
  ].includes(currentRouteName);
  const isHomeActive = !isProfileActive && !isSocialActive && !isLibraryActive;
  // theme.primary is #F7742E, which is only 2.8:1 on the light nav bar - worse
  // than the inactive grey. primaryDark clears 4.5:1.
  const activeColor =
    colorScheme === "light"
      ? theme.primaryDark ?? theme.primary
      : theme.iconColorFocused ?? theme.primary ?? theme.title ?? theme.text;
  const inactiveColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const barBackground =
    theme.navBackground ?? theme.cardBackground ?? theme.background;
  const barBorder = theme.hairline ?? theme.cardBorder ?? theme.iconColor;
  const plusBackground = theme.primary;
  const plusIconColor = theme.textInverted ?? theme.cardBackground;
  const fabBorderColor = theme.background ?? barBackground;
  const activeWorkoutElapsed = activeWorkoutTimer
    ? normalizeElapsedDurationSeconds(activeWorkoutTimer.elapsed_time, 0) +
      Math.max(
        0,
        normalizeStoredTimestampSeconds(activeWorkoutTimer.timer_start) === null
          ? 0
          : timerTick -
              normalizeStoredTimestampSeconds(activeWorkoutTimer.timer_start)
      )
    : 0;
  const restTimerRemaining = activeRestTimer
    ? Math.max(0, activeRestTimer.endsAt - timerTick)
    : 0;
  const isRestTimerActive = restTimerRemaining > 0;
  const shouldShowCenterTimer = Boolean(activeWorkoutTimer) || isRestTimerActive;
  const centerTimerText = isRestTimerActive
    ? formatCountdownTime(restTimerRemaining)
    : formatElapsedTime(activeWorkoutElapsed);
  const restDurationSeconds = activeRestTimer
    ? Math.max(
        1,
        normalizeElapsedDurationSeconds(activeRestTimer.durationSeconds, 0)
      )
    : 1;
  const restRingFraction = isRestTimerActive
    ? Math.max(0, Math.min(1, restTimerRemaining / restDurationSeconds))
    : 0;

  const fabPulse = usePulseAnimation(shouldShowCenterTimer);
  const restRingOffset = useRef(new Animated.Value(0)).current;
  const restRingTimerIdRef = useRef(null);

  useEffect(() => {
    if (!isRestTimerActive || !activeRestTimer) {
      restRingTimerIdRef.current = null;
      return;
    }

    const targetOffset = LIVE_RING_CIRCUMFERENCE * (1 - restRingFraction);

    if (restRingTimerIdRef.current !== activeRestTimer.id) {
      restRingTimerIdRef.current = activeRestTimer.id;
      restRingOffset.setValue(targetOffset);
      return;
    }

    Animated.timing(restRingOffset, {
      toValue: targetOffset,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [activeRestTimer, isRestTimerActive, restRingFraction, restRingOffset]);

  const handleHomePress = () => {
    if (!navigationRef?.isReady?.()) {
      return;
    }

    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "HomePage" }],
    });
  };

  const handleProfilePress = () => {
    if (!navigationRef?.isReady?.() || isProfileActive) {
      return;
    }

    navigationRef.navigate("ProfilePage");
  };

  const handleSocialPress = () => {
    if (!navigationRef?.isReady?.() || isSocialActive) {
      return;
    }

    navigationRef.navigate("SearchPage");
  };

  const handleLibraryPress = () => {
    if (!navigationRef?.isReady?.() || isLibraryActive) {
      return;
    }

    navigationRef.navigate("ExerciseLibraryPage");
  };

  const handleCenterButtonPress = () => {
    if (activeWorkoutTimer && navigationRef?.isReady?.()) {
      navigationRef.navigate("WorkoutPage", {
        workout_id: activeWorkoutTimer.workout_id,
        workout_label:
          activeWorkoutTimer.label ?? activeWorkoutTimer.workout_type,
        workout_type:
          activeWorkoutTimer.workout_type ?? activeWorkoutTimer.label,
        day: activeWorkoutTimer.day,
        date: activeWorkoutTimer.date,
        program_id: activeWorkoutTimer.program_id,
      });
      return;
    }

    if (
      isRestTimerActive &&
      activeRestTimer?.navigationTarget &&
      navigationRef?.isReady?.()
    ) {
      navigationRef.navigate("WorkoutPage", activeRestTimer.navigationTarget);
      return;
    }

    handleQuickWorkoutPress();
  };

  const loadPlannedShortcut = useCallback(async (workoutDate) => {
    try {
      const snapshots = await programService.getTodayWorkoutSnapshots(
        db,
        { date: workoutDate }
      );

      setPlannedTodayShortcut(
        getPlannedShortcut(snapshots, workoutDate)
      );
    } catch (error) {
      console.error("Failed to load the planned workout:", error);
      setPlannedTodayShortcut(null);
    }
  }, [db]);

  const loadRecentWorkouts = useCallback(
    async (
      todayDate,
      {
        append = false,
        limit = RECENT_WORKOUT_PREVIEW_LIMIT,
        offset = 0,
      } = {}
    ) => {
      if (append && recentWorkoutAppendLoadRef.current) {
        return;
      }

      const requestId = recentWorkoutLoadRequestRef.current + 1;
      recentWorkoutLoadRequestRef.current = requestId;

      try {
        if (append) {
          recentWorkoutAppendLoadRef.current = true;
          setIsLoadingMoreRecentWorkouts(true);
        } else {
          recentWorkoutAppendLoadRef.current = false;
          setIsLoadingMoreRecentWorkouts(false);
          setIsLoadingRecentWorkouts(true);
        }

        const workouts = await programService.getRecentWorkouts(db, {
          date: todayDate,
          limit: limit + 1,
          offset,
        });
        const visibleWorkouts = workouts.slice(0, limit);

        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        setHasMoreRecentWorkouts(workouts.length > limit);
        setRecentWorkouts((currentWorkouts) =>
          append ? [...currentWorkouts, ...visibleWorkouts] : visibleWorkouts
        );
      } catch (error) {
        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        console.error("Failed to load recent workouts:", error);
        setHasMoreRecentWorkouts(false);

        if (!append) {
          setRecentWorkouts([]);
        }
      } finally {
        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        if (append) {
          recentWorkoutAppendLoadRef.current = false;
          setIsLoadingMoreRecentWorkouts(false);
        } else {
          setIsLoadingRecentWorkouts(false);
        }
      }
    },
    [db]
  );

  const loadUsualWorkouts = useCallback(async (todayDate) => {
    try {
      setIsLoadingUsualWorkouts(true);
      const workouts = await programService.getUsualWorkouts(db, {
        date: todayDate,
        limit: 2,
        minOccurrences: 2,
      });

      setUsualWorkouts(workouts);
    } catch (error) {
      console.error("Failed to load usual workouts:", error);
      setUsualWorkouts([]);
    } finally {
      setIsLoadingUsualWorkouts(false);
    }
  }, [db]);

  const handleQuickWorkoutPress = useCallback((target = null) => {
    if (isCreatingQuickWorkout) {
      return;
    }

    const quickWorkoutDate =
      normalizeLocalDateString(target?.date) ?? getTodaysDate();
    quickWorkoutDateRef.current = quickWorkoutDate;
    quickWorkoutTargetRef.current = target
      ? {
          date: quickWorkoutDate,
          day: target.day ?? null,
          dayId: target.dayId ?? null,
          programId: target.programId ?? null,
          programName: target.programName ?? null,
        }
      : null;
    setPlannedTodayShortcut(null);
    setUsualWorkouts([]);
    setRecentWorkouts([]);
    setHasMoreRecentWorkouts(false);
    setIsLoadingMoreRecentWorkouts(false);
    setQuickWorkoutModalVisible(true);
    loadPlannedShortcut(quickWorkoutDate);
    loadUsualWorkouts(quickWorkoutDate);
    loadRecentWorkouts(quickWorkoutDate, {
      limit: RECENT_WORKOUT_PAGE_SIZE,
    });
  }, [
    isCreatingQuickWorkout,
    loadPlannedShortcut,
    loadRecentWorkouts,
    loadUsualWorkouts,
  ]);

  const handleLoadMoreRecentWorkouts = useCallback(() => {
    if (
      isLoadingRecentWorkouts ||
      isLoadingMoreRecentWorkouts ||
      !hasMoreRecentWorkouts
    ) {
      return;
    }

    loadRecentWorkouts(quickWorkoutDateRef.current, {
      append: true,
      limit: RECENT_WORKOUT_PAGE_SIZE,
      offset: recentWorkouts.length,
    });
  }, [
    hasMoreRecentWorkouts,
    isLoadingMoreRecentWorkouts,
    isLoadingRecentWorkouts,
    loadRecentWorkouts,
    recentWorkouts.length,
  ]);

  useEffect(() => {
    return subscribeQuickWorkoutMenu(handleQuickWorkoutPress);
  }, [handleQuickWorkoutPress]);

  useEffect(() => {
    return subscribeRestTimer(setActiveRestTimer);
  }, []);

  // Starts the day's existing workout straight from the nav button and drops
  // the user into it, so they skip the create-workout sheet.
  const handleStartWorkoutTimer = useCallback(async () => {
    if (!startableWorkout || isStartingWorkoutTimer) {
      return;
    }

    setIsStartingWorkoutTimer(true);

    try {
      const startTime = getCurrentStoredTimestampSeconds();

      if (startableWorkout.original_start_time === null) {
        await workoutService.setWorkoutOriginalStartTime(db, {
          workoutId: startableWorkout.workout_id,
          startTime,
        });
        workoutService.notifyWorkoutStartedInBackground(db, {
          workoutId: startableWorkout.workout_id,
          startedAt: startTime,
        });
      }

      await workoutService.persistWorkoutTimerState(db, {
        workoutId: startableWorkout.workout_id,
        timerStart: startTime,
        elapsedTime: normalizeElapsedDurationSeconds(
          startableWorkout.elapsed_time,
          0
        ),
      });

      if (navigationRef?.isReady?.()) {
        navigationRef.navigate("WorkoutPage", {
          workout_id: startableWorkout.workout_id,
          workout_label: startableWorkout.label ?? startableWorkout.workout_type,
          workout_type: startableWorkout.workout_type ?? startableWorkout.label,
          day: startableWorkout.day,
          date: startableWorkout.date,
          program_id: startableWorkout.program_id,
        });
      }
    } catch (error) {
      console.error("Failed to start workout from the nav button:", error);
    } finally {
      setIsStartingWorkoutTimer(false);
    }
  }, [db, isStartingWorkoutTimer, startableWorkout]);

  const loadActiveWorkoutTimer = useCallback(async () => {
    if (activeWorkoutLoadRef.current) {
      return;
    }

    activeWorkoutLoadRef.current = true;

    try {
      const workout = await workoutService.getActiveWorkoutTimer(db);
      setActiveWorkoutTimer(workout ?? null);
      setStartableWorkout(
        workout
          ? null
          : await workoutService.getStartableWorkout(db, {
              date: getTodaysDate(),
            })
      );
      setTimerTick(getCurrentStoredTimestampSeconds());
    } catch (error) {
      console.error("Failed to load active workout timer:", error);
      setActiveWorkoutTimer(null);
      setStartableWorkout(null);
    } finally {
      activeWorkoutLoadRef.current = false;
    }
  }, [db]);

  useEffect(() => {
    loadActiveWorkoutTimer();

    const interval = setInterval(() => {
      setTimerTick(getCurrentStoredTimestampSeconds());
      loadActiveWorkoutTimer();
    }, 1000);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          loadActiveWorkoutTimer();
        }
      }
    );

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [loadActiveWorkoutTimer]);

  useEffect(() => {
    if (activeRestTimer && activeRestTimer.endsAt <= timerTick) {
      clearActiveRestTimer(activeRestTimer.id);
    }
  }, [activeRestTimer, timerTick]);

  const resolveQuickWorkoutTarget = async () => {
    const target = quickWorkoutTargetRef.current;

    if (!target?.programId || target.dayId) {
      return target;
    }

    const day = await programService.getDayByDate(db, {
      programId: target.programId,
      date: target.date,
    });

    if (!day?.day_id) {
      throw new Error("The selected program day could not be found.");
    }

    const resolvedTarget = {
      ...target,
      dayId: day.day_id,
    };
    quickWorkoutTargetRef.current = resolvedTarget;

    return resolvedTarget;
  };

  const handleCreateQuickWorkout = async (workoutType) => {
    if (!navigationRef?.isReady?.() || isCreatingQuickWorkout) {
      return;
    }

    // Backstop for the disabled types - the sheet already blocks the tap.
    if (isWorkoutTypeComingSoon(workoutType?.id)) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const workoutLabel = workoutType.displayName ?? workoutType.id;
      const target = await resolveQuickWorkoutTarget();
      let workout;

      if (target?.dayId) {
        const workoutResult = await programService.createWorkoutForDay(db, {
          date: target.date,
          dayId: target.dayId,
          workoutType: workoutType.id,
          label: null,
        });

        workout = {
          workout_id: workoutResult.lastInsertRowId,
          workout_type: workoutType.id,
          workout_label: workoutLabel,
          date: target.date,
          day: target.day,
          program_id: target.programId,
          program_name: target.programName,
        };
      } else {
        workout = await programService.createQuickWorkout(db, {
          date: quickWorkoutDateRef.current,
          workoutType: workoutType.id,
          label: null,
        });
      }

      navigationRef.navigate("WorkoutPage", {
        program_id: workout.program_id,
        day: workout.day,
        date: workout.date,
        workout_id: workout.workout_id,
        workout_label: workoutLabel,
        workout_type: workoutType.id,
      });
    } catch (error) {
      console.error("Failed to create quick workout:", error);
      Alert.alert("Could not create workout", "Please try again.");
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  const handleOpenPlannedWorkout = (plannedSelection) => {
    const selectedWorkout =
      plannedSelection ?? plannedTodayShortcut?.workouts?.[0] ?? null;
    const plannedWorkout = selectedWorkout?.workout;

    if (!navigationRef?.isReady?.() || !plannedWorkout) {
      return;
    }

    setQuickWorkoutModalVisible(false);

    navigationRef.navigate("WorkoutPage", {
      workout_id: plannedWorkout.workout_id,
      workout_label: plannedWorkout.label,
      workout_type: getWorkoutType(plannedWorkout),
      day: selectedWorkout.day?.Weekday,
      date: selectedWorkout.date,
      program_id: selectedWorkout.programId,
    });
  };

  const handleCopyRecentWorkout = async (workout) => {
    if (!navigationRef?.isReady?.() || !workout || isCreatingQuickWorkout) {
      return;
    }

    if (isWorkoutComingSoon(workout)) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const target = await resolveQuickWorkoutTarget();
      let copiedWorkout;

      if (target?.dayId && target?.programId) {
        const copiedWorkoutId = await programService.copyWorkoutToDate(db, {
          workoutId: workout.workout_id,
          programId: target.programId,
          date: parseCustomDate(target.date),
        });

        copiedWorkout = copiedWorkoutId
          ? {
              workout_id: copiedWorkoutId,
              workout_label: workout.label ?? workout.workout_type,
              workout_type: workout.workout_type ?? workout.label,
              day: target.day,
              date: target.date,
              program_id: target.programId,
            }
          : null;
      } else {
        copiedWorkout = await programService.copyWorkoutToStandaloneDate(db, {
          workoutId: workout.workout_id,
          date: quickWorkoutDateRef.current,
        });
      }

      if (!copiedWorkout) {
        throw new Error("The recent workout could not be copied.");
      }

      navigationRef.navigate("WorkoutPage", {
        workout_id: copiedWorkout.workout_id,
        workout_label: copiedWorkout.workout_label,
        workout_type: copiedWorkout.workout_type,
        day: copiedWorkout.day,
        date: copiedWorkout.date,
        program_id: copiedWorkout.program_id,
      });
    } catch (error) {
      console.error("Failed to copy recent workout:", error);
      Alert.alert(
        "Could not copy workout",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: barBackground,
            borderTopColor: barBorder,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.itemsRow}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleHomePress}
            style={styles.tab}
          >
            <Home
              width={23}
              height={23}
              color={isHomeActive ? activeColor : inactiveColor}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isHomeActive ? activeColor : inactiveColor },
              ]}
            >
              HOME
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isHomeActive ? activeColor : "transparent",
                },
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleLibraryPress}
            style={styles.tab}
          >
            <UpwardGraf
              width={23}
              height={23}
              color={isLibraryActive ? activeColor : inactiveColor}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isLibraryActive ? activeColor : inactiveColor },
              ]}
            >
              TRAIN
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isLibraryActive ? activeColor : "transparent",
                },
              ]}
            />
          </TouchableOpacity>

          <View style={styles.plusSlot}>
            {shouldShowCenterTimer ? (
              <View style={styles.liveTimerWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.liveTimerPulse,
                    {
                      backgroundColor: withAlpha(plusBackground, 0.5),
                      opacity: fabPulse.opacity,
                      transform: [{ scale: fabPulse.scale }],
                    },
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.86}
                  accessibilityLabel={
                    isRestTimerActive
                      ? `Active rest timer ${centerTimerText}`
                      : `Active workout timer ${centerTimerText}`
                  }
                  accessibilityRole="button"
                  disabled={isCreatingQuickWorkout}
                  onPress={handleCenterButtonPress}
                  style={[
                    styles.liveTimerButton,
                    {
                      backgroundColor: plusBackground,
                      borderColor: fabBorderColor,
                      shadowColor: plusBackground,
                      opacity: isCreatingQuickWorkout ? 0.72 : 1,
                    },
                  ]}
                >
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[styles.liveTimerValue, { color: plusIconColor }]}
                  >
                    {centerTimerText}
                  </Text>
                </TouchableOpacity>
                {isRestTimerActive ? (
                  <Svg
                    pointerEvents="none"
                    width={LIVE_TIMER_SIZE}
                    height={LIVE_TIMER_SIZE}
                    viewBox={`0 0 ${LIVE_TIMER_SIZE} ${LIVE_TIMER_SIZE}`}
                    style={[styles.liveTimerRing, styles.liveTimerRingStart]}
                  >
                    <Circle
                      cx={LIVE_TIMER_SIZE / 2}
                      cy={LIVE_TIMER_SIZE / 2}
                      r={LIVE_RING_RADIUS}
                      fill="none"
                      stroke={withAlpha(plusBackground, 0.25)}
                      strokeWidth={LIVE_RING_STROKE}
                    />
                    <AnimatedCircle
                      cx={LIVE_TIMER_SIZE / 2}
                      cy={LIVE_TIMER_SIZE / 2}
                      r={LIVE_RING_RADIUS}
                      fill="none"
                      stroke={plusBackground}
                      strokeWidth={LIVE_RING_STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${LIVE_RING_CIRCUMFERENCE}`}
                      strokeDashoffset={restRingOffset}
                    />
                  </Svg>
                ) : (
                  <Svg
                    pointerEvents="none"
                    width={LIVE_TIMER_SIZE}
                    height={LIVE_TIMER_SIZE}
                    viewBox={`0 0 ${LIVE_TIMER_SIZE} ${LIVE_TIMER_SIZE}`}
                    style={styles.liveTimerRing}
                  >
                    {/* Workout running: a full ring. Rest counts down as a
                        depleting arc in the branch above. */}
                    <Circle
                      cx={LIVE_TIMER_SIZE / 2}
                      cy={LIVE_TIMER_SIZE / 2}
                      r={LIVE_RING_RADIUS}
                      fill="none"
                      stroke={plusBackground}
                      strokeWidth={LIVE_RING_STROKE}
                    />
                  </Svg>
                )}
              </View>
            ) : startableWorkout ? (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel={`Start workout ${
                  startableWorkout.label ?? startableWorkout.workout_type
                }`}
                accessibilityRole="button"
                disabled={isStartingWorkoutTimer}
                onPress={handleStartWorkoutTimer}
                style={[
                  styles.plusButton,
                  {
                    backgroundColor: plusBackground,
                    borderColor: fabBorderColor,
                    shadowColor: plusBackground,
                    opacity: isStartingWorkoutTimer ? 0.72 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.playIcon, { borderLeftColor: plusIconColor }]}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel="Create workout"
                accessibilityRole="button"
                disabled={isCreatingQuickWorkout}
                onPress={handleCenterButtonPress}
                style={[
                  styles.plusButton,
                  {
                    backgroundColor: plusBackground,
                    borderColor: fabBorderColor,
                    shadowColor: plusBackground,
                    opacity: isCreatingQuickWorkout ? 0.72 : 1,
                  },
                ]}
              >
                <Plus
                  width={26}
                  height={26}
                  color={plusIconColor}
                  thickness={2.4}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleSocialPress}
            style={styles.tab}
          >
            <Social
              width={23}
              height={23}
              color={isSocialActive ? activeColor : inactiveColor}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isSocialActive ? activeColor : inactiveColor },
              ]}
            >
              SOCIAL
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isSocialActive ? activeColor : "transparent",
                },
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleProfilePress}
            style={styles.tab}
          >
            <Male
              width={23}
              height={23}
              color={isProfileActive ? activeColor : inactiveColor}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isProfileActive ? activeColor : inactiveColor },
              ]}
            >
              PROFILE
            </Text>
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isProfileActive ? activeColor : "transparent",
                },
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>

      <StartWorkoutSheet
        visible={quickWorkoutModalVisible}
        onClose={() => setQuickWorkoutModalVisible(false)}
        onStartFresh={handleCreateQuickWorkout}
        onOpenPlannedWorkout={handleOpenPlannedWorkout}
        plannedTodayShortcut={plannedTodayShortcut}
        usualWorkouts={usualWorkouts}
        isLoadingUsualWorkouts={isLoadingUsualWorkouts}
        recentWorkouts={recentWorkouts}
        isLoadingRecentWorkouts={isLoadingRecentWorkouts}
        isLoadingMoreRecentWorkouts={isLoadingMoreRecentWorkouts}
        onLoadMoreRecentWorkouts={handleLoadMoreRecentWorkouts}
        onCopyRecentWorkout={handleCopyRecentWorkout}
        isStartingWorkout={isCreatingQuickWorkout}
        targetDate={quickWorkoutDateRef.current}
      />
    </>
  );
}

export default ThemedBottomNavigation;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  itemsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 10,
    // Replaces the padding the removed handle row used to provide, so the tabs
    // do not sit flush against the edge on devices without a bottom inset.
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3,
  },
  tabIndicator: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  plusSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 12,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 18,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginLeft: 5,
  },
  liveTimerWrap: {
    width: LIVE_TIMER_SIZE,
    height: LIVE_TIMER_SIZE,
    marginTop: -31,
  },
  liveTimerPulse: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 999,
  },
  liveTimerButton: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 26,
    elevation: 12,
  },
  liveTimerValue: {
    maxWidth: 48,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  liveTimerRing: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LIVE_TIMER_SIZE,
    height: LIVE_TIMER_SIZE,
  },
  liveTimerRingStart: {
    transform: [{ rotate: "-90deg" }],
  },
});
