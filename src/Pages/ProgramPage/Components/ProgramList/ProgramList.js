import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import styles from "./ProgramListStyle";
import { programService } from "../../../../Services";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import CoverGradient from "../../../../Resources/Components/CoverGradient";
import ProgressBar from "../../../../Resources/Components/ProgressBar";
import StatusPill from "../../../../Resources/Components/StatusPill";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import { getWorkoutIconConfig } from "../../../../Resources/Icons/WorkoutLabels";
import { getWorkoutCoverImage } from "../../../../Utils/workoutCoverImages";
import {
  ThemedCard,
  ThemedButton,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";
import { getProgramEndDate } from "../../../../Utils/programUtils";
import {
  formatDate,
  getTodaysDate,
  parseCustomDate,
} from "../../../../Utils/dateUtils";
import StartProgramModal from "../../../ProgramOverviewPage/Components/StartProgramModal";

// "Dark glass" type pill — alpha-tinted one-offs with no shared token.
const TYPE_PILL_GLASS = {
  dark: { background: "rgba(10, 11, 15, 0.72)", border: "rgba(255, 255, 255, 0.14)" },
  light: { background: "rgba(255, 255, 255, 0.88)", border: "rgba(15, 17, 22, 0.14)" },
};

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const RESISTANCE_WORKOUT_TYPES = new Set([
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Legs",
]);

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETE", label: "Complete" },
  { key: "NOT_STARTED", label: "Draft" },
];

function formatProgramDateLabel(value, { includeYear = false } = {}) {
  if (!value) {
    return "";
  }

  const date = parseCustomDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_LABELS[date.getMonth()] ?? "";
  const year = date.getFullYear();

  return `${day} ${month}${includeYear ? ` ${year}` : ""}`.trim();
}

function getProgramDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return "";
  }

  const start = parseCustomDate(startDate);
  const end = parseCustomDate(endDate);
  const showStartYear =
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getFullYear() !== end.getFullYear();

  return `${formatProgramDateLabel(startDate, {
    includeYear: showStartYear,
  })} – ${formatProgramDateLabel(endDate, { includeYear: true })}`;
}

function normalizeWorkoutType(type) {
  return RESISTANCE_WORKOUT_TYPES.has(type) ? "Resistance" : type;
}

function parseWorkoutTypes(value) {
  if (!value) {
    return [];
  }

  const seenTypes = new Set();

  return String(value)
    .split(",")
    .map((type) => normalizeWorkoutType(type.trim()))
    .filter((type) => {
      if (!type || seenTypes.has(type)) {
        return false;
      }

      seenTypes.add(type);
      return true;
    });
}

const ProgramList = ({ refreshKey, onCreateProgram }) => {
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [todayWorkoutByProgramId, setTodayWorkoutByProgramId] = useState({});
  const [startProgramTarget, setStartProgramTarget] = useState(null);
  const [isStartingProgram, setIsStartingProgram] = useState(false);
  const hasHandledInitialFocusRef = useRef(false);
  const typePillGlass =
    colorScheme === "dark" ? TYPE_PILL_GLASS.dark : TYPE_PILL_GLASS.light;

  const loadPrograms = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");

      const todayDate = getTodaysDate();
      const [rows, todaySnapshots] = await Promise.all([
        programService.getProgramsOverview(db),
        programService.getTodayProgramSnapshots(db, { date: todayDate }),
      ]);

      setPrograms(
        rows.map((program) => ({
          ...program,
          end_date: getProgramEndDate(program.start_date, program.day_count),
        }))
      );

      // Only unfinished sessions count - a program whose day is already done
      // has nothing to continue, so its card falls back to "Open program".
      const nextWorkoutByProgram = {};

      for (const snapshot of todaySnapshots) {
        const workout = snapshot.workouts.find(
          (candidate) => Number(candidate.done) !== 1
        );

        if (!workout) {
          continue;
        }

        nextWorkoutByProgram[snapshot.program.program_id] = {
          workout_id: workout.workout_id,
          workout_label: workout.label,
          workout_type: workout.workout_type ?? workout.label ?? "Resistance",
          day: snapshot.day?.Weekday,
          date: todayDate,
        };
      }

      setTodayWorkoutByProgramId(nextWorkoutByProgram);
    } catch (error) {
      console.error("Error loading programs", error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Your programs could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  const refreshPrograms = () => {
    setRefreshing(true);
    loadPrograms();
  };

  useEffect(() => {
    loadPrograms({ showLoader: true });
  }, [loadPrograms, refreshKey]);

  useFocusEffect(
    useCallback(() => {
      if (!hasHandledInitialFocusRef.current) {
        hasHandledInitialFocusRef.current = true;
        return undefined;
      }

      loadPrograms();
      return undefined;
    }, [loadPrograms])
  );

  const openProgram = (program) => {
    navigation.navigate("ProgramOverviewPage", {
      program_id: program.program_id,
      program_name: program.program_name,
      start_date: program.start_date,
    });
  };

  const continueTraining = (program) => {
    const todayWorkout = todayWorkoutByProgramId[program.program_id];

    if (!todayWorkout) {
      openProgram(program);
      return;
    }

    navigation.navigate("WorkoutPage", {
      ...todayWorkout,
      program_id: program.program_id,
    });
  };

  const startProgram = async (selectedWeek) => {
    if (!startProgramTarget || isStartingProgram) {
      return;
    }

    try {
      setIsStartingProgram(true);
      await programService.startProgram(db, {
        programId: startProgramTarget.program_id,
        startDate: formatDate(selectedWeek),
      });

      setStartProgramTarget(null);
      await loadPrograms();
    } catch (error) {
      console.error("startProgram failed:", error);
    } finally {
      setIsStartingProgram(false);
    }
  };

  const isInitialLoading = loading && programs.length === 0;
  const skeletonTone = withAlpha(theme.title, 0.07);
  const filteredPrograms =
    statusFilter === "ALL"
      ? programs
      : programs.filter((program) => program.status === statusFilter);
  const activeFilterLabel =
    STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label ?? "";

  return (
    <ScrollView
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshPrograms}
          tintColor={theme.primary}
          colors={[theme.primary]}
          progressBackgroundColor={theme.cardBackground}
        />
      }
    >
      {(programs.length > 0 || isInitialLoading) && (
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => {
            const isSelected = statusFilter === filter.key;

            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setStatusFilter(filter.key)}
                style={[
                  styles.filterChip,
                  isSelected
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      }
                    : {
                        backgroundColor: theme.chipBackground,
                        borderColor: theme.cardBorder,
                      },
                ]}
              >
                {isSelected ? (
                  <Checkmark
                    width={12}
                    height={12}
                    color={theme.ink}
                    thickness={3}
                  />
                ) : null}

                <ThemedText
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                  setColor={isSelected ? theme.ink : theme.text}
                >
                  {filter.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.listHeader}>
        <ThemedText style={styles.listHeaderLabel} setColor={theme.quietText}>
          Your programs
        </ThemedText>
        <View
          style={[styles.countBadge, { backgroundColor: theme.chipBackground }]}
        >
          <ThemedText style={styles.countBadgeText} setColor={theme.text}>
            {isInitialLoading ? "-" : filteredPrograms.length}
          </ThemedText>
        </View>
      </View>

      {errorMessage ? (
        <ThemedCard style={styles.errorCard}>
          <View style={styles.errorContent}>
            <ThemedTitle type="h3" style={styles.errorTitle}>
              Programs unavailable
            </ThemedTitle>

            <ThemedText style={styles.errorText} setColor={theme.quietText}>
              {errorMessage}
            </ThemedText>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.84}
              disabled={loading}
              onPress={() => loadPrograms({ showLoader: true })}
              style={[styles.errorAction, { backgroundColor: theme.primary }]}
            >
              <ThemedText
                style={styles.errorActionText}
                setColor={theme.textInverted ?? theme.cardBackground}
              >
                Try again
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedCard>
      ) : null}

      {isInitialLoading
        ? [0, 1].map((skeletonIndex) => (
            <View
              key={`skeleton-${skeletonIndex}`}
              style={[
                styles.skeletonCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.skeletonCover,
                  { backgroundColor: skeletonTone },
                ]}
              />

              <View style={styles.skeletonBody}>
                <View
                  style={[
                    styles.skeletonLine,
                    styles.skeletonLineShort,
                    { backgroundColor: skeletonTone },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    styles.skeletonLineTitle,
                    { backgroundColor: skeletonTone },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    styles.skeletonLineWide,
                    { backgroundColor: skeletonTone },
                  ]}
                />
                <View
                  style={[styles.skeletonBar, { backgroundColor: skeletonTone }]}
                />
              </View>
            </View>
          ))
        : null}

      {filteredPrograms.map((item) => {
        const totalWorkouts = Number(item.workout_count) || 0;
        const completedWorkouts = Number(item.completed_workout_count) || 0;
        const isDraft = item.status === "NOT_STARTED";
        const isCompleted =
          item.status === "COMPLETE" ||
          (!isDraft &&
            totalWorkouts > 0 &&
            completedWorkouts >= totalWorkouts);
        const progressPercent = isCompleted
          ? 100
          : !isDraft && totalWorkouts > 0
          ? Math.min(
              100,
              Math.round((completedWorkouts / totalWorkouts) * 100)
            )
          : 0;
        const dateRange = isDraft
          ? "DRAFT"
          : getProgramDateRange(item.start_date, item.end_date);
        const workoutTypes = parseWorkoutTypes(item.workout_types);
        const primaryWorkoutType = workoutTypes[0] ?? null;
        const workoutIcon = getWorkoutIconConfig(primaryWorkoutType);
        const WorkoutIcon = workoutIcon?.Icon;
        const coverImage = getWorkoutCoverImage(primaryWorkoutType);
        const cardIconColor = theme.title;
        // Active/complete get a colored left rail + matching border so the
        // status reads at a glance; draft keeps the neutral hairline.
        const statusAccent = isCompleted
          ? theme.secondary
          : isDraft
          ? null
          : theme.primary;

        return (
          <ThemedCard
            key={item.program_id}
            style={[
              styles.card,
              statusAccent ? { borderColor: statusAccent } : null,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => openProgram(item)}
            >
              <View style={styles.cover}>
                <Image
                  source={coverImage}
                  resizeMode="cover"
                  style={styles.coverImage}
                />
                <CoverGradient
                  color={theme.cardBackground}
                  stops={[
                    { offset: "20%", opacity: isCompleted ? 0.25 : 0.1 },
                    { offset: "100%", opacity: 1 },
                  ]}
                />

                {isDraft ? (
                  <StatusPill
                    label="DRAFT"
                    color={theme.quietText}
                    backgroundColor={theme.chipBackground}
                    style={styles.statusPill}
                  />
                ) : isCompleted ? (
                  <View
                    style={[
                      styles.statusPill,
                      styles.statusPillComplete,
                      { backgroundColor: withAlpha(theme.secondary, 0.95) },
                    ]}
                  >
                    <Checkmark
                      width={11}
                      height={11}
                      color={theme.inkOnSecondary ?? "#0C1410"}
                      thickness={3}
                    />
                    <ThemedText
                      style={styles.statusPillLabel}
                      setColor={theme.inkOnSecondary ?? "#0C1410"}
                    >
                      COMPLETE
                    </ThemedText>
                  </View>
                ) : (
                  <StatusPill
                    label="ACTIVE"
                    color={theme.ink}
                    backgroundColor={withAlpha(theme.primary, 0.95)}
                    dotSize={5}
                    style={styles.statusPill}
                  />
                )}

                {primaryWorkoutType ? (
                  <View
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: typePillGlass.background,
                        borderColor: typePillGlass.border,
                      },
                    ]}
                  >
                    {WorkoutIcon ? (
                      <WorkoutIcon
                        width={12}
                        height={12}
                        color={cardIconColor}
                        primaryColor={cardIconColor}
                      />
                    ) : null}
                    <ThemedText
                      style={styles.typePillLabel}
                      setColor={cardIconColor}
                      numberOfLines={1}
                    >
                      {primaryWorkoutType}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.body}>
                <View style={styles.titleGroup}>
                  {dateRange ? (
                    <ThemedText
                      style={styles.dateRange}
                      setColor={theme.quietText}
                      numberOfLines={1}
                    >
                      {dateRange}
                    </ThemedText>
                  ) : null}

                  <ThemedText
                    style={styles.title}
                    setColor={theme.title}
                    numberOfLines={2}
                  >
                    {item.program_name || "Untitled program"}
                  </ThemedText>
                </View>

                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaText} setColor={theme.text}>
                    <ThemedText
                      style={styles.metaNumber}
                      setColor={theme.title}
                    >
                      {item.mesocycle_count}
                    </ThemedText>{" "}
                    {item.mesocycle_count === 1 ? "block" : "blocks"}
                  </ThemedText>
                  <View
                    style={[
                      styles.metaDot,
                      { backgroundColor: theme.textDisabled },
                    ]}
                  />
                  <ThemedText style={styles.metaText} setColor={theme.text}>
                    <ThemedText
                      style={styles.metaNumber}
                      setColor={theme.title}
                    >
                      {item.week_count}
                    </ThemedText>{" "}
                    {item.week_count === 1 ? "week" : "weeks"}
                  </ThemedText>
                  <View
                    style={[
                      styles.metaDot,
                      { backgroundColor: theme.textDisabled },
                    ]}
                  />
                  <ThemedText style={styles.metaText} setColor={theme.text}>
                    <ThemedText
                      style={styles.metaNumber}
                      setColor={theme.title}
                    >
                      {completedWorkouts}
                    </ThemedText>
                    /{totalWorkouts}{" "}
                    {totalWorkouts === 1 ? "workout" : "workouts"}
                  </ThemedText>
                </View>

                <View style={styles.progressGroup}>
                  <View style={styles.progressHeaderRow}>
                    <ThemedText
                      style={styles.progressLabel}
                      setColor={theme.quietText}
                    >
                      Progress
                    </ThemedText>

                    {isCompleted ? (
                      <View style={styles.progressCompleteRow}>
                        <Checkmark
                          width={11}
                          height={11}
                          color={theme.secondary}
                          thickness={2.6}
                        />
                        <ThemedText
                          style={styles.progressPercent}
                          setColor={theme.secondary}
                        >
                          100%
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText
                        style={styles.progressPercent}
                        setColor={primaryTextColor}
                      >
                        {progressPercent}%
                      </ThemedText>
                    )}
                  </View>

                  <ProgressBar
                    progress={progressPercent / 100}
                    height={6}
                    trackColor={theme.cardBorder}
                    fillColor={isCompleted ? theme.secondary : theme.primary}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {isDraft ? (
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  activeOpacity={0.84}
                  accessibilityRole="button"
                  onPress={() => setStartProgramTarget(item)}
                  style={[
                    styles.cardAction,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: withAlpha(theme.primary, 0.5),
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.cardActionText}
                    setColor={primaryTextColor}
                  >
                    Start program
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : isCompleted ? null : (
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  activeOpacity={0.84}
                  accessibilityRole="button"
                  onPress={() => continueTraining(item)}
                  style={[
                    styles.cardAction,
                    {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.cardActionText}
                    setColor={theme.ink}
                  >
                    {todayWorkoutByProgramId[item.program_id]
                      ? "Continue training"
                      : "Open program"}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {statusAccent ? (
              <View
                pointerEvents="none"
                style={[styles.statusRail, { backgroundColor: statusAccent }]}
              />
            ) : null}
          </ThemedCard>
        );
      })}

      {programs.length === 0 && !isInitialLoading && !errorMessage && (
        <ThemedCard style={styles.emptyCard}>
          <View style={styles.emptyContent}>
            <ThemedText style={styles.emptyText} setColor={theme.quietText}>
              No programs found.
            </ThemedText>

            <ThemedText style={styles.emptySubtext} setColor={theme.title}>
              Start by creating your first program.
            </ThemedText>

            <ThemedButton
              title="Create first program"
              onPress={onCreateProgram}
              fullWidth
            />
          </View>
        </ThemedCard>
      )}

      <StartProgramModal
        visible={Boolean(startProgramTarget)}
        onClose={() => {
          if (!isStartingProgram) {
            setStartProgramTarget(null);
          }
        }}
        onStart={startProgram}
        isStarting={isStartingProgram}
      />

      {programs.length > 0 && !loading && filteredPrograms.length === 0 && (
        <View style={styles.filteredEmpty}>
          <ThemedText
            style={styles.filteredEmptyText}
            setColor={theme.quietText}
          >
            No {activeFilterLabel.toLowerCase()} programs
          </ThemedText>

          {/* Without this the filter is a dead end: nothing on screen says how
              to get back to the full list. */}
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="button"
            onPress={() => setStatusFilter("ALL")}
            style={[
              styles.filteredEmptyAction,
              {
                backgroundColor: withAlpha(theme.primary, 0.12),
                borderColor: withAlpha(theme.primary, 0.45),
              },
            ]}
          >
            <ThemedText
              style={styles.filteredEmptyActionText}
              setColor={primaryTextColor}
            >
              Show all programs
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

export default ProgramList;
