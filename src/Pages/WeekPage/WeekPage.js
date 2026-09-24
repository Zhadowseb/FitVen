import { StatusBar } from "expo-status-bar";
import { RefreshControl, ScrollView, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./WeekPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { programService } from "../../Services";
import { useTranslation } from "@localization";

import Day from "./Components/Day/Day";

import {
  ThemedHeader,
  ThemedStateBlock,
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
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
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
          error instanceof Error ? error.message : t("programs.weeks.loadFailed")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [db, microcycle_id, t]
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
            {t("programs.weekNumber", { number: week_number })}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <ThemedStateBlock variant="loading" message={t("programs.weeks.loading")} />
      ) : errorMessage ? (
        <ThemedStateBlock
          variant="error"
          title={t("programs.weeks.unavailableTitle")}
          message={errorMessage}
          actionLabel={t("common.retry")}
          onAction={() => loadWeek({ showLoader: true })}
        />
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
            <ThemedStateBlock
              variant="empty"
              title={t("programs.weeks.emptyTitle")}
              message={t("programs.weeks.emptyMessage")}
            />
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
