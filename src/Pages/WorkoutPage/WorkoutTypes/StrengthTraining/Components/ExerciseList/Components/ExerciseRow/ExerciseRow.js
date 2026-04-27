import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { Colors } from "../../../../../../../../Resources/GlobalStyling/colors";
import styles from "./ExerciseRowStyle";
import SetList from "./SetList/SetList";

import Cogwheel from "../../../../../../../../Resources/Icons/UI-icons/Cogwheel";
import Note from "../../../../../../../../Resources/Icons/UI-icons/Note";
import Expand from "../../../../../../../../Resources/Icons/UI-icons/Expand";
import ArrowUpAndDown from "../../../../../../../../Resources/Icons/UI-icons/ArrowUpAndDown";

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

  const isDone = Number(exercise.done) === 1;
  const hasSets = exercise.sets.length > 0;
  const hasNote = exerciseNote.trim().length > 0;
  const trackerSetCount = Math.max(
    Number(exercise.setCount) || 0,
    exercise.sets.length
  );
  const completedSetCount = exercise.sets.filter(
    (set) => Number(set.done) === 1
  ).length;

  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const secondaryColor = theme.secondary ?? primaryColor;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const setListSurface =
    colorScheme === "dark" ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const summaryChipSurface =
    colorScheme === "dark"
      ? "rgba(210, 83, 15, 0.10)"
      : "rgba(247, 116, 46, 0.12)";
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const exerciseCardBackground = isDone
    ? "rgba(96, 218, 172, 0.1)"
    : cardSurface;
  const setProgressTrackColor =
    colorScheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(32, 30, 43, 0.1)";
  const setProgressPercent =
    trackerSetCount > 0
      ? Math.min(100, (completedSetCount / trackerSetCount) * 100)
      : 0;
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

  return (
    <>
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
            <View
              style={[
                styles.setProgressFill,
                {
                  width: `${setProgressPercent}%`,
                  backgroundColor: secondaryColor,
                },
              ]}
            />

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
                size={11}
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
              style={styles.actionButton}
              onPress={() => {
                setPanelModalVisible(true);
              }}
            >
              <Cogwheel width={18} height={18} color={primaryColor} />
            </TouchableOpacity>

            {onDragStart && (
              <View
                {...dragPanResponder.panHandlers}
                style={[
                  styles.actionButton,
                  styles.dragHandle,
                  isDragging && styles.dragHandleActive,
                ]}
              >
                <ArrowUpAndDown
                  width={18}
                  height={18}
                  stroke={primaryColor}
                />
              </View>
            )}
          </View>
        </View>

        {!isExpanded && (
          <View style={styles.summaryCollapsedRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onToggleExpanded}
              style={[
                styles.summaryRow,
                {
                  backgroundColor: setListSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
            <View
              style={[
                styles.summaryAccent,
                { backgroundColor: primaryColor },
              ]}
            />

            <View style={styles.summaryTextBlock}>
              {collapsedSetSummaryItems.length > 0 && (
                <View style={styles.summaryChipRow}>
                  {collapsedSetSummaryItems.map((item) => {
                    return (
                      <View
                        key={item.signature}
                        style={[
                          styles.summaryChipGroup,
                          {
                            borderColor: cardBorder,
                          },
                        ]}
                      >
                        {item.count > 1 && (
                          <ThemedText
                            size={10}
                            style={styles.summaryRepeatCount}
                            setColor={titleColor}
                          >
                            {item.count} ×
                          </ThemedText>
                        )}

                        <View
                          style={[
                            styles.summaryChip,
                            {
                              backgroundColor: summaryChipSurface,
                            },
                          ]}
                        >
                          <ThemedText
                            size={10}
                            style={styles.summaryChipText}
                            setColor={titleColor}
                          >
                            {`${formatSummaryValue(item.reps)} × ${formatSummaryValue(item.weight)}${item.weight !== null ? "kg" : ""}`}
                          </ThemedText>
                        </View>
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
                  backgroundColor: setListSurface,
                  borderColor: cardBorder,
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
