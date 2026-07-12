import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";

import styles from './HomePageStyle';
import GreetingHeader from './Components/GreetingHeader/GreetingHeader';
import WeekStrip from './Components/WeekStrip/WeekStrip';
import TodayHeroCard from './Components/TodayHeroCard/TodayHeroCard';
import ActiveProgramSnapshot from './Components/ActiveProgramSnapshot/ActiveProgramSnapshot';
import WorkoutSummaryCard from './Components/WorkoutSummaryCard/WorkoutSummaryCard';
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import EditSocialPost from "../../Resources/Icons/UI-icons/EditSocialPost";
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

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

// Monday..Sunday range containing `date` (Program weeks run Mon-Sun).
function getCurrentWeekRange(date) {
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(date, mondayOffset);
  const sunday = addDays(monday, 6);
  return { monday, sunday };
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
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [isLoadingCirclePreview, setIsLoadingCirclePreview] = useState(true);
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [workoutSummaryPosts, setWorkoutSummaryPosts] = useState([]);
  const [workoutSummaryLoadingMore, setWorkoutSummaryLoadingMore] =
    useState(false);
  const [updatingLikePostId, setUpdatingLikePostId] = useState(null);
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
  const navigation = useNavigation();
  const { user } = useAuth();

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
        programService.getTodayActivitySummary(db, {
          date: todayDate,
        }),
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
  }, [db, todayDate, user]);

  const loadHomeSnapshot = useCallback(async () => {
    try {
      const today = parseCustomDate(todayDate);
      const { monday, sunday } = getCurrentWeekRange(today);
      const tomorrow = addDays(today, 1);
      const rangeEnd = addDays(today, 180);

      const [
        weekWorkoutsResult,
        todaySnapshotsResult,
        upcomingWorkoutsResult,
        activeProgramsResult,
        unreadCountResult,
      ] = await Promise.allSettled([
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: normalizeIsoDateString(formatDate(monday)),
          endIsoDate: normalizeIsoDateString(formatDate(sunday)),
        }),
        programService.getTodayWorkoutSnapshots(db, { date: todayDate }),
        programService.getWorkoutCalendarWorkouts(db, {
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
          ...getCompletedWorkoutDetails(targetWorkout),
        });
      } else {
        setHeroWorkout(null);
      }

      // --- Up next ---
      const upcomingWorkouts =
        upcomingWorkoutsResult.status === "fulfilled" ? upcomingWorkoutsResult.value : [];
      const nextWorkout =
        upcomingWorkouts.find((workout) => Number(workout.done) !== 1) ?? null;
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
    }
  }, [db, todayDate, user]);

  const resetWorkoutSummaryFeed = useCallback(() => {
    workoutSummaryFeedOffsetRef.current = 0;
    workoutSummaryFeedHasMoreRef.current = true;
    workoutSummaryFeedLoadingRef.current = false;
    setWorkoutSummaryPosts([]);
    setWorkoutSummaryLoadingMore(false);
  }, []);

  const loadWorkoutSummaryFeed = useCallback(async ({ reset = false } = {}) => {
    if (!user?.id) {
      resetWorkoutSummaryFeed();
      return;
    }

    if (workoutSummaryFeedLoadingRef.current) {
      return;
    }

    if (!reset && !workoutSummaryFeedHasMoreRef.current) {
      return;
    }

    const offset = reset ? 0 : workoutSummaryFeedOffsetRef.current;
    workoutSummaryFeedLoadingRef.current = true;
    setWorkoutSummaryLoadingMore(!reset);

    try {
      const posts = await socialPostService.getWorkoutSummaryFeed({
        user,
        limit: WORKOUT_SUMMARY_FEED_PAGE_SIZE,
        offset,
      });
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
    }
  }, [resetWorkoutSummaryFeed, user]);

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

  useEffect(() => {
    const subscription = notificationService.addNotificationReceivedListener(
      () => {
        notificationService
          .getUnreadNotificationCount({ user })
          .then(setUnreadNotificationCount)
          .catch(() => setUnreadNotificationCount(0));
      }
    );

    return () => subscription?.remove?.();
  }, [user]);

  const handleLoadMoreWorkoutSummaryFeed = useCallback(() => {
    loadWorkoutSummaryFeed();
  }, [loadWorkoutSummaryFeed]);

  const handleOpenWorkoutSummaryOptions = useCallback((post) => {
    setSelectedWorkoutSummaryPost(post);
  }, []);

  const handleEditWorkoutSummaryPost = useCallback(() => {
    if (!selectedWorkoutSummaryPost?.id) {
      return;
    }

    const post = selectedWorkoutSummaryPost;
    setSelectedWorkoutSummaryPost(null);
    navigation.navigate("SocialPostEditPage", {
      postId: post.id,
      initialNote: post.body ?? "",
      postTitle: getWorkoutSummaryDisplayTitle(post),
    });
  }, [navigation, selectedWorkoutSummaryPost]);

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
        />

        <WeekStrip days={weekDays} />

        <TodayHeroCard
          workout={heroWorkout}
          onStartWorkout={openHeroWorkout}
          nextWorkout={nextWorkoutInfo}
          onOpenNextWorkout={openNextWorkout}
          onQuickStart={() => requestOpenQuickWorkoutMenu()}
        />

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          isLoading={isLoadingCirclePreview}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
          showHeader
        />

        {activeProgramSnapshot ? (
          <ActiveProgramSnapshot
            programName={activeProgramSnapshot.programName}
            currentWeek={activeProgramSnapshot.currentWeek}
            totalWeeks={activeProgramSnapshot.totalWeeks}
            completedWorkouts={activeProgramSnapshot.completedWorkouts}
            totalWorkouts={activeProgramSnapshot.totalWorkouts}
            progress={activeProgramSnapshot.progress}
            onPress={openActiveProgram}
          />
        ) : null}
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
        onOpenOptions={
          post.author?.id === user?.id ? handleOpenWorkoutSummaryOptions : undefined
        }
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

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <FlatList
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        data={workoutSummaryPosts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderWorkoutSummaryPost}
        ListHeaderComponent={renderHomeHeader}
        ListFooterComponent={renderWorkoutSummaryFooter}
        onEndReached={handleLoadMoreWorkoutSummaryFeed}
        onEndReachedThreshold={0.45}
        showsVerticalScrollIndicator={false}
      />

      <ThemedBottomSheet
        visible={!!selectedWorkoutSummaryPost}
        onClose={() => setSelectedWorkoutSummaryPost(null)}
      >
        <View style={styles.postOptionsTitle}>
          <ThemedText style={styles.postOptionsTitleText}>
            {getWorkoutSummaryDisplayTitle(selectedWorkoutSummaryPost)}
          </ThemedText>
        </View>

        <View style={styles.postOptionsBody}>
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
        </View>
      </ThemedBottomSheet>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
