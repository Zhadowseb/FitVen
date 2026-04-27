import { Alert, AppState, TouchableOpacity, View, Vibration } from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import { useColorScheme } from "react-native";

import RunSetList from "./RunSetList";
import RunLocationDebugModal from "./RunLocationDebugModal";
import PlusCircled from "../../../../Resources/Icons/UI-icons/PlusCircled";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedCard,
  ThemedView,
  ThemedText,
  ThemedButton,
  ThemedKeyboardProtection,
} from "../../../../Resources/ThemedComponents";
import styles from "./RunStyle";

import {
  formatTime,
  formatWorkoutStart,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../../../Utils/timeUtils";
import {
  locationService,
  runningService as runningRepository,
  workoutService as workoutRepository,
} from "../../../../Services";

const TYPE_LABELS = {
  WARMUP: "Warmup",
  WORKING_SET: "Run block",
  COOLDOWN: "Cooldown",
};

const parsePaceToMinutes = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(",", ".")
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, "")
    .replace(/\s+/g, "");

  const splitMatch = normalized.match(/^(\d+)[\:'](\d{1,2})$/);

  if (splitMatch) {
    const minutes = Number(splitMatch[1]);
    const seconds = Number(splitMatch[2]);

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes + seconds / 60;
    }
  }

  const numericValue = Number(normalized.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatPaceDisplay = (paceMinutes) => {
  if (!Number.isFinite(paceMinutes) || paceMinutes <= 0) {
    return "--'--''";
  }

  const totalSeconds = Math.round(paceMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}'${String(seconds).padStart(2, "0")}`;
};

const createEmptyTrackedDebugReport = () => ({
  summary: {
    totalCallbacks: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    accuracyRejections: 0,
    shortDistanceRejections: 0,
    tooFastRejections: 0,
    invalidTimeRejections: 0,
  },
  rows: [],
});

const Run = ({ workout_id, restartRequestKey }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();

  const [updateCount, set_updateCount] = useState(0);
  const triggerReload = () => {
    set_updateCount((prev) => prev + 1);
  };

  const [warmupEmpty, set_WarmupEmpty] = useState(true);
  const [workingEmpty, set_WorkingEmpty] = useState(true);
  const [cooldownEmpty, set_CooldownEmpty] = useState(true);

  const [original_start_time, set_original_start_time] = useState(null);
  const [timer_start, set_timer_start] = useState(null);
  const [elapsed_time, set_elapsed_time] = useState(0);
  const [isDone, set_isDone] = useState(false);
  const [isRunning, set_isRunning] = useState(false);
  const [isControlBusy, set_isControlBusy] = useState(false);
  const [totalDistance, set_totalDistance] = useState(0);
  const [timerTick, set_timerTick] = useState(() =>
    getCurrentStoredTimestampSeconds()
  );
  const [trackedDebugReport, set_trackedDebugReport] = useState(() =>
    createEmptyTrackedDebugReport()
  );
  const [debugModalVisible, set_debugModalVisible] = useState(false);

  const [activeSet, set_activeSet] = useState(null);
  const [activeSet_remainingTime, set_activeSet_remainingTime] = useState(0);
  const [activeSetDetails, set_activeSetDetails] = useState(null);

  const previousActiveSetRef = useRef(null);
  const timerStartRef = useRef(null);
  const elapsedTimeRef = useRef(0);
  const workoutStateLoadRequestRef = useRef(0);
  const activeSetCalculationInFlightRef = useRef(false);
  const trackedSummaryLoadingRef = useRef(false);
  const trackedDebugLoadingRef = useRef(false);

  const normalizeTimerStartValue = (value) =>
    normalizeStoredTimestampSeconds(value);

  const currentElapsed =
    normalizeElapsedDurationSeconds(elapsed_time, 0) +
    (normalizeTimerStartValue(timer_start) !== null
      ? Math.max(0, timerTick - normalizeTimerStartValue(timer_start))
      : 0);

  useEffect(() => {
    timerStartRef.current = timer_start;
  }, [timer_start]);

  useEffect(() => {
    elapsedTimeRef.current = elapsed_time;
  }, [elapsed_time]);

  const persistCurrentTimerState = useCallback(async () => {
    await workoutRepository.persistWorkoutTimerState(db, {
      workoutId: workout_id,
      timerStart: timerStartRef.current,
      elapsedTime: elapsedTimeRef.current,
    });
  }, [db, workout_id]);

  const stopRunTrackingSafely = useCallback(async () => {
    try {
      await locationService.stopRunTracking(db);
    } catch (error) {
      console.error("Failed to stop run tracking cleanly:", error);
    }
  }, [db]);

  const invalidatePendingWorkoutStateLoads = useCallback(() => {
    workoutStateLoadRequestRef.current += 1;
  }, []);

  const clearActiveSegment = () => {
    previousActiveSetRef.current = null;
    set_activeSet(null);
    set_activeSet_remainingTime(0);
    set_activeSetDetails(null);
  };

  const getCurrentElapsedSeconds = useCallback(() => {
    const resolvedTimerStart = normalizeTimerStartValue(timerStartRef.current);

    if (resolvedTimerStart === null) {
      return 0;
    }

    return Math.max(0, getCurrentStoredTimestampSeconds() - resolvedTimerStart);
  }, []);

  const loadTrackedRunSummary = useCallback(async () => {
    if (trackedSummaryLoadingRef.current) {
      return;
    }

    trackedSummaryLoadingRef.current = true;

    try {
      const summary = await locationService.getTrackedRunSummary(db, workout_id);
      set_totalDistance(summary.totalDistanceKm);
    } catch (error) {
      console.error("Failed to load tracked run summary:", error);
    } finally {
      trackedSummaryLoadingRef.current = false;
    }
  }, [db, workout_id]);

  const loadTrackedRunDebugReport = useCallback(async () => {
    if (trackedDebugLoadingRef.current) {
      return;
    }

    trackedDebugLoadingRef.current = true;

    try {
      const report = await locationService.getTrackedRunDebugReport(db, workout_id);
      set_trackedDebugReport(report ?? createEmptyTrackedDebugReport());
    } catch (error) {
      console.error("Failed to load tracked run debug report:", error);
      set_trackedDebugReport(createEmptyTrackedDebugReport());
    } finally {
      trackedDebugLoadingRef.current = false;
    }
  }, [db, workout_id]);

  const calculateActiveSet = useCallback(async (currentElapsed) => {
    if (activeSetCalculationInFlightRef.current) {
      return;
    }

    activeSetCalculationInFlightRef.current = true;

    try {
      const sets = await runningRepository.getOrderedRunSetsForWorkout(
        db,
        workout_id
      );

      if (!sets.length) {
        clearActiveSegment();
        return;
      }

      let remainingElapsed = currentElapsed;

      for (let i = 0; i < sets.length; i++) {
        const setDuration = (sets[i].time ?? 0) * 60;

        if (remainingElapsed >= setDuration) {
          if (!sets[i].done) {
            await runningRepository.updateRunSetDone(db, {
              runId: sets[i].Run_id,
              done: true,
            });
          }
          remainingElapsed -= setDuration;
          continue;
        }

        const newActiveSet = sets[i].Run_id;

        if (previousActiveSetRef.current !== newActiveSet) {
          previousActiveSetRef.current = newActiveSet;

          if (sets[i].is_pause) {
            Vibration.vibrate([0, 100, 100, 100]);
          } else {
            Vibration.vibrate(500);
          }
        }

        set_activeSet(newActiveSet);
        set_activeSetDetails(sets[i]);
        set_activeSet_remainingTime(Math.max(0, setDuration - remainingElapsed));
        return;
      }

      clearActiveSegment();
    } finally {
      activeSetCalculationInFlightRef.current = false;
    }
  }, [db, workout_id]);

  const loadWorkoutState = useCallback(async () => {
    // Ignore older resume/focus reloads so they cannot overwrite a newer pause/finish action.
    const requestId = workoutStateLoadRequestRef.current + 1;
    workoutStateLoadRequestRef.current = requestId;

    try {
      await locationService.syncRunTrackingState(db);
    } catch (error) {
      console.warn("Unable to sync run tracking state:", error);
    }

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    const row = await workoutRepository.getWorkoutTimerState(db, workout_id);

    if (!row || requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    const nextIsDone = Number(row.done) === 1;
    const resolvedOriginalStartTime = normalizeStoredTimestampSeconds(
      row.original_start_time
    );
    const resolvedTimerStart = normalizeTimerStartValue(row.timer_start);
    const resolvedElapsedTime = normalizeElapsedDurationSeconds(
      row.elapsed_time,
      0
    );
    const currentElapsed =
      resolvedElapsedTime +
      (resolvedTimerStart !== null
        ? Math.max(0, getCurrentStoredTimestampSeconds() - resolvedTimerStart)
        : 0);

    timerStartRef.current = resolvedTimerStart;
    elapsedTimeRef.current = resolvedElapsedTime;
    set_timerTick(getCurrentStoredTimestampSeconds());
    set_isRunning(resolvedTimerStart !== null && !nextIsDone);
    set_isDone(nextIsDone);
    set_original_start_time(resolvedOriginalStartTime);
    set_timer_start(resolvedTimerStart);
    set_elapsed_time(resolvedElapsedTime);

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    if (row.original_start_time !== null && !nextIsDone) {
      await calculateActiveSet(currentElapsed);
    } else {
      clearActiveSegment();
    }

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    if (resolvedTimerStart !== null && !nextIsDone) {
      try {
        await locationService.ensureRunTracking(db, workout_id);
      } catch (error) {
        console.warn("Unable to ensure location tracking:", error);
      }
    }

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    await loadTrackedRunSummary();
    await loadTrackedRunDebugReport();
  }, [db, workout_id, calculateActiveSet, loadTrackedRunSummary, loadTrackedRunDebugReport]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkoutState();
    }, [loadWorkoutState])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "inactive" || nextAppState === "background") {
        void persistCurrentTimerState();
      }

      if (nextAppState === "active") {
        set_timerTick(getCurrentStoredTimestampSeconds());
        void loadWorkoutState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [persistCurrentTimerState, loadWorkoutState]);

  useEffect(() => {
    return () => {
      void persistCurrentTimerState();
    };
  }, [persistCurrentTimerState]);

  useEffect(() => {
    if (!isRunning) {
      set_timerTick(getCurrentStoredTimestampSeconds());
      return;
    }

    const interval = setInterval(() => {
      set_timerTick(getCurrentStoredTimestampSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timer_start]);

  useEffect(() => {
    if (original_start_time === null || isDone) {
      clearActiveSegment();
      return;
    }

    calculateActiveSet(currentElapsed);
  }, [updateCount, original_start_time, isDone, currentElapsed, calculateActiveSet]);

  useEffect(() => {
    loadTrackedRunSummary();
  }, [loadTrackedRunSummary, updateCount]);

  useEffect(() => {
    loadTrackedRunDebugReport();
  }, [loadTrackedRunDebugReport, updateCount]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      loadTrackedRunSummary();
      loadTrackedRunDebugReport();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, loadTrackedRunSummary, loadTrackedRunDebugReport]);

  const updateElapsed = async () => {
    const newElapsed = normalizeElapsedDurationSeconds(
      (elapsedTimeRef.current ?? 0) + getCurrentElapsedSeconds(),
      0
    );

    await workoutRepository.persistWorkoutTimerState(db, {
      workoutId: workout_id,
      timerStart: null,
      elapsedTime: newElapsed,
    });

    elapsedTimeRef.current = newElapsed;
    timerStartRef.current = null;
    set_elapsed_time(newElapsed);
    return newElapsed;
  };

  const startWorkout = async () => {
    if (isControlBusy) {
      return;
    }

    set_isControlBusy(true);
    invalidatePendingWorkoutStateLoads();

    try {
      const row = await workoutRepository.getWorkoutOriginalStartTime(db, workout_id);
      const start_time = getCurrentStoredTimestampSeconds();
      const isFreshStart = row.original_start_time === null;

      if (isFreshStart) {
        await workoutRepository.setWorkoutOriginalStartTime(db, {
          workoutId: workout_id,
          startTime: start_time,
        });
      }

      await workoutRepository.persistWorkoutTimerState(db, {
        workoutId: workout_id,
        timerStart: start_time,
        elapsedTime: elapsedTimeRef.current ?? elapsed_time,
      });

      try {
        await locationService.startRunTracking(db, workout_id, {
          resetLogs: isFreshStart,
        });
      } catch (trackingError) {
        await workoutRepository.persistWorkoutTimerState(db, {
          workoutId: workout_id,
          timerStart: null,
          elapsedTime: elapsedTimeRef.current ?? elapsed_time,
        });

        if (isFreshStart) {
          await workoutRepository.setWorkoutOriginalStartTime(db, {
            workoutId: workout_id,
            startTime: null,
          });
        }

        throw trackingError;
      }

      Vibration.vibrate(500);
      if (isFreshStart) {
        set_original_start_time(start_time);
      }
      timerStartRef.current = start_time;
      set_timerTick(start_time);
      set_isRunning(true);
      set_timer_start(start_time);
      await loadTrackedRunSummary();
      await loadTrackedRunDebugReport();
    } catch (error) {
      console.error("Failed to start run tracking:", error);
      Alert.alert(
        "Location tracking could not start",
        "Check that location is allowed and turned on, then try again."
      );
    } finally {
      set_isControlBusy(false);
    }
  };

  const pauseWorkout = async () => {
    if (isControlBusy) {
      return;
    }

    set_isControlBusy(true);
    invalidatePendingWorkoutStateLoads();

    try {
      const newElapsed = await updateElapsed();
      await stopRunTrackingSafely();

      Vibration.vibrate([0, 100, 100, 100]);
      set_isRunning(false);
      set_timer_start(null);
      set_elapsed_time(newElapsed);
      await calculateActiveSet(newElapsed);
      await loadTrackedRunSummary();
      await loadTrackedRunDebugReport();
    } catch (error) {
      console.error("Failed to pause run:", error);
      Alert.alert(
        "Run could not be paused",
        "The timer state will be refreshed so you can try again."
      );
      await loadWorkoutState();
    } finally {
      set_isControlBusy(false);
    }
  };

  const endWorkout = async () => {
    if (isControlBusy) {
      return;
    }

    set_isControlBusy(true);
    invalidatePendingWorkoutStateLoads();

    try {
      const finalElapsed = timerStartRef.current ? await updateElapsed() : elapsed_time;
      await stopRunTrackingSafely();

      set_isRunning(false);
      set_isDone(true);
      set_timer_start(null);
      set_elapsed_time(finalElapsed);
      clearActiveSegment();

      await workoutRepository.setWorkoutDone(db, {
        workoutId: workout_id,
        done: true,
      });

      await loadTrackedRunSummary();
      await loadTrackedRunDebugReport();
    } catch (error) {
      console.error("Failed to finish run:", error);
      Alert.alert(
        "Run could not be finished",
        "The timer state will be refreshed so you can try again."
      );
      await loadWorkoutState();
    } finally {
      set_isControlBusy(false);
    }
  };

  const restartWorkout = async () => {
    if (isControlBusy) {
      return;
    }

    set_isControlBusy(true);
    invalidatePendingWorkoutStateLoads();

    try {
      await stopRunTrackingSafely();
      await locationService.clearTrackedRunData(db, workout_id);
      await workoutRepository.resetWorkoutState(db, workout_id);
      set_original_start_time(null);
      set_timer_start(null);
      set_elapsed_time(0);
      set_isRunning(false);
      set_isDone(false);
      set_totalDistance(0);
      set_trackedDebugReport(createEmptyTrackedDebugReport());
      set_debugModalVisible(false);
      clearActiveSegment();
      triggerReload();
    } catch (error) {
      console.error("Failed to restart run:", error);
      Alert.alert(
        "Run could not be restarted",
        "The timer state will be refreshed so you can try again."
      );
      await loadWorkoutState();
    } finally {
      set_isControlBusy(false);
    }
  };

  useEffect(() => {
    if (!restartRequestKey) {
      return;
    }

    restartWorkout();
  }, [restartRequestKey]);

  const addSet = async (setVariety) => {
    try {
      await runningRepository.addRunSet(db, {
        workoutId: workout_id,
        type: setVariety,
      });
      triggerReload();
    } catch (error) {
      console.error("Failed to add run set:", error);
    }
  };

  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const secondaryColor = theme.secondary ?? primaryColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const avgPaceMinutes =
    totalDistance > 0 ? currentElapsed / 60 / totalDistance : null;
  const startedDisplay =
    original_start_time !== null
      ? formatWorkoutStart(original_start_time)
      : "Not started yet";

  const formattedTotalDistance = `${Number(totalDistance.toFixed(2)).toString()} km`;
  const avgPaceDisplay = formatPaceDisplay(avgPaceMinutes);
  const debugSummary =
    trackedDebugReport?.summary ?? createEmptyTrackedDebugReport().summary;
  const shouldShowDebugCard =
    original_start_time !== null || debugSummary.totalCallbacks > 0;
  const debugReasonBadges = [
    {
      label: "Accuracy",
      value: debugSummary.accuracyRejections,
      backgroundColor: theme.primaryLight ?? "rgba(247, 116, 46, 0.12)",
      textColor: theme.primaryDark ?? theme.primary ?? titleColor,
    },
    {
      label: "Too short",
      value: debugSummary.shortDistanceRejections,
      backgroundColor: theme.uiBackground ?? innerSurface,
      textColor: titleColor,
    },
    {
      label: "Too fast",
      value: debugSummary.tooFastRejections,
      backgroundColor: theme.uiBackground ?? innerSurface,
      textColor: titleColor,
    },
    {
      label: "Bad time",
      value: debugSummary.invalidTimeRejections,
      backgroundColor: theme.uiBackground ?? innerSurface,
      textColor: titleColor,
    },
  ];

  const activeSegmentMeta = activeSetDetails
    ? [
        activeSetDetails.is_pause
          ? "Recovery block"
          : `Set ${activeSetDetails.set_number}`,
        activeSetDetails.distance ? `${activeSetDetails.distance} km` : null,
        activeSetDetails.time ? `${activeSetDetails.time} min` : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : isDone
      ? "All planned run blocks finished"
      : original_start_time === null
        ? "Build your run below and start when ready"
        : "Current block is waiting to resume";

  const sectionConfigs = [
    {
      type: "WARMUP",
      title: "Warmup",
      badge: "Warmup",
      accent: quietText,
      badgeBackground: innerSurface,
      badgeTextColor: titleColor,
      emptySetter: set_WarmupEmpty,
      isEmpty: warmupEmpty,
    },
    {
      type: "WORKING_SET",
      title: "Working Sets",
      badge: "Main Work",
      accent: primaryColor,
      badgeBackground: theme.primaryLight ?? innerSurface,
      badgeTextColor: invertedText,
      titleColor: primaryColor,
      emptySetter: set_WorkingEmpty,
      isEmpty: workingEmpty,
    },
    {
      type: "COOLDOWN",
      title: "Cooldown",
      badge: "Cooldown",
      accent: quietText,
      badgeBackground: innerSurface,
      badgeTextColor: titleColor,
      titleColor: titleColor,
      emptySetter: set_CooldownEmpty,
      isEmpty: cooldownEmpty,
    },
  ];

  return (
    <ThemedView safe={false} style={{ flex: 1 }}>
      <ThemedKeyboardProtection scroll>
        <View style={styles.heroShell}>
          <ThemedCard
            style={[
              styles.heroCard,
              {
                backgroundColor: isDone
                  ? "rgba(96, 218, 172, 0.08)"
                  : cardSurface,
                borderColor: isDone
                  ? secondaryColor
                  : isRunning
                    ? primaryColor
                    : cardBorder,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.heroAccentPrimary,
                { backgroundColor: isDone ? secondaryColor : primaryColor },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.heroAccentSecondary,
                { backgroundColor: secondaryColor },
              ]}
            />

            <View style={styles.heroContentRow}>
              <View style={styles.heroInfoColumn}>
                <View style={styles.heroTimerBlock}>
                  <ThemedText style={styles.heroTimerLabel} setColor={quietText}>
                    Elapsed time
                  </ThemedText>
                  <ThemedText style={styles.heroTimerValue} setColor={titleColor}>
                    {formatTime(currentElapsed)}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.heroMetaCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={styles.heroMetaLabel} setColor={quietText}>
                    Started
                  </ThemedText>
                  <ThemedText style={styles.heroMetaValue} setColor={titleColor}>
                    {startedDisplay}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroLiveColumn}>
                <View
                  style={[
                    styles.heroLiveCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor: isRunning ? primaryColor : cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={styles.heroLiveLabel} setColor={quietText}>
                    Total Distance
                  </ThemedText>
                  <ThemedText style={styles.heroLiveValue} setColor={titleColor}>
                    {formattedTotalDistance}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.heroLiveSubCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={styles.heroLiveLabel} setColor={quietText}>
                    Avg Pace
                  </ThemedText>
                  <ThemedText style={styles.heroLiveSubValue} setColor={titleColor}>
                    {avgPaceDisplay}
                  </ThemedText>
                </View>
              </View>
            </View>

            {!isDone && (
              <View style={styles.heroActionsRow}>
                {!isRunning && (
                  <View
                    style={[
                      styles.heroActionSlot,
                      original_start_time !== null && styles.heroActionSlotSpaced,
                    ]}
                  >
                    <ThemedButton
                      title={original_start_time !== null ? "Continue" : "Start"}
                      onPress={startWorkout}
                      variant="primary"
                      disabled={isDone || isRunning || isControlBusy}
                      style={styles.heroActionButton}
                    />
                  </View>
                )}

                {!isRunning && original_start_time !== null && (
                  <View style={styles.heroActionSlot}>
                    <ThemedButton
                      title="Finish Run"
                      onPress={endWorkout}
                      variant="secondary"
                      disabled={original_start_time === null || isDone || isControlBusy}
                      style={styles.heroActionButton}
                    />
                  </View>
                )}

                {isRunning && (
                  <View style={styles.heroActionSlot}>
                    <ThemedButton
                      title="Pause"
                      onPress={pauseWorkout}
                      variant="primary"
                      disabled={!isRunning || isDone || isControlBusy}
                      style={styles.heroActionButton}
                    />
                  </View>
                )}
              </View>
            )}
          </ThemedCard>
        </View>

        {shouldShowDebugCard && (
          <View style={styles.debugShell}>
            <ThemedCard
              style={[
                styles.debugCard,
                {
                  backgroundColor: cardSurface,
                  borderColor:
                    debugSummary.rejectedCount > 0 ? primaryColor : cardBorder,
                },
              ]}
            >
              <View style={styles.debugHeaderRow}>
                <View style={styles.debugHeaderCopy}>
                  <ThemedText style={styles.debugEyebrow} setColor={quietText}>
                    GPS Debug
                  </ThemedText>
                  <ThemedText style={styles.debugTitle} setColor={titleColor}>
                    Location callbacks
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.debugStatusBadge,
                    {
                      backgroundColor: isRunning
                        ? theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)"
                        : innerSurface,
                      borderColor: isRunning ? secondaryColor : cardBorder,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.debugStatusText}
                    setColor={
                      isRunning
                        ? theme.secondaryDark ?? secondaryColor
                        : quietText
                    }
                  >
                    {isRunning ? "Live" : "Stored"}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={styles.debugSubtitle} setColor={quietText}>
                {debugSummary.totalCallbacks > 0
                  ? "Every GPS callback is logged here, even when distance is rejected."
                  : "Start the run and this panel will show whether GPS callbacks arrive at all."}
              </ThemedText>

              <View style={styles.debugStatsRow}>
                <View
                  style={[
                    styles.debugStatCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={styles.debugStatLabel} setColor={quietText}>
                    Raw callbacks
                  </ThemedText>
                  <ThemedText style={styles.debugStatValue} setColor={titleColor}>
                    {debugSummary.totalCallbacks}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.debugStatCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor: secondaryColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.debugStatLabel} setColor={quietText}>
                    Accepted
                  </ThemedText>
                  <ThemedText
                    style={styles.debugStatValue}
                    setColor={theme.secondaryDark ?? secondaryColor}
                  >
                    {debugSummary.acceptedCount}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.debugStatCard,
                    {
                      backgroundColor: innerSurface,
                      borderColor:
                        debugSummary.rejectedCount > 0 ? primaryColor : cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={styles.debugStatLabel} setColor={quietText}>
                    Rejected
                  </ThemedText>
                  <ThemedText
                    style={styles.debugStatValue}
                    setColor={
                      debugSummary.rejectedCount > 0 ? primaryColor : titleColor
                    }
                  >
                    {debugSummary.rejectedCount}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.debugReasonRow}>
                {debugReasonBadges.map((item) => (
                  <View
                    key={item.label}
                    style={[
                      styles.debugReasonBadge,
                      {
                        backgroundColor: item.backgroundColor,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.debugReasonText}
                      setColor={item.textColor}
                    >
                      {item.label}: {item.value}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.debugButtonRow}>
                <ThemedButton
                  title="Open GPS Debug"
                  variant="secondary"
                  onPress={() => set_debugModalVisible(true)}
                  style={styles.debugButton}
                />
              </View>
            </ThemedCard>
          </View>
        )}

        {sectionConfigs.map((section) => (
          <View key={section.type} style={styles.sectionShell}>
            <ThemedCard
              style={[
                styles.sectionCard,
                {
                  backgroundColor: cardSurface,
                  borderColor:
                    section.isEmpty || section.type === "COOLDOWN"
                      ? cardBorder
                      : section.accent,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleBlock}>
                  <View
                    style={[
                      styles.sectionBadge,
                      {
                        backgroundColor: section.badgeBackground,
                        borderColor:
                          section.isEmpty || section.type === "COOLDOWN"
                            ? cardBorder
                            : section.accent,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.sectionBadgeText}
                      setColor={section.badgeTextColor}
                    >
                      {section.badge}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={styles.sectionTitle}
                    setColor={
                      section.isEmpty
                        ? quietText
                        : section.titleColor ?? titleColor
                    }
                  >
                    {section.title}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={[
                    styles.sectionAddButton,
                    {
                      backgroundColor: innerSurface,
                      borderColor:
                        section.isEmpty || section.type === "COOLDOWN"
                          ? cardBorder
                          : section.accent,
                      opacity: section.isEmpty ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => addSet(section.type)}
                >
                  <PlusCircled width={20} height={20} color={section.accent} />
                </TouchableOpacity>
              </View>

              <RunSetList
                reloadKey={updateCount}
                triggerReload={triggerReload}
                empty={section.emptySetter}
                workout_id={workout_id}
                type={section.type}
                activeSet={activeSet}
                activeSet_remainingTime={activeSet_remainingTime}
              />
            </ThemedCard>
          </View>
        ))}
      </ThemedKeyboardProtection>

      <RunLocationDebugModal
        visible={debugModalVisible}
        onClose={() => set_debugModalVisible(false)}
        report={trackedDebugReport}
        hasWorkoutStarted={original_start_time !== null}
      />
    </ThemedView>
  );
};

export default Run;
