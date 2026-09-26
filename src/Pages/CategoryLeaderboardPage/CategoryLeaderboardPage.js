import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, TouchableOpacity, View, useColorScheme } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./CategoryLeaderboardPageStyle";
import CategoryFilters from "./Components/CategoryFilters";
import CategoryPodium from "./Components/CategoryPodium";
import CategorySkeleton from "./Components/CategorySkeleton";
import CategoryTopBar from "./Components/CategoryTopBar";
import LiftLinks, { POWERLIFTING_LIFTS } from "./Components/LiftLinks";
import MyRankCard from "./Components/MyRankCard";
import PersonalCard from "./Components/PersonalCard";
import RankRow, { ListGapRow } from "./Components/RankRow";
import { categoryLeaderboardService, gymService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import GenderSegment, { getSessionGender } from "@resources/Components/GenderSegment/GenderSegment";
import { ThemedStateBlock, ThemedText, ThemedView } from "@resources/ThemedComponents";
import {
  RULE_PARAMS,
  activeFilterLabel,
  categoryTone,
  emptyBodyKey,
  explanationKey,
  meSubtitle,
  rowSubtitle,
  valueKind,
} from "@utils/categoryFormat";
import {
  CATEGORY_KEYS,
  categoryNameKey,
  countryNameKey,
  normalizeCategory,
  normalizeCategoryFilters,
  normalizeGender,
  normalizeScope,
  scopeKey,
} from "@utils/gymCategories";

const EMPTY_BOARD = { podium: [], rows: [], me: null, total: 0 };
// Holds the eyebrow's line while a region's or a centre's name is on its way,
// so the title does not jump when it arrives.
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

// The catalogue's bench press, squat and deadlift, behind Powerlifting's three
// buttons. The same ids at every level, so they are asked for once a session.
let featuredLiftsRequest = null;

function loadFeaturedLifts() {
  if (!featuredLiftsRequest) {
    featuredLiftsRequest = gymService
      .getNationalStrongest()
      .then((entries) => {
        const byName = { "bench press": "bench", squat: "squat", deadlift: "deadlift" };
        const ids = {};

        // National_strongest lists them in this order; the name decides,
        // the order only fills in a name the catalogue spells differently.
        (entries ?? []).forEach((entry, index) => {
          const lift = byName[String(entry?.exerciseName ?? "").trim().toLowerCase()] ?? POWERLIFTING_LIFTS[index];

          if (lift && entry?.exerciseId && !ids[lift]) {
            ids[lift] = entry.exerciseId;
          }
        });

        return ids;
      })
      .catch((error) => {
        featuredLiftsRequest = null;
        throw error;
      });
  }

  return featuredLiftsRequest;
}

function countryName(code, t) {
  const key = countryNameKey(code);
  const name = t(key);

  // A country the app has no name for yet is shown by its code.
  return name === key ? String(code ?? "").toUpperCase() : name;
}

/**
 * Screens 5a-5d: one category - Flid, Powerlifting, Fremgang, Calisthenics -
 * ranked at the level it was opened from (a centre, a region, a country).
 * The gender and the category's own filters narrow it; every change fetches
 * again, the list on screen stays until the answer is in, and only the
 * newest answer is painted. Your own row is pinned under the list.
 *
 * Params: { category, scope, gender, scopeName?, friendsOnly? }.
 */
export default function CategoryLeaderboardPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const params = route.params ?? {};
  const category = normalizeCategory(params.category) ?? CATEGORY_KEYS[0];
  // Keyed on the scope's string form: a screen that navigates here builds a
  // new scope object every render, and the list must not refetch for that.
  const routeScopeKey = scopeKey(params.scope);
  const scope = useMemo(() => normalizeScope(params.scope), [routeScopeKey]);
  const friendsOnly = params.friendsOnly === true;
  const passedScopeName =
    typeof params.scopeName === "string" && params.scopeName.trim() !== "" ? params.scopeName.trim() : null;

  const [gender, setGender] = useState(() =>
    params.gender === undefined ? getSessionGender() : normalizeGender(params.gender)
  );
  const [filterState, setFilterState] = useState({});
  const filters = useMemo(() => normalizeCategoryFilters(category, filterState), [category, filterState]);
  const requestKey = useMemo(
    () => JSON.stringify([category, routeScopeKey, gender, filters, friendsOnly]),
    [category, filters, friendsOnly, gender, routeScopeKey]
  );

  // The list on screen and the request it answered, so a list fetched for
  // another filter is never mistaken for this one.
  const [painted, setPainted] = useState({ key: null, board: null, at: 0 });
  const [failure, setFailure] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const latestRequestRef = useRef(0);

  const [scopeSummary, setScopeSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const load = useCallback(
    async ({ pull = false } = {}) => {
      const requestId = latestRequestRef.current + 1;

      latestRequestRef.current = requestId;

      if (pull) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setFailure(null);
      }

      try {
        const board = await categoryLeaderboardService.getCategoryLeaderboard({
          category,
          scope,
          gender,
          filters,
          friendsOnly,
        });

        if (latestRequestRef.current !== requestId) {
          return;
        }

        setPainted({ key: requestKey, board: board ?? EMPTY_BOARD, at: Date.now() });
        setFailure(null);
      } catch (error) {
        if (latestRequestRef.current !== requestId) {
          return;
        }

        setFailure({
          key: requestKey,
          message: error instanceof Error && error.message ? error.message : t("category.errors.body"),
        });
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [category, filters, friendsOnly, gender, requestKey, scope, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  // The eyebrow's name for a region or a centre comes from the server - a
  // region's in the reader's language - unless the screen before passed it.
  const needsSummary = !passedScopeName && (scope.level === "region" || scope.level === "gym");

  useEffect(() => {
    if (!needsSummary) {
      return undefined;
    }

    let cancelled = false;

    setIsSummaryLoading(true);
    categoryLeaderboardService
      .getScopeSummary({ scope })
      .then((summary) => {
        if (!cancelled) {
          setScopeSummary(summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScopeSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [needsSummary, scope, t]);

  const [liftIds, setLiftIds] = useState({});

  useEffect(() => {
    if (category !== "powerlifting") {
      return undefined;
    }

    let cancelled = false;

    loadFeaturedLifts()
      .then((ids) => {
        if (!cancelled) {
          setLiftIds(ids);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [category]);

  const updateFilters = useCallback((patch) => {
    setFilterState((current) => ({ ...current, ...patch }));
  }, []);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("GymsPage");
    }
  }, [navigation]);

  const openPerson = useCallback(
    (person) => {
      if (person?.id && !person.isMe) {
        navigation.navigate("PublicProfilePage", { userId: person.id });
      }
    },
    [navigation]
  );

  const openLift = useCallback(
    async (lift) => {
      let exerciseId = liftIds[lift];

      if (!exerciseId) {
        try {
          const ids = await loadFeaturedLifts();

          setLiftIds(ids);
          exerciseId = ids[lift];
        } catch {
          exerciseId = null;
        }
      }

      if (!exerciseId) {
        return;
      }

      if (scope.level === "gym") {
        navigation.navigate("GymExerciseLeaderboardPage", {
          gym_id: scope.gymId,
          exercise_id: exerciseId,
          scope: friendsOnly ? gymService.GYM_SCOPE_FRIENDS : gymService.GYM_SCOPE_GYM,
        });
      } else {
        navigation.navigate("NationalExerciseLeaderboardPage", { exercise_id: exerciseId });
      }
    },
    [friendsOnly, liftIds, navigation, scope]
  );

  /* -------------------------------------------------------- what to show -- */

  // The category's colour as the card that opened the page has it: `tone`
  // for the glows and tints, `toneText` for the title and the values.
  const { tone, toneText } = categoryTone(theme, category);
  const kind = valueKind(category, filters.tab);

  const place = (() => {
    if (passedScopeName) {
      return passedScopeName;
    }

    switch (scope.level) {
      case "world":
        return t("category.page.allCountries");
      case "gym":
        if (isSummaryLoading) {
          return NO_BREAK_SPACE;
        }

        return scopeSummary?.gym?.shortName || scopeSummary?.gym?.name || t("category.page.gymFallback");
      case "region":
        if (isSummaryLoading) {
          return NO_BREAK_SPACE;
        }

        return scopeSummary?.region?.name || countryName(scope.country, t);
      default:
        return countryName(scope.country, t);
    }
  })();
  const placeLabel = friendsOnly ? `${place} · ${t("category.page.friends")}` : place;

  const board = painted.board;
  const isCurrent = painted.key === requestKey;
  const currentFailure = failure?.key === requestKey ? failure : null;
  // A failed filter change leaves nothing true to show; a failed pull on the
  // same filters leaves the list, with a line that it could not be updated.
  const showErrorBlock = Boolean(currentFailure) && !isCurrent;
  const showErrorBanner = Boolean(currentFailure) && isCurrent;
  const showSkeleton = !board && !currentFailure;
  const isUnavailable = Boolean(board?.unavailable) && !showErrorBlock;
  const showBoard = Boolean(board) && !isUnavailable && !showErrorBlock;
  const isUpdating = Boolean(board) && !isCurrent && isLoading;
  const podium = showBoard && category !== "fremgang" ? (board.podium ?? []).slice(0, 3) : [];
  const rows = useMemo(() => (showBoard ? board.rows ?? [] : []), [board, showBoard]);
  const me = showBoard ? board.me ?? null : null;
  const hasPeople = podium.length > 0 || rows.length > 0;
  const showMe = showBoard && (hasPeople || Boolean(me));
  const scopeLevel = scope.level;

  // The server's `me`: null when you have not trained at the level; your
  // row with inFilter false when a filter leaves you out; rank null when you
  // are a member with nothing that counts in this category yet.
  let meMode = "row";

  if (me && me.inFilter === false) {
    meMode = "notInFilter";
  } else if (!me || me.inScope === false) {
    meMode = "notMember";
  } else if (me.rank === null || me.rank === undefined) {
    meMode = "noValue";
  }

  const renderRow = useCallback(
    ({ item, index }) => (
      <RankRow
        row={item}
        kind={kind}
        subtitle={rowSubtitle({ category, tab: filters.tab, row: item, scopeLevel, t, now: painted.at })}
        valueColor={toneText}
        isFirst={index === 0}
        closesCard={index === rows.length - 1 && !showMe}
        onOpenPerson={openPerson}
        style={isUpdating ? styles.dimmed : null}
      />
    ),
    [category, filters.tab, isUpdating, kind, openPerson, painted.at, rows.length, scopeLevel, showMe, t, toneText]
  );

  const emptyCard = (
    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <ThemedText style={styles.emptyTitle} setColor={theme.title}>
        {friendsOnly ? t("category.empty.friendsTitle") : t("category.empty.title")}
      </ThemedText>
      <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
        {`${t(emptyBodyKey(category, filters), RULE_PARAMS)} ${t(
          scopeLevel === "gym" ? "category.empty.membersGym" : "category.empty.members",
          RULE_PARAMS
        )}`}
      </ThemedText>
    </View>
  );

  let body = null;

  if (showErrorBlock) {
    body = (
      <View style={[styles.stateCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <ThemedStateBlock
          variant="error"
          title={t("category.errors.title")}
          message={currentFailure.message}
          actionLabel={t("common.retry")}
          onAction={() => load()}
        />
      </View>
    );
  } else if (showSkeleton) {
    body =
      category === "fremgang" ? (
        <View style={styles.stack}>
          <PersonalCard variant="progress" tab={filters.tab} tone={tone} valueColor={toneText} loading />
          <CategorySkeleton podium={false} />
        </View>
      ) : (
        <CategorySkeleton />
      );
  } else if (isUnavailable) {
    body = (
      <View style={[styles.stateCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <ThemedStateBlock
          variant="empty"
          title={t("category.unavailable.title")}
          message={t("category.unavailable.body")}
        />
      </View>
    );
  } else if (category === "fremgang") {
    body = (
      <View style={styles.stack}>
        <PersonalCard
          variant="progress"
          me={me}
          tab={filters.tab}
          tone={tone}
          valueColor={toneText}
          style={isUpdating ? styles.dimmed : null}
        />
        {hasPeople ? null : emptyCard}
      </View>
    );
  } else if (!hasPeople) {
    body = emptyCard;
  } else {
    body = (
      <CategoryPodium
        rows={podium}
        kind={kind}
        tone={tone}
        valueColor={toneText}
        onOpenPerson={openPerson}
        style={isUpdating ? styles.dimmed : null}
      />
    );
  }

  let meCard = null;

  if (showMe) {
    meCard =
      meMode === "row" ? (
        <MyRankCard mode="row" me={me} kind={kind} subtitle={meSubtitle({ category, tab: filters.tab, me, t })} />
      ) : meMode === "notInFilter" ? (
        <MyRankCard
          mode="notInFilter"
          message={t("category.notInFilter", { filter: activeFilterLabel({ gender, filters, t }) })}
        />
      ) : meMode === "noValue" ? (
        <MyRankCard
          mode="noValue"
          message={t("category.me.noValueTitle")}
          detail={t(emptyBodyKey(category, filters), RULE_PARAMS)}
        />
      ) : (
        <MyRankCard
          mode="notMember"
          message={t("category.me.notOnListTitle")}
          detail={t(
            scopeLevel === "gym" ? "category.me.notOnListBodyGym" : "category.me.notOnListBody",
            RULE_PARAMS
          )}
        />
      );
  }

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, showMe ? styles.listContentPinned : null]}
        showsVerticalScrollIndicator={false}
        data={rows}
        keyExtractor={(row, index) => String(row?.person?.id ?? `rank-${row?.rank ?? "none"}-${index}`)}
        renderItem={renderRow}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load({ pull: true })}
            tintColor={theme.primaryText}
            colors={[theme.primary]}
            progressBackgroundColor={theme.cardBackground}
          />
        }
        ListHeaderComponent={
          <View style={[styles.listHeader, rows.length > 0 ? styles.listHeaderSpaced : null]}>
            {/* In the list, not over it: with a three-line explanation a
                fixed bar would take a small phone's list away. */}
            <CategoryTopBar
              place={placeLabel}
              title={t(categoryNameKey(category))}
              explanation={t(explanationKey(category, filters), RULE_PARAMS)}
              titleColor={toneText}
              onBack={goBack}
            />

            <GenderSegment value={gender} onChange={setGender} />

            {category === "calisthenics" && (showSkeleton || showBoard) ? (
              <PersonalCard
                variant="points"
                me={me}
                tone={tone}
                valueColor={toneText}
                loading={showSkeleton}
                style={isUpdating ? styles.dimmed : null}
              />
            ) : null}

            <CategoryFilters
              category={category}
              gender={gender}
              filters={filters}
              tone={tone}
              onChange={updateFilters}
            />

            {showErrorBanner ? (
              <View style={[styles.banner, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <ThemedText style={styles.bannerText} setColor={theme.mutedStrong} numberOfLines={2}>
                  {t("category.errors.refreshFailed")}
                </ThemedText>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  hitSlop={8}
                  onPress={() => load({ pull: true })}
                >
                  <ThemedText style={styles.bannerAction} setColor={theme.primaryText}>
                    {t("common.retry")}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}

            {body}
          </View>
        }
        ListFooterComponent={
          <>
            {showMe && rows.length > 0 ? <ListGapRow /> : null}
            {showMe && rows.length === 0 && podium.length > 0 ? <ListGapRow standalone /> : null}
            {category === "powerlifting" && (showBoard || isUnavailable) ? (
              <LiftLinks atGym={scopeLevel === "gym"} onOpen={openLift} />
            ) : null}
          </>
        }
      />

      {meCard ? (
        <View style={[styles.pinned, isUpdating ? styles.dimmed : null]} pointerEvents="box-none">
          {meCard}
        </View>
      ) : null}
    </ThemedView>
  );
}
