import { useId } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { Colors } from "@resources/GlobalStyling/colors";
import { UserAvatar } from "@resources/ThemedComponents";
import { mixHexColors } from "@utils/colorMix";

// The ring, and the gap between it and the picture, in dp.
const RING_WIDTH = 2.5;
const RING_GAP = 2;

// Gold is the records' gold; silver and bronze are the trophy room's.
const MEDAL_TOKENS = {
  gold: "record",
  silver: "medalSilver",
  bronze: "medalBronze",
};

/** A medal's colour in `theme`: "gold", "silver" or "bronze". */
export function medalColor(theme, medal) {
  return theme[MEDAL_TOKENS[medal] ?? MEDAL_TOKENS.gold];
}

/**
 * A picture in a medal ring - gold for #1 on a category card, and the
 * podium's three on the category page. The ring is the medal colour as metal:
 * pulled toward the page at one end and toward the ink at the other, so it
 * catches light in both themes, drawn with react-native-svg because the app
 * has no gradient module. `size` is the picture; the gap and the ring sit
 * outside it, so the whole is `size + 9`.
 */
export default function MedalAvatar({ uri, size = 40, medal = "gold" }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // React 19 ids carry characters an SVG url(#...) reference cannot.
  const gradientId = `medal-ring-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const color = medalColor(theme, medal);
  const outer = size + 2 * (RING_WIDTH + RING_GAP);

  return (
    <View style={[styles.frame, { width: outer, height: outer }]}>
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={mixHexColors(color, theme.background, 0.28)} />
            <Stop offset="1" stopColor={mixHexColors(color, theme.title, 0.22)} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={(outer - RING_WIDTH) / 2}
          stroke={`url(#${gradientId})`}
          strokeWidth={RING_WIDTH}
          fill="none"
        />
      </Svg>
      <UserAvatar uri={uri} size={size} iconSize={Math.round(size * 0.4)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
  },
});
