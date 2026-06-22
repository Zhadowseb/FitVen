import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
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
import { calculateTrackedDistanceSummary } from "../../../../Utils/locationUtils";
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

const formatRunDistance = (distanceKm) => {
  const safeDistance = Number(distanceKm);

  if (!Number.isFinite(safeDistance) || safeDistance <= 0) {
    return "0.00";
  }

  return safeDistance.toFixed(2);
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

const RUN_WORKOUT_FLOW_OPTIONS = [
  {
    id: "endurance-base",
    title: "Endurance & Base",
    subtitle: "Base Run, Long Run, Recovery Run",
    image: require("./Assets/Endurance&base.png"),
  },
  {
    id: "speed-structure",
    title: "Speed & Structure",
    subtitle: "Interval, Fartlek, Hill Repeats",
    image: require("./Assets/Speed&structure.png"),
  },
  {
    id: "performance-threshold",
    title: "Performance & Threshold",
    subtitle: "Tempo Run, Progression Run",
    image: require("./Assets/Performance&threshold.png"),
  },
  {
    id: "custom",
    title: "Custom",
    subtitle: "Build from blank",
    image: require("./Assets/Custom.png"),
  },
];

const RUN_WORKOUT_STATUS_STEPS = [
  { id: "plan", label: "Plan" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
];

function getRunFlowOption(optionId) {
  return (
    RUN_WORKOUT_FLOW_OPTIONS.find((option) => option.id === optionId) ?? null
  );
}

const EMPTY_RUN_SECTION_COUNTS = {
  WARMUP: 0,
  WORKING_SET: 0,
  COOLDOWN: 0,
};

function normalizeRunSectionType(type) {
  const normalizedType = String(type ?? "WORKING_SET")
    .trim()
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (normalizedType === "WARMUP" || normalizedType === "WARM_UP") {
    return "WARMUP";
  }

  if (normalizedType === "COOLDOWN" || normalizedType === "COOL_DOWN") {
    return "COOLDOWN";
  }

  return "WORKING_SET";
}

function getRunSectionCounts(sets) {
  return sets.reduce(
    (counts, set) => {
      const type = normalizeRunSectionType(set.type);
      counts[type] += 1;

      return counts;
    },
    { ...EMPTY_RUN_SECTION_COUNTS }
  );
}

function getRunSegmentLabel(set) {
  const type = normalizeRunSectionType(set?.type);

  if (Number(set?.is_pause) === 1) {
    return "Rest";
  }

  if (type === "WARMUP") {
    return "Warmup";
  }

  if (type === "COOLDOWN") {
    return "Cooldown";
  }

  return "Sprint";
}

function getLocationLogTimestamp(log) {
  const timestamp = Number(log?.timestamp);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getLogsFromTimestamp(logs, startTimestampMs) {
  if (!Number.isFinite(startTimestampMs)) {
    return [];
  }

  return logs.filter((log) => {
    const timestamp = getLocationLogTimestamp(log);
    return timestamp !== null && timestamp >= startTimestampMs;
  });
}

function calculatePaceForLogWindow(logs) {
  const summary = calculateTrackedDistanceSummary(logs);

  if (!Number.isFinite(summary.totalDistanceKm) || summary.totalDistanceKm <= 0) {
    return null;
  }

  const timestamps = logs
    .map(getLocationLogTimestamp)
    .filter((timestamp) => timestamp !== null);

  if (timestamps.length < 2) {
    return null;
  }

  const elapsedMinutes =
    (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;

  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) {
    return null;
  }

  return elapsedMinutes / summary.totalDistanceKm;
}

function getRecentPaceMinutes(logs, currentTimestampSeconds) {
  const currentTimestampMs = currentTimestampSeconds * 1000;
  const recentLogs = getLogsFromTimestamp(logs, currentTimestampMs - 30000);
  const recentPace = calculatePaceForLogWindow(recentLogs);

  if (recentPace !== null) {
    return recentPace;
  }

  return calculatePaceForLogWindow(
    getLogsFromTimestamp(logs, currentTimestampMs - 60000)
  );
}

const Run = ({ workout_id, restartRequestKey }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();

  const [updateCount, set_updateCount] = useState(0);
  const triggerReload = () => {
    set_updateCount((prev) => prev + 1);
  };

  const [selectedRunFlow, set_selectedRunFlow] = useState(null);
  const [isSelectingRunFlow, set_isSelectingRunFlow] = useState(false);
  const [hasRunStructure, set_hasRunStructure] = useState(false);
  const [runSectionCounts, set_runSectionCounts] = useState(
    EMPTY_RUN_SECTION_COUNTS
  );
  const [activeRunSegment, set_activeRunSegment] = useState(null);
  const [currentPaceMinutes, set_currentPaceMinutes] = useState(null);
  const [activeSegmentDistance, set_activeSegmentDistance] = useState(0);
  const [runStructureLoaded, set_runStructureLoaded] = useState(false);
  const [original_start_time, set_original_start_time] = useState(null);
  const [timer_start, set_timer_start] = useState(null);
  const [elapsed_time, set_elapsed_time] = useState(0);
  const [isDone, set_isDone] = useState(false);
  const [workoutStateLoaded, set_workoutStateLoaded] = useState(false);
  const [isRunning, set_isRunning] = useState(false);
  const [isControlBusy, set_isControlBusy] = useState(false);
  const [totalDistance, set_totalDistance] = useState(0);
  const [timerTick, set_timerTick] = useState(() =>
    getCurrentStoredTimestampSeconds()
  );

  const [activeSet, set_activeSet] = useState(null);
  const [activeSet_remainingTime, set_activeSet_remainingTime] = useState(0);

  const previousActiveSetRef = useRef(null);
  const activeRunSegmentRef = useRef(null);
  const timerStartRef = useRef(null);
  const elapsedTimeRef = useRef(0);
  const workoutStateLoadRequestRef = useRef(0);
  const activeSetCalculationInFlightRef = useRef(false);
  const trackedSummaryLoadingRef = useRef(false);

  const normalizeTimerStartValue = (value) =>
    normalizeStoredTimestampSeconds(value);

  useEffect(() => {
    set_selectedRunFlow(null);
    set_isSelectingRunFlow(false);
    set_hasRunStructure(false);
    set_runSectionCounts(EMPTY_RUN_SECTION_COUNTS);
    set_activeRunSegment(null);
    set_currentPaceMinutes(null);
    set_activeSegmentDistance(0);
    set_runStructureLoaded(false);
    set_workoutStateLoaded(false);
  }, [workout_id]);

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

  useEffect(() => {
    activeRunSegmentRef.current = activeRunSegment;
  }, [activeRunSegment]);

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
    activeRunSegmentRef.current = null;
    set_activeSet(null);
    set_activeSet_remainingTime(0);
    set_activeRunSegment(null);
    set_activeSegmentDistance(0);
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
      const logs = await locationService.getLocationLogsByWorkout(db, workout_id);
      const summary = calculateTrackedDistanceSummary(logs);
      const activeSegmentStartTimestampSeconds =
        activeRunSegmentRef.current?.startTimestampSeconds ?? null;
      const activeSegmentLogs =
        activeSegmentStartTimestampSeconds !== null
          ? getLogsFromTimestamp(logs, activeSegmentStartTimestampSeconds * 1000)
          : [];
      const activeSegmentSummary =
        calculateTrackedDistanceSummary(activeSegmentLogs);

      set_totalDistance(summary.totalDistanceKm);
      set_activeSegmentDistance(activeSegmentSummary.totalDistanceKm);
      set_currentPaceMinutes(
        getRecentPaceMinutes(logs, getCurrentStoredTimestampSeconds())
      );
    } catch (error) {
      console.error("Failed to load tracked run summary:", error);
    } finally {
      trackedSummaryLoadingRef.current = false;
    }
  }, [db, workout_id]);

  const loadRunStructureState = useCallback(async () => {
    try {
      const sets = await runningRepository.getOrderedRunSetsForWorkout(
        db,
        workout_id
      );

      set_hasRunStructure(sets.length > 0);
      set_runSectionCounts(getRunSectionCounts(sets));
    } catch (error) {
      console.error("Failed to load run structure state:", error);
    } finally {
      set_runStructureLoaded(true);
    }
  }, [db, workout_id]);

  const calculateActiveSet = useCallback(async (
    currentElapsed,
    startTimestampSeconds = original_start_time
  ) => {
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
      let elapsedBeforeSegment = 0;
      let completedWorkingSetCount = 0;
      const totalWorkingSetCount = sets.filter(
        (set) =>
          normalizeRunSectionType(set.type) === "WORKING_SET" &&
          Number(set.is_pause) !== 1
      ).length;

      for (let i = 0; i < sets.length; i++) {
        const setDuration = (sets[i].time ?? 0) * 60;
        const isWorkingSet =
          normalizeRunSectionType(sets[i].type) === "WORKING_SET" &&
          Number(sets[i].is_pause) !== 1;

        if (remainingElapsed >= setDuration) {
          if (!sets[i].done) {
            await runningRepository.updateRunSetDone(db, {
              runId: sets[i].Run_id,
              done: true,
            });
          }
          remainingElapsed -= setDuration;
          elapsedBeforeSegment += setDuration;

          if (isWorkingSet) {
            completedWorkingSetCount += 1;
          }
          continue;
        }

        const newActiveSet = sets[i].Run_id;
        const activeWorkingSetCount = isWorkingSet
          ? completedWorkingSetCount + 1
          : completedWorkingSetCount;

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
        const nextActiveRunSegment = {
          ...sets[i],
          actionLabel: getRunSegmentLabel(sets[i]),
          elapsedSeconds: Math.max(0, remainingElapsed),
          remainingSeconds: Math.max(0, setDuration - remainingElapsed),
          startTimestampSeconds:
            startTimestampSeconds !== null
              ? startTimestampSeconds + elapsedBeforeSegment
              : null,
          intervalIndex: activeWorkingSetCount,
          totalIntervals: totalWorkingSetCount,
        };

        activeRunSegmentRef.current = nextActiveRunSegment;
        set_activeRunSegment(nextActiveRunSegment);
        return;
      }

      clearActiveSegment();
    } finally {
      activeSetCalculationInFlightRef.current = false;
    }
  }, [db, original_start_time, workout_id]);

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

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    if (!row) {
      set_workoutStateLoaded(true);
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
    set_selectedRunFlow(getRunFlowOption(row.run_focus_type)?.id ?? null);

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    if (resolvedOriginalStartTime !== null && !nextIsDone) {
      await calculateActiveSet(currentElapsed, resolvedOriginalStartTime);
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
    set_workoutStateLoaded(true);
  }, [db, workout_id, calculateActiveSet, loadTrackedRunSummary]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkoutState();
    }, [loadWorkoutState])
  );

  useFocusEffect(
    useCallback(() => {
      void loadRunStructureState();
    }, [loadRunStructureState])
  );

  useEffect(() => {
    void loadRunStructureState();
  }, [loadRunStructureState, updateCount]);

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

      if (isFreshStart) {
        workoutRepository.notifyWorkoutStartedInBackground(db, {
          workoutId: workout_id,
          startedAt: start_time,
        });
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
      set_currentPaceMinutes(null);
      set_activeSegmentDistance(0);
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
      set_hasRunStructure(true);
      triggerReload();
    } catch (error) {
      console.error("Failed to add run set:", error);
    }
  };

  const selectRunFlow = async (runFlowId) => {
    const nextRunFlowId = getRunFlowOption(runFlowId)?.id ?? null;

    set_selectedRunFlow(nextRunFlowId);
    set_isSelectingRunFlow(false);

    try {
      await workoutRepository.updateWorkoutRunFocusType(db, {
        workoutId: workout_id,
        runFocusType: nextRunFlowId,
      });
    } catch (error) {
      console.error("Failed to save run focus type:", error);
    }
  };

  const returnToRunFlowSelection = async () => {
    set_selectedRunFlow(null);
    set_isSelectingRunFlow(true);

    try {
      await workoutRepository.updateWorkoutRunFocusType(db, {
        workoutId: workout_id,
        runFocusType: null,
      });
    } catch (error) {
      console.error("Failed to clear run focus type:", error);
    }
  };

  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const secondaryColor = theme.secondary ?? Colors.dark.secondary;
  const secondaryDark = theme.secondaryDark ?? secondaryColor;
  const screenBackground = theme.background ?? "#0E0F12";
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const avgPaceMinutes =
    totalDistance > 0 ? currentElapsed / 60 / totalDistance : null;
  const formattedTotalDistance = formatRunDistance(totalDistance);
  const avgPaceDisplay = formatPaceDisplay(avgPaceMinutes);
  const elapsedDisplay = formatRunClock(currentElapsed);
  const runShellReady = workoutStateLoaded && runStructureLoaded;
  const canChangeRunFlow =
    original_start_time === null && !isDone && !isRunning;
  const isFreshRunWithoutStructure =
    original_start_time === null && !isDone && !isRunning && !hasRunStructure;
  const shouldShowRunFlowSuggestions =
    runShellReady &&
    selectedRunFlow === null &&
    canChangeRunFlow &&
    (isFreshRunWithoutStructure || isSelectingRunFlow);
  const shouldShowHeroMetrics =
    !isFreshRunWithoutStructure || selectedRunFlow === "speed-structure";
  const selectedRunFlowOption = getRunFlowOption(selectedRunFlow);
  const shouldShowSpeedStructureTimer =
    selectedRunFlow === "speed-structure" && original_start_time !== null;
  const runWorkoutStatus = isDone
    ? "done"
    : original_start_time !== null
      ? "active"
      : "plan";
  const runWorkoutStatusIndex = RUN_WORKOUT_STATUS_STEPS.findIndex(
    (step) => step.id === runWorkoutStatus
  );
  const shouldPruneEmptyPlanSections =
    selectedRunFlow === "speed-structure" && original_start_time !== null;
  const shouldShowFinishRunPill =
    original_start_time !== null && !isRunning && !isDone;
  const primaryActionLabel = isRunning
    ? "Pause"
    : original_start_time !== null
      ? "Continue run"
      : "Start run";
  const canUsePrimaryAction = !isDone && !isControlBusy;
  const handlePrimaryAction = shouldShowRunFlowSuggestions
    ? () => selectRunFlow("custom")
    : isRunning
      ? pauseWorkout
      : startWorkout;
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
  const speedStructureActionLabel =
    activeRunSegment?.actionLabel ?? (isDone ? "Complete" : "No active step");
  const speedStructureCountdownDisplay = formatRunClock(
    activeRunSegment?.remainingSeconds ?? 0
  );
  const currentPaceDisplay = formatPaceDisplay(currentPaceMinutes);
  const currentIntervalValue =
    activeRunSegment?.totalIntervals > 0
      ? `${activeRunSegment.intervalIndex} / ${activeRunSegment.totalIntervals}`
      : "--";
  const pulseDisplay = activeRunSegment?.heartrate
    ? `Z${activeRunSegment.heartrate}`
    : "--";
  const activeSegmentDistanceDisplay = formatRunDistance(activeSegmentDistance);
  const totalTimeDistanceDisplay = `${elapsedDisplay} / ${formattedTotalDistance}`;
  const renderRunFlowImage = (option) => (
    <View
      style={[
        styles.runFlowImageFrame,
        {
          backgroundColor: innerSurface,
          borderColor: cardBorder,
        },
      ]}
    >
      <Image
        source={option.image}
        resizeMode="cover"
        style={styles.runFlowImage}
      />
    </View>
  );

  const renderRunStatusProgress = () => (
    <View
      style={[
        styles.runStatusPill,
        {
          backgroundColor: innerSurface,
          borderColor: cardBorder,
        },
      ]}
    >
      {RUN_WORKOUT_STATUS_STEPS.map((step, index) => {
        const isCurrent = step.id === runWorkoutStatus;
        const isReached = index <= runWorkoutStatusIndex;

        return (
          <View
            key={step.id}
            style={[
              styles.runStatusTab,
              isCurrent && { backgroundColor: cardSurface },
            ]}
          >
            <ThemedText
              style={styles.runStatusLabel}
              setColor={
                isCurrent ? primaryColor : isReached ? titleColor : quietText
              }
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {step.label}
            </ThemedText>

            {isCurrent && (
              <View style={styles.runStatusLampWrap}>
                <View
                  style={[
                    styles.runStatusLampGlowWide,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <View
                  style={[
                    styles.runStatusLampGlowTight,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <View
                  style={[
                    styles.runStatusLamp,
                    {
                      backgroundColor: primaryColor,
                      shadowColor: primaryColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderRunFlowSuggestions = () => (
    <View style={styles.runFlowShell}>
      <View style={styles.runFlowHeader}>
        <ThemedText style={styles.runFlowTitle} setColor={titleColor}>
          Choose your run focus
        </ThemedText>
      </View>

      <View style={styles.runFlowGrid}>
        {RUN_WORKOUT_FLOW_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.84}
            accessibilityRole="button"
            onPress={() => selectRunFlow(option.id)}
            style={[
              styles.runFlowCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            {renderRunFlowImage(option)}

            <View style={styles.runFlowCardCopy}>
              <ThemedText
                style={styles.runFlowCardTitle}
                setColor={titleColor}
                numberOfLines={2}
              >
                {option.title}
              </ThemedText>
              <ThemedText
                style={styles.runFlowCardSubtitle}
                setColor={primaryColor}
                numberOfLines={2}
              >
                {option.subtitle}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSpeedStructureTimer = () => (
    <View style={styles.speedTimerShell}>
      <View style={styles.speedTimerActionBlock}>
        <ThemedText style={styles.speedTimerEyebrow} setColor={primaryColor}>
          ACTION
        </ThemedText>
        <View style={styles.speedTimerActionRow}>
          <ThemedText
            style={styles.speedTimerActionText}
            setColor={titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {speedStructureActionLabel}
          </ThemedText>
          <ThemedText
            style={styles.speedTimerCountdown}
            setColor={primaryColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {speedStructureCountdownDisplay}
          </ThemedText>
        </View>
      </View>

      <View
        style={[
          styles.speedTimerPrimaryRow,
          {
            borderTopColor: cardBorder,
            borderBottomColor: cardBorder,
          },
        ]}
      >
        <View style={styles.speedTimerPrimaryStat}>
          <ThemedText style={styles.speedTimerLabel} setColor={quietText}>
            CURRENT PACE
          </ThemedText>
          <ThemedText
            style={styles.speedTimerPrimaryValue}
            setColor={titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {currentPaceDisplay}
          </ThemedText>
          <ThemedText style={styles.speedTimerUnit} setColor={quietText}>
            /km
          </ThemedText>
        </View>

        <View
          style={[
            styles.speedTimerDivider,
            { backgroundColor: cardBorder },
          ]}
        />

        <View style={styles.speedTimerPrimaryStat}>
          <ThemedText style={styles.speedTimerLabel} setColor={quietText}>
            INTERVAL
          </ThemedText>
          <ThemedText
            style={styles.speedTimerPrimaryValue}
            setColor={titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {currentIntervalValue}
          </ThemedText>
          <ThemedText style={styles.speedTimerUnit} setColor={quietText}>
            set
          </ThemedText>
        </View>
      </View>

      <View style={styles.speedTimerSecondaryRow}>
        <View style={styles.speedTimerSecondaryStat}>
          <ThemedText style={styles.speedTimerSecondaryLabel} setColor={quietText}>
            HR
          </ThemedText>
          <ThemedText style={styles.speedTimerSecondaryValue} setColor={titleColor}>
            {pulseDisplay}
          </ThemedText>
        </View>

        <View style={styles.speedTimerSecondaryStat}>
          <ThemedText style={styles.speedTimerSecondaryLabel} setColor={quietText}>
            SEG DIST
          </ThemedText>
          <ThemedText style={styles.speedTimerSecondaryValue} setColor={titleColor}>
            {activeSegmentDistanceDisplay} km
          </ThemedText>
        </View>

        <View style={styles.speedTimerSecondaryStat}>
          <ThemedText style={styles.speedTimerSecondaryLabel} setColor={quietText}>
            TOTAL
          </ThemedText>
          <ThemedText
            style={styles.speedTimerSecondaryValue}
            setColor={titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {totalTimeDistanceDisplay} km
          </ThemedText>
        </View>
      </View>
    </View>
  );

  const renderRunLoadingState = () => (
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
              styles.runLoadingCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ActivityIndicator color={primaryColor} />
          </ThemedCard>
        </View>
      </ThemedKeyboardProtection>
    </ThemedView>
  );

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
  const visibleSectionConfigs = sectionConfigs.filter((section) => {
    if (
      !shouldPruneEmptyPlanSections ||
      section.type === "WORKING_SET"
    ) {
      return true;
    }

    return (runSectionCounts[section.type] ?? 0) > 0;
  });

  if (!runShellReady) {
    return renderRunLoadingState();
  }

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
            {renderRunStatusProgress()}

            {selectedRunFlowOption && (
              <TouchableOpacity
                activeOpacity={canChangeRunFlow ? 0.78 : 1}
                accessibilityRole="button"
                disabled={!canChangeRunFlow}
                onPress={returnToRunFlowSelection}
                style={[
                  styles.heroRunFocusBadge,
                  {
                    backgroundColor: innerSurface,
                    borderColor: primaryColor,
                  },
                ]}
              >
                <ThemedText
                  style={styles.heroRunFocusBadgeText}
                  setColor={primaryColor}
                >
                  {selectedRunFlowOption.title}
                </ThemedText>
              </TouchableOpacity>
            )}

            {shouldShowSpeedStructureTimer ? (
              renderSpeedStructureTimer()
            ) : shouldShowHeroMetrics && (
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
            )}

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
                        backgroundColor: secondaryColor,
                        borderColor: secondaryDark,
                        opacity: isControlBusy ? 0.58 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.heroSecondaryButtonText}
                      setColor={invertedText}
                    >
                      FINISH
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </ThemedCard>

          {shouldShowRunFlowSuggestions
            ? renderRunFlowSuggestions()
            : visibleSectionConfigs.map((section) => (
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
