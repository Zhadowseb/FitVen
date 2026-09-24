import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./BackgroundPostBarStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Cross from "@resources/Icons/UI-icons/Cross";
import { ThemedText } from "@resources/ThemedComponents";
import { workoutService } from "@services";
import { subscribeWorkoutPost } from "@utils/workoutPostEvents";

/**
 * The thin bar at the top of Home while a workout post goes out in the
 * background: "posting" with a spinner, "posted" for a moment, or "failed"
 * with a way to try again. Nothing at all when there is no post to talk about.
 */
export default function BackgroundPostBar() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [status, setStatus] = useState(null);

  useEffect(() => subscribeWorkoutPost(setStatus), []);

  if (!status) {
    return null;
  }

  const failed = status.state === "failed";
  const posted = status.state === "posted";
  const tone = failed ? theme.danger : posted ? theme.secondary : theme.primary;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        { backgroundColor: withAlpha(tone, 0.1), borderColor: withAlpha(tone, 0.32) },
      ]}
    >
      <View style={styles.icon}>
        {failed ? (
          <Cross width={14} height={14} color={tone} />
        ) : posted ? (
          <Checkmark width={14} height={14} color={tone} thickness={2.6} />
        ) : (
          <ActivityIndicator size="small" color={tone} />
        )}
      </View>

      <ThemedText style={styles.text} setColor={failed ? tone : theme.title} numberOfLines={2}>
        {failed
          ? t("home.backgroundPost.failed")
          : posted
            ? t("home.backgroundPost.posted")
            : t("home.backgroundPost.posting")}
      </ThemedText>

      {failed ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={8}
            onPress={() => workoutService.retryBackgroundWorkoutPost(db)}
          >
            <ThemedText style={styles.action} setColor={tone}>
              {t("home.backgroundPost.retry")}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.backgroundPost.dismiss")}
            activeOpacity={0.8}
            hitSlop={8}
            onPress={() => workoutService.dismissBackgroundWorkoutPost()}
          >
            <Cross width={12} height={12} color={theme.quietText} />
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}
