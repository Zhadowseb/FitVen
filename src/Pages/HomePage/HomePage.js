import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./HomePageStyle";
import GreetingHeader from "./Components/GreetingHeader/GreetingHeader";
import HomeSkeleton from "./Components/HomeSkeleton/HomeSkeleton";
import BackgroundPostBar from "./Components/BackgroundPostBar/BackgroundPostBar";
import DaysSinceCard from "./Components/DaysSinceCard/DaysSinceCard";
import QuickStartCard from "./Components/QuickStartCard/QuickStartCard";
import SplitCards from "./Components/SplitCards/SplitCards";
import ExploreCarousel from "./Components/ExploreCarousel/ExploreCarousel";
import FriendsActivity from "@resources/Components/FriendsActivity/FriendsActivity";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText, ThemedView } from "@resources/ThemedComponents";
import {
  musicService,
  notificationService,
  programService,
  socialService,
  weightliftingService,
  workoutService,
} from "@services";
import { getTodaysDate } from "@utils/dateUtils";
import { subscribeWorkoutSetChanges } from "@utils/workoutSetEvents";
import { useAuth } from "../../Contexts/AuthContext";

/**
 * Home, for the person with no programme.
 *
 * She runs the same two or three sessions on a loop and wants the next one
 * open. So: how long since she trained, the session that is due, the rest of
 * her split, what her friends are doing, and a few things from Explore. No
 * posts - those are the Feed tab now - and no calendar strip, because a week
 * of empty squares is not what somebody without a programme needs to look
 * at.
 *
 * Every block has something to say without a history. Somebody who installed
 * the app this morning gets her first workout to press, the week her split
 * waits for, and Explore - not a row of zeroes.
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
  const [ownRecordsToday, setOwnRecordsToday] = useState(0);
  const [splitGroups, setSplitGroups] = useState([]);
  // When the first workout was finished; the split waits a week from it.
  const [firstWorkoutAt, setFirstWorkoutAt] = useState(null);
  // The Explore rail loads its own cards. A new key is pull-to-refresh
  // reaching it.
  const [exploreRefreshKey, setExploreRefreshKey] = useState(0);
  const [hasLoadedHome, setHasLoadedHome] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [homeError, setHomeError] = useState("");
  const [openToday, setOpenToday] = useState(null);
  // The running workout's sets, for the Quick start panel while it runs, and
  // the set the workout screen reported last - so "finished last" is the one
  // just ticked off, and a record can be celebrated for it.
  const [liveWorkout, setLiveWorkout] = useState(null);
  const recentSetRef = useRef({ workoutId: null, setId: null });
  const liveRequestRef = useRef(0);

  useEffect(() => musicService.subscribeNowPlaying(setOwnNowPlaying), []);

  const loadLiveWorkout = useCallback(
    async (today) => {
      const requestId = liveRequestRef.current + 1;
      const running = today?.first?.isRunning ? today.first : null;

      liveRequestRef.current = requestId;

      if (!running) {
        setLiveWorkout(null);
        return;
      }

      const recentSetId =
        Number(recentSetRef.current.workoutId) === Number(running.workoutId)
          ? recentSetRef.current.setId
          : null;

      try {
        const progress = await weightliftingService.getLiveWorkoutProgress(db, {
          workoutId: running.workoutId,
          recentSetId,
        });

        // Sets can be ticked off faster than this answers; only the newest
        // question's answer is drawn.
        if (liveRequestRef.current === requestId) {
          setLiveWorkout({ workoutId: running.workoutId, progress, recentSetId });
        }
      } catch (error) {
        console.error("Failed to load the running workout's sets:", error);
      }
    },
    [db]
  );

  // A set ticked off on the workout screen, with Home waiting under it: the
  // panel is up to date - the next set, the record - by the time it is back.
  const refreshLiveWorkout = useCallback(async () => {
    try {
      const today = await workoutService.getOpenWorkoutsToday(db);

      setOpenToday(today);
      await loadLiveWorkout(today);
    } catch (error) {
      console.error("Failed to refresh the running workout:", error);
    }
  }, [db, loadLiveWorkout]);

  useEffect(
    () =>
      subscribeWorkoutSetChanges((change) => {
        if (!change) {
          return;
        }

        recentSetRef.current = {
          workoutId: change.workoutId,
          setId: change.done ? change.setId : null,
        };
        refreshLiveWorkout();
      }),
    [refreshLiveWorkout]
  );

  // Settled, not all: the questions are independent, and one of them failing
  // is no reason to blank the others. A rejection used to empty all of them at
  // once and say nothing, so a person with months of history was told she had
  // never trained - which is the same sentence a real empty account gets.
  // That is the one thing this screen must not get wrong, and it is why the
  // first workout's date is reported like the rest: lost, it would hide a
  // real split behind "takes shape after your first week".
  const loadHome = useCallback(async () => {
    try {
      const [days, groups, firstWorkout, today, records] = await Promise.allSettled([
        workoutService.getDaysSinceLastWorkout(db),
        workoutService.getSplitGroups(db),
        workoutService.getFirstWorkoutAt(db),
        workoutService.getOpenWorkoutsToday(db),
        weightliftingService.getPersonalRecordsToday(db),
      ]);

      // Only a crown on your own tile rides on this; it is not one of the
      // loads the screen reports failing.
      setOwnRecordsToday(records.status === "fulfilled" ? records.value : 0);
      const failures = [days, groups, firstWorkout, today].filter(
        (result) => result.status === "rejected"
      );

      if (days.status === "fulfilled") {
        setDaysSinceLastWorkout(days.value);
      }

      if (groups.status === "fulfilled") {
        setSplitGroups(groups.value);
      }

      if (firstWorkout.status === "fulfilled") {
        setFirstWorkoutAt(firstWorkout.value);
      }

      if (today.status === "fulfilled") {
        setOpenToday(today.value);
        await loadLiveWorkout(today.value);
      }

      for (const failure of failures) {
        console.error("Failed to load part of the home screen:", failure.reason);
      }

      setHomeError(failures.length > 0 ? t("home.couldNotLoad") : "");
    } catch (error) {
      console.error("Failed to load the home screen:", error);
      setHomeError(t("home.couldNotLoad"));
    } finally {
      setHasLoadedHome(true);
    }
  }, [db, loadLiveWorkout, t]);

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({ currentUser: null, people: [] });
      setIsLoadingCirclePreview(false);
      return;
    }

    try {
      const preview = await socialService.getCirclePreview({
        user,
        limit: 12,
        date: getTodaysDate(),
      });

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
    setExploreRefreshKey((key) => key + 1);

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

  // Nothing is created here - the workout is already there, so this only
  // navigates. startWorkout is for the two buttons that make one.
  const continueToday = useCallback(
    (workout) => {
      if (!workout?.workoutId) {
        return;
      }

      navigation.navigate("WorkoutPage", {
        workout_id: workout.workoutId,
        workout_label: workout.name ?? null,
        workout_type: workout.workoutType ?? null,
      });
    },
    [navigation]
  );

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

        {/* A workout post that went out in the background from the finish
            sheet: how it is getting on, and a retry if it failed. */}
        <BackgroundPostBar />

        {/* Pull-to-refresh already retried this, but nothing on the screen
            said so. Without a line here a failed load is indistinguishable
            from an account that has never trained. */}
        {homeError ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.retry")}
            activeOpacity={0.85}
            onPress={loadHome}
            style={[
              styles.errorBanner,
              {
                backgroundColor: withAlpha(theme.danger, 0.12),
                borderColor: withAlpha(theme.danger, 0.4),
              },
            ]}
          >
            <ThemedText style={styles.errorText} setColor={theme.danger}>
              {homeError}
            </ThemedText>
            <ThemedText style={styles.errorRetry} setColor={theme.danger}>
              {t("home.retry")}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {hasLoadedHome ? (
          <>
            <View style={styles.quickRow}>
              <DaysSinceCard
                days={daysSinceLastWorkout}
                isTraining={Boolean(openToday?.first?.isRunning)}
                recordsToday={ownRecordsToday}
              />

              <QuickStartCard
                openToday={openToday}
                upNext={upNext}
                live={liveWorkout}
                onContinueToday={continueToday}
                onStartSplit={openWorkoutFromSplit}
                onStartEmpty={openEmptyWorkout}
                // "First workout" is only for somebody who has never finished one.
                hasTrained={daysSinceLastWorkout !== null || firstWorkoutAt !== null}
              />
            </View>

            <SplitCards
              groups={splitGroups}
              firstWorkoutAt={firstWorkoutAt}
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
                  // From the phone, so your own tile is right before a sync.
                  daysSinceLastWorkout,
                  recordsToday: ownRecordsToday,
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
          onSeeAll={() => navigation.navigate("SocialPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
          onOpenPerson={(person) =>
            navigation.navigate("PublicProfilePage", { userId: person.id })
          }
          onOpenGym={(gymId) =>
            navigation.navigate("GymLeaderboardPage", { gym_id: gymId })
          }
          showHeader
        />

        {/* In place of "Last month", for everybody: for somebody new that was
            five times 0 %, and Explore has something to show from day one. */}
        <ExploreCarousel refreshKey={exploreRefreshKey} />
      </ScrollView>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
