import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import {
  formatTime,
  getCurrentStoredTimestampSeconds,
} from "@utils/timeUtils";
import {
  clearActiveRestTimer,
  subscribeRestTimer,
} from "@utils/restTimerEvents";

import styles from "./SetListStyle.js";
import Title from "./Title";

import {
  ThemedBouncyCheckbox,
  ThemedCard,
  ThemedEditableCell,
  ThemedModal,
  ThemedText,
} from "@resources/ThemedComponents";
import Note from "@resources/Icons/UI-icons/Note";
import Amrap from "@resources/Icons/UI-icons/Amrap";
import Expand from "@resources/Icons/UI-icons/Expand";
import Plus from "@resources/Icons/UI-icons/Plus";
import Cogwheel from "@resources/Icons/UI-icons/Cogwheel";
import Star from "@resources/Icons/UI-icons/Star";
import { weightliftingService } from "@services";
import { formatNumber, useTranslation } from "@localization";
import ReanimatedAnimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  clampSetValue,
  isClampedSetField,
} from "@utils/setValueLimits";
import {
  canBePersonalRecord,
  dropParentWeight,
  labelSets,
  orderSetsForDisplay,
  resolveSetType,
} from "@utils/setTypes";
import SetTypeSheet from "./SetTypeSheet";
import { isToneRow, setTypeColor } from "./setTypeColors";

const SET_LIST_COLUMN_KEYS = [
  "note",
  "rest",
  "set",
  "reps",
  "rpe",
  "rm_percentage",
  "weight",
  "done",
];
const SET_LIST_OPT_IN_COLUMN_KEYS = ["note", "rpe", "rm_percentage"];
const SET_LIST_DEFAULT_VISIBLE_COLUMNS = SET_LIST_COLUMN_KEYS.reduce(
  (columns, key) => ({
    ...columns,
    [key]: !SET_LIST_OPT_IN_COLUMN_KEYS.includes(key),
  }),
  {}
);
const REST_UNIT_MINUTES = "minutes";
const REST_UNIT_SECONDS = "seconds";
const REST_DIVIDER_BUBBLE_SIZE = 32;

// Two or more warm-ups can be folded into one row at any time, by hand. They
// also fold by themselves once every one is ticked off: after a beat, so the
// last tick is seen landing, and animated the way the card itself opens.
const WARMUP_FOLD_DELAY_MS = 450;
const WARMUP_FOLD_DURATION_MS = 260;
const WARMUP_FADE_DURATION_MS = 180;
const WARMUP_FOLD_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

// How long a deleted set can still be brought back.
const UNDO_DELETE_MS = 4000;

// What the person last did by hand to an exercise's warm-ups, "open" or
// "folded", kept for the session. Opened by hand, they no longer fold by
// themselves. Module state rather than a ref: folding the card unmounts this
// list, and the choice has to outlive that.
const warmupFoldChoice = new Map();

// One warm-up folded into one row is the same row with a chevron on it.
const MIN_WARMUPS_TO_FOLD = 2;

function countWarmups(orderedSets) {
  return orderedSets.filter((set) => resolveSetType(set) === "warmup").length;
}

function warmupsAllDone(orderedSets) {
  const warmups = orderedSets.filter((set) => resolveSetType(set) === "warmup");

  return (
    warmups.length >= MIN_WARMUPS_TO_FOLD &&
    warmups.every((set) => Number(set?.done) === 1)
  );
}

function initialWarmupsFolded(sets, foldKey) {
  const choice = warmupFoldChoice.get(foldKey);

  if (choice) {
    return choice === "folded";
  }

  // Already all done when the card opens: start folded, without playing it.
  return warmupsAllDone(orderSetsForDisplay(sets ?? []));
}

function parseWeight(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

const resolveSetListVisibleColumns = (visibleColumns) => {
  let parsedColumns = visibleColumns;

  if (typeof parsedColumns === "string") {
    try {
      parsedColumns = JSON.parse(parsedColumns);
    } catch {
      parsedColumns = null;
    }
  }

  const defaultColumns =
    weightliftingService.DEFAULT_VISIBLE_COLUMNS ??
    SET_LIST_DEFAULT_VISIBLE_COLUMNS;

  if (
    !parsedColumns ||
    typeof parsedColumns !== "object" ||
    Array.isArray(parsedColumns)
  ) {
    return defaultColumns;
  }

  const normalizedColumns = SET_LIST_COLUMN_KEYS.reduce(
    (columns, key) => ({
      ...columns,
      [key]: Boolean(parsedColumns[key]),
    }),
    {}
  );

  return Object.values(normalizedColumns).some(Boolean)
    ? normalizedColumns
    : defaultColumns;
};

const SetList = ({
  sets,
  exerciseId = null,
  exerciseName,
  visibleColumns,
  restUnitRequestKey = 0,
  onToggleSet,
  updateUI,
  onAddSet,
  onOpenSettings,
  recordColor,
  recordLightColor,
  recordDarkColor,
  recordControlFillColor,
  recordControlTextColor,
  onWorkoutMetadataChange,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const isDark = colorScheme === "dark";
  const tableSurface = isDark ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const tableBorder = isDark
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(32, 30, 43, 0.12)";
  const cellSurface = isDark
    ? "rgba(24, 25, 34, 0.9)"
    : "rgba(255, 255, 255, 0.86)";
  const cellBorder = isDark
    ? "rgba(255, 255, 255, 0.045)"
    : "rgba(32, 30, 43, 0.08)";
  const setChipBackground = withAlpha(theme.primary, isDark ? 0.17 : 0.14);
  const primaryColor = theme.primary ?? theme.text;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const setChipTextColor = primaryColor;
  const personalRecordColor =
    recordColor ?? theme.record ?? setChipTextColor;
  const personalRecordSurface =
    recordLightColor ??
    theme.recordLight ??
    (isDark ? "rgba(55, 63, 174, 0.38)" : "rgba(55, 63, 174, 0.16)");
  const personalRecordBorder =
    recordDarkColor ??
    theme.recordDark ??
    personalRecordColor;
  const personalRecordControlFill =
    recordControlFillColor ?? personalRecordBorder;
  const personalRecordControlText =
    recordControlTextColor ?? personalRecordSurface;
  // Same gold as the collapsed set dots use for a record.
  const personalRecordStarColor = theme.planned;
  const personalRecordStarTextColor = theme.textInverted;
  const addSetColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const exerciseActionColor = theme.primary ?? addSetColor;
  const secondaryColor = theme.secondary;
  const selectedRestUnitTextColor =
    theme.textInverted ?? theme.cardBackground;
  const restUnitBorderColor =
    theme.cardBorder ?? theme.iconColor;
  const restSettingsFieldSurface = theme.fields ?? cellSurface;

  const db = useSQLiteContext();
  const [localSets, setLocalSets] = useState(sets);
  // A deleted set, while it can still be brought back: { setId, label }.
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingDeleteRef = useRef(null);
  // Deletes that have reached the database. Hidden for good, so the set does
  // not flash back in the moment before the parent's refresh arrives.
  const deletedSetIdsRef = useRef(new Set());
  const updateUIRef = useRef(updateUI);
  const onWorkoutMetadataChangeRef = useRef(onWorkoutMetadataChange);

  updateUIRef.current = updateUI;
  onWorkoutMetadataChangeRef.current = onWorkoutMetadataChange;
  const resolvedVisibleColumns = resolveSetListVisibleColumns(visibleColumns);

  const [setOptionsVisible, setSetOptionsVisible] = useState(false);
  const [selectedSet, set_selectedSet] = useState(null);
  const [selectedSetNote, setSelectedSetNote] = useState("");
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteModalText, setNoteModalText] = useState("");
  const [activeEditableCell, setActiveEditableCell] = useState(null);
  const [restUnit, setRestUnit] = useState(REST_UNIT_MINUTES);
  const [mirrorRestValues, setMirrorRestValues] = useState(true);
  const [restUnitModalVisible, setRestUnitModalVisible] = useState(false);
  const restUnitRequestSeenRef = useRef(restUnitRequestKey);

  // The rest-unit picker is opened from the exercise settings panel, which
  // lives one level up, so the request arrives as a changing key.
  useEffect(() => {
    if (restUnitRequestKey === restUnitRequestSeenRef.current) {
      return;
    }

    restUnitRequestSeenRef.current = restUnitRequestKey;
    setRestUnitModalVisible(true);
  }, [restUnitRequestKey]);
  const [setRowLayouts, setSetRowLayouts] = useState({});
  const [activeRestTimer, setActiveRestTimer] = useState(null);
  const [completedRestTimer, setCompletedRestTimer] = useState(null);
  const [restTimerTick, setRestTimerTick] = useState(
    getCurrentStoredTimestampSeconds()
  );
  const activeRestTimerRef = useRef(null);

  useEffect(() => {
    setLocalSets(sets);
  }, [sets]);

  useEffect(() => {
    return subscribeRestTimer((timer) => {
      const now = getCurrentStoredTimestampSeconds();
      const previousTimer = activeRestTimerRef.current;

      if (timer) {
        activeRestTimerRef.current = timer;
        setActiveRestTimer(timer);
        setRestTimerTick(now);
        setCompletedRestTimer((currentTimer) =>
          Number(currentTimer?.setId) === Number(timer.setId)
            ? null
            : currentTimer
        );

        return;
      }

      if (previousTimer && previousTimer.endsAt <= now) {
        setCompletedRestTimer(previousTimer);
      }

      activeRestTimerRef.current = null;
      setActiveRestTimer(null);
      setRestTimerTick(now);
    });
  }, []);

  useEffect(() => {
    if (!activeRestTimer) {
      return;
    }

    const updateRestTimerTick = () => {
      const now = getCurrentStoredTimestampSeconds();
      setRestTimerTick(now);

      if (activeRestTimer.endsAt <= now) {
        setCompletedRestTimer(activeRestTimer);
        clearActiveRestTimer(activeRestTimer.id);
      }
    };

    updateRestTimerTick();
    const interval = setInterval(updateRestTimerTick, 1000);

    return () => clearInterval(interval);
  }, [activeRestTimer]);

  // A deleted set leaves the list at once and the database only when its undo
  // runs out, so it is filtered here rather than dropped from state - a
  // refresh from the parent in the meantime must not bring it back.
  const displayedSets = orderSetsForDisplay(
    (localSets ?? []).filter(
      (set) =>
        set.sets_id !== pendingDelete?.setId &&
        !deletedSetIdsRef.current.has(set.sets_id)
    )
  );
  const setLabels = labelSets(displayedSets);
  const labelBySetId = new Map(
    displayedSets.map((set, index) => [set.sets_id, setLabels[index]])
  );
  const hasSets = displayedSets.length > 0;

  // Warm-ups sort first, so they are the head of the list.
  const warmupSets = displayedSets.filter(
    (set) => resolveSetType(set) === "warmup"
  );
  const canFoldWarmups = warmupSets.length >= MIN_WARMUPS_TO_FOLD;
  const allWarmupsDone = warmupsAllDone(displayedSets);
  const foldKey = exerciseId ?? exerciseName ?? null;
  const [warmupsFolded, setWarmupsFolded] = useState(() =>
    initialWarmupsFolded(sets, foldKey)
  );
  const warmupsShownFolded = warmupsFolded && canFoldWarmups;
  const [warmupsAnimating, setWarmupsAnimating] = useState(false);
  const [warmupBlockY, setWarmupBlockY] = useState(0);
  const [warmupContentHeight, setWarmupContentHeight] = useState(0);
  const [foldedRowHeight, setFoldedRowHeight] = useState(0);
  const warmupFold = useSharedValue(warmupsShownFolded ? 1 : 0);
  const warmupFade = useSharedValue(warmupsShownFolded ? 1 : 0);
  const warmupFoldMountedRef = useRef(false);
  const previousAllWarmupsDoneRef = useRef(allWarmupsDone);
  const previousWarmupCountRef = useRef(warmupSets.length);

  // A tick taken back opens them again straight away. Only the change counts:
  // warm-ups folded by hand before they were done stay folded.
  useEffect(() => {
    const wasAllDone = previousAllWarmupsDoneRef.current;

    previousAllWarmupsDoneRef.current = allWarmupsDone;

    if (wasAllDone && !allWarmupsDone) {
      setWarmupsFolded(false);
    }
  }, [allWarmupsDone]);

  // A set just turned into a warm-up is shown, not folded away out of sight.
  useEffect(() => {
    const previousCount = previousWarmupCountRef.current;

    previousWarmupCountRef.current = warmupSets.length;

    if (warmupSets.length > previousCount) {
      setWarmupsFolded(false);
    }
  }, [warmupSets.length]);

  useEffect(() => {
    if (
      !allWarmupsDone ||
      warmupsFolded ||
      warmupFoldChoice.get(foldKey) === "open"
    ) {
      return undefined;
    }

    const timer = setTimeout(() => setWarmupsFolded(true), WARMUP_FOLD_DELAY_MS);

    return () => clearTimeout(timer);
  }, [allWarmupsDone, foldKey, warmupsFolded]);

  useEffect(() => {
    if (!warmupFoldMountedRef.current) {
      warmupFoldMountedRef.current = true;
      return;
    }

    const target = warmupsShownFolded ? 1 : 0;

    // The rest bubbles are placed from measured rows, which are moving; they
    // are hidden until the rows have settled.
    setWarmupsAnimating(true);
    warmupFade.value = withTiming(target, { duration: WARMUP_FADE_DURATION_MS });
    warmupFold.value = withTiming(
      target,
      { duration: WARMUP_FOLD_DURATION_MS, easing: WARMUP_FOLD_EASING },
      (finished) => {
        if (finished) {
          runOnJS(setWarmupsAnimating)(false);
        }
      }
    );
  }, [warmupFade, warmupFold, warmupsShownFolded]);

  const warmupBlockStyle = useAnimatedStyle(() => {
    if (!(warmupContentHeight > 0) || !(foldedRowHeight > 0)) {
      return {};
    }

    return {
      height:
        warmupContentHeight -
        (warmupContentHeight - foldedRowHeight) * warmupFold.value,
    };
  });
  const warmupRowsStyle = useAnimatedStyle(() => ({
    opacity: 1 - warmupFade.value,
  }));
  const foldedWarmupsStyle = useAnimatedStyle(() => ({
    opacity: warmupFade.value,
  }));

  const openWarmupsByHand = () => {
    warmupFoldChoice.set(foldKey, "open");
    setWarmupsFolded(false);
  };

  const foldWarmupsByHand = () => {
    warmupFoldChoice.set(foldKey, "folded");
    setWarmupsFolded(true);
  };
  const isPersonalRecordSet = (set) =>
    Number(set?.personal_record) === 1 &&
    Number(set?.done) === 1 &&
    Number(set?.failed) !== 1;

  const applyPersonalRecordSetIds = (setIds) => {
    if (!Array.isArray(setIds)) {
      return;
    }

    const personalRecordSetIds = new Set(setIds.map((setId) => Number(setId)));

    setLocalSets((prev) =>
      prev.map((set) => ({
        ...set,
        personal_record: personalRecordSetIds.has(Number(set.sets_id)) ? 1 : 0,
      }))
    );

    set_selectedSet((prev) =>
      prev
        ? {
            ...prev,
            personal_record: personalRecordSetIds.has(Number(prev.sets_id))
              ? 1
              : 0,
          }
        : prev
    );
  };

  const getNextSetCompletion = (set) => {
    const isDone = Number(set.done) === 1;
    const isFailed = Number(set.failed) === 1;

    if (!isDone && !isFailed) {
      return { done: 1, failed: 0 };
    }

    if (isDone && !isFailed) {
      return { done: 1, failed: 1 };
    }

    return { done: 0, failed: 0 };
  };

  const columnConfig = [
    { key: "note", style: styles.note, flexValue: 1 },
    { key: "rest", style: styles.pause, flexValue: 20 },
    { key: "set", style: styles.set, flexValue: 8 },
    { key: "reps", style: styles.reps, flexValue: 13 },
    { key: "rpe", style: styles.rpe, flexValue: 9 },
    { key: "rm_percentage", style: styles.rm_percentage, flexValue: 14 },
    { key: "weight", style: styles.weight, flexValue: 20 },
    { key: "done", style: styles.done, flexValue: 14 },
  ];

  const selectedColumns = columnConfig.filter(
    (col) => resolvedVisibleColumns[col.key]
  );
  const activeColumns =
    selectedColumns.length > 0 ? selectedColumns : columnConfig;
  const renderedVisibleColumns = activeColumns.reduce(
    (columns, column) => ({
      ...columns,
      [column.key]: true,
    }),
    {}
  );
  const showRestForSets =
    Boolean(resolvedVisibleColumns.rest) && displayedSets.length > 0;
  const settingsColumnKey = renderedVisibleColumns.done
    ? "done"
    : activeColumns[activeColumns.length - 1]?.key;

  const getRenderedColumns = (set) => {
    if (resolveSetType(set) !== "amrap" || !renderedVisibleColumns.reps) {
      return activeColumns;
    }

    const renderedColumns = [];

    for (const column of activeColumns) {
      if (column.key === "rpe") {
        continue;
      }

      if (column.key === "reps") {
        renderedColumns.push({
          ...column,
          mergedStyle: {
            flex:
              column.flexValue +
              (renderedVisibleColumns.rpe ? 9 : 0),
          },
        });
        continue;
      }

      renderedColumns.push(column);
    }

    return renderedColumns;
  };

  const parsePauseValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(String(value).replace(",", "."));

    return Number.isFinite(parsedValue) ? parsedValue : null;
  };

  const formatRestUnitValue = (value) => {
    const pauseValue = parsePauseValue(value);

    if (pauseValue === null) {
      return "";
    }

    const unitValue =
      restUnit === REST_UNIT_MINUTES ? pauseValue / 60 : pauseValue;

    if (Number.isInteger(unitValue)) {
      return unitValue.toString();
    }

    return Number(unitValue.toFixed(2)).toString();
  };

  const getPauseSuffix = () =>
    restUnit === REST_UNIT_MINUTES ? "min" : "sec";

  const getStoredPauseValue = (value) => {
    const pauseValue = parsePauseValue(value);

    if (pauseValue === null) {
      return "";
    }

    return restUnit === REST_UNIT_MINUTES ? pauseValue * 60 : pauseValue;
  };

  // A set added optimistically has no database id until the insert lands, so
  // every write is held back until it does.
  const isPersistedSet = (setId) => Number.isFinite(Number(setId));

  // The delete itself, once the undo has run out. Everything it touches is
  // read through a ref: the timer that calls it was set renders ago.
  const commitPendingDelete = async () => {
    const pending = pendingDeleteRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;

    try {
      await weightliftingService.deleteSet(db, pending.setId);
      deletedSetIdsRef.current.add(pending.setId);
      await updateUIRef.current?.();
      await onWorkoutMetadataChangeRef.current?.();
    } catch (error) {
      console.error("Error deleting set", error);
    } finally {
      setPendingDelete((current) =>
        current?.setId === pending.setId ? null : current
      );
    }
  };

  const undoPendingDelete = () => {
    const pending = pendingDeleteRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  };

  // No question first: the set goes from the list at once and stays
  // recoverable for a few seconds, which costs less than a dialog every time.
  const deleteSelectedSet = () => {
    const set = selectedSet;

    setSetOptionsVisible(false);

    if (!set || !isPersistedSet(set.sets_id)) {
      return;
    }

    // One undo at a time: a second delete makes the first one final.
    commitPendingDelete();

    pendingDeleteRef.current = {
      setId: set.sets_id,
      timer: setTimeout(commitPendingDelete, UNDO_DELETE_MS),
    };
    setPendingDelete({
      setId: set.sets_id,
      label: labelBySetId.get(set.sets_id)?.label ?? String(set.set_number ?? ""),
    });
  };

  // Leaving - the card folding, the workout closing - ends the undo, and the
  // set is deleted then rather than lost track of.
  useEffect(
    () => () => {
      const pending = pendingDeleteRef.current;

      if (!pending) {
        return;
      }

      clearTimeout(pending.timer);
      pendingDeleteRef.current = null;
      weightliftingService
        .deleteSet(db, pending.setId)
        .then(() => updateUIRef.current?.())
        .then(() => onWorkoutMetadataChangeRef.current?.())
        .catch((error) => console.error("Error deleting set", error));
    },
    [db]
  );

  const applySetType = async (setId, setType, amrapTarget = null) => {
    const current = localSets.find((set) => set.sets_id === setId);
    // Same rule as the service: an unticked set turned warm-up drops the
    // numbers it copied from the set above.
    const clearsLoad = setType === "warmup" && Number(current?.done) !== 1;
    const patch = {
      ...(clearsLoad ? { reps: null, weight: null, rm_percentage: null } : {}),
      set_type: setType,
      amrap: setType === "amrap" ? 1 : 0,
      amrap_target: setType === "amrap" ? amrapTarget : null,
      // A warm-up or a drop set loses its record at once; the service
      // recomputes the rest.
      ...(canBePersonalRecord(setType) ? {} : { personal_record: 0 }),
    };

    setLocalSets((prev) =>
      prev.map((set) => (set.sets_id === setId ? { ...set, ...patch } : set))
    );
    set_selectedSet((prev) =>
      prev?.sets_id === setId ? { ...prev, ...patch } : prev
    );

    try {
      const result = await weightliftingService.setSetType(db, {
        setId,
        setType,
        amrapTarget: patch.amrap_target,
      });

      applyPersonalRecordSetIds(result?.personalRecordSetIds);
    } catch (error) {
      console.error("Error changing set type", error);
    }

    updateUI?.();
  };

  const changeSelectedSetType = async (setType) => {
    const set = selectedSet;

    if (!set || !isPersistedSet(set.sets_id) || resolveSetType(set) === setType) {
      return;
    }

    const keptTarget =
      Number(set.amrap_target) > 0 ? Number(set.amrap_target) : null;

    await applySetType(set.sets_id, setType, keptTarget);
  };

  const changeSelectedAmrapTarget = async (amrapTarget) => {
    const set = selectedSet;

    if (!set || !isPersistedSet(set.sets_id)) {
      return;
    }

    await applySetType(set.sets_id, "amrap", amrapTarget);
  };

  const updateField = async (field, value, setId) => {
    if (!isPersistedSet(setId)) {
      return;
    }

    // The same ceiling the service applies. Without it the row showed the
    // typed number until the screen was reloaded, and the user had no way to
    // tell that something else had been stored.
    const nextValue =
      field === "note"
        ? value === "" ? null : value
        : isClampedSetField(field)
          ? clampSetValue(field, value)
          : value === "" ? null : Number(value);

    setLocalSets((prev) =>
      prev.map((set) =>
        set.sets_id === setId ? { ...set, [field]: nextValue } : set
      )
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId ? { ...prev, [field]: nextValue } : prev
    );

    const result = await weightliftingService.updateSetField(db, {
      field,
      value: nextValue,
      setId,
    });

    applyPersonalRecordSetIds(result?.personalRecordSetIds);
    updateUI();
  };

  const updateRestPause = async (value, setId) => {
    if (!isPersistedSet(setId)) {
      return;
    }

    if (!mirrorRestValues) {
      await updateField("pause", value, setId);
      return;
    }

    const nextValue = clampSetValue("pause", value);
    const mirroredSetIds = displayedSets
      .map((set) => set.sets_id)
      .filter((id) => id !== null && id !== undefined);

    setLocalSets((prev) =>
      prev.map((set) => ({ ...set, pause: nextValue }))
    );

    set_selectedSet((prev) =>
      prev ? { ...prev, pause: nextValue } : prev
    );

    await Promise.all(
      mirroredSetIds.map((mirroredSetId) =>
        weightliftingService.updateSetField(db, {
          field: "pause",
          value: nextValue,
          setId: mirroredSetId,
        })
      )
    );

    updateUI();
  };

  const updateRmPercentage = async (value, setId) => {
    if (!isPersistedSet(setId)) {
      return;
    }

    const result = await weightliftingService.updateSetRmPercentage(db, {
      setId,
      rmPercentage: value,
    });

    setLocalSets((prev) =>
      prev.map((set) => {
        if (set.sets_id !== setId) {
          return set;
        }

        return {
          ...set,
          rm_percentage: result.rmPercentage,
          ...(result.weightUpdated ? { weight: result.weight } : {}),
        };
      })
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId
        ? {
            ...prev,
            rm_percentage: result.rmPercentage,
            ...(result.weightUpdated ? { weight: result.weight } : {}),
          }
        : prev
    );

    applyPersonalRecordSetIds(result.personalRecordSetIds);
    updateUI();
  };

  const updateWeight = async (value, setId) => {
    if (!isPersistedSet(setId)) {
      return;
    }

    const result = await weightliftingService.updateSetWeight(db, {
      setId,
      weight: value,
    });

    setLocalSets((prev) =>
      prev.map((set) =>
        set.sets_id === setId
          ? {
              ...set,
              weight: result.weight,
              rm_percentage: result.rmPercentage,
            }
          : set
      )
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId
        ? {
            ...prev,
            weight: result.weight,
            rm_percentage: result.rmPercentage,
          }
        : prev
    );

    applyPersonalRecordSetIds(result.personalRecordSetIds);
    updateUI();
  };

  const handleOpenSetOptions = (set) => {
    set_selectedSet(set);
    setSelectedSetNote(set.note ?? "");
    setSetOptionsVisible(true);
  };

  const persistSelectedSetNote = async () => {
    if (!selectedSet) {
      return;
    }

    const currentNote = selectedSet.note ?? "";

    if (selectedSetNote === currentNote) {
      return;
    }

    await updateField("note", selectedSetNote, selectedSet.sets_id);
  };

  const handleCloseSetOptions = async () => {
    await persistSelectedSetNote();
    setSetOptionsVisible(false);
  };

  const renderEditableValue = ({
    cellKey,
    containerStyle,
    onFocus,
    onBlur,
    ...props
  }) => {
    const isActive = activeEditableCell === cellKey;

    return (
      <View
        style={[
          styles.valuePill,
          containerStyle,
          {
            backgroundColor: isActive ? cellSurface : "transparent",
            borderColor: isActive ? cellBorder : "transparent",
          },
        ]}
      >
        <ThemedEditableCell
          {...props}
          onFocus={(event) => {
            setActiveEditableCell(cellKey);
            onFocus?.(event);
          }}
          onBlur={() => {
            setActiveEditableCell((currentCell) =>
              currentCell === cellKey ? null : currentCell
            );
            onBlur?.();
          }}
        />
      </View>
    );
  };

  const renderCellContent = (key, set, rowIndex) => {
    const setType = labelBySetId.get(set.sets_id)?.type ?? resolveSetType(set);
    const typeColor = setTypeColor(setType, theme);

    switch (key) {
      case "note":
        return set.note ? (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.note_button}
            onPress={() => {
              setNoteModalText(set.note);
              setNoteModalVisible(true);
            }}
          >
            <Note width={18} height={18} />
          </TouchableOpacity>
        ) : null;

      case "rest":
        // A drop set continues the set above it: a line joins the two where
        // the rest between them would otherwise sit.
        return setType === "drop" && rowIndex > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.dropConnector, { backgroundColor: theme.dropSet }]}
          />
        ) : null;

      case "set": {
        const isPersonalRecord = isPersonalRecordSet(set);
        const isTyped = isToneRow(setType);
        const label =
          labelBySetId.get(set.sets_id)?.label ?? String(set.set_number ?? "");

        return (
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t("workout.setType.badge", { label })}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[
              styles.set_chip,
              isPersonalRecord
                ? styles.set_chip_record
                : isTyped
                  ? {
                      backgroundColor: withAlpha(typeColor, 0.16),
                      borderColor: withAlpha(typeColor, 0.45),
                    }
                  : {
                      backgroundColor: setChipBackground,
                      borderColor: cellBorder,
                    },
            ]}
            onPress={() => handleOpenSetOptions(set)}
            onLongPress={() => handleOpenSetOptions(set)}
            delayLongPress={300}
          >
            {isPersonalRecord ? (
              <View style={styles.set_chip_star} pointerEvents="none">
                <Star
                  width={40}
                  height={40}
                  color={personalRecordStarColor}
                  filled
                  roundness={2.2}
                />
              </View>
            ) : null}

            <ThemedText
              style={[
                styles.set_chip_text,
                isPersonalRecord && styles.set_chip_text_record,
              ]}
              setColor={
                isPersonalRecord
                  ? personalRecordStarTextColor
                  : isTyped
                    ? typeColor
                    : setChipTextColor
              }
            >
              {label}
            </ThemedText>

            {setType === "amrap" && !isPersonalRecord ? (
              <View style={styles.set_chip_amrap} pointerEvents="none">
                <Amrap width={11} height={11} color={typeColor} />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      }

      case "reps": {
        const isAmrap = setType === "amrap";
        const target =
          Number(set.amrap_target) > 0 ? Number(set.amrap_target) : null;

        return renderEditableValue({
          cellKey: `${set.sets_id}:reps`,
          value: set.reps?.toString() ?? "",
          // "9/6+": nine done against a target of six or more.
          suffix: isAmrap ? (target ? `/${target}+` : "AMRAP") : "",
          suffixStyle: isAmrap
            ? [styles.typeNote, { color: theme.amrap }]
            : undefined,
          showSuffixWhenEmpty: isAmrap,
          onCommit: (value) => updateField("reps", value, set.sets_id),
        });
      }

      case "rpe":
        return renderEditableValue({
          cellKey: `${set.sets_id}:rpe`,
          value: set.rpe?.toString() ?? "",
          onCommit: (value) => updateField("rpe", value, set.sets_id),
        });

      case "rm_percentage":
        return renderEditableValue({
          cellKey: `${set.sets_id}:rm_percentage`,
          value: set.rm_percentage?.toString() ?? "",
          suffix: "%",
          onCommit: (value) => updateRmPercentage(value, set.sets_id),
        });

      case "weight": {
        const parentWeight = dropParentWeight(displayedSets, rowIndex);
        const weight = parseWeight(set.weight);
        const drop =
          parentWeight !== null && weight !== null ? parentWeight - weight : null;

        return renderEditableValue({
          cellKey: `${set.sets_id}:weight`,
          value: set.weight?.toString() ?? "",
          suffix: "kg",
          // How far it dropped from the set above: "70 kg -17,5".
          trailing:
            drop > 0 ? (
              <ThemedText
                style={[styles.typeNote, styles.dropDifference]}
                setColor={theme.dropSet}
                numberOfLines={1}
              >
                {`\u2212${formatNumber(drop, { maximumFractionDigits: 2 })}`}
              </ThemedText>
            ) : null,
          onCommit: (value) => updateWeight(value, set.sets_id),
        });
      }

      case "done": {
        const isPersonalRecord = isPersonalRecordSet(set);

        return (
          <ThemedBouncyCheckbox
            accessibilityLabel={t("workout.setList.setDone", { number: set.set_number })}
            value={Number(set.done) === 1 || Number(set.failed) === 1}
            onChange={() =>
              onToggleSet(set.sets_id, getNextSetCompletion(set), set)
            }
            size={18}
            edgeSize={2}
            checkmarkColor={
              isPersonalRecord ? personalRecordControlText : theme.cardBackground
            }
            fillColor={
              Number(set.failed) === 1
                ? theme.danger
                : isPersonalRecord
                  ? personalRecordControlFill
                  : setType === "warmup"
                    ? theme.warmup
                    : undefined
            }
          />
        );
      }

      default:
        return null;
    }
  };

  const renderAddSetCell = (key) => {
    const actions = [];

    if (key === "set") {
      actions.push(
        <TouchableOpacity
          key="add-set"
          activeOpacity={0.72}
          style={styles.addSetIconCell}
          onPress={onAddSet}
        >
          <Plus width={18} height={18} color={addSetColor} />
        </TouchableOpacity>
      );
    }

    if (key === settingsColumnKey) {
      actions.push(
        <TouchableOpacity
          key="settings"
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={t("workout.exercise.openSettings")}
          style={styles.addSetIconCell}
          onPress={onOpenSettings}
        >
          <Cogwheel width={17} height={17} color={exerciseActionColor} />
        </TouchableOpacity>
      );
    }

    return actions.length > 0 ? (
      <View style={styles.addSetActions}>{actions}</View>
    ) : null;
  };

  const handleSetRowLayout = (setId, event) => {
    const { y, height } = event.nativeEvent.layout;

    setSetRowLayouts((prev) => {
      const current = prev[setId];

      if (
        current &&
        Math.abs(current.y - y) < 0.5 &&
        Math.abs(current.height - height) < 0.5
      ) {
        return prev;
      }

      return {
        ...prev,
        [setId]: { y, height },
      };
    });
  };

  const getRestTimerState = (setId) => {
    const isActive = Number(activeRestTimer?.setId) === Number(setId);
    const isComplete =
      !isActive && Number(completedRestTimer?.setId) === Number(setId);

    return {
      isActive,
      isComplete,
      remainingSeconds: isActive
        ? Math.max(0, activeRestTimer.endsAt - restTimerTick)
        : 0,
    };
  };

  const renderRestDivider = (set, renderedColumns, rowIndex) => {
    const rowLayout = setRowLayouts[set.sets_id];

    if (!rowLayout) {
      return null;
    }

    // Straight into a drop set there is no rest; the connector stands in.
    if (
      rowIndex + 1 < displayedSets.length &&
      resolveSetType(displayedSets[rowIndex + 1]) === "drop"
    ) {
      return null;
    }

    // Warm-up rows are measured inside their own block, so they are placed
    // from its top. Folded, only the rest after the last one is left, under
    // the single row that stands for them all.
    let rowBottom = rowLayout.y + rowLayout.height;

    if (rowIndex < warmupSets.length) {
      if (warmupsShownFolded) {
        if (rowIndex !== warmupSets.length - 1) {
          return null;
        }

        rowBottom = warmupBlockY + foldedRowHeight;
      } else {
        rowBottom += warmupBlockY;
      }
    }

    return (
      <View
        key={`${set.sets_id}:rest-divider`}
        pointerEvents="box-none"
        style={[
          styles.container,
          styles.restDividerOverlayRow,
          {
            height: REST_DIVIDER_BUBBLE_SIZE,
            top: rowBottom - REST_DIVIDER_BUBBLE_SIZE / 2,
          },
        ]}
      >
        {renderedColumns.map((col, colIndex) => {
          const isLast = colIndex === renderedColumns.length - 1;
          const restTimerState = getRestTimerState(set.sets_id);
          const restBorderColor = restTimerState.isActive
            ? primaryColor
            : restTimerState.isComplete
              ? secondaryColor
              : tableBorder;

          return (
            <View
              pointerEvents="box-none"
              key={`${set.sets_id}:rest-divider:${col.key}`}
              style={[
                styles.restDividerOverlayCell,
                styles.padding,
                col.style,
                col.mergedStyle,
                isLast && { borderRightWidth: 0 },
              ]}
            >
              {col.key === "rest" ? (
                <View
                  style={[
                    styles.restDividerBubble,
                    {
                      backgroundColor: cellSurface,
                      borderColor: restBorderColor,
                    },
                  ]}
                >
                  {restTimerState.isActive ? (
                    <View
                      style={[
                        styles.restDividerValuePill,
                        styles.restCountdownPill,
                      ]}
                    >
                      <ThemedText
                        style={styles.restCountdownText}
                        setColor={setChipTextColor}
                      >
                        {formatTime(restTimerState.remainingSeconds)}
                      </ThemedText>
                    </View>
                  ) : (
                    renderEditableValue({
                      cellKey: `${set.sets_id}:rest-divider`,
                      containerStyle: styles.restDividerValuePill,
                      value: formatRestUnitValue(set.pause),
                      suffixFormatter: getPauseSuffix,
                      onCommit: (value) =>
                        updateRestPause(getStoredPauseValue(value), set.sets_id),
                    })
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const renderSetRow = (set, rowIndex) => {
    const renderedColumns = getRenderedColumns(set);
    const setType = labelBySetId.get(set.sets_id)?.type ?? "working";
    const toneColor = isToneRow(setType) ? setTypeColor(setType, theme) : null;

    return (
      <View
        key={set.sets_id}
        onLayout={(event) => handleSetRowLayout(set.sets_id, event)}
        style={[
          styles.container,
          styles.setRow,
          {
            borderBottomColor: tableBorder,
          },
          rowIndex === displayedSets.length - 1 && styles.lastGrid,
        ]}
      >
        {toneColor ? (
          <View
            pointerEvents="none"
            style={[
              styles.rowTone,
              {
                backgroundColor: withAlpha(toneColor, 0.055),
                borderLeftColor: toneColor,
              },
            ]}
          />
        ) : null}

        {renderedColumns.map((col, colIndex) => {
          const isLast = colIndex === renderedColumns.length - 1;

          return (
            <View
              key={col.key}
              style={[
                styles.editable_cell,
                styles.padding,
                col.style,
                col.mergedStyle,
                {
                  borderColor: tableBorder,
                },
                isLast && { borderRightWidth: 0 },
              ]}
            >
              {renderCellContent(col.key, set, rowIndex)}
            </View>
          );
        })}
      </View>
    );
  };

  // The one row the warm-ups fold into: the last of them, a stacked badge to
  // say there are more, and a chevron where the tick was.
  const renderFoldedWarmupCell = (key, set, label) => {
    const warmupColor = theme.warmup;

    if (key === "set") {
      return (
        <View style={styles.foldedBadgeStack}>
          <View
            style={[
              styles.set_chip,
              styles.foldedBadgeBehind,
              {
                backgroundColor: withAlpha(warmupColor, 0.1),
                borderColor: withAlpha(warmupColor, 0.25),
              },
            ]}
          />
          <View
            style={[
              styles.set_chip,
              {
                backgroundColor: withAlpha(warmupColor, 0.16),
                borderColor: withAlpha(warmupColor, 0.45),
              },
            ]}
          >
            <ThemedText style={styles.set_chip_text} setColor={warmupColor}>
              {label}
            </ThemedText>
          </View>
        </View>
      );
    }

    if (key === "reps") {
      const reps = parseWeight(set?.reps);

      return reps === null ? null : (
        <ThemedText style={styles.foldedValue} setColor={theme.title}>
          {reps}
        </ThemedText>
      );
    }

    if (key === "weight") {
      const weight = parseWeight(set?.weight);

      return weight === null ? null : (
        <ThemedText style={styles.foldedValue} setColor={theme.title} numberOfLines={1}>
          {formatNumber(weight, { maximumFractionDigits: 2 })}
          <ThemedText style={styles.foldedUnit} setColor={theme.quietText}>
            {` ${t("common.kg")}`}
          </ThemedText>
        </ThemedText>
      );
    }

    if (key === "done") {
      return <Expand width={16} height={16} color={warmupColor} />;
    }

    return null;
  };

  // Above the open warm-ups: what they are, and the way to fold them.
  const renderWarmupHeader = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t("workout.setType.foldWarmups")}
      onPress={foldWarmupsByHand}
      style={[styles.warmupHeader, { borderBottomColor: tableBorder }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.rowTone,
          {
            backgroundColor: withAlpha(theme.warmup, 0.055),
            borderLeftColor: theme.warmup,
          },
        ]}
      />
      <ThemedText style={styles.warmupHeaderText} setColor={theme.warmup} numberOfLines={1}>
        {t("workout.setType.warmupCount", { count: warmupSets.length })}
      </ThemedText>
      <View style={styles.warmupHeaderChevron}>
        <Expand width={14} height={14} color={theme.warmup} />
      </View>
    </TouchableOpacity>
  );

  const renderFoldedWarmups = () => {
    const lastWarmup = warmupSets[warmupSets.length - 1];
    const label = labelBySetId.get(lastWarmup?.sets_id)?.label ?? "";
    const warmupsAreEverything = warmupSets.length === displayedSets.length;

    return (
      <ReanimatedAnimated.View
        onLayout={(event) => setFoldedRowHeight(event.nativeEvent.layout.height)}
        pointerEvents={warmupsShownFolded ? "auto" : "none"}
        style={[styles.foldedWarmups, foldedWarmupsStyle]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("workout.setType.warmupsFolded", {
            count: warmupSets.length,
          })}
          onPress={openWarmupsByHand}
          style={[
            styles.container,
            styles.setRow,
            { borderBottomColor: tableBorder },
            warmupsAreEverything && styles.lastGrid,
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.rowTone,
              {
                backgroundColor: withAlpha(theme.warmup, 0.055),
                borderLeftColor: theme.warmup,
              },
            ]}
          />

          {activeColumns.map((col, colIndex) => (
            <View
              key={col.key}
              style={[
                styles.editable_cell,
                styles.padding,
                col.style,
                { borderColor: tableBorder },
                colIndex === activeColumns.length - 1 && { borderRightWidth: 0 },
              ]}
            >
              {renderFoldedWarmupCell(col.key, lastWarmup, label)}
            </View>
          ))}
        </TouchableOpacity>
      </ReanimatedAnimated.View>
    );
  };

  const selectedLabel = selectedSet
    ? labelBySetId.get(selectedSet.sets_id)?.label ??
      String(selectedSet.set_number ?? "")
    : "";

  return (
    <>
      <ThemedCard
        collapsable={false}
        style={[
          styles.wrapper,
          {
            backgroundColor: tableSurface,
            borderColor: tableBorder,
          },
        ]}
      >
        {hasSets && (
          <Title
            visibleColumns={renderedVisibleColumns}
          />
        )}

        {warmupSets.length > 0 ? (
          <ReanimatedAnimated.View
            onLayout={(event) => setWarmupBlockY(event.nativeEvent.layout.y)}
            style={[styles.warmupBlock, warmupBlockStyle]}
          >
            <ReanimatedAnimated.View
              onLayout={(event) =>
                setWarmupContentHeight(event.nativeEvent.layout.height)
              }
              pointerEvents={warmupsShownFolded ? "none" : "auto"}
              style={warmupRowsStyle}
            >
              {canFoldWarmups ? renderWarmupHeader() : null}
              {warmupSets.map((set, rowIndex) => renderSetRow(set, rowIndex))}
            </ReanimatedAnimated.View>

            {canFoldWarmups ? renderFoldedWarmups() : null}
          </ReanimatedAnimated.View>
        ) : null}

        {displayedSets
          .slice(warmupSets.length)
          .map((set, index) => renderSetRow(set, warmupSets.length + index))}

        <View
          style={[
            styles.container,
            styles.setRow,
            styles.addSetRow,
            {
              borderColor: tableBorder,
            },
          ]}
        >
          {activeColumns.map((col, colIndex) => {
            const isLast = colIndex === activeColumns.length - 1;

            return (
              <View
                key={`add-set-${col.key}`}
                style={[
                  styles.editable_cell,
                  styles.padding,
                  col.style,
                  {
                    borderColor: tableBorder,
                  },
                  isLast && { borderRightWidth: 0 },
                ]}
              >
                {renderAddSetCell(col.key)}
              </View>
            );
          })}
        </View>

        {showRestForSets &&
          !warmupsAnimating &&
          displayedSets.map((set, rowIndex) =>
            renderRestDivider(set, getRenderedColumns(set), rowIndex)
          )}
      </ThemedCard>

      {pendingDelete ? (
        <View
          style={[
            styles.undoToast,
            {
              backgroundColor: theme.cardBackground ?? cellSurface,
              borderColor: tableBorder,
            },
          ]}
        >
          <ThemedText
            style={styles.undoToastText}
            setColor={theme.title}
            numberOfLines={1}
          >
            {t("workout.setType.deleted", { label: pendingDelete.label })}
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            hitSlop={10}
            onPress={undoPendingDelete}
          >
            <ThemedText style={styles.undoToastAction} setColor={primaryTextColor}>
              {t("workout.setType.undo")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      <SetTypeSheet
        visible={setOptionsVisible}
        onClose={handleCloseSetOptions}
        label={selectedLabel}
        exerciseName={exerciseName}
        setType={selectedSet ? resolveSetType(selectedSet) : "working"}
        amrapTarget={
          Number(selectedSet?.amrap_target) > 0
            ? Number(selectedSet.amrap_target)
            : null
        }
        onSelectType={changeSelectedSetType}
        onChangeAmrapTarget={changeSelectedAmrapTarget}
        onDelete={deleteSelectedSet}
        note={selectedSetNote}
        onChangeNote={setSelectedSetNote}
        onEndEditingNote={persistSelectedSetNote}
      />

      <ThemedModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        title={t("workout.note.title")}
      >
        <ThemedText>{noteModalText}</ThemedText>
      </ThemedModal>

      <ThemedModal
        visible={restUnitModalVisible}
        onClose={() => setRestUnitModalVisible(false)}
        title={t("workout.setList.restModal.title")}
        style={styles.restUnitModal}
        contentStyle={styles.restUnitModalContent}
      >
        <View style={styles.restSettingsSection}>
          <ThemedText
            style={styles.restSettingsLabel}
            setColor={theme.quietText}
          >
            {t("workout.setList.restModal.unit")}
          </ThemedText>

          <View
            style={[
              styles.restUnitToggle,
              {
                backgroundColor: restSettingsFieldSurface,
                borderColor: restUnitBorderColor,
              },
            ]}
          >
            {[
              {
                unit: REST_UNIT_MINUTES,
                label: t("workout.setList.restModal.minutes"),
              },
              {
                unit: REST_UNIT_SECONDS,
                label: t("workout.setList.restModal.seconds"),
              },
            ].map((option) => {
              const selected = restUnit === option.unit;

              return (
                <TouchableOpacity
                  key={option.unit}
                  activeOpacity={0.82}
                  style={[
                    styles.restUnitOption,
                    selected && { backgroundColor: secondaryColor },
                  ]}
                  onPress={() => {
                    setRestUnit(option.unit);
                  }}
                >
                  <ThemedText
                    style={styles.restUnitOptionText}
                    setColor={selected ? selectedRestUnitTextColor : theme.text}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.restSettingsSection}>
          <ThemedText
            style={styles.restSettingsLabel}
            setColor={theme.quietText}
          >
            {t("workout.setList.restModal.apply")}
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.restMirrorButton,
              {
                backgroundColor: restSettingsFieldSurface,
                borderColor: restUnitBorderColor,
              },
            ]}
            onPress={() => setMirrorRestValues((prev) => !prev)}
          >
            <View style={styles.restMirrorTextGroup}>
              <ThemedText style={styles.restMirrorTitle}>
                {t("workout.setList.restModal.mirror")}
              </ThemedText>
              <ThemedText
                style={styles.restMirrorDescription}
                setColor={theme.quietText}
              >
                {t("workout.setList.restModal.mirrorDetail")}
              </ThemedText>
            </View>

            <View
              style={[
                styles.restMirrorSwitch,
                {
                  backgroundColor: mirrorRestValues
                    ? secondaryColor
                    : restUnitBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.restMirrorSwitchThumb,
                  mirrorRestValues && styles.restMirrorSwitchThumbActive,
                  { backgroundColor: selectedRestUnitTextColor },
                ]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ThemedModal>
    </>
  );
};

export default SetList;
