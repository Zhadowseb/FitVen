import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, FlatList, TouchableOpacity, View, useColorScheme } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./UserPostsPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { publicProfileService, socialPostService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ReportPostModal from "@resources/Components/ReportPostModal/ReportPostModal";
import { ThemedStateBlock, ThemedText, ThemedView } from "@resources/ThemedComponents";
import { putPostFirst, withProfileAuthor } from "@utils/publicProfileUtils";
import WorkoutSummaryCard from "../FeedPage/Components/WorkoutSummaryCard/WorkoutSummaryCard";

const PAGE_SIZE = 20;

/**
 * Every post of one person's the viewer may see - "See all" on their profile -
 * with the one tapped in the grid first and the rest newest first. Likes work
 * as in the feed, and somebody else's post can be reported.
 *
 * It asks for the profile as well as the posts. The cards need the author's
 * name and picture, which a post cannot read for a stranger, and a profile
 * that is not available - blocked either way - shows none of its posts here
 * either. `preview` is your own profile seen as a stranger: public posts only,
 * and no report menu, since there is nothing of your own to report.
 */
export default function UserPostsPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const userId = route.params?.userId ? String(route.params.userId) : null;
  const firstPostId = route.params?.postId ?? null;
  const isPreview = route.params?.preview === true;
  const [status, setStatus] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [reportingPost, setReportingPost] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    if (!userId || !viewerId) {
      setStatus("unavailable");
      return undefined;
    }

    let cancelled = false;

    setStatus("loading");

    (async () => {
      const [profileResult, postsResult] = await Promise.allSettled([
        publicProfileService.getPublicProfile({ userId }),
        publicProfileService.getPublicProfilePosts({
          user: { id: viewerId },
          userId,
          limit: PAGE_SIZE,
          preview: isPreview,
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.status === "rejected" || postsResult.status === "rejected") {
        console.error(
          "Could not load the posts:",
          profileResult.status === "rejected" ? profileResult.reason : postsResult.reason
        );
        setStatus("error");
        return;
      }

      if (!profileResult.value) {
        setProfile(null);
        setPosts([]);
        setTotal(0);
        setStatus("unavailable");
        return;
      }

      setProfile(profileResult.value);
      setPosts(postsResult.value.posts);
      setTotal(postsResult.value.total);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [isPreview, reloadKey, userId, viewerId]);

  const loadMore = useCallback(async () => {
    if (status !== "ready" || isLoadingMoreRef.current || posts.length >= total || !viewerId) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const next = await publicProfileService.getPublicProfilePosts({
        user: { id: viewerId },
        userId,
        limit: PAGE_SIZE,
        offset: posts.length,
        preview: isPreview,
      });

      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));

        return [...current, ...next.posts.filter((post) => !known.has(post.id))];
      });
      // An empty page means the count was ahead of the rows; stop asking.
      setTotal(next.posts.length > 0 ? next.total : posts.length);
    } catch (error) {
      console.error("Could not load more posts:", error);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [isPreview, posts.length, status, total, userId, viewerId]);

  // The author's name and picture on every card, the tapped post first.
  const cards = useMemo(
    () => putPostFirst(withProfileAuthor(posts, profile), firstPostId),
    [firstPostId, posts, profile]
  );

  const toggleLike = useCallback(
    async (post) => {
      if (!user?.id || !post?.id || likeBusyId) {
        return;
      }

      const shouldLike = !post.isLiked;
      const update = (changes) =>
        setPosts((current) =>
          current.map((entry) => (entry.id === post.id ? { ...entry, ...changes } : entry))
        );

      setLikeBusyId(post.id);
      update({
        isLiked: shouldLike,
        likeCount: Math.max(0, Number(post.likeCount) + (shouldLike ? 1 : -1)),
      });

      try {
        await socialPostService.toggleWorkoutSummaryPostLike({ user, postId: post.id, shouldLike });
      } catch (error) {
        console.error("Could not update the like:", error);
        update({ isLiked: post.isLiked, likeCount: post.likeCount });
      } finally {
        setLikeBusyId(null);
      }
    },
    [likeBusyId, user]
  );

  // Almost always the profile this list was opened from: back to it, rather
  // than a second copy of it on top.
  const openAuthor = useCallback(
    (post) => {
      const authorId = post?.author?.id;

      if (!authorId) {
        return;
      }

      const state = navigation.getState();
      const previous = state?.routes?.[state.index - 1];

      if (
        previous?.name === "PublicProfilePage" &&
        String(previous.params?.userId) === String(authorId)
      ) {
        navigation.goBack();
        return;
      }

      navigation.navigate("PublicProfilePage", { userId: authorId });
    },
    [navigation]
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        hitSlop={6}
        onPress={() => navigation.goBack()}
        style={[styles.back, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        <ArrowLeft width={18} height={18} color={theme.title} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
          {t("publicProfile.userPosts.eyebrow")}
        </ThemedText>
        <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1} accessibilityRole="header">
          {profile?.displayName || t("publicProfile.userPosts.fallbackTitle")}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      {status === "ready" ? (
        <FlatList
          data={cards}
          keyExtractor={(post) => String(post.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WorkoutSummaryCard
              post={item}
              onToggleLike={toggleLike}
              onOpenOptions={item.author?.id !== viewerId ? setReportingPost : undefined}
              onOpenAuthor={openAuthor}
              isLikeBusy={likeBusyId === item.id}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={theme.primaryText} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                {t("publicProfile.userPosts.emptyTitle")}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
                {t("publicProfile.userPosts.emptyBody")}
              </ThemedText>
            </View>
          }
        />
      ) : (
        <>
          {header}
          {status === "loading" ? (
            <ThemedStateBlock variant="loading" style={styles.stateBlock} />
          ) : status === "error" ? (
            <ThemedStateBlock
              variant="error"
              style={styles.stateBlock}
              message={t("publicProfile.userPosts.failed")}
              actionLabel={t("common.retry")}
              onAction={() => setReloadKey((key) => key + 1)}
            />
          ) : (
            <ThemedStateBlock
              variant="empty"
              style={styles.stateBlock}
              title={t("publicProfile.unavailable.title")}
              message={t("publicProfile.unavailable.body")}
              actionLabel={t("common.goBack")}
              onAction={() => navigation.goBack()}
            />
          )}
        </>
      )}

      <ReportPostModal
        post={reportingPost}
        onClose={() => setReportingPost(null)}
        onReported={(post) => {
          setPosts((current) => current.filter((entry) => entry.id !== post.id));
          setTotal((current) => Math.max(0, current - 1));
        }}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
