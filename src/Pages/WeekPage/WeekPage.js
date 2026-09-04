import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./WeekPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { programService } from "../../Services";

import Day from "./Components/Day/Day";

import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WeekPage = ({ route }) => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  const microcycle_id = route.params.microcycle_id;
  const program_id = route.params.program_id;
  const week_number = route.params.week_number;
  const period_start = route.params.period_start;
  const period_end = route.params.period_end;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dayCount, setDayCount] = useState(null);
  // Each Day loads itself; bumping this is what makes all seven reload.
  const [refreshKey, setRefreshKey] = useState(0);

  // The page reads the week's days only to know which of the four states to
  // show - loading, failed, empty or the days themselves.
  const loadWeek = useCallback(
    async ({ showLoader = false } = {}) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");
        const rows = await Promise.all(
          WEEK_DAYS.map((weekday) =>
            programService.getDayDetails(db, {
              microcycleId: microcycle_id,
              weekday,
            })
          )
        );

        setDayCount(rows.filter((row) => row?.day_id).length);
      } catch (error) {
        setDayCount(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load this week."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [db, microcycle_id]
  );

  useFocusEffect(
    useCallback(() => {
      loadWeek({ showLoader: true });
    }, [loadWeek])
  );

  const refreshWeek = () => {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
    loadWeek();
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          <ThemedText
            size={12}
            style={styles.headerEyebrow}
            setColor={quietText}
          >
            {period_start} - {period_end}
          </ThemedText>
          <ThemedTitle type="pageTitle" numberOfLines={1}>
            Week {week_number}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={primaryTextColor} />
          <ThemedText style={styles.stateText} setColor={quietText}>
            Loading this week...
          </ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBlock}>
          <ThemedTitle type="h3" style={styles.stateTitle}>
            Week unavailable
          </ThemedTitle>
          <ThemedText style={styles.stateText} setColor={quietText}>
            {errorMessage}
          </ThemedText>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.82}
            onPress={() => loadWeek({ showLoader: true })}
            style={[styles.stateAction, { backgroundColor: theme.primary }]}
          >
            <ThemedText
              style={styles.stateActionText}
              setColor={theme.textInverted ?? theme.cardBackground}
            >
              Try again
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshWeek}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.cardBackground}
            />
          }
        >
          {dayCount === 0 ? (
            <View style={styles.stateBlock}>
              <ThemedTitle type="h3" style={styles.stateTitle}>
                No days in this week
              </ThemedTitle>
              <ThemedText style={styles.stateText} setColor={quietText}>
                This week has no days yet. Add them from the block overview.
              </ThemedText>
            </View>
          ) : (
            WEEK_DAYS.map((day) => (
              <Day
                key={day}
                day={day}
                program_id={program_id}
                microcycle_id={microcycle_id}
                refreshKey={refreshKey}
              />
            ))
          )}
        </ScrollView>
      )}

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default WeekPage;
