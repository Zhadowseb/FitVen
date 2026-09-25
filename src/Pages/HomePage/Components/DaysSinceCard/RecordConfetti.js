import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { EASE_IN_OUT, ease, loopProgress, onceProgress, sampleTrack } from "@utils/keyframeTimeline";

// Confetti leaves from the crown, 24 dp down the card: out and up for the
// first quarter, then spinning down and out through the bottom, 130 dp below.
const CONFETTI_TOP = 24;
const CONFETTI_FALL = 130;
const CONFETTI_CURVE = [0.2, 0.6, 0.4, 1];
const CONFETTI_TURN = 0.25;
const HIDDEN = { opacity: 0 };

// A glint: a four-pointed star that turns and flashes, then waits.
const GLINT = "M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4z";
const GLINT_MS = 2600;
// Next to nothing rather than nothing: a scale of 0 is a matrix Android
// cannot take apart.
const GLINT_SCALE = [
  [0, 0.001],
  [0.15, 1],
  [0.3, 0.001],
  [1, 0.001],
];
const GLINT_ROTATE = [
  [0, 0],
  [0.15, 45],
  [0.3, 90],
  [1, 0],
];
const GLINT_OPACITY = [
  [0, 0],
  [0.15, 1],
  [0.3, 0],
  [1, 0],
];

function Confetti({ piece, left, color, entry }) {
  const { x, up, rotate, durationMs, delayMs } = piece;
  const style = useAnimatedStyle(() => {
    const time = entry.value;
    const t = onceProgress(time, delayMs, durationMs);

    if (time < delayMs || t >= 1) {
      return HIDDEN;
    }

    // Two stretches, each eased on its own, as the design's keyframes are.
    const rising = t <= CONFETTI_TURN;
    const e = ease(CONFETTI_CURVE, rising ? t / CONFETTI_TURN : (t - CONFETTI_TURN) / (1 - CONFETTI_TURN));

    return {
      opacity: rising ? 1 : 1 - e,
      transform: [
        { translateX: rising ? 0.7 * x * e : x * (0.7 + 0.3 * e) },
        { translateY: rising ? up * e : up + (CONFETTI_FALL - up) * e },
        { rotate: `${rising ? 0.4 * rotate * e : rotate * (0.4 + 0.6 * e)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[confettiStyles.piece, { left, backgroundColor: color }, style]} />
  );
}

function Glint({ spark, color, clock, still }) {
  const { delayMs } = spark;
  const style = useAnimatedStyle(() => {
    const time = still ? STILL_MS : clock.value;

    if (time < delayMs) {
      return HIDDEN;
    }

    const p = loopProgress(time, delayMs, GLINT_MS);

    if (p >= 0.3) {
      return HIDDEN;
    }

    return {
      opacity: sampleTrack(GLINT_OPACITY, p, EASE_IN_OUT),
      transform: [
        { scale: sampleTrack(GLINT_SCALE, p, EASE_IN_OUT) },
        { rotate: `${sampleTrack(GLINT_ROTATE, p, EASE_IN_OUT)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[confettiStyles.glint, { left: spark.left, top: spark.top }, style]}>
      <Svg width={8} height={8} viewBox="0 0 10 10">
        <Path d={GLINT} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A record, over the content: 24 pieces of confetti burst out as the crown
 * lands - gold, green, ruby and deep gold - then gold glints come and go
 * across the card. The confetti is part of the entrance, so it is over, and
 * nowhere to be seen, whenever the card is still.
 */
export default function RecordConfetti({ layout, box, colors, clock, entry, still }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layout.confetti.map((piece, index) => (
        <Confetti
          key={index}
          piece={piece}
          left={box.width / 2}
          color={colors.confetti[piece.tone]}
          entry={entry}
        />
      ))}
      {layout.glitter.map((spark, index) => (
        <Glint key={index} spark={spark} color={colors.glint} clock={clock} still={still} />
      ))}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  piece: {
    position: "absolute",
    top: CONFETTI_TOP,
    width: 4,
    height: 7,
    borderRadius: 1,
  },
  glint: {
    position: "absolute",
    width: 8,
    height: 8,
  },
});
