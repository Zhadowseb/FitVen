import { useRef } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { Colors } from "@resources/GlobalStyling/colors";
import { UserAvatar } from "@resources/ThemedComponents";

let ringInstanceCounter = 0;

// The ring's two ends, as theme tokens: gold runs from the gold to its light
// shade (one colour in the light palette, where both are darkened to read);
// silver, bronze and your own ring are one colour each.
const MEDAL_TOKENS = {
  gold: ["record", "recordLight"],
  silver: ["medalSilver", "medalSilver"],
  bronze: ["medalBronze", "medalBronze"],
  me: ["primary", "primary"],
};

/**
 * A picture in a medal ring - gold for #1 on a category card, and the podium's
 * three on the category page. `size` is the picture; the ring and a 1 dp gap
 * sit outside it.
 */
export default function MedalAvatar({ uri, size = 40, medal = "gold", ringWidth = 2, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Ids are global in the SVG runtime, so one per mounted ring.
  const gradientId = useRef(`medal-ring-${++ringInstanceCounter}`).current;
  const [fromToken, toToken] = MEDAL_TOKENS[medal] ?? MEDAL_TOKENS.gold;
  const outer = size + (ringWidth + 1) * 2;

  return (
    <View style={[styles.shell, { width: outer, height: outer }, style]}>
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={theme[fromToken]} />
            <Stop offset="1" stopColor={theme[toToken]} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={(outer - ringWidth) / 2}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={ringWidth}
        />
      </Svg>
      <UserAvatar uri={uri} size={size} iconSize={Math.round(size * 0.42)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
  },
});
