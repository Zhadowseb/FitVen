import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  RefreshControl,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./HomePageStyle";
import GreetingHeader from "./Components/GreetingHeader/GreetingHeader";
import HomeSkeleton from "./Components/HomeSkeleton/HomeSkeleton";
import DaysSinceCard from "./Components/DaysSinceCard/DaysSinceCard";
import QuickStartCard from "./Components/QuickStartCard/QuickStartCard";
import SplitCards from "./Components/SplitCards/SplitCards";
import MuscleGlance from "./Components/MuscleGlance/MuscleGlance";
import FriendsActivity from "@resources/Components/FriendsActivity/FriendsActivity";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedView } from "@resources/ThemedComponents";
import {
  musicService,
  notificationService,
  programService,
  socialService,
  weightliftingService,
  workoutService,
} from "@services";
import { getTodaysDate } from "@utils/dateUtils";
import { pickMuscleGlanceHeadline } from "@utils/muscleGlance";
import { useAuth } from "../../Contexts/AuthContext";

/**
 * Home, for the person with no programme.
 *
 * She runs the same two or three sessions on a loop and wants the next one
 * open. So: how long since she trained, the session that is due, the rest of
 * her split, what her friends are doing, and whether last month moved
 * anything. No posts - those are the Feed tab now - and no calendar strip,
 * because a week of empty squares is not what somebody without a programme
 * needs to look at.
 */

// An empty workout has to be some type, and Resistance is the only strength
// type the app offers today.
const EMPTY_WORKOUT_TYPE = "Resistance";

export default function HomePage() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const { user } = useAuth();

  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [isLoadingCirclePreview, setIsLoadingCirclePreview] = useState(true);
  const [circlePreviewError, setCirclePreviewError] = useState("");
  // What the viewer's own music poller last saw, for their own tile. Module
  // state in musicService, mirrored here so a change re-renders the strip.
  const [ownNowPlaying, setOwnNowPlaying] = useState(() =>
    musicService.getCurrentNowPlaying()
  );
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [daysSinceLastWorkout, setDaysSinceLastWorkout] = useState(null);
  const [splitGroups, setSplitGroups] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [hasLoadedHome, setHasLoadedHome] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => musicService.subscribeNowPlaying(setOwnNowPlaying), []);

  const loadHome = useCallback(async () => {
    try {
      const [days, groups, muscles] = await Promise.all([
        workoutService.getDaysSinceLastWorkout(db),
        workoutService.getSplitGroups(db),
        weightliftingService.getMuscleGroupDeltas(db),
      ]);

      setDaysSinceLastWorkout(days);
      setSplitGroups(groups);
      setMuscleGroups(muscles);
    } catch (error) {
      console.error("Failed to load the home screen:", error);
    } finally {
      setHasLoadedHome(true);
    }
  }, [db]);

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({ currentUser: null, people: [] });
      setIsLoadingCirclePreview(false);
      return;
    }

    try {
      const preview = await socialService.getCirclePreview({ user });

      setCirclePreview(preview);
      setCirclePreviewError("");
    } catch (error) {
      setCirclePreviewError(
        error instanceof Error ? error.message : t("home.circleLoadFailed")
      );
    } finally {
      setIsLoadingCirclePreview(false);
    }
  }, [t, user]);

  const refreshUnreadNotificationCount = useCallback(async () => {
    try {
      setUnreadNotificationCount(
        await notificationService.getUnreadNotificationCount({ user })
      );
    } catch {
      // The bell without a number is the honest version of not knowing.
    }
  }, [user]);

  // A notification that arrives while the app is in the background never
  // reaches the in-app listener, and screen focus does not change when the app
  // is brought back - so without this the badge keeps its old number until the
  // user navigates away from Home and returns.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshUnreadNotificationCount();
      }
    });

    return () => subscription.remove();
  }, [refreshUnreadNotificationCount]);

  useFocusEffect(
    useCallback(() => {
      loadHome();
      loadCirclePreview();
      refreshUnreadNotificationCount();
    }, [loadCirclePreview, loadHome, refreshUnreadNotificationCount])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([loadHome(), loadCirclePreview(), refreshUnreadNotificationCount()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCirclePreview, loadHome, refreshUnreadNotificationCount]);

  // Both buttons make a workout and open it. No sheet in between: the box
  // exists so somebody who already knows what she is doing does not have to
  // answer a question first. The copy brings the exercises and the set
  // structure from last time and leaves the numbers empty, with last time's
  // as the placeholder - which is what the workout screen already does.
  const startWorkout = useCallback(
    async (createWorkout) => {
      if (isStarting) {
        return;
      }

      setIsStarting(true);

      try {
        const workout = await createWorkout();

        if (!workout?.workout_id) {
          throw new Error(t("home.quickStart.startFailedBody"));
        }

        navigation.navigate("WorkoutPage", {
          workout_id: workout.workout_id,
          workout_label: workout.workout_label ?? workout.label ?? null,
          workout_type: workout.workout_type ?? null,
          day: workout.day,
          date: workout.date,
          program_id: workout.program_id,
        });
      } catch (error) {
        console.error("Failed to start the workout:", error);
        Alert.alert(
          t("home.quickStart.startFailedTitle"),
          error instanceof Error
            ? error.message
            : t("home.quickStart.startFailedBody")
        );
      } finally {
        setIsStarting(false);
      }
    },
    [isStarting, navigation, t]
  );

  const openWorkoutFromSplit = useCallback(
    (group) => {
      if (!group?.lastWorkoutId) {
        return;
      }

      startWorkout(() =>
        programService.copyWorkoutToStandaloneDate(db, {
          workoutId: group.lastWorkoutId,
          date: new Date(),
        })
      );
    },
    [db, startWorkout]
  );

  const openEmptyWorkout = useCallback(() => {
    startWorkout(() =>
      programService.createQuickWorkout(db, {
        date: getTodaysDate(),
        workoutType: EMPTY_WORKOUT_TYPE,
        label: null,
      })
    );
  }, [db, startWorkout]);

  const upNext = splitGroups.find((group) => group.isUpNext) ?? null;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.cardBackground}
          />
        }
      >
        <GreetingHeader
          unreadNotificationCount={unreadNotificationCount}
          onOpenNotifications={() =>
            navigation.navigate("NotificationHistoryPage", {
              markNotificationsRead: true,
              notificationHistoryOpenId: Date.now(),
            })
          }
          onOpenProfile={() => navigation.navigate("ProfilePage")}
          displayName={
            circlePreview.currentUser?.displayName ??
            user?.user_metadata?.display_name ??
            user?.email?.split("@")[0] ??
            null
          }
          avatarUrl={circlePreview.currentUser?.avatarUrl ?? null}
        />

        {hasLoadedHome ? (
          <>
            <View style={styles.quickRow}>
              <DaysSinceCard days={daysSinceLastWorkout} />

              <QuickStartCard
                upNext={upNext}
                onStartSplit={openWorkoutFromSplit}
                onStartEmpty={openEmptyWorkout}
              />
            </View>

            <SplitCards
              groups={splitGroups}
              onOpenGroup={openWorkoutFromSplit}
              onOpenAll={() => navigation.navigate("WorkoutLibraryPage")}
            />
          </>
        ) : (
          <HomeSkeleton />
        )}

        <FriendsActivity
          currentUser={
            circlePreview.currentUser
              ? {
                  ...circlePreview.currentUser,
                  music: ownNowPlaying?.track
                    ? {
                        track: ownNowPlaying.track,
                        artist: ownNowPlaying.artist,
                        state: ownNowPlaying.state,
                      }
                    : null,
                }
              : null
          }
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          isLoading={isLoadingCirclePreview}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
          onOpenGym={(gymId) =>
            navigation.navigate("GymLeaderboardPage", { gym_id: gymId })
          }
          showHeader
        />

        <MuscleGlance
          groups={muscleGroups}
          headline={pickMuscleGlanceHeadline(muscleGroups)}
          onOpen={() => navigation.navigate("PersonalRecordsPage")}
        />
      </ScrollView>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
