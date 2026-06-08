import { Alert, AppState, TouchableOpacity, View, Vibration } from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import { useColorScheme } from "react-native";

import RunSetList from "./RunSetList";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Distance from "../../../../Resources/Icons/UI-icons/Distance";
import Speed from "../../../../Resources/Icons/UI-icons/Speed";
import Time from "../../../../Resources/Icons/UI-icons/Time";
import {
  ThemedCard,
  ThemedView,
  ThemedText,
  ThemedKeyboardProtection,
} from "../../../../Resources/ThemedComponents";
import styles from "./RunStyle";

import {
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../../../Utils/timeUtils";
import {
  locationService,
  runningService as runningRepository,
  workoutService as workoutRepository,
} from "../../../../Services";

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

const formatRunClock = (totalSeconds) => {
  const safeTotalSeconds = normalizeElapsedDurationSeconds(totalSeconds, 0);
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
};

const getRunTrackingStartMessage = (error) => {
  const message = String(error?.message ?? "");

  if (message.includes("Precise location permission")) {
    return "FitVen needs Precise/Fine location permission to track run distance accurately. Enable precise location for FitVen and try again.";
  }

  if (message.includes("Background location permission")) {
    return "FitVen needs background location permission so distance continues tracking while the app is not in front.";
  }

  return "Check that location is allowed and turned on, then try again.";
};

const Run = ({ workout_id, restartRequestKey }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();

  const [updateCount, set_updateCount] = useState(0);
  const triggerReload = () => {
    set_updateCount((prev) => prev + 1);
  };

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

  const [activeSet, set_activeSet] = useState(null);
  const [activeSet_remainingTime, set_activeSet_remainingTime] = useState(0);

  const previousActiveSetRef = useRef(null);
  const timerStartRef = useRef(null);
  const elapsedTimeRef = useRef(0);
  const workoutStateLoadRequestRef = useRef(0);
  const activeSetCalculationInFlightRef = useRef(false);
  const trackedSummaryLoadingRef = useRef(false);

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
  }, [db, workout_id, calculateActiveSet, loadTrackedRunSummary]);

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
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      loadTrackedRunSummary();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, loadTrackedRunSummary]);

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
    } catch (error) {
      console.error("Failed to start run tracking:", error);
      Alert.alert(
        "Location tracking could not start",
        getRunTrackingStartMessage(error)
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
  const screenBackground = theme.background ?? "#0E0F12";
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const avgPaceMinutes =
    totalDistance > 0 ? currentElapsed / 60 / totalDistance : null;
  const formattedTotalDistance = Number(totalDistance.toFixed(2)).toFixed(2);
  const avgPaceDisplay = formatPaceDisplay(avgPaceMinutes);
  const elapsedDisplay = formatRunClock(currentElapsed);
  const shouldShowFinishRunPill =
    original_start_time !== null && !isRunning && !isDone;
  const primaryActionLabel = isRunning
    ? "Pause"
    : original_start_time !== null
      ? "Continue run"
      : "Start run";
  const canUsePrimaryAction = !isDone && !isControlBusy;
  const handlePrimaryAction = isRunning ? pauseWorkout : startWorkout;
  const metricCards = [
    {
      label: "TIME",
      Icon: Time,
      value: elapsedDisplay,
      unit: null,
    },
    {
      label: "DIST",
      Icon: Distance,
      value: formattedTotalDistance,
      unit: "km",
    },
    {
      label: "PACE",
      Icon: Speed,
      value: avgPaceDisplay,
      unit: "/km",
    },
    {
      label: "HR",
      value: "--",
      unit: "bpm",
    },
  ];

  const sectionConfigs = [
    {
      type: "WARMUP",
      variant: "segment",
      title: "Warmup",
      eyebrow: "WARMUP",
      emptySummary: "Add warmup",
    },
    {
      type: "WORKING_SET",
      variant: "intervals",
      title: "Intervals",
      eyebrow: "INTERVALS",
      emptySummary: "Add intervals to build this run",
    },
    {
      type: "COOLDOWN",
      variant: "segment",
      title: "Cooldown",
      eyebrow: "COOLDOWN",
      emptySummary: "Add cooldown",
    },
  ];

  return (
    <ThemedView
      safe={false}
      style={[styles.screen, { backgroundColor: screenBackground }]}
    >
      <ThemedKeyboardProtection
        scroll
        contentContainerStyle={styles.scrollContent}
        scrollViewProps={{ showsVerticalScrollIndicator: false }}
      >
        <View style={styles.runLayout}>
          <ThemedCard
            style={[
              styles.heroCard,
              {
                backgroundColor: cardSurface,
                borderColor: isRunning ? primaryColor : cardBorder,
              },
            ]}
          >
            <View style={styles.heroMetricsRow}>
              {metricCards.map((metric, index) => (
                <View
                  key={metric.label}
                  style={styles.heroMetricGroup}
                >
                  <View style={styles.heroMetricCard}>
                    <View style={styles.heroMetricHeader}>
                      {metric.Icon ? (
                        <metric.Icon
                          width={20}
                          height={20}
                          stroke={primaryColor}
                          color={primaryColor}
                        />
                      ) : (
                        <ThemedText
                          style={styles.heroMetricLabel}
                          setColor={primaryColor}
                        >
                          {metric.label}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText
                      style={styles.heroMetricValue}
                      setColor={titleColor}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {metric.value}
                    </ThemedText>
                    <ThemedText style={styles.heroMetricUnit} setColor={quietText}>
                      {metric.unit ?? " "}
                    </ThemedText>
                  </View>

                  {index < metricCards.length - 1 && (
                    <View
                      style={[
                        styles.heroMetricDivider,
                        { backgroundColor: cardBorder },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>

            {!isDone && (
              <View style={styles.heroActionRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={!canUsePrimaryAction}
                  onPress={handlePrimaryAction}
                  style={[
                    styles.heroPrimaryButton,
                    {
                      backgroundColor: primaryColor,
                      opacity: canUsePrimaryAction ? 1 : 0.58,
                    },
                  ]}
                >
                  {isRunning ? (
                    <View style={styles.heroPauseSymbol}>
                      <View
                        style={[
                          styles.heroPauseBar,
                          { backgroundColor: invertedText },
                        ]}
                      />
                      <View
                        style={[
                          styles.heroPauseBar,
                          { backgroundColor: invertedText },
                        ]}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.heroPlayIcon,
                        { borderLeftColor: invertedText },
                      ]}
                    />
                  )}
                  <ThemedText
                    style={styles.heroPrimaryButtonText}
                    setColor={invertedText}
                  >
                    {primaryActionLabel}
                  </ThemedText>
                </TouchableOpacity>

                {shouldShowFinishRunPill ? (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    disabled={isControlBusy}
                    onPress={endWorkout}
                    style={[
                      styles.heroSecondaryButton,
                      {
                        backgroundColor: innerSurface,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.heroSecondaryButtonText}
                      setColor={quietText}
                    >
                      FINISH
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </ThemedCard>

          {sectionConfigs.map((section) => (
            <RunSetList
              key={section.type}
              reloadKey={updateCount}
              triggerReload={triggerReload}
              workout_id={workout_id}
              type={section.type}
              variant={section.variant}
              sectionTitle={section.title}
              sectionEyebrow={section.eyebrow}
              emptySummary={section.emptySummary}
              onAddSet={() => addSet(section.type)}
              activeSet={activeSet}
              activeSet_remainingTime={activeSet_remainingTime}
            />
          ))}
        </View>
      </ThemedKeyboardProtection>
    </ThemedView>
  );
};

export default Run;
