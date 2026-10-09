import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ExploreSearchPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { categoryLeaderboardService, gymService, socialService } from "@services";
import { regionWhere } from "@resources/Components/ScopeBreadcrumbs/scopeNames";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Cross from "@resources/Icons/UI-icons/Cross";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Search from "@resources/Icons/UI-icons/Search";
import { ThemedSegmentedControl, ThemedText, ThemedView, UserAvatar } from "@resources/ThemedComponents";

// Both services need two characters before they answer; so does the screen.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;
const GYM_LIMIT = 8;
const PEOPLE_LIMIT = 5;

// What the search looks through: both, or only one of the two.
const SCOPES = ["all", "gyms", "people"];
const PLACEHOLDER_KEYS = {
  all: "explore.search.placeholder.all",
  gyms: "explore.search.placeholder.gyms",
  people: "explore.search.placeholder.people",
};
const HINT_KEYS = {
  all: "explore.search.hint.all",
  gyms: "explore.search.hint.gyms",
  people: "explore.search.hint.people",
};

// The last choice, for the next time the search opens - within the session.
let lastScope = "all";

const NO_SUGGESTIONS = { status: "idle", yours: null, trainedIn: [], popular: [], region: null };

/**
 * Explore's search, full screen with the keyboard already up: centres and
 * people as you type - both, or only one of them, by the filter under the
 * field. A centre opens its page; a person opens their profile,
 * and "See everyone and follow" the people list on the same search, where the
 * follow buttons are. Programs and exercises join the search when they can be
 * found.
 *
 * Centres alone lists centres before anything is typed: yours, the others
 * you have trained in, then the busiest of your centre's region
 * (categoryLeaderboardService.getGymSuggestions). They are read the first time
 * Centres is chosen, not when the search opens: Both and People are for
 * finding somebody, and stay a hint until something is typed.
 */
export default function ExploreSearchPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(lastScope);
  const searchesGyms = scope !== "people";
  const searchesPeople = scope !== "gyms";
  const [gyms, setGyms] = useState([]);
  const [people, setPeople] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [suggestions, setSuggestions] = useState(NO_SUGGESTIONS);
  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const showsSuggestions = scope === "gyms" && !canSearch;
  // Once per visit: going to People and back, or typing and clearing, shows
  // the same centres again rather than asking for them again.
  const suggestionsAskedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showsSuggestions || suggestionsAskedRef.current) {
      return;
    }

    suggestionsAskedRef.current = true;
    setSuggestions((current) => ({ ...current, status: "loading" }));
    categoryLeaderboardService
      .getGymSuggestions()
      .then((found) => {
        if (isMountedRef.current) {
          setSuggestions({ status: "ready", ...found });
        }
      })
      .catch(() => {
        // It does not throw; should it, the hint is shown as before.
        if (isMountedRef.current) {
          setSuggestions({ ...NO_SUGGESTIONS, status: "ready" });
        }
      });
  }, [showsSuggestions]);

  useEffect(() => {
    if (!canSearch) {
      setGyms([]);
      setPeople([]);
      setIsSearching(false);
      setFailed(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);

      // Only what the filter asks for is searched at all.
      const [gymResult, peopleResult] = await Promise.allSettled([
        searchesGyms ? gymService.searchGyms({ query: trimmed, limit: GYM_LIMIT }) : Promise.resolve([]),
        searchesPeople && user?.id
          ? socialService.searchUsers({ query: trimmed, currentUserId: user.id, limit: PEOPLE_LIMIT + 1 })
          : Promise.resolve([]),
      ]);

      if (cancelled) {
        return;
      }

      setGyms(gymResult.status === "fulfilled" ? gymResult.value : []);
      setPeople(peopleResult.status === "fulfilled" ? peopleResult.value : []);
      setFailed(
        (!searchesGyms || gymResult.status === "rejected") &&
          (!searchesPeople || peopleResult.status === "rejected")
      );
      setIsSearching(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canSearch, searchesGyms, searchesPeople, trimmed, user?.id]);

  const changeScope = (next) => {
    if (!SCOPES.includes(next)) {
      return;
    }

    lastScope = next;
    setScope(next);
  };

  const quiet = theme.quietText;
  const title = theme.title;
  const card = theme.cardBackground;
  const cardBorder = theme.cardBorder;
  const openPeople = () => navigation.navigate("SocialUserListPage", { query: trimmed });
  const nothingFound = canSearch && !isSearching && !failed && gyms.length === 0 && people.length === 0;

  const sectionHead = (label) => (
    <ThemedText style={styles.sectionLabel} setColor={quiet}>
      {label}
    </ThemedText>
  );

  const openGym = (gym) => navigation.navigate("GymLeaderboardPage", { gym_id: gym.id });

  const renderGymRow = (gym, index, meta) => (
    <TouchableOpacity
      key={gym.id}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${gym.shortName ?? gym.name}, ${meta}` : gym.shortName ?? gym.name}
      onPress={() => openGym(gym)}
      style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: theme.hairline } : null]}
    >
      {gym.imageUrl ? (
        <Image source={{ uri: gym.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: theme.raisedSurface }]}>
          <MapPin width={16} height={16} color={quiet} thickness={2} />
        </View>
      )}
      <View style={styles.rowCopy}>
        <ThemedText style={styles.rowTitle} setColor={title} numberOfLines={1}>
          {gym.shortName ?? gym.name}
        </ThemedText>
        {meta ? (
          <ThemedText style={styles.rowMeta} setColor={quiet} numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
    </TouchableOpacity>
  );

  const gymSection = (key, label, list, metaFor) =>
    list.length > 0 ? (
      <View key={key} style={styles.section}>
        {sectionHead(label)}
        <View style={[styles.list, { backgroundColor: card, borderColor: cardBorder }]}>
          {list.map((gym, index) => renderGymRow(gym, index, metaFor(gym)))}
        </View>
      </View>
    ) : null;

  const placeLine = (gym) => [gym.chain, gym.city].filter(Boolean).join(" · ");
  const suggested = [
    ...(suggestions.yours ? [suggestions.yours] : []),
    ...suggestions.trainedIn,
    ...suggestions.popular,
  ];
  const busiestWhere = regionWhere(t, suggestions.region);

  // Centres, nothing typed: the suggestions, or the hint while there are none.
  const renderSuggestions = () => {
    if (suggestions.status !== "ready") {
      return <ActivityIndicator style={styles.spinner} color={theme.primaryText} />;
    }

    if (suggested.length === 0) {
      return (
        <ThemedText style={styles.hint} setColor={quiet}>
          {t(HINT_KEYS.gyms)}
        </ThemedText>
      );
    }

    return (
      <>
        {gymSection("yours", t("explore.search.suggestions.yours"), suggestions.yours ? [suggestions.yours] : [], placeLine)}
        {gymSection("trainedIn", t("explore.search.suggestions.trainedIn"), suggestions.trainedIn, (gym) =>
          [gym.chain, t("explore.search.suggestions.workouts", { count: Number(gym.workoutCount) || 0 })]
            .filter(Boolean)
            .join(" · ")
        )}
        {gymSection(
          "popular",
          busiestWhere
            ? t("explore.search.suggestions.busiestIn", { where: busiestWhere })
            : t("explore.search.suggestions.busiest"),
          suggestions.popular,
          (gym) =>
            [
              gym.city,
              t("gyms.counts.lifters", {
                count: Number(gym.lifterCount) || 0,
                value: formatNumber(Number(gym.lifterCount) || 0),
              }),
            ]
              .filter(Boolean)
              .join(" · ")
        )}
      </>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={styles.bar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <ArrowLeft width={22} height={22} color={title} />
        </TouchableOpacity>

        <View style={[styles.field, { backgroundColor: card, borderColor: cardBorder }]}>
          <Search width={19} height={19} color={quiet} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t(PLACEHOLDER_KEYS[scope])}
            placeholderTextColor={quiet}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t(PLACEHOLDER_KEYS[scope])}
            style={[styles.input, { color: title }]}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("explore.search.clear")}
              hitSlop={10}
              onPress={() => setQuery("")}
            >
              <Cross width={14} height={14} color={quiet} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.scope}>
        <ThemedSegmentedControl
          options={SCOPES.map((value) => ({ value, label: t(`explore.search.scope.${value}`) }))}
          value={scope}
          onChange={changeScope}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {showsSuggestions ? (
          renderSuggestions()
        ) : !canSearch ? (
          <ThemedText style={styles.hint} setColor={quiet}>
            {t(HINT_KEYS[scope])}
          </ThemedText>
        ) : null}

        {isSearching ? <ActivityIndicator style={styles.spinner} color={theme.primaryText} /> : null}

        {failed ? (
          <ThemedText style={styles.hint} setColor={theme.danger}>
            {t("explore.search.failed")}
          </ThemedText>
        ) : null}

        {nothingFound ? (
          <ThemedText style={styles.hint} setColor={quiet}>
            {t("explore.search.nothing", { query: trimmed })}
          </ThemedText>
        ) : null}

        {gymSection("results", t("explore.search.gyms"), gyms, (gym) => (gym.city ? placeLine(gym) : ""))}

        {people.length > 0 ? (
          <View style={styles.section}>
            {sectionHead(t("explore.search.people"))}
            <View style={[styles.list, { backgroundColor: card, borderColor: cardBorder }]}>
              {people.slice(0, PEOPLE_LIMIT).map((person, index) => (
                <TouchableOpacity
                  key={person.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityHint={t("publicProfile.opensProfile")}
                  onPress={() => navigation.navigate("PublicProfilePage", { userId: person.id })}
                  style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: theme.hairline } : null]}
                >
                  <UserAvatar uri={person.avatarUrl} size={36} iconSize={16} />
                  <View style={styles.rowCopy}>
                    <ThemedText style={styles.rowTitle} setColor={title} numberOfLines={1}>
                      {person.displayName || person.username}
                    </ThemedText>
                    <ThemedText style={styles.rowMeta} setColor={quiet} numberOfLines={1}>
                      {person.isFollowing
                        ? t("explore.search.following")
                        : person.username
                          ? `@${person.username}`
                          : ""}
                    </ThemedText>
                  </View>
                  <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={openPeople}
                style={[styles.more, { borderTopColor: theme.hairline }]}
              >
                <ThemedText style={styles.moreText} setColor={theme.primaryText}>
                  {t("explore.search.allPeople")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
