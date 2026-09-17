import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

let glowInstanceCounter = 0;

/**
 * A coloured haze behind a card corner. Gold for a verified record, the
 * accent for an unverified one. Purely decorative; the parent card clips it,
 * so the parent needs overflow hidden.
 */
export default function RadialGlow({
  color,
  width = 260,
  height = 220,
  top = -90,
  right = -70,
  left,
  centerOpacity = 0.3,
  midOpacity = 0.08,
}) {
  const gradientId = useRef(`radial-glow-${++glowInstanceCounter}`).current;
  const placement =
    left === undefined ? { top, right } : { top, left };

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Svg width={width} height={height} style={[styles.svg, placement]}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={centerOpacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={midOpacity} />
            <Stop offset="78%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  svg: {
    position: "absolute",
  },
});
