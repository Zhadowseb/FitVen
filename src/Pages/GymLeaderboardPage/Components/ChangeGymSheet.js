import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useTranslation } from "@localization";

import styles from "../GymLeaderboardPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { gymService } from "@services";
import { useGymSearch } from "@resources/Components/useGymSearch";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Search from "@resources/Icons/UI-icons/Search";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";
import { getChainInitials } from "@utils/gymUtils";


/**
 * "Change centre": the centres the viewer has trained in (most often first),
 * then a search over every centre. Choosing one writes home_gym_id;
 * "Automatic" clears it so the most-trained-in centre wins again.
 */
export default function ChangeGymSheet({ visible, onClose, currentHomeGymId, isAutomatic, onChanged }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const { user } = useAuth();
  const [myGyms, setMyGyms] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const { results, isSearching } = useGymSearch(query, setErrorMessage);
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
      setErrorMessage(error instanceof Error ? error.message : t("gyms.change.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t, visible]);

  useEffect(() => {
    load();
  }, [load]);

  // Clearing the query is enough: useGymSearch drops its results as soon as
  // the query falls under the minimum length.
  useEffect(() => {
    if (!visible) {
      setQuery("");
    }
  }, [visible]);

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
      setErrorMessage(error instanceof Error ? error.message : t("gyms.change.saveFailed"));
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
      <View style={[styles.chainTile, { backgroundColor: chainTileSurface }]}>
        <ThemedText style={styles.chainTileText} setColor={theme.mutedStrong}>
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
          <Checkmark width={16} height={16} color={theme.primaryText} thickness={2.6} />
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHeader}>
        <ThemedText style={styles.sheetTitle} setColor={theme.title}>
          {t("gyms.overview.changeCentre")}
        </ThemedText>
        <ThemedText style={styles.sheetBody} setColor={quietText}>
          {t("gyms.change.body")}
        </ThemedText>
      </View>

      <View style={[styles.sheetSearch, { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }]}>
        <Search width={16} height={16} color={quietText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("gyms.change.searchPlaceholder")}
          placeholderTextColor={isLight ? "#8C909B" : "#6E7480"}
          style={[styles.sheetSearchInput, { color: theme.title }]}
          autoCorrect={false}
          accessibilityLabel={t("gyms.searchCentresA11y")}
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
              {t("gyms.change.resultCount", { count: results.length })}
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
              title: t("gyms.change.automatic"),
              meta: t("gyms.change.automaticMeta"),
              initials: t("gyms.change.automatic").slice(0, 1).toUpperCase(),
              selected: Boolean(isAutomatic),
              onPress: () => choose(null),
              saving: savingId === "auto",
            })}
            <ThemedText style={styles.sheetSection} setColor={quietText}>
              {t("gyms.change.trainedHere")}
            </ThemedText>
            {isLoading ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={theme.primaryText ?? theme.primary} />
              </View>
            ) : myGyms.length === 0 ? (
              <ThemedText style={[styles.sheetBody, { paddingHorizontal: 16, paddingBottom: 12 }]} setColor={quietText}>
                {t("gyms.change.emptyBody")}
              </ThemedText>
            ) : (
              myGyms.map((gym) =>
                renderRow({
                  key: gym.id,
                  title: gym.shortName,
                  meta: t("gyms.change.gymMeta", { chain: gym.chain, count: gym.workoutCount }),
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
