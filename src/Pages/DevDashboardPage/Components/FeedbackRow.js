import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./FeedbackRowStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { formatAge, formatMeta } from "@utils/devDashboard";

const LABELS = {
  bug: "FEJL",
  idea: "IDÉ",
  praise: "ROS",
  other: "ANDET",
};

/** The colour a type is drawn in, read off the theme so both schemes work. */
function getKindColor(kind, theme) {
  if (kind === "bug") {
    return theme.danger;
  }

  if (kind === "idea") {
    return theme.planned;
  }

  if (kind === "praise") {
    return theme.secondary;
  }

  return theme.quietText;
}

/**
 * One message.
 *
 * A read message keeps its place in the list and loses its left edge and its
 * contrast. Unread are not floated to the top: a list that reorders itself as
 * it is read cannot be worked through.
 */
export default function FeedbackRow({ feedback, onPress, now = Date.now() }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isRead = Boolean(feedback.readAt);
  const kindColor = getKindColor(feedback.kind, theme);
  const label = isRead ? "LÆST" : LABELS[feedback.kind] ?? LABELS.other;
  const meta = formatMeta(feedback);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${feedback.senderName ?? "ukendt"}`}
      activeOpacity={0.85}
      onPress={() => onPress?.(feedback)}
      style={[
        styles.row,
        isRead
          ? {
              backgroundColor: withAlpha(theme.title, 0.03),
              borderColor: "transparent",
            }
          : {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
              borderLeftWidth: 3,
              borderLeftColor: kindColor,
            },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: withAlpha(
                isRead ? theme.quietText : kindColor,
                0.14
              ),
            },
          ]}
        >
          <ThemedText
            style={styles.badgeText}
            setColor={isRead ? theme.quietText : kindColor}
          >
            {label}
          </ThemedText>
        </View>

        <ThemedText
          style={styles.sender}
          setColor={isRead ? theme.text : theme.title}
          numberOfLines={1}
        >
          {feedback.senderName ?? "Ukendt"}
        </ThemedText>

        <View style={styles.spacer} />

        <ThemedText style={styles.age} setColor={theme.quietText}>
          {formatAge(feedback.createdAt, now)}
        </ThemedText>
      </View>

      <ThemedText
        style={styles.message}
        setColor={isRead ? theme.quietText : theme.text}
        numberOfLines={3}
      >
        {feedback.message}
      </ThemedText>

      {meta ? (
        <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
          {meta}
        </ThemedText>
      ) : null}
    </TouchableOpacity>
  );
}
