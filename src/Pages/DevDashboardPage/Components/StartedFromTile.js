import { View, useColorScheme } from "react-native";

import styles from "./StartedFromTileStyle";
import KpiTile from "./KpiTile";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * "Startet fra · 28 d": one bar per way into a workout, as a share of the
 * workouts finished. The largest bar is the accent, the rest a step lighter,
 * and "Tom træning" lightest of all. `tile` comes from `buildStartedFromTile`.
 */
export default function StartedFromTile({ tile }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const fills = {
    strong: theme.primary,
    medium: withAlpha(theme.primary, 0.6),
    faint: withAlpha(theme.primary, 0.35),
  };

  return (
    <KpiTile label="Startet fra · 28 d" window={tile.window} status={tile.status}>
      <View style={styles.list}>
        {tile.rows.map((row) => (
          <View key={row.key} style={styles.item}>
            <View style={styles.itemHead}>
              <ThemedText style={styles.itemLabel} setColor={theme.mutedStrong} numberOfLines={1}>
                {row.label}
              </ThemedText>

              <ThemedText style={styles.itemShare} setColor={theme.title} numberOfLines={1}>
                {row.share}
              </ThemedText>
            </View>

            <View style={[styles.track, { backgroundColor: withAlpha(theme.title, 0.06) }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(row.fill * 100)}%`, backgroundColor: fills[row.tone] },
                ]}
              />
            </View>
          </View>
        ))}

        {tile.note ? (
          <ThemedText style={styles.note} setColor={theme.quietText}>
            {tile.note}
          </ThemedText>
        ) : null}
      </View>
    </KpiTile>
  );
}
