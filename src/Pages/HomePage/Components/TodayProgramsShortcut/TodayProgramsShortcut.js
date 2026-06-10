import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import { programService } from "../../../../Services";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Bell from "../../../../Resources/Icons/UI-icons/Bell";
import Calender from "../../../../Resources/Icons/UI-icons/Calender";
import { ThemedText, ThemedTitle } from "../../../../Resources/ThemedComponents";
import {
  formatDate,
  getTodaysDate,
  normalizeIsoDateString,
  parseCustomDate,
} from "../../../../Utils/dateUtils";
import { requestOpenQuickWorkoutMenu } from "../../../../Utils/quickWorkoutMenuEvents";
import TodayShortcut from "../TodayShortcut/TodayShortcut";
import styles from "./TodayProgramsShortcutStyle";

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getNextWorkoutDateParts(workout) {
  if (!workout?.date) {
    return null;
  }

  const workoutDate = parseCustomDate(workout.date);

  return {
    day: String(workoutDate.getDate()).padStart(2, "0"),
    weekday: workoutDate
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
  };
}

const TodayProgramsShortcut = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [todaySnapshots, setTodaySnapshots] = useState([]);
  const [nextWorkout, setNextWorkout] = useState(null);
  const [loading, setLoading] = useState(false);

  const date = getTodaysDate();

  const loadToday = useCallback(async () => {
    try {
      setLoading(true);
      const todayDate = parseCustomDate(date);
      const tomorrow = addDays(todayDate, 1);
      const rangeEnd = addDays(todayDate, 180);
      const [snapshotsResult, upcomingWorkoutsResult] = await Promise.allSettled([
        programService.getTodayWorkoutSnapshots(db, { date }),
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: normalizeIsoDateString(formatDate(tomorrow)),
          endIsoDate: normalizeIsoDateString(formatDate(rangeEnd)),
        }),
      ]);
      const snapshots =
        snapshotsResult.status === "fulfilled" ? snapshotsResult.value : [];
      const upcomingWorkouts =
        upcomingWorkoutsResult.status === "fulfilled"
          ? upcomingWorkoutsResult.value
          : [];

      setTodaySnapshots(snapshots);
      setNextWorkout(
        upcomingWorkouts.find((workout) => Number(workout.done) !== 1) ?? null
      );

      if (snapshotsResult.status === "rejected") {
        throw snapshotsResult.reason;
      }

      if (upcomingWorkoutsResult.status === "rejected") {
        console.warn(
          "Could not load the next planned workout:",
          upcomingWorkoutsResult.reason
        );
      }
    } catch (error) {
      console.error(error);
      setTodaySnapshots([]);
      setNextWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const hasMultipleSnapshots = todaySnapshots.length > 1;
  const cardBackground =
    theme.cardBackground ?? theme.uiBackground ?? theme.background;
  const cardBorder =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const titleColor = theme.secondary ?? theme.primary ?? "#60daac";
  const primaryColor = theme.primary ?? "#f7742e";
  const actionTextColor =
    theme.textInverted ?? theme.cardBackground ?? "#1b1918";
  const nextWorkoutDate = getNextWorkoutDateParts(nextWorkout);
  const nextWorkoutTitle =
    nextWorkout?.label ??
    nextWorkout?.program_name ??
    nextWorkout?.workout_type ??
    "Planned workout";

  const openNextWorkout = () => {
    if (!nextWorkout) {
      navigation.navigate("WorkoutCalendarPage");
      return;
    }

    navigation.navigate("WorkoutPage", {
      workout_id: nextWorkout.workout_id,
      workout_label: nextWorkout.label,
      workout_type: nextWorkout.workout_type ?? nextWorkout.label ?? "Resistance",
      day: nextWorkout.weekday,
      date: nextWorkout.date,
      program_id: nextWorkout.program_id,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.emptyHeader}>
        <ThemedTitle
          type="h1"
          style={[styles.emptyHeaderTitle, { color: titleColor }]}
        >
          Welcome Back!
        </ThemedTitle>

        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityLabel="Open notification settings"
          accessibilityRole="button"
          onPress={() => navigation.navigate("NotificationSettingsPage")}
          style={[
            styles.notificationButton,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
            },
          ]}
        >
          <Bell
            width={25}
            height={25}
            color={theme.title ?? theme.iconColor}
            thickness={1.8}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View
          style={[
            styles.stateCard,
            {
              backgroundColor: theme.cardBackground ?? theme.background,
              borderColor: theme.cardBorder ?? theme.border ?? theme.primary,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.stateAccent,
              { backgroundColor: theme.primary ?? "#f7742e" },
            ]}
          />

          <ThemedText
            style={styles.stateEyebrow}
            setColor={theme.primary ?? "#f7742e"}
          >
            TODAY
          </ThemedText>
          <ThemedTitle type="h3">Today</ThemedTitle>
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={theme.primary} />
            <ThemedText style={styles.loadingCopy} setColor={quietText}>
              Loading today&apos;s training...
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View
            style={[
              styles.stateCard,
              styles.emptyTodayCard,
              {
                backgroundColor: cardBackground,
                borderColor: cardBorder,
              },
            ]}
          >
            {todaySnapshots.length === 0 ? (
              <>
                <View style={styles.emptyContent}>
                  <ThemedTitle
                    type="h2"
                    style={styles.emptyTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    Nothing scheduled today
                  </ThemedTitle>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  accessibilityLabel="Quick start workout"
                  accessibilityRole="button"
                  onPress={() => requestOpenQuickWorkoutMenu()}
                  style={[
                    styles.quickStartButton,
                    { backgroundColor: primaryColor },
                  ]}
                >
                  <ThemedText
                    style={styles.quickStartButtonText}
                    setColor={actionTextColor}
                    numberOfLines={1}
                  >
                    Quick Start
                  </ThemedText>
                  <View style={styles.quickStartArrow}>
                    <Feather
                      name="arrow-right"
                      size={25}
                      color={actionTextColor}
                    />
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.todayWorkoutList}>
                {todaySnapshots.map((todaySnapshot, index) => (
                  <TodayShortcut
                    key={
                      todaySnapshot.program?.program_id != null
                        ? `program-${todaySnapshot.program.program_id}`
                        : `standalone-${todaySnapshot.day?.day_id ?? index}`
                    }
                    program_id={todaySnapshot.program?.program_id ?? null}
                    snapshot={todaySnapshot}
                    headerEyebrow="TODAY"
                    headerTitle={
                      hasMultipleSnapshots
                        ? todaySnapshot.program?.program_name ||
                          "Workout calendar"
                        : "Today"
                    }
                  />
                ))}
              </View>
            )}

            <View style={styles.scheduleDivider}>
              <View
                style={[styles.scheduleLine, { backgroundColor: cardBorder }]}
              />
              <Calender
                width={18}
                height={18}
                color={quietText}
                thickness={1.8}
              />
              <ThemedText style={styles.scheduleText} setColor={quietText}>
                Schedule
              </ThemedText>
              <View
                style={[styles.scheduleLine, { backgroundColor: cardBorder }]}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.84}
              accessibilityLabel={
                nextWorkout
                  ? `Open planned workout ${nextWorkoutTitle}`
                  : "Open workout calendar"
              }
              accessibilityRole="button"
              onPress={openNextWorkout}
              style={[
                styles.nextWorkoutCard,
                {
                  backgroundColor: theme.background ?? cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              {nextWorkoutDate ? (
                <View
                  style={[
                    styles.nextWorkoutDate,
                    { borderColor: cardBorder },
                  ]}
                >
                  <ThemedText
                    style={styles.nextWorkoutWeekday}
                    setColor={primaryColor}
                  >
                    {nextWorkoutDate.weekday}
                  </ThemedText>
                  <ThemedTitle type="h2" style={styles.nextWorkoutDay}>
                    {nextWorkoutDate.day}
                  </ThemedTitle>
                </View>
              ) : (
                <View
                  style={[
                    styles.nextWorkoutDate,
                    { borderColor: cardBorder },
                  ]}
                >
                  <Calender
                    width={28}
                    height={28}
                    color={quietText}
                    thickness={1.6}
                  />
                </View>
              )}

              <View style={styles.nextWorkoutContent}>
                <ThemedText
                  style={styles.nextWorkoutEyebrow}
                  setColor={primaryColor}
                >
                  {nextWorkout ? "Planned next" : "Schedule"}
                </ThemedText>
                <ThemedTitle
                  type="h3"
                  style={styles.nextWorkoutTitle}
                  numberOfLines={2}
                >
                  {nextWorkout ? nextWorkoutTitle : "Nothing planned yet"}
                </ThemedTitle>
              </View>

              <View
                style={[
                  styles.nextWorkoutIcon,
                  { backgroundColor: theme.uiBackground ?? cardBorder },
                ]}
              >
                <Feather
                  name="arrow-right"
                  size={22}
                  color={theme.title ?? theme.text}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityLabel="Open workout calendar"
              accessibilityRole="button"
              onPress={() => navigation.navigate("WorkoutCalendarPage")}
              style={[
                styles.calendarButton,
                {
                  backgroundColor: theme.background ?? cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              <Calender
                width={22}
                height={22}
                color={primaryColor}
                thickness={1.8}
              />
              <ThemedText style={styles.calendarButtonText} numberOfLines={1}>
                View workout calendar
              </ThemedText>
              <Feather name="arrow-right" size={22} color={quietText} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default TodayProgramsShortcut;
