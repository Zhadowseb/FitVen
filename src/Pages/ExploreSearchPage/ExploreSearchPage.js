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
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./ExploreSearchPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { gymService, socialService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Cross from "@resources/Icons/UI-icons/Cross";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Search from "@resources/Icons/UI-icons/Search";
import { ThemedText, ThemedView, UserAvatar } from "@resources/ThemedComponents";

// Both services need two characters before they answer; so does the screen.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;
const GYM_LIMIT = 8;
const PEOPLE_LIMIT = 5;

/**
 * Explore's search, full screen with the keyboard already up: centres and
 * people, as you type. A centre opens its page; a person opens their profile,
 * and "See everyone and follow" the people list on the same search, where the
 * follow buttons are. Programs and exercises join the search when they can be
 * found.
 */
export default function ExploreSearchPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState([]);
  const [people, setPeople] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;

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

      const [gymResult, peopleResult] = await Promise.allSettled([
        gymService.searchGyms({ query: trimmed, limit: GYM_LIMIT }),
        user?.id
          ? socialService.searchUsers({ query: trimmed, currentUserId: user.id, limit: PEOPLE_LIMIT + 1 })
          : Promise.resolve([]),
      ]);

      if (cancelled) {
        return;
      }

      setGyms(gymResult.status === "fulfilled" ? gymResult.value : []);
      setPeople(peopleResult.status === "fulfilled" ? peopleResult.value : []);
      setFailed(gymResult.status === "rejected" && peopleResult.status === "rejected");
      setIsSearching(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canSearch, trimmed, user?.id]);

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
            placeholder={t("explore.searchPlaceholder")}
            placeholderTextColor={quiet}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t("explore.searchPlaceholder")}
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {!canSearch ? (
          <ThemedText style={styles.hint} setColor={quiet}>
            {t("explore.search.hint")}
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

        {gyms.length > 0 ? (
          <View style={styles.section}>
            {sectionHead(t("explore.search.gyms"))}
            <View style={[styles.list, { backgroundColor: card, borderColor: cardBorder }]}>
              {gyms.map((gym, index) => (
                <TouchableOpacity
                  key={gym.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("GymLeaderboardPage", { gym_id: gym.id })}
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
                    {gym.city ? (
                      <ThemedText style={styles.rowMeta} setColor={quiet} numberOfLines={1}>
                        {[gym.chain, gym.city].filter(Boolean).join(" · ")}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

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
