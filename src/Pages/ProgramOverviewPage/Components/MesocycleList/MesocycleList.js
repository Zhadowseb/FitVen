import { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import PlusCircled from "../../../../Resources/Icons/UI-icons/PlusCircled";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";

import { programService } from "../../../../Services";
import AddMesocycleModal from "./AddMesocycleModal";
import {
  ThemedStateBlock,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import StatusPill from "../../../../Resources/Components/StatusPill";
import ProgressBar from "../../../../Resources/Components/ProgressBar";
import Plus from "../../../../Resources/Icons/UI-icons/Plus";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import { parseCustomDate, formatDate } from "../../../../Utils/dateUtils";
import styles from "./MesocycleListStyle";

function getCompletedWorkoutCount(item) {
  const total = Number(item.workout_count) || 0;
  const completed = Number(item.completed_workout_count) || 0;

  if (Number(item.done) === 1 && total > 0) {
    return total;
  }

  return Math.min(completed, total);
}

function getProgressPercent(item) {
  const total = Number(item.workout_count) || 0;

  if (total <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((getCompletedWorkoutCount(item) / total) * 100)
  );
}

function isBlockCompleteForProgress(item) {
  const totalWorkouts = Number(item.workout_count) || 0;

  return (
    Number(item.done) === 1 ||
    (totalWorkouts > 0 && getCompletedWorkoutCount(item) >= totalWorkouts)
  );
}

function formatBlockDateRange(periodStart, periodEnd) {
  if (!periodStart || !periodEnd) {
    return null;
  }

  const start = parseCustomDate(periodStart);
  const end = parseCustomDate(periodEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${periodStart} – ${periodEnd}`;
  }

  const startLabel = `${String(start.getDate()).padStart(2, "0")}.${String(
    start.getMonth() + 1
  ).padStart(2, "0")}`;

  return `${startLabel} – ${formatDate(end)}`;
}

const MesocycleList = ({
  program_id,
  start_date,
  program_status,
  program_current_week,
  refreshKey,
  refresh,
}) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [mesocycles, setMesocycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [addingWeekMesocycleId, setAddingWeekMesocycleId] = useState(null);

  const accentColor = theme.primary;
  const quietText = theme.quietText;
  const titleColor = theme.title;
  const activeNodeBackground = withAlpha(theme.primary, 0.14);
  const notStartedNodeBorder = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(15, 17, 22, 0.14)";
  const connectorColor = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.09)"
    : "rgba(15, 17, 22, 0.09)";
  const notStartedCardBorder = theme.cardBorder;
  const activeCardBorder = withAlpha(theme.primary, 0.35);
  const completeCardBorder = withAlpha(theme.secondary, 0.35);
  const notStartedPillBackground = theme.chipBackground;
  const activePillBackground = withAlpha(theme.primary, 0.12);
  const weekBarFilled = accentColor;
  const weekBarEmpty = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(15, 17, 22, 0.10)";
  const progressTrackColor = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(15, 17, 22, 0.07)";
  const addNodeBorder = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.16)"
    : "rgba(15, 17, 22, 0.16)";
  const addCardBorder = colorScheme === "dark"
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(15, 17, 22, 0.14)";
  const addTitleColor = theme.textStrong;

  const loadMesocycles = async () => {
    try {
      setLoading(true);
      const cycles = await programService.getMesocyclesByProgram(db, program_id);
      const workoutCounts =
        await programService.getMesocycleWorkoutCountsByProgram(db, program_id);

      const workoutCountMap = workoutCounts.reduce((acc, row) => {
        acc[row.mesocycle_id] = {
          workout_count: row.workout_count ?? 0,
          completed_workout_count: row.completed_workout_count ?? 0,
        };
        return acc;
      }, {});

      const enriched = enrichMesocycles(cycles, workoutCountMap);
      setMesocycles(enriched);
    } catch (error) {
      console.error("Error loading programs", error);
    } finally {
      setLoading(false);
    }
  };

  const enrichMesocycles = (cycles, workoutCountMap) => {
    let weekOffset = 0;

    return cycles.map((cycle) => {
      const start = parseCustomDate(start_date);
      start.setDate(start.getDate() + weekOffset * 7);

      const weekCount = Math.max(0, Number(cycle.weeks) || 0);
      const end = new Date(start);
      end.setDate(end.getDate() + weekCount * 7 - 1);

      const startWeekIndex = weekOffset + 1;
      weekOffset += weekCount;

      const workoutCounts = workoutCountMap[cycle.mesocycle_id] ?? {};
      const workoutCount = Number(workoutCounts.workout_count) || 0;
      const completedWorkoutCount =
        Number(workoutCounts.completed_workout_count) || 0;
      const averageWeeklyWorkouts =
        weekCount > 0 ? workoutCount / weekCount : 0;

      return {
        ...cycle,
        weeks: weekCount,
        startWeekIndex,
        period_start: formatDate(start),
        period_end: weekCount > 0 ? formatDate(end) : null,
        workout_count: workoutCount,
        completed_workout_count: completedWorkoutCount,
        average_weekly_workouts: averageWeeklyWorkouts,
      };
    });
  };

  const handleAdd = async (data) => {
    try {
      await programService.createMesocycle(db, {
        programId: program_id,
        startDate: start_date,
        weeks: 0,
        focus: data.focus,
      });

      if (refresh) {
        refresh();
      } else {
        await loadMesocycles();
      }
    } catch (error) {
      console.error(error);
    }

    setModalVisible(false);
  };

  const handleAddWeek = async (mesocycleId) => {
    if (!mesocycleId || addingWeekMesocycleId) {
      return;
    }

    try {
      setAddingWeekMesocycleId(mesocycleId);

      await programService.addWeekToMesocycle(db, {
        mesocycleId,
        programId: program_id,
      });

      if (refresh) {
        refresh();
      } else {
        await loadMesocycles();
      }
    } catch (error) {
      console.error("Error adding week to block", error);
    } finally {
      setAddingWeekMesocycleId(null);
    }
  };

  useEffect(() => {
    loadMesocycles();
  }, [refreshKey]);

  if (loading) {
    return (
      <ThemedStateBlock indicatorColor={accentColor} />
    );
  }

  const isDraft = program_status === "NOT_STARTED";
  const activeIndex = isDraft
    ? -1
    : mesocycles.findIndex((cycle) => !isBlockCompleteForProgress(cycle));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText style={styles.headerEyebrow} setColor={quietText}>
          Blocks
        </ThemedText>
        <View
          style={[
            styles.headerCount,
            { backgroundColor: theme.chipBackground },
          ]}
        >
          <ThemedText style={styles.headerCountText} setColor={theme.text}>
            {mesocycles.length}
          </ThemedText>
        </View>
      </View>

      <View style={styles.timeline}>
        {mesocycles.map((item, index) => {
          const isCompleted = isBlockCompleteForProgress(item);
          const isActive = !isDraft && !isCompleted && index === activeIndex;
          const weekCount = Math.max(0, Number(item.weeks) || 0);
          const completedWorkoutCount = getCompletedWorkoutCount(item);
          const workoutCount = Number(item.workout_count) || 0;
          const progressPercent = getProgressPercent(item);
          const focusTitle = item.focus || `Block ${item.mesocycle_number}`;
          const dateRangeLabel = formatBlockDateRange(
            item.period_start,
            item.period_end
          );

          // Weeks completed within this block, derived from the program's
          // current week vs this block's week span. The in-progress week is
          // not counted as filled.
          const currentProgramWeek = Number(program_current_week) || 0;
          let completedWeeksInBlock = 0;
          if (isCompleted) {
            completedWeeksInBlock = weekCount;
          } else if (weekCount > 0 && currentProgramWeek > 0) {
            completedWeeksInBlock = Math.min(
              weekCount,
              Math.max(0, currentProgramWeek - item.startWeekIndex)
            );
          }

          const nodeBackground = isActive
            ? activeNodeBackground
            : theme.cardBackground;
          const nodeBorderColor = isActive
            ? accentColor
            : isCompleted
            ? theme.secondary
            : notStartedNodeBorder;
          const nodeNumberColor = isActive
            ? accentColor
            : isCompleted
            ? theme.secondary
            : theme.text;
          const cardBorderColor = isActive
            ? activeCardBorder
            : isCompleted
            ? completeCardBorder
            : notStartedCardBorder;
          // Colored left rail mirrors the node/border so active vs complete
          // reads at a glance; not-started blocks keep the neutral card.
          const statusRailColor = isActive
            ? accentColor
            : isCompleted
            ? theme.secondary
            : null;

          return (
            <View key={item.mesocycle_id} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.node,
                    {
                      backgroundColor: nodeBackground,
                      borderWidth: 2,
                      borderColor: nodeBorderColor,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.nodeNumber}
                    setColor={nodeNumberColor}
                  >
                    {item.mesocycle_number}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: connectorColor },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: cardBorderColor,
                  },
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  navigation.navigate("MicrocyclePage", {
                    mesocycle_id: item.mesocycle_id,
                    mesocycle_number: item.mesocycle_number,
                    mesocycle_focus: item.focus,
                    program_id,
                    period_start: item.period_start,
                    period_end: item.period_end,
                  });
                }}
              >
                {statusRailColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.blockStatusRail,
                      { backgroundColor: statusRailColor },
                    ]}
                  />
                ) : null}

                <View style={styles.cardTopRow}>
                  <ThemedText
                    style={styles.cardEyebrow}
                    setColor={quietText}
                    numberOfLines={1}
                  >
                    {`Block ${item.mesocycle_number} · ${weekCount} ${
                      weekCount === 1 ? "week" : "weeks"
                    }`}
                  </ThemedText>

                  {isActive ? (
                    <StatusPill
                      style={styles.activeStatusPill}
                      label="Active"
                      color={accentColor}
                      backgroundColor={activePillBackground}
                      dotSize={5}
                    />
                  ) : isCompleted ? (
                    <StatusPill
                      style={styles.activeStatusPill}
                      label="Complete"
                      color={theme.secondary}
                      backgroundColor={withAlpha(theme.secondary, 0.12)}
                      dotSize={5}
                    />
                  ) : (
                    <View
                      style={[
                        styles.statusPillNotStarted,
                        { backgroundColor: notStartedPillBackground },
                      ]}
                    >
                      <ThemedText
                        style={styles.statusPillNotStartedText}
                        setColor={theme.text}
                      >
                        Not started
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.focusRow}>
                  <ThemedText
                    style={styles.focusTitle}
                    setColor={titleColor}
                    numberOfLines={1}
                  >
                    {focusTitle}
                  </ThemedText>

                  {weekCount > 0 && (
                    <View style={styles.weekBars}>
                      {Array.from({ length: weekCount }).map((_, weekIdx) => (
                        <View
                          key={weekIdx}
                          style={[
                            styles.weekBar,
                            {
                              backgroundColor:
                                weekIdx < completedWeeksInBlock
                                  ? weekBarFilled
                                  : weekBarEmpty,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>

                {isActive && (
                  <View style={styles.progressGroup}>
                    <View style={styles.progressHeader}>
                      <ThemedText
                        style={styles.progressCountText}
                        setColor={theme.text}
                      >
                        <ThemedText
                          style={styles.progressCountStrong}
                          setColor={titleColor}
                        >
                          {completedWorkoutCount}
                        </ThemedText>
                        {` of ${workoutCount} ${
                          workoutCount === 1 ? "workout" : "workouts"
                        }`}
                      </ThemedText>
                      <ThemedText
                        style={styles.progressPercent}
                        setColor={accentColor}
                      >
                        {`${progressPercent}%`}
                      </ThemedText>
                    </View>

                    <ProgressBar
                      progress={progressPercent / 100}
                      height={6}
                      trackColor={progressTrackColor}
                      fillColor={accentColor}
                    />
                  </View>
                )}

                {weekCount > 0 ? (
                  <View style={styles.footerRow}>
                    <ThemedText
                      style={styles.footerDateText}
                      setColor={quietText}
                      numberOfLines={1}
                    >
                      {dateRangeLabel ?? "No weeks yet"}
                    </ThemedText>
                    <ThemedText
                      style={styles.footerText}
                      setColor={quietText}
                      numberOfLines={1}
                    >
                      {isActive
                        ? `${item.average_weekly_workouts.toFixed(1)} workouts/week`
                        : `${workoutCount} workouts · ${item.average_weekly_workouts.toFixed(
                            1
                          )}/week`}
                    </ThemedText>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    disabled={
                      Number(addingWeekMesocycleId) === Number(item.mesocycle_id)
                    }
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      handleAddWeek(item.mesocycle_id);
                    }}
                    style={[
                      styles.addWeekCard,
                      {
                        borderColor: addCardBorder,
                        opacity:
                          Number(addingWeekMesocycleId) ===
                          Number(item.mesocycle_id)
                            ? 0.62
                            : 1,
                      },
                    ]}
                  >
                    {Number(addingWeekMesocycleId) === Number(item.mesocycle_id) ? (
                      <ActivityIndicator size="small" color={accentColor} />
                    ) : (
                      <PlusCircled width={20} height={20} color={accentColor} />
                    )}
                    <View style={styles.addWeekCopy}>
                      <ThemedText
                        style={styles.addWeekTitle}
                        setColor={titleColor}
                        numberOfLines={1}
                      >
                        Add week
                      </ThemedText>
                      <ThemedText
                        style={styles.addWeekSubtitle}
                        setColor={quietText}
                        numberOfLines={1}
                      >
                        Create the first week in this block.
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={styles.row}>
          <View style={styles.rail}>
            <View
              style={[styles.addNode, { borderColor: addNodeBorder }]}
            >
              <Plus width={13} height={13} color={quietText} thickness={2.2} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addCard, { borderColor: addCardBorder }]}
            activeOpacity={0.9}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.addCopy}>
              <ThemedText style={styles.addTitle} setColor={addTitleColor}>
                Add block
              </ThemedText>
              <ThemedText style={styles.addSubtitle} setColor={quietText}>
                Plan the next mesocycle
              </ThemedText>
            </View>
            <ChevronRight width={18} height={18} color={quietText} thickness={2} />
          </TouchableOpacity>
        </View>
      </View>

      <AddMesocycleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAdd}
      />
    </View>
  );
};

export default MesocycleList;
