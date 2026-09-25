import { StatusBar } from "expo-status-bar";
import { Image, Pressable, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ExplorePageStyle";
import { useAuth } from "@contexts/AuthContext";
import { gymService, socialPostService, socialService } from "@services";
import ChangeGymSheet from "@resources/Components/ChangeGymSheet/ChangeGymSheet";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Library from "@resources/Icons/UI-icons/Library";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Search from "@resources/Icons/UI-icons/Search";
import Social from "@resources/Icons/UI-icons/Social";
import Star from "@resources/Icons/UI-icons/Star";
import { ThemedText, ThemedView, UserAvatar } from "@resources/ThemedComponents";
import { formatTimeAgo } from "@utils/dateUtils";
import { getWorkoutCoverImage } from "@utils/workoutCoverImages";
import { formatWeightKg } from "@utils/gymUtils";
import { getLastSeenOrStart, gymSeenKey, socialSeenKey } from "@utils/lastSeen";

// What the page last showed, so a return to the tab paints it at once and
// refreshes underneath - the tab is built again on every visit.
let lastShown = null;

// Programs and exercises shared by others do not exist yet: the tiles say so
// with a zero until public programs and shared exercises are built.
const PROGRAM_COUNT = 0;
const SHARED_EXERCISE_COUNT = 0;

const EMPTY = { gymCount: null, homeGym: null, gymRecords: null, newFollowers: 0, centrePosts: [] };
const CENTRE_POST_LIMIT = 8;

async function loadExplore(user) {
  const userId = user?.id ?? null;
  const [gymCountResult, homeGymResult, myGymsResult] = await Promise.allSettled([
    gymService.getGymCount(),
    gymService.getMyHomeGym(),
    userId ? gymService.getMyGyms() : Promise.resolve([]),
  ]);
  const homeGym = homeGymResult.status === "fulfilled" ? homeGymResult.value : null;
  // Posts from your centre and from the centres you train in.
  const centreIds = [
    homeGym?.id,
    ...(myGymsResult.status === "fulfilled" ? myGymsResult.value : []).map((gym) => gym.id),
  ].filter((id) => id !== null && id !== undefined);

  const [gymRecordsResult, newFollowersResult, centrePostsResult] = await Promise.allSettled([
    homeGym && userId
      ? getLastSeenOrStart(gymSeenKey(userId, homeGym.id)).then((since) =>
          gymService.getRecentGymRecords({ gymId: homeGym.id, since })
        )
      : Promise.resolve(null),
    userId
      ? getLastSeenOrStart(socialSeenKey(userId)).then((since) =>
          socialService.countFollowersSince({ userId, since })
        )
      : Promise.resolve(0),
    userId && centreIds.length > 0
      ? socialPostService.getCentrePosts({ user, gymIds: centreIds, limit: CENTRE_POST_LIMIT })
      : Promise.resolve([]),
  ]);

  // Each part stands on its own: a centre without its records - before the
  // migration has run, say - is still the centre.
  for (const [label, result] of [
    ["centre count", gymCountResult],
    ["home centre", homeGymResult],
    ["centre records", gymRecordsResult],
    ["new followers", newFollowersResult],
    ["centre posts", centrePostsResult],
    ["centres you train in", myGymsResult],
  ]) {
    if (result.status === "rejected") {
      console.error(`Explore could not load its ${label}:`, result.reason);
    }
  }

  return {
    gymCount: gymCountResult.status === "fulfilled" ? gymCountResult.value : null,
    homeGym,
    gymRecords: gymRecordsResult.status === "fulfilled" ? gymRecordsResult.value : null,
    newFollowers: newFollowersResult.status === "fulfilled" ? newFollowersResult.value : 0,
    centrePosts: centrePostsResult.status === "fulfilled" ? centrePostsResult.value : [],
  };
}

/**
 * Explore, the tab where you find things: centres and the records set in
 * them, the posts from the centres you train in, programs, exercises others
 * have made, and - through the button in the corner - the people you follow.
 * Programs and shared exercises are zero until they can be shared; knowledge
 * joins later.
 */
export default function ExplorePage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const { user } = useAuth();
  const [data, setData] = useState(lastShown ?? EMPTY);
  const [isChangeGymOpen, setIsChangeGymOpen] = useState(false);
  // Only the newest load may paint: a slow one from before a change of centre
  // must not put the old centre back.
  const loadIdRef = useRef(0);

  const refresh = useCallback(() => {
    const loadId = ++loadIdRef.current;

    loadExplore(user).then((next) => {
      if (loadId === loadIdRef.current) {
        lastShown = next;
        setData(next);
      }
    });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();

      return () => {
        // Leaving the screen: whatever is still loading is not painted.
        loadIdRef.current += 1;
      };
    }, [refresh])
  );

  const { gymCount, homeGym, gymRecords, newFollowers, centrePosts } = data;
  const latest = gymRecords?.latest ?? null;
  const card = theme.cardBackground;
  const cardBorder = theme.cardBorder;
  const quiet = theme.quietText;
  const title = theme.title;

  const openGym = () => navigation.navigate("GymLeaderboardPage", { gym_id: homeGym.id });

  const sectionHead = (label, action, onAction) => (
    <View style={styles.sectionHead}>
      <ThemedText style={styles.sectionLabel} setColor={quiet}>
        {label}
      </ThemedText>
      {action ? (
        <TouchableOpacity accessibilityRole="button" hitSlop={10} onPress={onAction}>
          <ThemedText style={styles.sectionAction} setColor={theme.primaryText}>
            {action}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const tile = ({ key, label, detail, icon, tone, onPress }) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: card, borderColor: cardBorder }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: withAlpha(tone, isLight ? 0.12 : 0.14) }]}>
        {icon}
      </View>
      <View style={styles.tileCopy}>
        <ThemedText style={styles.tileTitle} setColor={title} numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText style={styles.tileDetail} setColor={quiet} numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* The title, and the way to your followers. */}
        <View style={styles.header}>
          <ThemedText style={styles.title} setColor={title} accessibilityRole="header">
            {t("explore.title")}
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              newFollowers > 0
                ? t("explore.openSocialNew", { count: newFollowers })
                : t("explore.openSocial")
            }
            onPress={() => navigation.navigate("SocialPage")}
            style={[styles.socialButton, { backgroundColor: card, borderColor: cardBorder }]}
          >
            <Social width={21} height={21} color={theme.textStrong} thickness={1.6} />
            {newFollowers > 0 ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.primary, borderColor: theme.background },
                ]}
              >
                <ThemedText style={styles.badgeText} setColor={theme.ink}>
                  {newFollowers > 99 ? "99+" : formatNumber(newFollowers)}
                </ThemedText>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Not a field here: a tap opens the search, with the keyboard up. */}
        <Pressable
          accessibilityRole="search"
          accessibilityLabel={t("explore.searchPlaceholder")}
          onPress={() => navigation.navigate("ExploreSearchPage")}
          style={({ pressed }) => [
            styles.search,
            { backgroundColor: card, borderColor: cardBorder },
            pressed ? styles.pressed : null,
          ]}
        >
          <Search width={19} height={19} color={quiet} />
          <ThemedText style={styles.searchPlaceholder} setColor={quiet} numberOfLines={1}>
            {t("explore.searchPlaceholder")}
          </ThemedText>
        </Pressable>

        {/* The ways in, two by two. */}
        <View style={styles.tiles}>
          <View style={styles.tileRow}>
            {tile({
              key: "gyms",
              label: t("explore.tiles.gyms"),
              detail:
                gymCount === null
                  ? t("explore.tiles.gymsSub")
                  : t("explore.tiles.gymsCount", { count: gymCount, value: formatNumber(gymCount) }),
              icon: <MapPin width={18} height={18} color={theme.primaryText} thickness={2} />,
              tone: theme.primary,
              onPress: () => navigation.navigate("GymsPage"),
            })}
            {tile({
              key: "programs",
              label: t("explore.tiles.programs"),
              detail: t("explore.tiles.programsCount", {
                count: PROGRAM_COUNT,
                value: formatNumber(PROGRAM_COUNT),
              }),
              icon: <Calender width={18} height={18} color={theme.secondary} thickness={1.6} />,
              tone: theme.secondary,
              onPress: () => navigation.navigate("ProgramsBrowsePage"),
            })}
          </View>
          <View style={styles.tileRow}>
            {tile({
              key: "exercises",
              label: t("explore.tiles.exercises"),
              detail: t("explore.tiles.exercisesCount", {
                count: SHARED_EXERCISE_COUNT,
                value: formatNumber(SHARED_EXERCISE_COUNT),
              }),
              icon: <Library width={18} height={18} color={theme.music} thickness={1.6} />,
              tone: theme.music,
              onPress: () => navigation.navigate("CustomExercisesPage"),
            })}
            {tile({
              key: "records",
              label: t("explore.tiles.records"),
              detail: t("explore.tiles.recordsSub"),
              icon: <Star width={18} height={18} color={theme.record} filled />,
              tone: theme.record,
              onPress: () => navigation.navigate("NationalExerciseLeaderboardPage"),
            })}
          </View>
        </View>

        {/* Your centre: what happened there since you last looked. */}
        {homeGym ? (
          <>
            {sectionHead(t("explore.sections.yourGym"), t("explore.sections.change"), () =>
              setIsChangeGymOpen(true)
            )}

            <View
              style={[
                styles.gymCard,
                {
                  backgroundColor: card,
                  borderColor: withAlpha(theme.primary, isLight ? 0.4 : 0.32),
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={openGym}
                style={styles.gymTop}
              >
                {homeGym.imageUrl ? (
                  <Image source={{ uri: homeGym.imageUrl }} style={styles.gymImage} />
                ) : (
                  <View style={[styles.gymImage, styles.gymImageFallback, { backgroundColor: theme.raisedSurface }]}>
                    <MapPin width={20} height={20} color={quiet} thickness={2} />
                  </View>
                )}

                <View style={styles.gymCopy}>
                  <ThemedText style={styles.gymName} setColor={title} numberOfLines={1}>
                    {homeGym.shortName ?? homeGym.name}
                  </ThemedText>
                  {gymRecords ? (
                    <ThemedText
                      style={styles.gymLine}
                      setColor={gymRecords.newCount > 0 ? theme.record : quiet}
                      numberOfLines={1}
                    >
                      {gymRecords.newCount > 0
                        ? t("explore.yourGym.newRecords", {
                            count: gymRecords.newCount,
                            value: formatNumber(gymRecords.newCount),
                          })
                        : t("explore.yourGym.noNewRecords")}
                    </ThemedText>
                  ) : homeGym.city ? (
                    <ThemedText style={styles.gymLine} setColor={quiet} numberOfLines={1}>
                      {homeGym.city}
                    </ThemedText>
                  ) : null}
                </View>

                <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
              </TouchableOpacity>

              {latest ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("explore.yourGym.latestLabel", {
                    name: latest.isMe ? t("common.you") : latest.displayName,
                    exercise: latest.exerciseName ?? "",
                    weight: formatWeightKg(latest.weightKg),
                  })}
                  onPress={() =>
                    navigation.navigate("GymExerciseLeaderboardPage", {
                      gym_id: homeGym.id,
                      exercise_id: latest.exerciseId,
                    })
                  }
                  style={[styles.latest, { borderTopColor: theme.hairline }]}
                >
                  <UserAvatar uri={latest.avatarUrl} size={32} iconSize={15} />
                  <View style={styles.latestCopy}>
                    <ThemedText style={styles.latestName} setColor={title} numberOfLines={1}>
                      {latest.isMe ? t("common.you") : latest.displayName}
                    </ThemedText>
                    <ThemedText style={styles.latestMeta} setColor={quiet} numberOfLines={1}>
                      {[latest.exerciseName, latest.performedAt ? formatTimeAgo(latest.performedAt) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </ThemedText>
                  </View>
                  <View style={styles.latestWeight}>
                    <ThemedText style={styles.latestKg} setColor={theme.record}>
                      {formatWeightKg(latest.weightKg)}
                    </ThemedText>
                    <ThemedText style={styles.latestUnit} setColor={quiet}>
                      {t("common.kg")}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {sectionHead(t("explore.sections.yourGym"))}
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => setIsChangeGymOpen(true)}
              style={[styles.pickGym, { backgroundColor: card, borderColor: cardBorder }]}
            >
              <View style={[styles.tileIcon, { backgroundColor: withAlpha(theme.primary, isLight ? 0.12 : 0.14) }]}>
                <MapPin width={18} height={18} color={theme.primaryText} thickness={2} />
              </View>
              <View style={styles.gymCopy}>
                <ThemedText style={styles.gymName} setColor={title} numberOfLines={1}>
                  {t("explore.yourGym.pick")}
                </ThemedText>
                <ThemedText style={styles.gymLine} setColor={quiet} numberOfLines={2}>
                  {t("explore.yourGym.pickDetail")}
                </ThemedText>
              </View>
              <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
            </TouchableOpacity>
          </>
        )}
        {/* Posts from centres: workouts done at your centre and the ones you
            train in, by people whose posts you can see. Gone when there are none. */}
        {centrePosts.length > 0 ? (
          <>
            {sectionHead(t("explore.sections.centerPosts"))}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              style={styles.railScroll}
            >
              {centrePosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={t("explore.centerPostLabel", {
                    name: post.author?.displayName ?? "",
                    title: post.title ?? "",
                    gym: post.gym?.shortName ?? "",
                  })}
                  onPress={() =>
                    navigation.navigate("CenterPostsPage", {
                      gym_id: post.gym?.id,
                      gym_name: post.gym?.shortName ?? null,
                      post_id: post.id,
                    })
                  }
                  style={[styles.postCard, { backgroundColor: card, borderColor: cardBorder }]}
                >
                  <Image source={getWorkoutCoverImage(post.workoutType)} style={styles.postImage} />
                  <View style={styles.postBody}>
                    <View style={styles.postBadgeRow}>
                      {post.gym?.shortName ? (
                        <View style={[styles.postBadge, { backgroundColor: withAlpha(theme.primary, isLight ? 0.12 : 0.14) }]}>
                          <ThemedText style={styles.postBadgeText} setColor={theme.primaryText} numberOfLines={1}>
                            {post.gym.shortName}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={styles.postTitle} setColor={title} numberOfLines={2}>
                      {post.title}
                    </ThemedText>
                    <ThemedText style={styles.postMeta} setColor={quiet} numberOfLines={1}>
                      {[post.author?.displayName, post.createdAt ? formatTimeAgo(post.createdAt) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      {/* Your centre, set by hand - or back to the one you train in most. */}
      <ChangeGymSheet
        visible={isChangeGymOpen}
        onClose={() => setIsChangeGymOpen(false)}
        currentHomeGymId={homeGym?.id ?? null}
        isAutomatic={false}
        onChanged={refresh}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
