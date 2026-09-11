import { StatusBar } from "expo-status-bar";
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import ExerciseLibraryList from "../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList";
import CustomExerciseModal from "./Components/CustomExerciseModal/CustomExerciseModal";
import styles from "./ExerciseCatalogPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Plus from "../../Resources/Icons/UI-icons/Plus";
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
  const [addedExerciseNames, setAddedExerciseNames] = useState([]);
  const [isCustomExerciseModalVisible, setIsCustomExerciseModalVisible] =
    useState(false);
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const workoutPicker = route?.params?.workoutPicker ?? null;
  // Which list the picker opens on. The workout screen has a button for the
  // whole catalog and one for what was used recently, and they land here.
  const initialFilter = route?.params?.initialFilter ?? null;
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

  // SPM-2: the sheet used to close after the first exercise, so a workout with
  // six exercises meant six trips through the catalog with a fresh search each
  // time - on a list whose every row carries its own + button, which says the
  // opposite. It stays open, counts what has been added and leaves when the
  // user says so.
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
        setAddedExerciseNames((current) =>
          current.includes(exerciseName) ? current : [...current, exerciseName]
        );
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
    [db, isWorkoutPicker, selectingExerciseName, workoutPickerId]
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
      addedExerciseNames={addedExerciseNames}
      workoutPicker={workoutPicker}
      initialFilter={initialFilter}
    />
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View
          style={[
            styles.headerTitleGroup,
            isWorkoutPicker ? styles.headerTitleGroupWithAction : null,
          ]}
        >
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

        {/* The way out, and the count of what has gone in so far. Without it
            an open sheet gives no sign that anything was added. */}
        {isWorkoutPicker ? (
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={
              addedExerciseNames.length > 0
                ? `Done, ${addedExerciseNames.length} added`
                : "Done"
            }
            onPress={() => navigation.goBack()}
            style={[
              styles.headerAction,
              styles.headerDoneAction,
              {
                backgroundColor: theme.uiBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={styles.headerDoneText}
              setColor={primaryTextColor}
              numberOfLines={1}
            >
              {addedExerciseNames.length > 0
                ? `Done (${addedExerciseNames.length})`
                : "Done"}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {/* Making your own exercise is a rare thing to do, and it had a
            full-width button in the middle of the list saying otherwise. */}
        {!isWorkoutPicker ? (
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Add a custom exercise"
            onPress={() => setIsCustomExerciseModalVisible(true)}
            style={[
              styles.headerAction,
              { backgroundColor: theme.uiBackground, borderColor: theme.border },
            ]}
          >
            <Plus width={19} height={19} color={theme.text} thickness={2.1} />
          </TouchableOpacity>
        ) : null}
      </ThemedHeader>

      {/*
        The picker scrolls its own list. A list inside a ScrollView is handed
        unlimited height and so renders every row, which is the whole reason
        the picker was slow. The catalog keeps the page scroll - its list is a
        fixed-height window with the rest of the card above it, so it cannot
        own the scrolling without moving the card around it.

        This stays a ScrollView. Making it a FlatList carrying the page in its
        header silences React Native's "VirtualizedLists should never be nested
        inside plain ScrollViews" warning, but it also stops the catalog's own
        list from scrolling: nested inside another VirtualizedList, the inner
        list hands its scrolling to the parent and then sits frozen on its
        first ten rows. Verified on a device. The warning is dev-only
        (`VirtualizedList.js`, inside `if (__DEV__)`) and is a false alarm
        here, because `styles.listScroll` gives the inner list a fixed height
        and therefore a real viewport to virtualize against.
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
