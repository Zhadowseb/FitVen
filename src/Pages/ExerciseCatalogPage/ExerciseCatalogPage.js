import { StatusBar } from "expo-status-bar";
import { Alert, ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import ExerciseLibraryList from "../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList";
import CustomExerciseModal from "./Components/CustomExerciseModal/CustomExerciseModal";
import styles from "./ExerciseCatalogPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedText,
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
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const workoutPicker = route?.params?.workoutPicker ?? null;
  const workoutPickerId = Number(workoutPicker?.workoutId);
  const isWorkoutPicker =
    Number.isFinite(workoutPickerId) && workoutPickerId > 0;
  const workoutTargetLabel =
    workoutPicker?.workoutName ??
    workoutPicker?.name ??
    workoutPicker?.title ??
    workoutPicker?.workoutTitle ??
    "workout";

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

  const exerciseList = (
    <ExerciseLibraryList
      refreshKey={refreshKey}
      mode={isWorkoutPicker ? "workout-picker" : "catalog"}
      onSelectExercise={isWorkoutPicker ? handleSelectExercise : undefined}
      onAddCustomExercise={() => setIsCustomExerciseModalVisible(true)}
      selectingExerciseName={selectingExerciseName}
      workoutPicker={workoutPicker}
    />
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          {isWorkoutPicker ? (
            <ThemedText
              style={styles.headerEyebrow}
              setColor={primaryTextColor}
              numberOfLines={1}
            >
              {`Add to ${workoutTargetLabel}`}
            </ThemedText>
          ) : null}

          <ThemedTitle
            type="pageTitle"
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {isWorkoutPicker ? "Add exercise" : "Exercises"}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {/*
        The picker scrolls its own list. A list inside a ScrollView is handed
        unlimited height and so renders every row, which is the whole reason
        the picker was slow. The catalog keeps the page scroll: its list is a
        fixed-height window with the rest of the card above it.
      */}
      {isWorkoutPicker ? (
        <View style={[styles.content, styles.scrollContent]}>{exerciseList}</View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {exerciseList}
        </ScrollView>
      )}

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
