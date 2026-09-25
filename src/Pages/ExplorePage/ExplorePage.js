import { StatusBar } from "expo-status-bar";
import { Image, Pressable, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ExplorePageStyle";
import ExerciseRailCard from "../CustomExercisesPage/Components/ExerciseRailCard";
import { useAuth } from "@contexts/AuthContext";
import { exerciseService, gymService, socialPostService } from "@services";
import ChangeGymSheet from "@resources/Components/ChangeGymSheet/ChangeGymSheet";
import { showToast } from "@resources/Components/Toast/Toast";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Library from "@resources/Icons/UI-icons/Library";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Search from "@resources/Icons/UI-icons/Search";
import Star from "@resources/Icons/UI-icons/Star";
import { ThemedText, ThemedView, UserAvatar } from "@resources/ThemedComponents";
import { formatTimeAgo } from "@utils/dateUtils";
import { getWorkoutCoverImage } from "@utils/workoutCoverImages";
import { formatWeightKg } from "@utils/gymUtils";
import { getLastSeenOrStart, gymSeenKey } from "@utils/lastSeen";

// What the page last showed, so a return to the tab paints it at once and
// refreshes underneath - the tab is built again on every visit.
let lastShown = null;

// Programs shared by others do not exist yet: the tile says so with a zero
// until public programs are built.
const PROGRAM_COUNT = 0;

const EMPTY = {
  gymCount: null,
  homeGym: null,
  gymRecords: null,
  centrePosts: [],
  customExerciseCount: null,
  customExercises: [],
};
const CENTRE_POST_LIMIT = 8;
const CUSTOM_EXERCISE_RAIL_LIMIT = 6;

// "From others": somebody else's first, and your own only after them, so the
// rail still shows something when all that is shared so far is yours.
function othersFirst(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  return [...list.filter((item) => !item.isMine), ...list.filter((item) => item.isMine)];
}

async function loadExplore(user) {
  const userId = user?.id ?? null;
  const [gymCountResult, homeGymResult, myGymsResult, sharedResult] = await Promise.allSettled([
    gymService.getGymCount(),
    gymService.getMyHomeGym(),
    userId ? gymService.getMyGyms() : Promise.resolve([]),
    // The newest shared exercises for the rail, and on the same page the
    // count of everything that can be found, for the tile.
    exerciseService.getPublicCustomExercises({ sort: "newest", limit: CUSTOM_EXERCISE_RAIL_LIMIT }),
  ]);
  const homeGym = homeGymResult.status === "fulfilled" ? homeGymResult.value : null;
  const shared = sharedResult.status === "fulfilled" ? sharedResult.value : null;
  // Posts from your centre and from the centres you train in.
  const centreIds = [
    homeGym?.id,
    ...(myGymsResult.status === "fulfilled" ? myGymsResult.value : []).map((gym) => gym.id),
  ].filter((id) => id !== null && id !== undefined);

  const [gymRecordsResult, centrePostsResult] = await Promise.allSettled([
    homeGym && userId
      ? getLastSeenOrStart(gymSeenKey(userId, homeGym.id)).then((since) =>
          gymService.getRecentGymRecords({ gymId: homeGym.id, since })
        )
      : Promise.resolve(null),
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
    ["centre posts", centrePostsResult],
    ["centres you train in", myGymsResult],
    ["shared exercises", sharedResult],
  ]) {
    if (result.status === "rejected") {
      console.error(`Explore could not load its ${label}:`, result.reason);
    }
  }

  return {
    gymCount: gymCountResult.status === "fulfilled" ? gymCountResult.value : null,
    homeGym,
    gymRecords: gymRecordsResult.status === "fulfilled" ? gymRecordsResult.value : null,
    centrePosts: centrePostsResult.status === "fulfilled" ? centrePostsResult.value : [],
    // A backend without the migration has nothing shared: zero, not unknown.
    customExerciseCount: shared
      ? shared.unavailable
        ? 0
        : typeof shared.libraryTotal === "number"
          ? shared.libraryTotal
          : null
      : null,
    customExercises: shared && !shared.unavailable ? othersFirst(shared.items) : [],
  };
}

/**
 * Explore, the tab where you find things: centres and the records set in
 * them, the posts from the centres you train in, programs, exercises others
 * have made - the newest on a rail you can add from - and, through the
 * button in the corner, the people you follow. Programs are zero until they
 * can be shared; knowledge joins later.
 */
export default function ExplorePage() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const { user } = useAuth();
  const [data, setData] = useState(lastShown ?? EMPTY);
  const [isChangeGymOpen, setIsChangeGymOpen] = useState(false);
  // The rail cards whose "Add" is running, so each shows its own spinner.
  const [addingIds, setAddingIds] = useState([]);
  const addingRef = useRef(new Set());
  // Added from here, so a load that set out before the add landed does not
  // paint "Add" on the card again.
  const addedIdsRef = useRef(new Set());
  // Only the newest load may paint: a slow one from before a change of centre
  // must not put the old centre back.
  const loadIdRef = useRef(0);

  const refresh = useCallback(() => {
    const loadId = ++loadIdRef.current;

    loadExplore(user).then((next) => {
      if (loadId === loadIdRef.current) {
        const added = addedIdsRef.current;
        const shown =
          added.size > 0
            ? {
                ...next,
                customExercises: next.customExercises.map((item) =>
                  added.has(item.id) ? { ...item, isAdded: true } : item
                ),
              }
            : next;

        lastShown = shown;
        setData(shown);
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

  // One card changed in place - and in what a return to the tab paints first,
  // so it does not show "Add" again before the refresh arrives.
  const patchCustomExercise = useCallback((id, patch) => {
    const apply = (shown) =>
      shown
        ? {
            ...shown,
            customExercises: (shown.customExercises ?? []).map((item) =>
              item.id === id ? { ...item, ...patch } : item
            ),
          }
        : shown;

    lastShown = apply(lastShown);
    setData((previous) => apply(previous));
  }, []);

  // "Add" on a rail card: a copy in your own exercises, without leaving.
  const addCustomExercise = useCallback(
    async (item) => {
      if (!item?.id || addingRef.current.has(item.id)) {
        return;
      }

      addingRef.current.add(item.id);
      setAddingIds([...addingRef.current]);

      try {
        const result = await exerciseService.adoptExercise(db, item.id);
        const name = result?.exerciseName || item.name;

        if (result?.status === "added" || result?.status === "already_added") {
          addedIdsRef.current.add(item.id);
          patchCustomExercise(item.id, { isAdded: true });

          if (result.status === "added") {
            showToast(t("customExercises.addedToast", { name }), { tone: "success" });
          }
        } else if (result?.status === "name_taken") {
          showToast(t("customExercises.nameTaken", { name }), { tone: "info" });
        } else if (result?.status === "own") {
          patchCustomExercise(item.id, { isMine: true });
        }
      } catch (error) {
        console.error("Explore could not add a shared exercise:", error);
        showToast(error?.message || t("customExercises.addFailed"), { tone: "info" });
      } finally {
        addingRef.current.delete(item.id);
        setAddingIds([...addingRef.current]);
      }
    },
    [db, patchCustomExercise, t]
  );

  const {
    gymCount,
    homeGym,
    gymRecords,
    centrePosts,
    customExerciseCount = null,
    customExercises = [],
  } = data;
  const latest = gymRecords?.latest ?? null;
  const card = theme.cardBackground;
  const cardBorder = theme.cardBorder;
  const quiet = theme.quietText;
  const title = theme.title;

  const openGym = () => navigation.navigate("GymLeaderboardPage", { gym_id: homeGym.id });
  const openCustomExercise = (item) => navigation.navigate("CustomExerciseDetailPage", { exerciseId: item.id });

  const sectionHead = (label, action, onAction, actionLabel) => (
    <View style={styles.sectionHead}>
      <ThemedText style={styles.sectionLabel} setColor={quiet}>
        {label}
      </ThemedText>
      {action ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          onPress={onAction}
        >
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
        <View style={styles.header}>
          <ThemedText style={styles.title} setColor={title} accessibilityRole="header">
            {t("explore.title")}
          </ThemedText>
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
              // Nothing shared yet is an invitation rather than a zero.
              detail:
                customExerciseCount === null
                  ? t("explore.tiles.exercisesSub")
                  : customExerciseCount === 0
                    ? t("explore.tiles.exercisesFirst")
                    : t("explore.tiles.exercisesCount", {
                        count: customExerciseCount,
                        value: formatNumber(customExerciseCount),
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

        {/* The newest exercises people have shared, each one "Add" away.
            Gone when there are none: the tile above already invites. */}
        {customExercises.length > 0 ? (
          <>
            {sectionHead(
              t("explore.sections.customExercises"),
              customExerciseCount > 0
                ? t("explore.sections.allCount", {
                    count: customExerciseCount,
                    value: formatNumber(customExerciseCount),
                  })
                : t("explore.sections.all"),
              () => navigation.navigate("CustomExercisesPage", { sort: "newest" }),
              customExerciseCount > 0
                ? t("explore.sections.allExercisesA11y", {
                    count: customExerciseCount,
                    value: formatNumber(customExerciseCount),
                  })
                : undefined
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              style={styles.railScroll}
            >
              {customExercises.map((item) => (
                <ExerciseRailCard
                  key={item.id}
                  item={item}
                  isAdding={addingIds.includes(item.id)}
                  onPress={openCustomExercise}
                  onAdd={addCustomExercise}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

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
