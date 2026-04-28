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
  })} -> ${formatProgramDateLabel(endDate, { includeYear: true })}`;
}

function pluralizeCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const ProgramList = ({ refreshKey, onCreateProgram }) => {
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasHandledInitialFocusRef = useRef(false);

  const cardSurface = theme.cardBackground ?? theme.background;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardBorderFallback =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;

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
          summary: "Currently in progress",
        };
      case "COMPLETE":
        return {
          label: "COMPLETED",
          color: theme.COMPLETE ?? theme.secondary ?? "#60daac",
          summary: "Finished and ready to review",
        };
      case "NOT_STARTED":
      default:
        return {
          label: "DRAFT",
          color: theme.NOT_STARTED ?? theme.iconColor ?? "#9E9E9E",
          summary: "Not started yet",
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
        const cardBorder = cardBorderFallback ?? statusPresentation.color;
        const totalWorkouts = Number(item.workout_count) || 0;
        const completedWorkouts = Number(item.completed_workout_count) || 0;
        const progressPercent =
          totalWorkouts > 0
            ? Math.min(100, Math.round((completedWorkouts / totalWorkouts) * 100))
            : 0;
        const showProgress = item.status === "ACTIVE" && totalWorkouts > 0;
        const dateRange = getProgramDateRange(item.start_date, item.end_date);

        return (
          <ThemedCard
            key={item.program_id}
            style={[
              styles.card,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.cardAccent,
                { backgroundColor: statusPresentation.color },
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.touchable}
              onPress={() =>
                navigation.navigate("ProgramOverviewPage", {
                  program_id: item.program_id,
                  start_date: item.start_date,
                })
              }
            >
              <View style={styles.statusRow}>
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

              <ThemedTitle
                type="h3"
                style={styles.title}
                numberOfLines={1}
              >
                {item.program_name || "Untitled program"}
              </ThemedTitle>

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  <ThemedText style={styles.metaNumber} setColor={titleColor}>
                    {item.mesocycle_count}
                  </ThemedText>{" "}
                  {item.mesocycle_count === 1 ? "block" : "blocks"}
                </ThemedText>
                <ThemedText style={styles.metaSeparator} setColor={quietText}>
                  -
                </ThemedText>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  <ThemedText style={styles.metaNumber} setColor={titleColor}>
                    {item.week_count}
                  </ThemedText>{" "}
                  {item.week_count === 1 ? "week" : "weeks"}
                </ThemedText>
                <ThemedText style={styles.metaSeparator} setColor={quietText}>
                  -
                </ThemedText>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  <ThemedText style={styles.metaNumber} setColor={titleColor}>
                    {totalWorkouts}
                  </ThemedText>{" "}
                  {totalWorkouts === 1 ? "workout" : "workouts"}
                </ThemedText>
              </View>

              {showProgress ? (
                <View style={styles.progressSection}>
                  <View style={styles.progressMetaRow}>
                    <ThemedText style={styles.progressText} setColor={quietText}>
                      <ThemedText
                        style={styles.progressNumber}
                        setColor={titleColor}
                      >
                        {completedWorkouts}
                      </ThemedText>{" "}
                      / {pluralizeCount(totalWorkouts, "workout")}
                    </ThemedText>
                    <ThemedText
                      style={styles.progressPercent}
                      setColor={statusPresentation.color}
                    >
                      {progressPercent}%
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: theme.uiBackground ?? "#2f2b3d" },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: statusPresentation.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : statusPresentation.summary ? (
                <View style={styles.summaryRow}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: statusPresentation.color },
                    ]}
                  />
                  <ThemedText style={styles.summaryText} setColor={quietText}>
                    {statusPresentation.summary}
                  </ThemedText>
                </View>
              ) : null}

              {dateRange ? (
                <ThemedText style={styles.dateRange} setColor={quietText}>
                  {dateRange}
                </ThemedText>
              ) : null}
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
          <View
            pointerEvents="none"
            style={[
              styles.cardAccent,
              { backgroundColor: theme.primary ?? "#f7742e" },
            ]}
          />
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
