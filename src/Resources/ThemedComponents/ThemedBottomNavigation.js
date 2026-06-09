import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../GlobalStyling/colors";
import StartWorkoutSheet from "../Components/StartWorkoutSheet";
import Home from "../Icons/UI-icons/Home";
import Male from "../Icons/UI-icons/Male";
import Plus from "../Icons/UI-icons/Plus";
import Social from "../Icons/UI-icons/Social";
import UpwardGraf from "../Icons/UI-icons/UpwardGraf";
import { programService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import { subscribeQuickWorkoutMenu } from "../../Utils/quickWorkoutMenuEvents";

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getPlannedTodayShortcut(todaySnapshots, date) {
  const workouts = todaySnapshots.flatMap((snapshot) =>
    snapshot.workouts
      .filter((workout) => Number(workout.done) !== 1)
      .map((workout) => ({
        date,
        day: snapshot.day,
        programId: snapshot.program?.program_id ?? null,
        programName: snapshot.program?.program_name ?? "Workout calendar",
        workout,
      }))
  );

  return workouts.length > 0 ? { date, workouts } : null;
}

function ThemedBottomNavigation({ currentRouteName, navigationRef }) {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const [quickWorkoutModalVisible, setQuickWorkoutModalVisible] =
    useState(false);
  const [isCreatingQuickWorkout, setIsCreatingQuickWorkout] = useState(false);
  const [plannedTodayShortcut, setPlannedTodayShortcut] = useState(null);
  const [usualWorkouts, setUsualWorkouts] = useState([]);
  const [isLoadingUsualWorkouts, setIsLoadingUsualWorkouts] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [isLoadingRecentWorkouts, setIsLoadingRecentWorkouts] = useState(false);
  const quickWorkoutDateRef = useRef(getTodaysDate());

  const isProfileActive = [
    "ProfilePage",
    "NotificationSettingsPage",
    "SocialPostSettingsPage",
    "ExerciseSocialPostSettingsPage",
  ].includes(currentRouteName);
  const isSocialActive = ["SearchPage", "SocialUserListPage"].includes(
    currentRouteName
  );
  const isLibraryActive = [
    "ExerciseLibraryPage",
    "ExerciseCatalogPage",
    "PersonalRecordsPage",
  ].includes(currentRouteName);
  const isHomeActive = !isProfileActive && !isSocialActive && !isLibraryActive;
  const activeColor =
    theme.iconColorFocused ?? theme.primary ?? theme.title ?? theme.text;
  const inactiveColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const barBackground =
    theme.cardBackground ?? theme.navBackground ?? theme.background;
  const barBorder = theme.border ?? theme.cardBorder ?? theme.iconColor;
  const plusBackground = theme.primary ?? "#f7742e";
  const plusIconColor = theme.textInverted ?? theme.cardBackground ?? "#10131a";

  const handleHomePress = () => {
    if (!navigationRef?.isReady?.()) {
      return;
    }

    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "HomePage" }],
    });
  };

  const handleProfilePress = () => {
    if (!navigationRef?.isReady?.() || isProfileActive) {
      return;
    }

    navigationRef.navigate("ProfilePage");
  };

  const handleSocialPress = () => {
    if (!navigationRef?.isReady?.() || isSocialActive) {
      return;
    }

    navigationRef.navigate("SearchPage");
  };

  const handleLibraryPress = () => {
    if (!navigationRef?.isReady?.() || isLibraryActive) {
      return;
    }

    navigationRef.navigate("ExerciseLibraryPage");
  };

  const loadPlannedTodayShortcut = useCallback(async (todayDate) => {
    try {
      const todaySnapshots = await programService.getTodayWorkoutSnapshots(
        db,
        { date: todayDate }
      );

      setPlannedTodayShortcut(
        getPlannedTodayShortcut(todaySnapshots, todayDate)
      );
    } catch (error) {
      console.error("Failed to load today's planned workout:", error);
      setPlannedTodayShortcut(null);
    }
  }, [db]);

  const loadRecentWorkouts = useCallback(async (todayDate) => {
    try {
      setIsLoadingRecentWorkouts(true);
      const workouts = await programService.getRecentWorkouts(db, {
        date: todayDate,
        limit: 2,
      });

      setRecentWorkouts(workouts);
    } catch (error) {
      console.error("Failed to load recent workouts:", error);
      setRecentWorkouts([]);
    } finally {
      setIsLoadingRecentWorkouts(false);
    }
  }, [db]);

  const loadUsualWorkouts = useCallback(async (todayDate) => {
    try {
      setIsLoadingUsualWorkouts(true);
      const workouts = await programService.getUsualWorkouts(db, {
        date: todayDate,
        limit: 2,
        minOccurrences: 2,
      });

      setUsualWorkouts(workouts);
    } catch (error) {
      console.error("Failed to load usual workouts:", error);
      setUsualWorkouts([]);
    } finally {
      setIsLoadingUsualWorkouts(false);
    }
  }, [db]);

  const handleQuickWorkoutPress = useCallback(() => {
    if (isCreatingQuickWorkout) {
      return;
    }

    const quickWorkoutDate = getTodaysDate();
    quickWorkoutDateRef.current = quickWorkoutDate;
    setPlannedTodayShortcut(null);
    setUsualWorkouts([]);
    setRecentWorkouts([]);
    setQuickWorkoutModalVisible(true);
    loadPlannedTodayShortcut(quickWorkoutDate);
    loadUsualWorkouts(quickWorkoutDate);
    loadRecentWorkouts(quickWorkoutDate);
  }, [
    isCreatingQuickWorkout,
    loadPlannedTodayShortcut,
    loadRecentWorkouts,
    loadUsualWorkouts,
  ]);

  useEffect(() => {
    return subscribeQuickWorkoutMenu(handleQuickWorkoutPress);
  }, [handleQuickWorkoutPress]);

  const handleCreateQuickWorkout = async (workoutType) => {
    if (!navigationRef?.isReady?.() || isCreatingQuickWorkout) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const workoutLabel = workoutType.displayName ?? workoutType.id;
      const workout = await programService.createQuickWorkout(db, {
        date: quickWorkoutDateRef.current,
        workoutType: workoutType.id,
        label: null,
      });

      navigationRef.navigate("WorkoutPage", {
        program_id: workout.program_id,
        day: workout.day,
        date: workout.date,
        workout_id: workout.workout_id,
        workout_label: workoutLabel,
        workout_type: workoutType.id,
      });
    } catch (error) {
      console.error("Failed to create quick workout:", error);
      Alert.alert("Could not create workout", "Please try again.");
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  const handleOpenPlannedWorkout = (plannedSelection) => {
    const selectedWorkout =
      plannedSelection ?? plannedTodayShortcut?.workouts?.[0] ?? null;
    const plannedWorkout = selectedWorkout?.workout;

    if (!navigationRef?.isReady?.() || !plannedWorkout) {
      return;
    }

    setQuickWorkoutModalVisible(false);

    navigationRef.navigate("WorkoutPage", {
      workout_id: plannedWorkout.workout_id,
      workout_label: plannedWorkout.label,
      workout_type: getWorkoutType(plannedWorkout),
      day: selectedWorkout.day?.Weekday,
      date: selectedWorkout.date,
      program_id: selectedWorkout.programId,
    });
  };

  const handleCopyRecentWorkout = async (workout) => {
    if (!navigationRef?.isReady?.() || !workout || isCreatingQuickWorkout) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const copiedWorkout = await programService.copyWorkoutToStandaloneDate(
        db,
        {
          workoutId: workout.workout_id,
          date: quickWorkoutDateRef.current,
        }
      );

      if (!copiedWorkout) {
        throw new Error("The recent workout could not be copied.");
      }

      navigationRef.navigate("WorkoutPage", {
        workout_id: copiedWorkout.workout_id,
        workout_label: copiedWorkout.workout_label,
        workout_type: copiedWorkout.workout_type,
        day: copiedWorkout.day,
        date: copiedWorkout.date,
        program_id: copiedWorkout.program_id,
      });
    } catch (error) {
      console.error("Failed to copy recent workout:", error);
      Alert.alert(
        "Could not copy workout",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: barBackground,
            borderTopColor: barBorder,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleHomePress}
          style={styles.tab}
        >
          <Home
            width={28}
            height={28}
            color={isHomeActive ? activeColor : inactiveColor}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: isHomeActive ? activeColor : inactiveColor },
            ]}
          >
            HOME
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleLibraryPress}
          style={styles.tab}
        >
          <UpwardGraf
            width={27}
            height={27}
            color={isLibraryActive ? activeColor : inactiveColor}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: isLibraryActive ? activeColor : inactiveColor },
            ]}
          >
            TRAIN
          </Text>
        </TouchableOpacity>

        <View style={styles.plusSlot}>
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityLabel="Create workout"
            accessibilityRole="button"
            disabled={isCreatingQuickWorkout}
            onPress={handleQuickWorkoutPress}
            style={[
              styles.plusButton,
              {
                backgroundColor: plusBackground,
                borderColor: barBackground,
                opacity: isCreatingQuickWorkout ? 0.72 : 1,
              },
            ]}
          >
            <Plus
              width={34}
              height={34}
              color={plusIconColor}
              thickness={2.2}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleSocialPress}
          style={styles.tab}
        >
          <Social
            width={27}
            height={27}
            color={isSocialActive ? activeColor : inactiveColor}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: isSocialActive ? activeColor : inactiveColor },
            ]}
          >
            SOCIAL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleProfilePress}
          style={styles.tab}
        >
          <Male
            width={27}
            height={27}
            color={isProfileActive ? activeColor : inactiveColor}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: isProfileActive ? activeColor : inactiveColor },
            ]}
          >
            PROFILE
          </Text>
        </TouchableOpacity>
      </View>

      <StartWorkoutSheet
        visible={quickWorkoutModalVisible}
        onClose={() => setQuickWorkoutModalVisible(false)}
        onStartFresh={handleCreateQuickWorkout}
        onOpenPlannedWorkout={handleOpenPlannedWorkout}
        plannedTodayShortcut={plannedTodayShortcut}
        usualWorkouts={usualWorkouts}
        isLoadingUsualWorkouts={isLoadingUsualWorkouts}
        recentWorkouts={recentWorkouts}
        isLoadingRecentWorkouts={isLoadingRecentWorkouts}
        onCopyRecentWorkout={handleCopyRecentWorkout}
        isStartingWorkout={isCreatingQuickWorkout}
      />
    </>
  );
}

export default ThemedBottomNavigation;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    minHeight: 66,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0,
  },
  plusSlot: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -34,
    shadowColor: "#f7742e",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 12,
  },
});
