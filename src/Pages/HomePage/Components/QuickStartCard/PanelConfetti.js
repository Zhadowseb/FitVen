import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import styles from "./LivePanelStyle";
import { cubicBezier } from "@utils/keyframeTimeline";

const PIECES = 22;
// The longest piece is 1.3 s; the burst's own clock runs a touch past it.
const BURST_MS = 1400;

// A small, fast, seedable generator, so the burst is the same every time.
function seededRandom(seed) {
  let state = (Math.trunc(Number(seed) || 0) * 9973 + 17) >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPieces(seed) {
  const random = seededRandom(seed);
  const between = (low, high) => low + random() * (high - low);

  return Array.from({ length: PIECES }, (_, index) => ({
    tone: index % 4,
    x: Math.round(between(-120, 120)),
    y: Math.round(between(-50, 50)),
    rotate: Math.round(between(180, 720)),
    durationMs: Math.round(between(700, 1300)),
  }));
}

function Piece({ piece, color, clock }) {
  const { x, y, rotate, durationMs } = piece;
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, clock.value / durationMs);

    if (t >= 1) {
      return { opacity: 0 };
    }

    // The design's cubic-bezier(.2,.6,.4,1).
    const e = cubicBezier(0.2, 0.6, 0.4, 1, t);

    return {
      opacity: 1 - e,
      transform: [{ translateX: x * e }, { translateY: y * e }, { rotate: `${rotate * e}deg` }],
    };
  });

  return <Animated.View style={[styles.confetti, { backgroundColor: color }, style]} />;
}

/**
 * A new record: confetti bursts out of the middle of the panel, in the
 * record's golds, the fire and green, and is gone in a little over a second.
 */
export default function PanelConfetti({ colors, seed = 11 }) {
  const pieces = useMemo(() => buildPieces(seed), [seed]);
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withTiming(BURST_MS, { duration: BURST_MS, easing: Easing.linear });

    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece, index) => (
        <Piece key={index} piece={piece} color={colors[piece.tone]} clock={clock} />
      ))}
    </View>
  );
}
