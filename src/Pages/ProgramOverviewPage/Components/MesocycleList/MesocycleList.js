import { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";

import { programService } from "../../../../Services";
import AddMesocycleModal from "./AddMesocycleModal";
import {
  ThemedTitle,
  ThemedCard,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import PlusCircled from "../../../../Resources/Icons/UI-icons/PlusCircled";
import Calender from "../../../../Resources/Icons/UI-icons/Calender";
import Info from "../../../../Resources/Icons/UI-icons/Info";
import { parseCustomDate, formatDate } from "../../../../Utils/dateUtils";

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  listContainer: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  listHeaderLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  listHeaderCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  cardTouchable: {
    marginBottom: 12,
  },
  addCardTouchable: {
    marginBottom: 0,
  },
  card: {
    position: "relative",
    padding: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 20,
  },
  statusRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: 10,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  statusLabelText: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  blockTitle: {
    padding: 0,
    marginBottom: 6,
    lineHeight: 24,
  },
  blockSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  blockSubtitleIcon: {
    marginRight: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  blockSubtitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  progressCount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  progressTotal: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginLeft: 7,
  },
  progressPercent: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginLeft: 12,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  statRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  statTile: {
    flex: 1,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 10,
  },
  statTileSpacing: {
    marginRight: 10,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 1.25,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  statValueWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateIconWrap: {
    width: 14,
    marginRight: 8,
  },
  dateIconBalance: {
    width: 22,
  },
  dateText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  dateSeparator: {
    marginHorizontal: 8,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  addCard: {
    minHeight: 92,
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 0,
    backgroundColor: "transparent",
    marginBottom: 0,
    overflow: "hidden",
  },
  addCardContent: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  addIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginRight: 14,
  },
  addCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  addEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.7,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  addTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 3,
  },
  addSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
});

function getCompletedWorkoutCount(item) {
  const total = Number(item.workout_count) || 0;
  const completed = Number(item.completed_workout_count) || 0;

  if (Number(item.done) === 1 && total > 0) {
    return total;
  }

  return Math.min(completed, total);
}

function getBlockStatus(item, index, activeIndex) {
  if (Number(item.done) === 1) {
    return "completed";
  }

  if (index === activeIndex) {
    return "active";
  }

  return "upcoming";
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

const MesocycleList = ({ program_id, start_date, refreshKey, refresh }) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [mesocycles, setMesocycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const accentColor = theme.primary ?? "#f7742e";
  const successColor = theme.secondary ?? "#60daac";
  const upcomingColor = theme.iconColor ?? "#7b879d";
  const cardBackground =
    colorScheme === "dark"
      ? "#171a21"
      : theme.cardBackground ?? theme.background ?? "#ffffff";
  const tileBackground =
    colorScheme === "dark"
      ? "rgba(12, 15, 21, 0.46)"
      : "rgba(255, 255, 255, 0.62)";
  const cardBorder =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.09)"
      : theme.cardBorder ?? theme.iconColor ?? "#d6d5e1";
  const trackBackground =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(32, 30, 43, 0.10)";
  const quietText = theme.iconColor ?? theme.quietText ?? "#9591a5";
  const titleColor = theme.title ?? theme.text ?? "#ffffff";
  const addSurface =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.04)"
      : "rgba(255, 255, 255, 0.48)";

  const statusConfig = {
    completed: {
      label: "COMPLETED",
      color: successColor,
      borderColor: successColor,
      subtitle: "Completed block",
    },
    active: {
      label: "IN PROGRESS",
      color: accentColor,
      borderColor: accentColor,
      subtitle: "Current block",
    },
    upcoming: {
      label: "UPCOMING",
      color: upcomingColor,
      borderColor: cardBorder,
      subtitle: "Upcoming block",
    },
  };

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

  useEffect(() => {
    loadMesocycles();
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const activeIndex = mesocycles.findIndex((cycle) => Number(cycle.done) !== 1);

  return (
    <>
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <ThemedText style={styles.listHeaderLabel} setColor={quietText}>
            Blocks
          </ThemedText>
          <ThemedText style={styles.listHeaderCount} setColor={quietText}>
            {mesocycles.length}
          </ThemedText>
        </View>

        {mesocycles.map((item, index) => {
          const status = getBlockStatus(item, index, activeIndex);
          const presentation = statusConfig[status];
          const completedWorkoutCount = getCompletedWorkoutCount(item);
          const workoutCount = Number(item.workout_count) || 0;
          const progressPercent = getProgressPercent(item);
          const title = item.focus || `Block ${item.mesocycle_number}`;
          const subtitle = item.focus ? presentation.subtitle : "No focus set";

          return (
            <TouchableOpacity
              key={item.mesocycle_id}
              style={styles.cardTouchable}
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
              <ThemedCard
                style={[
                  styles.card,
                  {
                    backgroundColor: cardBackground,
                    borderColor: presentation.borderColor,
                  },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.statusRail,
                    {
                      backgroundColor: presentation.color,
                      opacity: status === "upcoming" ? 0 : 1,
                    },
                  ]}
                />

                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.statusGroup}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: presentation.color },
                        ]}
                      />
                      <ThemedText
                        style={styles.statusText}
                        setColor={titleColor}
                        numberOfLines={1}
                      >
                        {`Block ${item.mesocycle_number} - `}
                      </ThemedText>
                      <ThemedText
                        style={styles.statusLabelText}
                        setColor={presentation.color}
                        numberOfLines={1}
                      >
                        {presentation.label}
                      </ThemedText>
                    </View>

                  </View>

                  <ThemedTitle
                    type="h3"
                    style={[styles.blockTitle, { color: titleColor }]}
                    numberOfLines={1}
                  >
                    {title}
                  </ThemedTitle>

                  <View style={styles.blockSubtitleRow}>
                    <View style={styles.blockSubtitleIcon}>
                      <Info width={15} height={15} />
                    </View>
                    <ThemedText
                      style={styles.blockSubtitle}
                      setColor={quietText}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </ThemedText>
                  </View>

                  <View style={styles.progressHeader}>
                    <ThemedText
                      style={styles.progressCount}
                      setColor={titleColor}
                    >
                      {completedWorkoutCount}
                    </ThemedText>
                    <ThemedText
                      style={styles.progressTotal}
                      setColor={quietText}
                      numberOfLines={1}
                    >
                      {`/ ${workoutCount} ${
                        workoutCount === 1 ? "workout" : "workouts"
                      }`}
                    </ThemedText>
                    <ThemedText
                      style={styles.progressPercent}
                      setColor={presentation.color}
                    >
                      {`${progressPercent}%`}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: trackBackground },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: presentation.color,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.statRow}>
                    <View
                      style={[
                        styles.statTile,
                        styles.statTileSpacing,
                        {
                          backgroundColor: tileBackground,
                          borderColor: cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.statLabelRow}>
                        <ThemedText style={styles.statLabel} setColor={quietText}>
                          Weeks
                        </ThemedText>
                      </View>
                      <View style={styles.statValueWrap}>
                        <ThemedText style={styles.statValue} setColor={titleColor}>
                          {item.weeks}
                        </ThemedText>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statTile,
                        styles.statTileSpacing,
                        {
                          backgroundColor: tileBackground,
                          borderColor: cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.statLabelRow}>
                        <ThemedText style={styles.statLabel} setColor={quietText}>
                          Workouts
                        </ThemedText>
                      </View>
                      <View style={styles.statValueWrap}>
                        <ThemedText style={styles.statValue} setColor={titleColor}>
                          {workoutCount}
                        </ThemedText>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statTile,
                        {
                          backgroundColor: tileBackground,
                          borderColor: cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.statLabelRow}>
                        <ThemedText style={styles.statLabel} setColor={quietText}>
                          Avg/week
                        </ThemedText>
                      </View>
                      <View style={styles.statValueWrap}>
                        <ThemedText style={styles.statValue} setColor={titleColor}>
                          {item.average_weekly_workouts.toFixed(1)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {item.period_end ? (
                    <View style={styles.dateRow}>
                      <View style={styles.dateIconWrap}>
                        <Calender
                          width={14}
                          height={14}
                          color={quietText}
                          thickness={1.7}
                        />
                      </View>
                      <ThemedText style={styles.dateText} setColor={quietText}>
                        {item.period_start}
                      </ThemedText>
                      <ThemedText
                        style={styles.dateSeparator}
                        setColor={quietText}
                      >
                        -
                      </ThemedText>
                      <ThemedText style={styles.dateText} setColor={quietText}>
                        {item.period_end}
                      </ThemedText>
                      <View style={styles.dateIconBalance} />
                    </View>
                  ) : (
                    <View style={styles.dateRow}>
                      <ThemedText style={styles.dateText} setColor={quietText}>
                        No weeks added yet
                      </ThemedText>
                    </View>
                  )}
                </View>
              </ThemedCard>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.cardTouchable, styles.addCardTouchable]}
          activeOpacity={0.9}
          onPress={() => {
            setModalVisible(true);
          }}
        >
          <ThemedCard
            style={[
              styles.addCard,
              {
                backgroundColor: addSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.addCardContent}>
              <View
                style={[
                  styles.addIconBadge,
                  {
                    backgroundColor: tileBackground,
                    borderColor: accentColor,
                  },
                ]}
              >
                <PlusCircled width={24} height={24} color={accentColor} />
              </View>

              <View style={styles.addCopy}>
                <ThemedText style={styles.addEyebrow} setColor={accentColor}>
                  New block
                </ThemedText>
                <ThemedText
                  style={styles.addTitle}
                  setColor={titleColor}
                  numberOfLines={1}
                >
                  Add training block
                </ThemedText>
                <ThemedText
                  style={styles.addSubtitle}
                  setColor={quietText}
                  numberOfLines={2}
                >
                  Set the focus now, then add weeks inside the block.
                </ThemedText>
              </View>

            </View>
          </ThemedCard>
        </TouchableOpacity>
      </View>

      <AddMesocycleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAdd}
      />
    </>
  );
};

export default MesocycleList;
