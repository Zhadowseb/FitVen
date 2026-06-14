import { StatusBar } from "expo-status-bar";
import {
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./ExerciseLibraryPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import HomeImageShortcutCard from "../../Resources/Components/HomeImageShortcutCard/HomeImageShortcutCard";
import SicknessLogCard from "../../Resources/Components/SicknessLogCard/SicknessLogCard";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { programService, weightliftingService } from "../../Services";
import {
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const programsHeroImage = require("../../../assets/programs-hero.jpg");
const exerciseLibraryHeroImage = require("../../../assets/exercise-library-hero.jpg");
const personalRecordsHeroImage = require("../../../assets/personal-records-hero.jpg");
const workoutCalendarDarkImage = require("../../Resources/Images/DarkVersion/workout calender dark.png");
const calculatorDarkImage = require("../../Resources/Images/DarkVersion/Calculator.png");
const programsHeroFadeStops = [
  0,
  0.03,
  0.08,
  0.15,
  0.24,
  0.35,
  0.48,
  0.62,
  0.76,
  0.88,
  0.96,
  1,
];

const ExerciseLibraryPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [quickAccessStats, setQuickAccessStats] = useState({
    programCount: 0,
    completedProgramCount: 0,
    exerciseCount: 0,
    recordExerciseCount: 0,
    recordSlotCount: 0,
  });
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const libraryMetricSurface =
    theme.libraryMetricBackground ?? "rgba(26, 32, 45, 0.92)";
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardTextColor = theme.cardBackground ?? theme.textInverted ?? "#1b1918";

  const loadQuickAccessStats = useCallback(async () => {
    try {
      const [programs, exerciseRows, personalRecordRows] = await Promise.all([
        programService.getProgramsOverview(db),
        weightliftingService.getExerciseStorage(db),
        weightliftingService.getPersonalRecordExerciseSummaries(db),
      ]);

      setQuickAccessStats({
        programCount: programs.length,
        completedProgramCount: programs.filter(
          (program) => program.status === "COMPLETE"
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
        completedProgramCount: 0,
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

  const quickAccessCards = [
    {
      key: "programs",
      variant: "programsHero",
      eyebrow: "PROGRAMS",
      title: "Manage your programs",
      description:
        "Create, edit and manage your programs, and keep your templates close as your library grows.",
      accent: primaryColor,
      actionBorder: "rgba(247, 116, 46, 0.28)",
      onPress: () => navigation.navigate("ProgramPage"),
      metrics: [
        { label: "Total", value: quickAccessStats.programCount },
        { label: "Completed", value: quickAccessStats.completedProgramCount },
        { label: "Templates", value: 0 },
      ],
      footer: "Open programs",
    },
    {
      key: "personal-records",
      variant: "personalRecordsHero",
      eyebrow: "PERSONAL RECORDS",
      title: "Track your best lifts",
      description:
        "See your strongest reps across every rep range and watch your numbers climb over time.",
      accent: primaryColor,
      actionBorder: "rgba(247, 116, 46, 0.28)",
      onPress: () => navigation.navigate("PersonalRecordsPage"),
      metrics: [
        { label: "Exercises", value: quickAccessStats.recordExerciseCount },
        { label: "Records", value: quickAccessStats.recordSlotCount },
      ],
      footer: "Open records",
    },
    {
      key: "exercise-library",
      variant: "exerciseLibraryHero",
      eyebrow: "EXERCISE LIBRARY",
      title: "Browse your catalog",
      description:
        "Search the shared catalog, filter by broad training groups, and create your own exercises.",
      accent: secondaryColor,
      actionBorder: "rgba(96, 218, 172, 0.28)",
      onPress: () => navigation.navigate("ExerciseCatalogPage"),
      metrics: [
        { label: "Exercises", value: quickAccessStats.exerciseCount },
        { label: "Custom", value: 0 },
      ],
      footer: "Open catalog",
    },
  ];

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.trainShortcutRow}>
          <SicknessLogCard />

          <HomeImageShortcutCard
            accessibilityLabel="Open workout calendar"
            imageSource={workoutCalendarDarkImage}
            onPress={() => navigation.navigate("WorkoutCalendarPage")}
            title="Workout Calendar"
          />
        </View>

        <View style={styles.trainShortcutRow}>
          <HomeImageShortcutCard
            accentColor={secondaryColor}
            accessibilityLabel="Open one rep max calculator"
            imageSource={calculatorDarkImage}
            onPress={() => navigation.navigate("OneRepMaxCalculatorPage")}
            title="1RM Calculator"
          />
        </View>

        <View style={styles.quickAccessSection}>
          <View style={styles.quickAccessGrid}>
            {quickAccessCards.map((card) => {
              const CardWrapper = card.onPress ? TouchableOpacity : View;
              const wrapperProps = card.onPress
                ? {
                    activeOpacity: 0.92,
                    onPress: card.onPress,
                  }
                : {};
              const isProgramsHero = card.variant === "programsHero";
              const isExerciseLibraryHero =
                card.variant === "exerciseLibraryHero";
              const isPersonalRecordsHero =
                card.variant === "personalRecordsHero";

              if (isProgramsHero) {
                return (
                  <CardWrapper
                    key={card.key}
                    {...wrapperProps}
                    style={[
                      styles.quickAccessCard,
                      styles.programsHeroCard,
                      {
                        backgroundColor: cardSurface,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                      },
                    ]}
                  >
                    <ImageBackground
                      source={programsHeroImage}
                      resizeMode="cover"
                      style={styles.programsHeroImage}
                      imageStyle={styles.programsHeroImageAsset}
                    >
                      <View style={styles.programsHeroImageShade} />
                    </ImageBackground>

                    <View
                      pointerEvents="none"
                      style={styles.programsHeroImageFade}
                    >
                      {programsHeroFadeStops.map((opacity, index) => (
                        <View
                          key={`programs-hero-fade-${index}`}
                          style={[
                            styles.programsHeroImageFadeStep,
                            {
                              backgroundColor: cardSurface,
                              opacity,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <View
                      pointerEvents="none"
                      style={[
                        styles.quickAccessAccent,
                        styles.programsHeroTopAccent,
                        { backgroundColor: card.accent },
                      ]}
                    />

                    <View style={styles.programsHeroTopRow}>
                      <View style={styles.programsHeroEyebrowRow}>
                        <View
                          style={[
                            styles.programsHeroEyebrowDot,
                            { backgroundColor: card.accent },
                          ]}
                        />
                        <ThemedText
                          style={styles.programsHeroEyebrow}
                          setColor={card.accent}
                        >
                          {card.eyebrow}
                        </ThemedText>
                      </View>

                      <View
                        pointerEvents="none"
                        style={[
                          styles.programsHeroAction,
                          {
                            backgroundColor: "rgba(0, 0, 0, 0.38)",
                            borderColor: card.actionBorder,
                          },
                        ]}
                      >
                        <TailArrowUpRight
                          width={17}
                          height={17}
                          stroke={card.accent}
                        />
                      </View>
                    </View>

                    <View style={styles.programsHeroContent}>
                      <ThemedTitle
                        type="h3"
                        style={styles.programsHeroTitle}
                      >
                        {card.title}
                      </ThemedTitle>

                      <ThemedText
                        style={styles.programsHeroDescription}
                        setColor="#7892ba"
                      >
                        {card.description}
                      </ThemedText>

                      <View style={styles.programsHeroMetricsRow}>
                        {card.metrics.map((metric) => (
                          <View
                            key={`${card.key}-${metric.label}`}
                            style={[
                              styles.programsHeroMetricCard,
                              styles.heroMetricCardCentered,
                              { backgroundColor: libraryMetricSurface },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.programsHeroMetricValue,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor="#ffffff"
                            >
                              {metric.value}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.programsHeroMetricLabel,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor={card.accent}
                            >
                              {metric.label}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </CardWrapper>
                );
              }

              if (isExerciseLibraryHero) {
                return (
                  <CardWrapper
                    key={card.key}
                    {...wrapperProps}
                    style={[
                      styles.quickAccessCard,
                      styles.exerciseLibraryHeroCard,
                      {
                        backgroundColor: cardSurface,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                      },
                    ]}
                  >
                    <View
                      pointerEvents="none"
                      style={[
                        styles.quickAccessAccent,
                        styles.exerciseLibraryHeroTopAccent,
                        { backgroundColor: card.accent },
                      ]}
                    />

                    <View style={styles.exerciseLibraryHeroTopRow}>
                      <View style={styles.exerciseLibraryHeroEyebrowRow}>
                        <View
                          style={[
                            styles.exerciseLibraryHeroEyebrowDot,
                            { backgroundColor: card.accent },
                          ]}
                        />
                        <ThemedText
                          style={styles.exerciseLibraryHeroEyebrow}
                          setColor={card.accent}
                        >
                          {card.eyebrow}
                        </ThemedText>
                      </View>

                      <View
                        pointerEvents="none"
                        style={[
                          styles.exerciseLibraryHeroAction,
                          {
                            backgroundColor: "rgba(0, 0, 0, 0.38)",
                            borderColor: card.actionBorder,
                          },
                        ]}
                      >
                        <TailArrowUpRight
                          width={17}
                          height={17}
                          stroke={card.accent}
                        />
                      </View>
                    </View>

                    <ImageBackground
                      source={exerciseLibraryHeroImage}
                      resizeMode="cover"
                      style={styles.exerciseLibraryHeroImage}
                      imageStyle={styles.exerciseLibraryHeroImageAsset}
                    >
                      <View
                        style={[
                          styles.exerciseLibraryHeroImageShade,
                          { backgroundColor: cardSurface },
                        ]}
                      />
                    </ImageBackground>

                    <View
                      pointerEvents="none"
                      style={styles.exerciseLibraryHeroImageFade}
                    >
                      {programsHeroFadeStops.map((opacity, index) => (
                        <View
                          key={`exercise-library-hero-fade-${index}`}
                          style={[
                            styles.programsHeroImageFadeStep,
                            {
                              backgroundColor: cardSurface,
                              opacity,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.exerciseLibraryHeroContent}>
                      <ThemedTitle
                        type="h3"
                        style={styles.exerciseLibraryHeroTitle}
                      >
                        {card.title}
                      </ThemedTitle>

                      <ThemedText
                        style={styles.exerciseLibraryHeroDescription}
                        setColor="#7892ba"
                      >
                        {card.description}
                      </ThemedText>

                      <View style={styles.exerciseLibraryHeroMetricsRow}>
                        {card.metrics.map((metric) => (
                          <View
                            key={`${card.key}-${metric.label}`}
                            style={[
                              styles.exerciseLibraryHeroMetricCard,
                              styles.heroMetricCardCentered,
                              {
                                backgroundColor: libraryMetricSurface,
                                borderColor: cardBorder,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.exerciseLibraryHeroMetricValue,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor="#ffffff"
                            >
                              {metric.value}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.exerciseLibraryHeroMetricLabel,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor={card.accent}
                            >
                              {metric.label}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </CardWrapper>
                );
              }

              if (isPersonalRecordsHero) {
                return (
                  <CardWrapper
                    key={card.key}
                    {...wrapperProps}
                    style={[
                      styles.quickAccessCard,
                      styles.personalRecordsHeroCard,
                      {
                        backgroundColor: cardSurface,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                      },
                    ]}
                  >
                    <View
                      pointerEvents="none"
                      style={[
                        styles.quickAccessAccent,
                        styles.personalRecordsHeroTopAccent,
                        { backgroundColor: card.accent },
                      ]}
                    />

                    <View style={styles.personalRecordsHeroTopRow}>
                      <View style={styles.personalRecordsHeroEyebrowRow}>
                        <View
                          style={[
                            styles.personalRecordsHeroEyebrowDot,
                            { backgroundColor: card.accent },
                          ]}
                        />
                        <ThemedText
                          style={styles.personalRecordsHeroEyebrow}
                          setColor={card.accent}
                        >
                          {card.eyebrow}
                        </ThemedText>
                      </View>

                      <View
                        pointerEvents="none"
                        style={[
                          styles.personalRecordsHeroAction,
                          {
                            backgroundColor: "rgba(0, 0, 0, 0.38)",
                            borderColor: card.actionBorder,
                          },
                        ]}
                      >
                        <TailArrowUpRight
                          width={17}
                          height={17}
                          stroke={card.accent}
                        />
                      </View>
                    </View>

                    <ImageBackground
                      source={personalRecordsHeroImage}
                      resizeMode="cover"
                      style={styles.personalRecordsHeroImage}
                      imageStyle={styles.personalRecordsHeroImageAsset}
                    >
                      <View
                        style={[
                          styles.personalRecordsHeroImageShade,
                          { backgroundColor: cardSurface },
                        ]}
                      />
                    </ImageBackground>

                    <View
                      pointerEvents="none"
                      style={styles.personalRecordsHeroImageFade}
                    >
                      {programsHeroFadeStops.map((opacity, index) => (
                        <View
                          key={`personal-records-hero-fade-${index}`}
                          style={[
                            styles.programsHeroImageFadeStep,
                            {
                              backgroundColor: cardSurface,
                              opacity,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.personalRecordsHeroContent}>
                      <ThemedTitle
                        type="h3"
                        style={styles.personalRecordsHeroTitle}
                      >
                        {card.title}
                      </ThemedTitle>

                      <ThemedText
                        style={styles.personalRecordsHeroDescription}
                        setColor="#7892ba"
                      >
                        {card.description}
                      </ThemedText>

                      <View style={styles.quickAccessMetricsRow}>
                        {card.metrics.map((metric) => (
                          <View
                            key={`${card.key}-${metric.label}`}
                            style={[
                              styles.quickAccessMetricCard,
                              styles.heroMetricCardCentered,
                              {
                                backgroundColor: libraryMetricSurface,
                                borderColor: cardBorder,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.quickAccessMetricValue,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor={titleColor}
                            >
                              {metric.value}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.quickAccessMetricLabel,
                                styles.heroMetricTextCentered,
                              ]}
                              setColor={card.accent}
                            >
                              {metric.label}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </CardWrapper>
                );
              }

              return (
                <CardWrapper
                  key={card.key}
                  {...wrapperProps}
                  style={[
                    styles.quickAccessCard,
                    {
                      backgroundColor: cardSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.quickAccessAccent,
                      { backgroundColor: card.accent },
                    ]}
                  />

                  <View style={styles.quickAccessCardHeader}>
                    <ThemedText
                      style={styles.quickAccessCardEyebrow}
                      setColor={card.accent}
                    >
                      {card.eyebrow}
                    </ThemedText>
                    <ThemedTitle
                      type="h3"
                      style={[styles.quickAccessCardTitle, { color: titleColor }]}
                    >
                      {card.title}
                    </ThemedTitle>
                  </View>

                  <ThemedText
                    style={styles.quickAccessCardDescription}
                    setColor={quietText}
                  >
                    {card.description}
                  </ThemedText>

                  <View style={styles.quickAccessMetricsRow}>
                    {card.metrics.map((metric) => (
                      <View
                        key={`${card.key}-${metric.label}`}
                        style={[
                          styles.quickAccessMetricCard,
                          {
                            backgroundColor: libraryMetricSurface,
                            borderColor: cardBorder,
                          },
                        ]}
                      >
                        <ThemedText
                          style={styles.quickAccessMetricValue}
                          setColor={titleColor}
                        >
                          {metric.value}
                        </ThemedText>
                        <ThemedText
                          style={styles.quickAccessMetricLabel}
                          setColor={card.accent}
                        >
                          {metric.label}
                        </ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={styles.quickAccessFooter}>
                    <ThemedText
                      style={styles.quickAccessFooterText}
                      setColor={cardTextColor}
                    >
                      {card.footer}
                    </ThemedText>
                    <View
                      style={[
                        styles.quickAccessFooterAccent,
                        { backgroundColor: card.accent },
                      ]}
                    />
                  </View>

                </CardWrapper>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseLibraryPage;
