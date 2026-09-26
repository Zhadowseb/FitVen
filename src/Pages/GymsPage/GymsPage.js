import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./GymsPageStyle";
import { HeaderSkeleton, RowsSkeleton } from "./Components/GymsSkeleton";
import LevelRow, { CountryTile, GymTile, RegionTile } from "./Components/LevelRow";
import YourCentreCard from "./Components/YourCentreCard";
import { categoryLeaderboardService, gymService } from "@services";
import CategoryCard from "@resources/Components/CategoryCard/CategoryCard";
import CategoryCardSkeleton from "@resources/Components/CategoryCard/CategoryCardSkeleton";
import GenderSegment, { getSessionGender } from "@resources/Components/GenderSegment/GenderSegment";
import ScopeBreadcrumbs from "@resources/Components/ScopeBreadcrumbs/ScopeBreadcrumbs";
import {
  countryName,
  countryWhere,
  regionWhere,
} from "@resources/Components/ScopeBreadcrumbs/scopeNames";
import { openScopeLevel } from "@resources/Components/ScopeBreadcrumbs/scopeNavigation";
import { useGymSearch } from "@resources/Components/useGymSearch";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import Globe from "@resources/Icons/UI-icons/Globe";
import Search from "@resources/Icons/UI-icons/Search";
import { ThemedStateBlock, ThemedText, ThemedView } from "@resources/ThemedComponents";
import { DEFAULT_COUNTRY, normalizeScope, scopeKey } from "@utils/gymCategories";

const WORLD = { level: "world" };
const IDLE = { status: "idle", data: null, error: "" };
// A 36 dp button, 44 dp to the finger.
const BACK_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

function errorText(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Screens 4b, 4a and 4c: centres by all countries, one country and one
 * region - one screen, the level in its `scope` param, and every level below
 * pushed on top so back goes one level up.
 *
 * Without a scope, which is how Explore and Home open it, it first finds the
 * country to show: the one the phone is in, else the one your centre is in,
 * else Denmark - or all countries, when that country has no lifts on the list.
 * The level it lands on goes into its own params, so from there it is a level
 * like any other.
 *
 * Every level: search inside it, your centre, where you are, and All / Men /
 * Women over the four categories. Then the regions of a country, or the
 * centres of a region, most lifters first. All countries is only the list.
 */
export default function GymsPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const params = route.params ?? {};
  const scopeParam = params.scope ?? null;
  // One string per level, so a new params object naming the same level is not
  // a new level and does not load it again.
  const levelKey = scopeParam ? scopeKey(scopeParam) : null;
  const scope = useMemo(() => (scopeParam ? normalizeScope(scopeParam) : null), [levelKey]);
  const level = scope?.level ?? null;
  const isWorld = level === "world";
  const hasCategories = level === "country" || level === "region";
  const fromLocation = Boolean(params.fromLocation);
  const locationCountry = typeof params.locationCountry === "string" ? params.locationCountry : null;

  const [gender, setGender] = useState(getSessionGender);
  const [summary, setSummary] = useState(IDLE);
  const [cards, setCards] = useState(IDLE);
  const [homeGym, setHomeGym] = useState(null);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const searchInLevel = useCallback(
    (text) => categoryLeaderboardService.searchGyms({ query: text, scope: scope ?? WORLD }),
    [scope]
  );
  const { results: searchResults, isSearching } = useGymSearch(query, setSearchError, {
    search: searchInLevel,
    searchKey: levelKey ?? "start",
  });
  const surface = { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder };

  /* ------------------------------------------------------ where to open -- */

  // All countries fetched to decide where to open is handed to the level
  // when that is where it opens, rather than asked for twice.
  const primedSummaryRef = useRef(null);

  useEffect(() => {
    if (scopeParam) {
      return undefined;
    }

    let isCancelled = false;

    (async () => {
      const [start, world] = await Promise.all([
        categoryLeaderboardService.resolveStartCountry().catch(() => null),
        categoryLeaderboardService.getScopeSummary({ scope: WORLD }).catch(() => null),
      ]);

      if (isCancelled) {
        return;
      }

      const country = start?.country ?? DEFAULT_COUNTRY;
      const fromPhone = Boolean(start?.fromLocation);
      const isListed = (world?.countries ?? []).some((entry) => entry.code === country);

      // Without the list - not set up yet, or it failed - the country is the
      // better guess: it says so itself, and search still works there.
      if (!world || world.unavailable || isListed) {
        navigation.setParams({
          scope: { level: "country", country },
          fromLocation: fromPhone,
          locationCountry: fromPhone ? country : null,
        });
      } else {
        primedSummaryRef.current = { key: scopeKey(WORLD), data: world };
        navigation.setParams({
          scope: WORLD,
          fromLocation: false,
          locationCountry: fromPhone ? country : null,
        });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [navigation, scopeParam]);

  /* -------------------------------------------------------------- loads -- */

  // Only the newest answer may write: a slow one for the gender before must
  // not land over the one for the gender chosen now.
  const summaryRequestRef = useRef(0);
  const cardsRequestRef = useRef(0);

  const loadSummary = useCallback(async () => {
    if (!scope) {
      return;
    }

    summaryRequestRef.current += 1;

    const request = summaryRequestRef.current;
    const primed = primedSummaryRef.current;

    if (primed && primed.key === levelKey) {
      primedSummaryRef.current = null;
      setSummary({ status: "ready", data: primed.data, error: "" });
      return;
    }

    setSummary({ status: "loading", data: null, error: "" });

    try {
      const data = await categoryLeaderboardService.getScopeSummary({ scope });

      if (request === summaryRequestRef.current) {
        setSummary({ status: "ready", data: data ?? null, error: "" });
      }
    } catch (error) {
      if (request === summaryRequestRef.current) {
        setSummary({ status: "error", data: null, error: errorText(error, t("gyms.levels.loadFailed")) });
      }
    }
  }, [levelKey, scope, t]);

  const loadCards = useCallback(
    async ({ silent = false } = {}) => {
      if (!scope || !hasCategories) {
        return;
      }

      cardsRequestRef.current += 1;

      const request = cardsRequestRef.current;

      // The cards already up stay up, dimmed, until the new ones are in, so a
      // gender change does not make the page jump.
      if (!silent) {
        setCards((current) => ({ status: "loading", data: current.data, error: "" }));
      }

      try {
        const data = await categoryLeaderboardService.getCategoryCards({ scope, gender });

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
    [gender, hasCategories, scope, t]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Back on this screen: the gender may have been changed on a category page,
  // and your centre in its sheet. The first focus is the loads above.
  const hasFocusedRef = useRef(false);
  const latestRef = useRef({});

  latestRef.current = { gender, loadCards };

  useFocusEffect(
    useCallback(() => {
      gymService
        .getMyHomeGym()
        .then(setHomeGym)
        .catch(() => {
          // A shortcut; the level is whole without it.
        });

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

  /* -------------------------------------------------------------- names -- */

  const data = summary.data;
  const countryCode = scope?.country ?? null;
  const countryLabel = countryCode ? countryName(t, countryCode) : null;
  const region =
    level === "region"
      ? {
          key: scope.region,
          name: data?.region?.name ?? params.regionName ?? null,
          where: data?.region?.where ?? null,
        }
      : null;
  const where =
    level === "region" ? regionWhere(t, region) : countryCode ? countryWhere(t, countryCode) : null;
  const levelTitle = level === "region" ? region.name : countryLabel;
  const levelGymCount = level === "region" ? data?.region?.gymCount : data?.country?.gymCount;
  const centreCount = (count) =>
    t("gyms.counts.centres", { count: Number(count) || 0, value: formatNumber(Number(count) || 0) });
  const countsLine = (gymCount, lifterCount) =>
    [
      gymCount === null || gymCount === undefined ? null : centreCount(gymCount),
      lifterCount === null || lifterCount === undefined
        ? null
        : t("gyms.counts.lifters", { count: Number(lifterCount) || 0, value: formatNumber(Number(lifterCount) || 0) }),
    ]
      .filter(Boolean)
      .join(" · ");
  const subtitle =
    level === "country" && fromLocation
      ? t("gyms.fromLocation")
      : levelGymCount === null || levelGymCount === undefined
        ? null
        : centreCount(levelGymCount);
  const isUnavailable = Boolean(data?.unavailable) || Boolean(cards.data?.unavailable);
  const searchPlaceholder =
    level === "region" && where ? t("gyms.searchIn", { where }) : t("gyms.search");

  /* --------------------------------------------------------- navigation -- */

  const openGym = (gym) => navigation.navigate("GymLeaderboardPage", { gym_id: gym.id });

  const openCountry = (code) =>
    navigation.push("GymsPage", { scope: { level: "country", country: code }, locationCountry });

  const openRegion = (entry) =>
    navigation.push("GymsPage", {
      scope: { level: "region", country: countryCode, region: entry.key },
      regionName: entry.name ?? null,
      locationCountry,
    });

  // The level's name goes along, so the category page can say where it is
  // before it has asked anything.
  const openCategory = (category) =>
    navigation.navigate("CategoryLeaderboardPage", { category, scope, gender, scopeName: levelTitle });

  const crumbs = hasCategories
    ? [
        {
          key: "world",
          label: t("gyms.allCountries"),
          onPress: () => openScopeLevel(navigation, WORLD, { locationCountry }),
        },
        {
          key: "country",
          label: countryLabel,
          onPress:
            level === "region"
              ? () => openScopeLevel(navigation, { level: "country", country: countryCode }, { locationCountry })
              : undefined,
        },
        ...(level === "region" ? [{ key: "region", label: region.name }] : []),
      ]
    : [];

  /* ------------------------------------------------------------ pieces -- */

  const sectionHead = (label, hint = null) => (
    <View style={styles.sectionRow}>
      <ThemedText style={styles.sectionLabel} setColor={theme.quietText} numberOfLines={1}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText style={styles.sectionHint} setColor={theme.quietText} numberOfLines={1}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );

  const emptyLine = (title, body = null) => (
    <View style={styles.emptyLine}>
      <ThemedText style={styles.emptyTitle} setColor={theme.title}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
          {body}
        </ThemedText>
      ) : null}
    </View>
  );

  const loadError = (message, onRetry) => (
    <ThemedStateBlock
      variant="error"
      style={styles.stateBlock}
      title={t("gyms.levels.unavailableTitle")}
      message={message}
      actionLabel={t("common.retry")}
      onAction={onRetry}
    />
  );

  // Before the migration: nothing to rank by and no regions yet. Search and
  // your centre above still work, so the page says only what is missing.
  const notYet = (
    <View style={[styles.notice, surface]}>
      <ThemedText style={styles.noticeTitle} setColor={theme.title}>
        {t("gyms.levels.notYetTitle")}
      </ThemedText>
      <ThemedText style={styles.noticeBody} setColor={theme.quietText}>
        {t("gyms.levels.notYetBody")}
      </ThemedText>
    </View>
  );

  const renderResults = () => (
    <View style={styles.section}>
      {sectionHead(t("gyms.results.title"), t("gyms.results.count", { count: searchResults.length }))}
      <View style={[styles.listCard, surface]}>
        {searchError
          ? emptyLine(t("gyms.searchFailed"), searchError === t("gyms.searchFailed") ? null : searchError)
          : searchResults.length === 0
            ? emptyLine(t("gyms.results.noMatchTitle"), t("gyms.results.noMatchBody"))
            : searchResults.map((gym, index) => (
                <LevelRow
                  key={gym.id}
                  tile={<GymTile imageUrl={gym.imageUrl} chain={gym.chain} />}
                  title={gym.shortName ?? gym.name}
                  meta={[gym.chain, gym.city].filter(Boolean).join(" · ")}
                  onPress={() => openGym(gym)}
                  divider={index < searchResults.length - 1}
                />
              ))}
      </View>
    </View>
  );

  const renderCards = () => {
    if (cards.status === "error") {
      return (
        <View style={[styles.notice, surface]}>
          <ThemedText style={styles.noticeTitle} setColor={theme.title}>
            {t("gyms.levels.cardsFailed")}
          </ThemedText>
          {cards.error && cards.error !== t("gyms.levels.cardsFailed") ? (
            <ThemedText style={styles.noticeBody} setColor={theme.quietText}>
              {cards.error}
            </ThemedText>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={8}
            onPress={() => loadCards()}
            style={styles.retry}
          >
            <ThemedText style={styles.retryText} setColor={theme.primaryText}>
              {t("common.retry")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (!cards.data) {
      return <CategoryCardSkeleton />;
    }

    const list = cards.data.cards ?? [];

    return list.length ? (
      <View style={[styles.cards, cards.status === "loading" ? styles.refreshing : null]}>
        {list.map((card) => (
          <CategoryCard
            key={card.category}
            card={card}
            levelLabel={levelTitle}
            where={where}
            variant="level"
            onPress={() => openCategory(card.category)}
          />
        ))}
      </View>
    ) : null;
  };

  const renderRegions = () => {
    if (summary.status === "error") {
      return loadError(summary.error, loadSummary);
    }

    if (summary.status !== "ready") {
      return <RowsSkeleton count={4} />;
    }

    const regions = data?.regions ?? [];

    return (
      <View style={styles.section}>
        {sectionHead(
          t("gyms.regionsIn", { where }),
          data?.country?.gymCount === null || data?.country?.gymCount === undefined
            ? null
            : centreCount(data.country.gymCount)
        )}
        <View style={[styles.listCard, surface]}>
          {regions.length === 0
            ? emptyLine(t("gyms.levels.noRegions"))
            : regions.map((entry, index) => (
                <LevelRow
                  key={entry.key}
                  tile={<RegionTile name={entry.name ?? entry.key} />}
                  title={entry.name ?? entry.key}
                  meta={countsLine(entry.gymCount, entry.lifterCount)}
                  onPress={() => openRegion(entry)}
                  divider={index < regions.length - 1}
                  regionDivider
                />
              ))}
        </View>
      </View>
    );
  };

  const renderGyms = () => {
    if (summary.status === "error") {
      return loadError(summary.error, loadSummary);
    }

    if (summary.status !== "ready") {
      return <RowsSkeleton count={5} />;
    }

    const gyms = data?.gyms ?? [];

    return (
      <View style={styles.section}>
        {sectionHead(t("gyms.gymsIn", { where }))}
        <View style={[styles.listCard, surface]}>
          {gyms.length === 0
            ? emptyLine(t("gyms.levels.noGyms", { where }))
            : gyms.map((gym, index) => (
                <LevelRow
                  key={gym.id}
                  tile={<GymTile imageUrl={gym.imageUrl} chain={gym.chain} />}
                  title={gym.shortName ?? gym.name}
                  meta={[gym.city, countsLine(null, gym.lifterCount)].filter(Boolean).join(" · ")}
                  onPress={() => openGym(gym)}
                  divider={index < gyms.length - 1}
                />
              ))}
        </View>
      </View>
    );
  };

  const renderWorld = () => {
    if (summary.status === "error") {
      return loadError(summary.error, loadSummary);
    }

    if (summary.status !== "ready") {
      return <RowsSkeleton count={5} />;
    }

    if (data?.unavailable) {
      return notYet;
    }

    const countries = data?.countries ?? [];
    // Where the phone is, else the country the server calls yours. A country
    // with no lifts is not on the list, and says so rather than opening empty.
    const located = locationCountry
      ? countries.find((entry) => entry.code === locationCountry) ?? { code: locationCountry, isUnlisted: true }
      : null;
    const yours = located ?? countries.find((entry) => entry.isYours) ?? null;

    return (
      <>
        {yours ? (
          <View style={styles.section}>
            {sectionHead(t("gyms.location.title"))}
            <View style={[styles.listCard, surface]}>
              <LevelRow
                tile={<CountryTile code={yours.code} isYours />}
                title={countryName(t, yours.code)}
                meta={yours.isUnlisted ? t("gyms.location.noLifts") : countsLine(yours.gymCount, yours.lifterCount)}
                onPress={yours.isUnlisted ? undefined : () => openCountry(yours.code)}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          {sectionHead(t("gyms.countriesWithLifts"))}
          <View style={[styles.listCard, surface]}>
            {countries.length === 0
              ? emptyLine(t("gyms.levels.noCountries"))
              : countries.map((entry, index) => (
                  <LevelRow
                    key={entry.code}
                    tile={<CountryTile code={entry.code} isYours={Boolean(entry.isYours) || entry.code === yours?.code} />}
                    title={countryName(t, entry.code)}
                    meta={countsLine(entry.gymCount, entry.lifterCount)}
                    onPress={() => openCountry(entry.code)}
                    divider={index < countries.length - 1}
                  />
                ))}
          </View>
          <ThemedText style={styles.footnote} setColor={theme.quietText}>
            {t("gyms.onlyWithLifts")}
          </ThemedText>
        </View>
      </>
    );
  };

  const renderLevel = () => {
    if (!scope) {
      // Finding the country to open on.
      return (
        <>
          <HeaderSkeleton />
          <CategoryCardSkeleton count={2} />
        </>
      );
    }

    if (isWorld) {
      return renderWorld();
    }

    return (
      <>
        {homeGym ? <YourCentreCard gym={homeGym} onPress={() => openGym(homeGym)} /> : null}

        {levelTitle ? (
          <View style={styles.levelHeader}>
            <ScopeBreadcrumbs items={crumbs} />
            <ThemedText style={styles.levelTitle} setColor={theme.title} numberOfLines={2} accessibilityRole="header">
              {levelTitle}
            </ThemedText>
            {subtitle ? (
              <ThemedText style={styles.levelSubtitle} setColor={theme.quietText} numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <HeaderSkeleton />
        )}

        {isUnavailable ? (
          notYet
        ) : summary.status === "error" && cards.status === "error" ? (
          // Nothing came back at all: one message and one retry, not two.
          loadError(summary.error, () => {
            loadSummary();
            loadCards();
          })
        ) : (
          <>
            <GenderSegment value={gender} onChange={setGender} />
            {renderCards()}
            {level === "country" ? renderRegions() : renderGyms()}
          </>
        )}
      </>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          activeOpacity={0.8}
          hitSlop={BACK_HIT_SLOP}
          onPress={() => navigation.goBack()}
          style={[styles.backButton, surface]}
        >
          <ArrowLeft width={20} height={20} color={theme.title} />
        </TouchableOpacity>
        <View style={styles.topCopy}>
          {/* Global in the cool blue, so it is plain that this is not your
              centre's page - a centre's own page has no eyebrow. */}
          <View style={styles.eyebrowRow}>
            <Globe width={11} height={11} color={theme.heatCool} thickness={2.4} />
            <ThemedText style={styles.eyebrow} setColor={theme.heatCool} numberOfLines={1}>
              {t("gyms.global")}
            </ThemedText>
          </View>
          <ThemedText style={styles.topTitle} setColor={theme.title} numberOfLines={1} accessibilityRole="header">
            {isWorld ? t("gyms.chooseCountry") : t("gyms.title")}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.searchField, surface]}>
          <Search width={17} height={17} color={theme.quietText} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSearchError("");
            }}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.quietText}
            style={[styles.searchInput, { color: theme.title }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("gyms.searchCentresA11y")}
          />
          {isSearching ? <ActivityIndicator size="small" color={theme.primaryText} /> : null}
        </View>

        {searchResults ? renderResults() : renderLevel()}
      </ScrollView>
    </ThemedView>
  );
}
