import { View, useColorScheme } from "react-native";

import styles from "./SectionHeaderStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * The line above a block: a spaced capital title on the left and, on the
 * right, what it measures ("KPI-1 · 2 · 3").
 *
 * `spacing` is the gap above it: `normal` (22) between the tile blocks, `wide`
 * (26) above the three blocks that are not tiles, `first` at the top.
 */
export default function SectionHeader({ title, detail, spacing = "normal" }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.row, styles[spacing] ?? styles.normal]}>
      <ThemedText
        accessibilityRole="header"
        style={styles.title}
        setColor={theme.quietText}
        numberOfLines={1}
      >
        {title.toUpperCase()}
      </ThemedText>

      {detail ? (
        <ThemedText style={styles.detail} setColor={theme.quietText} numberOfLines={1}>
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}
