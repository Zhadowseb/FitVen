import { useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useBreathAnimation } from "../animationHooks";

let glowInstanceCounter = 0;

/**
 * A soft glow welling up from the bottom of a tile and breathing: the base
 * the embers, the steam and the charge all stand on. `inner` is the colour
 * at its heart, `outer` the colour it fades out through.
 */
export default function TileGlow({
  inner,
  outer,
  strength = 0.55,
  height = 96,
  periodMs = 1300,
  low = 0.62,
  animate = false,
}) {
  const glowId = useRef(`tile-glow-${++glowInstanceCounter}`).current;
  const breath = useBreathAnimation(animate, { periodMs, low });

  return (
    <Animated.View style={[styles.glow, { height, opacity: breath }]}>
      {/* Stretched on purpose: the circle becomes a low, wide ellipse. */}
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="85%" r="60%">
            <Stop offset="0" stopColor={inner} stopOpacity={strength} />
            <Stop offset="0.45" stopColor={outer} stopOpacity={strength * 0.4} />
            <Stop offset="1" stopColor={outer} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${glowId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    left: -24,
    right: -24,
    bottom: -20,
  },
});
