import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { flarePhase, tongueRowPath } from "@utils/daysSinceCard";
import {
  EASE_IN_OUT,
  EASE_OUT,
  ease,
  loopProgress,
  onceProgress,
  sampleTrack,
} from "@utils/keyframeTimeline";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The heat glows up, then pulses, a little bigger and brighter every 560 ms.
const HEAT_IN_DELAY_MS = 300;
const HEAT_IN_MS = 600;
const HEAT_IN_TO = 0.55;
const HEAT_PULSE_DELAY_MS = 900;
const HEAT_PULSE_MS = 560;
const FLASH_TRACK = [
  [0, 0],
  [0.05, 0.55],
  [0.26, 0],
  [1, 0],
];
// The tongues rise into place from 28 dp down.
const ROW_RISE = 28;
const ROW_DELAY_MS = 250;
const ROW_MS = 700;

// Both glows centre at the middle of the card, 60 % of the way down.
function glowCircle(box) {
  const cx = box.width / 2;
  const cy = box.height * 0.6;

  return { cx, cy, r: Math.hypot(Math.max(cx, box.width - cx), Math.max(cy, box.height - cy)) };
}

function Heat({ box, color, clock, still }) {
  const id = `${useId().replace(/:/g, "")}heat`;
  const circle = glowCircle(box);
  const style = useAnimatedStyle(() => {
    if (still) {
      return { opacity: HEAT_IN_TO, transform: [{ scale: 1 }] };
    }

    const time = clock.value;

    if (time < HEAT_PULSE_DELAY_MS) {
      return {
        opacity: HEAT_IN_TO * ease(EASE_OUT, onceProgress(time, HEAT_IN_DELAY_MS, HEAT_IN_MS)),
        transform: [{ scale: 1 }],
      };
    }

    const pulse = ease(EASE_IN_OUT, loopProgress(time, HEAT_PULSE_DELAY_MS, HEAT_PULSE_MS, "alternate"));

    return { opacity: 0.4 + 0.3 * pulse, transform: [{ scale: 1 + 0.06 * pulse }] };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box.width} height={box.height}>
        <Defs>
          <RadialGradient
            id={id}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fx={circle.cx}
            fy={circle.cy}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={color} stopOpacity={0.45} />
            <Stop offset="0.62" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={box.width} height={box.height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// The flash of core light each time the fire flares.
function Flash({ box, color, clock, still }) {
  const id = `${useId().replace(/:/g, "")}flash`;
  const circle = glowCircle(box);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 0 : sampleTrack(FLASH_TRACK, flarePhase(clock.value), EASE_OUT),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box.width} height={box.height}>
        <Defs>
          <RadialGradient
            id={id}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fx={circle.cx}
            fy={circle.cy}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={box.width} height={box.height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// One row of tongues licking along the bottom, as a single path.
function TongueRow({ tongues, baseY, fill, fillOpacity, clock, still }) {
  const animatedProps = useAnimatedProps(() => {
    const time = still ? STILL_MS : clock.value;
    const rise = still ? 0 : ROW_RISE * (1 - ease(EASE_OUT, onceProgress(time, ROW_DELAY_MS, ROW_MS)));

    return { d: tongueRowPath(tongues, baseY, rise, time) };
  });

  return <AnimatedPath fill={fill} fillOpacity={fillOpacity} animatedProps={animatedProps} />;
}

/**
 * Training now, behind the content: tongues of fire licking all along the
 * bottom of the card - a row in the fire's gradient and a smaller one in its
 * core colour - a heat glow pulsing round the fire, and a flash of core light
 * each time it flares.
 *
 * `frame` is the card's outer size, drawn from the padding box's corner (as
 * the design drew it); `box` is the padding box the glows fill.
 */
export default function LiveSurface({ layout, frame, box, theme, clock, still }) {
  const id = `${useId().replace(/:/g, "")}tongues`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={frame.width} height={frame.height}>
        <Defs>
          <LinearGradient
            id={id}
            x1={0}
            y1={frame.height}
            x2={0}
            y2={frame.height - 30}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={theme.fire} stopOpacity={0.75} />
            <Stop offset="1" stopColor={theme.charge} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <TongueRow
          tongues={layout.tongues.outer}
          baseY={frame.height}
          fill={`url(#${id})`}
          fillOpacity={1}
          clock={clock}
          still={still}
        />
        <TongueRow
          tongues={layout.tongues.core}
          baseY={frame.height}
          fill={theme.chargeCore}
          fillOpacity={0.5}
          clock={clock}
          still={still}
        />
      </Svg>

      <Heat box={box} color={theme.fire} clock={clock} still={still} />
      <Flash box={box} color={theme.chargeCore} clock={clock} still={still} />
    </View>
  );
}
