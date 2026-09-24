import { StatusBar } from "expo-status-bar";
import {
  Image,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./ExerciseLibraryPageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import CoverGradient from "../../Resources/Components/CoverGradient";
import PageSummary from "../../Resources/Components/PageSummary/PageSummary";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Layers from "../../Resources/Icons/UI-icons/Layers";
import Star from "../../Resources/Icons/UI-icons/Star";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import Calender from "../../Resources/Icons/UI-icons/Calender";
import Thermostat from "../../Resources/Icons/UI-icons/Thermostat";
import TradeUp from "../../Resources/Icons/UI-icons/TradeUp";
import { programService, weightliftingService } from "../../Services";
import {
  addDays,
  formatDate,
  getCurrentWeekRange,
  normalizeIsoDateString,
  parseCustomDate,
} from "../../Utils/dateUtils";
import { ThemedText, ThemedView } from "../../Resources/ThemedComponents";

const programsCoverImage = require("../../Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-e32a-48a8-a731-95ca73deeabd.jpg");
const workoutsCoverImage = require("../../Resources/Images/WorkoutTypes/Default/download.jpg");
const calendarCoverImage = require("../../Resources/Images/Tools/calendar-cover.jpg");

const emptyWeekSummary = {
  planned: null,
  completed: null,
  nextLabel: null,
};

const ExerciseLibraryPage = () => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [quickAccessStats, setQuickAccessStats] = useState({
    programCount: 0,
    activeProgramCount: 0,
    exerciseCount: 0,
    recordExerciseCount: 0,
    recordSlotCount: 0,
    workoutCount: 0,
    completedWorkoutCount: 0,
  });
  // Absent until the query answers, so the summary shows dashes rather than a
  // confident "0 of 0 this week" that is replaced a moment later.
  const [weekSummary, setWeekSummary] = useState(emptyWeekSummary);

  const loadQuickAccessStats = useCallback(async () => {
    const today = parseCustomDate(formatDate(new Date()));
    const { monday, sunday } = getCurrentWeekRange(today);

    try {
      const [
        programs,
        exerciseRows,
        personalRecordRows,
        workoutCounts,
        weekWorkouts,
        nextWorkout,
      ] = await Promise.all([
        programService.getProgramsOverview(db),
        weightliftingService.getExerciseStorage(db),
        weightliftingService.getPersonalRecordExerciseSummaries(db),
        programService.getWorkoutLibraryCounts(db),
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: normalizeIsoDateString(formatDate(monday)),
          endIsoDate: normalizeIsoDateString(formatDate(sunday)),
        }),
        programService.getNextUnfinishedCalendarWorkout(db, {
          startIsoDate: normalizeIsoDateString(formatDate(addDays(today, 1))),
          endIsoDate: normalizeIsoDateString(formatDate(addDays(today, 180))),
        }),
      ]);

      setQuickAccessStats({
        programCount: programs.length,
        // Still read by the "N active" chip on the programs card further down.
        // It came off the summary at the top, not out of the page.
        activeProgramCount: programs.filter(
          (program) => program.status === "ACTIVE"
        ).length,
        exerciseCount: exerciseRows.length,
        recordExerciseCount: personalRecordRows.length,
        recordSlotCount: personalRecordRows.reduce(
          (total, exercise) => total + exercise.completedRecordCount,
          0
        ),
        workoutCount: workoutCounts.totalCount,
        completedWorkoutCount: workoutCounts.completedCount,
      });

      setWeekSummary({
        planned: weekWorkouts.length,
        completed: weekWorkouts.filter((workout) => Number(workout.done) === 1)
          .length,
        nextLabel:
          nextWorkout?.label ?? nextWorkout?.workout_type ?? null,
      });
    } catch (error) {
      console.error(error);
      setQuickAccessStats({
        programCount: 0,
        activeProgramCount: 0,
        exerciseCount: 0,
        recordExerciseCount: 0,
        recordSlotCount: 0,
        workoutCount: 0,
        completedWorkoutCount: 0,
      });
      setWeekSummary(emptyWeekSummary);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadQuickAccessStats();
    }, [loadQuickAccessStats])
  );

  // Programs, Your workouts and Calendar are large cards; everything else is a
  // compact row, so the daily entries are not competing with the rest.
  const toolRows = [
    {
      key: "records",
      label: t("exercises.train.recordsTool"),
      detail: t("exercises.train.recordsDetail", {
        exercises: quickAccessStats.recordExerciseCount,
        records: quickAccessStats.recordSlotCount,
      }),
      icon: <Star width={18} height={18} color={theme.planned} filled />,
      iconBackground: "rgba(242, 193, 78, 0.12)",
      onPress: () => navigation.navigate("PersonalRecordsPage"),
    },
    {
      key: "library",
      label: t("exercises.train.libraryTool"),
      detail: t("exercises.train.libraryDetail", {
        count: quickAccessStats.exerciseCount,
      }),
      icon: (
        <Dumbbell width={18} height={18} color={primaryTextColor} thickness={1.6} />
      ),
      iconBackground: withAlpha(theme.primary, 0.12),
      onPress: () => navigation.navigate("ExerciseCatalogPage"),
    },
    {
      key: "calculator",
      label: t("exercises.train.calculatorTool"),
      detail: t("exercises.train.calculatorDetail"),
      icon: <TradeUp width={18} height={18} color={theme.secondary} />,
      iconBackground: withAlpha(theme.secondary, 0.12),
      onPress: () => navigation.navigate("OneRepMaxCalculatorPage"),
    },
    {
      key: "sickness",
      label: t("exercises.train.sicknessTool"),
      detail: t("exercises.train.sicknessDetail"),
      icon: (
        <Thermostat width={18} height={18} stroke={theme.danger} color={theme.danger} />
      ),
      iconBackground: withAlpha(theme.danger, 0.12),
      onPress: () => navigation.navigate("SicknessPage"),
    },
  ];

  const neutralChipBackground = theme.chipBackground;
  const orangeChipBackground = withAlpha(theme.primary, 0.12);
  const programsPillBackground = isDark
    ? "rgba(10, 11, 15, 0.72)"
    : "rgba(255, 255, 255, 0.88)";
  const programsPillBorder = isDark
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(15, 17, 22, 0.14)";

  const weekCaption =
    weekSummary.planned === null
      ? null
      : weekSummary.planned === 0
        ? weekSummary.nextLabel
          ? t("exercises.train.nothingPlannedNext", {
              name: weekSummary.nextLabel,
            })
          : t("exercises.train.nothingPlanned")
        // Nothing when the week is finished. The line said so and said
        // nothing else - the stats above it already carry the same number.
        : weekSummary.completed >= weekSummary.planned
          ? null
          : weekSummary.nextLabel
            ? t("exercises.train.nextUp", { name: weekSummary.nextLabel })
            : null;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PageSummary
          eyebrow={t("exercises.train.eyebrow")}
          title={t("exercises.train.title")}
          stats={[
            {
              key: "programs",
              value: quickAccessStats.programCount,
              label: t("exercises.train.statPrograms"),
              tone: "primary",
            },
            {
              key: "completed",
              value: quickAccessStats.completedWorkoutCount,
              label: t("exercises.train.statCompleted"),
            },
            {
              key: "records",
              value: quickAccessStats.recordSlotCount,
              label: t("exercises.train.statRecords"),
              tone: "record",
            },
          ]}
          caption={weekCaption}
        />

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={t("exercises.train.calendarA11y")}
          onPress={() => navigation.navigate("WorkoutCalendarPage")}
          style={[
            styles.programsCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.programsImageArea}>
            <Image
              source={calendarCoverImage}
              resizeMode="cover"
              style={styles.coverImage}
              // A local JPEG decodes before the first paint, so the cross-fade
              // only shows as a flash of card background behind it.
              fadeDuration={0}
            />
            <CoverGradient
              color={theme.cardBackground}
              stops={[
                { offset: "20%", opacity: 0.15 },
                { offset: "100%", opacity: 1 },
              ]}
            />

            <View
              style={[
                styles.programsPill,
                {
                  backgroundColor: programsPillBackground,
                  borderColor: programsPillBorder,
                },
              ]}
            >
              <Calender
                width={12}
                height={12}
                stroke={primaryTextColor}
                color={primaryTextColor}
              />
              <ThemedText style={styles.programsPillText} setColor={theme.title}>
                {t("exercises.train.calendarPill")}
              </ThemedText>
            </View>
          </View>

          <View style={styles.programsBody}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleColumn}>
                <ThemedText style={styles.cardTitle} setColor={theme.title}>
                  {t("exercises.train.calendarTitle")}
                </ThemedText>
                <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                  {t("exercises.train.calendarSubtitle")}
                </ThemedText>
              </View>
              <ChevronRight
                width={18}
                height={18}
                color={theme.quietText}
                thickness={2}
              />
            </View>

            <View style={styles.chipsRow}>
              <View
                style={[styles.chip, { backgroundColor: neutralChipBackground }]}
              >
                <ThemedText style={styles.chipText} setColor={theme.text}>
                  <ThemedText style={styles.chipText} setColor={theme.title}>
                    {weekSummary.planned === null ? "–" : weekSummary.planned}
                  </ThemedText>{" "}
                  {t("exercises.train.thisWeek")}
                </ThemedText>
              </View>

              {weekSummary.completed ? (
                <View
                  style={[styles.chip, { backgroundColor: orangeChipBackground }]}
                >
                  <ThemedText style={styles.chipText} setColor={primaryTextColor}>
                    {t("exercises.train.done", { count: weekSummary.completed })}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.text}>
            {t("exercises.train.tools")}
          </ThemedText>

          {toolRows.map((tool) => (
            <TouchableOpacity
              key={tool.key}
              activeOpacity={0.9}
              accessibilityRole="button"
              onPress={tool.onPress}
              style={[
                styles.toolRow,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.toolRowIcon,
                  { backgroundColor: tool.iconBackground },
                ]}
              >
                {tool.icon}
              </View>

              <View style={styles.toolRowCopy}>
                <ThemedText style={styles.toolRowTitle} setColor={theme.title}>
                  {tool.label}
                </ThemedText>
                <ThemedText
                  style={styles.toolRowDetail}
                  setColor={theme.quietText}
                  numberOfLines={1}
                >
                  {tool.detail}
                </ThemedText>
              </View>

              <ChevronRight
                width={17}
                height={17}
                color={theme.quietText}
                thickness={2}
              />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.text}>
            {t("exercises.train.yourTraining")}
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate("ProgramPage")}
            style={[
              styles.programsCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.programsImageArea}>
              <Image
                source={programsCoverImage}
                resizeMode="cover"
                style={styles.coverImage}
                fadeDuration={0}
              />
              <CoverGradient
                color={theme.cardBackground}
                stops={[
                  { offset: "20%", opacity: 0.15 },
                  { offset: "100%", opacity: 1 },
                ]}
              />

              <View
                style={[
                  styles.programsPill,
                  {
                    backgroundColor: programsPillBackground,
                    borderColor: programsPillBorder,
                  },
                ]}
              >
                <Layers width={12} height={12} color={primaryTextColor} thickness={1.8} />
                <ThemedText style={styles.programsPillText} setColor={theme.title}>
                  {t("exercises.train.programsPill")}
                </ThemedText>
              </View>
            </View>

            <View style={styles.programsBody}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleColumn}>
                  <ThemedText style={styles.cardTitle} setColor={theme.title}>
                    {t("exercises.train.programsTitle")}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                    {t("exercises.train.programsSubtitle")}
                  </ThemedText>
                </View>
                <ChevronRight
                  width={18}
                  height={18}
                  color={theme.quietText}
                  thickness={2}
                />
              </View>

              <View style={styles.chipsRow}>
                <View
                  style={[styles.chip, { backgroundColor: neutralChipBackground }]}
                >
                  <ThemedText style={styles.chipText} setColor={theme.text}>
                    <ThemedText style={styles.chipText} setColor={theme.title}>
                      {quickAccessStats.programCount}
                    </ThemedText>{" "}
                    {t("exercises.train.total")}
                  </ThemedText>
                </View>

                {quickAccessStats.activeProgramCount > 0 ? (
                  <View
                    style={[styles.chip, { backgroundColor: orangeChipBackground }]}
                  >
                    <ThemedText style={styles.chipText} setColor={primaryTextColor}>
                      {t("exercises.train.active", {
                        count: quickAccessStats.activeProgramCount,
                      })}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate("WorkoutLibraryPage")}
            style={[
              styles.programsCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.programsImageArea}>
              <Image
                source={workoutsCoverImage}
                resizeMode="cover"
                style={styles.coverImage}
                fadeDuration={0}
              />
              <CoverGradient
                color={theme.cardBackground}
                stops={[
                  { offset: "20%", opacity: 0.15 },
                  { offset: "100%", opacity: 1 },
                ]}
              />

              <View
                style={[
                  styles.programsPill,
                  {
                    backgroundColor: programsPillBackground,
                    borderColor: programsPillBorder,
                  },
                ]}
              >
                <Dumbbell
                  width={12}
                  height={12}
                  color={primaryTextColor}
                  thickness={1.8}
                />
                <ThemedText style={styles.programsPillText} setColor={theme.title}>
                  {t("exercises.train.workoutsPill")}
                </ThemedText>
              </View>
            </View>

            <View style={styles.programsBody}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleColumn}>
                  <ThemedText style={styles.cardTitle} setColor={theme.title}>
                    {t("exercises.train.workoutsTitle")}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                    {t("exercises.train.workoutsSubtitle")}
                  </ThemedText>
                </View>
                <ChevronRight
                  width={18}
                  height={18}
                  color={theme.quietText}
                  thickness={2}
                />
              </View>

              <View style={styles.chipsRow}>
                <View
                  style={[styles.chip, { backgroundColor: neutralChipBackground }]}
                >
                  <ThemedText style={styles.chipText} setColor={theme.text}>
                    <ThemedText style={styles.chipText} setColor={theme.title}>
                      {quickAccessStats.workoutCount}
                    </ThemedText>{" "}
                    {t("exercises.train.total")}
                  </ThemedText>
                </View>

                {quickAccessStats.completedWorkoutCount > 0 ? (
                  <View
                    style={[styles.chip, { backgroundColor: orangeChipBackground }]}
                  >
                    <ThemedText style={styles.chipText} setColor={primaryTextColor}>
                      {t("exercises.train.completed", {
                        count: quickAccessStats.completedWorkoutCount,
                      })}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StatusBar style={isDark ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseLibraryPage;
