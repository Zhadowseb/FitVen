import { StyleSheet, Text, View, useColorScheme } from "react-native";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import { COMING_SOON_LABEL } from "../../Utils/workoutTypeAvailability";

/**
 * Slanted red stamp for workout types that are not released yet. Renders as an
 * overlay by default so it can sit on top of a greyed-out card without
 * changing its layout; pass inline to place it in the normal flow.
 */
export default function ComingSoonBadge({
  size = "regular", // "small" | "regular"
  inline = false,
  angle = -14,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isSmall = size === "small";

  const stamp = (
    <View
      style={[
        styles.stamp,
        isSmall ? styles.stampSmall : null,
        {
          borderColor: theme.danger,
          backgroundColor: withAlpha(theme.danger, 0.18),
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.text,
          isSmall ? styles.textSmall : null,
          { color: theme.danger },
        ]}
      >
        {COMING_SOON_LABEL}
      </Text>
    </View>
  );

  if (inline) {
    return <View style={style}>{stamp}</View>;
  }

  return (
    <View pointerEvents="none" style={[styles.overlay, style]}>
      {stamp}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  stamp: {
    borderWidth: 2,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stampSmall: {
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  textSmall: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
