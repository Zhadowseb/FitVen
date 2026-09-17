import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { useTranslation } from "@localization";

import styles from "./GymsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { gymService } from "../../Services";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Expand from "../../Resources/Icons/UI-icons/Expand";
import Search from "../../Resources/Icons/UI-icons/Search";
import LiftStatusPill from "../../Resources/Components/GymLeaderboard/LiftStatusPill";
import RadialGlow from "../../Resources/Components/GymLeaderboard/RadialGlow";
import { usePulseAnimation } from "../../Resources/Components/animationHooks";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";
import {
  formatDistance,
  formatWeightKg,
  getChainColor,
  getChainInitials,
} from "../../Utils/gymUtils";

// Denmark, when the phone will not say where it is.
const FALLBACK_REGION = {
  latitude: 56.0,
  longitude: 10.6,
  latitudeDelta: 3.6,
  longitudeDelta: 4.2,
};
const NEARBY_REGION_DELTA = 0.08;
const SEARCH_DEBOUNCE_MS = 250;

// Google Maps (Android) style: inverted and desaturated, so the pins carry
// the colour. iOS uses Apple Maps and follows userInterfaceStyle instead.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#14161c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#868c99" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0b0f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#242830" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f1116" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6e7480" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0b0f" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#121419" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2b2f38" }] },
];

// Your own centre pulses in the accent and keeps its chain colour in the
// middle, so the pin says both "yours" and which chain it is.
function HomeGymPin({ theme, chainColor }) {
  const { scale, opacity } = usePulseAnimation(true);

  return (
    <View style={styles.pinShell}>
      <Animated.View
        style={[
          styles.pinPulse,
          { backgroundColor: withAlpha(theme.primary, 0.45), opacity, transform: [{ scale }] },
        ]}
      />
      <View style={[styles.pin, styles.pinHome, { backgroundColor: chainColor, borderColor: theme.primary }]} />
    </View>
  );
}

export default function GymsPage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [visibleGyms, setVisibleGyms] = useState([]);
  const [strongest, setStrongest] = useState([]);
  const [gymCount, setGymCount] = useState(null);
  const [homeGym, setHomeGym] = useState(null);
  // The centres the viewer has actually trained in, most often first. Empty
  // until a workout has been matched to one, and then the card is hidden.
  const [myGyms, setMyGyms] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const isLight = colorScheme === "light";
  const mutedStrong = isLight ? "#3F4550" : "#C4C7CF";
  const goldRingColor = theme.record;

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      setErrorMessage(t("gyms.list.signInToSee"));
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const currentPosition = await gymService.getCurrentPosition({ requestPermission: true });
      const origin = currentPosition ?? { latitude: FALLBACK_REGION.latitude, longitude: FALLBACK_REGION.longitude };

      setPosition(currentPosition);

      const [nearbyResult, strongestResult, countResult, homeResult, myGymsResult] =
        await Promise.allSettled([
          gymService.getNearbyGyms({ latitude: origin.latitude, longitude: origin.longitude, limit: 30 }),
          gymService.getNationalStrongest(),
          gymService.getGymCount(),
          gymService.getMyHomeGym(),
          gymService.getMyGyms(),
        ]);

      if (nearbyResult.status === "rejected") {
        throw nearbyResult.reason;
      }

      setNearby(nearbyResult.value);
      setVisibleGyms(nearbyResult.value);
      setStrongest(strongestResult.status === "fulfilled" ? strongestResult.value : []);
      setGymCount(countResult.status === "fulfilled" ? countResult.value : null);
      setHomeGym(homeResult.status === "fulfilled" ? homeResult.value : null);
      setMyGyms(myGymsResult.status === "fulfilled" ? myGymsResult.value : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("gyms.list.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await gymService.searchGyms({ query: trimmed });

        setSearchResults(results);
      } catch (error) {
        setSearchResults([]);
        setErrorMessage(error instanceof Error ? error.message : t("gyms.searchFailed"));
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [query, t]);

  const initialRegion = useMemo(() => {
    if (position) {
      return {
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: NEARBY_REGION_DELTA,
        longitudeDelta: NEARBY_REGION_DELTA,
      };
    }

    if (homeGym?.latitude && homeGym?.longitude) {
      return {
        latitude: homeGym.latitude,
        longitude: homeGym.longitude,
        latitudeDelta: NEARBY_REGION_DELTA,
        longitudeDelta: NEARBY_REGION_DELTA,
      };
    }

    return FALLBACK_REGION;
  }, [homeGym, position]);

  // The chains actually on screen, so the legend explains the pins in front
  // of the user rather than every chain in the country. One chain alone needs
  // no legend, and the row hides itself.
  const visibleChains = useMemo(() => {
    const colorByChain = new Map();

    for (const gym of visibleGyms) {
      if (gym.chain && !colorByChain.has(gym.chain)) {
        colorByChain.set(gym.chain, getChainColor(gym.chain));
      }
    }

    return [...colorByChain.entries()]
      .map(([chain, color]) => ({ chain, color }))
      .sort((left, right) => left.chain.localeCompare(right.chain));
  }, [visibleGyms]);

  const handleRegionChange = async (region) => {
    try {
      const gyms = await gymService.getGymsInBounds({
        minLatitude: region.latitude - region.latitudeDelta / 2,
        maxLatitude: region.latitude + region.latitudeDelta / 2,
        minLongitude: region.longitude - region.longitudeDelta / 2,
        maxLongitude: region.longitude + region.longitudeDelta / 2,
      });

      setVisibleGyms(gyms);
    } catch {
      // The pins already on the map are still right; nothing to tell the user.
    }
  };

  const openGym = (gym) => {
    navigation.navigate("GymLeaderboardPage", { gym_id: gym.id });
  };

  const homeGymId = homeGym?.id ?? null;
  const listSource = searchResults ?? nearby;
  const orderedNearby = useMemo(() => {
    const list = [...listSource];

    list.sort((left, right) => {
      if (left.id === homeGymId) return -1;
      if (right.id === homeGymId) return 1;
      return (left.distanceM ?? 0) - (right.distanceM ?? 0);
    });

    return searchResults ? list : list.slice(0, showAllNearby ? list.length : 6);
  }, [homeGymId, listSource, searchResults, showAllNearby]);
  const featuredStrongest = strongest.filter((entry) => entry.top);

  // One row, used by both lists. The nearest list shows how far away a centre
  // is and how many people train there; the viewer's own centres show the
  // chain and how many workouts they have done there, so those two come in
  // as overrides rather than as a second copy of the row.
  const renderGymRow = (gym, index, total, { meta: metaOverride = null, trailing = null } = {}) => {
    const isHome = gym.id === homeGymId;
    const meta =
      metaOverride ??
      [gym.chain, gym.distanceM !== null && gym.distanceM !== undefined ? formatDistance(gym.distanceM) : gym.city]
        .filter(Boolean)
        .join(" · ");

    return (
      <View key={gym.id}>
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${gym.shortName}, ${meta}`}
          onPress={() => openGym(gym)}
          style={[styles.gymRow, isHome ? [styles.gymRowHome, { borderLeftColor: theme.primary }] : null]}
        >
          {/* Tinted with the chain's map colour, so a row and its pin are
              recognisably the same chain. The initials keep the neutral ink:
              the colours are picked to be told apart, not to be read on. */}
          <View
            style={[styles.chainTile, { backgroundColor: withAlpha(getChainColor(gym.chain), 0.16) }]}
          >
            <ThemedText style={styles.chainTileText} setColor={mutedStrong}>
              {getChainInitials(gym.chain)}
            </ThemedText>
          </View>
          <View style={styles.gymCopy}>
            <View style={styles.gymNameRow}>
              <ThemedText style={styles.gymName} setColor={theme.title} numberOfLines={1}>
                {gym.shortName}
              </ThemedText>
              {isHome ? (
                <View style={[styles.gymBadge, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
                  <ThemedText style={styles.gymBadgeText} setColor={theme.primary}>
                    {t("gyms.list.yoursBadge")}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.gymMeta} setColor={quietText} numberOfLines={1}>
              {meta}
            </ThemedText>
          </View>
          <ThemedText style={styles.gymCount} setColor={mutedStrong}>
            {trailing ?? (gym.memberCount ? String(gym.memberCount) : "")}
          </ThemedText>
          <ChevronRight width={18} height={18} color={isLight ? "#A8ACB6" : "#4A4F5A"} />
        </TouchableOpacity>
        {index < total - 1 ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
      </View>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        rightWidth={84}
        right={
          gymCount !== null ? (
            <ThemedText style={styles.headerCount} setColor={quietText}>
              {t("gyms.list.centreCount", { count: gymCount })}
            </ThemedText>
          ) : null
        }
      >
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={12} style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}>
            {t("gyms.list.eyebrow")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.pageHeaderTitleMain} numberOfLines={1}>
            {t("gyms.list.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.searchField, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
          <Search width={16} height={16} color={quietText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("gyms.list.searchPlaceholder")}
            placeholderTextColor={isLight ? "#8C909B" : "#6E7480"}
            style={[styles.searchInput, { color: theme.title }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("gyms.searchCentresA11y")}
          />
          {isSearching ? <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} /> : null}
        </View>

        <View style={[styles.mapCard, isMapExpanded ? styles.mapCardExpanded : null, { borderColor: cardBorder }]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            customMapStyle={!isLight && Platform.OS === "android" ? DARK_MAP_STYLE : undefined}
            userInterfaceStyle={isLight ? "light" : "dark"}
            showsCompass={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            onRegionChangeComplete={handleRegionChange}
          >
            {visibleGyms.map((gym) => {
              const isHome = gym.id === homeGymId;
              const chainColor = getChainColor(gym.chain);

              return (
                <Marker
                  key={gym.id}
                  coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
                  title={isHome ? gym.shortName : gym.chain}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={isHome}
                  onPress={() => openGym(gym)}
                >
                  {isHome ? (
                    <HomeGymPin theme={theme} chainColor={chainColor} />
                  ) : (
                    <View
                      style={[
                        styles.pin,
                        styles.pinOther,
                        { backgroundColor: chainColor, borderColor: theme.uiBackground },
                      ]}
                    />
                  )}
                </Marker>
              );
            })}
            {position ? (
              <Marker
                coordinate={{ latitude: position.latitude, longitude: position.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[styles.pin, styles.pinMe, { backgroundColor: theme.secondary, borderColor: theme.uiBackground }]} />
              </Marker>
            ) : null}
          </MapView>

          <View style={[styles.mapPill, { backgroundColor: "rgba(8, 9, 12, 0.62)" }]}>
            <ThemedText style={styles.mapPillText} setColor="#FFFFFF">
              {t("gyms.list.nearbyCount", { count: visibleGyms.length })}
            </ThemedText>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isMapExpanded ? t("gyms.list.shrinkMap") : t("gyms.list.expandMap")}
            onPress={() => setIsMapExpanded((value) => !value)}
            style={[styles.mapExpandButton, { backgroundColor: "rgba(8, 9, 12, 0.62)" }]}
          >
            <Expand width={16} height={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {visibleChains.length > 1 ? (
          <View style={styles.legendRow}>
            {visibleChains.map((entry) => (
              <View key={entry.chain} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
                <ThemedText style={styles.legendText} setColor={quietText}>
                  {entry.chain}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {errorMessage ? (
          <View style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
            <View style={styles.emptyRow}>
              <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                {t("gyms.list.unavailableTitle")}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                {errorMessage}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {!searchResults && featuredStrongest.length ? (
          <View style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
            <RadialGlow color={theme.record} />
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle} setColor={theme.title}>
                {t("gyms.strongest.title")}
              </ThemedText>
              <ThemedText style={styles.cardEyebrow} setColor={quietText}>
                {t("gyms.strongest.verifiedOnly")}
              </ThemedText>
            </View>
            {featuredStrongest.map((entry) => {
              const top = entry.top;
              const gymLine = [top.gym?.shortName, top.gym?.city].filter(Boolean).join(" · ");

              return (
                <TouchableOpacity
                  key={entry.exerciseId}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("NationalExerciseLeaderboardPage", { exercise_id: entry.exerciseId })}
                  style={styles.strongestRow}
                >
                  <ThemedText style={styles.strongestExercise} setColor={quietText} numberOfLines={1}>
                    {entry.exerciseName}
                  </ThemedText>
                  <View style={[styles.avatarRing, { borderColor: goldRingColor }]}>
                    <UserAvatar uri={top.avatarUrl} size={34} iconSize={16} />
                  </View>
                  <View style={styles.strongestCopy}>
                    <ThemedText style={styles.strongestName} setColor={theme.title} numberOfLines={1}>
                      {top.isMe ? t("common.you") : top.displayName}
                    </ThemedText>
                    <ThemedText style={styles.strongestMeta} setColor={top.isHomeGym ? theme.primary : quietText} numberOfLines={1}>
                      {top.isHomeGym ? t("gyms.gymLineYourCentre", { gym: gymLine }) : gymLine}
                    </ThemedText>
                  </View>
                  <LiftStatusPill status="verified" approvals={top.approvals} compact />
                  <ThemedText style={styles.strongestWeight} setColor={theme.record}>
                    {formatWeightKg(top.weightKg)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => navigation.navigate("NationalExerciseLeaderboardPage", { exercise_id: featuredStrongest[0].exerciseId })}
              style={[styles.cardFooter, { borderTopColor: theme.hairline }]}
            >
              <ThemedText style={styles.cardFooterText} setColor={theme.primary}>
                {t("gyms.strongest.seeAll")}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {!searchResults && myGyms.length > 0 ? (
          <View style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle} setColor={theme.title}>
                {t("gyms.change.trainedHere")}
              </ThemedText>
              <ThemedText style={styles.cardEyebrow} setColor={quietText}>
                {t("gyms.list.trainedEyebrow")}
              </ThemedText>
            </View>
            {myGyms.map((gym, index) =>
              renderGymRow(gym, index, myGyms.length, {
                meta: t("gyms.change.gymMeta", { chain: gym.chain, count: gym.workoutCount }),
                trailing: String(gym.workoutCount),
              })
            )}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle} setColor={theme.title}>
              {searchResults ? t("gyms.list.results") : t("gyms.list.nearest")}
            </ThemedText>
            <ThemedText style={styles.cardEyebrow} setColor={quietText}>
              {searchResults
                ? t("gyms.list.foundCount", { count: searchResults.length })
                : t("gyms.list.membersEyebrow")}
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.emptyRow}>
              <ActivityIndicator color={theme.primaryText ?? theme.primary} />
            </View>
          ) : orderedNearby.length === 0 ? (
            <View style={styles.emptyRow}>
              <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                {searchResults ? t("gyms.list.noMatchTitle") : t("gyms.list.noCentresTitle")}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                {searchResults ? t("gyms.list.noMatchBody") : t("gyms.list.noCentresBody")}
              </ThemedText>
            </View>
          ) : (
            orderedNearby.map((gym, index) => renderGymRow(gym, index, orderedNearby.length))
          )}

          {!searchResults && !isLoading && nearby.length > 6 ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => setShowAllNearby((value) => !value)}
              style={[styles.cardFooter, { borderTopColor: theme.hairline }]}
            >
              <ThemedText style={styles.cardFooterText} setColor={theme.primary}>
                {showAllNearby ? t("common.showFewer") : t("gyms.list.showAllNearby")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
