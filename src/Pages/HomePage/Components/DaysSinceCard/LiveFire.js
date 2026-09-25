import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { mixHexColors } from "@utils/colorMix";
import { burstAt, burstPath, flarePhase } from "@utils/daysSinceCard";
import {
  EASE_IN_OUT,
  EASE_OUT,
  clamp01,
  ease,
  loopProgress,
  onceProgress,
  sampleTrack,
} from "@utils/keyframeTimeline";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The fire is drawn in a 24 x 30 box, 34 dp wide: 1.42 dp a unit. It stands
// in the number's 44 x 32 place with its foot 2.75 dp below it, and reaches
// up into the gap under the icon.
const UNIT = 34 / 24;
const FIRE_WIDTH = 34;
const FIRE_HEIGHT = 30 * UNIT;
const SLOT_WIDTH = 44;
const SLOT_HEIGHT = 32;
// The foot of the flame, which it grows from and flares about.
const FIRE_FOOT = [12 * UNIT, 29 * UNIT, 0];

const OUTER_FLAME =
  "M12 1 C13.5 6 19 9.5 20 16 C21 23 17 29 12 29 C7 29 3 24.5 4 18 C4.6 14 7 12 8 9 C9 12 10 13 11 13 C10 9 11 5 12 1 Z";
const MIDDLE_FLAME =
  "M12 9 C13 13 17 15.5 17 20 C17 25 14.5 28 12 28 C9.5 28 7 25.5 7 21.5 C7 19 8.5 17.5 9.5 16 C10 18 11 18.5 11.5 18.5 C11 15.5 11.3 12 12 9 Z";
const CORE_FLAME =
  "M12 17 C13 19.5 15 21 15 23.5 C15 26.5 13.6 28 12 28 C10.4 28 9 26.5 9 24 C9 22.5 10 21.5 10.6 20.5 C11 21.5 11.5 22 12 22 C11.7 20.5 11.7 18.8 12 17 Z";
// A small tongue of flame, 5 x 8, its point at the top.
const TONGUE = "M0 0 C1.5 2 2.5 4 2.5 5.5 A2.5 2.5 0 0 1 -2.5 5.5 C-2.5 4 -1.5 2 0 0 Z";
const TONGUES = [
  { x: 6.5, y: 13, delayMs: 0, tone: "fire" },
  { x: 17.5, y: 11, delayMs: 390, tone: "fire" },
  { x: 12, y: 4, delayMs: 200, tone: "mid" },
];
const TONGUE_MS = 780;
const TONGUE_RISE = -13 * UNIT;

// It ignites - from nothing, past full size, and back - then flares every
// three seconds on the card's beat.
const POP = [0.34, 1.56, 0.64, 1];
const IGNITE_DELAY_MS = 250;
const IGNITE_MS = 760;
// From next to nothing rather than nothing: a scale of 0 is a matrix Android
// cannot take apart.
const IGNITE_X = [
  [0, 0.001],
  [0.55, 1.25],
  [1, 1],
];
const IGNITE_Y = [
  [0, 0.2],
  [0.55, 1.45],
  [1, 1],
];
const IGNITE_OPACITY = [
  [0, 0],
  [0.3, 1],
  [1, 1],
];
const FLARE_CURVE = [0.3, 1.4, 0.5, 1];
const FLARE_X = [
  [0, 1],
  [0.06, 1.22],
  [0.18, 0.96],
  [0.28, 1],
  [1, 1],
];
const FLARE_Y = [
  [0, 1],
  [0.06, 1.5],
  [0.18, 0.94],
  [0.28, 1],
  [1, 1],
];
const FIRE_REST = { opacity: 1, transform: [{ scaleX: 1 }, { scaleY: 1 }] };

// Each layer licks at its own pace: the outer flame and the middle one lean
// and stretch, the core swells. The design leans them with skewX, which an
// Android view does not apply - it keeps only translation, rotation and
// scale - so they lean by turning about the foot instead: the same few
// degrees, and at this size the same shape. Turned before they are scaled,
// so nothing is left over for Android to drop.
const LICK_X = [
  [0, 1],
  [0.22, 1.07],
  [0.48, 0.93],
  [0.74, 1.04],
  [1, 1],
];
const LICK_Y = [
  [0, 1],
  [0.22, 1.16],
  [0.48, 1.02],
  [0.74, 1.2],
  [1, 1],
];
// skewX(a) leans the top of a flame the way rotate(-a) does.
const LICK_LEAN = [
  [0, 0],
  [0.22, 6],
  [0.48, -5],
  [0.74, 2],
  [1, 0],
];
const CORE_X = [
  [0, 1],
  [0.5, 1.12],
  [1, 1],
];
const CORE_Y = [
  [0, 1],
  [0.5, 1.25],
  [1, 1],
];
const LAYERS = [
  { d: OUTER_FLAME, tone: "fire", periodMs: 520, delayMs: 0, direction: "normal", core: false, foot: 29 },
  { d: MIDDLE_FLAME, tone: "mid", periodMs: 380, delayMs: -120, direction: "reverse", core: false, foot: 28 },
  { d: CORE_FLAME, tone: "core", periodMs: 290, delayMs: 0, direction: "normal", core: true, foot: 28 },
];

// Embers fly up out of the fire: from 14 dp above the foot of the number's
// place, drifting to the side, gone at the top.
const EMBER_FOOT = 14;
const EMBER_X = [
  [0, 0],
  [0.6, 0.6],
  [1, 1],
];
const EMBER_OPACITY = [
  [0, 0],
  [0.12, 1],
  [1, 0],
];

// The burst leaves from 12 dp above the foot of the number's place. Its SVG
// is laid over the place with room for the sparks' 40 dp reach.
const BURST_ORIGIN = { x: 48, y: 50 };
const BURST_BOX = { width: 96, height: 64 };
const BURST_LEFT = SLOT_WIDTH / 2 - BURST_ORIGIN.x;
const BURST_TOP = SLOT_HEIGHT - 12 - 1.5 - BURST_ORIGIN.y;
const BURST_IDLE = { d: "M0 0", fillOpacity: 0 };

function FlameLayer({ layer, color, clock, still }) {
  const { periodMs, delayMs, direction, core } = layer;
  const style = useAnimatedStyle(() => {
    if (still) {
      return FIRE_REST;
    }

    const p = loopProgress(clock.value, delayMs, periodMs, direction);

    if (core) {
      return {
        opacity: 1,
        transform: [
          { scaleX: sampleTrack(CORE_X, p, EASE_IN_OUT) },
          { scaleY: sampleTrack(CORE_Y, p, EASE_IN_OUT) },
        ],
      };
    }

    return {
      opacity: 1,
      transform: [
        { rotate: `${sampleTrack(LICK_LEAN, p, EASE_IN_OUT)}deg` },
        { scaleX: sampleTrack(LICK_X, p, EASE_IN_OUT) },
        { scaleY: sampleTrack(LICK_Y, p, EASE_IN_OUT) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: [12 * UNIT, layer.foot * UNIT, 0] },
        style,
      ]}
    >
      <Svg width={FIRE_WIDTH} height={FIRE_HEIGHT} viewBox="0 0 24 30">
        <Path d={layer.d} fill={color} />
      </Svg>
    </Animated.View>
  );
}

// A small tongue leaping off the fire, shrinking and going out as it rises.
function Tongue({ tongue, color, clock, still }) {
  const { delayMs } = tongue;
  const style = useAnimatedStyle(() => {
    const p = still ? 0 : loopProgress(clock.value, delayMs, TONGUE_MS);
    const e = ease(EASE_OUT, p);

    return {
      opacity: 0.95 * (1 - e),
      transform: [{ translateY: TONGUE_RISE * e }, { scale: 1 - 0.8 * e }],
    };
  });

  return (
    <Animated.View
      style={[
        fireStyles.tongue,
        { left: (tongue.x - 2.5) * UNIT, top: tongue.y * UNIT },
        style,
      ]}
    >
      <Svg width={5 * UNIT} height={8 * UNIT} viewBox="-2.5 0 5 8">
        <Path d={TONGUE} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function Ember({ ember, color, clock, still }) {
  const { x, rise, durationMs, delayMs } = ember;
  const style = useAnimatedStyle(() => {
    const p = loopProgress(still ? STILL_MS : clock.value, delayMs, durationMs);
    const along = sampleTrack(EMBER_X, p, EASE_OUT);

    return {
      opacity: sampleTrack(EMBER_OPACITY, p, EASE_OUT),
      transform: [{ translateX: x * along }, { translateY: -rise * along }],
    };
  });
  const size = ember.size;

  return (
    <Animated.View
      style={[
        fireStyles.ember,
        {
          left: SLOT_WIDTH / 2 - size / 2,
          top: SLOT_HEIGHT - EMBER_FOOT - size,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// The sparks of one colour, flying out each time the fire flares.
function BurstSparks({ sparks, color, clock, still }) {
  const animatedProps = useAnimatedProps(() => {
    if (still) {
      return BURST_IDLE;
    }

    const burst = burstAt(flarePhase(clock.value));

    if (burst.opacity <= 0) {
      return BURST_IDLE;
    }

    return {
      d: burstPath(sparks, BURST_ORIGIN.x, BURST_ORIGIN.y, burst.reach, burst.radius),
      fillOpacity: clamp01(burst.opacity),
    };
  });

  return <AnimatedPath fill={color} animatedProps={animatedProps} />;
}

/**
 * Training now: no number, a fire in its place. Three flames in one - the
 * fire, a hotter middle and a core in the charge's light - that ignites,
 * licks, and flares every three seconds with a burst of sparks, while embers
 * fly up out of it through the empty icon slot.
 */
export default function LiveFire({ layout, theme, clock, still }) {
  const mid = mixHexColors(theme.fire, theme.charge, 0.5);
  const tones = { fire: theme.fire, mid, core: theme.chargeCore };
  const emberTones = [theme.fire, mid, theme.chargeCore];

  const outer = useAnimatedStyle(() => {
    if (still) {
      return FIRE_REST;
    }

    const time = clock.value;
    const ignite = onceProgress(time, IGNITE_DELAY_MS, IGNITE_MS);
    const flare = flarePhase(time);

    if (ignite >= 1 && flare >= 0.28) {
      return FIRE_REST;
    }

    return {
      opacity: clamp01(sampleTrack(IGNITE_OPACITY, ignite, POP)),
      transform: [
        { scaleX: sampleTrack(IGNITE_X, ignite, POP) * sampleTrack(FLARE_X, flare, FLARE_CURVE) },
        { scaleY: sampleTrack(IGNITE_Y, ignite, POP) * sampleTrack(FLARE_Y, flare, FLARE_CURVE) },
      ],
    };
  });

  return (
    <View style={fireStyles.slot} pointerEvents="none">
      <Animated.View style={[fireStyles.fire, outer]}>
        {TONGUES.map((tongue) => (
          <Tongue key={tongue.x} tongue={tongue} color={tones[tongue.tone]} clock={clock} still={still} />
        ))}
        {LAYERS.map((layer) => (
          <FlameLayer key={layer.tone} layer={layer} color={tones[layer.tone]} clock={clock} still={still} />
        ))}
      </Animated.View>

      {layout.embers.map((ember, index) => (
        <Ember key={index} ember={ember} color={emberTones[ember.tone]} clock={clock} still={still} />
      ))}

      <Svg style={fireStyles.burst} width={BURST_BOX.width} height={BURST_BOX.height}>
        <BurstSparks sparks={layout.burst.fire} color={theme.fire} clock={clock} still={still} />
        <BurstSparks sparks={layout.burst.core} color={theme.chargeCore} clock={clock} still={still} />
      </Svg>
    </View>
  );
}

const fireStyles = StyleSheet.create({
  // The number's place: the size the number takes, so nothing else moves.
  slot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
  fire: {
    position: "absolute",
    left: (SLOT_WIDTH - FIRE_WIDTH) / 2,
    bottom: -2.75,
    width: FIRE_WIDTH,
    height: FIRE_HEIGHT,
    transformOrigin: FIRE_FOOT,
  },
  tongue: {
    position: "absolute",
    width: 5 * UNIT,
    height: 8 * UNIT,
    transformOrigin: [2.5 * UNIT, 8 * UNIT, 0],
  },
  ember: {
    position: "absolute",
  },
  burst: {
    position: "absolute",
    left: BURST_LEFT,
    top: BURST_TOP,
  },
});
