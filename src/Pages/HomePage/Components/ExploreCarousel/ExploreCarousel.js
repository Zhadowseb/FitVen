import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { formatNumber, useTranslation } from "@localization";

import styles, { RAIL_GAP } from "./ExploreCarouselStyle";
import ExploreCarouselCard, { ExploreCarouselCardPlaceholder } from "./ExploreCarouselCard";
import { CARD_WIDTH } from "./ExploreCarouselCardStyle";
import { useAuth } from "@contexts/AuthContext";
import { homeExploreService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import Library from "@resources/Icons/UI-icons/Library";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Star from "@resources/Icons/UI-icons/Star";
import { ThemedText } from "@resources/ThemedComponents";
import { muscleToneToken, primaryMuscleKey } from "@utils/customExercises";
import { formatTimeAgo } from "@utils/dateUtils";
import { formatWeightKg } from "@utils/gymUtils";
import { buildHomeExploreCards, localDayNumber } from "@utils/homeExploreCards";
import { getWorkoutCoverImage } from "@utils/workoutCoverImages";

// Home is opened all the time; the rail asks Explore again at most once a
// minute, unless Home is pulled to refresh.
const REFRESH_INTERVAL_MS = 60 * 1000;
const PLACEHOLDER_COUNT = 2;
// "Open" is one short word in small type: this makes it 44 pt to hit.
const OPEN_HIT_SLOP = { top: 15, bottom: 15, left: 12, right: 12 };

// What the rail last showed, whose it was and when it last asked. Outside the
// component, so a Home that is built again paints the cards it had at once
// and refreshes underneath.
const feedCache = { userId: undefined, feed: null, requestedAt: 0 };
// Only the newest request paints: a slow answer from before a pull to refresh
// must not put older cards back.
let latestRequestId = 0;

function cachedFeed(userId) {
  return feedCache.userId === userId ? feedCache.feed : null;
}

// Leaving through the rail can change what it should say - the centre's page
// marks its records seen, Centres and Explore can change your centre - so the
// way back asks again instead of showing "3 new records" for another minute.
function expireFeed() {
  feedCache.requestedAt = 0;
}

/**
 * What a card from buildHomeExploreCards says, how it looks and where it
 * goes. `metaParts` is the line under the title, joined with " · " on the
 * card and with commas for a screen reader.
 */
function describeCard(card, { t, theme, navigation }) {
  switch (card.type) {
    case "gymRecords": {
      const { gym, newCount, latest } = card;
      const gymName = gym.shortName || gym.name || "";
      const title =
        newCount > 0
          ? t("homeExplore.gymRecords.newRecords", { count: newCount, value: formatNumber(newCount) })
          : latest
            ? t("homeExplore.liftTitle", {
                exercise: latest.exerciseName,
                weight: formatWeightKg(latest.weightKg),
              })
            : gymName;

      return {
        kicker: t("homeExplore.kickers.gymRecords"),
        title,
        // Who set the newest record and when. Without one, the centre, by a
        // name the title is not already using.
        metaParts: latest
          ? [
              latest.isMe ? t("common.you") : latest.displayName,
              latest.performedAt ? formatTimeAgo(latest.performedAt) : null,
            ]
          : [
              [gymName, gym.name, gym.city].find((value) => value && value !== title) ??
                t("homeExplore.gymRecords.seeRecords"),
            ],
        tone: theme.record,
        toneText: theme.record,
        image: gym.imageUrl ? { uri: gym.imageUrl } : null,
        icon: Star,
        open: () => navigation.navigate("GymLeaderboardPage", { gym_id: gym.id }),
      };
    }

    case "exercise": {
      const item = card.exercise;
      const tone = theme[muscleToneToken(primaryMuscleKey(item.muscles))] ?? theme.musclePush;
      const users = Number(item.users);

      return {
        kicker: t("homeExplore.kickers.exercise"),
        title: item.name,
        metaParts: [
          item.owner?.displayName || item.owner?.username || t("customExercises.someone"),
          Number.isFinite(users) && users > 0
            ? t("customExercises.users", { count: users, value: formatNumber(users) })
            : null,
        ],
        tone,
        toneText: tone,
        image: item.posterUrl ? { uri: item.posterUrl } : null,
        icon: Library,
        iconProps: { thickness: 1.6 },
        open: () => navigation.navigate("CustomExerciseDetailPage", { exerciseId: item.id }),
      };
    }

    case "centrePost": {
      const { post } = card;

      return {
        kicker: t("homeExplore.kickers.centrePost"),
        title: post.title || post.author?.displayName || t("homeExplore.kickers.centrePost"),
        metaParts: [post.gym.shortName, post.createdAt ? formatTimeAgo(post.createdAt) : null],
        tone: theme.primary,
        toneText: theme.primaryText,
        image: getWorkoutCoverImage(post.workoutType),
        icon: MapPin,
        iconProps: { thickness: 2 },
        open: () =>
          navigation.navigate("CenterPostsPage", {
            gym_id: post.gym.id,
            gym_name: post.gym.shortName ?? null,
            post_id: post.id,
          }),
      };
    }

    case "strongest": {
      const { lift } = card;

      return {
        kicker: t("homeExplore.kickers.strongest"),
        title: t("homeExplore.liftTitle", {
          exercise: card.exerciseName,
          weight: formatWeightKg(lift.weightKg),
        }),
        metaParts: [lift.isMe ? t("common.you") : lift.displayName],
        tone: theme.record,
        toneText: theme.record,
        image: null,
        icon: Star,
        open: () =>
          navigation.navigate("NationalExerciseLeaderboardPage", { exercise_id: card.exerciseId }),
      };
    }

    case "findGym":
      return {
        kicker: t("homeExplore.kickers.findGym"),
        title: t("homeExplore.findGym.title"),
        metaParts: [t("homeExplore.findGym.meta")],
        tone: theme.primary,
        toneText: theme.primaryText,
        image: null,
        icon: MapPin,
        iconProps: { thickness: 2 },
        open: () => navigation.navigate("GymsPage"),
      };

    case "customExercises":
      return {
        kicker: t("homeExplore.kickers.customExercises"),
        // The library's own name, so the card and the page it opens agree.
        title: t("explore.customExercises.title"),
        metaParts: [t("homeExplore.customExercises.meta")],
        tone: theme.music,
        toneText: theme.music,
        image: null,
        icon: Library,
        iconProps: { thickness: 1.6 },
        open: () => navigation.navigate("CustomExercisesPage"),
      };

    default:
      return null;
  }
}

/**
 * "From Explore" on Home, for everybody: a rail of cards from Explore - your
 * centre and its new records, the newest exercises people have shared, posts
 * from the centres you train in, one of Denmark's strongest - and the ways in
 * for somebody who has none of those yet. Which cards, and in what order, is
 * buildHomeExploreCards; what they are made from is homeExploreService.
 *
 * It loads its own data when Home comes into focus - at most once a minute,
 * or on the way back from a screen opened from the rail - and whenever
 * `refreshKey` changes, which Home bumps on a pull to refresh.
 * The block never goes away and never shows an error: before the first answer
 * it is two still placeholders, and after it there are always cards, even when
 * every question failed.
 */
export default function ExploreCarousel({ refreshKey = 0 }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [shown, setShown] = useState(() => ({ userId, feed: cachedFeed(userId) }));
  const mountedRef = useRef(false);
  // The refreshKey the rail last loaded for; another one is a pull to refresh.
  const loadedKeyRef = useRef(refreshKey);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    if (feedCache.userId !== userId) {
      feedCache.userId = userId;
      feedCache.feed = null;
    }

    feedCache.requestedAt = Date.now();
    latestRequestId += 1;
    const requestId = latestRequestId;

    homeExploreService
      .getHomeExploreFeed({ user })
      .catch((error) => {
        console.warn("Home's From Explore could not load:", error);
        return null;
      })
      .then((next) => {
        if (requestId !== latestRequestId || feedCache.userId !== userId) {
          return;
        }

        let feed = next;

        // Nothing came back, offline most likely: keep what is shown - or,
        // with nothing to keep, the cards that need nothing - and ask again
        // on the next visit rather than a minute from now.
        if (!next || next.allFailed) {
          feedCache.requestedAt = 0;
          feed = feedCache.feed ?? homeExploreService.EMPTY_HOME_EXPLORE_FEED;
        }

        feedCache.feed = feed;

        if (mountedRef.current) {
          setShown({ userId, feed });
        }
      });
  }, [user, userId]);

  useFocusEffect(
    useCallback(() => {
      const keyChanged = loadedKeyRef.current !== refreshKey;
      const isFresh =
        feedCache.userId === userId && Date.now() - feedCache.requestedAt < REFRESH_INTERVAL_MS;

      loadedKeyRef.current = refreshKey;

      if (keyChanged || !isFresh) {
        load();
      }
    }, [load, refreshKey, userId])
  );

  const feed = shown.userId === userId ? shown.feed : cachedFeed(userId);
  // At render, so the day turns on the first paint after midnight.
  const dayNumber = localDayNumber();
  const cards = useMemo(
    () =>
      feed
        ? buildHomeExploreCards({
            homeGym: feed.homeGym,
            gymRecords: feed.gymRecords,
            exercises: feed.exercises,
            centrePosts: feed.centrePosts,
            strongest: feed.strongest,
            dayNumber,
          })
        : null,
    [dayNumber, feed]
  );

  return (
    <View>
      <View style={styles.header}>
        <ThemedText
          style={styles.label}
          setColor={theme.quietText}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {t("homeExplore.title")}
        </ThemedText>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("homeExplore.openA11y")}
          hitSlop={OPEN_HIT_SLOP}
          onPress={() => {
            expireFeed();
            navigation.navigate("ExplorePage");
          }}
        >
          <ThemedText style={styles.action} setColor={theme.primaryText}>
            {t("homeExplore.open")}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + RAIL_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        style={styles.railScroll}
        contentContainerStyle={styles.rail}
      >
        {cards ? (
          cards.map((card) => {
            const view = describeCard(card, { t, theme, navigation });

            if (!view) {
              return null;
            }

            const parts = view.metaParts.filter(Boolean);

            return (
              <ExploreCarouselCard
                key={card.key}
                kicker={view.kicker}
                title={view.title}
                meta={parts.join(" · ")}
                tone={view.tone}
                toneText={view.toneText}
                image={view.image}
                icon={view.icon}
                iconProps={view.iconProps}
                accessibilityLabel={
                  parts.length > 0
                    ? t("homeExplore.cardA11y", {
                        kicker: view.kicker,
                        title: view.title,
                        meta: parts.join(", "),
                      })
                    : t("homeExplore.cardA11yShort", { kicker: view.kicker, title: view.title })
                }
                onPress={() => {
                  expireFeed();
                  view.open();
                }}
              />
            );
          })
        ) : (
          <View
            style={styles.placeholders}
            accessible
            accessibilityLabel={t("homeExplore.loadingA11y")}
            accessibilityState={{ busy: true }}
          >
            {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
              <ExploreCarouselCardPlaceholder key={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
