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
import Search from "../../Resources/Icons/UI-icons/Search";
import Layers from "../../Resources/Icons/UI-icons/Layers";
import Star from "../../Resources/Icons/UI-icons/Star";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import { programService, weightliftingService } from "../../Services";
import { ThemedText, ThemedView } from "../../Resources/ThemedComponents";

const sicknessDarkImage = require("../../Resources/Images/DarkVersion/sickness dark.png");
const workoutCalendarDarkImage = require("../../Resources/Images/DarkVersion/workout calender dark.png");
const calculatorDarkImage = require("../../Resources/Images/DarkVersion/Calculator.png");
const programsCoverImage = require("../../Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-e32a-48a8-a731-95ca73deeabd.png");

const ExerciseLibraryPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme] ?? Colors.light;

  const [quickAccessStats, setQuickAccessStats] = useState({
    programCount: 0,
    activeProgramCount: 0,
    exerciseCount: 0,
    recordExerciseCount: 0,
    recordSlotCount: 0,
  });

  const loadQuickAccessStats = useCallback(async () => {
    try {
      const [programs, exerciseRows, personalRecordRows] = await Promise.all([
        programService.getProgramsOverview(db),
        weightliftingService.getExerciseStorage(db),
        weightliftingService.getPersonalRecordExerciseSummaries(db),
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
      });
    } catch (error) {
      console.error(error);
      setQuickAccessStats({
        programCount: 0,
        activeProgramCount: 0,
        exerciseCount: 0,
        recordExerciseCount: 0,
        recordSlotCount: 0,
      });
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadQuickAccessStats();
    }, [loadQuickAccessStats])
  );

  const quickTools = [
    {
      key: "sickness",
      label: "Sickness log",
      image: sicknessDarkImage,
      onPress: () => navigation.navigate("SicknessPage"),
    },
    {
      key: "calendar",
      label: "Calendar",
      image: workoutCalendarDarkImage,
      onPress: () => navigation.navigate("WorkoutCalendarPage"),
    },
  ];

  const neutralChipBackground = theme.chipBackground ?? "rgba(255,255,255,0.06)";
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
      <View
        style={[styles.header, { borderBottomColor: theme.hairline }]}
      >
        <View style={styles.headerTextColumn}>
          <ThemedText style={styles.eyebrow} setColor={theme.quietText}>
            FitVen
          </ThemedText>
          <ThemedText style={styles.headerTitle} setColor={theme.title}>
            Training
          </ThemedText>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Search exercises"
          onPress={() => navigation.navigate("ExerciseCatalogPage")}
          style={[
            styles.searchCircle,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Search width={18} height={18} color={theme.text} thickness={1.8} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.quietText}>
            Quick tools
          </ThemedText>

          <View style={styles.quickToolsGrid}>
            {quickTools.map((tool) => (
              <TouchableOpacity
                key={tool.key}
                activeOpacity={0.92}
                onPress={tool.onPress}
                style={[
                  styles.quickToolCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.quickToolImageArea}>
                  <Image
                    source={tool.image}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                  <CoverGradient
                    color={theme.cardBackground}
                    stops={[
                      { offset: "30%", opacity: 0 },
                      { offset: "100%", opacity: 1 },
                    ]}
                  />
                </View>

                <View style={styles.quickToolFooter}>
                  <ThemedText
                    style={styles.quickToolLabel}
                    setColor={theme.title}
                    numberOfLines={1}
                  >
                    {tool.label}
                  </ThemedText>
                  <ChevronRight
                    width={15}
                    height={15}
                    color={theme.quietText}
                    thickness={2}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate("OneRepMaxCalculatorPage")}
            style={[
              styles.calculatorRow,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.calculatorThumb}>
              <Image
                source={calculatorDarkImage}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </View>

            <View style={styles.calculatorTextColumn}>
              <ThemedText style={styles.calculatorTitle} setColor={theme.title}>
                1RM Calculator
              </ThemedText>
              <ThemedText
                style={styles.calculatorSubtitle}
                setColor={theme.quietText}
              >
                Estimate your one rep max
              </ThemedText>
            </View>

            <ChevronRight
              width={17}
              height={17}
              color={theme.quietText}
              thickness={2}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.quietText}>
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
                <Layers width={12} height={12} color={theme.primary} thickness={1.8} />
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
                    <ThemedText style={styles.chipText} setColor={theme.primary}>
                      {quickAccessStats.activeProgramCount} active
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate("PersonalRecordsPage")}
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.infoCardHeaderRow}>
              <View
                style={[
                  styles.iconSquare,
                  { backgroundColor: yellowIconSquareBackground },
                ]}
              >
                <Star width={19} height={19} color={theme.planned} filled />
              </View>

              <View style={styles.cardTitleColumn}>
                <ThemedText style={styles.cardTitle} setColor={theme.title}>
                  Personal records
                </ThemedText>
                <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                  Best lifts and estimated 1RM per exercise.
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
                    {quickAccessStats.recordExerciseCount}
                  </ThemedText>{" "}
                  exercises
                </ThemedText>
              </View>

              <View
                style={[styles.chip, { backgroundColor: neutralChipBackground }]}
              >
                <ThemedText style={styles.chipText} setColor={theme.text}>
                  <ThemedText style={styles.chipText} setColor={theme.title}>
                    {quickAccessStats.recordSlotCount}
                  </ThemedText>{" "}
                  records
                </ThemedText>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate("ExerciseCatalogPage")}
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.infoCardHeaderRow}>
              <View
                style={[
                  styles.iconSquare,
                  { backgroundColor: orangeIconSquareBackground },
                ]}
              >
                <Dumbbell width={19} height={19} color={theme.primary} thickness={1.6} />
              </View>

              <View style={styles.cardTitleColumn}>
                <ThemedText style={styles.cardTitle} setColor={theme.title}>
                  Exercise library
                </ThemedText>
                <ThemedText style={styles.cardSubtitle} setColor={theme.text}>
                  All exercises with primary and secondary muscles.
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
                    {quickAccessStats.exerciseCount}
                  </ThemedText>{" "}
                  exercises
                </ThemedText>
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
