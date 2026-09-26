import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { UserAvatar } from "@resources/ThemedComponents";

/**
 * A podium picture inside a two-tone medal ring - the spec's gold, silver and
 * bronze gradients, drawn with react-native-svg because the app has no
 * gradient module. `colors` is [from, to], top left to bottom right.
 */
export default function RingAvatar({ uri, size, colors, ringWidth = 2.5, gap = 2 }) {
  // React 19 ids carry characters an SVG url(#...) reference cannot.
  const gradientId = `medal-ring-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const outer = size + 2 * (ringWidth + gap);
  const [from, to] = colors;

  return (
    <View style={[styles.frame, { width: outer, height: outer }]}>
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={(outer - ringWidth) / 2}
          stroke={`url(#${gradientId})`}
          strokeWidth={ringWidth}
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
