import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { WAVE_LENGTH, wavePath } from "@utils/daysSinceCard";
import { EASE_IN, ease, loopProgress, onceProgress, sampleTrack } from "@utils/keyframeTimeline";

// The fill rises into place from the bottom on the way in.
const RISE_DELAY_MS = 300;
const RISE_MS = 1300;
const RISE_CURVE = [0.2, 0.8, 0.3, 1];
// Two waves on its surface, each sliding one wave to the left per loop.
const WAVES = [
  { lift: 2, opacity: 0.1, periodMs: 3600 },
  { lift: 0, opacity: 0.14, periodMs: 2200 },
];
const BUBBLE_OPACITY = [
  [0, 0],
  [0.2, 0.9],
  [1, 0],
];

function Wave({ wave, top, frame, color, clock, still }) {
  const { periodMs } = wave;
  const d = useMemo(
    () => wavePath(top + wave.lift, frame.width, frame.height),
    [frame.height, frame.width, top, wave.lift]
  );
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -WAVE_LENGTH * loopProgress(still ? STILL_MS : clock.value, 0, periodMs) },
    ],
  }));
  // The path runs from a wave before the card to two waves past it.
  const width = frame.width + WAVE_LENGTH * 3;

  return (
    <Animated.View style={[chargeStyles.wave, { width, height: frame.height }, style]}>
      <Svg width={width} height={frame.height} viewBox={`${-WAVE_LENGTH} 0 ${width} ${frame.height}`}>
        <Path d={d} fill={color} fillOpacity={wave.opacity} />
      </Svg>
    </Animated.View>
  );
}

function Bubble({ bubble, frame, color, clock, still }) {
  const { durationMs, delayMs, rise } = bubble;
  const style = useAnimatedStyle(() => {
    const p = loopProgress(still ? STILL_MS : clock.value, delayMs, durationMs);

    return {
      opacity: sampleTrack(BUBBLE_OPACITY, p, EASE_IN),
      transform: [{ translateY: rise * ease(EASE_IN, p) }],
    };
  });
  const size = bubble.radius * 2;

  return (
    <Animated.View
      style={[
        chargeStyles.bubble,
        {
          left: bubble.cx - bubble.radius,
          top: frame.height - 3 - bubble.radius,
          width: size,
          height: size,
          borderRadius: bubble.radius,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Charged, behind the content: the card filled with energy as far as the
 * charge still reaches - to the top the day after, a fifth of the way on the
 * fifth day - rising into place, with two waves sliding on its surface and
 * bubbles going up through it.
 */
export default function ChargeSurface({ layout, frame, theme, clock, entry, still }) {
  const drop = frame.height - layout.top;
  const fill = useAnimatedStyle(() => {
    const t = onceProgress(entry.value, RISE_DELAY_MS, RISE_MS);

    return { transform: [{ translateY: drop * (1 - ease(RISE_CURVE, t)) }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, fill]}>
        {WAVES.map((wave) => (
          <Wave
            key={wave.periodMs}
            wave={wave}
            top={layout.top}
            frame={frame}
            color={theme.charge}
            clock={clock}
            still={still}
          />
        ))}
        {layout.bubbles.map((bubble, index) => (
          <Bubble
            key={index}
            bubble={bubble}
            frame={frame}
            color={bubble.core ? theme.chargeCore : theme.charge}
            clock={clock}
            still={still}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const chargeStyles = StyleSheet.create({
  wave: {
    position: "absolute",
    top: 0,
    left: -WAVE_LENGTH,
  },
  bubble: {
    position: "absolute",
  },
});
