import { Pressable, ScrollView, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useState, useEffect } from "react";

import styles from "./ExerciseLibraryListStyle";
import { weightliftingService as weightliftingRepository } from "../../../../Services";
import ExerciseMuscleModal from "../ExerciseMuscleModal/ExerciseMuscleModal";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedCard,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";

const ExerciseLibraryList = ({ refreshKey }) => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [exercises, set_exercises] = useState([]);
  const [selectedExerciseName, set_selectedExerciseName] = useState("");
  const [detailsVisible, set_detailsVisible] = useState(false);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface =
    theme.cardBackground ?? theme.navBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const rowSurface = theme.uiBackground ?? theme.navBackground ?? theme.background;
  const rowBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const badgeSurface =
    theme.primaryLight ??
    (colorScheme === "dark"
      ? "rgba(247, 116, 46, 0.18)"
      : "rgba(247, 116, 46, 0.12)");
  const indexSurface = theme.primary ?? badgeSurface;
  const indexTextColor =
    theme.cardBackground ?? theme.background ?? theme.text;
  const primaryBadgeSurface =
    theme.secondaryLight ??
    (colorScheme === "dark"
      ? "rgba(96, 218, 172, 0.18)"
      : "rgba(96, 218, 172, 0.14)");
  const secondaryBadgeSurface =
    theme.primaryLight ??
    (colorScheme === "dark"
      ? "rgba(247, 116, 46, 0.16)"
      : "rgba(247, 116, 46, 0.12)");
  const primaryBadgeText =
    theme.secondaryDark ?? theme.secondary ?? theme.text;
  const secondaryBadgeText = theme.primaryDark ?? theme.primary ?? theme.text;
  const countLabel =
    exercises.length === 1 ? "1 exercise" : `${exercises.length} exercises`;

  const loadExerciseStorage = async () => {
    try {
      const rows = await weightliftingRepository.getExerciseLibraryEntries(db);
      set_exercises(rows);
    } catch (error) {
      console.error("Error loading exercise storage", error);
    }
  };

  useEffect(() => {
    loadExerciseStorage();
  }, [refreshKey]);

  const handleOpenExerciseDetails = (exerciseName) => {
    set_selectedExerciseName(exerciseName);
    set_detailsVisible(true);
  };

  return (
    <ThemedCard
      style={[
        styles.card,
        {
          backgroundColor: cardSurface,
          borderColor: cardBorder,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText size={12} style={styles.eyebrow} setColor={quietText}>
            Catalog
          </ThemedText>
          <ThemedTitle type="h3" style={styles.title}>
            Available exercise names
          </ThemedTitle>
        </View>

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: badgeSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.countBadgeText}>
            {countLabel}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.description} setColor={quietText}>
        This library is synced from the shared cloud database whenever the app
        opens.
      </ThemedText>

      <View
        style={[
          styles.divider,
          { backgroundColor: theme.border ?? cardBorder },
        ]}
      />

      {exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedTitle type="h3" style={styles.emptyTitle}>
            No exercises yet
          </ThemedTitle>
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            No exercise names were found in the shared cloud library yet.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {exercises.map((exercise, index) => (
            <Pressable
              key={exercise.exercise_name}
              onPress={() => handleOpenExerciseDetails(exercise.exercise_name)}
              style={[
                styles.exerciseRow,
                index === exercises.length - 1 && styles.exerciseRowLast,
                {
                  backgroundColor: rowSurface,
                  borderColor: rowBorder,
                },
              ]}
              android_ripple={{ color: badgeSurface }}
            >
              <View
                style={[
                  styles.exerciseIndex,
                  { backgroundColor: indexSurface },
                ]}
              >
                <ThemedText
                  style={styles.exerciseIndexText}
                  setColor={indexTextColor}
                >
                  {index + 1}
                </ThemedText>
              </View>

              <View style={styles.exerciseBody}>
                <ThemedText style={styles.exerciseName}>
                  {exercise.exercise_name}
                </ThemedText>

                <View style={styles.exerciseMetaRow}>
                  <View
                    style={[
                      styles.exerciseMetaBadge,
                      { backgroundColor: primaryBadgeSurface },
                    ]}
                  >
                    <ThemedText
                      style={styles.exerciseMetaBadgeText}
                      setColor={primaryBadgeText}
                    >
                      {exercise.primary_muscle_group_count ?? 0} primary
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.exerciseMetaBadge,
                      { backgroundColor: secondaryBadgeSurface },
                    ]}
                  >
                    <ThemedText
                      style={styles.exerciseMetaBadgeText}
                      setColor={secondaryBadgeText}
                    >
                      {exercise.secondary_muscle_group_count ?? 0} secondary
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ExerciseMuscleModal
        visible={detailsVisible}
        exerciseName={selectedExerciseName}
        onClose={() => {
          set_detailsVisible(false);
          set_selectedExerciseName("");
        }}
      />
    </ThemedCard>
  );
};

export default ExerciseLibraryList;
