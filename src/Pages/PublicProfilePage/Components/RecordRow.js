import { StyleSheet, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import LiftStatusPill from "@resources/Components/GymLeaderboard/LiftStatusPill";
import { ThemedText } from "@resources/ThemedComponents";
import { formatWeightKg } from "@utils/gymUtils";

/**
 * One of the big three on somebody's profile: the exercise and its video
 * pill on the left, the weight and where it ranks at its centre on the right.
 *
 * The leaderboard's rule, and nothing looser: the weight is gold and has a
 * place only when the video is verified. Anything else is the ordinary title
 * colour and "Not ranked" - `mapPublicRecord` has already dropped the rank.
 */
export default function RecordRow({ record }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isGold = record.isVerified;
  let placeLine = t("publicProfile.records.notRanked");

  if (record.rank) {
    placeLine = record.gym?.shortName
      ? t("publicProfile.records.rankAt", { rank: record.rank, gym: record.gym.shortName })
      : t("publicProfile.records.rank", { rank: record.rank });
  }

  return (
    <View style={[styles.row, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.left}>
        <ThemedText style={styles.exercise} setColor={theme.title} numberOfLines={1}>
          {record.exerciseName}
        </ThemedText>
        <LiftStatusPill status={record.videoStatus} approvals={record.approvals} />
      </View>

      <View style={styles.right}>
        <View style={styles.weightRow}>
          <ThemedText style={styles.weight} setColor={isGold ? theme.record : theme.title}>
            {formatWeightKg(record.weightKg)}
          </ThemedText>
          <ThemedText style={styles.unit} setColor={theme.quietText}>
            {t("common.kg")}
          </ThemedText>
        </View>
        <ThemedText style={styles.place} setColor={theme.quietText} numberOfLines={1}>
          {placeLine}
        </ThemedText>
      </View>
    </View>
  );
}

// Layout only; the colours are the theme's, applied above.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  left: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  exercise: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  right: {
    flexShrink: 1,
    maxWidth: "55%",
    alignItems: "flex-end",
    gap: 2,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  weight: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 11,
    fontWeight: "800",
  },
  place: {
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "right",
  },
});
