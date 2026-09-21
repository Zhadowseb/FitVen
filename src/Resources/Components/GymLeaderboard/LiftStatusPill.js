import { StyleSheet, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import VideoVerified from "../../Icons/UI-icons/VideoVerified";
import { ThemedText } from "../../ThemedComponents";
import { APPROVALS_REQUIRED } from "@utils/gymUtils";

/**
 * The three states a lift's video can be in, as a 20 dp pill:
 *   verified  filled green, camera-with-tick, "Video verified · 3"
 *   pending   yellow outline, "Video pending · 1/3"
 *   none      dashed outline, "No video"
 * `compact` keeps only the icon and the number, for the podium and small
 * cards. A rejected lift is shown by RejectedBadge, only to its owner.
 */
export default function LiftStatusPill({ status = "none", approvals = 0, compact = false, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const isLight = colorScheme === "light";

  if (status === "verified") {
    const ink = isLight ? "#FFFFFF" : theme.inkOnSecondary ?? "#0B1A12";

    return (
      <View style={[styles.pill, { backgroundColor: theme.secondary }, style]}>
        <VideoVerified width={11} height={11} color={ink} thickness={2.4} />
        <ThemedText style={styles.text} setColor={ink}>
          {compact ? String(approvals) : t("gyms.status.verified", { count: approvals })}
        </ThemedText>
      </View>
    );
  }

  if (status === "pending") {
    return (
      <View
        style={[
          styles.pill,
          styles.outlined,
          { borderColor: withAlpha(theme.planned, 0.5) },
          style,
        ]}
      >
        <VideoVerified width={11} height={11} color={theme.planned} thickness={2.4} showCheck={false} />
        <ThemedText style={styles.text} setColor={theme.planned}>
          {compact
            ? `${approvals}/${APPROVALS_REQUIRED}`
            : t("gyms.status.pending", { count: approvals, required: APPROVALS_REQUIRED })}
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pill,
        styles.outlined,
        styles.dashed,
        { borderColor: isLight ? "#C9CDD5" : "#4A4F5A" },
        style,
      ]}
    >
      <ThemedText style={styles.text} setColor={theme.quietText}>
        {t("gyms.status.noVideo")}
      </ThemedText>
    </View>
  );
}

/** "REJECTED 2" - shown to the lifter only; everyone else never sees the row. */
export function RejectedBadge({ rejections = 0, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.pill, styles.rejected, style]}>
      <ThemedText style={[styles.text, styles.rejectedText]} setColor={theme.danger}>
        {t("gyms.status.rejected", { count: rejections })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 20,
    borderRadius: 999,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  outlined: {
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  dashed: {
    borderStyle: "dashed",
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },
  rejected: {
    backgroundColor: "rgba(255, 92, 92, 0.12)",
  },
  rejectedText: {
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
