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

import styles from "./ExerciseLibraryPageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import CoverGradient from "../../Resources/Components/CoverGradient";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Layers from "../../Resources/Icons/UI-icons/Layers";
import Star from "../../Resources/Icons/UI-icons/Star";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import Calender from "../../Resources/Icons/UI-icons/Calender";
import Thermostat from "../../Resources/Icons/UI-icons/Thermostat";
import TradeUp from "../../Resources/Icons/UI-icons/TradeUp";
import { programService, weightliftingService } from "../../Services";
import { ThemedText, ThemedView } from "../../Resources/ThemedComponents";

const programsCoverImage = require("../../Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-e32a-48a8-a731-95ca73deeabd.jpg");
const workoutsCoverImage = require("../../Resources/Images/WorkoutTypes/Default/download.jpg");

const ExerciseLibraryPage = () => {
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

  const loadQuickAccessStats = useCallback(async () => {
    try {
      const [programs, exerciseRows, personalRecordRows, workoutCounts] =
        await Promise.all([
          programService.getProgramsOverview(db),
          weightliftingService.getExerciseStorage(db),
          weightliftingService.getPersonalRecordExerciseSummaries(db),
          programService.getWorkoutLibraryCounts(db),
        ]);

      setQuickAccessStats({
        programCount: programs.length,
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
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadQuickAccessStats();
    }, [loadQuickAccessStats])
  );

  // Programs and Your workouts stay as large cards; everything else is a
  // compact row, so the daily entries are not competing with the rest.
  const toolRows = [
    {
      key: "records",
      label: "Personal records",
      detail: `${quickAccessStats.recordExerciseCount} exercises · ${quickAccessStats.recordSlotCount} records`,
      icon: <Star width={18} height={18} color={theme.planned} filled />,
      iconBackground: "rgba(242, 193, 78, 0.12)",
      onPress: () => navigation.navigate("PersonalRecordsPage"),
    },
    {
      key: "library",
      label: "Exercise library",
      detail: `${quickAccessStats.exerciseCount} exercises`,
      icon: (
        <Dumbbell width={18} height={18} color={primaryTextColor} thickness={1.6} />
      ),
      iconBackground: withAlpha(theme.primary, 0.12),
      onPress: () => navigation.navigate("ExerciseCatalogPage"),
    },
    {
      key: "calculator",
      label: "1RM calculator",
      detail: "Estimate your one rep max",
      icon: <TradeUp width={18} height={18} color={theme.secondary} />,
      iconBackground: withAlpha(theme.secondary, 0.12),
      onPress: () => navigation.navigate("OneRepMaxCalculatorPage"),
    },
    {
      key: "calendar",
      label: "Calendar",
      detail: "Plan and review your weeks",
      icon: (
        <Calender width={18} height={18} stroke={theme.record} color={theme.record} />
      ),
      iconBackground: withAlpha(theme.record, 0.14),
      onPress: () => navigation.navigate("WorkoutCalendarPage"),
    },
    {
      key: "sickness",
      label: "Sickness log",
      detail: "Register days you were ill",
      icon: (
        <Thermostat width={18} height={18} stroke={theme.danger} color={theme.danger} />
      ),
      iconBackground: withAlpha(theme.danger, 0.12),
      onPress: () => navigation.navigate("SicknessPage"),
    },
  ];

  const neutralChipBackground = theme.chipBackground;
  const orangeChipBackground = withAlpha(theme.primary, 0.12);
  const yellowIconSquareBackground = "rgba(242, 193, 78, 0.12)";
  const orangeIconSquareBackground = withAlpha(theme.primary, 0.12);
  const programsPillBackground = isDark
    ? "rgba(10, 11, 15, 0.72)"
    : "rgba(255, 255, 255, 0.88)";
  const programsPillBorder = isDark
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(15, 17, 22, 0.14)";

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.text}>
            Tools
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
            Your training
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
                style={{ width: "100%", height: "100%" }}
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
                  PROGRAMS
                </ThemedText>
              </View>
            </View>

            <View style={styles.programsBody}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleColumn}>
                  <ThemedText style={styles.cardTitle} setColor={theme.title}>
                    Manage your programs
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                    Plan blocks, weeks and workouts.
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
                    total
                  </ThemedText>
                </View>

                {quickAccessStats.activeProgramCount > 0 ? (
                  <View
                    style={[styles.chip, { backgroundColor: orangeChipBackground }]}
                  >
                    <ThemedText style={styles.chipText} setColor={primaryTextColor}>
                      {quickAccessStats.activeProgramCount} active
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
                style={{ width: "100%", height: "100%" }}
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
                  WORKOUTS
                </ThemedText>
              </View>
            </View>

            <View style={styles.programsBody}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleColumn}>
                  <ThemedText style={styles.cardTitle} setColor={theme.title}>
                    Your workouts
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                    Every workout you have planned or finished.
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
                    total
                  </ThemedText>
                </View>

                {quickAccessStats.completedWorkoutCount > 0 ? (
                  <View
                    style={[styles.chip, { backgroundColor: orangeChipBackground }]}
                  >
                    <ThemedText style={styles.chipText} setColor={primaryTextColor}>
                      {quickAccessStats.completedWorkoutCount} completed
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
