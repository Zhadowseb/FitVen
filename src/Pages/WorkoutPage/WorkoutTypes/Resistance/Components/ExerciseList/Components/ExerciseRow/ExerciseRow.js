import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { Colors, withAlpha } from "../../../../../../../../Resources/GlobalStyling/colors";
import styles from "./ExerciseRowStyle.js";
import SetList from "./SetList/SetList";

import Note from "../../../../../../../../Resources/Icons/UI-icons/Note";
import Expand from "../../../../../../../../Resources/Icons/UI-icons/Expand";
import Plus from "../../../../../../../../Resources/Icons/UI-icons/Plus";
import ReplayHistory from "../../../../../../../../Resources/Icons/UI-icons/ReplayHistory";

import {
  ThemedConfirmModal,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../../../../../../Resources/ThemedComponents";
import PanelSettingsModal from "./PanelSettingsModal";
import { weightliftingService as weightliftingRepository } from "../../../../../../../../Services";
import { useExerciseViewSettings } from "../../../../../../../../Contexts/ExerciseViewSettingsContext";
import ReanimatedAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { EXERCISE_COLLAPSE_DURATION_MS } from "../../exerciseCollapseAnimation";
import CollapsedSetSummary, {
  ClassicSetSummary,
  SetProgressDots,
  isPersonalRecordSet,
} from "./CollapsedSetSummary";

const REORDER_LONG_PRESS_DELAY_MS = 320;
const REORDER_MOVE_CANCEL_DISTANCE = 10;
const PRESS_SUPPRESSION_MS = 250;

const ExerciseRow = ({
  exercise,
  isExpanded,
  onToggleExpanded,
  onAddSet,
  updateUI,
  onToggleSet,
  updateWeight,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWorkoutMetadataChange,
  collapsedSetsVisible = true,
  collapsedCardLayout = "compact",
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [visibleColumns, setVisibleColumns] = useState(exercise.visibleColumns);
  const [exerciseNote, setExerciseNote] = useState(exercise.note ?? "");
  const [panelModalVisible, setPanelModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyDetailsExpanded, setHistoryDetailsExpanded] = useState(false);
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [addingSet, setAddingSet] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [restUnitRequestKey, setRestUnitRequestKey] = useState(0);
  // The expanded section stays mounted until the collapse has played out, and
  // its height is animated directly instead of relying on layout animations.
  const [isSectionMounted, setIsSectionMounted] = useState(isExpanded);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const expandProgress = useSharedValue(isExpanded ? 1 : 0);
  const addingSetRef = useRef(false);
  const dragActiveRef = useRef(false);
  const dragStartPageYRef = useRef(null);
  const latestTouchPageYRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const pressSuppressionTimeoutRef = useRef(null);
  const suppressNextPressRef = useRef(false);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);

  const db = useSQLiteContext();
  const { collapsedExerciseView } = useExerciseViewSettings();
  const usesClassicCollapsedCard = collapsedCardLayout === "classic";

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd, onDragMove, onDragStart]);

  const getTouchPageY = (event) => {
    const nativeEvent = event?.nativeEvent;
    const touch = nativeEvent?.touches?.[0] ?? nativeEvent?.changedTouches?.[0];
    const pageY = nativeEvent?.pageY ?? touch?.pageY;

    return typeof pageY === "number" ? pageY : null;
  };

  const clearLongPressTimeout = () => {
    if (!longPressTimeoutRef.current) {
      return;
    }

    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  };

  const clearPressSuppressionTimeout = () => {
    if (!pressSuppressionTimeoutRef.current) {
      return;
    }

    clearTimeout(pressSuppressionTimeoutRef.current);
    pressSuppressionTimeoutRef.current = null;
  };

  const markNextPressSuppressed = () => {
    suppressNextPressRef.current = true;
    clearPressSuppressionTimeout();
    pressSuppressionTimeoutRef.current = setTimeout(() => {
      suppressNextPressRef.current = false;
      pressSuppressionTimeoutRef.current = null;
    }, PRESS_SUPPRESSION_MS);
  };

  const shouldIgnorePressAfterDrag = () => {
    if (!suppressNextPressRef.current) {
      return false;
    }

    suppressNextPressRef.current = false;
    clearPressSuppressionTimeout();
    return true;
  };

  const handleCardPress = (handler) => {
    if (shouldIgnorePressAfterDrag()) {
      return;
    }

    handler?.();
  };

  const updateCardDragPosition = (pageY) => {
    const startPageY = dragStartPageYRef.current;

    if (
      !dragActiveRef.current ||
      typeof pageY !== "number" ||
      typeof startPageY !== "number"
    ) {
      return;
    }

    onDragMoveRef.current?.(pageY - startPageY);
  };

  const startCardDrag = () => {
    longPressTimeoutRef.current = null;

    if (!onDragStartRef.current || dragActiveRef.current) {
      return;
    }

    const didStart = onDragStartRef.current() !== false;

    if (!didStart) {
      dragStartPageYRef.current = null;
      latestTouchPageYRef.current = null;
      return;
    }

    dragActiveRef.current = true;
    updateCardDragPosition(latestTouchPageYRef.current);
  };

  const finishCardDrag = () => {
    clearLongPressTimeout();

    if (dragActiveRef.current) {
      onDragEndRef.current?.();
      markNextPressSuppressed();
    }

    dragActiveRef.current = false;
    dragStartPageYRef.current = null;
    latestTouchPageYRef.current = null;
  };

  const handleCardTouchStart = (event) => {
    if (!onDragStartRef.current) {
      return;
    }

    const pageY = getTouchPageY(event);
    dragStartPageYRef.current = pageY;
    latestTouchPageYRef.current = pageY;
    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(
      startCardDrag,
      REORDER_LONG_PRESS_DELAY_MS
    );
  };

  const handleCardTouchMove = (event) => {
    const pageY = getTouchPageY(event);

    if (typeof pageY !== "number") {
      return;
    }

    latestTouchPageYRef.current = pageY;

    if (!dragActiveRef.current) {
      const startPageY = dragStartPageYRef.current;

      if (
        typeof startPageY === "number" &&
        Math.abs(pageY - startPageY) > REORDER_MOVE_CANCEL_DISTANCE
      ) {
        clearLongPressTimeout();
      }

      return;
    }

    updateCardDragPosition(pageY);
  };

  const stopCardDragPropagation = (event) => {
    event?.stopPropagation?.();
  };

  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => dragActiveRef.current,
        onMoveShouldSetPanResponderCapture: () => dragActiveRef.current,
        onPanResponderMove: (event) => {
          updateCardDragPosition(getTouchPageY(event));
        },
        onPanResponderRelease: finishCardDrag,
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: finishCardDrag,
      }),
    []
  );

  useEffect(
    () => () => {
      clearLongPressTimeout();
      clearPressSuppressionTimeout();
    },
    []
  );

  useEffect(() => {
    setVisibleColumns(exercise.visibleColumns);
  }, [exercise.visibleColumns]);

  useEffect(() => {
    setExerciseNote(exercise.note ?? "");
  }, [exercise.note]);

  useEffect(() => {
    setHistoryVisible(false);
    setHistoryDetailsExpanded(false);
    setExerciseHistory(null);
    setHistoryLoadError(false);
  }, [exercise.exercise_id, exercise.exercise_name]);

  const deleteExercise = async (exerciseId) => {
    try {
      await weightliftingRepository.deleteExercise(db, exerciseId);
      await updateUI?.();
      await onWorkoutMetadataChange?.();
    } catch (error) {
      console.error(error);
    }
  };

  const confirmDeleteExercise = () => {
    setDeleteConfirmVisible(true);
  };

  const addSet = async () => {
    if (addingSetRef.current) {
      return;
    }

    try {
      addingSetRef.current = true;
      setAddingSet(true);
      // The list owns the exercise state, so it inserts the row optimistically
      // and reconciles afterwards; nothing here waits for the database.
      await onAddSet?.(exercise.exercise_id);
    } catch (error) {
      console.error(error);
    } finally {
      addingSetRef.current = false;
      setAddingSet(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      setIsSectionMounted(true);
      expandProgress.value = withTiming(1, {
        duration: EXERCISE_COLLAPSE_DURATION_MS,
      });
      return;
    }

    expandProgress.value = withTiming(
      0,
      { duration: EXERCISE_COLLAPSE_DURATION_MS },
      (finished) => {
        if (finished) {
          runOnJS(setIsSectionMounted)(false);
        }
      }
    );
  }, [expandProgress, isExpanded]);

  const expandedSectionStyle = useAnimatedStyle(() => ({
    height: expandedHeight > 0 ? expandProgress.value * expandedHeight : undefined,
    opacity: expandProgress.value,
  }));

  // Removing the last set leaves nothing to show, so the card folds itself
  // back up. Only the >0 -> 0 transition counts: adding the first set expands
  // the card while the count is still 0, and that must not collapse it again.
  const previousSetCountRef = useRef(exercise.sets.length);

  useEffect(() => {
    const setCount = exercise.sets.length;
    const previousSetCount = previousSetCountRef.current;
    previousSetCountRef.current = setCount;

    if (setCount === 0 && previousSetCount > 0 && isExpanded) {
      onToggleExpanded?.();
    }
  }, [exercise.sets.length, isExpanded, onToggleExpanded]);

  // Adding the first set from the collapsed header should also open the
  // exercise, so the user lands straight in the new set.
  const addFirstSetAndExpand = async () => {
    if (addingSetRef.current) {
      return;
    }

    if (!isExpanded) {
      onToggleExpanded?.();
    }

    await addSet();
  };

  const saveExerciseSettings = async ({ columns, note }) => {
    await weightliftingRepository.updateExerciseVisibleColumns(db, {
      exerciseId: exercise.exercise_id,
      columns,
    });
    await weightliftingRepository.updateExerciseNote(db, {
      exerciseId: exercise.exercise_id,
      note,
    });

    setVisibleColumns(columns);
    setExerciseNote(note);
  };

  const loadExerciseHistory = async () => {
    if (historyLoading) {
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryLoadError(false);

      const history = await weightliftingRepository.getExerciseHistory(db, {
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        limit: 3,
      });

      setExerciseHistory(history);
    } catch (error) {
      console.error("Error loading exercise history", error);
      setHistoryLoadError(true);
      setExerciseHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleExerciseHistory = () => {
    const nextValue = !historyVisible;
    setHistoryVisible(nextValue);

    if (nextValue && !exerciseHistory && !historyLoading) {
      loadExerciseHistory();
    }

    if (!nextValue) {
      setHistoryDetailsExpanded(false);
    }
  };

  const toggleHistoryDetails = () => {
    setHistoryDetailsExpanded((currentValue) => !currentValue);
  };

  const isDone = Number(exercise.done) === 1;
  const hasNote = exerciseNote.trim().length > 0;
  const trackerSetCount = exercise.sets.length;
  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary ?? primaryColor;
  const dangerColor = theme.danger ?? "#d94141";
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const setListSurface =
    colorScheme === "dark" ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const addSetColor = theme.iconColor ?? quietText;
  const titleColor = theme.title ?? theme.text;
  const replayIconColor = theme.primary ?? "#f7742eff";
  const recordColor = theme.record ?? Colors.dark.record ?? primaryColor;
  const recordLightColor =
    theme.recordLight ??
    Colors.dark.recordLight ??
    (colorScheme === "dark" ? "rgba(55, 63, 174, 0.38)" : "rgba(55, 63, 174, 0.16)");
  const recordDarkColor = theme.recordDark ?? Colors.dark.recordDark ?? recordColor;
  const hasPersonalRecord =
    Boolean(exercise.hasPersonalRecord) ||
    exercise.sets.some(
      (set) =>
        Number(set?.personal_record) === 1 &&
        Number(set?.done) === 1 &&
        Number(set?.failed) !== 1
    );
  const isRecordExercise = hasPersonalRecord;
  const recordExerciseTextColor =
    isRecordExercise && colorScheme === "light" ? recordLightColor : titleColor;
  const repeatBadgeBackground =
    withAlpha(theme.primary, colorScheme === "dark" ? 0.24 : 0.14);
  const repeatBadgeBorder =
    withAlpha(theme.primary, colorScheme === "dark" ? 0.36 : 0.24);
  const historyPanelSurface =
    colorScheme === "dark" ? "rgba(13, 15, 22, 0.78)" : "rgba(255, 255, 255, 0.72)";
  const historyChipSurface =
    colorScheme === "dark" ? "rgba(36, 41, 56, 0.92)" : "rgba(255, 255, 255, 0.88)";
  const historyChipBorder =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(32, 30, 43, 0.12)";
  const summaryBubbleBorderColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.24)" : "rgba(32, 30, 43, 0.2)";
  const exerciseIsDone = exercise.sets.length > 0 && exercise.sets.every((set) => Number(set?.done) === 1);
  const exerciseIsFailed = exercise.sets.length > 0 && exercise.sets.every((set) => Number(set?.failed) === 1);
  const exerciseCardBackground = isRecordExercise
    ? (colorScheme === "dark" ? "rgba(242,193,78,0.05)" : "rgba(192,138,18,0.05)")
    : exerciseIsDone ? withAlpha(secondaryColor, 0.07) : cardSurface;
  const exerciseCardBorderColor = isRecordExercise
    ? "rgba(242,193,78,0.45)"
    : exerciseIsDone ? withAlpha(secondaryColor, 0.35) : cardBorder;
  const exerciseTitleColor = exerciseIsFailed
    ? quietText
    : isRecordExercise ? (theme.planned ?? "#F2C14E")
      : exerciseIsDone ? secondaryColor : titleColor;
  const exerciseCheckboxFillColor = secondaryColor;
  const exerciseCheckboxCheckmarkColor = cardSurface;
  const setProgressTrackColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(32, 30, 43, 0.1)";
  const setProgressSegments =
    trackerSetCount > 0
      ? Array.from({ length: trackerSetCount }, (_, index) => {
          const set = exercise.sets[index];
          const isSetDone = Number(set?.done) === 1;
          const isSetFailed = Number(set?.failed) === 1;
          const isPersonalRecord =
            Number(set?.personal_record) === 1 &&
            isSetDone &&
            !isSetFailed;

          return {
            index,
            isFilled: isSetDone || isSetFailed,
            isFailed: isSetFailed,
            isPersonalRecord,
            left: (index / trackerSetCount) * 100,
            width: 100 / trackerSetCount,
          };
        })
      : [];
  const setProgressDividers =
    trackerSetCount > 1
      ? Array.from(
          { length: trackerSetCount - 1 },
          (_, index) => ((index + 1) / trackerSetCount) * 100
        )
      : [];

  const formatSummaryValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue.toString() : "-";
  };

  const collapsedSetSummaryItems = exercise.sets.map((set, index) => {
    const repsValue = Number(set.reps);
    const weightValue = Number(set.weight);
    const normalizedReps = Number.isFinite(repsValue) ? repsValue : null;
    const normalizedWeight = Number.isFinite(weightValue) ? weightValue : null;

    return {
      key: `${set.sets_id ?? "set"}-${index}`,
      reps: normalizedReps,
      weight: normalizedWeight,
    };
  });

  const historySessions = exerciseHistory?.sessions ?? [];
  const historySummaryText = historyLoading
    ? "Loading history"
    : exerciseHistory?.summaryText ?? "No previous sets";

  const renderHistoryContent = () => {
    if (historyLoading) {
      return (
        <View style={styles.historyStateRow}>
          <ActivityIndicator size="small" color={replayIconColor} />
          <ThemedText
            size={12}
            style={styles.historyStateText}
            setColor={quietText}
          >
            Loading history
          </ThemedText>
        </View>
      );
    }

    if (historyLoadError) {
      return (
        <ThemedText
          size={12}
          style={styles.historyEmptyText}
          setColor={quietText}
        >
          Could not load previous sets.
        </ThemedText>
      );
    }

    if (historySessions.length === 0) {
      return (
        <ThemedText
          size={12}
          style={styles.historyEmptyText}
          setColor={quietText}
        >
          No previous completed sets for this exercise.
        </ThemedText>
      );
    }

    return historySessions.map((session, sessionIndex) => (
      <View
        key={session.id}
        style={[
          styles.historySessionRow,
          sessionIndex === historySessions.length - 1 &&
            styles.historySessionRowLast,
        ]}
      >
        <View style={styles.historyDateColumn}>
          <ThemedText
            size={12}
            style={styles.historyRelativeDate}
            setColor={titleColor}
          >
            {session.relativeDateLabel ?? "--"}
          </ThemedText>
          <ThemedText
            size={9}
            style={styles.historyDate}
            setColor={quietText}
          >
            {session.dateDisplay}
          </ThemedText>
        </View>

        <View style={styles.historySetChips}>
          {session.sets.map((set) => (
            <View
              key={set.id}
              style={[
                styles.historySetChip,
                {
                  backgroundColor: historyChipSurface,
                  borderColor: historyChipBorder,
                },
              ]}
            >
              <ThemedText
                size={12}
                style={styles.historySetChipText}
                setColor={titleColor}
              >
                {set.reps}
              </ThemedText>
              <ThemedText
                size={11}
                style={styles.historySetChipSeparator}
                setColor={quietText}
              >
                x
              </ThemedText>
              <ThemedText
                size={12}
                style={styles.historySetChipText}
                setColor={titleColor}
              >
                {set.weightDisplay ?? `${set.weight} kg`}
              </ThemedText>
              {set.count > 1 && (
                <View
                  style={[
                    styles.historySetChipCount,
                    {
                      backgroundColor: repeatBadgeBackground,
                      borderColor: repeatBadgeBorder,
                    },
                  ]}
                >
                  <ThemedText
                    size={8}
                    style={styles.historySetChipCountText}
                    setColor={replayIconColor}
                  >
                    {set.count}
                  </ThemedText>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    ));
  };

  return (
    <>
      <View style={styles.exerciseCardFrame}>
        <View
          {...dragPanResponder.panHandlers}
          onTouchStart={handleCardTouchStart}
          onTouchMove={handleCardTouchMove}
          onTouchEnd={finishCardDrag}
          onTouchCancel={finishCardDrag}
          style={[
            styles.exerciseCard,
            isExpanded && styles.exerciseCardExpanded,
            {
              backgroundColor: exerciseCardBackground,
              borderColor: exerciseCardBorderColor,
            },
          ]}
        >
        <View
          collapsable={false}
          style={[
            styles.headerRow,
            isExpanded && styles.headerRowExpanded,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            // With no sets there is nothing to expand into: the plus is the
            // only way in, and it adds the first set as it opens the card.
            disabled={!isExpanded && exercise.sets.length === 0}
            onPress={() => handleCardPress(onToggleExpanded)}
            style={[
              styles.headerMain,
              isExpanded && styles.headerMainExpanded,
            ]}
          >
            <View
              style={[
                styles.titleBlock,
                isExpanded && styles.titleBlockExpanded,
              ]}
            >
              <ThemedTitle
                type="h3"
                style={[
                  styles.exerciseTitle,
                  isExpanded && styles.exerciseTitleExpanded,
                  { color: exerciseTitleColor, textDecorationLine: exerciseIsFailed ? "line-through" : "none" },
                ]}
                numberOfLines={1}
              >
                {exercise.exercise_name}
              </ThemedTitle>

            </View>
          </TouchableOpacity>

          <View
            onTouchStart={stopCardDragPropagation}
            style={[
              styles.actionsRow,
              isExpanded && styles.actionsRowExpanded,
            ]}
          >
            {hasNote && (
              <TouchableOpacity
                activeOpacity={0.88}
                hitSlop={10}
                style={styles.actionButton}
                onPress={() => setNoteModalVisible(true)}
              >
                <Note width={18} height={18} color={primaryTextColor} />
              </TouchableOpacity>
            )}

            {isExpanded && (
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Toggle exercise history summary"
                hitSlop={10}
                style={styles.actionButton}
                onPress={toggleExerciseHistory}
              >
                <ReplayHistory width={18} height={18} color={replayIconColor} />
              </TouchableOpacity>
            )}

            {!isExpanded && (
              <>
                <SetProgressDots sets={exercise.sets} theme={theme} />
                {exercise.sets.length === 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Add first set"
                    disabled={addingSet}
                    onPress={() => handleCardPress(addFirstSetAndExpand)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.collapsedExpandButton}
                  >
                    {addingSet ? (
                      <ActivityIndicator size="small" color={primaryTextColor} />
                    ) : (
                      <Plus
                        width={18}
                        height={18}
                        color={primaryTextColor}
                        thickness={2.4}
                      />
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Expand exercise"
                    onPress={() => handleCardPress(onToggleExpanded)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.collapsedExpandButton}
                  >
                    <Expand width={18} height={18} color={primaryTextColor} />
                  </TouchableOpacity>
                )}
              </>
            )}

          </View>
        </View>

        {historyVisible && (
          <View style={styles.historySection}>
            <TouchableOpacity
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Toggle exercise history details"
              onPress={() => handleCardPress(toggleHistoryDetails)}
              style={[
                styles.historySummaryBar,
                {
                  backgroundColor: setListSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.historySummaryMain}>
                <ReplayHistory width={14} height={14} color={replayIconColor} />
                <ThemedText
                  size={10}
                  style={styles.historySummaryLabel}
                  setColor={quietText}
                >
                  LAST
                </ThemedText>
                <ThemedText
                  size={12}
                  style={styles.historySummaryValue}
                  setColor={titleColor}
                  numberOfLines={1}
                >
                  {historySummaryText}
                </ThemedText>
              </View>

              <View style={styles.historySummaryMeta}>
                {exerciseHistory?.latestRelativeDateLabel && (
                  <ThemedText
                    size={10}
                    style={styles.historySummaryDate}
                    setColor={quietText}
                  >
                    {exerciseHistory.latestRelativeDateLabel}
                  </ThemedText>
                )}

                <View
                  style={[
                    styles.historyChevron,
                    historyDetailsExpanded && styles.historyChevronExpanded,
                  ]}
                >
                  <Expand width={14} height={14} color={quietText} />
                </View>
              </View>
            </TouchableOpacity>

            {historyDetailsExpanded && (
              <View
                style={[
                  styles.historyPanel,
                  {
                    backgroundColor: historyPanelSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                {renderHistoryContent()}
              </View>
            )}
          </View>
        )}

        {!isExpanded && collapsedSetsVisible && exercise.sets.length > 0 && (
          <View style={styles.summaryCollapsedRow}>
            <TouchableOpacity activeOpacity={0.88} onPress={() => handleCardPress(onToggleExpanded)} style={styles.summaryRow}>
              <View style={styles.summaryTextBlock}>
                {usesClassicCollapsedCard ? (
                  <ClassicSetSummary sets={exercise.sets} theme={theme} />
                ) : (
                  <CollapsedSetSummary
                    sets={exercise.sets}
                    view={collapsedExerciseView}
                    theme={theme}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* legacy collapsed markup removed */}
        {false && (
          <View style={styles.summaryCollapsedRow}>
            {collapsedSetSummaryItems.length === 0 ? (
              <View
                onTouchStart={stopCardDragPropagation}
                style={styles.firstSetActionSlot}
              >
                <TouchableOpacity
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Add first set"
                  disabled={addingSet}
                  onPress={addSet}
                  style={[
                    styles.firstSetButton,
                    addingSet && styles.firstSetButtonDisabled,
                  ]}
                >
                  {addingSet ? (
                    <ActivityIndicator size="small" color={addSetColor} />
                  ) : (
                    <>
                      <Plus width={17} height={17} color={addSetColor} />
                      <ThemedText
                        size={11}
                        style={styles.firstSetButtonText}
                        setColor={addSetColor}
                      >
                        Add first set
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => handleCardPress(onToggleExpanded)}
                style={styles.summaryRow}
              >
                <View style={styles.summaryTextBlock}>
                  <View style={styles.summaryChipRow}>
                    {collapsedSetSummaryItems.map((item, index) => {
                      return (
                        <View
                          key={item.key}
                          onLayout={({ nativeEvent }) =>
                            handleSummarySetLayout(index, nativeEvent.layout)
                          }
                          style={styles.summarySetItem}
                        >
                          <View
                            style={[
                              styles.summaryChip,
                              { borderColor: summaryBubbleBorderColor },
                            ]}
                          >
                            <ThemedText
                              size={10}
                              style={styles.summaryChipText}
                              setColor={titleColor}
                            >
                              {`${formatSummaryValue(item.reps)} · `}
                            </ThemedText>
                            <ThemedText
                              size={12}
                              style={styles.summaryWeightText}
                              setColor={secondaryColor}
                            >
                              {formatSummaryValue(item.weight)}
                            </ThemedText>
                            {item.weight !== null && (
                              <ThemedText
                                size={10}
                                style={styles.summaryUnitText}
                                setColor={quietText}
                              >
                                kg
                              </ThemedText>
                            )}
                          </View>

                          {index < collapsedSetSummaryItems.length - 1 && (
                            <View
                              style={[
                                styles.summarySetConnector,
                                { backgroundColor: summaryBubbleBorderColor },
                              ]}
                            >
                              {wrappedConnectorIndexes.includes(index) && (
                                <View
                                  style={[
                                    styles.summarySetConnectorArrow,
                                    { borderLeftColor: summaryBubbleBorderColor },
                                  ]}
                                />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => handleCardPress(onToggleExpanded)}
              style={[
                styles.summaryExpandButton,
                {
                  backgroundColor: "transparent",
                },
              ]}
            >
              <Expand width={18} height={18} color={primaryTextColor} />
            </TouchableOpacity>
          </View>
        )}

        {isSectionMounted && (
          <ReanimatedAnimated.View
            collapsable={false}
            onTouchStart={stopCardDragPropagation}
            style={[styles.expandedAnimator, expandedSectionStyle]}
          >
            <View
              style={styles.expandedSection}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;

                // Only grow the stored height: reading it back while the
                // collapse plays would shrink the target to zero.
                if (height > 0 && height > expandedHeight) {
                  setExpandedHeight(height);
                }
              }}
            >
            <SetList
              sets={exercise.sets}
              exerciseName={exercise.exercise_name}
              visibleColumns={visibleColumns}
              restUnitRequestKey={restUnitRequestKey}
              onToggleSet={onToggleSet}
              updateWeight={updateWeight}
              updateUI={updateUI}
              onAddSet={addSet}
              onOpenSettings={() => setPanelModalVisible(true)}
              onWorkoutMetadataChange={onWorkoutMetadataChange}
              recordColor={recordColor}
              recordLightColor={recordLightColor}
              recordDarkColor={recordDarkColor}
              recordControlFillColor={exerciseCheckboxFillColor}
              recordControlTextColor={exerciseCheckboxCheckmarkColor}
            />
            </View>
          </ReanimatedAnimated.View>
        )}
      </View>
      </View>

      <PanelSettingsModal
        visible={panelModalVisible}
        currentColumns={visibleColumns}
        currentNote={exerciseNote}
        onDelete={confirmDeleteExercise}
        onOpenRestUnit={() => setRestUnitRequestKey((key) => key + 1)}
        onClose={async ({ columns, note }) => {
          await saveExerciseSettings({ columns, note });
          setPanelModalVisible(false);
        }}
      />

      <ThemedModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        title="Note"
      >
        <ThemedText>{exerciseNote}</ThemedText>
      </ThemedModal>
      <ThemedConfirmModal
        visible={deleteConfirmVisible}
        title="Delete exercise?"
        message="This removes the exercise and all sets saved inside it."
        confirmLabel="Delete exercise"
        tone="danger"
        onConfirm={async () => {
          setDeleteConfirmVisible(false);
          await deleteExercise(exercise.exercise_id);
          setPanelModalVisible(false);
        }}
        onClose={() => setDeleteConfirmVisible(false)}
      />
    </>
  );
};

export default ExerciseRow;
