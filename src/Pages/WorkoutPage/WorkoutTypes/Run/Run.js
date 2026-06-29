import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MapView, { Marker, Polyline } from "react-native-maps";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";

import RunSetList from "./RunSetList";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Distance from "../../../../Resources/Icons/UI-icons/Distance";
import Speed from "../../../../Resources/Icons/UI-icons/Speed";
import Time from "../../../../Resources/Icons/UI-icons/Time";
import Cross from "../../../../Resources/Icons/UI-icons/Cross";
import {
  ThemedCard,
  ThemedView,
  ThemedText,
  ThemedKeyboardProtection,
  ThemedEditableCell,
} from "../../../../Resources/ThemedComponents";
import styles from "./RunStyle";
import {
  buildTargetHeartRateHistory,
  FALLBACK_MAX_HEART_RATE,
  getHeartRateZoneThresholds,
  getHeartRateZoneColor,
} from "./RunHeartRateChartConfig";
import { buildHeartRateZones } from "../../../../Utils/heartRateUtils";
import { useAuth } from "../../../../Contexts/AuthContext";

import {
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../../../Utils/timeUtils";
import { calculateTrackedDistanceSummary } from "../../../../Utils/locationUtils";
import {
  locationService,
  runningService as runningRepository,
  socialService,
  workoutService as workoutRepository,
} from "../../../../Services";

const RUN_HEART_RATE_ZONES = [1, 2, 3, 4, 5];
const RUN_HEART_RATE_ZONE_COLORS = {
  1: "#9CA3AF",
  2: "#22C7F2",
  3: "#10B981",
  4: "#F7742E",
  5: "#EF4444",
};
const RUN_ZONE_POPOVER_WIDTH = 238;
const RUN_ZONE_POPOVER_HEIGHT = 40;
const RUN_ZONE_POPOVER_MARGIN = 12;
const DEFAULT_ENDURANCE_STAT_PRIORITY = [
  "time",
  "zone",
  "distance",
  "pace",
];
const ENDURANCE_STAT_LABELS = {
  time: "Time",
  zone: "Zone",
  distance: "Distance",
  pace: "Pace",
};
const STAT_PRIORITY_ROW_HEIGHT = 48;

const normalizeEnduranceStatPriority = (value) => {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = [];
    }
  }

  const validValues = Array.isArray(parsedValue)
    ? parsedValue.filter((key) =>
        DEFAULT_ENDURANCE_STAT_PRIORITY.includes(key)
      )
    : [];

  return [
    ...new Set([
      ...validValues,
      ...DEFAULT_ENDURANCE_STAT_PRIORITY,
    ]),
  ];
};

const DraggablePriorityRow = ({
  itemKey,
  index,
  itemCount,
  onMove,
  cardBorder,
  quietText,
  titleColor,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(index);
  const itemCountRef = useRef(itemCount);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    indexRef.current = index;
    itemCountRef.current = itemCount;
    onMoveRef.current = onMove;
  }, [index, itemCount, onMove]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const targetIndex = Math.max(
          0,
          Math.min(
            itemCountRef.current - 1,
            indexRef.current +
              Math.round(gestureState.dy / STAT_PRIORITY_ROW_HEIGHT)
          )
        );

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 24,
          bounciness: 4,
        }).start();
        onMoveRef.current?.(itemKey, targetIndex);
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.statPriorityRow,
        {
          borderColor: cardBorder,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.statPriorityRank}>
        <ThemedText style={styles.statPriorityRankText} setColor={quietText}>
          {index + 1}
        </ThemedText>
      </View>
      <ThemedText style={styles.statPriorityLabel} setColor={titleColor}>
        {ENDURANCE_STAT_LABELS[itemKey]}
      </ThemedText>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${ENDURANCE_STAT_LABELS[itemKey]}`}
        style={styles.statPriorityDragHandle}
        {...panResponder.panHandlers}
      >
        <Feather name="menu" size={20} color={quietText} />
      </View>
    </Animated.View>
  );
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

const parsePositiveRunValue = (value) => {
  const numericValue = Number(String(value ?? "").trim().replace(",", "."));

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
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

const formatPaceAxisLabel = (paceMinutes) => {
  const totalSeconds = Math.max(0, Math.round(Number(paceMinutes) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatSignedPaceDelta = (seconds) => {
  const numericSeconds = Number(seconds);

  if (!Number.isFinite(numericSeconds)) {
    return "--";
  }

  const roundedSeconds = Math.round(numericSeconds);
  const sign = roundedSeconds > 0 ? "+" : roundedSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(roundedSeconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;

  return `${sign}${String(minutes).padStart(2, "0")}'${String(
    remainingSeconds
  ).padStart(2, "0")}"`;
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

function getWorkingSetPosition(sets, targetIndex) {
  if (targetIndex < 0) {
    return null;
  }

  let workingSetCount = 0;

  for (let index = 0; index <= targetIndex; index++) {
    const set = sets[index];
    const isWorkingSet =
      normalizeRunSectionType(set?.type) === "WORKING_SET" &&
      Number(set?.is_pause) !== 1;

    if (isWorkingSet) {
      workingSetCount += 1;
    }
  }

  return workingSetCount > 0 ? workingSetCount : null;
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

function splitLocationRouteSegments(logs = []) {
  const segments = [];
  let currentSegment = [];

  [...logs]
    .sort(
      (left, right) =>
        (getLocationLogTimestamp(left) ?? 0) -
        (getLocationLogTimestamp(right) ?? 0)
    )
    .forEach((log) => {
      if (log?.latitude === null || log?.longitude === null) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        return;
      }

      const latitude = Number(log?.latitude);
      const longitude = Number(log?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        return;
      }

      currentSegment.push({ latitude, longitude });
    });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function buildPaceHistory(logs = []) {
  const orderedLogs = [...logs].sort(
    (left, right) =>
      (getLocationLogTimestamp(left) ?? 0) -
      (getLocationLogTimestamp(right) ?? 0)
  );
  const firstTimestamp = orderedLogs
    .map(getLocationLogTimestamp)
    .find((timestamp) => timestamp !== null);

  if (firstTimestamp === undefined) {
    return [];
  }

  const sampleStep = Math.max(1, Math.ceil(orderedLogs.length / 42));
  const history = [];

  for (let index = sampleStep; index < orderedLogs.length; index += sampleStep) {
    const timestamp = getLocationLogTimestamp(orderedLogs[index]);

    if (timestamp === null) {
      continue;
    }

    const windowLogs = orderedLogs.filter((log) => {
      const logTimestamp = getLocationLogTimestamp(log);
      return (
        logTimestamp !== null &&
        logTimestamp <= timestamp &&
        logTimestamp >= timestamp - 60000
      );
    });
    const pace = calculatePaceForLogWindow(windowLogs);

    if (pace === null || pace < 1.5 || pace > 20) {
      continue;
    }

    history.push({
      x: Math.max(0, (timestamp - firstTimestamp) / 60000),
      y: pace,
    });
  }

  return history;
}

function getRouteRegion(routeSegments = []) {
  const coordinates = routeSegments.flat();

  if (coordinates.length === 0) {
    return null;
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.45, 0.006),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.45, 0.006),
  };
}

function buildChartPath(
  data,
  {
    invert = false,
    stepped = false,
    durationMinutes = null,
    domainMinY = null,
    domainMaxY = null,
    chartLeft = 14,
    chartRight = 306,
    chartTop = 10,
    chartBottom = 112,
  } = {}
) {
  if (!Array.isArray(data) || data.length < 2) {
    return null;
  }

  const xValues = data.map((point) => Number(point.x));
  const yValues = data.map((point) => Number(point.y));
  const minY = Number.isFinite(domainMinY) ? domainMinY : Math.min(...yValues);
  const maxY = Number.isFinite(domainMaxY) ? domainMaxY : Math.max(...yValues);
  const dataMaxX = Math.max(...xValues);
  const xRange =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : Math.max(dataMaxX, 1);
  const yRange = maxY - minY;
  const normalizedPoints = data.map((point) => {
    const clampedX = Math.min(Math.max(Number(point.x), 0), xRange);
    const x =
      chartLeft + (clampedX / xRange) * (chartRight - chartLeft);
    const clampedY = Math.min(Math.max(Number(point.y), minY), maxY);
    const normalizedY =
      yRange > 0 ? (clampedY - minY) / yRange : 0.5;
    const yRatio = invert ? normalizedY : 1 - normalizedY;
    const y = chartTop + yRatio * (chartBottom - chartTop);

    return { x, y };
  });

  return normalizedPoints.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    if (stepped) {
      const previousPoint = normalizedPoints[index - 1];
      return `${path} L ${point.x} ${previousPoint.y} L ${point.x} ${point.y}`;
    }

    return `${path} L ${point.x} ${point.y}`;
  }, "");
}

function buildHeartRateZoneSegments(
  data,
  {
    durationMinutes = null,
    domainMinY = 60,
    domainMaxY = FALLBACK_MAX_HEART_RATE,
    chartLeft = 38,
    chartRight = 306,
    chartTop = 10,
    chartBottom = 112,
    zoneBands,
  } = {}
) {
  if (!Array.isArray(data) || data.length < 2) {
    return [];
  }

  const dataMaxX = Math.max(...data.map((point) => Number(point.x) || 0));
  const xRange =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : Math.max(dataMaxX, 1);
  const yRange = domainMaxY - domainMinY;
  const points = data.map((point) => {
    const elapsedMinutes = Math.min(
      Math.max(Number(point?.x) || 0, 0),
      xRange
    );
    const bpm = Math.min(
      Math.max(Number(point?.y) || domainMinY, domainMinY),
      domainMaxY
    );

    return {
      bpm,
      x: chartLeft + (elapsedMinutes / xRange) * (chartRight - chartLeft),
      y:
        chartTop +
        (1 - (bpm - domainMinY) / yRange) * (chartBottom - chartTop),
    };
  });
  const segments = [];
  const zoneThresholds = getHeartRateZoneThresholds(zoneBands);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const bpmDifference = end.bpm - start.bpm;
    const crossingRatios =
      bpmDifference === 0
        ? []
        : zoneThresholds.map(
            (threshold) => (threshold - start.bpm) / bpmDifference
          ).filter((ratio) => ratio > 0 && ratio < 1);
    const ratios = [0, ...crossingRatios.sort((left, right) => left - right), 1];

    for (let ratioIndex = 1; ratioIndex < ratios.length; ratioIndex += 1) {
      const startRatio = ratios[ratioIndex - 1];
      const endRatio = ratios[ratioIndex];
      const segmentStartX = start.x + (end.x - start.x) * startRatio;
      const segmentStartY = start.y + (end.y - start.y) * startRatio;
      const segmentEndX = start.x + (end.x - start.x) * endRatio;
      const segmentEndY = start.y + (end.y - start.y) * endRatio;
      const midpointBpm =
        start.bpm + bpmDifference * ((startRatio + endRatio) / 2);

      segments.push({
        color: getHeartRateZoneColor(midpointBpm, zoneBands),
        path: `M ${segmentStartX} ${segmentStartY} L ${segmentEndX} ${segmentEndY}`,
      });
    }
  }

  return segments;
}

const Run = ({ workout_id, restartRequestKey, onHeaderTitleChange }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { user } = useAuth();

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
  const [runPlanSets, set_runPlanSets] = useState([]);
  const [maxHeartRate, set_maxHeartRate] = useState(FALLBACK_MAX_HEART_RATE);
  const [locationLogs, set_locationLogs] = useState([]);
  const [activeRunSegment, set_activeRunSegment] = useState(null);
  const [nextRunSegment, set_nextRunSegment] = useState(null);
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
  const [isWorkoutPlanExpanded, set_isWorkoutPlanExpanded] = useState(false);
  const [enduranceZoneDropdownVisible, setEnduranceZoneDropdownVisible] =
    useState(false);
  const [enduranceZoneSetId, setEnduranceZoneSetId] = useState(null);
  const [enduranceZonePopoverPosition, setEnduranceZonePopoverPosition] =
    useState({
      left: RUN_ZONE_POPOVER_MARGIN,
      top: RUN_ZONE_POPOVER_MARGIN,
    });
  const [totalDistance, set_totalDistance] = useState(0);
  const [timerTick, set_timerTick] = useState(() =>
    getCurrentStoredTimestampSeconds()
  );
  const [customHeartRateViewportWidth, setCustomHeartRateViewportWidth] =
    useState(0);
  const [isCustomHeartRateFollowing, setIsCustomHeartRateFollowing] =
    useState(true);

  const [activeSet, set_activeSet] = useState(null);
  const [activeSet_remainingTime, set_activeSet_remainingTime] = useState(0);

  const previousActiveSetRef = useRef(null);
  const activeRunSegmentRef = useRef(null);
  const timerStartRef = useRef(null);
  const elapsedTimeRef = useRef(0);
  const workoutStateLoadRequestRef = useRef(0);
  const activeSetCalculationInFlightRef = useRef(false);
  const trackedSummaryLoadingRef = useRef(false);
  const enduranceZoneTriggerRef = useRef(null);
  const enduranceZonePreparingRef = useRef(false);
  const customHeartRateScrollRef = useRef(null);

  const normalizeTimerStartValue = (value) =>
    normalizeStoredTimestampSeconds(value);

  useEffect(() => {
    set_selectedRunFlow(null);
    set_isSelectingRunFlow(false);
    set_isWorkoutPlanExpanded(false);
    set_hasRunStructure(false);
    set_runSectionCounts(EMPTY_RUN_SECTION_COUNTS);
    set_runPlanSets([]);
    set_locationLogs([]);
    set_activeRunSegment(null);
    set_nextRunSegment(null);
    set_currentPaceMinutes(null);
    set_activeSegmentDistance(0);
    set_runStructureLoaded(false);
    set_workoutStateLoaded(false);
    setIsCustomHeartRateFollowing(true);
    setEnduranceZoneDropdownVisible(false);
    setEnduranceZoneSetId(null);
  }, [workout_id]);

  useEffect(() => {
    set_isWorkoutPlanExpanded(false);
  }, [original_start_time]);

  useEffect(() => {
    if (selectedRunFlow !== "custom") {
      setIsCustomHeartRateFollowing(true);
    }
  }, [selectedRunFlow]);

  useEffect(() => {
    onHeaderTitleChange?.(
      selectedRunFlow === "endurance-base" ? "Endurance Run" : null
    );

    return () => {
      onHeaderTitleChange?.(null);
    };
  }, [onHeaderTitleChange, selectedRunFlow]);

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
    set_nextRunSegment(null);
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
      set_locationLogs(logs);
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
      set_runPlanSets(sets);
    } catch (error) {
      console.error("Failed to load run structure state:", error);
    } finally {
      set_runStructureLoaded(true);
    }
  }, [db, workout_id]);

  const calculateActiveSet = useCallback(async (
    currentElapsed,
    startTimestampSeconds = original_start_time,
    runFlowId = selectedRunFlow
  ) => {
    if (activeSetCalculationInFlightRef.current) {
      return;
    }

    activeSetCalculationInFlightRef.current = true;

    try {
      const orderedSets = await runningRepository.getOrderedRunSetsForWorkout(
        db,
        workout_id
      );
      let hasEnduranceMainSet = false;
      const sets =
        runFlowId === "endurance-base"
          ? orderedSets.filter((set) => {
              if (Number(set.is_pause) === 1) {
                return false;
              }

              if (normalizeRunSectionType(set.type) !== "WORKING_SET") {
                return true;
              }

              if (hasEnduranceMainSet) {
                return false;
              }

              hasEnduranceMainSet = true;
              return true;
            })
          : orderedSets;

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
        const nextSet = sets[i + 1] ?? null;
        const nextWorkingSetPosition = nextSet
          ? getWorkingSetPosition(sets, i + 1)
          : null;

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
        set_nextRunSegment(
          nextSet
            ? {
                ...nextSet,
                actionLabel: getRunSegmentLabel(nextSet),
                intervalIndex: nextWorkingSetPosition,
                totalIntervals: totalWorkingSetCount,
              }
            : null
        );
        return;
      }

      clearActiveSegment();
    } finally {
      activeSetCalculationInFlightRef.current = false;
    }
  }, [db, original_start_time, selectedRunFlow, workout_id]);

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
    const resolvedRunFlow =
      getRunFlowOption(row.run_focus_type)?.id ?? null;
    set_selectedRunFlow(resolvedRunFlow);

    if (requestId !== workoutStateLoadRequestRef.current) {
      return;
    }

    if (resolvedOriginalStartTime !== null && !nextIsDone) {
      await calculateActiveSet(
        currentElapsed,
        resolvedOriginalStartTime,
        resolvedRunFlow
      );
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

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadMaxHeartRate = async () => {
        if (!user?.id) {
          set_maxHeartRate(FALLBACK_MAX_HEART_RATE);
          return;
        }

        try {
          const profile = await socialService.getOwnRunProfileSettings(user);

          if (!isCancelled) {
            set_maxHeartRate(
              profile.maxHeartRate ?? FALLBACK_MAX_HEART_RATE
            );
          }
        } catch (error) {
          console.warn("Unable to load max heart rate for Run charts:", error);

          if (!isCancelled) {
            set_maxHeartRate(FALLBACK_MAX_HEART_RATE);
          }
        }
      };

      void loadMaxHeartRate();

      return () => {
        isCancelled = true;
      };
    }, [user])
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
      await loadRunStructureState();
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
      set_locationLogs([]);
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
        addAutomaticPause: selectedRunFlow !== "endurance-base",
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
  const fieldSurface = theme.fields ?? innerSurface;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const avgPaceMinutes =
    totalDistance > 0 ? currentElapsed / 60 / totalDistance : null;
  const formattedTotalDistance = formatRunDistance(totalDistance);
  const avgPaceDisplay = formatPaceDisplay(avgPaceMinutes);
  const elapsedDisplay = formatRunClock(currentElapsed);
  const routeSegments = splitLocationRouteSegments(locationLogs);
  const routeRegion = getRouteRegion(routeSegments);
  const routeCoordinates = routeSegments.flat();
  const paceHistory = buildPaceHistory(locationLogs);
  const heartRateZoneBands = buildHeartRateZones(maxHeartRate);
  const heartRateChartMax = Math.max(maxHeartRate, 61);
  const heartRateAxisTicks = [
    heartRateChartMax,
    ...[0.75, 0.5, 0.25].map((ratio) =>
      Math.round(60 + (heartRateChartMax - 60) * ratio)
    ),
    60,
  ].filter((tick, index, ticks) => ticks.indexOf(tick) === index);
  const targetHeartRateHistory = buildTargetHeartRateHistory(
    runPlanSets,
    heartRateZoneBands
  );
  const actualHeartRateHistory = [];
  const latestHeartRatePoint =
    actualHeartRateHistory[actualHeartRateHistory.length - 1];
  const currentHeartRate = Number.isFinite(Number(latestHeartRatePoint?.y))
    ? Math.round(Number(latestHeartRatePoint.y))
    : null;
  const currentHeartRateBand =
    currentHeartRate === null
      ? null
      : heartRateZoneBands.find((band) => currentHeartRate <= band.max) ??
        heartRateZoneBands[heartRateZoneBands.length - 1];
  const customHeartRateFallbackBand =
    heartRateZoneBands.find((band) => band.zone === 2) ??
    heartRateZoneBands[0];
  const customHeartRateViewportCenter =
    currentHeartRate ??
    (customHeartRateFallbackBand.min + customHeartRateFallbackBand.max) / 2;
  const customHeartRateViewportSpan = Math.max(maxHeartRate * 0.15, 1);
  const customHeartRateScaleWidth =
    customHeartRateViewportWidth > 0
      ? (maxHeartRate / customHeartRateViewportSpan) *
        customHeartRateViewportWidth
      : 0;
  const customHeartRateTrackWidth =
    customHeartRateScaleWidth + customHeartRateViewportWidth;
  const customHeartRateViewportPadding = customHeartRateViewportWidth / 2;
  const customHeartRatePosition = (heartRate) =>
    customHeartRateViewportPadding +
    (Math.max(0, Math.min(Number(heartRate) || 0, maxHeartRate)) /
      Math.max(maxHeartRate, 1)) *
      customHeartRateScaleWidth;

  useEffect(() => {
    if (
      selectedRunFlow !== "custom" ||
      customHeartRateScaleWidth <= 0 ||
      !isCustomHeartRateFollowing
    ) {
      return undefined;
    }

    const animationFrame = requestAnimationFrame(() => {
      customHeartRateScrollRef.current?.scrollTo({
        x:
          (customHeartRateViewportCenter / Math.max(maxHeartRate, 1)) *
          customHeartRateScaleWidth,
        y: 0,
        animated: currentHeartRate !== null,
      });
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [
    currentHeartRate,
    customHeartRateScaleWidth,
    customHeartRateViewportCenter,
    isCustomHeartRateFollowing,
    maxHeartRate,
    selectedRunFlow,
  ]);
  const enduranceMainSet = runPlanSets.find(
    (set) =>
      normalizeRunSectionType(set?.type) === "WORKING_SET" &&
      Number(set?.is_pause) !== 1
  );
  const fallbackHeartRateTarget =
    enduranceMainSet?.heartrate ??
    runPlanSets.find(
      (set) =>
        Number(set?.is_pause) !== 1 &&
        Number(set?.heartrate) >= 1 &&
        Number(set?.heartrate) <= 5
    )?.heartrate;
  const plannedHeartRateZone = Number(fallbackHeartRateTarget);
  const enduranceHeartRateZone =
    Number.isInteger(plannedHeartRateZone) &&
    plannedHeartRateZone >= 1 &&
    plannedHeartRateZone <= 5
      ? plannedHeartRateZone
      : null;
  const enduranceHeartRateColor =
    heartRateZoneBands.find(
      (band) => band.zone === enduranceHeartRateZone
    )?.color ?? secondaryColor;
  const enduranceZonePercentLabels = {
    1: "<65% HRmax",
    2: "66-81% HRmax",
    3: "82-89% HRmax",
    4: "90-97% HRmax",
    5: "98%+ HRmax",
  };
  const enduranceWarmupSets = runPlanSets.filter(
    (set) =>
      normalizeRunSectionType(set?.type) === "WARMUP" &&
      Number(set?.is_pause) !== 1
  );
  const plannedWarmupDurationSeconds = enduranceWarmupSets.reduce(
    (total, set) => total + Math.max(0, Number(set?.time) || 0) * 60,
    0
  );
  const plannedWarmupDistance = enduranceWarmupSets.reduce(
    (total, set) => total + Math.max(0, Number(set?.distance) || 0),
    0
  );
  const plannedEnduranceDurationMinutes = Math.max(
    0,
    Number(enduranceMainSet?.time) || 0
  );
  const plannedEnduranceDurationSeconds =
    plannedEnduranceDurationMinutes * 60;
  const plannedEndurancePace = parsePaceToMinutes(enduranceMainSet?.pace);
  const plannedEnduranceDistance = Math.max(
    0,
    Number(enduranceMainSet?.distance) || 0
  );
  const enduranceStatPriority = normalizeEnduranceStatPriority(
    enduranceMainSet?.stat_priority
  );
  const populatedEnduranceStats = {
    time: plannedEnduranceDurationMinutes > 0,
    zone: enduranceHeartRateZone !== null,
    distance: plannedEnduranceDistance > 0,
    pace: plannedEndurancePace !== null && plannedEndurancePace > 0,
  };
  const visibleEnduranceStatPriority = enduranceStatPriority.filter(
    (key) => populatedEnduranceStats[key]
  );
  const expectedEnduranceDistance =
    plannedEnduranceDistance > 0
      ? plannedEnduranceDistance
      : plannedEnduranceDurationMinutes > 0 &&
          plannedEndurancePace !== null
        ? plannedEnduranceDurationMinutes / plannedEndurancePace
        : null;
  const isMainEnduranceSetActive =
    Boolean(activeRunSegment) &&
    normalizeRunSectionType(activeRunSegment?.type) === "WORKING_SET" &&
    Number(activeRunSegment?.is_pause) !== 1;
  const enduranceProgressSeconds = Math.max(
    0,
    isMainEnduranceSetActive
      ? Number(activeRunSegment?.elapsedSeconds) || 0
      : currentElapsed - plannedWarmupDurationSeconds
  );
  const enduranceProgressDistance = Math.max(
    0,
    isMainEnduranceSetActive
      ? activeSegmentDistance
      : totalDistance - plannedWarmupDistance
  );
  const enduranceAveragePace =
    enduranceProgressDistance > 0 && enduranceProgressSeconds > 0
      ? enduranceProgressSeconds / 60 / enduranceProgressDistance
      : null;
  const enduranceProgressRatio =
    plannedEnduranceDurationSeconds > 0
      ? enduranceProgressSeconds / plannedEnduranceDurationSeconds
      : expectedEnduranceDistance > 0
        ? enduranceProgressDistance / expectedEnduranceDistance
        : 0;
  const enduranceProgressPercent = Math.round(
    Math.min(1, Math.max(0, enduranceProgressRatio)) * 100
  );
  const plannedPaceHistory =
    plannedEndurancePace !== null
      ? [
          { x: 0, y: plannedEndurancePace },
          {
            x: Math.max(
              plannedEnduranceDurationMinutes,
              currentElapsed / 60,
              1
            ),
            y: plannedEndurancePace,
          },
        ]
      : [];
  const paceComparisonValues = paceHistory
    .map((point) => Number(point?.y))
    .filter(Number.isFinite);
  const paceComparisonDomainMin =
    paceComparisonValues.length > 0
      ? Math.max(0.5, Math.min(...paceComparisonValues) - 0.5)
      : 2;
  const paceComparisonDomainMax =
    paceComparisonValues.length > 0
      ? Math.max(...paceComparisonValues) + 0.5
      : 12;
  const paceComparisonYAxisTicks =
    paceComparisonDomainMin !== null && paceComparisonDomainMax !== null
      ? [
          paceComparisonDomainMax,
          (paceComparisonDomainMin + paceComparisonDomainMax) / 2,
          paceComparisonDomainMin,
        ]
      : [];
  const paceDeltaSeconds =
    enduranceAveragePace !== null && plannedEndurancePace !== null
      ? (enduranceAveragePace - plannedEndurancePace) * 60
      : null;
  const paceComparisonColor =
    paceDeltaSeconds === null
      ? primaryColor
      : paceDeltaSeconds > 5
        ? theme.danger ?? "#EF4444"
        : secondaryColor;
  const paceComparisonLabel =
    paceDeltaSeconds === null
      ? "WAITING FOR DATA"
      : paceDeltaSeconds > 5
        ? "BEHIND PLAN"
        : paceDeltaSeconds < -5
          ? "AHEAD OF PLAN"
          : "ON PLAN";
  const paceComparisonSubtitle =
    paceDeltaSeconds === null
      ? "Your live pace will be compared with the plan."
      : paceDeltaSeconds > 5
        ? "Current average pace is behind the planned pace."
        : paceDeltaSeconds < -5
          ? "Current average pace is ahead of the planned pace."
          : "Current average pace matches the plan.";
  const enduranceHeartRateBand = heartRateZoneBands.find(
    (band) => band.zone === enduranceHeartRateZone
  );
  const enduranceHeartRateRange = enduranceHeartRateBand
    ? `${enduranceHeartRateBand.min}-${enduranceHeartRateBand.max} bpm`
    : "No target zone";
  const enduranceHeartRateUsesDistance = plannedEnduranceDistance > 0;
  const enduranceHeartRateDomainMaxX = Math.max(
    enduranceHeartRateUsesDistance
      ? plannedEnduranceDistance
      : plannedEnduranceDurationMinutes || currentElapsed / 60,
    1
  );
  const enduranceActualHeartRateValues = actualHeartRateHistory
    .map((point) => Number(point?.y))
    .filter(Number.isFinite);
  const enduranceHeartRateRangeValues = [
    ...(enduranceHeartRateBand
      ? [enduranceHeartRateBand.min, enduranceHeartRateBand.max]
      : []),
    ...enduranceActualHeartRateValues,
  ];
  const enduranceHeartRateDomainMinY =
    enduranceHeartRateRangeValues.length > 0
      ? Math.max(30, Math.min(...enduranceHeartRateRangeValues) - 10)
      : 60;
  const enduranceHeartRateDomainMaxY =
    enduranceHeartRateRangeValues.length > 0
      ? Math.min(260, Math.max(...enduranceHeartRateRangeValues) + 10)
      : heartRateChartMax;
  const enduranceHeartRateYAxisTicks = enduranceHeartRateBand
    ? [
        enduranceHeartRateDomainMaxY,
        enduranceHeartRateBand.max,
        enduranceHeartRateBand.min,
        enduranceHeartRateDomainMinY,
      ].filter((tick, index, ticks) => ticks.indexOf(tick) === index)
    : enduranceActualHeartRateValues.length > 0
      ? [
          enduranceHeartRateDomainMaxY,
          (enduranceHeartRateDomainMinY + enduranceHeartRateDomainMaxY) / 2,
          enduranceHeartRateDomainMinY,
        ].map(Math.round)
      : heartRateAxisTicks;
  const enduranceHeartRateXAxisTicks = Array.from(
    { length: 5 },
    (_, index) => ({
      value: (enduranceHeartRateDomainMaxX * index) / 4,
      label:
        index === 0 && !enduranceHeartRateUsesDistance ? "" : undefined,
    })
  );
  const enduranceTargetHeartRateHistory =
    enduranceHeartRateBand && enduranceHeartRateZone
      ? [
          {
            x: 0,
            y: (enduranceHeartRateBand.min + enduranceHeartRateBand.max) / 2,
            zone: enduranceHeartRateZone,
          },
          {
            x: enduranceHeartRateDomainMaxX,
            y: (enduranceHeartRateBand.min + enduranceHeartRateBand.max) / 2,
            zone: enduranceHeartRateZone,
          },
        ]
      : [];
  const enduranceActualHeartRateHistory = actualHeartRateHistory.map(
    (point) => ({
      ...point,
      x: enduranceHeartRateUsesDistance
        ? currentElapsed > 0
          ? (Math.max(0, Number(point?.x) || 0) /
              Math.max(currentElapsed / 60, 1 / 60)) *
            enduranceProgressDistance
          : 0
        : point.x,
    })
  );
  const targetHeartRateZones = [
    ...new Set(targetHeartRateHistory.map((point) => Number(point.zone))),
  ].sort((left, right) => left - right);
  const targetHeartRateDisplay =
    targetHeartRateZones.length === 0
      ? "--"
      : targetHeartRateZones.length === 1
        ? `Z${targetHeartRateZones[0]}`
        : `Z${targetHeartRateZones[0]}-Z${
            targetHeartRateZones[targetHeartRateZones.length - 1]
          }`;
  const workingRunSets = runPlanSets.filter(
    (set) =>
      normalizeRunSectionType(set?.type) === "WORKING_SET" &&
      Number(set?.is_pause) !== 1
  );
  const completedWorkingSetCount = workingRunSets.filter(
    (set) => Number(set?.done) === 1
  ).length;
  const completedSetDisplay =
    workingRunSets.length > 0
      ? `${completedWorkingSetCount}/${workingRunSets.length}`
      : "--";
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
    selectedRunFlow === "speed-structure" && original_start_time !== null && !isDone;
  const shouldShowEnduranceBaseDashboard =
    selectedRunFlow === "endurance-base" &&
    !isDone;
  const shouldShowCustomRunDashboard =
    selectedRunFlow === "custom" &&
    !isDone;
  const actualRunWorkoutStatus = isDone
    ? "done"
    : original_start_time !== null
      ? "active"
      : "plan";
  const shouldShowPlanOnlyStartAction =
    actualRunWorkoutStatus === "plan" &&
    selectedRunFlow !== "endurance-base" &&
    selectedRunFlow !== "custom";
  const isWorkoutPlanCollapsible =
    actualRunWorkoutStatus === "active" &&
    selectedRunFlow !== "custom";
  const shouldHideWorkoutPlan =
    selectedRunFlow === "custom" ||
    (isDone && selectedRunFlow === null && !hasRunStructure);
  const shouldShowWorkoutPlan =
    !shouldHideWorkoutPlan &&
    (!isWorkoutPlanCollapsible || isWorkoutPlanExpanded);
  const shouldPruneEmptyPlanSections =
    (selectedRunFlow === "speed-structure" ||
      selectedRunFlow === "endurance-base") &&
    original_start_time !== null;
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
  const speedStructureCountdownDisplay = formatRunClock(
    activeRunSegment?.remainingSeconds ?? 0
  );
  const currentPaceDisplay = formatPaceDisplay(currentPaceMinutes);
  const pulseDisplay = activeRunSegment?.heartrate
    ? `Z${activeRunSegment.heartrate}`
    : "--";
  const formatSegmentPlanDistance = (segment) => {
    const distance = Number(segment?.distance);

    return Number.isFinite(distance) && distance > 0
      ? `${formatRunDistance(distance)} km`
      : "--";
  };
  const formatSegmentPlanTime = (segment) => {
    const minutes = Number(segment?.time);

    return Number.isFinite(minutes) && minutes > 0
      ? formatRunClock(minutes * 60)
      : "--";
  };
  const formatSegmentPlanPace = (segment) => {
    const paceMinutes = parsePaceToMinutes(segment?.pace);

    return paceMinutes !== null ? `${formatPaceDisplay(paceMinutes)} /km` : "--";
  };
  const formatSegmentPlanHeartRate = (segment) =>
    segment?.heartrate ? `Z${segment.heartrate}` : "--";
  const getSegmentPlanTitle = (segment) => {
    if (!segment) {
      return "No active set";
    }

    const label = segment.actionLabel ?? getRunSegmentLabel(segment);

    if (segment.intervalIndex && segment.totalIntervals) {
      return `${label} ${segment.intervalIndex}/${segment.totalIntervals}`;
    }

    if (Number(segment?.is_pause) !== 1 && segment?.set_number) {
      return `${label} ${segment.set_number}`;
    }

    return label;
  };
  const renderActiveCardTitle = (label, color = quietText) => (
    <ThemedText style={styles.activeCardTitle} setColor={color}>
      {label}
    </ThemedText>
  );
  const renderCompletionChart = ({
    sectionTitle,
    title,
    subtitle,
    icon,
    data,
    color,
    value,
    valueLabel,
    invert = false,
    stepped = false,
    zoneBands = [],
    domainMinY = null,
    domainMaxY = null,
    yAxisTicks = [],
    onPress = null,
    plannedData = [],
    plannedColor = theme.planned ?? "#FFDD00",
    strokeWidth = 3,
    colorByHeartRateZone = false,
    plannedStepped = stepped,
    domainMaxX = currentElapsed / 60,
    xAxisTicks = null,
    formatXAxisTick = null,
    formatYAxisTick = null,
    chartHeight = 132,
    horizontalPadding = 15,
    chartTextColor = null,
    showPlannedLine = true,
    yAxisLabel = null,
    backgroundZoneBands = zoneBands,
    containerStyle = null,
  }) => {
    const usesCompactChartEdges = horizontalPadding <= 8;
    const chartLeft =
      yAxisTicks.length > 0
        ? yAxisLabel
          ? usesCompactChartEdges
            ? 48
            : 54
          : usesCompactChartEdges
            ? 32
            : 38
        : 14;
    const chartRight = usesCompactChartEdges ? 316 : 306;
    const chartTop = 10;
    const chartBottom = chartHeight - 20;
    const resolvedTitleColor = chartTextColor ?? titleColor;
    const resolvedQuietText = chartTextColor ?? quietText;
    const chartPath = buildChartPath(data, {
      invert,
      stepped,
      durationMinutes: domainMaxX,
      domainMinY,
      domainMaxY,
      chartLeft,
      chartRight,
      chartTop,
      chartBottom,
    });
    const plannedChartPath = buildChartPath(plannedData, {
      invert,
      stepped: plannedStepped,
      durationMinutes: domainMaxX,
      domainMinY,
      domainMaxY,
      chartLeft,
      chartRight,
      chartTop,
      chartBottom,
    });
    const heartRateZoneSegments = colorByHeartRateZone
      ? buildHeartRateZoneSegments(data, {
          durationMinutes: domainMaxX,
          domainMinY,
          domainMaxY,
          chartLeft,
          chartRight,
          chartTop,
          chartBottom,
          zoneBands,
        })
      : [];
    const chartBandRange =
      Number.isFinite(domainMinY) &&
      Number.isFinite(domainMaxY) &&
      domainMaxY > domainMinY
        ? domainMaxY - domainMinY
        : null;
    const chartBandRects = chartBandRange
      ? backgroundZoneBands.map((band) => {
          const min = Math.max(
            domainMinY,
            Number(band.min) - (band.zone > 1 ? 1 : 0)
          );
          const max = Math.min(domainMaxY, Number(band.max));
          const top =
            chartTop +
            (1 - (max - domainMinY) / chartBandRange) *
              (chartBottom - chartTop);
          const height =
            ((max - min) / chartBandRange) * (chartBottom - chartTop);

          return {
            ...band,
            top,
            height,
          };
        })
      : [];
    const yAxisGridLines = chartBandRange
      ? yAxisTicks.map((tick) => {
          const normalizedY =
            (Number(tick) - domainMinY) / chartBandRange;

          return {
            value: tick,
            y:
              chartTop +
              (invert ? normalizedY : 1 - normalizedY) *
                (chartBottom - chartTop),
          };
        })
      : [];
    const resolvedXAxisTicks =
      Array.isArray(xAxisTicks) && xAxisTicks.length > 0
        ? xAxisTicks
        : [
            { value: 0, label: "START" },
            { value: domainMaxX, label: elapsedDisplay },
          ];
    const xAxisTickPositions = resolvedXAxisTicks.map((tick) => {
      const normalizedValue =
        Number.isFinite(Number(domainMaxX)) && Number(domainMaxX) > 0
          ? Math.min(
              1,
              Math.max(0, Number(tick.value) / Number(domainMaxX))
            )
          : 0;

      return chartLeft + normalizedValue * (chartRight - chartLeft);
    });

    return (
      <View style={[styles.activeTitledCardShell, containerStyle]}>
        {renderActiveCardTitle(sectionTitle, chartTextColor ?? quietText)}
        <TouchableOpacity
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={onPress ? `Open ${title} chart fullscreen` : undefined}
          activeOpacity={onPress ? 0.82 : 1}
          disabled={!onPress}
          onPress={onPress}
          style={styles.completionChartPressable}
        >
          <ThemedCard
            style={[
              styles.completionChartCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            <View style={styles.completionChartHeader}>
              <View style={styles.completionChartHeading}>
                <View
                  style={[
                    styles.completionChartIcon,
                    {
                      borderColor: color,
                      backgroundColor: innerSurface,
                    },
                  ]}
                >
                  <Feather name={icon} size={18} color={color} />
                </View>
                <View style={styles.completionChartTitleCopy}>
                  <ThemedText
                    style={styles.completionChartTitle}
                    setColor={resolvedTitleColor}
                  >
                    {title}
                  </ThemedText>
                  <ThemedText
                    style={styles.completionChartSubtitle}
                    setColor={resolvedQuietText}
                  >
                    {subtitle}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.completionChartHeaderActions}>
                <View style={styles.completionChartValueWrap}>
                  <ThemedText
                    style={styles.completionChartValue}
                    setColor={color}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {value}
                  </ThemedText>
                  <ThemedText
                  style={styles.completionChartValueLabel}
                  setColor={resolvedQuietText}
                  >
                    {valueLabel}
                  </ThemedText>
                </View>
                {onPress ? (
                  <Feather
                    name="maximize-2"
                    size={17}
                    color={resolvedQuietText}
                  />
                ) : null}
              </View>
            </View>

            <Svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 320 ${chartHeight}`}
              style={styles.completionChart}
            >
              {chartBandRects.map((band) => (
                <Rect
                  key={band.zone}
                  x={chartLeft}
                  y={band.top}
                  width={chartRight - chartLeft}
                  height={band.height}
                  fill={band.color}
                  fillOpacity="0.16"
                />
              ))}
              {yAxisGridLines.map((gridLine) => (
                <Line
                  key={`grid:${gridLine.value}`}
                  x1={chartLeft}
                  y1={gridLine.y}
                  x2={chartRight}
                  y2={gridLine.y}
                  stroke={resolvedQuietText}
                  strokeWidth="1"
                  strokeOpacity="0.16"
                />
              ))}
              <Line
                x1={chartLeft}
                y1={chartTop}
                x2={chartLeft}
                y2={chartBottom}
                stroke={resolvedQuietText}
                strokeWidth="1.25"
                strokeOpacity="0.62"
              />
              <Line
                x1={chartLeft}
                y1={chartBottom}
                x2={chartRight}
                y2={chartBottom}
                stroke={resolvedQuietText}
                strokeWidth="1.25"
                strokeOpacity="0.62"
              />
              {xAxisTickPositions.map((xPosition, index) => (
                <Line
                  key={`x-tick:${index}`}
                  x1={xPosition}
                  y1={chartBottom}
                  x2={xPosition}
                  y2={chartBottom + 5}
                  stroke={resolvedQuietText}
                  strokeWidth="1"
                  strokeOpacity="0.62"
                />
              ))}
              {yAxisGridLines.map((gridLine) => (
                <SvgText
                  key={`label:${gridLine.value}`}
                  x={yAxisLabel ? 18 : 2}
                  y={gridLine.y + 3}
                  fill={resolvedQuietText}
                  fontSize="8"
                  fontWeight="700"
                >
                  {formatYAxisTick?.(gridLine.value) ?? gridLine.value}
                </SvgText>
              ))}
              {yAxisLabel ? (
                <SvgText
                  x="7"
                  y={chartTop + (chartBottom - chartTop) / 2}
                  fill={resolvedQuietText}
                  fontSize="8"
                  fontWeight="900"
                  letterSpacing="1"
                  textAnchor="middle"
                  transform={`rotate(-90 7 ${
                    chartTop + (chartBottom - chartTop) / 2
                  })`}
                >
                  {yAxisLabel}
                </SvgText>
              ) : null}
              {showPlannedLine && plannedChartPath ? (
                <Path
                  d={plannedChartPath}
                  fill="none"
                  stroke={plannedColor}
                  strokeWidth="1.25"
                  strokeOpacity="0.78"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {heartRateZoneSegments.map((segment, index) => (
                <Path
                  key={`${index}:${segment.color}`}
                  d={segment.path}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {chartPath && !colorByHeartRateZone ? (
                <Path
                  d={chartPath}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
            <View style={styles.completionChartAxis}>
              {resolvedXAxisTicks.map((tick, index) => (
                <ThemedText
                  key={`${tick.value}:${index}`}
                  style={styles.completionChartAxisLabel}
                  setColor={resolvedQuietText}
                >
                  {tick.label ??
                    formatXAxisTick?.(tick.value) ??
                    String(tick.value)}
                </ThemedText>
              ))}
            </View>
          </ThemedCard>
        </TouchableOpacity>
      </View>
    );
  };
  const renderRunPlanStatRow = (segment) => {
    const metrics = [
      {
        label: "DISTANCE",
        value: formatSegmentPlanDistance(segment),
        icon: "map-pin",
      },
      {
        label: "PACE",
        value: formatSegmentPlanPace(segment),
        icon: "activity",
      },
      {
        label: "TIME",
        value: formatSegmentPlanTime(segment),
        icon: "clock",
      },
      {
        label: "HR",
        value: formatSegmentPlanHeartRate(segment),
        icon: "heart",
      },
    ];

    return (
      <View style={styles.activeSetStatRow}>
        {metrics.map((metric, index) => (
          <View key={metric.label} style={styles.activeSetStatItem}>
            <View style={styles.activeSetStatHeader}>
              <Feather name={metric.icon} size={16} color={quietText} />
              <ThemedText
                style={styles.activeSetStatLabel}
                setColor={quietText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {metric.label}
              </ThemedText>
            </View>
            <ThemedText
              style={styles.activeSetStatValue}
              setColor={titleColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {metric.value}
            </ThemedText>
            {index < metrics.length - 1 ? (
              <View
                style={[
                  styles.activeSetStatDivider,
                  { backgroundColor: cardBorder },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
    );
  };
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

  const renderRunFocusTitle = () => {
    if (
      !selectedRunFlowOption ||
      actualRunWorkoutStatus === "active" ||
      selectedRunFlow === "custom"
    ) {
      return null;
    }

    return (
      <TouchableOpacity
        activeOpacity={canChangeRunFlow ? 0.78 : 1}
        accessibilityRole="button"
        disabled={!canChangeRunFlow}
        onPress={returnToRunFlowSelection}
        style={[
          styles.runFocusTitleButton,
          {
            backgroundColor: fieldSurface,
            borderColor: primaryColor,
          },
        ]}
      >
        <ThemedText
          style={styles.runFocusTitle}
          setColor={primaryColor}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {selectedRunFlowOption.title}
        </ThemedText>
      </TouchableOpacity>
    );
  };

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

  const renderActiveTimerPrimaryButton = () => {
    if (isDone) {
      return <View style={styles.activeTimerIconButtonPlaceholder} />;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.84}
        disabled={!canUsePrimaryAction}
        accessibilityRole="button"
        accessibilityLabel={primaryActionLabel}
        onPress={handlePrimaryAction}
        style={[
          styles.activeTimerIconButton,
          {
            backgroundColor: isRunning ? "transparent" : primaryColor,
            borderColor: primaryColor,
            opacity: canUsePrimaryAction ? 1 : 0.58,
          },
        ]}
      >
        <Feather
          name={isRunning ? "pause" : "play"}
          size={22}
          color={isRunning ? primaryColor : invertedText}
        />
      </TouchableOpacity>
    );
  };

  const renderActiveTimerFinishButton = () => {
    const canFinishRun = shouldShowFinishRunPill && !isControlBusy;

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={!canFinishRun}
        accessibilityRole="button"
        accessibilityLabel="Finish run"
        onPress={endWorkout}
        style={[
          styles.activeTimerIconButton,
          {
            borderColor: secondaryDark,
            opacity: canFinishRun ? 1 : 0.42,
          },
        ]}
      >
        <Feather name="check" size={22} color={secondaryColor} />
      </TouchableOpacity>
    );
  };

  const renderActiveSummaryCard = () => (
    <View style={styles.activeTitledCardShell}>
      {renderActiveCardTitle("Workout totals")}
      <ThemedCard
        style={[
          styles.activeSummaryCard,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View style={styles.activeSummaryItem}>
          <View
            style={[
              styles.activeSummaryIconCircle,
              { borderColor: primaryColor },
            ]}
          >
            <Feather name="clock" size={20} color={primaryColor} />
          </View>
          <View style={styles.activeSummaryCopy}>
            <ThemedText style={styles.activeSummaryLabel} setColor={quietText}>
              TOTAL TIME
            </ThemedText>
            <ThemedText
              style={styles.activeSummaryValue}
              setColor={titleColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {elapsedDisplay}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.activeSummaryDivider, { backgroundColor: cardBorder }]} />

        <View style={styles.activeSummaryItem}>
          <View
            style={[
              styles.activeSummaryIconCircle,
              { borderColor: secondaryColor },
            ]}
          >
            <Feather name="map-pin" size={20} color={secondaryColor} />
          </View>
          <View style={styles.activeSummaryCopy}>
            <ThemedText style={styles.activeSummaryLabel} setColor={quietText}>
              TOTAL DISTANCE
            </ThemedText>
            <ThemedText
              style={styles.activeSummaryValue}
              setColor={titleColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.58}
            >
              {formattedTotalDistance} km
            </ThemedText>
          </View>
        </View>
      </ThemedCard>
    </View>
  );

  const renderCurrentSetCard = () => (
    <View style={styles.activeTitledCardShell}>
      {renderActiveCardTitle("Current set")}
      <ThemedCard
        style={[
          styles.activeCurrentSetCard,
          {
            backgroundColor: cardSurface,
            borderColor: primaryColor,
          },
        ]}
      >
        <View style={styles.currentSetTimerRow}>
          <View style={styles.currentSetActionWrap}>
            {renderActiveTimerPrimaryButton()}
            <ThemedText style={styles.currentSetActionLabel} setColor={quietText}>
              {isRunning ? "PAUSE" : "START"}
            </ThemedText>
          </View>

          <View style={styles.currentSetTimerSlot}>
            <ThemedText
              style={styles.speedTimerCountdown}
              setColor={primaryColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.58}
            >
              {speedStructureCountdownDisplay}
            </ThemedText>
          </View>

          <View style={styles.currentSetActionWrap}>
            {renderActiveTimerFinishButton()}
            <ThemedText style={styles.currentSetActionLabel} setColor={quietText}>
              FINISH
            </ThemedText>
          </View>
        </View>

        {renderRunPlanStatRow(activeRunSegment)}
      </ThemedCard>
    </View>
  );

  const renderActiveEffortCard = () => (
    <View style={styles.activeTitledCardShell}>
      {renderActiveCardTitle("Live stats")}
      <ThemedCard
        style={[
          styles.activeEffortCard,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View style={styles.activeEffortItem}>
          <View
            style={[
              styles.activeEffortIconCircle,
              { borderColor: secondaryColor },
            ]}
          >
            <Feather name="zap" size={19} color={secondaryColor} />
          </View>
          <View style={styles.activeEffortCopy}>
            <ThemedText style={styles.activeEffortLabel} setColor={secondaryColor}>
              Current pace
            </ThemedText>
            <View style={styles.speedTimerValueLine}>
              <ThemedText
                style={styles.speedTimerPrimaryValue}
                setColor={titleColor}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {currentPaceDisplay}
              </ThemedText>
              <ThemedText style={styles.speedTimerUnitInline} setColor={quietText}>
                /km
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.activeEffortDivider, { backgroundColor: cardBorder }]} />

        <View style={styles.activeEffortItem}>
          <View
            style={[
              styles.activeEffortIconCircle,
              { borderColor: primaryColor },
            ]}
          >
            <Feather name="heart" size={19} color={primaryColor} />
          </View>
          <View style={styles.activeEffortCopy}>
            <ThemedText style={styles.activeEffortLabel} setColor={primaryColor}>
              Heart rate (HR)
            </ThemedText>
            <View style={styles.speedTimerValueLine}>
              <ThemedText
                style={styles.speedTimerPrimaryValue}
                setColor={titleColor}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {pulseDisplay}
              </ThemedText>
              <ThemedText style={styles.speedTimerUnitInline} setColor={quietText}>
                bpm/zone
              </ThemedText>
            </View>
          </View>
        </View>
      </ThemedCard>
    </View>
  );

  const renderNextIntervalCard = () => (
    <View style={styles.activeTitledCardShell}>
      {renderActiveCardTitle("Next interval")}
      <ThemedCard
        style={[
          styles.nextIntervalCard,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View style={styles.nextIntervalTitleRow}>
          <ThemedText
            style={styles.nextIntervalTitle}
            setColor={titleColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.64}
          >
            {nextRunSegment ? getSegmentPlanTitle(nextRunSegment) : "No next set"}
          </ThemedText>
        </View>

        {renderRunPlanStatRow(nextRunSegment)}
      </ThemedCard>
    </View>
  );

  const renderCompletedSummaryCard = () => {
    const summaryStats = [
      {
        label: "TOTAL TIME",
        value: elapsedDisplay,
        icon: "clock",
      },
      {
        label: "AVG PACE",
        value: `${avgPaceDisplay} /km`,
        icon: "activity",
      },
      {
        label: "SETS",
        value: completedSetDisplay,
        icon: "check-circle",
      },
    ];

    return (
      <View style={styles.activeTitledCardShell}>
        {renderActiveCardTitle("Workout summary")}
        <ThemedCard
          style={[
            styles.completedSummaryCard,
            {
              backgroundColor: cardSurface,
              borderColor: secondaryColor,
            },
          ]}
        >
          <View style={styles.completedDistanceRow}>
            <ThemedText
              style={styles.completedDistanceValue}
              setColor={secondaryColor}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.62}
            >
              {formattedTotalDistance}
            </ThemedText>
            <ThemedText
              style={styles.completedDistanceUnit}
              setColor={quietText}
            >
              km
            </ThemedText>
          </View>

          <View
            style={[
              styles.completedSummaryStats,
              { borderTopColor: cardBorder },
            ]}
          >
            {summaryStats.map((stat, index) => (
              <View key={stat.label} style={styles.completedSummaryStat}>
                <View style={styles.completedSummaryStatLabelRow}>
                  <Feather name={stat.icon} size={13} color={quietText} />
                  <ThemedText
                    style={styles.completedSummaryStatLabel}
                    setColor={quietText}
                  >
                    {stat.label}
                  </ThemedText>
                </View>
                <ThemedText
                  style={styles.completedSummaryStatValue}
                  setColor={titleColor}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                >
                  {stat.value}
                </ThemedText>
                {index < summaryStats.length - 1 ? (
                  <View
                    style={[
                      styles.completedSummaryStatDivider,
                      { backgroundColor: cardBorder },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </ThemedCard>
      </View>
    );
  };

  const renderCompletedRouteCard = () => {
    const startCoordinate = routeCoordinates[0] ?? null;
    const finishCoordinate =
      routeCoordinates[routeCoordinates.length - 1] ?? null;

    return (
      <View style={styles.activeTitledCardShell}>
        {renderActiveCardTitle("Route")}
        <ThemedCard
          style={[
            styles.completedRouteCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          {routeRegion ? (
            <MapView
              key={`${workout_id}:${routeCoordinates.length}`}
              initialRegion={routeRegion}
              pitchEnabled={false}
              rotateEnabled={false}
              showsCompass={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              style={styles.completedRouteMap}
            >
              {routeSegments.map((segment, index) =>
                segment.length > 1 ? (
                  <Polyline
                    key={`${index}:${segment.length}`}
                    coordinates={segment}
                    strokeColor={primaryColor}
                    strokeWidth={5}
                  />
                ) : null
              )}
              {startCoordinate ? (
                <Marker
                  coordinate={startCoordinate}
                  pinColor={secondaryColor}
                  title="Start"
                />
              ) : null}
              {finishCoordinate ? (
                <Marker
                  coordinate={finishCoordinate}
                  pinColor={primaryColor}
                  title="Finish"
                />
              ) : null}
            </MapView>
          ) : (
            <View
              style={[
                styles.completedRouteEmpty,
                { backgroundColor: innerSurface },
              ]}
            >
              <View
                style={[
                  styles.completedRouteEmptyIcon,
                  { borderColor: cardBorder },
                ]}
              >
                <Feather name="map" size={24} color={quietText} />
              </View>
              <ThemedText
                style={styles.completedRouteEmptyTitle}
                setColor={titleColor}
              >
                No route recorded
              </ThemedText>
              <ThemedText
                style={styles.completedRouteEmptyText}
                setColor={quietText}
              >
                GPS points from the run will appear here.
              </ThemedText>
            </View>
          )}

          <View style={styles.completedRouteFooter}>
            <View style={styles.completedRouteFooterItem}>
              <Feather name="map-pin" size={15} color={primaryColor} />
              <ThemedText
                style={styles.completedRouteFooterValue}
                setColor={titleColor}
              >
                {formattedTotalDistance} km
              </ThemedText>
            </View>
            <ThemedText
              style={styles.completedRouteFooterMeta}
              setColor={quietText}
            >
              {routeCoordinates.length} GPS points
            </ThemedText>
          </View>
        </ThemedCard>
      </View>
    );
  };

  const renderCompletedRunDashboard = () => (
    <View style={styles.completedRunDashboard}>
      {renderCompletedSummaryCard()}
      {renderCompletionChart({
        sectionTitle: "Pace over time",
        title: "Pace",
        subtitle: "GPS pace throughout the workout",
        icon: "activity",
        data: paceHistory,
        color: primaryColor,
        value: avgPaceDisplay,
        valueLabel: "AVG /KM",
        invert: true,
      })}
      {renderCompletionChart({
        sectionTitle: "Heart rate over time",
        title: "Heart rate",
        subtitle: "Actual and planned heart rate",
        icon: "heart",
        data: actualHeartRateHistory,
        plannedData: targetHeartRateHistory,
        color: secondaryColor,
        value: targetHeartRateDisplay,
        valueLabel: "TARGET",
        plannedStepped: true,
        strokeWidth: 2,
        colorByHeartRateZone: true,
        zoneBands: heartRateZoneBands,
        domainMinY: 60,
        domainMaxY: heartRateChartMax,
        yAxisTicks: heartRateAxisTicks,
        onPress: () =>
          navigation.navigate("RunHeartRateChartPage", {
            workoutId: workout_id,
            durationSeconds: currentElapsed,
            actualHistory: actualHeartRateHistory,
            plannedHistory: targetHeartRateHistory,
            targetDisplay: targetHeartRateDisplay,
            maxHeartRate,
            zoneBands: heartRateZoneBands,
          }),
      })}
      {renderCompletedRouteCard()}
      {shouldShowWorkoutPlan ? (
        <View style={styles.completedPlanHeading}>
          <Feather name="list" size={16} color={primaryColor} />
          <ThemedText style={styles.completedPlanTitle} setColor={titleColor}>
            Workout plan
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const closeEnduranceZoneDropdown = () => {
    setEnduranceZoneDropdownVisible(false);
  };

  const ensureEnduranceMainSet = async () => {
    let targetSet = enduranceMainSet;

    if (!targetSet) {
      if (enduranceZonePreparingRef.current) {
        return null;
      }

      enduranceZonePreparingRef.current = true;

      try {
        await runningRepository.addRunSet(db, {
          workoutId: workout_id,
          type: "WORKING_SET",
          addAutomaticPause: false,
        });
        const sets = await runningRepository.getOrderedRunSetsForWorkout(
          db,
          workout_id
        );
        targetSet = sets.find(
          (set) =>
            normalizeRunSectionType(set?.type) === "WORKING_SET" &&
            Number(set?.is_pause) !== 1
        );
        set_hasRunStructure(sets.length > 0);
        set_runSectionCounts(getRunSectionCounts(sets));
        set_runPlanSets(sets);
      } catch (error) {
        console.error("Failed to create the endurance main set:", error);
        return null;
      } finally {
        enduranceZonePreparingRef.current = false;
      }
    }

    return targetSet ?? null;
  };

  const handleEnduranceZonePress = async () => {
    if (enduranceZoneDropdownVisible) {
      closeEnduranceZoneDropdown();
      return;
    }

    const anchor = enduranceZoneTriggerRef.current;

    if (!anchor?.measureInWindow) {
      return;
    }

    const targetSet = await ensureEnduranceMainSet();

    if (!targetSet) {
      return;
    }

    setEnduranceZoneSetId(targetSet.Run_id);

    anchor.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const screenHeight = Dimensions.get("window").height;
      const preferredLeft = x + width - RUN_ZONE_POPOVER_WIDTH;
      const preferredTop = y + height / 2 - RUN_ZONE_POPOVER_HEIGHT / 2;
      const maxLeft =
        screenWidth - RUN_ZONE_POPOVER_WIDTH - RUN_ZONE_POPOVER_MARGIN;
      const maxTop =
        screenHeight - RUN_ZONE_POPOVER_HEIGHT - RUN_ZONE_POPOVER_MARGIN;

      setEnduranceZonePopoverPosition({
        left: Math.max(
          RUN_ZONE_POPOVER_MARGIN,
          Math.min(preferredLeft, maxLeft)
        ),
        top: Math.max(
          RUN_ZONE_POPOVER_MARGIN,
          Math.min(preferredTop, maxTop)
        ),
      });
      setEnduranceZoneDropdownVisible(true);
    });
  };

  const updateEndurancePlanField = async (field, value) => {
    const targetSet = await ensureEnduranceMainSet();

    if (!targetSet) {
      return;
    }

    try {
      await runningRepository.updateRunSetField(db, {
        runId: targetSet.Run_id,
        field,
        value,
      });
      set_runPlanSets((currentSets) =>
        currentSets.map((set) =>
          set.Run_id === targetSet.Run_id
            ? { ...set, [field]: value }
            : set
        )
      );
      triggerReload();
    } catch (error) {
      console.error(`Failed to update endurance ${field}:`, error);
    }
  };

  const moveEnduranceStatPriority = (itemKey, targetIndex) => {
    const sourceIndex = visibleEnduranceStatPriority.indexOf(itemKey);

    if (
      sourceIndex < 0 ||
      targetIndex === sourceIndex ||
      targetIndex < 0 ||
      targetIndex >= visibleEnduranceStatPriority.length
    ) {
      return;
    }

    const nextVisiblePriority = [...visibleEnduranceStatPriority];
    const [movedItem] = nextVisiblePriority.splice(sourceIndex, 1);
    nextVisiblePriority.splice(targetIndex, 0, movedItem);

    const hiddenPriority = enduranceStatPriority.filter(
      (key) => !populatedEnduranceStats[key]
    );
    void updateEndurancePlanField(
      "stat_priority",
      JSON.stringify([...nextVisiblePriority, ...hiddenPriority])
    );
  };

  const updateEnduranceZone = async (zone) => {
    if (!enduranceZoneSetId) {
      return;
    }

    closeEnduranceZoneDropdown();

    try {
      await runningRepository.updateRunSetField(db, {
        runId: enduranceZoneSetId,
        field: "heartrate",
        value: zone,
      });
      triggerReload();
    } catch (error) {
      console.error("Failed to update endurance heart rate zone:", error);
    }
  };

  const renderEnduranceZoneDropdown = () => (
    <Modal
      visible={enduranceZoneDropdownVisible}
      transparent
      animationType="fade"
      onRequestClose={closeEnduranceZoneDropdown}
    >
      <View style={styles.zoneDropdownOverlay}>
        <Pressable
          style={styles.zoneDropdownBackdrop}
          onPress={closeEnduranceZoneDropdown}
        />

        <View
          style={[
            styles.zoneDropdownContainer,
            enduranceZonePopoverPosition,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.zoneDropdownOption,
              styles.zoneDropdownClear,
              {
                borderColor:
                  theme.danger ?? RUN_HEART_RATE_ZONE_COLORS[5],
              },
            ]}
            onPress={() => {
              void updateEnduranceZone(null);
            }}
          >
            <Cross
              width={14}
              height={14}
              color={theme.danger ?? RUN_HEART_RATE_ZONE_COLORS[5]}
            />
          </TouchableOpacity>

          {RUN_HEART_RATE_ZONES.map((zone) => (
            <TouchableOpacity
              key={zone}
              style={[
                styles.zoneDropdownOption,
                { backgroundColor: RUN_HEART_RATE_ZONE_COLORS[zone] },
              ]}
              onPress={() => {
                void updateEnduranceZone(zone);
              }}
            >
              <ThemedText
                style={[
                  styles.zoneDropdownText,
                  { color: zone === 1 ? "#111111" : "#FFFFFF" },
                ]}
              >
                {zone}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  const renderEndurancePlanCard = (
    key,
    { editable = true, includeRoutes = true, showControls = false } = {}
  ) => {
    const plannedDurationDisplay =
      plannedEnduranceDurationSeconds > 0
        ? formatRunClock(plannedEnduranceDurationSeconds)
        : "--";
    const plannedPaceDisplay =
      plannedEndurancePace === null
        ? "--"
        : formatPaceDisplay(plannedEndurancePace);
    const expectedDistanceDisplay =
      expectedEnduranceDistance === null
        ? "--"
        : `~${formatRunDistance(expectedEnduranceDistance)} km`;
    const plannedDistanceDisplay =
      plannedEnduranceDistance > 0
        ? `${formatRunDistance(plannedEnduranceDistance)} km`
        : expectedDistanceDisplay;
    const plannedDistanceMeta =
      plannedEnduranceDistance > 0 ? "Planned" : "Estimated";
    const EnduranceZoneStat = editable ? TouchableOpacity : View;
    const enduranceZoneStatProps = editable
      ? {
          ref: enduranceZoneTriggerRef,
          accessibilityRole: "button",
          accessibilityLabel: "Change planned heart rate zone",
          activeOpacity: 0.78,
          onPress: handleEnduranceZonePress,
        }
      : {};
    const getStatOrder = (statKey) =>
      Math.max(0, enduranceStatPriority.indexOf(statKey)) * 2;

    return (
      <View key={key} style={styles.activeTitledCardShell}>
        {!showControls ? renderActiveCardTitle("Planned") : null}
        <ThemedCard
          style={[
            styles.endurancePlanCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
            {showControls ? (
              <View style={styles.endurancePlanControlHeader}>
                <View style={styles.enduranceActions}>
                  <View style={styles.enduranceControl}>
                    {renderActiveTimerPrimaryButton()}
                    <ThemedText
                      style={styles.enduranceControlLabel}
                      setColor={quietText}
                    >
                      {isRunning ? "PAUSE" : "RESUME"}
                    </ThemedText>
                  </View>

                  <View style={styles.enduranceControl}>
                    {renderActiveTimerFinishButton()}
                    <ThemedText
                      style={styles.enduranceControlLabel}
                      setColor={quietText}
                    >
                      FINISH
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {!showControls ? (
              <View
                style={[
                  styles.endurancePlanStats,
                  styles.endurancePlanStatsStandalone,
                  { borderTopColor: cardBorder },
                ]}
              >
              <View
                style={[
                  styles.endurancePlanStat,
                  { order: getStatOrder("time") },
                ]}
              >
                <View style={styles.endurancePlanStatLabelRow}>
                  <Feather name="clock" size={15} color={quietText} />
                  <ThemedText
                    style={styles.endurancePlanStatLabel}
                    setColor={quietText}
                  >
                    DURATION
                  </ThemedText>
                </View>
                {editable ? (
                  <View
                    style={[
                      styles.valuePill,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <ThemedEditableCell
                      value={enduranceMainSet?.time?.toString() ?? ""}
                      placeholder="--"
                      placeholderTextColor={titleColor}
                      keyboardType="normal"
                      displayFormatter={(value) => {
                        const minutes = parsePaceToMinutes(value);

                        return Number(minutes) > 0
                          ? formatRunClock(minutes * 60)
                          : "";
                      }}
                      onCommit={(value) =>
                        updateEndurancePlanField(
                          "time",
                          parsePositiveRunValue(parsePaceToMinutes(value))
                        )
                      }
                    />
                  </View>
                ) : (
                  <ThemedText
                    style={styles.endurancePlanStatValue}
                    setColor={titleColor}
                  >
                    {plannedDurationDisplay}
                  </ThemedText>
                )}
                <ThemedText
                  style={styles.endurancePlanStatMeta}
                  setColor={quietText}
                >
                  Total time
                </ThemedText>
              </View>

              <View
                style={[
                  styles.endurancePlanStatDivider,
                  { backgroundColor: cardBorder, order: 1 },
                ]}
              />

              <View
                style={[
                  styles.endurancePlanStat,
                  { order: getStatOrder("distance") },
                ]}
              >
                <View style={styles.endurancePlanStatLabelRow}>
                  <Feather name="map-pin" size={14} color={quietText} />
                  <ThemedText
                    style={styles.endurancePlanStatLabel}
                    setColor={quietText}
                  >
                    DISTANCE
                  </ThemedText>
                </View>
                {editable ? (
                  <View
                    style={[
                      styles.valuePill,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <ThemedEditableCell
                      value={enduranceMainSet?.distance?.toString() ?? ""}
                      placeholder={plannedDistanceDisplay}
                      placeholderTextColor={titleColor}
                      keyboardType="decimal-pad"
                      displayFormatter={(value) => {
                        const distance = parsePositiveRunValue(value);

                        return distance === null
                          ? ""
                          : `${formatRunDistance(distance)} km`;
                      }}
                      onCommit={(value) =>
                        updateEndurancePlanField(
                          "distance",
                          parsePositiveRunValue(value)
                        )
                      }
                    />
                  </View>
                ) : (
                  <ThemedText
                    style={styles.endurancePlanStatValue}
                    setColor={titleColor}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.68}
                  >
                    {plannedDistanceDisplay}
                  </ThemedText>
                )}
                <ThemedText
                  style={styles.endurancePlanStatMeta}
                  setColor={quietText}
                >
                  {plannedDistanceMeta}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.endurancePlanStatDivider,
                  { backgroundColor: cardBorder, order: 3 },
                ]}
              />

              <View
                style={[
                  styles.endurancePlanStat,
                  { order: getStatOrder("pace") },
                ]}
              >
                <View style={styles.endurancePlanStatLabelRow}>
                  <Feather name="activity" size={15} color={quietText} />
                  <ThemedText
                    style={styles.endurancePlanStatLabel}
                    setColor={quietText}
                  >
                    PACE
                  </ThemedText>
                </View>
                {editable ? (
                  <View
                    style={[
                      styles.valuePill,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <ThemedEditableCell
                      value={enduranceMainSet?.pace?.toString() ?? ""}
                      placeholder="--"
                      placeholderTextColor={titleColor}
                      keyboardType="normal"
                      displayFormatter={(value) =>
                        formatPaceDisplay(parsePaceToMinutes(value))
                      }
                      onCommit={(value) =>
                        updateEndurancePlanField(
                          "pace",
                          parsePositiveRunValue(parsePaceToMinutes(value))
                        )
                      }
                    />
                  </View>
                ) : (
                  <ThemedText
                    style={styles.endurancePlanStatValue}
                    setColor={titleColor}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {plannedPaceDisplay}
                  </ThemedText>
                )}
                <ThemedText
                  style={styles.endurancePlanStatMeta}
                  setColor={quietText}
                >
                  Planned /km
                </ThemedText>
              </View>

              <View
                style={[
                  styles.endurancePlanStatDivider,
                  { backgroundColor: cardBorder, order: 5 },
                ]}
              />

              <EnduranceZoneStat
                {...enduranceZoneStatProps}
                style={[
                  styles.endurancePlanStat,
                  { order: getStatOrder("zone") },
                ]}
              >
                <View style={styles.endurancePlanStatLabelRow}>
                  <Feather
                    name="heart"
                    size={15}
                    color={enduranceHeartRateColor}
                  />
                  <ThemedText
                    style={styles.endurancePlanStatLabel}
                    setColor={quietText}
                  >
                    ZONE
                  </ThemedText>
                </View>
                <ThemedText
                  style={styles.endurancePlanStatValue}
                  setColor={enduranceHeartRateColor}
                >
                  {enduranceHeartRateZone
                    ? `Zone ${enduranceHeartRateZone}`
                    : "--"}
                </ThemedText>
                <ThemedText
                  style={styles.endurancePlanStatMeta}
                  setColor={quietText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {enduranceZonePercentLabels[enduranceHeartRateZone] ?? "HRmax"}
                </ThemedText>
                </EnduranceZoneStat>
              </View>
            ) : null}
        </ThemedCard>
        {editable ? renderEnduranceZoneDropdown() : null}

        {editable &&
        original_start_time === null &&
        visibleEnduranceStatPriority.length > 0 ? (
          <View style={styles.statPrioritySection}>
            {renderActiveCardTitle("Stat priority")}
            <ThemedCard
              style={[
                styles.statPriorityCard,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.statPriorityHeader}>
                <View style={styles.statPriorityHeaderCopy}>
                  <ThemedText
                    style={styles.statPriorityTitle}
                    setColor={titleColor}
                  >
                    Priority
                  </ThemedText>
                  <ThemedText
                    style={styles.statPriorityDescription}
                    setColor={quietText}
                  >
                    Drag the handle to change the order.
                  </ThemedText>
                </View>
                <Feather name="sliders" size={19} color={quietText} />
              </View>

              <View style={styles.statPriorityList}>
                {visibleEnduranceStatPriority.map((itemKey, index) => (
                  <DraggablePriorityRow
                    key={itemKey}
                    itemKey={itemKey}
                    index={index}
                    itemCount={visibleEnduranceStatPriority.length}
                    onMove={moveEnduranceStatPriority}
                    cardBorder={cardBorder}
                    quietText={quietText}
                    titleColor={titleColor}
                  />
                ))}
              </View>
            </ThemedCard>
          </View>
        ) : null}

        {includeRoutes ? (
          <ThemedCard
          style={[
            styles.enduranceRoutesCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.enduranceRoutesIcon,
              {
                backgroundColor: innerSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <Feather name="map" size={21} color={primaryColor} />
          </View>

          <View style={styles.enduranceRoutesCopy}>
            <ThemedText
              style={styles.enduranceRoutesEyebrow}
              setColor={quietText}
            >
              ROUTES
            </ThemedText>
            <ThemedText
              style={styles.enduranceRoutesTitle}
              setColor={titleColor}
            >
              Previous routes
            </ThemedText>
            <ThemedText
              style={styles.enduranceRoutesDescription}
              setColor={quietText}
            >
              Reuse saved routes and compare earlier runs.
            </ThemedText>
          </View>

          <View
            style={[
              styles.enduranceRoutesBadge,
              { borderColor: primaryColor },
            ]}
          >
            <ThemedText
              style={styles.enduranceRoutesBadgeText}
              setColor={primaryColor}
            >
              COMING SOON
            </ThemedText>
          </View>
          </ThemedCard>
        ) : null}
      </View>
    );
  };

  const renderEnduranceBaseDashboard = () => {
    const plannedDurationDisplay =
      plannedEnduranceDurationSeconds > 0
        ? formatRunClock(plannedEnduranceDurationSeconds)
        : "--";
    const expectedDistanceDisplay =
      expectedEnduranceDistance === null
        ? "--"
        : `~${formatRunDistance(expectedEnduranceDistance)} km`;
    const enduranceAveragePaceDisplay =
      enduranceAveragePace === null
        ? "--"
        : formatPaceDisplay(enduranceAveragePace);
    const statCardByPriorityKey = {
      time: "distance-time",
      distance: "distance-time",
      zone: "heart-rate",
      pace: "pace",
    };
    const prioritizedStatCards = visibleEnduranceStatPriority.reduce(
      (cardOrder, statKey) => {
        const cardKey = statCardByPriorityKey[statKey];

        if (cardKey && !cardOrder.includes(cardKey)) {
          cardOrder.push(cardKey);
        }

        return cardOrder;
      },
      []
    );
    ["distance-time", "heart-rate", "pace"].forEach((cardKey) => {
      if (!prioritizedStatCards.includes(cardKey)) {
        prioritizedStatCards.push(cardKey);
      }
    });
    const getActiveStatCardOrder = (cardKey) =>
      prioritizedStatCards.indexOf(cardKey) + 1;

    return (
      <View style={styles.enduranceDashboard}>
        {original_start_time === null ? (
          <View style={styles.planStartActionShell}>
            {renderHeroActionRow()}
          </View>
        ) : (
          <>
            {renderEndurancePlanCard("active-endurance-plan", {
              editable: false,
              includeRoutes: false,
              showControls: true,
            })}

            <View
              style={[
                styles.activeTitledCardShell,
                { order: getActiveStatCardOrder("distance-time") },
              ]}
            >
              {renderActiveCardTitle("Distance & time")}
              <ThemedCard
                style={[
                  styles.enduranceProgressCard,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.enduranceProgressStats}>
                  <View style={styles.enduranceProgressStat}>
                    <ThemedText
                      style={styles.enduranceProgressLabel}
                      setColor={quietText}
                    >
                      TIME
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressValue}
                      setColor={titleColor}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {formatRunClock(enduranceProgressSeconds)}
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressMeta}
                      setColor={quietText}
                    >
                      / {plannedDurationDisplay}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.enduranceProgressDivider,
                      { backgroundColor: cardBorder },
                    ]}
                  />

                  <View style={styles.enduranceProgressStat}>
                    <ThemedText
                      style={styles.enduranceProgressLabel}
                      setColor={quietText}
                    >
                      DISTANCE
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressValue}
                      setColor={titleColor}
                    >
                      {formatRunDistance(enduranceProgressDistance)}
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressMeta}
                      setColor={quietText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      / {expectedDistanceDisplay}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.enduranceProgressDivider,
                      { backgroundColor: cardBorder },
                    ]}
                  />

                  <View style={styles.enduranceProgressStat}>
                    <ThemedText
                      style={styles.enduranceProgressLabel}
                      setColor={quietText}
                    >
                      AVG PACE
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressValue}
                      setColor={titleColor}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                    >
                      {enduranceAveragePaceDisplay}
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressMeta}
                      setColor={quietText}
                    >
                      min/km
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.enduranceProgressDivider,
                      { backgroundColor: cardBorder },
                    ]}
                  />

                  <View style={styles.enduranceProgressStat}>
                    <ThemedText
                      style={styles.enduranceProgressLabel}
                      setColor={quietText}
                      numberOfLines={2}
                    >
                      EXPECTED DIST.
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressValue}
                      setColor={titleColor}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.58}
                    >
                      {expectedDistanceDisplay}
                    </ThemedText>
                    <ThemedText
                      style={styles.enduranceProgressMeta}
                      setColor={quietText}
                      numberOfLines={1}
                    >
                      at {plannedDurationDisplay}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.enduranceProgressTrack}>
                  <View
                    style={[
                      styles.enduranceProgressFill,
                      {
                        backgroundColor: enduranceHeartRateColor,
                        width: `${enduranceProgressPercent}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText
                  style={styles.enduranceProgressPercent}
                  setColor={quietText}
                >
                  {enduranceProgressPercent}%
                </ThemedText>
              </ThemedCard>
            </View>

            {renderCompletionChart({
              sectionTitle: "Pace vs. plan",
              title: "Pace comparison",
              subtitle: paceComparisonSubtitle,
              icon: "activity",
              data: paceHistory,
              plannedData: plannedPaceHistory,
              plannedColor: quietText,
              color: paceComparisonColor,
              value: formatSignedPaceDelta(paceDeltaSeconds),
              valueLabel: paceComparisonLabel,
              invert: true,
              domainMinY: paceComparisonDomainMin,
              domainMaxY: paceComparisonDomainMax,
              yAxisTicks: paceComparisonYAxisTicks,
              formatYAxisTick: formatPaceAxisLabel,
              strokeWidth: 2.25,
              showPlannedLine: false,
              chartTextColor: "#FFFFFF",
              yAxisLabel: "PACE",
              containerStyle: {
                order: getActiveStatCardOrder("pace"),
              },
            })}

            {renderCompletionChart({
              sectionTitle: enduranceHeartRateZone
                ? `Heart rate - Zone ${enduranceHeartRateZone}`
                : "Heart rate",
              title: enduranceHeartRateZone
                ? `Zone ${enduranceHeartRateZone}`
                : "Heart rate",
              subtitle:
                enduranceActualHeartRateHistory.length > 0
                  ? "Live heart rate compared with the planned zone."
                  : "Planned heart-rate zone; waiting for live data.",
              icon: "heart",
              data: enduranceActualHeartRateHistory,
              plannedData: enduranceTargetHeartRateHistory,
              color: enduranceHeartRateColor,
              value: enduranceHeartRateZone
                ? `Zone ${enduranceHeartRateZone}`
                : "--",
              valueLabel: enduranceHeartRateRange,
              plannedStepped: true,
              strokeWidth: 2,
              colorByHeartRateZone: true,
              zoneBands: heartRateZoneBands,
              backgroundZoneBands: enduranceHeartRateBand
                ? [enduranceHeartRateBand]
                : [],
              domainMinY: enduranceHeartRateDomainMinY,
              domainMaxY: enduranceHeartRateDomainMaxY,
              yAxisTicks: enduranceHeartRateYAxisTicks,
              domainMaxX: enduranceHeartRateDomainMaxX,
              xAxisTicks: enduranceHeartRateXAxisTicks,
              formatXAxisTick: (value) =>
                enduranceHeartRateUsesDistance
                  ? `${Number(value).toFixed(
                      enduranceHeartRateDomainMaxX < 10 ? 1 : 0
                    )} km`
                  : `${Math.round(Number(value))} min`,
              chartHeight: 178,
              horizontalPadding: 7,
              chartTextColor: "#FFFFFF",
              showPlannedLine: false,
              containerStyle: {
                order: getActiveStatCardOrder("heart-rate"),
              },
              onPress: () =>
                navigation.navigate("RunHeartRateChartPage", {
                  workoutId: workout_id,
                  durationSeconds: currentElapsed,
                  actualHistory: enduranceActualHeartRateHistory,
                  plannedHistory: enduranceTargetHeartRateHistory,
                  targetDisplay: targetHeartRateDisplay,
                  maxHeartRate,
                  zoneBands: heartRateZoneBands,
                }),
            })}
          </>
        )}
      </View>
    );
  };

  const renderCustomRunDashboard = () => {
    const customMetrics = [
      {
        label: "TIME",
        value: elapsedDisplay,
        meta: "mm:ss",
      },
      {
        label: "DISTANCE",
        value: formattedTotalDistance,
        meta: "km",
      },
      {
        label: "AVG PACE",
        value: avgPaceDisplay,
        meta: "min/km",
      },
      {
        label: "CURRENT PACE",
        value: formatPaceDisplay(currentPaceMinutes),
        meta: "min/km",
      },
    ];
    return (
      <View style={styles.customRunDashboard}>
        <ThemedCard
          style={[
            styles.customRunMetricsCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.customRunMetricsRow}>
            {customMetrics.map((metric, index) => (
              <View key={metric.label} style={styles.customRunMetric}>
                <ThemedText
                  style={styles.customRunMetricLabel}
                  setColor={quietText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {metric.label}
                </ThemedText>
                <ThemedText
                  style={styles.customRunMetricValue}
                  setColor={titleColor}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  {metric.value}
                </ThemedText>
                <ThemedText
                  style={styles.customRunMetricMeta}
                  setColor={quietText}
                >
                  {metric.meta}
                </ThemedText>
                {index < customMetrics.length - 1 ? (
                  <View
                    style={[
                      styles.customRunMetricDivider,
                      { backgroundColor: cardBorder },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          <View
            style={[
              styles.enduranceActions,
              styles.customRunActions,
              { borderTopColor: cardBorder },
            ]}
          >
            <View style={styles.enduranceControl}>
              {renderActiveTimerPrimaryButton()}
              <ThemedText
                style={styles.enduranceControlLabel}
                setColor={quietText}
              >
                {isRunning
                  ? "PAUSE"
                  : original_start_time === null
                    ? "START"
                    : "RESUME"}
              </ThemedText>
            </View>
            {original_start_time !== null ? (
              <View style={styles.enduranceControl}>
                {renderActiveTimerFinishButton()}
                <ThemedText
                  style={styles.enduranceControlLabel}
                  setColor={quietText}
                >
                  FINISH
                </ThemedText>
              </View>
            ) : null}
          </View>
        </ThemedCard>

        <View style={styles.activeTitledCardShell}>
          {renderActiveCardTitle("Heart rate")}
          <ThemedCard
            style={[
              styles.customHeartRateCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.customHeartRateHeader}>
              <View>
                <ThemedText
                  style={styles.customHeartRateValue}
                  setColor={titleColor}
                >
                  {currentHeartRate ?? "--"}
                  <ThemedText
                    style={styles.customHeartRateUnit}
                    setColor={quietText}
                  >
                    {" "}bpm
                  </ThemedText>
                </ThemedText>
                <ThemedText
                  style={styles.customHeartRateZone}
                  setColor={currentHeartRateBand?.color ?? quietText}
                >
                  {currentHeartRateBand
                    ? `Zone ${currentHeartRateBand.zone}`
                    : "Waiting for heart rate"}
                </ThemedText>
              </View>
              <Feather
                name="heart"
                size={24}
                color={currentHeartRateBand?.color ?? quietText}
              />
            </View>

            <View
              style={styles.customHeartRateViewport}
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                setCustomHeartRateViewportWidth((currentWidth) =>
                  Math.abs(currentWidth - nextWidth) > 0.5
                    ? nextWidth
                    : currentWidth
                );
              }}
            >
              <ScrollView
                ref={customHeartRateScrollRef}
                horizontal
                bounces
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onScrollBeginDrag={() => {
                  setIsCustomHeartRateFollowing(false);
                }}
                style={styles.customHeartRateScrollView}
              >
                <View
                  style={[
                    styles.customHeartRateTrack,
                    { width: customHeartRateTrackWidth },
                  ]}
                >
                  {heartRateZoneBands.map((band, index) => {
                    const zoneStart =
                      index === 0
                        ? 0
                        : heartRateZoneBands[index - 1].max;
                    const zoneLeft = customHeartRatePosition(zoneStart);
                    const zoneRight = customHeartRatePosition(band.max);

                    return (
                      <View
                        key={band.zone}
                        style={[
                          styles.customHeartRateZoneBand,
                          {
                            left: zoneLeft,
                            width: Math.max(zoneRight - zoneLeft, 2),
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.customHeartRateZoneBandFill,
                            { backgroundColor: band.color },
                          ]}
                        />
                        <ThemedText
                          style={styles.customHeartRateZoneBandText}
                          setColor={band.color}
                          numberOfLines={1}
                        >
                          ZONE {band.zone}
                        </ThemedText>
                      </View>
                    );
                  })}
                  {heartRateZoneBands.slice(0, -1).map((band) => (
                    <View
                      key={`boundary-${band.zone}`}
                      pointerEvents="none"
                      style={[
                        styles.customHeartRateZoneBoundary,
                        { left: customHeartRatePosition(band.max) },
                      ]}
                    >
                      <View
                        style={[
                          styles.customHeartRateZoneBoundaryLine,
                          { backgroundColor: quietText },
                        ]}
                      />
                      <ThemedText
                        style={styles.customHeartRateZoneBoundaryText}
                        setColor="#FFFFFF"
                        numberOfLines={1}
                      >
                        {band.max} bpm
                      </ThemedText>
                    </View>
                  ))}
                  {currentHeartRate !== null ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.customHeartRateCurrentDot,
                        {
                          left: customHeartRatePosition(currentHeartRate),
                          backgroundColor:
                            currentHeartRateBand?.color ?? "#FFFFFF",
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </ScrollView>
              <View
                style={[
                  styles.customHeartRateCenterLine,
                  { backgroundColor: titleColor },
                ]}
                pointerEvents="none"
              />
            </View>
            {!isCustomHeartRateFollowing ? (
              <View style={styles.customHeartRateRecenterRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Recenter heart rate zones"
                  activeOpacity={0.78}
                  onPress={() => setIsCustomHeartRateFollowing(true)}
                  style={[
                    styles.customHeartRateRecenterButton,
                    { borderColor: titleColor },
                  ]}
                >
                  <Feather name="crosshair" size={13} color={titleColor} />
                  <ThemedText
                    style={styles.customHeartRateRecenterText}
                    setColor={titleColor}
                  >
                    RECENTER
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.customHeartRateScaleMeta}>
              <ThemedText
                style={styles.customHeartRateScaleText}
                setColor={quietText}
              >
                LOWER
              </ThemedText>
              <ThemedText
                style={styles.customHeartRateScaleText}
                setColor={quietText}
              >
                CURRENT
              </ThemedText>
              <ThemedText
                style={styles.customHeartRateScaleText}
                setColor={quietText}
              >
                HIGHER
              </ThemedText>
            </View>
          </ThemedCard>
        </View>

      </View>
    );
  };

  const renderActiveRunDashboard = () => (
    <View style={styles.activeRunDashboard}>
      {renderActiveSummaryCard()}
      {renderCurrentSetCard()}
      {renderActiveEffortCard()}
      {renderNextIntervalCard()}
    </View>
  );

  const renderWorkoutPlanToggle = () => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        isWorkoutPlanExpanded ? "Hide workout plan" : "Show workout plan"
      }
      activeOpacity={0.78}
      onPress={() => set_isWorkoutPlanExpanded((isExpanded) => !isExpanded)}
      style={[
        styles.workoutPlanToggle,
        {
          backgroundColor: cardSurface,
          borderColor: cardBorder,
        },
      ]}
    >
      <View style={styles.workoutPlanToggleCopy}>
        <Feather name="list" size={17} color={primaryColor} />
        <ThemedText style={styles.workoutPlanToggleTitle} setColor={titleColor}>
          Workout plan
        </ThemedText>
      </View>

      <View style={styles.workoutPlanToggleAction}>
        <ThemedText style={styles.workoutPlanToggleLabel} setColor={primaryColor}>
          {isWorkoutPlanExpanded ? "Hide plan" : "Show plan"}
        </ThemedText>
        <Feather
          name={isWorkoutPlanExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={primaryColor}
        />
      </View>
    </TouchableOpacity>
  );

  const renderHeroActionRow = () => {
    if (isDone) {
      return null;
    }

    return (
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
    );
  };

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
      title:
        selectedRunFlow === "endurance-base"
          ? "Main activity"
          : "Intervals",
      eyebrow:
        selectedRunFlow === "endurance-base"
          ? "MAIN ACTIVITY"
          : "INTERVALS",
      emptySummary:
        selectedRunFlow === "endurance-base"
          ? "Add the main run"
          : "Add intervals to build this run",
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
      selectedRunFlow === "endurance-base" &&
      section.type === "COOLDOWN" &&
      (runSectionCounts.COOLDOWN ?? 0) === 0
    ) {
      return false;
    }

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
          {renderRunFocusTitle()}

          {isDone ? (
            renderCompletedRunDashboard()
          ) : shouldShowPlanOnlyStartAction ? (
            <View style={styles.planStartActionShell}>
              {renderHeroActionRow()}
            </View>
          ) : shouldShowEnduranceBaseDashboard ? (
            renderEnduranceBaseDashboard()
          ) : shouldShowCustomRunDashboard ? (
            renderCustomRunDashboard()
          ) : shouldShowSpeedStructureTimer ? (
            renderActiveRunDashboard()
          ) : (
            <ThemedCard
              style={[
                styles.heroCard,
                {
                  backgroundColor: cardSurface,
                  borderColor: isRunning ? primaryColor : cardBorder,
                },
              ]}
            >
              {shouldShowHeroMetrics && (
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
                        <ThemedText
                          style={styles.heroMetricUnit}
                          setColor={quietText}
                        >
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

              {renderHeroActionRow()}
            </ThemedCard>
          )}

          {shouldShowRunFlowSuggestions
            ? renderRunFlowSuggestions()
            : (
                <>
                  {isWorkoutPlanCollapsible
                    ? renderWorkoutPlanToggle()
                    : null}

                  {shouldShowWorkoutPlan
                    ? visibleSectionConfigs.map((section) =>
                        selectedRunFlow === "endurance-base" &&
                        section.type === "WORKING_SET" ? (
                          renderEndurancePlanCard(section.type, {
                            includeRoutes: original_start_time === null,
                          })
                        ) : (
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
                            workoutStarted={original_start_time !== null}
                            hidePauseRows={
                              selectedRunFlow === "endurance-base"
                            }
                            maxSets={
                              selectedRunFlow === "endurance-base" &&
                              section.type === "WORKING_SET"
                                ? 1
                                : null
                            }
                          />
                        )
                      )
                    : null}
                </>
              )}
        </View>
      </ThemedKeyboardProtection>
    </ThemedView>
  );
};

export default Run;
