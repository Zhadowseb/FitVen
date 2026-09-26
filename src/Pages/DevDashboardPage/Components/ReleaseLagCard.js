import { View, useColorScheme } from "react-native";

import styles from "./ReleaseLagCardStyle";
import { StatusLabel, getStatusFrame } from "./KpiTile";
import { getStatusColor } from "../devDashboardView";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * KPI-6, "Uudgivet arbejde": days since the oldest commit on master that no
 * store build carries yet, per platform, in the frame of the worse of the two.
 * Under the hairline, the versions waiting and a badge for an unreleased major.
 * `lag` comes from `buildReleaseLag`.
 */
export default function ReleaseLagCard({ lag }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const frame = getStatusFrame(lag.status.status, theme);
  const summary = lag.summary;
  const hasSummary = summary && (summary.text || summary.unreleasedMajor || summary.hint);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: frame.borderColor },
      ]}
    >
      <View style={[styles.body, frame.tint ? { backgroundColor: frame.tint } : null]}>
        <View style={styles.top}>
          <ThemedText style={styles.eyebrow} setColor={theme.quietText} numberOfLines={1}>
            UUDGIVET ARBEJDE
          </ThemedText>

          <StatusLabel status={lag.status} style={styles.topStatus} />
        </View>

        <View style={styles.columns}>
          {lag.platforms.map((platform) => (
            <View
              key={platform.key}
              accessible
              accessibilityLabel={`${platform.name}: ${platform.days} ${platform.unit}, ${platform.detail}, ${platform.status.label}`}
              style={styles.column}
            >
              <ThemedText style={styles.platform} setColor={theme.quietText} numberOfLines={1}>
                {platform.name.toUpperCase()}
              </ThemedText>

              <View style={styles.daysRow}>
                <ThemedText
                  style={styles.days}
                  setColor={getStatusColor(platform.status.status, theme)}
                  numberOfLines={1}
                >
                  {platform.days}
                </ThemedText>

                <ThemedText style={styles.unit} setColor={theme.quietText} numberOfLines={1}>
                  {platform.unit}
                </ThemedText>
              </View>

              <ThemedText style={styles.detail} setColor={theme.quietText} numberOfLines={1}>
                {platform.detail}
              </ThemedText>
            </View>
          ))}
        </View>

        {hasSummary ? (
          <>
            <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />

            <View style={styles.summary}>
              {summary.text ? (
                <ThemedText style={styles.summaryText} setColor={theme.mutedStrong} numberOfLines={1}>
                  {summary.text}
                </ThemedText>
              ) : null}

              {summary.unreleasedMajor ? (
                <View
                  style={[styles.majorBadge, { backgroundColor: withAlpha(theme.danger, 0.16) }]}
                >
                  <ThemedText style={styles.majorText} setColor={theme.danger} numberOfLines={1}>
                    {summary.unreleasedMajor}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {summary.hint ? (
              <ThemedText style={styles.hint} setColor={theme.quietText}>
                {summary.hint}
              </ThemedText>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
