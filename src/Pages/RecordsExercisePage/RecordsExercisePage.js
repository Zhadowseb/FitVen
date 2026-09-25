import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./RecordsExercisePageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { weightliftingService } from "../../Services";
import RecordsExercise from "./Components/RecordsExercise/RecordsExercise";
import { EXERCISE_PERIODS, normalizeRecordRows } from "../../Utils/recordsInsights";

/**
 * One exercise: its estimated 1RM over time, the best weight at every rep
 * count and the last sessions. Its own screen, so the trophy room, the
 * statistics and a workout's exercise card can all open it and the back
 * arrow takes you back to wherever you came from.
 */
export default function RecordsExercisePage() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const exerciseName = route.params?.exerciseName ?? "";
  const requestedPeriod = route.params?.periodKey;
  const [periodKey, setPeriodKey] = useState(
    EXERCISE_PERIODS.some((entry) => entry.key === requestedPeriod) ? requestedPeriod : "3m"
  );
  const [sets, setSets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // Frozen for the life of the screen so a period switch cannot shift what
  // "now" means halfway through a comparison.
  const nowRef = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const { rows } = await weightliftingService.getRecordsSourceData(db);

          if (!cancelled) {
            setSets(normalizeRecordRows(rows));
          }
        } catch (error) {
          console.error("Failed to load the exercise's sets:", error);

          if (!cancelled) {
            setSets([]);
          }
        } finally {
          if (!cancelled) {
            setLoaded(true);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [db])
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          <ThemedText size={12} style={styles.headerEyebrow} setColor={theme.quietText}>
            {t("records.exercise.overline")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.headerTitle} numberOfLines={1}>
            {exerciseName}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!loaded ? (
          <ThemedStateBlock style={styles.loadingState} />
        ) : (
          <RecordsExercise
            name={exerciseName}
            sets={sets}
            now={nowRef.current}
            periodKey={periodKey}
            onChangePeriod={setPeriodKey}
          />
        )}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
