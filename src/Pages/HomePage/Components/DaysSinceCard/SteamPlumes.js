import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { plumePath } from "@utils/daysSinceCard";
import { EASE_IN_OUT, loopProgress, sampleTrack } from "@utils/keyframeTimeline";

// A plume is an S of steam 42 dp tall, drawn in a 16 x 48 box from its foot
// at (8, 46). It wells up from 18 dp below its place and drifts off 46 dp
// above it, strongest a quarter of the way.
const BOX_WIDTH = 16;
const BOX_HEIGHT = 48;
const FOOT = { x: 8, y: 46 };
const PLUME = plumePath(FOOT.x, FOOT.y);
const RISE_FROM = 18;
const RISE_TO = -46;
const RISE = [
  [0, 0],
  [1, 1],
];
// Relative to the plume's own opacity.
const FADE = [
  [0, 0],
  [0.25, 1],
  [0.8, 0.4],
  [1, 0],
];

function Plume({ plume, baseY, color, opacity, clock, still }) {
  const { durationMs, delayMs, drift } = plume;
  const style = useAnimatedStyle(() => {
    const p = loopProgress(still ? STILL_MS : clock.value, delayMs, durationMs);
    const along = sampleTrack(RISE, p, EASE_IN_OUT);

    return {
      opacity: opacity * sampleTrack(FADE, p, EASE_IN_OUT),
      transform: [
        { translateX: drift * along },
        { translateY: RISE_FROM + (RISE_TO - RISE_FROM) * along },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        plumeStyles.plume,
        { left: plume.x - FOOT.x, top: baseY - FOOT.y },
        style,
      ]}
    >
      <Svg width={BOX_WIDTH} height={BOX_HEIGHT}>
        <Path d={PLUME} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Steam rising across the card the day you trained - smoke, slower and
 * fainter, while it cools. Behind the content; `plumes` from buildPlumes,
 * their feet 4 dp above the bottom of the card's outer `frame`.
 */
export default function SteamPlumes({ plumes, frame, color, opacity, clock, still }) {
  const baseY = frame.height - 4;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {plumes.map((plume, index) => (
        <Plume
          key={index}
          plume={plume}
          baseY={baseY}
          color={color}
          opacity={opacity}
          clock={clock}
          still={still}
        />
      ))}
    </View>
  );
}

const plumeStyles = StyleSheet.create({
  plume: {
    position: "absolute",
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  },
});
