import { useCallback, useState } from "react";
import { Platform, StyleSheet, Switch, View, useColorScheme } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../Resources/ThemedComponents";
import { watchWalkService } from "../../Services";

// "Walks from your watch": the switch that lets FitVen look for the walks
// started on a watch (or in a health app) in Health Connect and offer them
// (Services/watchWalkService.js, the prompt is Resources/Components/WatchWalkPrompt).
// Android only, and only where Health Connect is on the phone. Nothing is read
// until it is switched on, and no walk is made without a yes; the walks already
// added stay when it is switched off.

export default function WatchWalksCard() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      setState(await watchWalkService.getWatchWalkState(db));
    } catch (error) {
      console.warn("Could not read the watch walk setting:", error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (Platform.OS !== "android" || !state || state.access === "unavailable") {
    return null;
  }

  const toggle = async (value) => {
    setBusy(true);
    setMessage(null);

    try {
      if (value) {
        const result = await watchWalkService.enableWatchWalks(db);

        setMessage(
          result.access !== "granted"
            ? t("steps.watchWalks.denied")
            : result.found > 0
              ? t("steps.watchWalks.found", { count: result.found })
              : t("steps.watchWalks.none")
        );
      } else {
        await watchWalkService.disableWatchWalks(db);
      }
    } catch (error) {
      console.warn("Could not change the watch walk setting:", error);
    } finally {
      await load();
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <View style={styles.row}>
        <View style={styles.titles}>
          <ThemedText style={styles.title} setColor={theme.title}>
            {t("steps.watchWalks.title")}
          </ThemedText>
          <ThemedText style={styles.subtitle} setColor={theme.quietText}>
            {t("steps.watchWalks.subtitle")}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel={t("steps.watchWalks.switch")}
          disabled={busy}
          value={state.enabled}
          onValueChange={toggle}
          trackColor={{ true: theme.primary, false: withAlpha(theme.quietText, 0.35) }}
          thumbColor={theme.onDanger}
        />
      </View>
      {message ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  message: {
    fontSize: 12.5,
    lineHeight: 17,
  },
});
