import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import styles from "./LivePanelStyle";
import { withAlpha } from "@resources/GlobalStyling/colors";

// A bar fills in over 650 ms, a moment after the panel changes; the next set
// glows, and breathes.
const FILL_MS = 650;
const FILL_DELAY_MS = 150;
const FILL_CURVE = Easing.bezier(0.2, 0.8, 0.3, 1);
const GLOW_MS = 700;
// Next to nothing rather than nothing: a scale of 0 is a matrix Android
// cannot take apart.
const EMPTY = 0.001;

function Bar({ filled, now, fills, accent, animate, visible }) {
  const fill = useSharedValue(filled && !fills ? 1 : EMPTY);
  const glow = useSharedValue(0);
  // Whether this bar has been drawn full: then it stays full, whatever the
  // panel decides about filling bars later.
  const drawnRef = useRef(filled && !fills);

  useEffect(() => {
    if (!filled) {
      cancelAnimation(fill);
      fill.value = EMPTY;
      drawnRef.current = false;
      return;
    }

    if (drawnRef.current) {
      return;
    }

    // Filled while nobody was looking: it waits, empty, to fill in when seen.
    if (fills && !visible) {
      fill.value = EMPTY;
      return;
    }

    drawnRef.current = true;

    if (fills && animate) {
      fill.value = EMPTY;
      fill.value = withDelay(FILL_DELAY_MS, withTiming(1, { duration: FILL_MS, easing: FILL_CURVE }));
    } else {
      fill.value = 1;
    }
  }, [animate, fill, filled, fills, visible]);

  useEffect(() => {
    cancelAnimation(glow);

    if (!now) {
      glow.value = 0;
      return undefined;
    }

    if (!animate) {
      glow.value = 0.6;
      return undefined;
    }

    glow.value = 0;
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: GLOW_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: GLOW_MS, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    return () => cancelAnimation(glow);
  }, [animate, glow, now]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value <= EMPTY ? 0 : 1,
    transform: [{ scaleX: fill.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.bar}>
      {now ? (
        <Animated.View
          style={[styles.barGlow, { backgroundColor: withAlpha(accent, 0.35) }, glowStyle]}
        />
      ) : null}
      <View style={[styles.barTrack, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: accent }, fillStyle]} />
      </View>
    </View>
  );
}

/**
 * One bar per set of the exercise, right under its name: the sets done
 * filled, the next one glowing. `fills` are the bars done since the panel
 * last showed them - the sets finished on the workout screen - which fill in
 * when they are seen; the rest are drawn as they are.
 */
export default function SetBars({ bars, fills = [], accent, animate, visible = true }) {
  if (!bars.length) {
    return null;
  }

  return (
    <View
      style={styles.bars}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {bars.map((bar, index) => (
        <Bar
          key={index}
          filled={bar.filled}
          now={bar.now}
          fills={fills.includes(index)}
          accent={accent}
          animate={animate}
          visible={visible}
        />
      ))}
    </View>
  );
}
