import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./LibraryTileStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * One tile of the Train tab's library and tools: an icon in a tinted box and a
 * title, a big number with an optional coloured word beside it, and under
 * that whatever the tile draws (`children`). The whole tile is the button;
 * there is no chevron and no subtitle.
 *
 * `tint` colours the icon box and must be a theme token in hex, which is what
 * withAlpha can lighten. `compact` is the tools' version of the header.
 */
export default function LibraryTile({
  title,
  icon,
  tint,
  value,
  addendum = null,
  addendumColor,
  borderColor,
  compact = false,
  onPress,
  accessibilityLabel,
  style,
  children,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: theme.cardBackground,
          borderColor: borderColor ?? theme.cardBorder,
        },
        style,
      ]}
    >
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View
          style={[
            styles.iconBox,
            compact && styles.iconBoxCompact,
            { backgroundColor: withAlpha(tint, 0.14) },
          ]}
        >
          {icon}
        </View>
        {/* Sized to fit rather than cut: at a large text size the title
            shrinks a little before it would lose its end. */}
        <ThemedText
          style={[styles.title, compact && styles.titleCompact]}
          setColor={theme.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {title}
        </ThemedText>
      </View>

      <View style={styles.valueRow}>
        <ThemedText style={styles.value} setColor={theme.title} numberOfLines={1}>
          {value}
        </ThemedText>
        {addendum ? (
          <ThemedText
            style={styles.addendum}
            setColor={addendumColor ?? theme.quietText}
            numberOfLines={1}
          >
            {addendum}
          </ThemedText>
        ) : null}
      </View>

      {children}
    </TouchableOpacity>
  );
}
