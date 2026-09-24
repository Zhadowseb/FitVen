import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import styles from "./ExerciseRowStyle.js";
import SetList from "./SetList/SetList";

import Note from "@resources/Icons/UI-icons/Note";
import Expand from "@resources/Icons/UI-icons/Expand";
import Plus from "@resources/Icons/UI-icons/Plus";
import ReplayHistory from "@resources/Icons/UI-icons/ReplayHistory";

import {
  ThemedConfirmModal,
  ThemedText,
  ThemedTitle,
} from "@resources/ThemedComponents";
import { useTranslation } from "@localization";
import PanelSettingsModal from "./PanelSettingsModal";
import ExerciseHistoryPanel from "./ExerciseHistoryPanel";
import ExerciseNotePanel from "./ExerciseNotePanel";
import { shouldStoreExpandedHeight } from "./expandedHeightRule";
import { weightliftingService } from "@services";
import { useExerciseViewSettings } from "@contexts/ExerciseViewSettingsContext";
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
} from "./CollapsedSetSummary";

const REORDER_LONG_PRESS_DELAY_MS = 320;
const REORDER_MOVE_CANCEL_DISTANCE = 10;
const PRESS_SUPPRESSION_MS = 250;

const ExerciseRow = ({
  exercise,
  // The workout this card is shown in, so "last time" means the session
  // before this one - not the most recent one overall.
  workoutId = null,
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
  const { t } = useTranslation();

  const [visibleColumns, setVisibleColumns] = useState(exercise.visibleColumns);
  const [exerciseNote, setExerciseNote] = useState(exercise.note ?? "");
  const [panelModalVisible, setPanelModalVisible] = useState(false);
  // One area under the title, shared by the note and the history, and only
  // one of them at a time. Pressing the open one's icon closes it. With both
  // shut there is nothing between the header and the sets.
  const [openPanel, setOpenPanel] = useState(null); // null | "note" | "history"
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [heaviestLift, setHeaviestLift] = useState(null);
  const [previousNote, setPreviousNote] = useState(null);
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
    setOpenPanel(null);
    setExerciseHistory(null);
    setHeaviestLift(null);
    setPreviousNote(null);
    setHistoryLoadError(false);
  }, [exercise.exercise_id, exercise.exercise_name]);

  // The panels belong to the open card. Folding it shuts them - the note
  // panel saves on the way out.
  useEffect(() => {
    if (!isExpanded) {
      setOpenPanel(null);
    }
  }, [isExpanded]);

  const deleteExercise = async (exerciseId) => {
    try {
      await weightliftingService.deleteExercise(db, exerciseId);
      await updateUI?.();
      await onWorkoutMetadataChange?.();
    } catch (error) {
      console.error(error);
    }
  };

  // Both of these open something from inside the settings panel, and on iOS a
  // modal presented while another is still up is dropped by UIKit without an
  // error: the button looks dead, and React Native leaves a full-screen view
  // behind that swallows every touch afterwards. So the panel is closed first
  // and the intent is held until it has actually gone.
  const [pendingPanelAction, setPendingPanelAction] = useState(null);

  const closePanelThen = (action) => {
    setPendingPanelAction(action);
    setPanelModalVisible(false);
  };

  const runPendingPanelAction = () => {
    if (pendingPanelAction === "delete") {
      setDeleteConfirmVisible(true);
    } else if (pendingPanelAction === "restUnit") {
      setRestUnitRequestKey((key) => key + 1);
    }

    setPendingPanelAction(null);
  };

  const confirmDeleteExercise = () => {
    closePanelThen("delete");
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

  const saveExerciseSettings = async ({ columns }) => {
    await weightliftingService.updateExerciseVisibleColumns(db, {
      exerciseId: exercise.exercise_id,
      columns,
    });

    setVisibleColumns(columns);
  };

  // The note is written from the note panel only now. It used to have a field
  // in the settings sheet as well, which made two places to edit one thing.
  const saveExerciseNote = async (note) => {
    setExerciseNote(note);

    try {
      await weightliftingService.updateExerciseNote(db, {
        exerciseId: exercise.exercise_id,
        note,
      });
    } catch (error) {
      console.error("Error saving exercise note", error);
    }
  };

  const loadExerciseHistory = async () => {
    if (historyLoading) {
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryLoadError(false);

      const [history, heaviest] = await Promise.all([
        weightliftingService.getExerciseHistoryTable(db, {
          exerciseId: exercise.exercise_id,
          exerciseName: exercise.exercise_name,
          limit: 3,
        }),
        weightliftingService.getHeaviestLift(db, exercise.exercise_name),
      ]);

      setExerciseHistory(history);
      setHeaviestLift(heaviest);
    } catch (error) {
      console.error("Error loading exercise history", error);
      setHistoryLoadError(true);
      setExerciseHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPreviousNote = async () => {
    try {
      setPreviousNote(
        await weightliftingService.getPreviousExerciseNote(db, {
          exerciseName: exercise.exercise_name,
          beforeWorkoutId: workoutId,
        })
      );
    } catch (error) {
      // No "last time" box is the honest version of not knowing.
      console.error("Error loading the previous note", error);
      setPreviousNote(null);
    }
  };

  const togglePanel = (panel) => {
    const next = openPanel === panel ? null : panel;

    if (next === "history" && !exerciseHistory && !historyLoading) {
      loadExerciseHistory();
    }

    if (next === "note") {
      loadPreviousNote();
    }

    setOpenPanel(next);
  };

  // On a folded card the note icon opens the card on its note, since the
  // panel only lives inside the open card.
  const openNoteFromCollapsed = () => {
    onToggleExpanded?.();
    loadPreviousNote();
    setOpenPanel("note");
  };

  const isDone = Number(exercise.done) === 1;
  const hasNote = exerciseNote.trim().length > 0;
  const trackerSetCount = exercise.sets.length;
  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary ?? primaryColor;
  const dangerColor = theme.danger;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const setListSurface =
    colorScheme === "dark" ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const addSetColor = theme.iconColor ?? quietText;
  const titleColor = theme.title ?? theme.text;
  const replayIconColor = theme.primary;
  const activeIconSurface = withAlpha(theme.primary, 0.14);
  const recordColor = theme.record ?? primaryColor;
  const recordLightColor =
    theme.recordLight ??
    (colorScheme === "dark" ? "rgba(55, 63, 174, 0.38)" : "rgba(55, 63, 174, 0.16)");
  const recordDarkColor = theme.recordDark ?? recordColor;
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
    : isRecordExercise ? (theme.planned)
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
            {/* Open, the note icon is always there - it is also how a note
                gets written. Folded, it shows only when there is one to read. */}
            {(isExpanded || hasNote) && (
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t("workout.note.title")}
                accessibilityState={{ expanded: openPanel === "note" }}
                hitSlop={6}
                style={[
                  styles.actionButton,
                  openPanel === "note" && { backgroundColor: activeIconSurface },
                ]}
                onPress={() =>
                  handleCardPress(isExpanded ? () => togglePanel("note") : openNoteFromCollapsed)
                }
              >
                <Note
                  width={18}
                  height={18}
                  color={hasNote || openPanel === "note" ? primaryTextColor : quietText}
                />
              </TouchableOpacity>
            )}

            {isExpanded && (
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t("workout.history.title")}
                accessibilityState={{ expanded: openPanel === "history" }}
                hitSlop={6}
                style={[
                  styles.actionButton,
                  openPanel === "history" && { backgroundColor: activeIconSurface },
                ]}
                onPress={() => handleCardPress(() => togglePanel("history"))}
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
                    accessibilityLabel={t("workout.exercise.addFirstSet")}
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
                    accessibilityLabel={t("workout.exercise.expand")}
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

        {/* Nothing sits between the header and the sets unless one of the
            two icons has opened its panel. */}
        {isExpanded && openPanel === "history" && (
          <View onTouchStart={stopCardDragPropagation}>
            <ExerciseHistoryPanel
              history={exerciseHistory}
              heaviestLift={heaviestLift}
              isLoading={historyLoading}
              hasError={historyLoadError}
              exerciseName={exercise.exercise_name}
              onClose={() => setOpenPanel(null)}
              surface={setListSurface}
              border={cardBorder}
            />
          </View>
        )}

        {isExpanded && openPanel === "note" && (
          <View onTouchStart={stopCardDragPropagation}>
            <ExerciseNotePanel
              note={exerciseNote}
              previousNote={previousNote}
              onSave={saveExerciseNote}
              surface={setListSurface}
              border={cardBorder}
            />
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
                  accessibilityLabel={t("workout.exercise.addFirstSet")}
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
                        {t("workout.exercise.addFirstSet")}
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
                                {t("common.kg")}
                              </ThemedText>
                            )}
                          </View>

                          {index < collapsedSetSummaryItems.length - 1 && (
                            <View
                              style={[
                                styles.summarySetConnector,
                                { backgroundColor: summaryBubbleBorderColor },
                              ]}
                            />
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

                if (
                  shouldStoreExpandedHeight({
                    measuredHeight: height,
                    storedHeight: expandedHeight,
                    isExpanded,
                  })
                ) {
                  setExpandedHeight(height);
                }
              }}
            >
            <SetList
              sets={exercise.sets}
              exerciseId={exercise.exercise_id}
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
        onDismiss={runPendingPanelAction}
        onDelete={confirmDeleteExercise}
        onOpenRestUnit={() => closePanelThen("restUnit")}
        onClose={async ({ columns }) => {
          await saveExerciseSettings({ columns });
          setPanelModalVisible(false);
        }}
      />
      <ThemedConfirmModal
        visible={deleteConfirmVisible}
        title={t("workout.exercise.deleteTitle")}
        message={t("workout.exercise.deleteMessage")}
        confirmLabel={t("workout.exercise.deleteConfirm")}
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
