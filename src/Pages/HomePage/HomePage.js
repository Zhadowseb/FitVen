import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
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

export default function App() {
  const db = useSQLiteContext();
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [workoutSummaryPosts, setWorkoutSummaryPosts] = useState([]);
  const [updatingLikePostId, setUpdatingLikePostId] = useState(null);
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

  const loadWorkoutSummaryFeed = useCallback(async () => {
    if (!user?.id) {
      setWorkoutSummaryPosts([]);
      return;
    }

    try {
      const posts = await socialPostService.getWorkoutSummaryFeed({
        user,
        limit: 3,
      });

      setWorkoutSummaryPosts(posts);
    } catch (error) {
      console.error("Could not load workout summary feed:", error);
      setWorkoutSummaryPosts([]);
    }
  }, [user]);

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
        await loadWorkoutSummaryFeed();
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
      loadWorkoutSummaryFeed();
    }, [db, loadCirclePreview, loadWorkoutSummaryFeed, user])
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TodayProgramsShortcut />

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
        />

        {workoutSummaryPosts.map((post) => (
          <WorkoutSummaryCard
            key={post.id}
            post={post}
            onToggleLike={handleToggleWorkoutPostLike}
            isLikeBusy={updatingLikePostId === post.id}
          />
        ))}
      </ScrollView>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
