import { View, useColorScheme } from "react-native";

import styles from "./FeedbackHeaderStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * "FEEDBACK", the unread badge, and on the right S4 - the median time from a
 * message arriving to a decision about it - and the count. Once a message has
 * waited more than seven days undecided, the timing turns red and says how many.
 * `timing` comes from `buildFeedbackTiming`, and is null when S4 is not known.
 */
export default function FeedbackHeader({ unreadCount, total, timing }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <ThemedText
          accessibilityRole="header"
          style={styles.title}
          setColor={theme.quietText}
          numberOfLines={1}
        >
          FEEDBACK
        </ThemedText>

        {unreadCount > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.unreadBadgeText} setColor={theme.textInverted}>
              {unreadCount > 99 ? "99+" : String(unreadCount)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.right}>
        {timing?.text ? (
          // The one line on the page that can run long - a red median, the
          // overdue count and a three-digit total - so it may shrink a little
          // rather than lose its end.
          <ThemedText
            style={styles.timing}
            setColor={timing.alarm ? theme.danger : theme.quietText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {timing.text}
          </ThemedText>
        ) : null}

        <ThemedText
          style={styles.total}
          setColor={theme.primaryText ?? theme.primary}
          numberOfLines={1}
        >
          {total} i alt
        </ThemedText>
      </View>
    </View>
  );
}
