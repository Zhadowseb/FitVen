import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { DRAW_MS } from "./StateIcon";
import { EASE_OUT, loopProgress, sampleTrack } from "@utils/keyframeTimeline";

// The flint strikes the moment the unlit flame has drawn itself - just past
// half-way through each drawing - and its sparks die before they catch.
const SPARK_SIZE = 2.5;
const SPARK_TOP = 24;
const SPARK_SHOW = 0.52;
const SPARK_GONE = 0.64;
const SPARK_ALONG = [
  [0, 0],
  [SPARK_SHOW, 0],
  [SPARK_GONE, 1],
  [1, 0],
];
const SPARK_OPACITY = [
  [0, 0],
  [SPARK_SHOW, 0],
  [0.53, 1],
  [SPARK_GONE, 0],
  [1, 0],
];
const HIDDEN = { opacity: 0 };

function Spark({ spark, left, color, clock, still }) {
  const { x, y, delayMs } = spark;
  const style = useAnimatedStyle(() => {
    if (still) {
      return HIDDEN;
    }

    const p = loopProgress(clock.value, delayMs, DRAW_MS);

    if (p <= SPARK_SHOW || p >= SPARK_GONE) {
      return HIDDEN;
    }

    const along = sampleTrack(SPARK_ALONG, p, EASE_OUT);

    return {
      opacity: sampleTrack(SPARK_OPACITY, p, EASE_OUT),
      transform: [{ translateX: x * along }, { translateY: y * along }],
    };
  });

  return (
    <Animated.View style={[sparkStyles.spark, { left, backgroundColor: color }, style]} />
  );
}

/** No workouts yet, over the content: a flint trying to light the flame. */
export default function NeverSparks({ sparks, box, color, clock, still }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparks.map((spark, index) => (
        <Spark
          key={index}
          spark={spark}
          left={box.width / 2 - SPARK_SIZE / 2}
          color={color}
          clock={clock}
          still={still}
        />
      ))}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  spark: {
    position: "absolute",
    top: SPARK_TOP,
    width: SPARK_SIZE,
    height: SPARK_SIZE,
    borderRadius: SPARK_SIZE / 2,
  },
});
