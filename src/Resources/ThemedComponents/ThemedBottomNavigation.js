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
import AddWorkoutModal from "../Components/AddWorkoutModal";
import Home from "../Icons/UI-icons/Home";
import Library from "../Icons/UI-icons/Library";
import Male from "../Icons/UI-icons/Male";
import Plus from "../Icons/UI-icons/Plus";
import Social from "../Icons/UI-icons/Social";
import { programService } from "../../Services";

function ThemedBottomNavigation({ currentRouteName, navigationRef }) {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const [quickWorkoutModalVisible, setQuickWorkoutModalVisible] =
    useState(false);
  const [isCreatingQuickWorkout, setIsCreatingQuickWorkout] = useState(false);

  const isProfileActive = currentRouteName === "ProfilePage";
  const isSocialActive = currentRouteName === "SearchPage";
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

  const handleQuickWorkoutPress = () => {
    if (isCreatingQuickWorkout) {
      return;
    }

    setQuickWorkoutModalVisible(true);
  };

  const handleCreateQuickWorkout = async (workoutType) => {
    if (!navigationRef?.isReady?.() || isCreatingQuickWorkout) {
      return;
    }

    setIsCreatingQuickWorkout(true);

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
          <Library
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
            LIBRARY
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

      <AddWorkoutModal
        visible={quickWorkoutModalVisible}
        onClose={() => setQuickWorkoutModalVisible(false)}
        onSubmit={handleCreateQuickWorkout}
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
