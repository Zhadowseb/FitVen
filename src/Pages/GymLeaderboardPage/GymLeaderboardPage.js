import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import styles, { HERO_HEIGHT } from "./GymLeaderboardPageStyle";
import ChangeGymSheet from "@resources/Components/ChangeGymSheet/ChangeGymSheet";
import { useAuth } from "@contexts/AuthContext";
import { categoryLeaderboardService, gymService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Play from "@resources/Icons/UI-icons/Play";
import CategoryCard from "@resources/Components/CategoryCard/CategoryCard";
import CategoryCardSkeleton from "@resources/Components/CategoryCard/CategoryCardSkeleton";
import CoverGradient from "@resources/Components/CoverGradient";
import GenderSegment, { getSessionGender } from "@resources/Components/GenderSegment/GenderSegment";
import ScopeToggle from "@resources/Components/GymLeaderboard/ScopeToggle";
import LiftVerificationSheet from "@resources/Components/LiftVerificationSheet/LiftVerificationSheet";
import ScopeBreadcrumbs from "@resources/Components/ScopeBreadcrumbs/ScopeBreadcrumbs";
import { countryName, gymWhere } from "@resources/Components/ScopeBreadcrumbs/scopeNames";
import { openScopeLevel } from "@resources/Components/ScopeBreadcrumbs/scopeNavigation";
import {
  ThemedStateBlock,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";
import { getChainInitials } from "@utils/gymUtils";
import { gymSeenKey, markSeen } from "@utils/lastSeen";

const IDLE = { status: "idle", data: null, error: "" };

function errorText(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Screen 4d: one centre. The hero, Centre / Friends, where the centre is
 * (country › region › centre), All / Men / Women, then the four categories
 * ranked here - most trained first - and a way on to every exercise's own
 * ranking. Friends narrows the categories to the people you follow.
 */
export default function GymLeaderboardPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const { user } = useAuth();
  const gymId = Number(route.params?.gym_id ?? route.params?.gymId);
  const [scope, setScope] = useState(route.params?.scope ?? gymService.GYM_SCOPE_GYM);
  const [gender, setGender] = useState(getSessionGender);
  const [overview, setOverview] = useState(null);
  const [queue, setQueue] = useState([]);
  const [place, setPlace] = useState(null);
  const [cards, setCards] = useState(IDLE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChangeSheetOpen, setIsChangeSheetOpen] = useState(false);
  const [reviewLiftId, setReviewLiftId] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(
    Boolean(route.params?.open_verification)
  );
  const quietText = theme.quietText ?? theme.text;
  const isLight = colorScheme === "light";
  const scrimColor = isLight ? "rgba(8, 9, 12, 0.65)" : "rgba(8, 9, 12, 0.55)";
  const friendsOnly = scope === gymService.GYM_SCOPE_FRIENDS;
  const scopeOptions = [
    { value: gymService.GYM_SCOPE_GYM, label: t("gyms.scope.centre") },
    { value: gymService.GYM_SCOPE_FRIENDS, label: t("gyms.scope.friends") },
  ];

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!Number.isFinite(gymId)) {
        setErrorMessage(t("gyms.overview.notFound"));
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        // Only the three featured lifts and how many more there are: the
        // exercises themselves are one tap further, on "All exercises".
        const [overviewResult, queueResult] = await Promise.allSettled([
          gymService.getGymOverview({ gymId, scope, moreLimit: 0 }),
          gymService.getVerificationQueue({ gymId }),
        ]);

        if (overviewResult.status === "rejected") {
          throw overviewResult.reason;
        }

        if (!overviewResult.value) {
          throw new Error(t("gyms.overview.notFound"));
        }

        setOverview(overviewResult.value);
        setQueue(queueResult.status === "fulfilled" ? queueResult.value : []);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : t("gyms.overview.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [gymId, scope, t]
  );

  // Only the newest answer may write: a slow one for the gender or the scope
  // before must not land over the one chosen now.
  const cardsRequestRef = useRef(0);

  const loadCards = useCallback(
    async ({ silent = false } = {}) => {
      if (!Number.isFinite(gymId)) {
        return;
      }

      cardsRequestRef.current += 1;

      const request = cardsRequestRef.current;

      if (!silent) {
        setCards((current) => ({ status: "loading", data: current.data, error: "" }));
      }

      try {
        const data = await categoryLeaderboardService.getCategoryCards({
          scope: { level: "gym", gymId },
          gender,
          friendsOnly,
        });

        if (request === cardsRequestRef.current) {
          setCards({ status: "ready", data: data ?? null, error: "" });
        }
      } catch (error) {
        if (request === cardsRequestRef.current) {
          setCards((current) =>
            silent && current.data
              ? current
              : { status: "error", data: null, error: errorText(error, t("gyms.levels.cardsFailed")) }
          );
        }
      }
    },
    [friendsOnly, gender, gymId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();

      // Explore's "Your centre" card counts this centre's records from here.
      if (user?.id && Number.isFinite(gymId)) {
        markSeen(gymSeenKey(user.id, gymId));
      }
    }, [load, user?.id, gymId])
  );

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Back on the centre: a category page may have changed the gender. The
  // first focus is the load above.
  const hasFocusedRef = useRef(false);
  const latestRef = useRef({});

  latestRef.current = { gender, loadCards };

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedRef.current) {
        const sessionGender = getSessionGender();

        if (sessionGender !== latestRef.current.gender) {
          setGender(sessionGender);
        } else {
          latestRef.current.loadCards({ silent: true });
        }
      }

      hasFocusedRef.current = true;
    }, [])
  );

  // Where the centre is, for the path above the categories. Without it -
  // not set up yet, or it failed - the path is left out; nothing depends on it.
  useEffect(() => {
    if (!Number.isFinite(gymId)) {
      return undefined;
    }

    let isCancelled = false;

    setPlace(null);
    categoryLeaderboardService
      .getScopeSummary({ scope: { level: "gym", gymId } })
      .then((summary) => {
        if (!isCancelled) {
          setPlace(summary && !summary.unavailable && summary.country?.code ? summary : null);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [gymId]);

  useEffect(() => {
    if (route.params?.lift_id) {
      setReviewLiftId(Number(route.params.lift_id));
    }
  }, [route.params?.lift_id]);

  const gym = overview?.gym ?? null;
  const gymLabel = gym?.shortName ?? gym?.name ?? place?.gym?.shortName ?? place?.gym?.name ?? null;
  const memberLine = gym
    ? [
        t("gyms.overview.membersTrainHere", { count: gym.memberCount }),
        gym.followedMemberCount > 0
          ? t("gyms.overview.youFollow", { count: gym.followedMemberCount })
          : null,
      ].filter(Boolean)
    : [];
  const firstExerciseId =
    overview?.featured?.[0]?.exerciseId ?? overview?.more?.[0]?.exerciseId ?? null;
  const moreCount = Number(overview?.moreTotal) || 0;
  const crumbs = place
    ? [
        {
          key: "country",
          label: countryName(t, place.country.code),
          onPress: () => openScopeLevel(navigation, { level: "country", country: place.country.code }),
        },
        place.region?.key
          ? {
              key: "region",
              label: place.region.name ?? place.region.key,
              onPress: () =>
                openScopeLevel(
                  navigation,
                  { level: "region", country: place.country.code, region: place.region.key },
                  { regionName: place.region.name ?? null }
                ),
            }
          : null,
        { key: "gym", label: place.gym?.shortName ?? place.gym?.name ?? gymLabel },
      ].filter(Boolean)
    : [];

  const openExercise = (exerciseId) => {
    navigation.navigate("GymExerciseLeaderboardPage", { gym_id: gymId, exercise_id: exerciseId, scope });
  };

  // Friends and the centre's name go along: the category page shows the same
  // people the card did, under the centre's name.
  const openCategory = (category) => {
    navigation.navigate("CategoryLeaderboardPage", {
      category,
      scope: { level: "gym", gymId },
      gender,
      friendsOnly,
      scopeName: gymLabel,
    });
  };

  const renderCards = () => {
    if (cards.status === "error") {
      return (
        <View style={[styles.notice, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <ThemedText style={styles.noticeTitle} setColor={theme.title}>
            {t("gyms.levels.cardsFailed")}
          </ThemedText>
          {cards.error && cards.error !== t("gyms.levels.cardsFailed") ? (
            <ThemedText style={styles.noticeBody} setColor={quietText}>
              {cards.error}
            </ThemedText>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={8}
            onPress={() => loadCards()}
            style={styles.noticeAction}
          >
            <ThemedText style={styles.noticeActionText} setColor={theme.primaryText}>
              {t("common.retry")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (!cards.data) {
      return <CategoryCardSkeleton />;
    }

    // Before the migration the categories have nothing to rank by. The rest
    // of the page - the hero, verification, every exercise - is older and
    // works without it.
    if (cards.data.unavailable) {
      return (
        <View style={[styles.notice, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <ThemedText style={styles.noticeTitle} setColor={theme.title}>
            {t("gyms.levels.notYetTitle")}
          </ThemedText>
          <ThemedText style={styles.noticeBody} setColor={quietText}>
            {t("gyms.levels.cardsNotYet")}
          </ThemedText>
        </View>
      );
    }

    const list = cards.data.cards ?? [];

    return list.length ? (
      <View style={[styles.cards, cards.status === "loading" ? styles.refreshing : null]}>
        {list.map((card) => (
          <CategoryCard
            key={card.category}
            card={card}
            levelLabel={gymLabel}
            where={gymWhere(t, gymLabel)}
            variant="gym"
            onPress={() => openCategory(card.category)}
          />
        ))}
      </View>
    ) : null;
  };

  return (
    <ThemedView safe={["left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: theme.cardBackground }]}>
          {gym?.imageUrl ? (
            <Image source={{ uri: gym.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <ThemedText style={styles.heroFallbackText} setColor={quietText}>
                {getChainInitials(gym?.chain)}
              </ThemedText>
            </View>
          )}
          <CoverGradient
            color="#08090C"
            style={{ height: 90, bottom: undefined }}
            stops={[
              { offset: "0%", opacity: isLight ? 0.65 : 0.55 },
              { offset: "100%", opacity: 0 },
            ]}
          />
          <CoverGradient
            color={theme.background}
            style={{ top: HERO_HEIGHT - 150 }}
            stops={[
              { offset: "0%", opacity: 0 },
              { offset: "45%", opacity: isLight ? 0.82 : 0.72 },
              { offset: "100%", opacity: 1 },
            ]}
          />

          <View style={[styles.heroTopBar, { top: insets.top + 8 }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.goBack")}
              onPress={() => navigation.goBack()}
              hitSlop={6}
              style={[styles.heroButton, { backgroundColor: scrimColor }]}
            >
              <ArrowLeft width={22} height={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("gyms.overview.changeCentre")}
              onPress={() => setIsChangeSheetOpen(true)}
              style={[styles.heroPill, { backgroundColor: scrimColor }]}
            >
              <MapPin width={12} height={12} color={theme.primary} thickness={2.4} />
              <ThemedText style={styles.heroPillText} setColor="#FFFFFF">
                {gym?.isHomeGym ? t("gyms.overview.yourCentre") : t("gyms.overview.changeCentre")}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCopy}>
            <ThemedText style={styles.heroEyebrow} setColor={theme.primaryText}>
              {gym?.chain ?? " "}
            </ThemedText>
            <ThemedText style={styles.heroTitle} setColor={theme.title} numberOfLines={2}>
              {gym?.name ?? (isLoading ? t("common.loading") : t("gyms.centre"))}
            </ThemedText>
            {memberLine.length ? (
              <View style={styles.heroMetaRow}>
                {memberLine.map((part, index) => (
                  <View key={part} style={styles.heroMetaRow}>
                    {index > 0 ? <View style={[styles.heroMetaDot, { backgroundColor: "#6E7480" }]} /> : null}
                    <ThemedText style={styles.heroMeta} setColor={theme.mutedStrong}>
                      {part}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {errorMessage ? (
          <ThemedStateBlock
            variant="error"
            style={styles.stateBlock}
            title={t("gyms.overview.unavailableTitle")}
            message={errorMessage}
            actionLabel={t("common.retry")}
            onAction={() => load()}
          />
        ) : isLoading && !overview ? (
          <ThemedStateBlock variant="loading" style={styles.stateBlock} />
        ) : (
          <View style={styles.body}>
            <ScopeToggle options={scopeOptions} value={scope} onChange={setScope} />

            {crumbs.length ? <ScopeBreadcrumbs items={crumbs} style={styles.crumbs} /> : null}

            {/* All / Men / Women only splits the categories; with none to
                split yet it would be a control that does nothing. */}
            {cards.data?.unavailable ? null : <GenderSegment value={gender} onChange={setGender} />}

            {queue.length > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => {
                  setReviewLiftId(null);
                  setIsReviewOpen(true);
                }}
                style={[
                  styles.reviewRow,
                  { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.planned, 0.4) },
                ]}
              >
                <View style={[styles.reviewIcon, { backgroundColor: withAlpha(theme.planned, 0.16) }]}>
                  <Play width={14} height={14} color={theme.planned} />
                </View>
                <View style={styles.reviewCopy}>
                  <ThemedText style={styles.reviewTitle} setColor={theme.title}>
                    {t("gyms.overview.reviewQueue", { count: queue.length })}
                  </ThemedText>
                  <ThemedText style={styles.reviewBody} setColor={quietText}>
                    {t("gyms.overview.reviewHint")}
                  </ThemedText>
                </View>
                <ChevronRight width={18} height={18} color={theme.chevron} />
              </TouchableOpacity>
            ) : null}

            <View style={styles.sectionLabelRow}>
              <ThemedText style={styles.sectionLabel} setColor={quietText} numberOfLines={1}>
                {t("gyms.categories")}
              </ThemedText>
              <ThemedText style={styles.sectionHint} setColor={quietText} numberOfLines={1}>
                {t("gyms.sortedByActivity")}
              </ThemedText>
            </View>

            {renderCards()}

            {firstExerciseId ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => openExercise(firstExerciseId)}
                style={[styles.allRow, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
              >
                <View style={styles.allCopy}>
                  <ThemedText style={styles.allTitle} setColor={theme.title} numberOfLines={1}>
                    {t("gyms.overview.allExercises")}
                  </ThemedText>
                  <ThemedText style={styles.allDetail} setColor={quietText} numberOfLines={1}>
                    {t("gyms.overview.allExercisesDetail", { count: moreCount })}
                  </ThemedText>
                </View>
                <ChevronRight width={18} height={18} color={theme.chevron} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ChangeGymSheet
        visible={isChangeSheetOpen}
        onClose={() => setIsChangeSheetOpen(false)}
        currentHomeGymId={gym?.isHomeGym ? gym.id : null}
        isAutomatic={false}
        onChanged={(nextGymId) => {
          if (nextGymId && nextGymId !== gymId) {
            navigation.setParams({ gym_id: nextGymId });
          } else {
            load({ silent: true });
          }
        }}
      />

      <LiftVerificationSheet
        visible={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        gymId={gymId}
        initialLiftId={reviewLiftId}
        onVoted={() => load({ silent: true })}
      />
    </ThemedView>
  );
}
