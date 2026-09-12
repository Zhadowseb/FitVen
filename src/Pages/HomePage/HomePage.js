import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";

import styles from './HomePageStyle';
import GreetingHeader from './Components/GreetingHeader/GreetingHeader';
import WeekStrip from './Components/WeekStrip/WeekStrip';
import HomeSkeleton from './Components/HomeSkeleton/HomeSkeleton';
import TodayHeroCard from './Components/TodayHeroCard/TodayHeroCard';
import WorkoutSummaryCard from './Components/WorkoutSummaryCard/WorkoutSummaryCard';
import EditPostNoteSheet from "../../Resources/Components/EditPostNoteSheet";
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import EditSocialPost from "../../Resources/Icons/UI-icons/EditSocialPost";
import Flag from "../../Resources/Icons/UI-icons/Flag";
import ReportSheet from "../../Resources/Components/ReportSheet/ReportSheet";
import {
  notificationService,
  programService,
  socialPostService,
  socialService,
  weightliftingService,
} from "../../Services";
import {
  formatDate,
  getTodaysDate,
  addDays,
  getCurrentWeekRange,
  normalizeIsoDateString,
  parseCustomDate,
} from "../../Utils/dateUtils";
import {
  formatClockTime,
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../../Utils/timeUtils";
import { requestOpenQuickWorkoutMenu } from "../../Utils/quickWorkoutMenuEvents";

import {
  ThemedBottomSheet,
  ThemedConfirmModal,
  ThemedText,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { useAuth } from '../../Contexts/AuthContext';

const WORKOUT_SUMMARY_FEED_PAGE_SIZE = 6;
const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MINUTES_PER_SET_ESTIMATE = 2.5;
const MINUTES_ROUNDING_STEP = 5;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole-day index (UTC midnight based) so week-boundary math is DST-safe.
function getLocalDateIndex(date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      MILLISECONDS_PER_DAY
  );
}

function getWorkoutSummaryDisplayTitle(post) {
  const title = String(post?.title ?? "").trim();
  const workoutType = String(post?.workoutType ?? "").trim();

  if (!title || title.toLowerCase() === workoutType.toLowerCase()) {
    return "Workout summary";
  }

  return title;
}

function getWorkoutTypeLabel(workoutType) {
  if (workoutType === "StrengthTraining") {
    return "Resistance";
  }

  return workoutType ?? "Workout";
}

function getNextWorkoutDateParts(workout) {
  if (!workout?.date) {
    return null;
  }

  const workoutDate = parseCustomDate(workout.date);

  return {
    day: String(workoutDate.getDate()).padStart(2, "0"),
    weekday: workoutDate
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
  };
}

function getCompletedWorkoutDetails(workout) {
  const elapsedSeconds = normalizeElapsedDurationSeconds(workout?.elapsed_time, 0);
  const startTimeSeconds = normalizeStoredTimestampSeconds(
    workout?.original_start_time
  );
  const completedAt =
    startTimeSeconds === null
      ? ""
      : formatClockTime(startTimeSeconds + elapsedSeconds);

  return {
    completedAt,
    durationLabel:
      elapsedSeconds > 0 ? `${Math.max(1, Math.round(elapsedSeconds / 60))} min` : "",
  };
}

export default function App() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [isLoadingCirclePreview, setIsLoadingCirclePreview] = useState(true);
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [workoutSummaryPosts, setWorkoutSummaryPosts] = useState([]);
  const [hasLoadedWorkoutSummaryFeed, setHasLoadedWorkoutSummaryFeed] =
    useState(false);
  const [hasLoadedHomeSnapshot, setHasLoadedHomeSnapshot] = useState(false);
  const [homeSnapshotError, setHomeSnapshotError] = useState("");
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [workoutSummaryLoadingMore, setWorkoutSummaryLoadingMore] =
    useState(false);
  const [updatingLikePostId, setUpdatingLikePostId] = useState(null);
  const [editingPostNote, setEditingPostNote] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportConfirmation, setReportConfirmation] = useState(null);
  const [selectedWorkoutSummaryPost, setSelectedWorkoutSummaryPost] =
    useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  const [heroWorkout, setHeroWorkout] = useState(null);
  const [nextWorkoutInfo, setNextWorkoutInfo] = useState(null);
  const [activeProgramSnapshot, setActiveProgramSnapshot] = useState(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const workoutSummaryFeedOffsetRef = useRef(0);
  const workoutSummaryFeedHasMoreRef = useRef(true);
  const workoutSummaryFeedLoadingRef = useRef(false);
  const workoutSummaryFeedPendingResetRef = useRef(false);
  const navigation = useNavigation();
  const { user } = useAuth();

  // Today's snapshots are wanted twice in the same focus pass - once for the
  // hero card and once for the activity ring - and building them is most of
  // the work Home does. Overlapping calls share one fetch; anything that
  // starts after it settles gets fresh data, so nothing is ever cached stale.
  const todaySnapshotsRef = useRef(null);

  const fetchTodaySnapshots = useCallback(() => {
    const inFlight = todaySnapshotsRef.current;

    if (inFlight && inFlight.date === todayDate) {
      return inFlight.promise;
    }

    const promise = programService
      .getTodayWorkoutSnapshots(db, { date: todayDate })
      .finally(() => {
        if (todaySnapshotsRef.current?.promise === promise) {
          todaySnapshotsRef.current = null;
        }
      });

    todaySnapshotsRef.current = { date: todayDate, promise };

    return promise;
  }, [db, todayDate]);

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setIsLoadingCirclePreview(false);
      setCirclePreviewError("");
      return;
    }

    setIsLoadingCirclePreview(true);
    setCirclePreviewError("");

    try {
      const [nextCirclePreview, todayActivitySummary] = await Promise.all([
        socialService.getCirclePreview({
          user,
          limit: 12,
          date: todayDate,
        }),
        fetchTodaySnapshots().then((snapshots) =>
          programService.getTodayActivitySummary(db, {
            date: todayDate,
            snapshots,
          })
        ),
      ]);

      setCirclePreview({
        ...nextCirclePreview,
        currentUser: nextCirclePreview.currentUser
          ? {
              ...nextCirclePreview.currentUser,
              activityState: todayActivitySummary.activityState,
              activityDetail: todayActivitySummary.detail,
              workoutType: todayActivitySummary.workoutType,
              workoutLabel: todayActivitySummary.workoutLabel,
            }
          : null,
      });
    } catch (error) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setCirclePreviewError(
        error instanceof Error ? error.message : "Could not load your circle."
      );
    } finally {
      setIsLoadingCirclePreview(false);
    }
  }, [db, fetchTodaySnapshots, todayDate, user]);

  const loadHomeSnapshot = useCallback(async () => {
    try {
      setHomeSnapshotError("");
      const today = parseCustomDate(todayDate);
      const { monday, sunday } = getCurrentWeekRange(today);
      const tomorrow = addDays(today, 1);
      const rangeEnd = addDays(today, 180);

      const [
        weekWorkoutsResult,
        todaySnapshotsResult,
        nextWorkoutResult,
        activeProgramsResult,
        unreadCountResult,
      ] = await Promise.allSettled([
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: normalizeIsoDateString(formatDate(monday)),
          endIsoDate: normalizeIsoDateString(formatDate(sunday)),
        }),
        fetchTodaySnapshots(),
        programService.getNextUnfinishedCalendarWorkout(db, {
          startIsoDate: normalizeIsoDateString(formatDate(tomorrow)),
          endIsoDate: normalizeIsoDateString(formatDate(rangeEnd)),
        }),
        programService.getProgramsOverview(db),
        notificationService.getUnreadNotificationCount({ user }),
      ]);

      // --- Week strip ---
      const weekWorkouts =
        weekWorkoutsResult.status === "fulfilled" ? weekWorkoutsResult.value : [];
      const doneIsoDates = new Set(
        weekWorkouts
          .filter((workout) => Number(workout.done) === 1)
          .map((workout) => workout.date_iso)
      );
      const todayIso = normalizeIsoDateString(todayDate);
      const nextWeekDays = Array.from({ length: 7 }, (_, index) => {
        const cellDate = addDays(monday, index);
        const cellIso = normalizeIsoDateString(formatDate(cellDate));
        return {
          dateIso: cellIso,
          weekday: WEEKDAY_LABELS[index],
          day: String(cellDate.getDate()).padStart(2, "0"),
          done: doneIsoDates.has(cellIso),
          isToday: cellIso === todayIso,
        };
      });
      setWeekDays(nextWeekDays);

      // --- Today hero ---
      const todaySnapshots =
        todaySnapshotsResult.status === "fulfilled" ? todaySnapshotsResult.value : [];
      const todaysWorkouts = todaySnapshots.flatMap((snapshot) =>
        (snapshot.workouts ?? []).map((workout) => ({
          ...workout,
          program_id: snapshot.program?.program_id ?? workout.program_id ?? null,
          day: snapshot.day,
        }))
      );
      const targetWorkout =
        todaysWorkouts.find((workout) => Number(workout.done) !== 1) ??
        todaysWorkouts[0] ??
        null;

      if (targetWorkout) {
        const isCompleted = Number(targetWorkout.done) === 1;
        const exerciseCount = targetWorkout.previewItems?.length ?? 0;
        const metaItems = [];

        if (exerciseCount > 0) {
          metaItems.push(
            `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`
          );
        }

        let totalSets = 0;

        if (!isCompleted && targetWorkout.workout_type === "StrengthTraining") {
          try {
            const summary = await weightliftingService.getStrengthWorkoutSummary(
              db,
              targetWorkout.workout_id
            );
            totalSets = Number(summary?.totalSets) || 0;
          } catch (error) {
            console.warn("Could not load set count for today's workout:", error);
          }
        }

        if (totalSets > 0) {
          metaItems.push(`${totalSets} ${totalSets === 1 ? "set" : "sets"}`);

          const estimatedMinutes =
            Math.round((totalSets * MINUTES_PER_SET_ESTIMATE) / MINUTES_ROUNDING_STEP) *
            MINUTES_ROUNDING_STEP;

          if (estimatedMinutes > 0) {
            metaItems.push(`~${estimatedMinutes} min`);
          }
        }

        setHeroWorkout({
          workoutId: targetWorkout.workout_id,
          workoutType: targetWorkout.workout_type,
          typeLabel: getWorkoutTypeLabel(targetWorkout.workout_type),
          title: targetWorkout.label ?? getWorkoutTypeLabel(targetWorkout.workout_type),
          metaItems,
          weekday: targetWorkout.day?.Weekday,
          programId: targetWorkout.program_id ?? null,
          isCompleted,
          isStarted: targetWorkout.original_start_time !== null,
          isRunning: targetWorkout.timer_start !== null,
          ...getCompletedWorkoutDetails(targetWorkout),
        });
      } else {
        setHeroWorkout(null);
      }

      // --- Up next ---
      const nextWorkout =
        nextWorkoutResult.status === "fulfilled" ? nextWorkoutResult.value : null;
      const nextWorkoutDateParts = getNextWorkoutDateParts(nextWorkout);

      setNextWorkoutInfo(
        nextWorkout && nextWorkoutDateParts
          ? {
              ...nextWorkout,
              weekday: nextWorkoutDateParts.weekday,
              day: nextWorkoutDateParts.day,
              title: nextWorkout.label ?? getWorkoutTypeLabel(nextWorkout.workout_type),
              rawWeekday: nextWorkout.weekday,
            }
          : null
      );

      // --- Active program snapshot ---
      const programsOverview =
        activeProgramsResult.status === "fulfilled" ? activeProgramsResult.value : [];
      const activeProgram = programsOverview.find(
        (program) => program.status === "ACTIVE"
      );

      if (activeProgram) {
        const totalWorkouts = Number(activeProgram.workout_count) || 0;
        const completedWorkouts = Number(activeProgram.completed_workout_count) || 0;
        const totalWeeks = Number(activeProgram.week_count) || 0;
        const start = parseCustomDate(activeProgram.start_date);
        const elapsedDays = Number.isNaN(start.getTime())
          ? 0
          : getLocalDateIndex(today) - getLocalDateIndex(start);
        const currentWeek =
          totalWeeks > 0
            ? Math.min(totalWeeks, Math.max(1, Math.floor(Math.max(0, elapsedDays) / 7) + 1))
            : 0;

        setActiveProgramSnapshot({
          programId: activeProgram.program_id,
          programName: activeProgram.program_name,
          startDate: activeProgram.start_date,
          currentWeek,
          totalWeeks,
          completedWorkouts,
          totalWorkouts,
          progress: totalWorkouts > 0 ? completedWorkouts / totalWorkouts : 0,
        });
      } else {
        setActiveProgramSnapshot(null);
      }

      // --- Notifications ---
      const unreadCount =
        unreadCountResult.status === "fulfilled" ? unreadCountResult.value : 0;
      setUnreadNotificationCount(unreadCount);
    } catch (error) {
      console.error("Could not load the home snapshot:", error);
      setHomeSnapshotError(
        "Today's workout could not be loaded. Check your connection and try again."
      );
    } finally {
      setHasLoadedHomeSnapshot(true);
    }
  }, [db, fetchTodaySnapshots, todayDate, user]);

  const resetWorkoutSummaryFeed = useCallback(() => {
    workoutSummaryFeedOffsetRef.current = 0;
    workoutSummaryFeedHasMoreRef.current = true;
    workoutSummaryFeedLoadingRef.current = false;
    workoutSummaryFeedPendingResetRef.current = false;
    setWorkoutSummaryPosts([]);
    setWorkoutSummaryLoadingMore(false);
  }, []);

  const loadWorkoutSummaryFeed = useCallback(async ({ reset = false } = {}) => {
    if (!user?.id) {
      resetWorkoutSummaryFeed();
      return;
    }

    // A refresh asked for while a page is still loading used to be dropped on
    // the floor. Remember it and run it once the in-flight load lets go.
    if (workoutSummaryFeedLoadingRef.current) {
      if (reset) {
        workoutSummaryFeedPendingResetRef.current = true;
      }

      return;
    }

    if (!reset && !workoutSummaryFeedHasMoreRef.current) {
      return;
    }

    const offset = reset ? 0 : workoutSummaryFeedOffsetRef.current;
    workoutSummaryFeedLoadingRef.current = true;
    setWorkoutSummaryLoadingMore(!reset);

    try {
      const fetchedPosts = await socialPostService.getWorkoutSummaryFeed({
        user,
        limit: WORKOUT_SUMMARY_FEED_PAGE_SIZE,
        offset,
      });
      // Posts stored without a progression baseline get one from the local
      // history, so their bars draw without waiting for the cloud repair.
      const posts = await socialPostService.attachLocalTopSetBaselines(
        db,
        fetchedPosts
      );

      const hasMore = posts.length === WORKOUT_SUMMARY_FEED_PAGE_SIZE;

      setWorkoutSummaryPosts((currentPosts) => {
        if (reset) {
          return posts;
        }

        const existingPostIds = new Set(
          currentPosts.map((currentPost) => currentPost.id)
        );
        const nextPosts = posts.filter(
          (post) => !existingPostIds.has(post.id)
        );

        return [...currentPosts, ...nextPosts];
      });

      workoutSummaryFeedOffsetRef.current = offset + posts.length;
      workoutSummaryFeedHasMoreRef.current = hasMore;
    } catch (error) {
      console.error("Could not load workout summary feed:", error);
      if (reset) {
        workoutSummaryFeedOffsetRef.current = 0;
        workoutSummaryFeedHasMoreRef.current = false;
        setWorkoutSummaryPosts([]);
      }
    } finally {
      workoutSummaryFeedLoadingRef.current = false;
      setWorkoutSummaryLoadingMore(false);
      setHasLoadedWorkoutSummaryFeed(true);
    }

    if (workoutSummaryFeedPendingResetRef.current) {
      workoutSummaryFeedPendingResetRef.current = false;
      await loadWorkoutSummaryFeedRef.current?.({ reset: true });
    }
  }, [db, resetWorkoutSummaryFeed, user]);

  // The loader reaches its own latest version through this, so the deferred
  // refresh above does not need the callback as a dependency of itself.
  const loadWorkoutSummaryFeedRef = useRef(null);
  loadWorkoutSummaryFeedRef.current = loadWorkoutSummaryFeed;

  // Repairs own posts written before the progression bar existed. Its own
  // effect on purpose, so it is not tied to a particular feed load.
  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    let cancelled = false;

    socialPostService
      .backfillWorkoutSummaryPostBaselines(db)
      .then((result) => {
        if (!cancelled && (result?.updated ?? 0) > 0) {
          loadWorkoutSummaryFeed({ reset: true });
        }
      })
      .catch((error) => {
        console.warn("Post baseline backfill failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [db, loadWorkoutSummaryFeed, user?.id]);

  const handleToggleWorkoutPostLike = useCallback(
    async (post) => {
      if (!user?.id || !post?.id || updatingLikePostId) {
        return;
      }

      const shouldLike = !post.isLiked;
      setUpdatingLikePostId(post.id);
      setWorkoutSummaryPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                isLiked: shouldLike,
                likeCount: Math.max(
                  0,
                  Number(currentPost.likeCount) + (shouldLike ? 1 : -1)
                ),
              }
            : currentPost
        )
      );

      try {
        await socialPostService.toggleWorkoutSummaryPostLike({
          user,
          postId: post.id,
          shouldLike,
        });
      } catch (error) {
        console.error("Could not update workout summary like:", error);
        await loadWorkoutSummaryFeed({ reset: true });
      } finally {
        setUpdatingLikePostId(null);
      }
    },
    [loadWorkoutSummaryFeed, updatingLikePostId, user]
  );

  useFocusEffect(
    useCallback(() => {
      loadCirclePreview();
      loadHomeSnapshot();
      loadWorkoutSummaryFeed({ reset: true });
    }, [loadCirclePreview, loadHomeSnapshot, loadWorkoutSummaryFeed])
  );

  const refreshUnreadNotificationCount = useCallback(() => {
    if (!user?.id) {
      setUnreadNotificationCount(0);
      return;
    }

    notificationService
      .getUnreadNotificationCount({ user })
      .then(setUnreadNotificationCount)
      .catch(() => setUnreadNotificationCount(0));
  }, [user]);

  useEffect(() => {
    const subscription = notificationService.addNotificationReceivedListener(
      refreshUnreadNotificationCount
    );

    return () => subscription?.remove?.();
  }, [refreshUnreadNotificationCount]);

  // A notification that arrives while the app is in the background never
  // reaches the listener above, and screen focus does not change when the app
  // is brought back - so without this the badge stayed on its old number until
  // the user navigated away from Home and back.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshUnreadNotificationCount();
      }
    });

    return () => subscription.remove();
  }, [refreshUnreadNotificationCount]);

  const handleLoadMoreWorkoutSummaryFeed = useCallback(() => {
    loadWorkoutSummaryFeed();
  }, [loadWorkoutSummaryFeed]);

  const handleRefreshHome = useCallback(async () => {
    setIsRefreshingHome(true);

    try {
      await Promise.all([
        loadCirclePreview(),
        loadHomeSnapshot(),
        loadWorkoutSummaryFeed({ reset: true }),
      ]);
    } finally {
      setIsRefreshingHome(false);
    }
  }, [loadCirclePreview, loadHomeSnapshot, loadWorkoutSummaryFeed]);

  const isOwnSelectedPost =
    !!selectedWorkoutSummaryPost &&
    selectedWorkoutSummaryPost.author?.id === user?.id;

  const openReportSheet = useCallback((target) => {
    setSelectedWorkoutSummaryPost(null);
    setReportTarget(target);
  }, []);

  const handleReportWorkoutSummaryPost = useCallback(() => {
    const post = selectedWorkoutSummaryPost;

    if (!post?.id) {
      return;
    }

    openReportSheet({
      type: "post",
      post,
      userId: post.author?.id ?? null,
      name: post.author?.displayName ?? "this account",
    });
  }, [openReportSheet, selectedWorkoutSummaryPost]);

  const handleReportWorkoutSummaryAuthor = useCallback(() => {
    const author = selectedWorkoutSummaryPost?.author;

    if (!author?.id) {
      return;
    }

    openReportSheet({
      type: "user",
      userId: author.id,
      name: author.displayName ?? "this account",
    });
  }, [openReportSheet, selectedWorkoutSummaryPost]);

  const handleOpenWorkoutSummaryOptions = useCallback((post) => {
    setSelectedWorkoutSummaryPost(post);
  }, []);

  const handleEditWorkoutSummaryPost = useCallback(() => {
    if (!selectedWorkoutSummaryPost?.id) {
      return;
    }

    const post = selectedWorkoutSummaryPost;
    setSelectedWorkoutSummaryPost(null);
    setEditingPostNote({
      id: post.id,
      title: getWorkoutSummaryDisplayTitle(post),
      note: post.body ?? "",
    });
  }, [selectedWorkoutSummaryPost]);

  const deleteWorkoutSummaryPost = useCallback(
    async (post) => {
      if (!user?.id || !post?.id || deletingPostId) {
        return;
      }

      setDeletingPostId(post.id);

      try {
        await socialPostService.deleteWorkoutSummaryPost({
          user,
          postId: post.id,
        });
        setWorkoutSummaryPosts((currentPosts) =>
          currentPosts.filter((currentPost) => currentPost.id !== post.id)
        );
        setSelectedWorkoutSummaryPost(null);
      } catch (error) {
        Alert.alert(
          "Could not delete post",
          error instanceof Error
            ? error.message
            : "The post could not be deleted."
        );
      } finally {
        setDeletingPostId(null);
      }
    },
    [deletingPostId, user]
  );

  const handleDeleteWorkoutSummaryPost = useCallback(() => {
    if (!selectedWorkoutSummaryPost?.id || deletingPostId) {
      return;
    }

    const post = selectedWorkoutSummaryPost;

    Alert.alert(
      "Delete post?",
      "This only deletes the social post. The workout stays saved.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete post",
          style: "destructive",
          onPress: () => deleteWorkoutSummaryPost(post),
        },
      ]
    );
  }, [
    deleteWorkoutSummaryPost,
    deletingPostId,
    selectedWorkoutSummaryPost,
  ]);

  const openNotificationHistory = useCallback(() => {
    navigation.navigate("NotificationHistoryPage", {
      markNotificationsRead: true,
      notificationHistoryOpenId: Date.now(),
    });
  }, [navigation]);

  const openHeroWorkout = useCallback(() => {
    if (!heroWorkout) {
      return;
    }

    navigation.navigate("WorkoutPage", {
      workout_id: heroWorkout.workoutId,
      workout_label: heroWorkout.title,
      workout_type: heroWorkout.workoutType,
      day: heroWorkout.weekday,
      date: todayDate,
      program_id: heroWorkout.programId,
    });
  }, [heroWorkout, navigation, todayDate]);

  const openNextWorkout = useCallback(() => {
    if (!nextWorkoutInfo) {
      navigation.navigate("WorkoutCalendarPage");
      return;
    }

    navigation.navigate("WorkoutPage", {
      workout_id: nextWorkoutInfo.workout_id,
      workout_label: nextWorkoutInfo.label,
      workout_type: nextWorkoutInfo.workout_type ?? nextWorkoutInfo.label ?? "Resistance",
      day: nextWorkoutInfo.rawWeekday,
      date: nextWorkoutInfo.date,
      program_id: nextWorkoutInfo.program_id,
    });
  }, [navigation, nextWorkoutInfo]);

  const openActiveProgram = useCallback(() => {
    if (!activeProgramSnapshot) {
      navigation.navigate("WorkoutCalendarPage");
      return;
    }

    navigation.navigate("ProgramOverviewPage", {
      program_id: activeProgramSnapshot.programId,
      program_name: activeProgramSnapshot.programName,
      start_date: activeProgramSnapshot.startDate,
    });
  }, [activeProgramSnapshot, navigation]);

  const renderHomeHeader = useCallback(
    () => (
      <>
        <GreetingHeader
          today={parseCustomDate(todayDate)}
          unreadNotificationCount={unreadNotificationCount}
          onOpenNotifications={openNotificationHistory}
          activeProgramName={activeProgramSnapshot?.programName ?? null}
          displayName={
            circlePreview.currentUser?.displayName ??
            user?.user_metadata?.display_name ??
            user?.email?.split("@")[0] ??
            null
          }
          onOpenActiveProgram={openActiveProgram}
        />

        {homeSnapshotError ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: withAlpha(theme.danger, 0.12),
                borderColor: withAlpha(theme.danger, 0.4),
              },
            ]}
          >
            <ThemedText
              style={styles.errorBannerText}
              setColor={theme.danger}
              numberOfLines={2}
            >
              {homeSnapshotError}
            </ThemedText>

            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              onPress={loadHomeSnapshot}
              hitSlop={8}
            >
              <ThemedText
                style={styles.errorBannerAction}
                setColor={theme.danger}
              >
                Try again
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasLoadedHomeSnapshot ? (
          <>
            <WeekStrip days={weekDays} />

            <TodayHeroCard
              workout={heroWorkout}
              onStartWorkout={openHeroWorkout}
              nextWorkout={nextWorkoutInfo}
              onOpenNextWorkout={openNextWorkout}
              onQuickStart={() => requestOpenQuickWorkoutMenu()}
            />
          </>
        ) : (
          <HomeSkeleton />
        )}

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          isLoading={isLoadingCirclePreview}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
          showHeader
        />

      </>
    ),
    [
      activeProgramSnapshot,
      circlePreview,
      circlePreviewError,
      heroWorkout,
      isLoadingCirclePreview,
      navigation,
      nextWorkoutInfo,
      openActiveProgram,
      openHeroWorkout,
      openNextWorkout,
      hasLoadedHomeSnapshot,
      homeSnapshotError,
      loadHomeSnapshot,
      openNotificationHistory,
      todayDate,
      unreadNotificationCount,
      weekDays,
    ]
  );

  const renderWorkoutSummaryPost = useCallback(
    ({ item: post }) => (
      <WorkoutSummaryCard
        post={post}
        onToggleLike={handleToggleWorkoutPostLike}
        onOpenOptions={handleOpenWorkoutSummaryOptions}
        isLikeBusy={updatingLikePostId === post.id}
      />
    ),
    [handleOpenWorkoutSummaryOptions, handleToggleWorkoutPostLike, updatingLikePostId, user]
  );

  const renderWorkoutSummaryFooter = useCallback(() => {
    if (!workoutSummaryLoadingMore) {
      return null;
    }

    return (
      <View style={styles.feedFooter}>
        <ActivityIndicator />
      </View>
    );
  }, [workoutSummaryLoadingMore]);

  // Without this the feed just stops after the friends row, with no hint that
  // the area exists or what puts anything in it.
  const renderWorkoutSummaryEmpty = useCallback(() => {
    if (!hasLoadedWorkoutSummaryFeed) {
      return null;
    }

    const followsNobody = (circlePreview.people ?? []).length === 0;

    return (
      <View
        style={[
          styles.feedEmptyCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <ThemedText style={styles.feedEmptyTitle} setColor={theme.title}>
          {followsNobody ? "No workouts to show yet" : "Nothing shared yet"}
        </ThemedText>

        <ThemedText style={styles.feedEmptyBody} setColor={theme.quietText}>
          {followsNobody
            ? "Follow someone to see their workouts here, or finish a workout to share your own."
            : "Finish a workout and it shows up here for the people who follow you."}
        </ThemedText>

        <TouchableOpacity
          activeOpacity={0.86}
          accessibilityRole="button"
          onPress={() =>
            followsNobody
              ? navigation.navigate("SearchPage")
              : requestOpenQuickWorkoutMenu()
          }
          style={[
            styles.feedEmptyAction,
            {
              backgroundColor: withAlpha(theme.primary, 0.14),
              borderColor: withAlpha(theme.primary, 0.45),
            },
          ]}
        >
          <ThemedText
            style={styles.feedEmptyActionText}
            setColor={primaryTextColor}
          >
            {followsNobody ? "Find people to follow" : "Start a workout"}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }, [
    circlePreview.people,
    hasLoadedWorkoutSummaryFeed,
    navigation,
    theme,
  ]);

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <FlatList
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        data={workoutSummaryPosts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderWorkoutSummaryPost}
        ListHeaderComponent={renderHomeHeader}
        ListEmptyComponent={renderWorkoutSummaryEmpty}
        ListFooterComponent={renderWorkoutSummaryFooter}
        onEndReached={handleLoadMoreWorkoutSummaryFeed}
        onEndReachedThreshold={0.45}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingHome}
            onRefresh={handleRefreshHome}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.cardBackground}
          />
        }
      />

      <EditPostNoteSheet
        post={editingPostNote}
        onClose={() => setEditingPostNote(null)}
        onSaved={() => loadWorkoutSummaryFeed({ reset: true })}
      />

      <ThemedBottomSheet
        visible={!!selectedWorkoutSummaryPost}
        onClose={() => setSelectedWorkoutSummaryPost(null)}
      >
        <View
          style={[styles.postOptionsTitle, { borderBottomColor: theme.hairline }]}
        >
          <ThemedText style={styles.postOptionsTitleText}>
            {getWorkoutSummaryDisplayTitle(selectedWorkoutSummaryPost)}
          </ThemedText>
        </View>

        <View style={styles.postOptionsBody}>
          {!isOwnSelectedPost ? (
            <>
              <TouchableOpacity
                style={styles.postOption}
                activeOpacity={0.75}
                accessibilityRole="button"
                onPress={handleReportWorkoutSummaryPost}
              >
                <Flag width={22} height={22} color={theme.danger ?? theme.iconColor} />
                <ThemedText
                  style={styles.postOptionText}
                  setColor={theme.danger ?? theme.text}
                >
                  Report post
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.postOption}
                activeOpacity={0.75}
                accessibilityRole="button"
                onPress={handleReportWorkoutSummaryAuthor}
              >
                <Flag width={22} height={22} color={theme.iconColor} />
                <ThemedText style={styles.postOptionText}>
                  {`Report ${
                    selectedWorkoutSummaryPost?.author?.displayName ?? "this account"
                  }`}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : null}

          {isOwnSelectedPost ? (
          <>
          <TouchableOpacity
            style={styles.postOption}
            activeOpacity={0.75}
            onPress={handleEditWorkoutSummaryPost}
          >
            <EditSocialPost
              width={22}
              height={22}
              color={theme.iconColor}
              stroke={theme.iconColor}
            />
            <ThemedText style={styles.postOptionText}>Edit post</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postOption}
            activeOpacity={0.75}
            disabled={deletingPostId === selectedWorkoutSummaryPost?.id}
            onPress={handleDeleteWorkoutSummaryPost}
          >
            <Delete
              width={22}
              height={22}
              color={theme.danger ?? theme.iconColor}
            />
            <ThemedText
              style={styles.postOptionText}
              setColor={theme.danger ?? theme.text}
            >
              {deletingPostId === selectedWorkoutSummaryPost?.id
                ? "Deleting..."
                : "Delete post"}
            </ThemedText>
          </TouchableOpacity>
          </>
          ) : null}
        </View>
      </ThemedBottomSheet>

      <ReportSheet
        visible={!!reportTarget}
        user={user}
        target={reportTarget}
        onClose={(result) => {
          setReportTarget(null);

          if (result?.reported) {
            setReportConfirmation(
              result.blocked
                ? "Thanks. We will review this within 24 hours, and you will not see each other any more."
                : "Thanks. We will review this within 24 hours."
            );
            loadWorkoutSummaryFeed({ reset: true });
          }
        }}
      />

      <ThemedConfirmModal
        visible={!!reportConfirmation}
        title="Report sent"
        message={reportConfirmation ?? ""}
        confirmLabel="Done"
        cancelLabel=""
        tone="positive"
        onConfirm={() => setReportConfirmation(null)}
        onClose={() => setReportConfirmation(null)}
      />

      <StatusBar style="auto" />
    </ThemedView>
  );
}
