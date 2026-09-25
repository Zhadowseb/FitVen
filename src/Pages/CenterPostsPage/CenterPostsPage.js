import { StatusBar } from "expo-status-bar";
import { FlatList, TouchableOpacity, View, useColorScheme } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./CenterPostsPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { gymService, socialPostService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ReportPostModal from "@resources/Components/ReportPostModal/ReportPostModal";
import { ThemedStateBlock, ThemedText, ThemedView } from "@resources/ThemedComponents";
import WorkoutSummaryCard from "../FeedPage/Components/WorkoutSummaryCard/WorkoutSummaryCard";

const PAGE_SIZE = 30;

/**
 * The posts from one centre - workouts people you can see did there - with
 * the one tapped on Explore first. Likes work as in the feed, and every post
 * can be reported.
 */
export default function CenterPostsPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const gymId = Number(route.params?.gym_id ?? route.params?.gymId);
  const firstPostId = route.params?.post_id ?? route.params?.postId ?? null;
  const [gymName, setGymName] = useState(route.params?.gym_name ?? null);
  const [posts, setPosts] = useState(null);
  const [failed, setFailed] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [reportingPost, setReportingPost] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [nextPosts, gyms] = await Promise.all([
          socialPostService.getCentrePosts({ user, gymIds: [gymId], limit: PAGE_SIZE }),
          gymName ? Promise.resolve(null) : gymService.getGymsByIds([gymId]).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setPosts(nextPosts);
        setFailed(false);

        const gym = gyms?.get?.(gymId);

        if (gym) {
          setGymName(gym.shortName ?? gym.name);
        }
      } catch (error) {
        console.error("Could not load the centre's posts:", error);

        if (!cancelled) {
          setPosts([]);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // gymName is only read to skip a lookup the params already answered, so it
    // is not a reason to load again.
  }, [gymId, user]);

  // The post tapped on Explore goes first, the rest newest first.
  const ordered = useMemo(() => {
    if (!posts || firstPostId === null) {
      return posts;
    }

    const first = posts.find((post) => String(post.id) === String(firstPostId));

    return first ? [first, ...posts.filter((post) => post !== first)] : posts;
  }, [firstPostId, posts]);

  const toggleLike = useCallback(
    async (post) => {
      if (!user?.id || !post?.id || likeBusyId) {
        return;
      }

      const shouldLike = !post.isLiked;
      const update = (changes) =>
        setPosts((current) =>
          (current ?? []).map((entry) => (entry.id === post.id ? { ...entry, ...changes } : entry))
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

  const openAuthor = useCallback(
    (post) => {
      if (post?.author?.id) {
        navigation.navigate("PublicProfilePage", { userId: post.author.id });
      }
    },
    [navigation]
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        onPress={() => navigation.goBack()}
        style={[styles.back, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        <ArrowLeft width={18} height={18} color={theme.title} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
          {t("explore.centerPosts.eyebrow")}
        </ThemedText>
        <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1} accessibilityRole="header">
          {gymName ?? t("explore.centerPosts.fallbackTitle")}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      {ordered === null ? (
        <>
          {header}
          <ThemedStateBlock style={styles.loading} />
        </>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(post) => String(post.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <WorkoutSummaryCard
              post={item}
              onToggleLike={toggleLike}
              onOpenOptions={setReportingPost}
              onOpenAuthor={openAuthor}
              isLikeBusy={likeBusyId === item.id}
            />
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                {failed ? t("explore.centerPosts.failed") : t("explore.centerPosts.emptyTitle")}
              </ThemedText>
              {failed ? null : (
                <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
                  {t("explore.centerPosts.emptyBody")}
                </ThemedText>
              )}
            </View>
          }
        />
      )}

      <ReportPostModal
        post={reportingPost}
        onClose={() => setReportingPost(null)}
        onReported={(post) =>
          setPosts((current) => (current ?? []).filter((entry) => entry.id !== post.id))
        }
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
