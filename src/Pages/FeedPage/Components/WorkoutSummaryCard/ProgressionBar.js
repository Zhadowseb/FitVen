import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const BAR_HEIGHT = 4;
const GROW_DURATION_MS = 420;
const STAGGER_MS = 40;

let barInstanceCounter = 0;

function BarFill({ width, fromColor, fromOpacity, toColor, toOpacity }) {
  const gradientId = useRef(`bar-fill-${++barInstanceCounter}`).current;

  return (
    <Svg
      width={width}
      height={BAR_HEIGHT}
      style={styles.fillGradient}
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={fromColor} stopOpacity={fromOpacity} />
          <Stop offset="100%" stopColor={toColor} stopOpacity={toOpacity} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/**
 * The day's top weight measured against the user's previous best in that
 * exercise. A record fills the whole track in gold; below a record the orange
 * deepens the closer the lift got.
 */
export default function ProgressionBar({
  ratio,
  isRecord,
  index = 0,
  trackColor,
  accentColor,
  goldFrom,
  goldTo,
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const grow = useSharedValue(0);
  // A null ratio means the baseline is unknown; the track then stays empty
  // rather than claiming a distance to a record nobody measured.
  const hasRatio = ratio !== null && ratio !== undefined;
  const safeRatio = hasRatio ? Math.max(0, Math.min(1, Number(ratio) || 0)) : 0;
  const targetWidth = trackWidth * (isRecord ? 1 : safeRatio);

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    grow.value = withDelay(
      index * STAGGER_MS,
      withTiming(targetWidth, { duration: GROW_DURATION_MS })
    );
  }, [grow, index, targetWidth, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: grow.value }));

  // Reference points from the design: 80% -> 0.44, 85% -> 0.58, 94% -> 0.83.
  const endOpacity = isRecord
    ? 1
    : Math.max(0.3, Math.min(1, 0.3 + (0.7 * (safeRatio - 0.75)) / 0.25));

  return (
    <View
      onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: trackColor }]}
    >
      <Animated.View
        style={[
          styles.fill,
          // Solid fallback underneath, so the bar still reads if the gradient
          // fails to paint.
          { backgroundColor: isRecord ? goldTo : accentColor },
          fillStyle,
        ]}
      >
        {targetWidth > 0 ? (
          <BarFill
            width={targetWidth}
            fromColor={isRecord ? goldFrom : accentColor}
            fromOpacity={isRecord ? 1 : 0.18}
            toColor={isRecord ? goldTo : accentColor}
            toOpacity={endOpacity}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  fillGradient: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
