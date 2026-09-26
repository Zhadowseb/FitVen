import { Fragment } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./ScopeBreadcrumbsStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "@resources/ThemedComponents";

// 17 dp of text, 44 dp to the finger.
const HIT_SLOP = { top: 14, bottom: 14, left: 4, right: 4 };

/**
 * The way up from a centre level: "All countries › Denmark › Zealand". Every
 * part before the last is a link in the accent; the last is where you are.
 *
 * `items` is [{ key, label, onPress? }], outermost first. A part without
 * onPress is shown but cannot be pressed.
 */
export default function ScopeBreadcrumbs({ items = [], style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const parts = items.filter((item) => item && item.label);

  if (parts.length === 0) {
    return null;
  }

  return (
    <View style={[styles.row, style]}>
      {parts.map((item, index) => {
        const isLast = index === parts.length - 1;
        const canPress = !isLast && typeof item.onPress === "function";

        return (
          <Fragment key={item.key ?? index}>
            {index > 0 ? (
              <View style={styles.chevron}>
                <ChevronRight width={12} height={12} color={theme.chevron} thickness={2.4} />
              </View>
            ) : null}

            {canPress ? (
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel={item.label}
                activeOpacity={0.7}
                hitSlop={HIT_SLOP}
                onPress={item.onPress}
                style={styles.part}
              >
                <ThemedText style={styles.label} setColor={theme.primaryText} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <View style={isLast ? styles.lastPart : styles.part}>
                <ThemedText
                  style={styles.label}
                  setColor={isLast ? theme.title : theme.mutedStrong}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
              </View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
