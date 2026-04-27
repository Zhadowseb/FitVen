import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./ExerciseLibraryPageStyle";
import ExerciseLibraryList from "./Components/ExerciseLibraryList/ExerciseLibraryList";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { programService, weightliftingService } from "../../Services";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const ExerciseLibraryPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [refreshKey, set_refreshKey] = useState(0);
  const [quickAccessStats, setQuickAccessStats] = useState({
    programCount: 0,
    completedProgramCount: 0,
    exerciseCount: 0,
  });
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const panelSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardTextColor = theme.cardBackground ?? theme.textInverted ?? "#1b1918";

  const refresh = () => {
    set_refreshKey((prev) => prev + 1);
  };

  const loadQuickAccessStats = useCallback(async () => {
    try {
      const [programs, exerciseRows] = await Promise.all([
        programService.getProgramsOverview(db),
        weightliftingService.getExerciseStorage(db),
      ]);

      setQuickAccessStats({
        programCount: programs.length,
        completedProgramCount: programs.filter(
          (program) => program.status === "COMPLETE"
        ).length,
        exerciseCount: exerciseRows.length,
      });
    } catch (error) {
      console.error(error);
      setQuickAccessStats({
        programCount: 0,
        completedProgramCount: 0,
        exerciseCount: 0,
      });
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
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
      eyebrow: "LIBRARY",
      title: "Browse your catalog",
      description:
        "Browse your exercise library, filter by muscle groups, explore what each movement trains, and create or manage your own exercises.",
      accent: secondaryColor,
      metrics: [
        { label: "Exercises", value: quickAccessStats.exerciseCount },
        { label: "Custom exercises", value: 0 },
      ],
      footer: "You're here",
    },
  ];

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[
              styles.pageHeaderTitleEyebrow,
              { color: quietText },
            ]}
          >
            FitVen
          </ThemedText>

          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Exercise Library
          </ThemedTitle>
        </View>
      </ThemedHeader>

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

        <ExerciseLibraryList refreshKey={refreshKey} />
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseLibraryPage;
