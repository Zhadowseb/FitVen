import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import CameraPlus from "../../Icons/UI-icons/CameraPlus";
import Play from "../../Icons/UI-icons/Play";
import { ThemedText, UserAvatar } from "../../ThemedComponents";
import LiftStatusPill, { RejectedBadge } from "./LiftStatusPill";
import { formatWeightKg } from "../../../Utils/gymUtils";

function formatLiftDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * One line of a ranked list, from #4 down. The viewer's own row is tinted and
 * gets an attach button when it has no video; a pending row gets a play button
 * that opens the review sheet; a rejected row (only ever the viewer's own)
 * strikes the weight through and says so.
 */
export default function LeaderboardRow({
  lift,
  unit = "kg",
  showGym = false,
  onPressReview,
  onPressAttach,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isMe = Boolean(lift?.isMe);
  const isRejected = lift?.videoStatus === "rejected";
  const isPending = lift?.videoStatus === "pending";
  const rankLabel = lift?.rank ? `#${lift.rank}` : "—";
  const value =
    unit === "bw" && lift?.ratio !== null && lift?.ratio !== undefined
      ? `${Number(lift.ratio).toFixed(2)}×`
      : `${formatWeightKg(lift?.weightKg)} kg`;
  const gymLine = showGym && lift?.gym?.shortName
    ? [lift.gym.shortName, lift.gym.city].filter(Boolean).join(" · ")
    : null;

  return (
    <View
      style={[
        styles.row,
        isMe
          ? {
              backgroundColor: withAlpha(theme.primary, 0.08),
              borderLeftWidth: 2,
              borderLeftColor: theme.primary,
            }
          : null,
        style,
      ]}
    >
      <ThemedText
        style={styles.rank}
        setColor={isMe ? theme.primary : theme.quietText}
        numberOfLines={1}
      >
        {rankLabel}
      </ThemedText>

      <UserAvatar
        uri={lift?.avatarUrl}
        size={34}
        iconSize={16}
        borderWidth={isMe ? 2 : 0}
        borderColor={isMe ? theme.primary : "transparent"}
      />

      <View style={styles.copy}>
        <ThemedText style={styles.name} setColor={theme.text} numberOfLines={1}>
          {isMe ? "You" : lift?.displayName ?? "Member"}
        </ThemedText>
        <View style={styles.metaRow}>
          {isRejected ? (
            <RejectedBadge rejections={lift.rejections} />
          ) : (
            <LiftStatusPill status={lift?.videoStatus} approvals={lift?.approvals} />
          )}
          <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
            {gymLine ?? formatLiftDate(lift?.performedAt)}
          </ThemedText>
          {gymLine && lift?.isHomeGym ? (
            <ThemedText style={styles.meta} setColor={theme.primary} numberOfLines={1}>
              · your centre
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ThemedText
        style={[styles.value, isRejected ? styles.valueRejected : null]}
        setColor={isRejected ? theme.quietText : theme.title}
        numberOfLines={1}
      >
        {value}
      </ThemedText>

      {isPending && onPressReview && !isMe ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Review this lift's video"
          activeOpacity={0.8}
          onPress={() => onPressReview(lift)}
          style={[
            styles.iconButton,
            {
              backgroundColor: withAlpha(theme.planned, 0.16),
              borderColor: withAlpha(theme.planned, 0.4),
              borderWidth: 1,
            },
          ]}
        >
          <Play width={14} height={14} color={theme.planned} />
        </TouchableOpacity>
      ) : null}

      {isMe && lift?.videoStatus === "none" && onPressAttach ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Attach a video to your lift"
          activeOpacity={0.8}
          onPress={() => onPressAttach(lift)}
          style={[styles.iconButton, { backgroundColor: theme.primary }]}
        >
          <CameraPlus width={16} height={16} color={theme.textInverted} thickness={2.2} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rank: {
    width: 22,
    fontSize: 13,
    fontWeight: "800",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  meta: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  value: {
    minWidth: 56,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  valueRejected: {
    textDecorationLine: "line-through",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
