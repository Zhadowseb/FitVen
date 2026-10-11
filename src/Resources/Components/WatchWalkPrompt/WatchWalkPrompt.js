import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { formatNumber, getLocaleTag, useTranslation } from "@localization";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import { ThemedBottomSheet, ThemedText } from "../../ThemedComponents";
import { watchWalkService } from "../../../Services";

// "A walk was found on your phone. Add it to FitVen?" - the offer behind
// Services/watchWalkService.js. It is opened by the walks the service has found
// and nobody has answered: on launch, and when the app comes back to the
// foreground. Each walk can be added or skipped (skip is "do not ask about this
// one again"), and "Not now" closes it until the app is opened the next time.
// Nothing becomes a walk until Add is tapped.

const SOURCES = {
  "com.sec.android.app.shealth": "Samsung Health",
};

export default function WatchWalkPrompt() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [walks, setWalks] = useState(() => watchWalkService.getPendingWatchWalks());
  const [later, setLater] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => watchWalkService.subscribePendingWatchWalks(setWalks), []);

  const shown = walks.filter((walk) => !later.has(walk.hcId));
  const visible = shown.length > 0;

  const run = async (action) => {
    setBusy(true);

    try {
      await action();
    } catch (error) {
      console.warn("Could not answer the walk from the watch:", error);
    } finally {
      setBusy(false);
    }
  };

  const notNow = () =>
    setLater((current) => new Set([...current, ...shown.map((walk) => walk.hcId)]));

  const when = (walk) =>
    new Date(walk.startMs).toLocaleString(getLocaleTag(), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const details = (walk) =>
    [
      t("walk.watchPrompt.minutes", { count: Math.max(1, Math.round(walk.durationSeconds / 60)) }),
      walk.distanceMeters ? t("walk.watchPrompt.km", { km: formatNumber(Math.round(walk.distanceMeters / 10) / 100) }) : null,
      walk.steps ? t("walk.watchPrompt.steps", { count: formatNumber(walk.steps) }) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const buttonColor = { backgroundColor: withAlpha(theme.primary, 0.14) };

  return (
    <ThemedBottomSheet visible={visible} onClose={notNow}>
      <View style={styles.header}>
        <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
          {shown.length === 1
            ? t("walk.watchPrompt.titleOne")
            : t("walk.watchPrompt.titleMany", { count: shown.length })}
        </ThemedText>
        <ThemedText style={styles.subtitle} setColor={theme.quietText}>
          {shown.length === 1 ? t("walk.watchPrompt.subtitleOne") : t("walk.watchPrompt.subtitleMany")}
        </ThemedText>
      </View>

      <View style={styles.rows}>
        {shown.map((walk) => (
          <View
            key={walk.hcId}
            style={[styles.row, { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }]}
          >
            <View style={styles.rowCopy}>
              <ThemedText style={styles.rowTitle} setColor={theme.title}>
                {when(walk)}
              </ThemedText>
              <ThemedText style={styles.rowDetail} setColor={theme.quietText}>
                {details(walk)}
              </ThemedText>
              {SOURCES[walk.origin] ? (
                <ThemedText style={styles.rowSource} setColor={theme.quietText}>
                  {SOURCES[walk.origin]}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                onPress={() => run(() => watchWalkService.addWatchWalks(db, [walk]))}
                style={[styles.button, buttonColor]}
              >
                <ThemedText style={styles.buttonText} setColor={theme.primaryText}>
                  {t("walk.watchPrompt.add")}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityHint={t("walk.watchPrompt.skipHint")}
                disabled={busy}
                onPress={() => run(() => watchWalkService.skipWatchWalks(db, [walk]))}
                style={styles.skip}
              >
                <ThemedText style={styles.skipText} setColor={theme.quietText}>
                  {t("walk.watchPrompt.skip")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        {shown.length > 1 ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => run(() => watchWalkService.addWatchWalks(db, shown))}
            style={[styles.footerButton, buttonColor]}
          >
            <ThemedText style={styles.buttonText} setColor={theme.primaryText}>
              {t("walk.watchPrompt.addAll")}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={notNow} style={styles.footerButton}>
          <ThemedText style={styles.skipText} setColor={theme.quietText}>
            {t("walk.watchPrompt.later")}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  rows: {
    paddingHorizontal: 20,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  rowCopy: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowDetail: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  rowSource: {
    fontSize: 12,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  skip: {
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  footerButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
