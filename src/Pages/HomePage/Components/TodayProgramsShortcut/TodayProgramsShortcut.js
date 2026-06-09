import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { programService } from "../../../../Services";
import HomeImageShortcutCard from "../../../../Resources/Components/HomeImageShortcutCard/HomeImageShortcutCard";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import { ThemedText, ThemedTitle } from "../../../../Resources/ThemedComponents";
import { getTodaysDate } from "../../../../Utils/dateUtils";
import { requestOpenQuickWorkoutMenu } from "../../../../Utils/quickWorkoutMenuEvents";
import TodayShortcut from "../TodayShortcut/TodayShortcut";
import styles from "./TodayProgramsShortcutStyle";

const workoutCalendarImage = require("../../../../Resources/Images/DarkVersion/workout calender dark.png");

const TodayProgramsShortcut = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [todaySnapshots, setTodaySnapshots] = useState([]);
  const [loading, setLoading] = useState(false);

  const date = getTodaysDate();

  const loadToday = useCallback(async () => {
    try {
      setLoading(true);
      const snapshots = await programService.getTodayWorkoutSnapshots(db, {
        date,
      });
      setTodaySnapshots(snapshots);
    } catch (error) {
      console.error(error);
      setTodaySnapshots([]);
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

  return (
    <View style={styles.container}>
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
      ) : todaySnapshots.length === 0 ? (
        <View style={styles.emptyShortcutRow}>
          <View
            style={[
              styles.stateCard,
              styles.emptyTodayCard,
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

            <View style={styles.emptyContent}>
              <ThemedTitle
                type="h3"
                style={[
                  styles.emptyTitle,
                  { color: theme.secondary ?? theme.primary ?? "#60daac" },
                ]}
                numberOfLines={2}
              >
                Ready to train?
              </ThemedTitle>
              <ThemedText
                style={styles.emptyDate}
                setColor="#ffffff"
                numberOfLines={1}
              >
                {date}
              </ThemedText>
              <ThemedText
                style={styles.emptyCopy}
                setColor={quietText}
                numberOfLines={2}
              >
                No workout planned today.
              </ThemedText>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              accessibilityLabel="Quick start workout"
              accessibilityRole="button"
              onPress={requestOpenQuickWorkoutMenu}
              style={[
                styles.quickStartButton,
                { backgroundColor: theme.primary ?? "#f7742e" },
              ]}
            >
              <ThemedText
                style={styles.quickStartButtonText}
                setColor={
                  theme.textInverted ?? theme.cardBackground ?? "#1b1918"
                }
                numberOfLines={1}
              >
                Quick Start
              </ThemedText>
            </TouchableOpacity>
          </View>

          <HomeImageShortcutCard
            accentColor={theme.primary ?? "#f7742e"}
            accentSide="top"
            accessibilityLabel="Open workout calendar"
            imageSource={workoutCalendarImage}
            onPress={() => navigation.navigate("WorkoutCalendarPage")}
            title="Workout calendar"
          />
        </View>
      ) : (
        todaySnapshots.map((todaySnapshot, index) => (
          <View
            key={
              todaySnapshot.program?.program_id != null
                ? `program-${todaySnapshot.program.program_id}`
                : `standalone-${todaySnapshot.day?.day_id ?? index}`
            }
            style={styles.programSection}
          >
            <TodayShortcut
              program_id={todaySnapshot.program?.program_id ?? null}
              snapshot={todaySnapshot}
              headerEyebrow="TODAY"
              headerTitle={
                hasMultipleSnapshots
                  ? todaySnapshot.program?.program_name || "Workout calendar"
                  : "Today"
              }
            />
          </View>
        ))
      )}
    </View>
  );
};

export default TodayProgramsShortcut;
