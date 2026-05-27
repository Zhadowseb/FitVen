import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
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
import TodayProgramsShortcut from './Components/TodayProgramsShortcut/TodayProgramsShortcut';
import WorkoutSummaryCard from './Components/WorkoutSummaryCard/WorkoutSummaryCard';
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import EditSocialPost from "../../Resources/Icons/UI-icons/EditSocialPost";
import {
  programService,
  socialPostService,
  socialService,
} from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";

import { 
  ThemedBottomSheet,
  ThemedText,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { useAuth } from '../../Contexts/AuthContext';

const WORKOUT_SUMMARY_FEED_PAGE_SIZE = 6;

function getWorkoutSummaryDisplayTitle(post) {
  const title = String(post?.title ?? "").trim();
  const workoutType = String(post?.workoutType ?? "").trim();

  if (!title || title.toLowerCase() === workoutType.toLowerCase()) {
    return "Workout summary";
  }

  return title;
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
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [workoutSummaryPosts, setWorkoutSummaryPosts] = useState([]);
  const [workoutSummaryLoadingMore, setWorkoutSummaryLoadingMore] =
    useState(false);
  const [updatingLikePostId, setUpdatingLikePostId] = useState(null);
  const [selectedWorkoutSummaryPost, setSelectedWorkoutSummaryPost] =
    useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
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
      loadCirclePreview();
      loadWorkoutSummaryFeed({ reset: true });
    }, [loadCirclePreview, loadWorkoutSummaryFeed])
  );

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
