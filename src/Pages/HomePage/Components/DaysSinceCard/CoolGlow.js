import { useId } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { EASE_IN_OUT, ease, loopProgress } from "@utils/keyframeTimeline";

// The embers' last glow, over the bottom 70 % of the card, breathing slowly.
const GLOW_FROM = 0.3;
const BREATH_MS = 3200;

/**
 * Cooling, behind the content: what is left of the fire, glowing up from
 * the bottom - warm the first days, cooling towards grey by the fourth week
 * (coolLook) - and rising and falling a little as it breathes.
 */
export default function CoolGlow({ frame, color, opacity, clock, still }) {
  const id = `${useId().replace(/:/g, "")}glow`;
  const top = frame.height * GLOW_FROM;
  const height = frame.height - top;
  const style = useAnimatedStyle(() => {
    const breath = ease(
      EASE_IN_OUT,
      loopProgress(still ? STILL_MS : clock.value, 0, BREATH_MS, "alternate")
    );

    return {
      opacity: 0.65 + 0.35 * breath,
      transform: [{ scaleY: 0.92 + 0.13 * breath }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        glowStyles.glow,
        { top, width: frame.width, height, transformOrigin: [frame.width / 2, height, 0] },
        style,
      ]}
    >
      <Svg width={frame.width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={frame.width} height={height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const glowStyles = StyleSheet.create({
  glow: {
    position: "absolute",
    left: 0,
  },
});
