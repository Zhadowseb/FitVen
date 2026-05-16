import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { Colors } from "../../../../../../../../Resources/GlobalStyling/colors";
import styles from "./ExerciseRowStyle.js";
import SetList from "./SetList/SetList";

import Cogwheel from "../../../../../../../../Resources/Icons/UI-icons/Cogwheel";
import ReplayHistory from "../../../../../../../../Resources/Icons/UI-icons/ReplayHistory";
import Note from "../../../../../../../../Resources/Icons/UI-icons/Note";
import Expand from "../../../../../../../../Resources/Icons/UI-icons/Expand";
import Reorder from "../../../../../../../../Resources/Icons/UI-icons/Reorder";

import {
  ThemedBouncyCheckbox,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../../../../../../Resources/ThemedComponents";
import PanelSettingsModal from "./PanelSettingsModal";
import { weightliftingService as weightliftingRepository } from "../../../../../../../../Services";

const ExerciseRow = ({
  exercise,
  isExpanded,
  onToggleExpanded,
  updateUI,
  onToggleSet,
  updateWeight,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
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
  const dragActiveRef = useRef(false);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);

  const db = useSQLiteContext();

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd, onDragMove, onDragStart]);

  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(onDragStartRef.current),
        onMoveShouldSetPanResponder: () => Boolean(onDragStartRef.current),
        onPanResponderGrant: () => {
          dragActiveRef.current = onDragStartRef.current?.() !== false;
        },
        onPanResponderMove: (_event, gestureState) => {
          if (!dragActiveRef.current) {
            return;
          }

          onDragMoveRef.current?.(gestureState.dy);
        },
        onPanResponderRelease: () => {
          if (dragActiveRef.current) {
            onDragEndRef.current?.();
          }

          dragActiveRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          if (dragActiveRef.current) {
            onDragEndRef.current?.();
          }

          dragActiveRef.current = false;
        },
      }),
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
      updateUI?.();
    } catch (error) {
      console.error(error);
    }
  };

  const addSet = async () => {
    try {
      await weightliftingRepository.addSetToExercise(db, exercise.exercise_id);
      updateUI?.();
    } catch (error) {
      console.error(error);
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
  const hasSets = exercise.sets.length > 0;
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
  const titleColor = theme.title ?? theme.text;
  const replayIconColor = theme.primary ?? "#f7742eff";
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
  const exerciseCardBackground = isDone
    ? "rgba(96, 218, 172, 0.1)"
    : cardSurface;
  const setProgressTrackColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(32, 30, 43, 0.1)";
  const setProgressSegments =
    trackerSetCount > 0
      ? Array.from({ length: trackerSetCount }, (_, index) => {
          const set = exercise.sets[index];
          const isSetDone = Number(set?.done) === 1;
          const isSetFailed = Number(set?.failed) === 1;

          return {
            index,
            isFilled: isSetDone || isSetFailed,
            isFailed: isSetFailed,
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

  const collapsedSetSummaryItems = (() => {
    const summaryItems = [];
    const itemsBySignature = new Map();

    for (const set of exercise.sets) {
      const repsValue = Number(set.reps);
      const weightValue = Number(set.weight);
      const normalizedReps = Number.isFinite(repsValue) ? repsValue : null;
      const normalizedWeight = Number.isFinite(weightValue) ? weightValue : null;
      const isAmrap = Number(set.amrap) === 1;
      const signature = [
        normalizedReps ?? "-",
        normalizedWeight ?? "-",
        isAmrap ? "amrap" : "standard",
      ].join(":");

      const existingItem = itemsBySignature.get(signature);

      if (existingItem) {
        existingItem.count += 1;
        continue;
      }

      const nextItem = {
        signature,
        count: 1,
        reps: normalizedReps,
        weight: normalizedWeight,
        isAmrap,
      };

      itemsBySignature.set(signature, nextItem);
      summaryItems.push(nextItem);
    }

    return summaryItems;
  })();

  const summaryHeadline = hasSets
    ? `${trackerSetCount} ${trackerSetCount === 1 ? "SET" : "SETS"}`
    : "No sets added yet";
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
        {onDragStart && (
          <View
            {...dragPanResponder.panHandlers}
            style={[
              styles.floatingDragHandle,
              isDragging && styles.dragHandleActive,
            ]}
          >
            <Reorder width={18} height={18} stroke={quietText} />
          </View>
        )}

        <View
          style={[
            styles.exerciseCard,
            {
              backgroundColor: exerciseCardBackground,
              borderColor: isDone ? secondaryColor : cardBorder,
            },
          ]}
        >
        {trackerSetCount > 0 && (
          <View
            pointerEvents="none"
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
        )}

        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onToggleExpanded}
            style={styles.headerMain}
          >
            <View
              style={styles.checkboxShell}
            >
              <ThemedBouncyCheckbox
                value={isDone}
                size={20}
                edgeSize={2}
                disabled
                fillColor={secondaryColor}
                checkmarkColor={cardSurface}
                style={styles.checkbox}
              />
            </View>

            <View style={styles.titleBlock}>
              <ThemedTitle
                type="h3"
                style={[styles.exerciseTitle, { color: titleColor }]}
                numberOfLines={1}
              >
                {exercise.exercise_name}
              </ThemedTitle>

              <ThemedText
                size={10}
                style={styles.exerciseMeta}
                setColor={quietText}
              >
                {summaryHeadline}
              </ThemedText>
            </View>
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            {hasNote && (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.actionButton}
                onPress={() => setNoteModalVisible(true)}
              >
                <Note width={18} height={18} color={primaryColor} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Toggle exercise history summary"
              style={styles.actionButton}
              onPress={toggleExerciseHistory}
            >
              <ReplayHistory width={18} height={18} color={replayIconColor} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.actionButton, styles.settingsActionButton]}
              onPress={() => {
                setPanelModalVisible(true);
              }}
            >
              <Cogwheel width={18} height={18} color={primaryColor} />
            </TouchableOpacity>

          </View>
        </View>

        {historyVisible && (
          <View style={styles.historySection}>
            <TouchableOpacity
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Toggle exercise history details"
              onPress={toggleHistoryDetails}
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
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onToggleExpanded}
              style={styles.summaryRow}
            >
              <View style={styles.summaryTextBlock}>
                {collapsedSetSummaryItems.length > 0 && (
                  <View style={styles.summaryChipRow}>
                    {collapsedSetSummaryItems.map((item) => {
                      return (
                        <View
                          key={item.signature}
                          style={[
                            styles.summaryChip,
                            {
                              backgroundColor: historyPanelSurface,
                              borderColor: historyChipBorder,
                            },
                          ]}
                        >
                          {item.count > 1 && (
                            <View
                              style={[
                                styles.summaryRepeatBadge,
                                {
                                  backgroundColor: repeatBadgeBackground,
                                  borderColor: repeatBadgeBorder,
                                },
                              ]}
                            >
                              <ThemedText
                                size={8}
                                style={styles.summaryRepeatBadgeText}
                                setColor={replayIconColor}
                              >
                                {item.count}
                              </ThemedText>
                            </View>
                          )}

                          <ThemedText
                            size={10}
                            style={styles.summaryChipText}
                            setColor={titleColor}
                          >
                            {`${formatSummaryValue(item.reps)} × ${formatSummaryValue(item.weight)}${item.weight !== null ? " kg" : ""}`}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onToggleExpanded}
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
          <View style={styles.expandedSection}>
            <SetList
              sets={exercise.sets}
              exerciseName={exercise.exercise_name}
              visibleColumns={visibleColumns}
              onToggleSet={onToggleSet}
              updateWeight={updateWeight}
              updateUI={updateUI}
              onAddSet={addSet}
            />
          </View>
        )}
      </View>
      </View>

      <PanelSettingsModal
        visible={panelModalVisible}
        currentColumns={visibleColumns}
        currentNote={exerciseNote}
        onDelete={async () => {
          await deleteExercise(exercise.exercise_id);
          setPanelModalVisible(false);
        }}
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
