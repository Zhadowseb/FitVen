import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { buildCobwebGeometry } from "@utils/cobwebGeometry";
import { DAYS_SINCE_SEED } from "@utils/daysSinceCard";
import { EASE_IN_OUT, loopProgress, sampleTrack } from "@utils/keyframeTimeline";

// The design hangs webs in the top left and the bottom right.
const WEB_CORNERS = new Set(["topLeft", "bottomRight"]);
const CARD_RADIUS = 18;

// Dust drifting to and fro in the still air.
const DUST_SIZE = 2;
const DUST_OPACITY = 0.4;
const DRIFT = [
  [0, 0],
  [1, 1],
];

// The spider lets itself down on its thread over seven seconds, waits, and
// climbs back up, swaying as it goes. It hangs 13 dp in from the right, its
// thread running up out of the card.
const SPIDER_SIZE = 10;
const THREAD = 64;
const SPIDER_RIGHT = 13;
const DANGLE_DELAY_MS = 800;
const DANGLE_MS = 7000;
const DANGLE = [
  [0, 8],
  [0.45, 52],
  [0.55, 52],
  [1, 8],
];
const SWAY_MS = 1400;
const SWAY = [
  [0, -8],
  [0.5, 8],
  [1, -8],
];
const SPIDER_LEGS = "M3.6 5 1 3.5M3.6 6 .5 6M3.6 7 1 9M4 7.6 2.4 10M6.4 5 9 3.5M6.4 6 9.5 6M6.4 7 9 9M6 7.6 7.6 10";

function Speck({ speck, color, clock, still }) {
  const { dx, dy, durationMs, delayMs } = speck;
  const style = useAnimatedStyle(() => {
    const p = loopProgress(still ? STILL_MS : clock.value, delayMs, durationMs, "alternate");
    const along = sampleTrack(DRIFT, p, EASE_IN_OUT);

    return { transform: [{ translateX: dx * along }, { translateY: dy * along }] };
  });

  return (
    <Animated.View
      style={[
        cobwebStyles.speck,
        { left: speck.left, top: speck.top, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Spider({ color, clock, still }) {
  const dangle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: sampleTrack(
          DANGLE,
          loopProgress(still ? STILL_MS : clock.value, DANGLE_DELAY_MS, DANGLE_MS),
          EASE_IN_OUT
        ),
      },
    ],
  }));
  const sway = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${sampleTrack(SWAY, loopProgress(still ? STILL_MS : clock.value, 0, SWAY_MS), EASE_IN_OUT)}deg`,
      },
    ],
  }));

  return (
    <Animated.View style={[cobwebStyles.spider, dangle]}>
      <View style={[cobwebStyles.thread, { backgroundColor: color }]} />
      <Animated.View style={[cobwebStyles.body, sway]}>
        <Svg width={SPIDER_SIZE} height={SPIDER_SIZE} viewBox="0 0 10 10">
          <G fill="none" stroke={color} strokeWidth={0.8} strokeLinecap="round">
            <Path d={SPIDER_LEGS} />
          </G>
          <Circle cx={5} cy={3.2} r={1.3} fill={color} />
          <Circle cx={5} cy={6.4} r={2} fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A month or more gone, over the content: old webs in the top left and the
 * bottom right corners (the friend tiles' webs, from cobwebGeometry), dust
 * hanging in the air, and a spider that has moved in.
 *
 * `box` is the padding box, the webs' corners; `frame` the card's outer
 * size, which the dust is scattered over.
 */
export default function CobwebSurface({ box, dust, theme, accent, clock, still }) {
  const geometry = useMemo(
    () =>
      buildCobwebGeometry({
        width: box.width,
        height: box.height,
        seed: DAYS_SINCE_SEED,
        cornerRadius: CARD_RADIUS,
      }),
    [box.height, box.width]
  );
  const silk = theme.cobweb;
  const webs = geometry ? geometry.webs.filter((web) => WEB_CORNERS.has(web.corner)) : [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={box.width} height={box.height}>
        {webs.map((web) => (
          <G key={web.corner}>
            {web.sheets ? <Path d={web.sheets} fill={silk} fillOpacity={0.07} /> : null}
            <Path d={`${web.spokes} ${web.rings}`} stroke={silk} strokeOpacity={0.1} strokeWidth={1.8} fill="none" />
            <Path d={web.spokes} stroke={silk} strokeOpacity={0.5} strokeWidth={0.55} strokeLinecap="round" fill="none" />
            <Path d={web.rings} stroke={silk} strokeOpacity={0.42} strokeWidth={0.42} strokeLinecap="round" fill="none" />
            {web.doubled ? (
              <Path d={web.doubled} stroke={silk} strokeOpacity={0.22} strokeWidth={0.35} fill="none" />
            ) : null}
            {web.loose ? (
              <Path d={web.loose} stroke={silk} strokeOpacity={0.4} strokeWidth={0.4} fill="none" />
            ) : null}
          </G>
        ))}
      </Svg>

      <Spider color={theme.quietText} clock={clock} still={still} />

      {dust.map((speck, index) => (
        <Speck key={index} speck={speck} color={accent} clock={clock} still={still} />
      ))}
    </View>
  );
}

const cobwebStyles = StyleSheet.create({
  speck: {
    position: "absolute",
    width: DUST_SIZE,
    height: DUST_SIZE,
    borderRadius: DUST_SIZE / 2,
    opacity: DUST_OPACITY,
  },
  spider: {
    position: "absolute",
    right: SPIDER_RIGHT,
    top: -THREAD,
    width: SPIDER_SIZE,
    alignItems: "center",
  },
  thread: {
    width: 1,
    height: THREAD,
    opacity: 0.5,
  },
  body: {
    width: SPIDER_SIZE,
    height: SPIDER_SIZE,
    transformOrigin: [SPIDER_SIZE / 2, 0, 0],
  },
});
