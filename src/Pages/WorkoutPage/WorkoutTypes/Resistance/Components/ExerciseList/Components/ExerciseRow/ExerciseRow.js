import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { Colors } from "../../../../../../../../Resources/GlobalStyling/colors";
import styles from "./ExerciseRowStyle.js";
import SetList from "./SetList/SetList";

import Note from "../../../../../../../../Resources/Icons/UI-icons/Note";
import Expand from "../../../../../../../../Resources/Icons/UI-icons/Expand";
import Plus from "../../../../../../../../Resources/Icons/UI-icons/Plus";
import ReplayHistory from "../../../../../../../../Resources/Icons/UI-icons/ReplayHistory";

import {
  ThemedBouncyCheckbox,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../../../../../../Resources/ThemedComponents";
import PanelSettingsModal from "./PanelSettingsModal";
import { weightliftingService as weightliftingRepository } from "../../../../../../../../Services";

const REORDER_LONG_PRESS_DELAY_MS = 320;
const REORDER_MOVE_CANCEL_DISTANCE = 10;
const PRESS_SUPPRESSION_MS = 250;

const ExerciseRow = ({
  exercise,
  isExpanded,
  onToggleExpanded,
  updateUI,
  onToggleSet,
  updateWeight,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWorkoutMetadataChange,
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
  const [wrappedConnectorIndexes, setWrappedConnectorIndexes] = useState([]);
  const addingSetRef = useRef(false);
  const summarySetLayoutsRef = useRef({});
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
    Alert.alert(
      "Delete exercise?",
      "This removes the exercise and all sets saved inside it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete exercise",
          style: "destructive",
          onPress: async () => {
            await deleteExercise(exercise.exercise_id);
            setPanelModalVisible(false);
          },
        },
      ]
    );
  };

  const addSet = async () => {
    if (addingSetRef.current) {
      return;
    }

    try {
      addingSetRef.current = true;
      setAddingSet(true);
      await weightliftingRepository.addSetToExercise(db, exercise.exercise_id);
      await updateUI?.();
      await onWorkoutMetadataChange?.();
    } catch (error) {
      console.error(error);
    } finally {
      addingSetRef.current = false;
      setAddingSet(false);
    }
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
  const trackerSetCount = Math.max(
    Number(exercise.setCount) || 0,
    exercise.sets.length
  );
  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
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
    colorScheme === "dark" ? "rgba(247, 116, 46, 0.24)" : "rgba(247, 116, 46, 0.14)";
  const repeatBadgeBorder =
    colorScheme === "dark" ? "rgba(247, 116, 46, 0.36)" : "rgba(247, 116, 46, 0.24)";
  const historyPanelSurface =
    colorScheme === "dark" ? "rgba(13, 15, 22, 0.78)" : "rgba(255, 255, 255, 0.72)";
  const historyChipSurface =
    colorScheme === "dark" ? "rgba(36, 41, 56, 0.92)" : "rgba(255, 255, 255, 0.88)";
  const historyChipBorder =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(32, 30, 43, 0.12)";
  const summaryBubbleBorderColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.24)" : "rgba(32, 30, 43, 0.2)";
  const exerciseCardBackground = isRecordExercise
    ? recordDarkColor
    : isDone
      ? "rgba(96, 218, 172, 0.1)"
    : cardSurface;
  const exerciseCardBorderColor = isRecordExercise
    ? recordColor
    : isDone
      ? secondaryColor
      : cardBorder;
  const exerciseCheckboxFillColor = isRecordExercise
    ? recordColor
    : secondaryColor;
  const exerciseCheckboxCheckmarkColor = isRecordExercise
    ? recordExerciseTextColor
    : cardSurface;
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
  const collapsedSetLayoutKey = collapsedSetSummaryItems
    .map((item) => item.key)
    .join("|");

  useEffect(() => {
    summarySetLayoutsRef.current = {};
    setWrappedConnectorIndexes([]);
  }, [collapsedSetLayoutKey]);

  const handleSummarySetLayout = (index, layout) => {
    summarySetLayoutsRef.current[index] = layout;

    if (
      Object.keys(summarySetLayoutsRef.current).length <
      collapsedSetSummaryItems.length
    ) {
      return;
    }

    const nextWrappedConnectorIndexes = [];

    for (let itemIndex = 0; itemIndex < collapsedSetSummaryItems.length - 1; itemIndex += 1) {
      const currentLayout = summarySetLayoutsRef.current[itemIndex];
      const nextLayout = summarySetLayoutsRef.current[itemIndex + 1];

      if (currentLayout && nextLayout && nextLayout.y > currentLayout.y + 2) {
        nextWrappedConnectorIndexes.push(itemIndex);
      }
    }

    setWrappedConnectorIndexes((currentIndexes) => {
      const isUnchanged =
        currentIndexes.length === nextWrappedConnectorIndexes.length &&
        currentIndexes.every(
          (itemIndex, arrayIndex) =>
            itemIndex === nextWrappedConnectorIndexes[arrayIndex]
        );

      return isUnchanged ? currentIndexes : nextWrappedConnectorIndexes;
    });
  };

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
        {trackerSetCount > 0 && (
          <View
            pointerEvents="none"
            style={styles.setProgressClip}
          >
            <View
              style={[
                styles.setProgressTrack,
                { backgroundColor: setProgressTrackColor },
              ]}
            >
              {setProgressSegments.map((segment) =>
                segment.isFilled ? (
                  <View
                    key={segment.index}
                    style={[
                      styles.setProgressSegment,
                      {
                        left: `${segment.left}%`,
                        width: `${segment.width}%`,
                        backgroundColor: segment.isFailed
                          ? dangerColor
                          : segment.isPersonalRecord
                            ? recordColor
                            : secondaryColor,
                      },
                    ]}
                  />
                ) : null
              )}

              {setProgressDividers.map((dividerOffset) => (
                <View
                  key={dividerOffset}
                  style={[
                    styles.setProgressDivider,
                    {
                      left: `${dividerOffset}%`,
                      backgroundColor: exerciseCardBackground,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        <View
          collapsable={false}
          style={[
            styles.headerRow,
            isExpanded && styles.headerRowExpanded,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleCardPress(onToggleExpanded)}
            style={[
              styles.headerMain,
              isExpanded && styles.headerMainExpanded,
            ]}
          >
            {!isExpanded && (
              <View style={styles.checkboxShell}>
                <ThemedBouncyCheckbox
                  value={isDone}
                  size={20}
                  edgeSize={2}
                  disabled
                  fillColor={exerciseCheckboxFillColor}
                  checkmarkColor={exerciseCheckboxCheckmarkColor}
                  style={styles.checkbox}
                />
              </View>
            )}

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
                  { color: recordExerciseTextColor },
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
                style={styles.actionButton}
                onPress={() => setNoteModalVisible(true)}
              >
                <Note width={18} height={18} color={primaryColor} />
              </TouchableOpacity>
            )}

            {isExpanded && (
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Toggle exercise history summary"
                style={styles.actionButton}
                onPress={toggleExerciseHistory}
              >
                <ReplayHistory width={18} height={18} color={replayIconColor} />
              </TouchableOpacity>
            )}

            {!isExpanded && (
              <ThemedText
                size={11}
                style={styles.exerciseSetCount}
                setColor={primaryColor}
              >
                {`${trackerSetCount} ${trackerSetCount === 1 ? "SET" : "SETS"}`}
              </ThemedText>
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

        {!isExpanded && (
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
              <Expand width={18} height={18} color={primaryColor} />
            </TouchableOpacity>
          </View>
        )}

        {isExpanded && (
          <View
            collapsable={false}
            onTouchStart={stopCardDragPropagation}
            style={styles.expandedSection}
          >
            <SetList
              sets={exercise.sets}
              exerciseName={exercise.exercise_name}
              visibleColumns={visibleColumns}
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
        )}
      </View>
      </View>

      <PanelSettingsModal
        visible={panelModalVisible}
        currentColumns={visibleColumns}
        currentNote={exerciseNote}
        onDelete={confirmDeleteExercise}
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
    </>
  );
};

export default ExerciseRow;
