import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./StatisticsDetailPageStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedSegmentedControl,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "@resources/ThemedComponents";
import { statisticsService } from "@services";
import { RECORDS_PERIODS, normalizeRecordRows } from "@utils/recordsInsights";
import {
  STATISTICS_METRICS,
  normalizeRunSegments,
  normalizeSetTypeRows,
  normalizeStatisticsWorkouts,
  resolvePeriod,
} from "@utils/statisticsInsights";
import ExercisesDetail from "./Components/ExercisesDetail/ExercisesDetail";
import FrequencyDetail from "./Components/FrequencyDetail/FrequencyDetail";
import IntensityDetail from "./Components/IntensityDetail/IntensityDetail";
import RunsDetail from "./Components/RunsDetail/RunsDetail";
import SetTypesDetail from "./Components/SetTypesDetail/SetTypesDetail";

async function loadStrengthSets(db) {
  return normalizeRecordRows(await statisticsService.getCompletedStrengthSets(db));
}

// Each deep dive reads what it shows and nothing else.
const LOADERS = {
  intensity: async (db) => ({ sets: await loadStrengthSets(db) }),
  frequency: async (db) => ({
    workouts: normalizeStatisticsWorkouts(await statisticsService.getCompletedWorkouts(db)),
  }),
  // The set-type rows count every set, warm-ups included; the drop sets'
  // share of the volume needs the weights, which only the strength sets carry.
  setTypes: async (db) => {
    const [typeRows, sets] = await Promise.all([
      statisticsService.getCompletedSetTypes(db),
      loadStrengthSets(db),
    ]);

    return { setTypes: normalizeSetTypeRows(typeRows), sets };
  },
  runs: async (db) => ({
    runs: normalizeRunSegments(await statisticsService.getCompletedRunSegments(db)),
  }),
  exercises: async (db) => ({ sets: await loadStrengthSets(db) }),
};

const NOTHING = { sets: [], workouts: [], runs: [], setTypes: [] };

/**
 * One deep dive from the Statistics page - intensity, frequency, set types,
 * runs or every exercise - with its own period control, starting at the
 * period the page was showing.
 */
export default function StatisticsDetailPage() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const metric = STATISTICS_METRICS.includes(route.params?.metric)
    ? route.params.metric
    : STATISTICS_METRICS[0];
  const requestedPeriod = route.params?.periodKey;
  const [periodKey, setPeriodKey] = useState(
    RECORDS_PERIODS.some((entry) => entry.key === requestedPeriod) ? requestedPeriod : "3m"
  );
  // Pattern A: null until the first load has answered, so an empty period
  // is never shown for data that simply has not arrived yet.
  const [data, setData] = useState(null);
  // Frozen for the life of the screen, like the Statistics page's own.
  const nowRef = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const loaded = await LOADERS[metric](db);

          if (!cancelled) {
            setData({ ...NOTHING, ...loaded });
          }
        } catch (error) {
          console.error(`Failed to load the ${metric} statistics:`, error);

          if (!cancelled) {
            setData(NOTHING);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [db, metric])
  );

  const period = useMemo(() => resolvePeriod(periodKey, nowRef.current), [periodKey]);
  const openExercise = useCallback(
    (exerciseName) => navigation.push("RecordsExercisePage", { exerciseName }),
    [navigation]
  );

  const renderMetric = () => {
    const shared = {
      period,
      now: nowRef.current,
      // The whole history has nothing longer to offer.
      emptyBody: period.days === null ? null : t("statistics.detail.tryLonger"),
    };

    switch (metric) {
      case "frequency":
        return <FrequencyDetail workouts={data.workouts} {...shared} />;
      case "setTypes":
        return <SetTypesDetail setTypes={data.setTypes} sets={data.sets} {...shared} />;
      case "runs":
        return <RunsDetail runs={data.runs} {...shared} />;
      case "exercises":
        return <ExercisesDetail sets={data.sets} onSelectExercise={openExercise} {...shared} />;
      default:
        return <IntensityDetail sets={data.sets} {...shared} />;
    }
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          <ThemedText size={12} style={styles.headerEyebrow} setColor={theme.quietText}>
            {t("statistics.title")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.headerTitle} numberOfLines={1}>
            {t(`statistics.${metric}.title`)}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stack}>
          <ThemedSegmentedControl
            options={RECORDS_PERIODS.map((entry) => ({
              value: entry.key,
              label: t(`statistics.periods.${entry.key}`),
            }))}
            value={period.key}
            onChange={setPeriodKey}
          />

          {data ? renderMetric() : <ThemedStateBlock style={styles.loadingState} />}
        </View>
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
