import Animated, { useAnimatedStyle } from "react-native-reanimated";

import styles from "./DaysSinceCardStyle";
import { ThemedText } from "@resources/ThemedComponents";
import { EASE_IN_OUT, clamp01, ease, loopProgress, mix, onceProgress, sampleTrack } from "@utils/keyframeTimeline";

const POP = [0.34, 1.56, 0.64, 1];
const POP_IN_DELAY_MS = 560;
const POP_IN_MS = 460;
// It blinks each time the unlit flame above it has finished drawing itself.
const BLINK_MS = 3600;
const BLINK = [
  [0, 1],
  [0.5, 1],
  [0.6, 0.35],
  [0.7, 1],
  [1, 1],
];
const DASH_REST = { opacity: 1, transform: [{ scale: 1 }] };

/** No workouts yet: a dash, never a zero, popping in and blinking with the flame. */
export default function NeverDash({ text, color, clock, still }) {
  const style = useAnimatedStyle(() => {
    if (still) {
      return DASH_REST;
    }

    const time = clock.value;
    const pop = ease(POP, onceProgress(time, POP_IN_DELAY_MS, POP_IN_MS));
    const blink = sampleTrack(BLINK, loopProgress(time, 0, BLINK_MS), EASE_IN_OUT);

    // Between blinks it rests - the same object, so nothing is sent.
    if (pop === 1 && blink === 1) {
      return DASH_REST;
    }

    return {
      opacity: clamp01(pop) * blink,
      transform: [{ scale: mix(0.3, 1, pop) }],
    };
  });

  return (
    <Animated.View style={style}>
      <ThemedText style={styles.value} setColor={color}>
        {text}
      </ThemedText>
    </Animated.View>
  );
}
