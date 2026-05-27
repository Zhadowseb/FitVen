import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";

import styles from './HomePageStyle';
import TodayProgramsShortcut from './Components/TodayProgramsShortcut/TodayProgramsShortcut';
import WorkoutSummaryCard from './Components/WorkoutSummaryCard/WorkoutSummaryCard';
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import {
  programService,
  socialPostService,
  socialService,
  workoutService,
} from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";

import { 
  ThemedView,
} from "../../Resources/ThemedComponents";
import { useAuth } from '../../Contexts/AuthContext';

const WORKOUT_SUMMARY_FEED_PAGE_SIZE = 6;

export default function App() {
  const db = useSQLiteContext();
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [workoutSummaryPosts, setWorkoutSummaryPosts] = useState([]);
  const [workoutSummaryLoadingMore, setWorkoutSummaryLoadingMore] =
    useState(false);
  const [updatingLikePostId, setUpdatingLikePostId] = useState(null);
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
      setCirclePreviewError("");
      return;
    }

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
      if (user?.id) {
        workoutService.backfillCompletedWorkoutSummaryPostsInBackground(db, {
          limit: 8,
        });
      }

      loadCirclePreview();
      loadWorkoutSummaryFeed({ reset: true });
    }, [db, loadCirclePreview, loadWorkoutSummaryFeed, user])
  );

  const handleLoadMoreWorkoutSummaryFeed = useCallback(() => {
    loadWorkoutSummaryFeed();
  }, [loadWorkoutSummaryFeed]);

  const renderHomeHeader = useCallback(
    () => (
      <>
        <TodayProgramsShortcut />

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
        />
      </>
    ),
    [circlePreview, circlePreviewError, navigation]
  );

  const renderWorkoutSummaryPost = useCallback(
    ({ item: post }) => (
      <WorkoutSummaryCard
        post={post}
        onToggleLike={handleToggleWorkoutPostLike}
        isLikeBusy={updatingLikePostId === post.id}
      />
    ),
    [handleToggleWorkoutPostLike, updatingLikePostId]
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

      <StatusBar style="auto" />
    </ThemedView>
  );
}
