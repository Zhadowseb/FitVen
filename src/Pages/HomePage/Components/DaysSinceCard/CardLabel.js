import Animated, { useAnimatedStyle } from "react-native-reanimated";

import styles from "./DaysSinceCardStyle";
import { ThemedText } from "@resources/ThemedComponents";
import { EASE_IN_OUT, EASE_OUT, ease, loopProgress, onceProgress, sampleTrack } from "@utils/keyframeTimeline";

// The label settles in last: it fades up from 4 dp below with its letters
// drawing together. The design widens the letter spacing for that; spacing
// would re-lay the text out every frame, so a slight stretch stands in for it.
const LABEL_DELAY_MS = 700;
const LABEL_MS = 420;
const LABEL_RISE = 4;
const LABEL_STRETCH = 0.12;
// Training now: the label breathes.
const PULSE_DELAY_MS = 1100;
const PULSE_MS = 1400;
const PULSE = [
  [0, 1],
  [0.5, 0.55],
  [1, 1],
];
const LABEL_REST = { opacity: 1, transform: [{ translateY: 0 }, { scaleX: 1 }] };

/**
 * The words under the number. `pulse` for training now, when the label
 * takes the fire's colour and breathes; the clock it is given decides what
 * it listens to - the entrance only, or the loop as well.
 */
export default function CardLabel({ text, color, pulse, time, still }) {
  const style = useAnimatedStyle(() => {
    if (still) {
      return LABEL_REST;
    }

    const now = time.value;
    const t = onceProgress(now, LABEL_DELAY_MS, LABEL_MS);

    if (pulse && now >= PULSE_DELAY_MS) {
      return {
        opacity: sampleTrack(PULSE, loopProgress(now, PULSE_DELAY_MS, PULSE_MS), EASE_IN_OUT),
        transform: [{ translateY: 0 }, { scaleX: 1 }],
      };
    }

    if (t >= 1) {
      return LABEL_REST;
    }

    const e = ease(EASE_OUT, t);

    return {
      opacity: e,
      transform: [{ translateY: LABEL_RISE * (1 - e) }, { scaleX: 1 + LABEL_STRETCH * (1 - e) }],
    };
  });

  return (
    <Animated.View style={style}>
      <ThemedText style={styles.label} setColor={color}>
        {text}
      </ThemedText>
    </Animated.View>
  );
}
