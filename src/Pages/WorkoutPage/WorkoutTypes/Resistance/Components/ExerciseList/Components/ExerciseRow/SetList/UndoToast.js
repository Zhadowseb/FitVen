import { TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

import styles from "./SetListStyle.js";

/**
 * The line under the set table that says what just happened and offers to
 * take it back: a deleted set, a switch between per side and both sides.
 * One look for both, so an undo always reads the same. The caller owns the
 * timer; this only draws.
 */
export default function UndoToast({ message, actionLabel, onUndo, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isDark = colorScheme === "dark";
  const border = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(32, 30, 43, 0.12)";
  const surface = isDark ? "rgba(24, 25, 34, 0.9)" : "rgba(255, 255, 255, 0.86)";

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.undoToast,
        { backgroundColor: theme.cardBackground ?? surface, borderColor: border },
        style,
      ]}
    >
      <ThemedText style={styles.undoToastText} setColor={theme.title} numberOfLines={1}>
        {message}
      </ThemedText>
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        hitSlop={10}
        onPress={onUndo}
      >
        <ThemedText
          style={styles.undoToastAction}
          setColor={theme.primaryText ?? theme.primary}
        >
          {actionLabel}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}
