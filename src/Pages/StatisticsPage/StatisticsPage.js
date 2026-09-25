import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./StatisticsPageStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "@resources/ThemedComponents";
import { statisticsService, weightliftingService } from "@services";
import { normalizeRecordRows } from "@utils/recordsInsights";
import {
  buildTeasers,
  normalizeRunSegments,
  normalizeSetTypeRows,
  normalizeStatisticsWorkouts,
  resolvePeriod,
} from "@utils/statisticsInsights";
import StatisticsOverview from "./Components/StatisticsOverview/StatisticsOverview";
import GoDeeper from "./Components/GoDeeper/GoDeeper";

// One failed source empties its own part of the page, not all of it.
function orEmpty(label, fallback) {
  return (error) => {
    console.error(`Failed to load the statistics' ${label}:`, error);
    return fallback;
  };
}

/**
 * Statistik: the numbers, all of them read in one period. At the top the
 * overview that used to open Records - the three numbers, strength, gains,
 * volume and muscle groups - and under it the way into the five deep dives,
 * each with its number in the same period.
 */
export default function StatisticsPage() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Pattern A: null until the first load has answered. Without it the page
  // paints its definitive "nothing here yet" while the queries are running
  // and swaps in the real numbers a moment later - and empty and not known
  // yet are different answers.
  const [source, setSource] = useState(null);
  const [periodKey, setPeriodKey] = useState("3m");
  const [showAllMovers, setShowAllMovers] = useState(false);
  // Frozen for the life of the screen so a period switch cannot shift what
  // "now" means halfway through a comparison.
  const nowRef = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const [records, workouts, runSegments, setTypes] = await Promise.all([
          weightliftingService
            .getRecordsSourceData(db)
            .catch(orEmpty("strength sets", { rows: [], groupsByExercise: new Map() })),
          statisticsService.getCompletedWorkouts(db).catch(orEmpty("workouts", [])),
          statisticsService.getCompletedRunSegments(db).catch(orEmpty("runs", [])),
          statisticsService.getCompletedSetTypes(db).catch(orEmpty("set types", [])),
        ]);

        if (cancelled) {
          return;
        }

        setSource({
          sets: normalizeRecordRows(records.rows),
          groupsByExercise: records.groupsByExercise,
          workouts: normalizeStatisticsWorkouts(workouts),
          runs: normalizeRunSegments(runSegments),
          setTypes: normalizeSetTypeRows(setTypes),
        });
      })();

      return () => {
        cancelled = true;
      };
    }, [db])
  );

  const period = useMemo(() => resolvePeriod(periodKey, nowRef.current), [periodKey]);
  const teasers = useMemo(
    () => (source ? buildTeasers(source, { period }) : null),
    [source, period]
  );

  const openExercise = useCallback(
    (exerciseName) => navigation.push("RecordsExercisePage", { exerciseName }),
    [navigation]
  );
  const openMetric = useCallback(
    (metric) => navigation.navigate("StatisticsDetailPage", { metric, periodKey }),
    [navigation, periodKey]
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          <ThemedText size={12} style={styles.headerEyebrow} setColor={theme.quietText}>
            {t("statistics.eyebrow")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.headerTitle} numberOfLines={1}>
            {t("statistics.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!source ? (
          <ThemedStateBlock style={styles.loadingState} />
        ) : (
          <View style={styles.stack}>
            <StatisticsOverview
              sets={source.sets}
              groupsByExercise={source.groupsByExercise}
              now={nowRef.current}
              periodKey={periodKey}
              onChangePeriod={setPeriodKey}
              onSelectExercise={openExercise}
              showAllMovers={showAllMovers}
              onToggleAllMovers={() => setShowAllMovers((value) => !value)}
            />
            <GoDeeper teasers={teasers} onOpen={openMetric} />
          </View>
        )}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
