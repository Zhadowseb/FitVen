import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import styles from "../GymLeaderboardPageStyle";
import { useAuth } from "../../../Contexts/AuthContext";
import { gymService } from "../../../Services";
import { Colors, withAlpha } from "../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../Resources/Icons/UI-icons/Checkmark";
import Search from "../../../Resources/Icons/UI-icons/Search";
import { ThemedBottomSheet, ThemedText } from "../../../Resources/ThemedComponents";
import { getChainInitials } from "../../../Utils/gymUtils";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * "Change centre": the centres the viewer has trained in (most often first),
 * then a search over every centre. Choosing one writes home_gym_id;
 * "Automatic" clears it so the most-trained-in centre wins again.
 */
export default function ChangeGymSheet({ visible, onClose, currentHomeGymId, isAutomatic, onChanged }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const searchTimeoutRef = useRef(null);
  const [myGyms, setMyGyms] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const quietText = theme.quietText ?? theme.text;
  const isLight = colorScheme === "light";
  const chainTileSurface = isLight ? "#E9EBF0" : "#242830";

  const load = useCallback(async () => {
    if (!visible) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      setMyGyms(await gymService.getMyGyms());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load your centres.");
    } finally {
      setIsLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults(null);
    }
  }, [visible]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setResults(await gymService.searchGyms({ query: trimmed }));
      } catch (error) {
        setResults([]);
        setErrorMessage(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [query]);

  const choose = async (gymId) => {
    if (!user?.id || savingId !== null) {
      return;
    }

    setSavingId(gymId ?? "auto");
    setErrorMessage("");

    try {
      await gymService.setHomeGym({ userId: user.id, gymId });
      onChanged?.(gymId);
      onClose?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not change your centre.");
    } finally {
      setSavingId(null);
    }
  };

  const renderRow = ({ key, title, meta, initials, selected, onPress, saving }) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={savingId !== null}
      style={[styles.sheetRow, selected ? { backgroundColor: withAlpha(theme.primary, 0.08) } : null]}
    >
      <View style={[styles.reviewIcon, { backgroundColor: chainTileSurface, borderRadius: 12 }]}>
        <ThemedText style={{ fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }} setColor={isLight ? "#3F4550" : "#C4C7CF"}>
          {initials}
        </ThemedText>
      </View>
      <View style={styles.sheetRowCopy}>
        <ThemedText style={styles.sheetRowTitle} setColor={theme.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {meta ? (
          <ThemedText style={styles.sheetRowMeta} setColor={quietText} numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.sheetCheck}>
        {saving ? (
          <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} />
        ) : selected ? (
          <Checkmark width={16} height={16} color={theme.primary} thickness={2.6} />
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHeader}>
        <ThemedText style={styles.sheetTitle} setColor={theme.title}>
          Change centre
        </ThemedText>
        <ThemedText style={styles.sheetBody} setColor={quietText}>
          Your centre is where you have trained most in the last 90 days, unless you pick one here.
        </ThemedText>
      </View>

      <View style={[styles.sheetSearch, { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }]}>
        <Search width={16} height={16} color={quietText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search every centre"
          placeholderTextColor={isLight ? "#8C909B" : "#6E7480"}
          style={[styles.sheetSearchInput, { color: theme.title }]}
          autoCorrect={false}
          accessibilityLabel="Search centres"
        />
        {isSearching ? <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} /> : null}
      </View>

      {errorMessage ? (
        <ThemedText style={[styles.sheetBody, { paddingHorizontal: 16, paddingBottom: 8 }]} setColor={theme.danger}>
          {errorMessage}
        </ThemedText>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled">
        {results ? (
          <>
            <ThemedText style={styles.sheetSection} setColor={quietText}>
              {`${results.length} ${results.length === 1 ? "result" : "results"}`}
            </ThemedText>
            {results.map((gym) =>
              renderRow({
                key: gym.id,
                title: gym.shortName,
                meta: [gym.chain, gym.city].filter(Boolean).join(" · "),
                initials: getChainInitials(gym.chain),
                selected: !isAutomatic && gym.id === currentHomeGymId,
                onPress: () => choose(gym.id),
                saving: savingId === gym.id,
              })
            )}
          </>
        ) : (
          <>
            {renderRow({
              key: "auto",
              title: "Automatic",
              meta: "Where you train most",
              initials: "A",
              selected: Boolean(isAutomatic),
              onPress: () => choose(null),
              saving: savingId === "auto",
            })}
            <ThemedText style={styles.sheetSection} setColor={quietText}>
              Where you have trained
            </ThemedText>
            {isLoading ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={theme.primaryText ?? theme.primary} />
              </View>
            ) : myGyms.length === 0 ? (
              <ThemedText style={[styles.sheetBody, { paddingHorizontal: 16, paddingBottom: 12 }]} setColor={quietText}>
                Finish a workout inside a centre and it shows up here. Or search above.
              </ThemedText>
            ) : (
              myGyms.map((gym) =>
                renderRow({
                  key: gym.id,
                  title: gym.shortName,
                  meta: `${gym.chain} · ${gym.workoutCount} ${gym.workoutCount === 1 ? "workout" : "workouts"}`,
                  initials: getChainInitials(gym.chain),
                  selected: !isAutomatic && gym.id === currentHomeGymId,
                  onPress: () => choose(gym.id),
                  saving: savingId === gym.id,
                })
              )
            )}
          </>
        )}
      </ScrollView>
    </ThemedBottomSheet>
  );
}
