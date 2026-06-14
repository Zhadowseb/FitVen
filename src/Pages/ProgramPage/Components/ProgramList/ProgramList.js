import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
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

const PROGRAM_COVER_IMAGES = [
  require("../../../../../assets/programs-hero.jpg"),
  require("../../../../../assets/exercise-library-hero.jpg"),
  require("../../../../../assets/personal-records-hero.jpg"),
];
const DEFAULT_PROGRAM_COVER = require("../../../../Resources/Images/WorkoutTypes/Default/download.jpg");
const RESISTANCE_PROGRAM_COVER = require("../../../../Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-e32a-48a8-a731-95ca73deeabd.png");
const RUN_PROGRAM_COVER = require("../../../../Resources/Images/WorkoutTypes/Run/program-cover-run.jpg");
const RESISTANCE_WORKOUT_TYPES = new Set([
  "Resistance",
  "StrengthTraining",
  "Upperbody",
  "Legs",
]);

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

function getProgramCoverImages(workoutTypes, programIndex) {
  if (!workoutTypes.length) {
    return [DEFAULT_PROGRAM_COVER];
  }

  return workoutTypes.map((workoutType, workoutTypeIndex) => {
    if (workoutType === "Resistance") {
      return RESISTANCE_PROGRAM_COVER;
    }

    if (workoutType === "Run") {
      return RUN_PROGRAM_COVER;
    }

    return PROGRAM_COVER_IMAGES[
      (programIndex + workoutTypeIndex) % PROGRAM_COVER_IMAGES.length
    ];
  });
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
  const coverTitleColor = "#ffffff";
  const coverQuietText = "rgba(255, 255, 255, 0.72)";
  const coverChipSurface = "rgba(5, 7, 10, 0.72)";
  const coverBorder = "rgba(255, 255, 255, 0.16)";
  const mutedTrack = "rgba(255, 255, 255, 0.2)";
  const dangerColor = theme.danger ?? Colors.dark.danger ?? "#ba0000";

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

  const getStatusPresentation = (programStatus) => {
    switch (programStatus) {
      case "COMPLETE":
        return {
          color: theme.COMPLETE ?? theme.secondary ?? "#60daac",
          isActive: false,
          toneOpacity: 0.2,
        };
      case "ACTIVE":
        return {
          color: theme.ACTIVE ?? theme.primary ?? "#f7742e",
          isActive: true,
          toneOpacity: 0.14,
        };
      default:
        return {
          color: theme.NOT_STARTED ?? theme.iconColor ?? "#9E9E9E",
          isActive: false,
          toneOpacity: 0.06,
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

      {programs.map((item, index) => {
        const totalWorkouts = Number(item.workout_count) || 0;
        const completedWorkouts = Number(item.completed_workout_count) || 0;
        const isDraft = item.status === "NOT_STARTED";
        const isCompleted = item.status === "COMPLETE";
        const hasMissingCompletedWorkouts =
          isCompleted && completedWorkouts < totalWorkouts;
        const statusPresentation = getStatusPresentation(item.status);
        const progressPercent =
          !isDraft && totalWorkouts > 0
            ? Math.min(
                100,
                Math.round((completedWorkouts / totalWorkouts) * 100)
              )
            : 0;
        const dateRange = isDraft
          ? "Draft"
          : getProgramDateRange(item.start_date, item.end_date);
        const workoutTypes = parseWorkoutTypes(item.workout_types);
        const visibleWorkoutTypes = workoutTypes.slice(0, 2);
        const hiddenWorkoutTypeCount = Math.max(workoutTypes.length - 2, 0);
        const coverImages = getProgramCoverImages(workoutTypes, index);

        return (
          <View
            key={item.program_id}
            style={[
              styles.cardDropShadow,
              { shadowColor: statusPresentation.color },
            ]}
          >
            <View
              style={[
                styles.cardGlow,
                {
                  backgroundColor: withColorAlpha(
                    statusPresentation.color,
                    0.28
                  ),
                  shadowColor: statusPresentation.color,
                },
              ]}
            >
              <ThemedCard
                style={[
                  styles.card,
                  {
                    backgroundColor: cardShell,
                    borderColor: withColorAlpha(
                      statusPresentation.color,
                      0.88
                    ),
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
                  <View style={styles.coverImage}>
                    <View pointerEvents="none" style={styles.coverImageLayer}>
                      {coverImages.map((coverImage, coverIndex) => (
                        <ImageBackground
                          key={`cover-${coverIndex}`}
                          source={coverImage}
                          resizeMode="cover"
                          style={[
                            styles.coverImageSegment,
                            coverIndex > 0
                              ? styles.coverImageSegmentDivider
                              : null,
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.coverScrim} />
                    <View
                      style={[
                        styles.coverTone,
                        {
                          backgroundColor: withColorAlpha(
                            statusPresentation.color,
                            statusPresentation.toneOpacity
                          ),
                        },
                      ]}
                    />

                    <View style={styles.coverContent}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.workoutTypeRow}>
                          {visibleWorkoutTypes.map((workoutType) => {
                            const workoutIcon =
                              getWorkoutIconConfig(workoutType);
                            const WorkoutIcon = workoutIcon?.Icon;

                            return (
                              <View
                                key={workoutType}
                                style={[
                                  styles.workoutTypeBadge,
                                  {
                                    backgroundColor: coverChipSurface,
                                    borderColor: coverBorder,
                                  },
                                ]}
                              >
                                {WorkoutIcon ? (
                                  <WorkoutIcon
                                    width={13}
                                    height={13}
                                    color={coverTitleColor}
                                    primaryColor={coverTitleColor}
                                  />
                                ) : null}
                                <ThemedText
                                  style={styles.workoutTypeText}
                                  setColor={coverTitleColor}
                                  numberOfLines={1}
                                >
                                  {workoutType}
                                </ThemedText>
                              </View>
                            );
                          })}

                          {hiddenWorkoutTypeCount > 0 ? (
                            <View
                              style={[
                                styles.workoutTypeBadge,
                                {
                                  backgroundColor: coverChipSurface,
                                  borderColor: coverBorder,
                                },
                              ]}
                            >
                              <ThemedText
                                style={styles.workoutTypeText}
                                setColor={coverTitleColor}
                              >
                                +{hiddenWorkoutTypeCount}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.cardMenuIcon}>
                          <ThreeDots
                            width={15}
                            height={15}
                            color={coverTitleColor}
                          />
                        </View>
                      </View>

                      <View style={styles.coverDetails}>
                        {dateRange ? (
                          <ThemedText
                            style={styles.dateRange}
                            setColor={coverQuietText}
                            numberOfLines={1}
                          >
                            {dateRange}
                          </ThemedText>
                        ) : null}

                        <ThemedTitle
                          type="h3"
                          style={styles.title}
                          numberOfLines={2}
                        >
                          {item.program_name || "Untitled program"}
                        </ThemedTitle>

                        <View style={styles.coverFooter}>
                          <View style={styles.metaPillRow}>
                            <View
                              style={[
                                styles.metaPill,
                                {
                                  backgroundColor: coverChipSurface,
                                  borderColor: coverBorder,
                                },
                              ]}
                            >
                              <ThemedText
                                style={styles.metaText}
                                setColor={coverQuietText}
                              >
                                <ThemedText
                                  style={styles.metaNumber}
                                  setColor={coverTitleColor}
                                >
                                  {item.mesocycle_count}
                                </ThemedText>{" "}
                                {item.mesocycle_count === 1
                                  ? "block"
                                  : "blocks"}
                              </ThemedText>
                            </View>

                            <View
                              style={[
                                styles.metaPill,
                                {
                                  backgroundColor: coverChipSurface,
                                  borderColor: coverBorder,
                                },
                              ]}
                            >
                              <Calender
                                width={11}
                                height={11}
                                color={coverQuietText}
                              />
                              <ThemedText
                                style={styles.metaText}
                                setColor={coverQuietText}
                              >
                                <ThemedText
                                  style={styles.metaNumber}
                                  setColor={coverTitleColor}
                                >
                                  {item.week_count}
                                </ThemedText>{" "}
                                {item.week_count === 1 ? "week" : "weeks"}
                              </ThemedText>
                            </View>

                            <View
                              style={[
                                styles.metaPill,
                                {
                                  backgroundColor: coverChipSurface,
                                  borderColor: hasMissingCompletedWorkouts
                                    ? dangerColor
                                    : coverBorder,
                                },
                              ]}
                            >
                              <ThemedText
                                style={styles.metaText}
                                setColor={coverQuietText}
                              >
                                <ThemedText
                                  style={styles.metaNumber}
                                  setColor={
                                    hasMissingCompletedWorkouts
                                      ? dangerColor
                                      : coverTitleColor
                                  }
                                >
                                  {completedWorkouts}
                                </ThemedText>
                                {" / "}
                                {totalWorkouts}{" "}
                                {totalWorkouts === 1 ? "workout" : "workouts"}
                              </ThemedText>
                            </View>
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
                                  width={28}
                                  height={28}
                                  color={cardShell}
                                  thickness={3}
                                />
                              </View>
                            ) : (
                              <CircularProgress
                                size={52}
                                strokeWidth={4}
                                text={String(progressPercent)}
                                caption="%"
                                textSize={14}
                                progressPercent={progressPercent}
                                bgColor={mutedTrack}
                                pgColor={statusPresentation.color}
                                centerColor="rgba(5, 7, 10, 0.88)"
                              />
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    {isCompleted || statusPresentation.isActive ? (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.statusStamp,
                          {
                            backgroundColor: withColorAlpha(
                              statusPresentation.color,
                              0.12
                            ),
                            borderColor: statusPresentation.color,
                            shadowColor: statusPresentation.color,
                          },
                        ]}
                      >
                        <ThemedText
                          style={styles.statusStampText}
                          setColor={statusPresentation.color}
                        >
                          {isCompleted ? "COMPLETE" : "ACTIVE"}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>

                  <View
                    pointerEvents="none"
                    style={[
                      styles.coverSpine,
                      { backgroundColor: statusPresentation.color },
                    ]}
                  />
                </TouchableOpacity>
              </ThemedCard>
            </View>
          </View>
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
