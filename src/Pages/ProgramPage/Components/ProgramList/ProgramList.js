import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import styles from "./ProgramListStyle";
import { programService } from "../../../../Services";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import CircularProgress from "../../../../Resources/Components/CircularProgression";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Calender from "../../../../Resources/Icons/UI-icons/Calender";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";
import { getWorkoutIconConfig } from "../../../../Resources/Icons/WorkoutLabels";
import {
  ThemedCard,
  ThemedButton,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";
import { getProgramEndDate } from "../../../../Utils/programUtils";
import { parseCustomDate } from "../../../../Utils/dateUtils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
  })} - ${formatProgramDateLabel(endDate, { includeYear: true })}`;
}

function parseWorkoutTypes(value) {
  if (!value) {
    return [];
  }

  const seenTypes = new Set();

  return String(value)
    .split(",")
    .map((type) => type.trim())
    .filter((type) => {
      if (!type || seenTypes.has(type)) {
        return false;
      }

      seenTypes.add(type);
      return true;
    });
}

function getWorkoutTypeLabel(type) {
  if (type === "Resistance" || type === "StrengthTraining") {
    return "Resistance";
  }

  return type || "Workout";
}

function withColorAlpha(color, alpha) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return color;
  }

  const hex = color.replace("#", "").slice(0, 6);

  if (hex.length !== 6) {
    return color;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const ProgramList = ({ refreshKey, onCreateProgram }) => {
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasHandledInitialFocusRef = useRef(false);

  const cardSurface =
    colorScheme === "dark" ? "#141821" : theme.cardBackground ?? "#f8f7fb";
  const quietText =
    colorScheme === "dark"
      ? "#7890b3"
      : theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardBorderFallback =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const cardShell =
    colorScheme === "dark" ? "#0E0F12" : theme.background ?? "#e0dfe8";
  const mutedChipSurface =
    colorScheme === "dark" ? "rgba(26, 32, 45, 0.92)" : "rgba(246, 246, 250, 0.96)";
  const mutedTrack =
    colorScheme === "dark" ? "#242936" : theme.uiBackground ?? "#d6d5e1";

  const loadPrograms = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await programService.getProgramsOverview(db);

      setPrograms(
        rows.map((program) => ({
          ...program,
          end_date: getProgramEndDate(program.start_date, program.day_count),
        }))
      );
    } catch (error) {
      console.error("Error loading programs", error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadPrograms();
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

  const getStatusPresentation = (status) => {
    switch (status) {
      case "ACTIVE":
        return {
          label: "ACTIVE",
          color: theme.ACTIVE ?? theme.primary ?? "#f7742e",
          cardBackground: cardSurface,
          borderColor: theme.ACTIVE ?? theme.primary ?? "#f7742e",
        };
      case "COMPLETE":
        return {
          label: "COMPLETED",
          color: theme.COMPLETE ?? theme.secondary ?? "#60daac",
          cardBackground:
            colorScheme === "dark" ? "rgba(10, 54, 43, 0.58)" : "#ecfff7",
          borderColor: theme.COMPLETE ?? theme.secondary ?? "#60daac",
        };
      case "NOT_STARTED":
      default:
        return {
          label: "DRAFT",
          color: theme.NOT_STARTED ?? theme.iconColor ?? "#9E9E9E",
          cardBackground: cardSurface,
          borderColor: cardBorderFallback,
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listContainer}>
      <View style={styles.listHeader}>
        <ThemedText style={styles.listHeaderLabel} setColor={quietText}>
          YOUR PROGRAMS
        </ThemedText>
        <ThemedText style={styles.listHeaderCount} setColor={quietText}>
          {programs.length}
        </ThemedText>
      </View>

      {programs.map((item) => {
        const statusPresentation = getStatusPresentation(item.status);
        const cardBorder =
          statusPresentation.borderColor ?? cardBorderFallback ?? statusPresentation.color;
        const totalWorkouts = Number(item.workout_count) || 0;
        const completedWorkouts = Number(item.completed_workout_count) || 0;
        const progressPercent =
          totalWorkouts > 0
            ? Math.min(100, Math.round((completedWorkouts / totalWorkouts) * 100))
            : 0;
        const dateRange = getProgramDateRange(item.start_date, item.end_date);
        const workoutTypes = parseWorkoutTypes(item.workout_types);
        const visibleWorkoutTypes = workoutTypes.slice(0, 2);
        const hiddenWorkoutTypeCount = Math.max(workoutTypes.length - 2, 0);
        const isCompleted = item.status === "COMPLETE";

        return (
          <ThemedCard
            key={item.program_id}
            style={[
              styles.card,
              {
                backgroundColor: statusPresentation.cardBackground,
                borderColor: cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.touchable}
              onPress={() =>
                navigation.navigate("ProgramOverviewPage", {
                  program_id: item.program_id,
                  program_name: item.program_name,
                  start_date: item.start_date,
                })
              }
            >
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: withColorAlpha(statusPresentation.color, 0.12),
                      borderColor: withColorAlpha(statusPresentation.color, 0.42),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusPresentation.color },
                    ]}
                  />
                  <ThemedText
                    style={styles.statusLabel}
                    setColor={statusPresentation.color}
                  >
                    {statusPresentation.label}
                  </ThemedText>
                </View>

                <View style={styles.workoutTypeRow}>
                  {visibleWorkoutTypes.map((workoutType) => {
                    const workoutIcon = getWorkoutIconConfig(workoutType);
                    const WorkoutIcon = workoutIcon?.Icon;

                    return (
                      <View
                        key={workoutType}
                        style={[
                          styles.workoutTypeBadge,
                          {
                            backgroundColor: mutedChipSurface,
                            borderColor: cardBorderFallback,
                          },
                        ]}
                      >
                        {WorkoutIcon ? (
                          <WorkoutIcon
                            width={13}
                            height={13}
                            color={quietText}
                            primaryColor={quietText}
                          />
                        ) : null}
                        <ThemedText
                          style={styles.workoutTypeText}
                          setColor={quietText}
                          numberOfLines={1}
                        >
                          {getWorkoutTypeLabel(workoutType)}
                        </ThemedText>
                      </View>
                    );
                  })}

                  {hiddenWorkoutTypeCount > 0 ? (
                    <View
                      style={[
                        styles.workoutTypeBadge,
                        {
                          backgroundColor: mutedChipSurface,
                          borderColor: cardBorderFallback,
                        },
                      ]}
                    >
                      <ThemedText
                        style={styles.workoutTypeText}
                        setColor={quietText}
                      >
                        +{hiddenWorkoutTypeCount}
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.cardMenuIcon}>
                    <ThreeDots width={14} height={14} color={quietText} />
                  </View>
                </View>
              </View>

              <View style={styles.cardBodyRow}>
                <View style={styles.programInfo}>
                  <ThemedTitle
                    type="h3"
                    style={styles.title}
                    numberOfLines={2}
                  >
                    {item.program_name || "Untitled program"}
                  </ThemedTitle>

                  {dateRange ? (
                    <ThemedText style={styles.dateRange} setColor={quietText}>
                      {dateRange}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.statusAction}>
                  {isCompleted ? (
                    <View
                      style={[
                        styles.completedCircle,
                        {
                          backgroundColor: statusPresentation.color,
                          shadowColor: statusPresentation.color,
                        },
                      ]}
                    >
                      <Checkmark
                        width={34}
                        height={34}
                        color={cardShell}
                        thickness={3}
                      />
                    </View>
                  ) : (
                    <CircularProgress
                      size={64}
                      strokeWidth={5}
                      text={String(progressPercent)}
                      caption="%"
                      textSize={17}
                      progressPercent={progressPercent}
                      bgColor={mutedTrack}
                      pgColor={statusPresentation.color}
                      centerColor={statusPresentation.cardBackground}
                    />
                  )}
                </View>
              </View>

              <View style={styles.metaPillRow}>
                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: mutedChipSurface,
                      borderColor: cardBorderFallback,
                    },
                  ]}
                >
                  <ThemedText style={styles.metaText} setColor={quietText}>
                    <ThemedText style={styles.metaNumber} setColor={titleColor}>
                      {item.mesocycle_count}
                    </ThemedText>{" "}
                    {item.mesocycle_count === 1 ? "block" : "blocks"}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: mutedChipSurface,
                      borderColor: cardBorderFallback,
                    },
                  ]}
                >
                  <Calender width={12} height={12} color={quietText} />
                  <ThemedText style={styles.metaText} setColor={quietText}>
                    <ThemedText style={styles.metaNumber} setColor={titleColor}>
                      {item.week_count}
                    </ThemedText>{" "}
                    {item.week_count === 1 ? "wk" : "wks"}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: mutedChipSurface,
                      borderColor: cardBorderFallback,
                    },
                  ]}
                >
                  <ThemedText style={styles.metaText} setColor={quietText}>
                    <ThemedText style={styles.metaNumber} setColor={titleColor}>
                      {totalWorkouts}
                    </ThemedText>{" "}
                    {totalWorkouts === 1 ? "workout" : "workouts"}
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          </ThemedCard>
        );
      })}

      {programs.length === 0 && (
        <ThemedCard
          style={[
            styles.emptyCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorderFallback ?? theme.primary,
            },
          ]}
        >
          <View style={styles.emptyContent}>
            <ThemedText style={styles.emptyText} setColor={quietText}>
              No programs found.
            </ThemedText>

            <ThemedText style={styles.emptySubtext} setColor={titleColor}>
              Start by creating your first program.
            </ThemedText>

            <ThemedButton
              title="Create first program"
              onPress={onCreateProgram}
              fullWidth
              style={[styles.emptyButton, { backgroundColor: theme.primary }]}
            />
          </View>
        </ThemedCard>
      )}
    </ScrollView>
  );
};

export default ProgramList;
