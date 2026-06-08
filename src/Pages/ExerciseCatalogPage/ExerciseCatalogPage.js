import { StatusBar } from "expo-status-bar";
import { Alert, ScrollView, useColorScheme } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import ExerciseLibraryList from "../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList";
import CustomExerciseModal from "./Components/CustomExerciseModal/CustomExerciseModal";
import styles from "./ExerciseCatalogPageStyle";
import {
  ThemedHeader,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { weightliftingService } from "../../Services";

const ExerciseCatalogPage = ({ route }) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectingExerciseName, setSelectingExerciseName] = useState(null);
  const [isCustomExerciseModalVisible, setIsCustomExerciseModalVisible] =
    useState(false);
  const workoutPicker = route?.params?.workoutPicker ?? null;
  const workoutPickerId = Number(workoutPicker?.workoutId);
  const isWorkoutPicker =
    Number.isFinite(workoutPickerId) && workoutPickerId > 0;

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((prev) => prev + 1);
    }, [])
  );

  const handleSelectExercise = useCallback(
    async (exercise) => {
      if (!isWorkoutPicker || selectingExerciseName) {
        return;
      }

      const exerciseName = exercise?.exercise_name;

      if (!exerciseName) {
        return;
      }

      try {
        setSelectingExerciseName(exerciseName);
        await weightliftingService.addExerciseToWorkout(db, {
          workoutId: workoutPickerId,
          exerciseName,
        });
        navigation.goBack();
      } catch (error) {
        console.error("Failed to add exercise to workout:", error);
        Alert.alert(
          "Exercise could not be added",
          "Please try again from the exercise catalog."
        );
      } finally {
        setSelectingExerciseName(null);
      }
    },
    [db, isWorkoutPicker, navigation, selectingExerciseName, workoutPickerId]
  );

  const handleCreateCustomExercise = useCallback(
    async ({ exerciseName, muscleGroupKeys }) => {
      const exercise = await weightliftingService.createCustomExercise(db, {
        exerciseName,
        muscleGroupKeys,
      });

      setRefreshKey((currentKey) => currentKey + 1);

      if (isWorkoutPicker) {
        await handleSelectExercise(exercise);
      }
    },
    [db, handleSelectExercise, isWorkoutPicker]
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      {isWorkoutPicker && (
        <ThemedHeader>
          <ThemedTitle type="h3">Add exercise</ThemedTitle>
        </ThemedHeader>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ExerciseLibraryList
          refreshKey={refreshKey}
          mode={isWorkoutPicker ? "workout-picker" : "catalog"}
          onSelectExercise={isWorkoutPicker ? handleSelectExercise : undefined}
          onAddCustomExercise={() => setIsCustomExerciseModalVisible(true)}
          selectingExerciseName={selectingExerciseName}
        />
      </ScrollView>

      <CustomExerciseModal
        visible={isCustomExerciseModalVisible}
        onClose={() => setIsCustomExerciseModalVisible(false)}
        onCreate={handleCreateCustomExercise}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseCatalogPage;
