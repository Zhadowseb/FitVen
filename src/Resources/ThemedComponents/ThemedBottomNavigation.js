import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import StartWorkoutSheet from "../Components/StartWorkoutSheet";
import {
  isWorkoutComingSoon,
  isWorkoutTypeComingSoon,
} from "../../Utils/workoutTypeAvailability";
import { usePulseAnimation } from "../Components/animationHooks";
import Home from "../Icons/UI-icons/Home";
import Note from "../Icons/UI-icons/Note";
import Plus from "../Icons/UI-icons/Plus";
import Search from "../Icons/UI-icons/Search";
import UpwardGraf from "../Icons/UI-icons/UpwardGraf";
import { notificationService, programService, workoutService } from "../../Services";
import { useAuth } from "../../Contexts/AuthContext";
import {
  getTodaysDate,
  normalizeLocalDateString,
  parseCustomDate,
} from "../../Utils/dateUtils";
import {
  formatCountdownTime,
  formatElapsedTime,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../Utils/timeUtils";
import { subscribeQuickWorkoutMenu } from "../../Utils/quickWorkoutMenuEvents";
import {
  clearActiveRestTimer,
  getActiveRestTimer,
  subscribeRestTimer,
} from "../../Utils/restTimerEvents";

const RECENT_WORKOUT_PREVIEW_LIMIT = 2;
const RECENT_WORKOUT_PAGE_SIZE = 10;

const LIVE_TIMER_SIZE = 66;
const LIVE_RING_STROKE = 3;
// The running timer is the plus with a countdown in it, so it is the same
// shape as the plus: a rounded square, not a circle. The ring around it is a
// rounded rect for the same reason - a circular ring around a square button
// read as a different control appearing mid-workout.
const LIVE_RING_CORNER = 16;
const LIVE_RING_INSET = LIVE_RING_STROKE / 2 + 3;
const LIVE_RING_SIDE = LIVE_TIMER_SIZE - 2 * LIVE_RING_INSET;
// A rounded rect's outline: the four straight runs plus the four corner
// quarters, which together are one full circle of the corner radius. The rest
// countdown depletes this the same way it depleted the circumference.
const LIVE_RING_CIRCUMFERENCE =
  4 * (LIVE_RING_SIDE - 2 * LIVE_RING_CORNER) + 2 * Math.PI * LIVE_RING_CORNER;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getPlannedShortcut(snapshots, date) {
  const workouts = snapshots.flatMap((snapshot) =>
    snapshot.workouts
      .filter((workout) => Number(workout.done) !== 1)
      .map((workout) => ({
        date,
        day: snapshot.day,
        programId: snapshot.program?.program_id ?? null,
        // No program: the sheet shows its translated "Workout calendar".
        programName: snapshot.program?.program_name ?? null,
        workout,
      }))
  );

  return workouts.length > 0 ? { date, workouts } : null;
}

const PROFILE_ROUTES = new Set([
  "ProfilePage",
  "EditProfilePage",
  "SocialPostSettingsPage",
  "ExerciseSocialPostSettingsPage",
  "WorkoutTypesSettingsPage",
  "MusicSettingsPage",
]);
// Explore is where things are found, and everything found from it stays under
// it however deep you go: the search, centres - the list, one centre, one
// exercise there - and the whole country.
const EXPLORE_ROUTES = new Set([
  "ExplorePage",
  "ExploreSearchPage",
  "ProgramsBrowsePage",
  "CustomExercisesPage",
  "CenterPostsPage",
  "GymsPage",
  "GymLeaderboardPage",
  "GymExerciseLeaderboardPage",
  "NationalExerciseLeaderboardPage",
  // One category - Consistency, Powerlifting, Progress, Calisthenics - at the
  // level it was opened from.
  "CategoryLeaderboardPage",
]);
const FEED_ROUTES = new Set([
  "FeedPage",
  "WorkoutPostsPage",
]);
const LIBRARY_ROUTES = new Set([
  "ExerciseLibraryPage",
  "ExerciseCatalogPage",
  "PersonalRecordsPage",
  "RecordsExercisePage",
  "StatisticsPage",
  "StatisticsDetailPage",
  "ProgramPage",
  "ProgramOverviewPage",
  "MicrocyclePage",
  "WeekPage",
  "WorkoutCalendarPage",
  "SicknessPage",
  "OneRepMaxCalculatorPage",
  // Your own exercise - what it is, and whether others can find it - is
  // opened from your exercise library.
  "MyExercisePage",
]);
// Somebody's profile and their posts are opened from a name anywhere - the
// feed, a leaderboard, Explore - and stay under the tab they were opened from.
const INHERIT_TAB_ROUTES = new Set([
  "NotificationHistoryPage",
  "NotificationSettingsPage",
  "PublicProfilePage",
  "UserPostsPage",
  // Your followers and the people search: from Explore's Social button, from
  // the counts on your profile, from Home's friends strip.
  "SocialPage",
  "SocialUserListPage",
  // One shared exercise: from Explore's library, and from your own exercise
  // as "see it as others do".
  "CustomExerciseDetailPage",
]);

function ThemedBottomNavigation({ currentRouteName, navigationRef }) {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [quickWorkoutModalVisible, setQuickWorkoutModalVisible] =
    useState(false);
  const [isCreatingQuickWorkout, setIsCreatingQuickWorkout] = useState(false);
  const [plannedTodayShortcut, setPlannedTodayShortcut] = useState(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { user } = useAuth();
  const [usualWorkouts, setUsualWorkouts] = useState([]);
  const [isLoadingUsualWorkouts, setIsLoadingUsualWorkouts] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [isLoadingRecentWorkouts, setIsLoadingRecentWorkouts] = useState(false);
  const [hasMoreRecentWorkouts, setHasMoreRecentWorkouts] = useState(false);
  const [isLoadingMoreRecentWorkouts, setIsLoadingMoreRecentWorkouts] =
    useState(false);
  const [activeWorkoutTimer, setActiveWorkoutTimer] = useState(null);
  const [startableWorkout, setStartableWorkout] = useState(null);
  const [isStartingWorkoutTimer, setIsStartingWorkoutTimer] = useState(false);
  const [activeRestTimer, setActiveRestTimer] = useState(() =>
    getActiveRestTimer()
  );
  const [timerTick, setTimerTick] = useState(getCurrentStoredTimestampSeconds());
  const quickWorkoutDateRef = useRef(getTodaysDate());
  const quickWorkoutTargetRef = useRef(null);
  const activeWorkoutLoadRef = useRef(false);
  const recentWorkoutLoadRequestRef = useRef(0);
  const recentWorkoutAppendLoadRef = useRef(false);
  const lastResolvedTabRef = useRef("home");

  // Notification settings is reached from the Home bell and from Profile, so
  // no fixed table can be right for both: listing it under Profile meant the
  // tab changed under a user halfway through a flow they started on Home.
  // These routes keep whichever tab the user was already on.
  const inheritedTab = INHERIT_TAB_ROUTES.has(currentRouteName)
    ? lastResolvedTabRef.current
    : null;
  const isProfileActive =
    inheritedTab === "profile" ||
    (!inheritedTab && PROFILE_ROUTES.has(currentRouteName));
  const isExploreActive =
    inheritedTab === "explore" ||
    (!inheritedTab && EXPLORE_ROUTES.has(currentRouteName));
  const isLibraryActive =
    inheritedTab === "library" ||
    (!inheritedTab && LIBRARY_ROUTES.has(currentRouteName));
  const isFeedActive =
    inheritedTab === "feed" ||
    (!inheritedTab && FEED_ROUTES.has(currentRouteName));
  const isHomeActive =
    !isProfileActive && !isExploreActive && !isLibraryActive && !isFeedActive;
  const resolvedTab = isProfileActive
    ? "profile"
    : isFeedActive
      ? "feed"
      : isExploreActive
        ? "explore"
        : isLibraryActive
          ? "library"
          : "home";

  useEffect(() => {
    if (!INHERIT_TAB_ROUTES.has(currentRouteName)) {
      lastResolvedTabRef.current = resolvedTab;
    }
  }, [currentRouteName, resolvedTab]);
  // The active tab is the theme's title colour, not the accent: the accent is
  // now only the rule above it and the plus. Contrast comes for free, which
  // the accent never had on the light bar - #F7742E is 2.8:1 there, worse than
  // the inactive grey it is meant to stand out from.
  const activeColor = theme.title ?? theme.text;
  const indicatorColor =
    colorScheme === "light" ? theme.primaryDark ?? theme.primary : theme.primary;
  const inactiveColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const barBackground =
    theme.navBackground ?? theme.cardBackground ?? theme.background;
  const barBorder = theme.hairline ?? theme.cardBorder ?? theme.iconColor;
  const plusBackground = theme.primary;
  const plusIconColor = theme.textInverted ?? theme.cardBackground;
  const fabBorderColor = theme.background ?? barBackground;
  const activeWorkoutElapsed = activeWorkoutTimer
    ? normalizeElapsedDurationSeconds(activeWorkoutTimer.elapsed_time, 0) +
      Math.max(
        0,
        normalizeStoredTimestampSeconds(activeWorkoutTimer.timer_start) === null
          ? 0
          : timerTick -
              normalizeStoredTimestampSeconds(activeWorkoutTimer.timer_start)
      )
    : 0;
  const restTimerRemaining = activeRestTimer
    ? Math.max(0, activeRestTimer.endsAt - timerTick)
    : 0;
  const isRestTimerActive = restTimerRemaining > 0;
  const shouldShowCenterTimer = Boolean(activeWorkoutTimer) || isRestTimerActive;
  const centerTimerText = isRestTimerActive
    ? formatCountdownTime(restTimerRemaining)
    : formatElapsedTime(activeWorkoutElapsed);
  const restDurationSeconds = activeRestTimer
    ? Math.max(
        1,
        normalizeElapsedDurationSeconds(activeRestTimer.durationSeconds, 0)
      )
    : 1;
  const restRingFraction = isRestTimerActive
    ? Math.max(0, Math.min(1, restTimerRemaining / restDurationSeconds))
    : 0;

  const fabPulse = usePulseAnimation(shouldShowCenterTimer);
  const restRingOffset = useRef(new Animated.Value(0)).current;
  const restRingTimerIdRef = useRef(null);

  useEffect(() => {
    if (!isRestTimerActive || !activeRestTimer) {
      restRingTimerIdRef.current = null;
      return;
    }

    const targetOffset = LIVE_RING_CIRCUMFERENCE * (1 - restRingFraction);

    if (restRingTimerIdRef.current !== activeRestTimer.id) {
      restRingTimerIdRef.current = activeRestTimer.id;
      restRingOffset.setValue(targetOffset);
      return;
    }

    Animated.timing(restRingOffset, {
      toValue: targetOffset,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [activeRestTimer, isRestTimerActive, restRingFraction, restRingOffset]);

  // The tabs keep the stack at [Home] or [Home, that tab], and Home is never
  // rebuilt to get there.
  //
  // Both halves were costing seconds. Home used to call resetRoot, which threw
  // the stack away and mounted a brand new Home: skeleton, every query from
  // cold, the friends strip and the avatar fetched again - measured on a
  // phone with three months of history at 2.3 s before anything showed and
  // 4.1 s before it was all there, on every tap. And the other three used
  // navigate(), which in React Navigation 7 pushes a fresh copy of a screen
  // that is not on top rather than going back to it, so Train -> Feed ->
  // Train was two Trains, each mounted from nothing, and the stack grew with
  // every press.
  //
  // `reset` keeps a route that is handed back with its key - the component
  // instance survives - so passing the existing Home route through keeps it
  // mounted with what it last drew, and its focus effect refreshes it in the
  // background. A tab already on the stack is reused the same way.
  const goToTab = (routeName) => {
    if (!navigationRef?.isReady?.()) {
      return;
    }

    const state = navigationRef.getRootState?.();
    const routes = state?.routes ?? [];
    const home = routes.find((route) => route.name === "HomePage");

    // Signed out, or a state this does not recognise: fall back to the one
    // thing that always works.
    if (!home) {
      navigationRef.resetRoot({ index: 0, routes: [{ name: routeName }] });
      return;
    }

    if (routeName === "HomePage") {
      if (routes.length > 1) {
        navigationRef.reset({ index: 0, routes: [home] });
      }
      return;
    }

    const existing = routes.find((route) => route.name === routeName);

    navigationRef.reset({
      index: 1,
      routes: [home, existing ?? { name: routeName }],
    });
  };

  const handleHomePress = () => {
    goToTab("HomePage");
  };

  const handleProfilePress = () => {
    if (!navigationRef?.isReady?.() || currentRouteName === "ProfilePage") {
      return;
    }

    navigationRef.navigate("ProfilePage");
  };

  const refreshUnreadNotificationCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotificationCount(0);
      return;
    }

    try {
      setUnreadNotificationCount(
        await notificationService.getUnreadNotificationCount({ user })
      );
    } catch {
      // No dot is the honest version of not knowing.
    }
  }, [user]);

  useEffect(() => {
    refreshUnreadNotificationCount();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshUnreadNotificationCount();
      }
    });

    return () => subscription.remove();
  }, [refreshUnreadNotificationCount, currentRouteName]);

  const handleFeedPress = () => {
    if (!navigationRef?.isReady?.() || currentRouteName === "FeedPage") {
      return;
    }

    goToTab("FeedPage");
  };

  const handleExplorePress = () => {
    if (!navigationRef?.isReady?.() || currentRouteName === "ExplorePage") {
      return;
    }

    goToTab("ExplorePage");
  };

  const handleLibraryPress = () => {
    if (!navigationRef?.isReady?.() || currentRouteName === "ExerciseLibraryPage") {
      return;
    }

    goToTab("ExerciseLibraryPage");
  };

  const handleCenterButtonPress = () => {
    if (activeWorkoutTimer && navigationRef?.isReady?.()) {
      navigationRef.navigate("WorkoutPage", {
        workout_id: activeWorkoutTimer.workout_id,
        workout_label:
          activeWorkoutTimer.label ?? activeWorkoutTimer.workout_type,
        workout_type:
          activeWorkoutTimer.workout_type ?? activeWorkoutTimer.label,
        day: activeWorkoutTimer.day,
        date: activeWorkoutTimer.date,
        program_id: activeWorkoutTimer.program_id,
      });
      return;
    }

    if (
      isRestTimerActive &&
      activeRestTimer?.navigationTarget &&
      navigationRef?.isReady?.()
    ) {
      navigationRef.navigate("WorkoutPage", activeRestTimer.navigationTarget);
      return;
    }

    handleQuickWorkoutPress();
  };

  const loadPlannedShortcut = useCallback(async (workoutDate) => {
    try {
      const snapshots = await programService.getTodayWorkoutSnapshots(
        db,
        { date: workoutDate }
      );

      setPlannedTodayShortcut(
        getPlannedShortcut(snapshots, workoutDate)
      );
    } catch (error) {
      console.error("Failed to load the planned workout:", error);
      setPlannedTodayShortcut(null);
    }
  }, [db]);

  const loadRecentWorkouts = useCallback(
    async (
      todayDate,
      {
        append = false,
        limit = RECENT_WORKOUT_PREVIEW_LIMIT,
        offset = 0,
      } = {}
    ) => {
      if (append && recentWorkoutAppendLoadRef.current) {
        return;
      }

      const requestId = recentWorkoutLoadRequestRef.current + 1;
      recentWorkoutLoadRequestRef.current = requestId;

      try {
        if (append) {
          recentWorkoutAppendLoadRef.current = true;
          setIsLoadingMoreRecentWorkouts(true);
        } else {
          recentWorkoutAppendLoadRef.current = false;
          setIsLoadingMoreRecentWorkouts(false);
          setIsLoadingRecentWorkouts(true);
        }

        const workouts = await programService.getRecentWorkouts(db, {
          date: todayDate,
          limit: limit + 1,
          offset,
        });
        const visibleWorkouts = workouts.slice(0, limit);

        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        setHasMoreRecentWorkouts(workouts.length > limit);
        setRecentWorkouts((currentWorkouts) =>
          append ? [...currentWorkouts, ...visibleWorkouts] : visibleWorkouts
        );
      } catch (error) {
        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        console.error("Failed to load recent workouts:", error);
        setHasMoreRecentWorkouts(false);

        if (!append) {
          setRecentWorkouts([]);
        }
      } finally {
        if (recentWorkoutLoadRequestRef.current !== requestId) {
          return;
        }

        if (append) {
          recentWorkoutAppendLoadRef.current = false;
          setIsLoadingMoreRecentWorkouts(false);
        } else {
          setIsLoadingRecentWorkouts(false);
        }
      }
    },
    [db]
  );

  const loadUsualWorkouts = useCallback(async (todayDate) => {
    try {
      setIsLoadingUsualWorkouts(true);
      const workouts = await programService.getUsualWorkouts(db, {
        date: todayDate,
        limit: 2,
        minOccurrences: 2,
      });

      setUsualWorkouts(workouts);
    } catch (error) {
      console.error("Failed to load usual workouts:", error);
      setUsualWorkouts([]);
    } finally {
      setIsLoadingUsualWorkouts(false);
    }
  }, [db]);

  const handleQuickWorkoutPress = useCallback((target = null) => {
    if (isCreatingQuickWorkout) {
      return;
    }

    const quickWorkoutDate =
      normalizeLocalDateString(target?.date) ?? getTodaysDate();
    quickWorkoutDateRef.current = quickWorkoutDate;
    quickWorkoutTargetRef.current = target
      ? {
          date: quickWorkoutDate,
          day: target.day ?? null,
          dayId: target.dayId ?? null,
          programId: target.programId ?? null,
          programName: target.programName ?? null,
        }
      : null;
    setPlannedTodayShortcut(null);
    setUsualWorkouts([]);
    setRecentWorkouts([]);
    setHasMoreRecentWorkouts(false);
    setIsLoadingMoreRecentWorkouts(false);
    setQuickWorkoutModalVisible(true);
    loadPlannedShortcut(quickWorkoutDate);
    loadUsualWorkouts(quickWorkoutDate);
    loadRecentWorkouts(quickWorkoutDate, {
      limit: RECENT_WORKOUT_PAGE_SIZE,
    });
  }, [
    isCreatingQuickWorkout,
    loadPlannedShortcut,
    loadRecentWorkouts,
    loadUsualWorkouts,
  ]);

  const handleLoadMoreRecentWorkouts = useCallback(() => {
    if (
      isLoadingRecentWorkouts ||
      isLoadingMoreRecentWorkouts ||
      !hasMoreRecentWorkouts
    ) {
      return;
    }

    loadRecentWorkouts(quickWorkoutDateRef.current, {
      append: true,
      limit: RECENT_WORKOUT_PAGE_SIZE,
      offset: recentWorkouts.length,
    });
  }, [
    hasMoreRecentWorkouts,
    isLoadingMoreRecentWorkouts,
    isLoadingRecentWorkouts,
    loadRecentWorkouts,
    recentWorkouts.length,
  ]);

  useEffect(() => {
    return subscribeQuickWorkoutMenu(handleQuickWorkoutPress);
  }, [handleQuickWorkoutPress]);

  useEffect(() => {
    return subscribeRestTimer(setActiveRestTimer);
  }, []);

  // Starts the day's existing workout straight from the nav button and drops
  // the user into it, so they skip the create-workout sheet.
  const handleStartWorkoutTimer = useCallback(async () => {
    if (!startableWorkout || isStartingWorkoutTimer) {
      return;
    }

    setIsStartingWorkoutTimer(true);

    try {
      const startTime = getCurrentStoredTimestampSeconds();

      if (startableWorkout.original_start_time === null) {
        await workoutService.setWorkoutOriginalStartTime(db, {
          workoutId: startableWorkout.workout_id,
          startTime,
        });
        workoutService.notifyWorkoutStartedInBackground(db, {
          workoutId: startableWorkout.workout_id,
          startedAt: startTime,
        });
      }

      await workoutService.persistWorkoutTimerState(db, {
        workoutId: startableWorkout.workout_id,
        timerStart: startTime,
        elapsedTime: normalizeElapsedDurationSeconds(
          startableWorkout.elapsed_time,
          0
        ),
      });

      if (navigationRef?.isReady?.()) {
        navigationRef.navigate("WorkoutPage", {
          workout_id: startableWorkout.workout_id,
          workout_label: startableWorkout.label ?? startableWorkout.workout_type,
          workout_type: startableWorkout.workout_type ?? startableWorkout.label,
          day: startableWorkout.day,
          date: startableWorkout.date,
          program_id: startableWorkout.program_id,
        });
      }
    } catch (error) {
      console.error("Failed to start workout from the nav button:", error);
    } finally {
      setIsStartingWorkoutTimer(false);
    }
  }, [db, isStartingWorkoutTimer, startableWorkout]);

  const loadActiveWorkoutTimer = useCallback(async () => {
    if (activeWorkoutLoadRef.current) {
      return;
    }

    activeWorkoutLoadRef.current = true;

    try {
      const workout = await workoutService.getActiveWorkoutTimer(db);
      setActiveWorkoutTimer(workout ?? null);
      setStartableWorkout(
        workout
          ? null
          : await workoutService.getStartableWorkout(db, {
              date: getTodaysDate(),
            })
      );
      setTimerTick(getCurrentStoredTimestampSeconds());
    } catch (error) {
      console.error("Failed to load active workout timer:", error);
      setActiveWorkoutTimer(null);
      setStartableWorkout(null);
    } finally {
      activeWorkoutLoadRef.current = false;
    }
  }, [db]);

  // This bar is mounted for the whole signed-in session, and its interval used
  // to run at 1 Hz regardless: a SQLite query and a state update - which
  // re-renders this component and everything under it - sixty times a minute
  // with no workout anywhere in sight. The app never went idle.
  //
  // A second is what a running clock needs. Nothing else here does.
  const hasRunningTimer = Boolean(activeWorkoutTimer) || Boolean(activeRestTimer);
  const pollIntervalMs = hasRunningTimer ? 1000 : 10000;

  useEffect(() => {
    loadActiveWorkoutTimer();

    const interval = setInterval(() => {
      // The tick exists to advance a displayed clock. Without one, setting it
      // only forces a re-render of a screen that has not changed.
      if (hasRunningTimer) {
        setTimerTick(getCurrentStoredTimestampSeconds());
      }

      loadActiveWorkoutTimer();
    }, pollIntervalMs);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          loadActiveWorkoutTimer();
        }
      }
    );

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [loadActiveWorkoutTimer, hasRunningTimer, pollIntervalMs]);

  // Moving between screens is how a workout usually starts or ends, so the
  // slower idle poll almost never decides anything on its own.
  useEffect(() => {
    loadActiveWorkoutTimer();
  }, [currentRouteName, loadActiveWorkoutTimer]);

  useEffect(() => {
    if (activeRestTimer && activeRestTimer.endsAt <= timerTick) {
      clearActiveRestTimer(activeRestTimer.id);
    }
  }, [activeRestTimer, timerTick]);

  const resolveQuickWorkoutTarget = async () => {
    const target = quickWorkoutTargetRef.current;

    if (!target?.programId || target.dayId) {
      return target;
    }

    const day = await programService.getDayByDate(db, {
      programId: target.programId,
      date: target.date,
    });

    if (!day?.day_id) {
      throw new Error(t("nav.quickWorkout.programDayNotFound"));
    }

    const resolvedTarget = {
      ...target,
      dayId: day.day_id,
    };
    quickWorkoutTargetRef.current = resolvedTarget;

    return resolvedTarget;
  };

  const handleCreateQuickWorkout = async (workoutType) => {
    if (!navigationRef?.isReady?.() || isCreatingQuickWorkout) {
      return;
    }

    // Backstop for the disabled types - the sheet already blocks the tap.
    if (isWorkoutTypeComingSoon(workoutType?.id)) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const workoutLabel = workoutType.displayName ?? workoutType.id;
      const target = await resolveQuickWorkoutTarget();
      let workout;

      if (target?.dayId) {
        const workoutResult = await programService.createWorkoutForDay(db, {
          date: target.date,
          dayId: target.dayId,
          workoutType: workoutType.id,
          label: null,
        });

        workout = {
          workout_id: workoutResult.lastInsertRowId,
          workout_type: workoutType.id,
          workout_label: workoutLabel,
          date: target.date,
          day: target.day,
          program_id: target.programId,
          program_name: target.programName,
        };
      } else {
        workout = await programService.createQuickWorkout(db, {
          date: quickWorkoutDateRef.current,
          workoutType: workoutType.id,
          label: null,
        });
      }

      navigationRef.navigate("WorkoutPage", {
        program_id: workout.program_id,
        day: workout.day,
        date: workout.date,
        workout_id: workout.workout_id,
        workout_label: workoutLabel,
        workout_type: workoutType.id,
      });
    } catch (error) {
      console.error("Failed to create quick workout:", error);
      Alert.alert(
        t("nav.quickWorkout.createFailedTitle"),
        t("nav.quickWorkout.pleaseTryAgain")
      );
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  const handleOpenPlannedWorkout = (plannedSelection) => {
    const selectedWorkout =
      plannedSelection ?? plannedTodayShortcut?.workouts?.[0] ?? null;
    const plannedWorkout = selectedWorkout?.workout;

    if (!navigationRef?.isReady?.() || !plannedWorkout) {
      return;
    }

    setQuickWorkoutModalVisible(false);

    navigationRef.navigate("WorkoutPage", {
      workout_id: plannedWorkout.workout_id,
      workout_label: plannedWorkout.label,
      workout_type: getWorkoutType(plannedWorkout),
      day: selectedWorkout.day?.Weekday,
      date: selectedWorkout.date,
      program_id: selectedWorkout.programId,
    });
  };

  const handleCopyRecentWorkout = async (workout) => {
    if (!navigationRef?.isReady?.() || !workout || isCreatingQuickWorkout) {
      return;
    }

    if (isWorkoutComingSoon(workout)) {
      return;
    }

    setIsCreatingQuickWorkout(true);
    setQuickWorkoutModalVisible(false);

    try {
      const target = await resolveQuickWorkoutTarget();
      let copiedWorkout;

      if (target?.dayId && target?.programId) {
        const copiedWorkoutId = await programService.copyWorkoutToDate(db, {
          workoutId: workout.workout_id,
          programId: target.programId,
          date: parseCustomDate(target.date),
        });

        copiedWorkout = copiedWorkoutId
          ? {
              workout_id: copiedWorkoutId,
              workout_label: workout.label ?? workout.workout_type,
              workout_type: workout.workout_type ?? workout.label,
              day: target.day,
              date: target.date,
              program_id: target.programId,
            }
          : null;
      } else {
        copiedWorkout = await programService.copyWorkoutToStandaloneDate(db, {
          workoutId: workout.workout_id,
          date: quickWorkoutDateRef.current,
        });
      }

      if (!copiedWorkout) {
        throw new Error(t("nav.quickWorkout.recentCopyFailed"));
      }

      navigationRef.navigate("WorkoutPage", {
        workout_id: copiedWorkout.workout_id,
        workout_label: copiedWorkout.workout_label,
        workout_type: copiedWorkout.workout_type,
        day: copiedWorkout.day,
        date: copiedWorkout.date,
        program_id: copiedWorkout.program_id,
      });
    } catch (error) {
      console.error("Failed to copy recent workout:", error);
      Alert.alert(
        t("nav.quickWorkout.copyFailedTitle"),
        error instanceof Error
          ? error.message
          : t("nav.quickWorkout.pleaseTryAgain")
      );
    } finally {
      setIsCreatingQuickWorkout(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: barBackground,
            borderTopColor: barBorder,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.itemsRow}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleHomePress}
            style={styles.tab}
          >
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isHomeActive ? indicatorColor : "transparent",
                },
              ]}
            />
            <View style={styles.tabIcon}>
              <Home
                width={23}
                height={23}
                color={isHomeActive ? activeColor : inactiveColor}

                thickness={1.8}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                styles.tabLabelSpacing,
                { color: isHomeActive ? activeColor : inactiveColor },
              ]}
            >
              {t("nav.tabs.home")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleLibraryPress}
            style={styles.tab}
          >
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isLibraryActive ? indicatorColor : "transparent",
                },
              ]}
            />
            <View style={styles.tabIcon}>
              <UpwardGraf
                width={23}
                height={23}
                color={isLibraryActive ? activeColor : inactiveColor}

                thickness={1.6}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                styles.tabLabelSpacing,
                { color: isLibraryActive ? activeColor : inactiveColor },
              ]}
            >
              {t("nav.tabs.train")}
            </Text>
          </TouchableOpacity>

          <View style={styles.plusSlot}>
            {shouldShowCenterTimer ? (
              <View style={styles.liveTimerWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.liveTimerPulse,
                    {
                      backgroundColor: withAlpha(plusBackground, 0.5),
                      opacity: fabPulse.opacity,
                      transform: [{ scale: fabPulse.scale }],
                    },
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.86}
                  accessibilityLabel={
                    isRestTimerActive
                      ? t("nav.centerButton.activeRestTimer", {
                          time: centerTimerText,
                        })
                      : t("nav.centerButton.activeWorkoutTimer", {
                          time: centerTimerText,
                        })
                  }
                  accessibilityRole="button"
                  disabled={isCreatingQuickWorkout}
                  onPress={handleCenterButtonPress}
                  style={[
                    styles.liveTimerButton,
                    {
                      backgroundColor: plusBackground,
                      borderColor: fabBorderColor,
                      shadowColor: plusBackground,
                      opacity: isCreatingQuickWorkout ? 0.72 : 1,
                    },
                  ]}
                >
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[styles.liveTimerValue, { color: plusIconColor }]}
                  >
                    {centerTimerText}
                  </Text>
                </TouchableOpacity>
                {isRestTimerActive ? (
                  <Svg
                    pointerEvents="none"
                    width={LIVE_TIMER_SIZE}
                    height={LIVE_TIMER_SIZE}
                    viewBox={`0 0 ${LIVE_TIMER_SIZE} ${LIVE_TIMER_SIZE}`}
                    style={styles.liveTimerRing}
                  >
                    <Rect
                      x={LIVE_RING_INSET}
                      y={LIVE_RING_INSET}
                      width={LIVE_RING_SIDE}
                      height={LIVE_RING_SIDE}
                      rx={LIVE_RING_CORNER}
                      fill="none"
                      stroke={withAlpha(plusBackground, 0.25)}
                      strokeWidth={LIVE_RING_STROKE}
                    />
                    <AnimatedRect
                      x={LIVE_RING_INSET}
                      y={LIVE_RING_INSET}
                      width={LIVE_RING_SIDE}
                      height={LIVE_RING_SIDE}
                      rx={LIVE_RING_CORNER}
                      fill="none"
                      stroke={plusBackground}
                      strokeWidth={LIVE_RING_STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${LIVE_RING_CIRCUMFERENCE}`}
                      strokeDashoffset={restRingOffset}
                    />
                  </Svg>
                ) : (
                  <Svg
                    pointerEvents="none"
                    width={LIVE_TIMER_SIZE}
                    height={LIVE_TIMER_SIZE}
                    viewBox={`0 0 ${LIVE_TIMER_SIZE} ${LIVE_TIMER_SIZE}`}
                    style={styles.liveTimerRing}
                  >
                    {/* Workout running: the whole outline. Rest counts down
                        as a depleting one in the branch above. */}
                    <Rect
                      x={LIVE_RING_INSET}
                      y={LIVE_RING_INSET}
                      width={LIVE_RING_SIDE}
                      height={LIVE_RING_SIDE}
                      rx={LIVE_RING_CORNER}
                      fill="none"
                      stroke={plusBackground}
                      strokeWidth={LIVE_RING_STROKE}
                    />
                  </Svg>
                )}
              </View>
            ) : startableWorkout ? (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel={t("nav.centerButton.startWorkout", {
                  workout:
                    startableWorkout.label ?? startableWorkout.workout_type,
                })}
                accessibilityRole="button"
                disabled={isStartingWorkoutTimer}
                onPress={handleStartWorkoutTimer}
                style={[
                  styles.plusButton,
                  {
                    backgroundColor: plusBackground,
                    borderColor: fabBorderColor,
                    shadowColor: plusBackground,
                    opacity: isStartingWorkoutTimer ? 0.72 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.playIcon, { borderLeftColor: plusIconColor }]}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel={t("nav.centerButton.createWorkout")}
                accessibilityRole="button"
                disabled={isCreatingQuickWorkout}
                onPress={handleCenterButtonPress}
                style={[
                  styles.plusButton,
                  {
                    backgroundColor: plusBackground,
                    borderColor: fabBorderColor,
                    shadowColor: plusBackground,
                    opacity: isCreatingQuickWorkout ? 0.72 : 1,
                  },
                ]}
              >
                <Plus
                  width={26}
                  height={26}
                  color={plusIconColor}
                  thickness={2.4}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleFeedPress}
            style={styles.tab}
          >
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isFeedActive ? indicatorColor : "transparent",
                },
              ]}
            />
            <View style={styles.tabIcon}>
              <Note
                width={23}
                height={23}
                color={isFeedActive ? activeColor : inactiveColor}
                thickness={1.5}
              />

              {unreadNotificationCount > 0 ? (
                <View
                  style={[
                    styles.tabDot,
                    { backgroundColor: theme.primary, borderColor: barBackground },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                styles.tabLabelSpacing,
                { color: isFeedActive ? activeColor : inactiveColor },
              ]}
            >
              {t("nav.tabs.feed")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleExplorePress}
            style={styles.tab}
          >
            <View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: isExploreActive ? indicatorColor : "transparent",
                },
              ]}
            />
            <View style={styles.tabIcon}>
              <Search
                width={23}
                height={23}
                color={isExploreActive ? activeColor : inactiveColor}
                thickness={1.8}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                styles.tabLabelSpacing,
                { color: isExploreActive ? activeColor : inactiveColor },
              ]}
            >
              {t("nav.tabs.explore")}
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      <StartWorkoutSheet
        visible={quickWorkoutModalVisible}
        onClose={() => setQuickWorkoutModalVisible(false)}
        onStartFresh={handleCreateQuickWorkout}
        onOpenPlannedWorkout={handleOpenPlannedWorkout}
        plannedTodayShortcut={plannedTodayShortcut}
        usualWorkouts={usualWorkouts}
        isLoadingUsualWorkouts={isLoadingUsualWorkouts}
        recentWorkouts={recentWorkouts}
        isLoadingRecentWorkouts={isLoadingRecentWorkouts}
        isLoadingMoreRecentWorkouts={isLoadingMoreRecentWorkouts}
        onLoadMoreRecentWorkouts={handleLoadMoreRecentWorkouts}
        onCopyRecentWorkout={handleCopyRecentWorkout}
        isStartingWorkout={isCreatingQuickWorkout}
        targetDate={quickWorkoutDateRef.current}
      />
    </>
  );
}

export default ThemedBottomNavigation;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  itemsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 10,
    // Replaces the padding the removed handle row used to provide, so the tabs
    // do not sit flush against the edge on devices without a bottom inset.
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0,
  },
  // Always drawn, transparent when the tab is not active. Without the space it
  // holds, the active tab's icon sits 2 dp higher than the rest.
  tabIndicator: {
    width: 22,
    height: 2,
    borderRadius: 1,
  },
  tabIcon: {
    marginTop: 9,
  },
  // Eight across, on the icon rather than the column, so it sits against the
  // glyph and not against whatever the label's width happens to be.
  tabDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  tabLabelSpacing: {
    marginTop: 3,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  plusSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  // In the line, not over it. It used to be 56 dp with a 5 dp cut-out in the
  // bar's top edge, which made the bar look broken on a screen where nothing
  // else breaks a line. 48 dp, square-ish, sitting where the icons sit, with
  // the top padding that lines it up with them.
  plusButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 18,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginLeft: 5,
  },
  liveTimerWrap: {
    width: LIVE_TIMER_SIZE,
    height: LIVE_TIMER_SIZE,
    marginTop: -13,
  },
  liveTimerPulse: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: LIVE_RING_CORNER,
  },
  liveTimerButton: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: LIVE_RING_CORNER,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 26,
    elevation: 12,
  },
  liveTimerValue: {
    maxWidth: 48,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  liveTimerRing: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LIVE_TIMER_SIZE,
    height: LIVE_TIMER_SIZE,
  },
});
