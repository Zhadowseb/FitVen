import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./WorkoutPostsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import EditPostNoteSheet from "../../Resources/Components/EditPostNoteSheet";
import EditSocialPost from "../../Resources/Icons/UI-icons/EditSocialPost";
import Reload from "../../Resources/Icons/UI-icons/Reload";
import Social from "../../Resources/Icons/UI-icons/Social";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import WorkoutSummaryCard from "../HomePage/Components/WorkoutSummaryCard/WorkoutSummaryCard";
import {
  ThemedBottomSheet,
  ThemedConfirmModal,
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { useAuth } from "../../Contexts/AuthContext";
import {
  ownWorkoutPostService,
  socialPostService,
  workoutService,
} from "@services";

// Labels are keys, not text: a constant built at module load would be frozen
// in whatever language the app started in.
const FILTERS = [
  { key: "ALL", labelKey: "social.posts.filters.all" },
  { key: "POSTED", labelKey: "social.posts.filters.posted" },
  { key: "UNPOSTED", labelKey: "social.posts.filters.notPosted" },
];

/**
 * Every completed workout the user owns, shown as the post it is or could be.
 * Cards are built from the local database, so this list works without a
 * connection; only the posted badge needs the cloud.
 */
export default function WorkoutPostsPage() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [postingWorkoutId, setPostingWorkoutId] = useState(null);
  const [managedPost, setManagedPost] = useState(null);
  const [editingPostNote, setEditingPostNote] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const quietText = theme.quietText ?? theme.iconColor;
  const titleColor = theme.title ?? theme.text;

  const loadPosts = useCallback(async () => {
    if (!user?.id) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage("");
      const nextPosts = await ownWorkoutPostService.getOwnWorkoutPosts(db, {
        user,
      });
      setPosts(nextPosts);
      if (nextPosts.some((post) => post.isPosted === null)) {
        setErrorMessage(t("social.posts.statusUnavailablePull"));
      }
    } catch (error) {
      console.error("Could not load own workout posts:", error);
      setErrorMessage(t("social.posts.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [db, t, user]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPosts();
    setIsRefreshing(false);
  }, [loadPosts]);

  const handlePost = useCallback(
    async (post) => {
      if (postingWorkoutId !== null) {
        return;
      }

      try {
        setPostingWorkoutId(post.workoutId);
        setErrorMessage("");
        const publishedPost = await workoutService.repostWorkoutSummaryPost(db, {
          workoutId: post.workoutId,
        });
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.workoutId === post.workoutId
              ? {
                  ...currentPost,
                  isPosted: true,
                  postId: publishedPost.id,
                  body: publishedPost.body,
                  visibility: publishedPost.visibility,
                }
              : currentPost
          )
        );
      } catch (error) {
        console.error("Could not post the workout summary:", error);
        setErrorMessage(error?.message ?? t("social.posts.postFailed"));
      } finally {
        setPostingWorkoutId(null);
      }
    },
    [db, postingWorkoutId, t]
  );

  const closeSheet = useCallback(() => setManagedPost(null), []);

  const handleEditPost = useCallback(() => {
    const post = managedPost;

    if (!post?.postId) {
      return;
    }

    setManagedPost(null);
    setEditingPostNote({
      id: post.postId,
      title: post.title,
      note: post.body ?? "",
    });
  }, [managedPost]);

  const handleOpenWorkout = useCallback(() => {
    const post = managedPost;

    if (!post?.workoutId) {
      return;
    }

    setManagedPost(null);
    navigation.navigate("WorkoutPage", {
      workout_id: post.workoutId,
      workout_label: post.title,
      workout_type: post.workoutType,
      date: post.performedDate,
    });
  }, [managedPost, navigation]);

  const handleUpdatePost = useCallback(async () => {
    const post = managedPost;

    if (!post?.workoutId) {
      return;
    }

    setManagedPost(null);
    await handlePost(post);
  }, [handlePost, managedPost]);

  const handleDeletePost = useCallback(async () => {
    const post = deleteTarget;

    if (!post?.workoutId || isDeleting) {
      return;
    }

    try {
      setIsDeleting(true);
      await socialPostService.deleteWorkoutSummaryPostForWorkout(db, {
        workoutId: post.workoutId,
      });
      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.workoutId === post.workoutId
            ? { ...currentPost, isPosted: false, postId: null, body: "" }
            : currentPost
        )
      );
      setDeleteTarget(null);
    } catch (error) {
      console.error("Could not delete the workout post:", error);
      setErrorMessage(error?.message ?? t("social.posts.deleteFailed"));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [db, deleteTarget, isDeleting, t]);

  const visiblePosts = useMemo(() => {
    if (filter === "POSTED") {
      return posts.filter((post) => post.isPosted);
    }

    if (filter === "UNPOSTED") {
      return posts.filter((post) => post.isPosted === false);
    }

    return posts;
  }, [filter, posts]);

  const postedCount = posts.filter((post) => post.isPosted).length;

  const renderItem = useCallback(
    ({ item: post }) => (
      <WorkoutSummaryCard
        post={post}
        showPostedState
        showFooter={false}
        onPost={handlePost}
        onManage={setManagedPost}
        isPostBusy={postingWorkoutId === post.workoutId}
      />
    ),
    [handlePost, postingWorkoutId]
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return <ThemedStateBlock />;
    }

    return (
      <View style={styles.stateBlock}>
        <ThemedText style={styles.stateTitle} setColor={titleColor}>
          {posts.length === 0
            ? t("social.posts.emptyTitle")
            : filter === "POSTED"
              ? t("social.posts.noPostedWorkouts")
              : t("social.posts.noUnpostedWorkouts")}
        </ThemedText>
        <ThemedText style={styles.stateText} setColor={quietText}>
          {posts.length === 0
            ? t("social.posts.emptyBody")
            : t("social.posts.switchFilter")}
        </ThemedText>
      </View>
    );
  }, [filter, isLoading, posts.length, quietText, t, titleColor]);

  return (
    <ThemedView safe={["top", "left", "right"]}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={12}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            {posts.some((post) => post.isPosted === null)
              ? t("social.posts.statusUnavailable")
              : t("social.posts.postedOf", {
                  posted: postedCount,
                  total: posts.length,
                })}
          </ThemedText>

          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {t("social.posts.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <FlatList
        data={visiblePosts}
        keyExtractor={(post) => post.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.filterRow}>
              {FILTERS.map((option) => {
                const isSelected = filter === option.key;

                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setFilter(option.key)}
                    style={[
                      styles.filterChip,
                      isSelected
                        ? {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          }
                        : {
                            backgroundColor: theme.chipBackground,
                            borderColor: theme.cardBorder,
                          },
                    ]}
                  >
                    {isSelected ? (
                      <Checkmark
                        width={12}
                        height={12}
                        color={theme.ink}
                        thickness={3}
                      />
                    ) : null}
                    <ThemedText
                      style={styles.filterChipText}
                      setColor={isSelected ? theme.ink : theme.text}
                    >
                      {t(option.labelKey)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {errorMessage ? (
              <View style={styles.stateBlock}>
                <ThemedText style={styles.stateText} setColor={theme.danger}>
                  {errorMessage}
                </ThemedText>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />

      <EditPostNoteSheet
        post={editingPostNote}
        onClose={() => setEditingPostNote(null)}
        onSaved={loadPosts}
      />

      <ThemedBottomSheet visible={Boolean(managedPost)} onClose={closeSheet}>
        <View
          style={[styles.sheetTitle, { borderBottomColor: theme.cardBorder }]}
        >
          <ThemedText style={styles.sheetTitleText} setColor={titleColor}>
            {managedPost?.title ?? t("social.posts.workoutFallback")}
          </ThemedText>
          <ThemedText style={styles.sheetSubtitleText} setColor={quietText}>
            {managedPost?.isPosted == null
              ? t("social.posts.statusIsUnavailable")
              : managedPost.isPosted
                ? t("social.posts.postedToFeed")
                : t("social.posts.notPostedYet")}
          </ThemedText>
        </View>

        <View style={styles.sheetBody}>
          {managedPost?.isPosted === false ? (
            <TouchableOpacity
              style={styles.sheetOption}
              activeOpacity={0.75}
              onPress={handleUpdatePost}
            >
              <Social width={22} height={22} color={primaryTextColor} />
              <ThemedText
                style={styles.sheetOptionText}
                setColor={primaryTextColor}
              >
                {t("social.posts.postToFeed")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          {managedPost?.isPosted ? (
            <>
              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.75}
                onPress={handleEditPost}
              >
                <EditSocialPost
                  width={22}
                  height={22}
                  color={theme.iconColor}
                  stroke={theme.iconColor}
                />
                <ThemedText
                  style={styles.sheetOptionText}
                  setColor={titleColor}
                >
                  {t("social.posts.editNote")}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.75}
                onPress={handleUpdatePost}
              >
                <Reload width={22} height={22} color={theme.iconColor} />
                <ThemedText
                  style={styles.sheetOptionText}
                  setColor={titleColor}
                >
                  {t("social.posts.updatePostData")}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            style={styles.sheetOption}
            activeOpacity={0.75}
            onPress={handleOpenWorkout}
          >
            <TailArrowUpRight
              width={20}
              height={20}
              color={theme.iconColor}
              stroke={theme.iconColor}
            />
            <ThemedText style={styles.sheetOptionText} setColor={titleColor}>
              {t("social.posts.openWorkout")}
            </ThemedText>
          </TouchableOpacity>

          {managedPost?.isPosted ? (
            <TouchableOpacity
              style={styles.sheetOption}
              activeOpacity={0.75}
              onPress={() => {
                const post = managedPost;
                setManagedPost(null);
                setDeleteTarget(post);
              }}
            >
              <Delete width={22} height={22} color={theme.danger} />
              <ThemedText
                style={styles.sheetOptionText}
                setColor={theme.danger}
              >
                {t("social.posts.removeFromFeed")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </ThemedBottomSheet>

      <ThemedConfirmModal
        visible={Boolean(deleteTarget)}
        title={t("social.posts.removeConfirm.title")}
        message={t("social.posts.removeConfirm.message")}
        confirmLabel={
          isDeleting
            ? t("social.posts.removeConfirm.removing")
            : t("social.posts.removeConfirm.confirm")
        }
        tone="danger"
        isWorking={isDeleting}
        onConfirm={handleDeletePost}
        onClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
