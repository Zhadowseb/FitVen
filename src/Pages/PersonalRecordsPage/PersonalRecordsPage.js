import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./PersonalRecordsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { useAnimationsEnabled } from "../../Resources/Components/animationHooks";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { statisticsService, weightliftingService } from "../../Services";
import TrophyRoom from "./Components/TrophyRoom/TrophyRoom";
import { normalizeRecordRows } from "../../Utils/recordsInsights";
import { buildTrophyRoom, normalizeWorkoutRows } from "../../Utils/trophyRoom";

/**
 * Records, the trophy room: what somebody has achieved, over their whole
 * history, and nothing to compare it with. The numbers - periods, volume,
 * muscle groups, the deep dives - are on the Statistics page it links to.
 */
const PersonalRecordsPage = () => {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate, reduceMotion } = useAnimationsEnabled();
  const [sets, setSets] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  // Pattern A: without this the screen paints its definitive "nothing yet"
  // state while the query is still running, and then replaces it with the
  // real room a moment later. Empty and not-known-yet are different answers.
  const [loaded, setLoaded] = useState(false);
  // Frozen for the life of the screen, so "new" and "yesterday" do not shift
  // under somebody reading them.
  const nowRef = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        // Separately: without the workout rows the room still stands, it
        // counts the strength sessions instead.
        const [recordsResult, workoutsResult] = await Promise.allSettled([
          weightliftingService.getRecordsSourceData(db),
          statisticsService.getCompletedWorkouts(db),
        ]);

        if (cancelled) {
          return;
        }

        if (recordsResult.status === "fulfilled") {
          setSets(normalizeRecordRows(recordsResult.value.rows));
        } else {
          console.error("Failed to load the records:", recordsResult.reason);
          setSets([]);
        }

        if (workoutsResult.status === "fulfilled") {
          setWorkouts(normalizeWorkoutRows(workoutsResult.value));
        } else {
          console.error("Failed to load the workouts for the milestones:", workoutsResult.reason);
          setWorkouts([]);
        }

        setLoaded(true);
      })();

      return () => {
        cancelled = true;
      };
    }, [db])
  );

  const room = useMemo(
    () => buildTrophyRoom({ sets, workouts, now: nowRef.current }),
    [sets, workouts]
  );

  // Pushed, so the back arrow comes back to the room.
  const openExercise = useCallback(
    (exerciseName) => navigation.push("RecordsExercisePage", { exerciseName }),
    [navigation]
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={12} style={styles.pageHeaderTitleEyebrow} setColor={theme.quietText}>
            {t("records.eyebrow")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.pageHeaderTitleMain} numberOfLines={1}>
            {t("records.title")}
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
          <TrophyRoom
            room={room}
            now={nowRef.current}
            animate={animate}
            reduceMotion={reduceMotion}
            onOpenExercise={openExercise}
            onOpenStatistics={() => navigation.navigate("StatisticsPage")}
          />
        )}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default PersonalRecordsPage;
