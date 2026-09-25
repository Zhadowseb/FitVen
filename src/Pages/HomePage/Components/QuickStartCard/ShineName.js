import { useEffect, useState } from "react";
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
import { ThemedText } from "@resources/ThemedComponents";

// The design runs a gradient across the name every 1.8 s: the light crosses
// it in the first third and is gone for the rest.
const CYCLE_MS = 1800;
const SWEEP_MS = 600;
// A soft light, as two bands: a wide faint one round a narrow bright one.
const BANDS = [
  { share: 0.6, opacity: 0.45 },
  { share: 0.24, opacity: 1 },
];

// One band: a window moving across the name that shows it again in the
// light colour. The window moves one way and the name inside it the other,
// so the name stays put and only the light travels.
function Band({ band, width, text, style, shine, sweep }) {
  const bandWidth = Math.max(1, width * band.share);
  const travel = width + bandWidth;
  const outer = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + travel * sweep.value }],
  }));
  const inner = useAnimatedStyle(() => ({
    transform: [{ translateX: bandWidth - travel * sweep.value }],
  }));

  return (
    <Animated.View style={[styles.shineBand, { width: bandWidth, opacity: band.opacity }, outer]}>
      <Animated.View style={[{ width }, inner]}>
        <ThemedText style={style} setColor={shine} numberOfLines={1}>
          {text}
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A new record's name, with a shine running across it - in the record's
 * light gold over its deep gold, as the record star has it. Still, it is
 * just the name.
 */
export default function ShineName({ text, style, color, shine, animate }) {
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sweep);
    sweep.value = 0;

    if (!animate) {
      return undefined;
    }

    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
        withDelay(CYCLE_MS - SWEEP_MS, withTiming(0, { duration: 0 }))
      ),
      -1
    );

    return () => cancelAnimation(sweep);
  }, [animate, sweep]);

  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);

        setWidth((current) => (current === next ? current : next));
      }}
    >
      <ThemedText style={style} setColor={color} numberOfLines={1}>
        {text}
      </ThemedText>
      {animate && width > 0
        ? BANDS.map((band) => (
            <Band
              key={band.share}
              band={band}
              width={width}
              text={text}
              style={style}
              shine={shine}
              sweep={sweep}
            />
          ))
        : null}
    </View>
  );
}
