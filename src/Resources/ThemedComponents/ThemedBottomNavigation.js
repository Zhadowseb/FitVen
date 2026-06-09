import { useState } from "react";
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

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getPlannedTodayShortcut(programSnapshots, date) {
  for (const snapshot of programSnapshots) {
    const workout = snapshot.workouts.find(
      (snapshotWorkout) => Number(snapshotWorkout.done) !== 1
    );

    if (workout) {
      return {
        date,
        day: snapshot.day,
        programId: snapshot.program?.program_id ?? null,
        programName: snapshot.program?.program_name ?? "Program",
        workout,
      };
    }
  }

  return null;
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

  const loadPlannedTodayShortcut = async () => {
    const todayDate = getTodaysDate();

    try {
      const programSnapshots = await programService.getTodayProgramSnapshots(
        db,
        { date: todayDate }
      );

      setPlannedTodayShortcut(
        getPlannedTodayShortcut(programSnapshots, todayDate)
      );
    } catch (error) {
      console.error("Failed to load today's planned workout:", error);
      setPlannedTodayShortcut(null);
    }
  };

  const loadRecentWorkouts = async () => {
    const todayDate = getTodaysDate();

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
  };

  const loadUsualWorkouts = async () => {
    const todayDate = getTodaysDate();

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
  };

  const handleQuickWorkoutPress = () => {
    if (isCreatingQuickWorkout) {
      return;
    }

    setPlannedTodayShortcut(null);
    setUsualWorkouts([]);
    setRecentWorkouts([]);
    setQuickWorkoutModalVisible(true);
    loadPlannedTodayShortcut();
    loadUsualWorkouts();
    loadRecentWorkouts();
  };

  const handleCreateQuickWorkout = async (workoutType) => {
    if (!navigationRef?.isReady?.() || isCreatingQuickWorkout) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const workoutLabel = workoutType.displayName ?? workoutType.id;
      const workout = await programService.createQuickWorkout(db, {
        date: new Date(),
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

  const handleOpenPlannedWorkout = () => {
    const plannedWorkout = plannedTodayShortcut?.workout;

    if (!navigationRef?.isReady?.() || !plannedWorkout) {
      return;
    }

    setQuickWorkoutModalVisible(false);

    navigationRef.navigate("WorkoutPage", {
      workout_id: plannedWorkout.workout_id,
      workout_label: plannedWorkout.label,
      workout_type: getWorkoutType(plannedWorkout),
      day: plannedTodayShortcut.day?.Weekday,
      date: plannedTodayShortcut.date,
      program_id: plannedTodayShortcut.programId,
    });
  };

  const handleOpenRecentWorkout = (workout) => {
    if (!navigationRef?.isReady?.() || !workout) {
      return;
    }

    setQuickWorkoutModalVisible(false);

    navigationRef.navigate("WorkoutPage", {
      workout_id: workout.workout_id,
      workout_label: workout.label,
      workout_type: getWorkoutType(workout),
      day: workout.weekday,
      date: workout.date,
      program_id: workout.program_id,
    });
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
        onOpenRecentWorkout={handleOpenRecentWorkout}
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
