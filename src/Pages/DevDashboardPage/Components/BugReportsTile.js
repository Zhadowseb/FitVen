import { View, useColorScheme } from "react-native";

import styles from "./BugReportsTileStyle";
import KpiTile from "./KpiTile";
import { getStatusColor } from "../devDashboardView";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * KPI-5b, "Nye bugs · uge": the reports, how many people sent them, and a row
 * per app version with a bar for its share of them. The bars are grey unless
 * the tile is flagged, like the sparklines. `tile` comes from
 * `buildBugReportsTile`.
 */
export default function BugReportsTile({ tile }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isFlagged = tile.status.status === "watch" || tile.status.status === "alarm";
  const barColor = isFlagged
    ? withAlpha(getStatusColor(tile.status.status, theme), 0.8)
    : withAlpha(theme.mutedStrong, 0.55);

  return (
    <KpiTile
      label="Nye bugs · uge"
      value={tile.value}
      side={tile.side}
      window={tile.window}
      status={tile.status}
    >
      {tile.rows.length > 0 ? (
        <View style={styles.versions}>
          {tile.rows.map((row) => (
            <View key={row.key} style={styles.versionRow}>
              <ThemedText style={styles.version} setColor={theme.quietText} numberOfLines={1}>
                {row.label}
              </ThemedText>

              <View style={[styles.track, { backgroundColor: withAlpha(theme.title, 0.06) }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(row.fill * 100)}%`, backgroundColor: barColor },
                  ]}
                />
              </View>

              <ThemedText style={styles.count} setColor={theme.mutedStrong} numberOfLines={1}>
                {row.count}
              </ThemedText>
            </View>
          ))}

          {tile.more > 0 ? (
            <ThemedText style={styles.more} setColor={theme.quietText} numberOfLines={1}>
              +{tile.more} {tile.more === 1 ? "version" : "versioner"} mere
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </KpiTile>
  );
}
