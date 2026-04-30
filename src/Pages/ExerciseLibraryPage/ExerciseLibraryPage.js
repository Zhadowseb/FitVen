import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./ExerciseLibraryPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { programService, weightliftingService } from "../../Services";
import {
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

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
  const panelSurface = theme.uiBackground ?? cardSurface;
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
      eyebrow: "PROGRAMS",
      title: "Manage your programs",
      description:
        "Create, edit and manage your programs, and keep your templates close as your library grows.",
      accent: primaryColor,
      onPress: () => navigation.navigate("ProgramPage"),
      metrics: [
        { label: "Total", value: quickAccessStats.programCount },
        { label: "Completed", value: quickAccessStats.completedProgramCount },
        { label: "Templates", value: 0 },
      ],
      footer: "Open programs",
    },
    {
      key: "exercise-library",
      eyebrow: "EXERCISE LIBRARY",
      title: "Browse your catalog",
      description:
        "Browse your exercise library, filter by muscle groups, explore what each movement trains, and create or manage your own exercises.",
      accent: secondaryColor,
      onPress: () => navigation.navigate("ExerciseCatalogPage"),
      metrics: [
        { label: "Exercises", value: quickAccessStats.exerciseCount },
        { label: "Custom exercises", value: 0 },
      ],
      footer: "Open catalog",
    },
    {
      key: "personal-records",
      eyebrow: "PERSONAL RECORDS",
      title: "Track your best lifts",
      description:
        "Review your strongest completed sets across exercises, with rep records from 1 to 10.",
      accent: primaryColor,
      onPress: () => navigation.navigate("PersonalRecordsPage"),
      metrics: [
        { label: "Exercises", value: quickAccessStats.recordExerciseCount },
        { label: "Records", value: quickAccessStats.recordSlotCount },
      ],
      footer: "Open records",
    },
  ];

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                            backgroundColor: panelSurface,
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
