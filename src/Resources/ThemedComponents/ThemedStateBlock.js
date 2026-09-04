import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { Colors } from "../GlobalStyling/colors";
import { Radius, Spacing } from "../GlobalStyling/spacing";
import ThemedText from "./ThemedText";
import ThemedTitle from "./ThemedTitle";

// The loading / empty / error block, which two dozen screens each spelled out
// with a View, a centred indicator or heading, a line of quiet text and
// sometimes a retry pill — and 76 style keys between them.
//
// Only for a block that stands in for the screen's content. An indicator
// inside a button or a table row is a different thing and stays where it is.
export default function ThemedStateBlock({
  variant = "loading",
  title,
  message,
  icon = null,
  actionLabel,
  onAction,
  actionDisabled = false,
  action = null,
  indicatorSize = "large",
  indicatorColor,
  fill = false,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLoading = variant === "loading";

  return (
    <View style={[styles.block, fill ? styles.blockFill : null, style]}>
      {isLoading ? (
        <ActivityIndicator
          size={indicatorSize}
          color={indicatorColor ?? theme.primaryText}
        />
      ) : (
        icon
      )}

      {title && !isLoading ? (
        <ThemedTitle type="h3" style={styles.title}>
          {title}
        </ThemedTitle>
      ) : null}

      {message ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {message}
        </ThemedText>
      ) : null}

      {action}

      {actionLabel && onAction ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.82}
          disabled={actionDisabled}
          onPress={onAction}
          style={[
            styles.action,
            { backgroundColor: theme.primary },
            actionDisabled ? styles.actionDisabled : null,
          ]}
        >
          <ThemedText style={styles.actionText} setColor={theme.textInverted}>
            {actionLabel}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },

  // For a block that stands in for the whole screen rather than a section.
  blockFill: {
    flex: 1,
    justifyContent: "center",
  },

  title: {
    textAlign: "center",
  },

  message: {
    maxWidth: 310,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  action: {
    minWidth: 140,
    minHeight: 44,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },

  actionDisabled: {
    opacity: 0.5,
  },

  actionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
});
