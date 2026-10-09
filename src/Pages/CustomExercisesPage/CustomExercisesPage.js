import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import styles from "./CustomExercisesPageStyle";
import ExerciseListRow, { ExerciseListRowSkeleton } from "./Components/ExerciseListRow";
import MuscleFilterSheet from "./Components/MuscleFilterSheet";
import SortSheet from "./Components/SortSheet";
import { exerciseService } from "@services";
import ChangeGymSheet from "@resources/Components/ChangeGymSheet/ChangeGymSheet";
import { showToast } from "@resources/Components/Toast/Toast";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import Bookmark from "@resources/Icons/UI-icons/Bookmark";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Cross from "@resources/Icons/UI-icons/Cross";
import Filter from "@resources/Icons/UI-icons/Filter";
import Library from "@resources/Icons/UI-icons/Library";
import Lock from "@resources/Icons/UI-icons/Lock";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Play from "@resources/Icons/UI-icons/Play";
import Plus from "@resources/Icons/UI-icons/Plus";
import Reorder from "@resources/Icons/UI-icons/Reorder";
import Search from "@resources/Icons/UI-icons/Search";
import Social from "@resources/Icons/UI-icons/Social";
import { ThemedStateBlock, ThemedText, ThemedView } from "@resources/ThemedComponents";
import {
  CUSTOM_EXERCISE_PAGE_SIZE,
  CUSTOM_EXERCISE_SORTS,
  normalizeCustomExerciseSort,
  sortLabelKey,
} from "@utils/customExercises";
import { EXERCISE_MUSCLE_GROUPS, muscleGroupLabel } from "@utils/exerciseMuscleGroups";

const SEARCH_DEBOUNCE_MS = 250;
// Under two characters a search is no search: the whole library shows.
const MIN_QUERY_LENGTH = 2;
// Coming back to the page re-reads what is on screen in one request, up to
// 50 rows - the most the service hands out in one call; past that only the
// rows it saw are updated.
const MAX_QUIET_REFRESH = 50;
const SKELETON_ROWS = [0, 1, 2];
const MUSCLE_KEYS = new Set(EXERCISE_MUSCLE_GROUPS.map((group) => group.key));
// The sorts that show everything in the library: nothing under them means
// nothing has been shared, not that the filter found nothing.
const WHOLE_LIBRARY_SORTS = new Set(["popular", "newest", "gym"]);
// 30 and 36 dp controls, reached from 44.
const CHIP_HIT_SLOP = { top: 7, bottom: 7, left: 0, right: 0 };
const CONTROL_HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };
// "Reset filter" is a line of 10.5 text: 14 dp tall on its own.
const RESET_HIT_SLOP = { top: 15, bottom: 15, left: 12, right: 12 };
const INITIAL_LIST = { status: "loading", items: [], nextCursor: null, total: null, error: null };

// What the library held the last time the page looked. A second visit to an
// empty library then does not first draw a search and a sort over nothing.
let lastLibraryTotal = null;

function normalizeMuscleGroup(value) {
  return typeof value === "string" && MUSCLE_KEYS.has(value) ? value : null;
}

function toQuery(text) {
  const trimmed = String(text ?? "").trim();

  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : "";
}

function uniqueItems(items) {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || item.id === null || item.id === undefined || seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

/**
 * The list after a refresh of its first rows. When the refresh covered
 * everything on screen, it replaces the list. When it saw fewer rows than are
 * showing - the server caps a page, or more than MAX_QUIET_REFRESH are loaded
 * - the rows it saw are updated where they stand, and the rest and the place
 * to continue from are kept, so coming back does not drop you to the top.
 */
function mergeRefresh(previous, page, replace) {
  const fresh = uniqueItems(page?.items);
  const nextCursor = page?.nextCursor ?? null;
  const total = typeof page?.total === "number" ? page.total : previous.total;

  if (replace || nextCursor === null || fresh.length >= previous.items.length) {
    return { status: "ready", items: fresh, nextCursor, total, error: null };
  }

  const byId = new Map(fresh.map((item) => [item.id, item]));

  return { ...previous, items: previous.items.map((item) => byId.get(item.id) ?? item), total };
}

// The sort button's caret: Colapse.js's curve, turned to point down.
function Caret({ color }) {
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 9s4.419 6 6 6c1.581 0 6-6 6-6" />
    </Svg>
  );
}

/**
 * Explore's library of exercises people have made and shared (1a): a search,
 * a sort that is also six chips, a muscle group filter, and the rows.
 *
 * Route params `sort` and `muscleGroup` set where it starts. It pages 30 at a
 * time, refreshes on a pull, and quietly when it is looked at again or an
 * exercise is added, saved or shared anywhere - so a row you just added
 * carries its check when you come back.
 *
 * There are few shared exercises yet, so the empty library is designed as
 * the first thing most people see, and a short list ends in an invitation.
 */
export default function CustomExercisesPage({ route }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const isFocused = useIsFocused();
  const { animate, reduceMotion } = useAnimationsEnabled();

  const routeSort = route?.params?.sort;
  const routeMuscleGroup = route?.params?.muscleGroup;
  const [sort, setSort] = useState(() => normalizeCustomExerciseSort(routeSort));
  const [muscleGroup, setMuscleGroup] = useState(() => normalizeMuscleGroup(routeMuscleGroup));
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState(INITIAL_LIST);
  // Facts about the whole library, not the filters: they survive a change of
  // filter, so the search's "Search 12 exercises" does not blink while it loads.
  const [library, setLibrary] = useState(() => ({
    libraryTotal: lastLibraryTotal,
    viewerHasGym: true,
    unavailable: false,
  }));
  const [moreState, setMoreState] = useState("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openSheet, setOpenSheet] = useState(null);

  // Read by the callbacks, so they stay the same functions and the focus
  // effect does not run again on every render.
  const filtersRef = useRef({ sort, muscleGroup, query });
  filtersRef.current = { sort, muscleGroup, query };
  const listRef = useRef(list);
  listRef.current = list;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  // Bumped whenever the list is replaced; whatever was started before that
  // answers into nothing.
  const versionRef = useRef(0);
  const moreRequestRef = useRef(null);
  const refreshRequestRef = useRef(null);
  const moreFailedRef = useRef(false);
  const mountedRef = useRef(true);
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setMore = useCallback((state) => {
    moreFailedRef.current = state === "failed";
    setMoreState(state);
  }, []);

  const applyLibrary = useCallback((page) => {
    const known = page?.unavailable ? 0 : typeof page?.libraryTotal === "number" ? page.libraryTotal : null;

    if (known !== null) {
      lastLibraryTotal = known;
    }

    setLibrary((previous) => ({
      libraryTotal: known ?? previous.libraryTotal,
      viewerHasGym: typeof page?.viewerHasGym === "boolean" ? page.viewerHasGym : previous.viewerHasGym,
      unavailable: Boolean(page?.unavailable),
    }));
  }, []);

  const fetchPage = useCallback(
    ({ cursor = null, limit = CUSTOM_EXERCISE_PAGE_SIZE } = {}) => {
      const filters = filtersRef.current;

      return exerciseService.getPublicCustomExercises({
        sort: filters.sort,
        muscleGroup: filters.muscleGroup,
        query: filters.query,
        cursor,
        limit,
      });
    },
    []
  );

  // The first page for the filters as they are now, over the skeleton.
  const loadFirstPage = useCallback(async () => {
    const version = ++versionRef.current;

    moreRequestRef.current = null;
    refreshRequestRef.current = null;
    setMore("idle");
    setList(INITIAL_LIST);

    try {
      const page = await fetchPage();

      if (!mountedRef.current || version !== versionRef.current) {
        return;
      }

      applyLibrary(page);
      setList({
        status: "ready",
        items: uniqueItems(page?.items),
        nextCursor: page?.nextCursor ?? null,
        total: typeof page?.total === "number" ? page.total : null,
        error: null,
      });
    } catch (error) {
      if (mountedRef.current && version === versionRef.current) {
        setList({ ...INITIAL_LIST, status: "error", error });
      }
    }
  }, [applyLibrary, fetchPage, setMore]);

  useEffect(() => {
    loadFirstPage();
  }, [sort, muscleGroup, query, loadFirstPage]);

  // Without the skeleton: the list stays while it is read again. A pull
  // starts from the top; anything else keeps what is loaded.
  const refresh = useCallback(
    async ({ pull = false } = {}) => {
      const current = listRef.current;

      if (current.status === "loading") {
        return;
      }

      if (current.status === "error") {
        await loadFirstPage();
        return;
      }

      if (refreshRequestRef.current && !pull) {
        return;
      }

      const version = versionRef.current;
      const token = {};
      const limit = pull
        ? CUSTOM_EXERCISE_PAGE_SIZE
        : Math.min(Math.max(current.items.length, CUSTOM_EXERCISE_PAGE_SIZE), MAX_QUIET_REFRESH);

      refreshRequestRef.current = token;

      if (pull) {
        setIsRefreshing(true);
      }

      try {
        const page = await fetchPage({ limit });

        if (!mountedRef.current || version !== versionRef.current || refreshRequestRef.current !== token) {
          return;
        }

        // The list is replaced: a next page still on its way belongs to the old one.
        versionRef.current += 1;
        moreRequestRef.current = null;
        setMore("idle");
        applyLibrary(page);
        setList((previous) => mergeRefresh(previous, page, pull));
      } catch (error) {
        console.warn("The exercise library could not refresh:", error);

        // Only a pull was asked for; the rest fail quietly over the list.
        if (pull && mountedRef.current) {
          showToast(error?.message || t("customExercises.library.refreshFailed"), { tone: "info" });
        }
      } finally {
        if (refreshRequestRef.current === token) {
          refreshRequestRef.current = null;
        }

        if (pull && mountedRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [applyLibrary, fetchPage, loadFirstPage, setMore, t]
  );

  const loadMore = useCallback(
    async ({ retry = false } = {}) => {
      const current = listRef.current;
      const cursor = current.nextCursor;

      if (current.status !== "ready" || !cursor || moreRequestRef.current || (moreFailedRef.current && !retry)) {
        return;
      }

      const version = versionRef.current;
      const token = { cursor };

      moreRequestRef.current = token;
      setMore("loading");

      try {
        const page = await fetchPage({ cursor });

        if (!mountedRef.current || version !== versionRef.current || moreRequestRef.current !== token) {
          return;
        }

        setList((previous) => {
          const seen = new Set(previous.items.map((item) => item.id));
          const next = page?.nextCursor ?? null;

          return {
            ...previous,
            items: [...previous.items, ...uniqueItems(page?.items).filter((item) => !seen.has(item.id))],
            // The same cursor again would ask for the same page forever.
            nextCursor: next === cursor ? null : next,
          };
        });
        setMore("idle");
      } catch (error) {
        if (mountedRef.current && version === versionRef.current && moreRequestRef.current === token) {
          console.warn("The next page of the exercise library could not load:", error);
          setMore("failed");
        }
      } finally {
        if (moreRequestRef.current === token) {
          moreRequestRef.current = null;
        }
      }
    },
    [fetchPage, setMore]
  );

  // Coming back - from the exercise you just added, say - reads the list
  // again underneath. The first focus is the first load, already running.
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return undefined;
      }

      refresh();
      return undefined;
    }, [refresh])
  );

  // An add, a save or a share anywhere. Off screen it waits for the focus.
  useEffect(() => {
    const unsubscribe = exerciseService.subscribeCustomExerciseChanges(() => {
      if (isFocusedRef.current) {
        refresh();
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [refresh]);

  // Explore opening the page again with other params.
  useEffect(() => {
    if (routeSort !== undefined) {
      setSort(normalizeCustomExerciseSort(routeSort));
    }
  }, [routeSort]);

  useEffect(() => {
    if (routeMuscleGroup !== undefined) {
      setMuscleGroup(normalizeMuscleGroup(routeMuscleGroup));
    }
  }, [routeMuscleGroup]);

  useEffect(() => {
    const next = toQuery(queryText);
    const timer = setTimeout(() => setQuery(next), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [queryText]);

  /* ------------------------------------------------------ chips in sync -- */

  const chipsRef = useRef(null);
  const chipLayoutsRef = useRef({});
  const chipsViewportRef = useRef({ x: 0, width: 0 });
  const sortRef = useRef(sort);
  sortRef.current = sort;

  // The chip for the chosen sort is kept in view, so choosing in the sheet
  // shows on the chips too.
  const revealChip = useCallback((animated) => {
    const layout = chipLayoutsRef.current[sortRef.current];
    const viewport = chipsViewportRef.current;

    if (!layout || !chipsRef.current || viewport.width <= 0) {
      return;
    }

    const edge = 20;
    let target = null;

    if (layout.x - edge < viewport.x) {
      target = layout.x - edge;
    } else if (layout.x + layout.width + edge > viewport.x + viewport.width) {
      target = layout.x + layout.width + edge - viewport.width;
    }

    if (target !== null) {
      chipsRef.current.scrollTo({ x: Math.max(0, target), animated });
    }
  }, []);

  useEffect(() => {
    revealChip(!reduceMotion);
  }, [reduceMotion, revealChip, sort]);

  /* ------------------------------------------------------------ actions -- */

  const chooseSort = useCallback((next) => {
    setSort(normalizeCustomExerciseSort(next));
    setOpenSheet(null);
  }, []);

  const chooseMuscleGroup = useCallback((next) => {
    setMuscleGroup(normalizeMuscleGroup(next));
    setOpenSheet(null);
  }, []);

  const clearSearch = useCallback(() => {
    setQueryText("");
    setQuery("");
  }, []);

  const resetFilters = useCallback(() => {
    setMuscleGroup(null);
    setQueryText("");
    setQuery("");
  }, []);

  const openExercise = useCallback(
    (item) => navigation.navigate("CustomExerciseDetailPage", { exerciseId: item.id }),
    [navigation]
  );

  const shareOne = useCallback(() => navigation.navigate("ExerciseCatalogPage"), [navigation]);

  const renderItem = useCallback(
    ({ item }) => <ExerciseListRow item={item} onPress={openExercise} style={styles.row} />,
    [openExercise]
  );

  /* -------------------------------------------------------------- state -- */

  const hasItems = list.items.length > 0;
  const isReady = list.status === "ready";
  const hasFilters = Boolean(muscleGroup) || query.length > 0;
  const groupLabel = muscleGroup ? muscleGroupLabel(muscleGroup, t) : null;
  const libraryTotal = library.libraryTotal;
  const libraryKnownEmpty = !hasItems && (library.unavailable || libraryTotal === 0);
  // Nothing shared yet: said once, as the page, instead of as an empty result.
  const showHero =
    isReady &&
    !hasItems &&
    (libraryKnownEmpty || (libraryTotal === null && !hasFilters && WHOLE_LIBRARY_SORTS.has(sort)));
  const showControls = !libraryKnownEmpty && !showHero;
  const showGymHint = showControls && sort === "gym" && library.viewerHasGym === false;
  const resultCount = list.total ?? (list.nextCursor ? null : list.items.length);
  const skeletonOpacity = useBreathAnimation(animate && list.status === "loading", {
    periodMs: 1800,
    low: 0.45,
  });

  const quiet = theme.quietText;
  const card = theme.cardBackground;
  const cardBorder = theme.cardBorder;

  /* ------------------------------------------------------------- header -- */

  const header = (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          hitSlop={4}
          onPress={() => navigation.goBack()}
          style={[styles.back, { backgroundColor: card, borderColor: cardBorder }]}
        >
          <ArrowLeft width={18} height={18} color={theme.title} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
            {t("explore.title")}
          </ThemedText>
          <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
            {t("explore.customExercises.title")}
          </ThemedText>
        </View>
      </View>

      {showControls ? (
        <>
          <View style={[styles.search, { backgroundColor: card, borderColor: cardBorder }]}>
            <Search width={19} height={19} color={quiet} />
            <TextInput
              value={queryText}
              onChangeText={setQueryText}
              onSubmitEditing={() => setQuery(toQuery(queryText))}
              placeholder={
                libraryTotal > 0
                  ? t("customExercises.library.searchPlaceholder", {
                      count: libraryTotal,
                      value: formatNumber(libraryTotal),
                    })
                  : t("customExercises.library.searchFallback")
              }
              placeholderTextColor={quiet}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={t("customExercises.library.searchFallback")}
              style={[styles.searchInput, { color: theme.title }]}
            />
            {queryText.length > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("customExercises.library.clearSearch")}
                hitSlop={4}
                onPress={clearSearch}
                style={styles.searchClear}
              >
                <Cross width={16} height={16} color={quiet} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel={t("customExercises.library.sortA11y", { sort: t(sortLabelKey(sort)) })}
              hitSlop={CONTROL_HIT_SLOP}
              onPress={() => setOpenSheet("sort")}
              style={[styles.sortButton, { backgroundColor: card, borderColor: cardBorder }]}
            >
              <Reorder width={15} height={15} color={quiet} />
              <ThemedText style={styles.sortEyebrow} setColor={quiet}>
                {t("customExercises.library.sortEyebrow")}
              </ThemedText>
              <ThemedText style={styles.sortValue} setColor={theme.title} numberOfLines={1}>
                {t(sortLabelKey(sort))}
              </ThemedText>
              <Caret color={quiet} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel={
                groupLabel
                  ? t("customExercises.library.filterA11y", { group: groupLabel })
                  : t("customExercises.library.filterNoneA11y")
              }
              hitSlop={CONTROL_HIT_SLOP}
              onPress={() => setOpenSheet("filter")}
              style={[
                styles.filterButton,
                groupLabel
                  ? {
                      backgroundColor: withAlpha(theme.primary, 0.12),
                      borderColor: withAlpha(theme.primary, 0.4),
                    }
                  : { backgroundColor: card, borderColor: cardBorder },
              ]}
            >
              <Filter width={15} height={15} color={groupLabel ? theme.primaryText : quiet} />
              <ThemedText
                style={styles.filterLabel}
                setColor={groupLabel ? theme.primaryText : quiet}
                numberOfLines={1}
              >
                {groupLabel ?? t("customExercises.library.filter")}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={chipsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            scrollEventThrottle={32}
            onScroll={(event) => {
              chipsViewportRef.current.x = event.nativeEvent.contentOffset.x;
            }}
            onLayout={(event) => {
              chipsViewportRef.current.width = event.nativeEvent.layout.width;
              revealChip(false);
            }}
          >
            {CUSTOM_EXERCISE_SORTS.map((value) => {
              const selected = value === sort;

              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.84}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  hitSlop={CHIP_HIT_SLOP}
                  onPress={() => chooseSort(value)}
                  onLayout={(event) => {
                    chipLayoutsRef.current[value] = event.nativeEvent.layout;

                    if (value === sortRef.current) {
                      revealChip(false);
                    }
                  }}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: card, borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    style={styles.chipText}
                    setColor={selected ? theme.textInverted : theme.mutedStrong}
                    numberOfLines={1}
                  >
                    {t(sortLabelKey(value))}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showGymHint ? (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${t("customExercises.library.chooseGym.title")}. ${t(
                "customExercises.library.chooseGym.body"
              )}`}
              onPress={() => setOpenSheet("gym")}
              style={[styles.hint, { backgroundColor: card, borderColor: withAlpha(theme.primary, isLight ? 0.4 : 0.32) }]}
            >
              <View style={[styles.hintIcon, { backgroundColor: withAlpha(theme.primary, isLight ? 0.12 : 0.14) }]}>
                <MapPin width={16} height={16} color={theme.primaryText} thickness={2} />
              </View>
              <View style={styles.hintCopy}>
                <ThemedText style={styles.hintTitle} setColor={theme.title} numberOfLines={1}>
                  {t("customExercises.library.chooseGym.title")}
                </ThemedText>
                <ThemedText style={styles.hintBody} setColor={quiet} numberOfLines={2}>
                  {t("customExercises.library.chooseGym.body")}
                </ThemedText>
              </View>
              <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
            </TouchableOpacity>
          ) : null}

          {isReady && hasItems ? (
            <View style={styles.result}>
              <ThemedText style={styles.resultCount} setColor={quiet} numberOfLines={1}>
                {resultCount === null
                  ? ""
                  : groupLabel
                    ? t("customExercises.library.resultCountInGroup", {
                        count: resultCount,
                        value: formatNumber(resultCount),
                        group: groupLabel,
                      })
                    : t("customExercises.library.resultCount", {
                        count: resultCount,
                        value: formatNumber(resultCount),
                      })}
              </ThemedText>
              {hasFilters ? (
                <TouchableOpacity accessibilityRole="button" hitSlop={RESET_HIT_SLOP} onPress={resetFilters}>
                  <ThemedText style={styles.resultReset} setColor={quiet}>
                    {t("customExercises.library.resetFilter")}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  /* -------------------------------------------------- the empty list -- */

  const emptyCard = ({ icon, iconTone, title, body, actionLabel, onAction }) => (
    <View style={[styles.empty, { backgroundColor: card, borderColor: cardBorder }]}>
      <View style={[styles.emptyIcon, { backgroundColor: withAlpha(iconTone, isLight ? 0.12 : 0.14) }]}>
        {icon}
      </View>
      <ThemedText style={styles.emptyTitle} setColor={theme.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.emptyBody} setColor={quiet}>
          {body}
        </ThemedText>
      ) : null}
      {actionLabel ? (
        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          hitSlop={CONTROL_HIT_SLOP}
          onPress={onAction}
          style={[styles.emptyAction, { backgroundColor: theme.chipBackground, borderColor: theme.border }]}
        >
          <ThemedText style={styles.emptyActionText} setColor={theme.title}>
            {actionLabel}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const hero = (
    <View style={[styles.hero, { backgroundColor: card, borderColor: cardBorder }]}>
      <View style={styles.heroArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[
          [styles.heroGhostLeft, theme.musclePull],
          [styles.heroGhostRight, theme.muscleLegs],
        ].map(([side, tone], index) => (
          <View
            key={index}
            style={[styles.heroGhost, side, { backgroundColor: theme.uiBackground, borderColor: cardBorder }]}
          >
            <View style={[styles.heroGhostMedia, { backgroundColor: withAlpha(tone, 0.2) }]} />
            <View style={[styles.heroGhostLine, { backgroundColor: theme.overlaySoft }]} />
            <View style={[styles.heroGhostLineShort, { backgroundColor: theme.overlaySoft }]} />
          </View>
        ))}
        <View style={[styles.heroTile, { backgroundColor: card }]}>
          <View
            style={[
              styles.heroTileInner,
              {
                backgroundColor: withAlpha(theme.music, isLight ? 0.12 : 0.14),
                borderColor: withAlpha(theme.music, isLight ? 0.28 : 0.32),
              },
            ]}
          >
            <Library width={32} height={32} color={theme.music} thickness={1.6} />
          </View>
        </View>
      </View>

      <ThemedText style={styles.heroTitle} setColor={theme.title} accessibilityRole="header">
        {t("customExercises.library.empty.title")}
      </ThemedText>
      <ThemedText style={styles.heroBody} setColor={quiet}>
        {t("customExercises.library.empty.body")}
      </ThemedText>

      <TouchableOpacity
        activeOpacity={0.86}
        accessibilityRole="button"
        onPress={shareOne}
        style={[styles.heroCta, { backgroundColor: theme.primary }]}
      >
        <Plus width={17} height={17} color={theme.textInverted} thickness={2.4} />
        <ThemedText style={styles.heroCtaText} setColor={theme.textInverted} numberOfLines={1}>
          {t("customExercises.library.empty.cta")}
        </ThemedText>
      </TouchableOpacity>

      <View style={styles.heroNote}>
        <View style={styles.heroNoteIcon}>
          <Lock width={12} height={12} color={quiet} thickness={2} />
        </View>
        <ThemedText style={styles.heroNoteText} setColor={quiet}>
          {t("customExercises.library.empty.note")}
        </ThemedText>
      </View>
    </View>
  );

  const showPopular = () => chooseSort("popular");

  const noResults = () => {
    if (hasFilters) {
      return emptyCard({
        icon: <Search width={19} height={19} color={quiet} />,
        iconTone: quiet,
        title: query
          ? groupLabel
            ? t("customExercises.library.noResults.queryInGroup", { query, group: groupLabel })
            : t("customExercises.library.noResults.query", { query })
          : t("customExercises.library.noResults.group", { group: groupLabel ?? "" }),
        body: t("customExercises.library.noResults.body"),
        actionLabel: t("customExercises.library.resetFilter"),
        onAction: resetFilters,
      });
    }

    if (sort === "saved") {
      return emptyCard({
        icon: <Bookmark width={19} height={19} color={theme.primaryText} />,
        iconTone: theme.primary,
        title: t("customExercises.library.saved.title"),
        body: t("customExercises.library.saved.body"),
        actionLabel: t("customExercises.library.showPopular"),
        onAction: showPopular,
      });
    }

    if (sort === "following") {
      return emptyCard({
        icon: <Social width={20} height={20} color={theme.primaryText} thickness={1.6} />,
        iconTone: theme.primary,
        title: t("customExercises.library.following.title"),
        body: t("customExercises.library.following.body"),
        actionLabel: t("customExercises.library.showPopular"),
        onAction: showPopular,
      });
    }

    if (sort === "video") {
      return emptyCard({
        icon: <Play width={16} height={16} color={theme.primaryText} />,
        iconTone: theme.primary,
        title: t("customExercises.library.video.title"),
        body: t("customExercises.library.video.body"),
        actionLabel: t("customExercises.library.showPopular"),
        onAction: showPopular,
      });
    }

    return emptyCard({
      icon: <Library width={19} height={19} color={theme.music} thickness={1.6} />,
      iconTone: theme.music,
      title: t("customExercises.library.nothing.title"),
      body: t("customExercises.library.nothing.body"),
      actionLabel: t("common.retry"),
      onAction: loadFirstPage,
    });
  };

  let listEmpty = null;

  if (list.status === "loading") {
    listEmpty = (
      <View
        style={styles.skeleton}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("common.loading")}
      >
        {SKELETON_ROWS.map((row) => (
          <ExerciseListRowSkeleton key={row} opacity={skeletonOpacity} style={styles.row} />
        ))}
      </View>
    );
  } else if (list.status === "error") {
    listEmpty = (
      <ThemedStateBlock
        variant="error"
        title={t("customExercises.library.loadFailed")}
        message={list.error?.message || t("customExercises.library.loadFailedBody")}
        actionLabel={t("common.retry")}
        onAction={loadFirstPage}
      />
    );
  } else if (showHero) {
    listEmpty = hero;
  } else {
    listEmpty = noResults();
  }

  /* ------------------------------------------------------------- footer -- */

  let footer = null;

  if (hasItems && moreState === "loading") {
    footer = <ActivityIndicator style={styles.footerSpinner} color={theme.primaryText} />;
  } else if (hasItems && moreState === "failed") {
    footer = (
      <View style={styles.moreFailed}>
        <ThemedText style={styles.moreFailedText} setColor={quiet}>
          {t("customExercises.library.loadMoreFailed")}
        </ThemedText>
        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => loadMore({ retry: true })}
          style={[styles.moreRetry, { backgroundColor: theme.chipBackground, borderColor: theme.border }]}
        >
          <ThemedText style={styles.moreRetryText} setColor={theme.title}>
            {t("common.retry")}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  } else if (hasItems && isReady && !list.nextCursor) {
    // The end of the list, however short: the way to add to it.
    footer = (
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${t("customExercises.library.invite.title")} ${t("customExercises.library.invite.action")}`}
        onPress={shareOne}
        style={[styles.invite, { borderColor: theme.chevron }]}
      >
        <View style={[styles.inviteIcon, { backgroundColor: withAlpha(theme.music, isLight ? 0.12 : 0.14) }]}>
          <Plus width={18} height={18} color={theme.music} thickness={2.2} />
        </View>
        <View style={styles.inviteCopy}>
          <ThemedText style={styles.inviteTitle} setColor={theme.title}>
            {t("customExercises.library.invite.title")}
          </ThemedText>
          <ThemedText style={styles.inviteAction} setColor={theme.primaryText}>
            {t("customExercises.library.invite.action")}
          </ThemedText>
        </View>
        <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
      </TouchableOpacity>
    );
  }

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={list.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={footer}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refresh({ pull: true })}
            tintColor={theme.primaryText}
            colors={[theme.primary]}
            progressBackgroundColor={card}
          />
        }
      />

      <SortSheet
        visible={openSheet === "sort"}
        value={sort}
        onSelect={chooseSort}
        onClose={() => setOpenSheet(null)}
      />

      <MuscleFilterSheet
        visible={openSheet === "filter"}
        value={muscleGroup}
        onSelect={chooseMuscleGroup}
        onClose={() => setOpenSheet(null)}
      />

      {/* "In your centre" without a centre: choose one right here. */}
      <ChangeGymSheet
        visible={openSheet === "gym"}
        onClose={() => setOpenSheet(null)}
        currentHomeGymId={null}
        isAutomatic={false}
        onChanged={loadFirstPage}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
