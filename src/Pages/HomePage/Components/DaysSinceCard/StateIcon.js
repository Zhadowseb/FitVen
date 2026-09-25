import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path, Polyline } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import Crown from "@resources/Components/FriendsActivity/Crown";
import Fire from "@resources/Icons/UI-icons/Fire";
import { boltPath } from "@utils/tileMoodGeometry";
import {
  EASE_IN_OUT,
  EASE_OUT,
  LINEAR,
  clamp01,
  ease,
  loopProgress,
  mix,
  onceProgress,
  sampleTrack,
} from "@utils/keyframeTimeline";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const FLAME_SIZE = 20;
const SLOT_WIDTH = 44;
// Where the flame grows from: its foot, 90 % of the way down.
const FLAME_FOOT = [FLAME_SIZE / 2, FLAME_SIZE * 0.9, 0];
const POP = [0.34, 1.56, 0.64, 1];
// Every icon pops in a little after the card, from a third of its size.
const POP_IN_DELAY_MS = 560;
const POP_IN_MS = 460;

// Today: the flame whooshes up once, tall, and settles.
const WHOOSH_DELAY_MS = 900;
const WHOOSH_MS = 700;
const WHOOSH_X = [
  [0, 1],
  [0.4, 1.35],
  [1, 1],
];
const WHOOSH_Y = [
  [0, 1],
  [0.4, 1.5],
  [1, 1],
];
// Cooling: the flame breathes, weakly.
const WEAK_MS = 1900;
const WEAK_X = [
  [0, 1],
  [0.5, 0.94],
  [1, 1],
];
const WEAK_Y = [
  [0, 1],
  [0.5, 1.03],
  [1, 1],
];

/**
 * The pop-in, as a scale and a lift about the flame's foot: the pop grows
 * from the flame's middle, and the flame's own scale from its foot, so the
 * two are folded into one transform about the foot.
 */
function popInTransform(time) {
  "worklet";
  const pop = mix(0.3, 1, ease(POP, onceProgress(time, POP_IN_DELAY_MS, POP_IN_MS)));
  const opacity = clamp01(ease(POP, onceProgress(time, POP_IN_DELAY_MS, POP_IN_MS)));

  return { pop, opacity, lift: (1 - pop) * (FLAME_SIZE / 2 - FLAME_FOOT[1]) };
}

// Today: pops in, whooshes up, then steams.
function WhooshFlame({ color, entry }) {
  const style = useAnimatedStyle(() => {
    const time = entry.value;
    const { pop, opacity, lift } = popInTransform(time);
    const whoosh = onceProgress(time, WHOOSH_DELAY_MS, WHOOSH_MS);

    return {
      opacity,
      transform: [
        { translateY: lift },
        { scaleX: pop * sampleTrack(WHOOSH_X, whoosh, POP) },
        { scaleY: pop * sampleTrack(WHOOSH_Y, whoosh, POP) },
      ],
    };
  });

  return (
    <Animated.View style={[iconStyles.flame, style]}>
      <Fire width={FLAME_SIZE} height={FLAME_SIZE} color={color} />
    </Animated.View>
  );
}

// Cooling: smaller and dimmer by the day, breathing weakly.
function CoolingFlame({ color, scale, opacity, clock, still }) {
  const style = useAnimatedStyle(() => {
    const time = still ? STILL_MS : clock.value;
    const { pop, opacity: shown, lift } = popInTransform(time);
    const p = still ? 0 : loopProgress(time, 0, WEAK_MS);

    return {
      opacity: shown * opacity,
      transform: [
        { translateY: lift },
        { scaleX: pop * scale * sampleTrack(WEAK_X, p, EASE_IN_OUT) },
        { scaleY: pop * scale * sampleTrack(WEAK_Y, p, EASE_IN_OUT) },
      ],
    };
  });

  return (
    <Animated.View style={[iconStyles.flame, style]}>
      <Fire width={FLAME_SIZE} height={FLAME_SIZE} color={color} />
    </Animated.View>
  );
}

// A month gone: the flame burnt out to a dashed ghost of itself.
const BURNT_OPACITY = 0.4;

function BurntFlame({ color, entry }) {
  const style = useAnimatedStyle(() => {
    const { pop, opacity, lift } = popInTransform(entry.value);

    return {
      opacity: opacity * BURNT_OPACITY,
      transform: [{ translateY: lift }, { scale: pop }],
    };
  });

  return (
    <Animated.View style={[iconStyles.flame, style]}>
      <Fire width={FLAME_SIZE} height={FLAME_SIZE} color={color} strokeDasharray={[2, 2.2]} />
    </Animated.View>
  );
}

// A wisp of steam or smoke curling up out of the icon.
const WISP = "M4 12 C1 9 7 7 4 4 S3 1 5 0";
const STEAM_MS = 2800;
const STEAM_Y = [
  [0, 6],
  [1, -8],
];
const STEAM_OPACITY = [
  [0, 0],
  [0.3, 0.75],
  [1, 0],
];
const SMOKE_MS = 5200;
const SMOKE_X = [
  [0, 0],
  [1, 0.8],
];
const SMOKE_Y = [
  [0, 8],
  [1, -9],
];
const SMOKE_SCALE = [
  [0, 0.8],
  [1, 1.15],
];
const SMOKE_OPACITY = [
  [0, 0],
  [0.2, 0.55],
  [0.7, 0.25],
  [1, 0],
];

function Wisp({ color, kind, delayMs, offsetX = 0, clock, still }) {
  const smoke = kind === "smoke";
  const style = useAnimatedStyle(() => {
    const time = still ? STILL_MS : clock.value;

    if (smoke) {
      const p = loopProgress(time, delayMs, SMOKE_MS);

      return {
        opacity: sampleTrack(SMOKE_OPACITY, p, EASE_OUT),
        transform: [
          { translateX: sampleTrack(SMOKE_X, p, EASE_OUT) },
          { translateY: sampleTrack(SMOKE_Y, p, EASE_OUT) },
          { scale: sampleTrack(SMOKE_SCALE, p, EASE_OUT) },
        ],
      };
    }

    const p = loopProgress(time, delayMs, STEAM_MS);

    return {
      opacity: sampleTrack(STEAM_OPACITY, p, EASE_IN_OUT),
      transform: [{ translateY: sampleTrack(STEAM_Y, p, EASE_IN_OUT) }],
    };
  });

  return (
    <Animated.View
      style={[
        iconStyles.wisp,
        { left: SLOT_WIDTH / 2 - 4 + offsetX, top: smoke ? -8 : -10 },
        style,
      ]}
    >
      <Svg width={8} height={12} viewBox="0 0 8 12">
        <Path d={WISP} fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// A record: the crown drops in from above and bounces, then glints.
const DROP_DELAY_MS = 1000;
const DROP_MS = 720;
const DROP_Y = [
  [0, -34],
  [1, 0],
];
const DROP_ROTATE = [
  [0, -12],
  [1, 0],
];
const DROP_OPACITY = [
  [0, 0],
  [0.6, 1],
  [1, 1],
];
// Crown.js draws in 44 x 30; on the card it stands upright at three
// quarters of that, its band where the design has it.
const CROWN_SCALE = 0.75;
const CROWN_TOP = -14.6;

function DroppingCrown({ rubies, animate, entry }) {
  const style = useAnimatedStyle(() => {
    const t = onceProgress(entry.value, DROP_DELAY_MS, DROP_MS);

    return {
      opacity: clamp01(sampleTrack(DROP_OPACITY, t, POP)),
      transform: [
        { translateY: sampleTrack(DROP_Y, t, POP) },
        { rotate: `${sampleTrack(DROP_ROTATE, t, POP)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[iconStyles.crown, style]}>
      <View style={iconStyles.crownScale}>
        <Crown rubies={rubies} animate={animate} seed={7} style={iconStyles.crownUpright} />
      </View>
    </Animated.View>
  );
}

// Charged: the bolt crackles every 3.4 s, with an arc of current either side.
const CRACKLE_DELAY_MS = 900;
const CRACKLE_MS = 3400;
const CRACKLE_SCALE = [
  [0, 1],
  [0.02, 1.22],
  [0.06, 1.12],
  [0.08, 1.05],
  [0.12, 1],
  [1, 1],
];
const CRACKLE_OPACITY = [
  [0, 1],
  [0.02, 0.4],
  [0.04, 1],
  [0.06, 0.55],
  [0.08, 1],
  [0.12, 1],
  [1, 1],
];
const BOLT_REST = { opacity: 1, transform: [{ scale: 1 }] };
const ARC_OPACITY = [
  [0, 0],
  [0.02, 1],
  [0.04, 0.2],
  [0.06, 1],
  [0.1, 0],
  [1, 0],
];
const ARCS = [
  { left: 4, points: "8,2 4,5 6,7 1,10", delayMs: 900 },
  { left: SLOT_WIDTH - 4 - 8, points: "0,3 4,5 2,8 7,10", delayMs: 960 },
];

function CracklingBolt({ theme, clock, still }) {
  const style = useAnimatedStyle(() => {
    if (still) {
      return BOLT_REST;
    }

    const p = loopProgress(clock.value, CRACKLE_DELAY_MS, CRACKLE_MS);

    if (clock.value < CRACKLE_DELAY_MS || p >= 0.12) {
      return BOLT_REST;
    }

    return {
      opacity: sampleTrack(CRACKLE_OPACITY, p, LINEAR),
      transform: [{ scale: sampleTrack(CRACKLE_SCALE, p, LINEAR) }],
    };
  });

  return (
    <Animated.View style={style}>
      <Svg width={20} height={20} viewBox="-10 -10 20 20">
        <Path
          d={boltPath(18)}
          fill={theme.chargeCore}
          stroke={theme.charge}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

function Arc({ arc, color, clock, still }) {
  const { delayMs } = arc;
  const style = useAnimatedStyle(() => {
    if (still || clock.value < delayMs) {
      return { opacity: 0 };
    }

    return { opacity: sampleTrack(ARC_OPACITY, loopProgress(clock.value, delayMs, CRACKLE_MS), LINEAR) };
  });

  return (
    <Animated.View style={[iconStyles.arc, { left: arc.left }, style]}>
      <Svg width={8} height={12} viewBox="0 0 8 12">
        <Polyline points={arc.points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

// Never: an unlit flame drawing itself, again and again, waiting for a match.
const FLAME_OUTER =
  "M12 22a7.5 7.5 0 007.5-7.5c0-1 0-3-2-5.5 0 0-.1 2.854-2.074 2.44-3.193-.667.93-6.937-4.926-9.44 0 5-6 6.5-6 12.5A7.5 7.5 0 0012 22z";
const FLAME_INNER =
  "M12 19.001c1.933 0 3.5-2.015 3.5-4.5-3.2 1.2-4.333-1.563-4.5-3.501-1.446.553-2.5 2.826-2.5 4 0 2.485 1.567 4.001 3.5 4.001z";
export const DRAW_MS = 3600;
const DRAW_OFFSET = [
  [0, 64],
  [0.55, 0],
  [0.75, 0],
  [1, 0],
];
const DRAW_OPACITY = [
  [0, 0],
  [0.1, 1],
  [0.55, 1],
  [0.75, 1],
  [1, 0],
];
const DRAWN = { strokeDashoffset: 0, opacity: 1 };

function DrawnStroke({ d, dash, delayMs, color, clock, still }) {
  const animatedProps = useAnimatedProps(() => {
    if (still) {
      return DRAWN;
    }

    const p = loopProgress(clock.value, delayMs, DRAW_MS);

    return {
      strokeDashoffset: sampleTrack(DRAW_OFFSET, p, EASE_IN_OUT),
      opacity: sampleTrack(DRAW_OPACITY, p, EASE_IN_OUT),
    };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={[dash, dash]}
      animatedProps={animatedProps}
    />
  );
}

function DrawingFlame({ color, clock, still }) {
  return (
    <Svg width={FLAME_SIZE} height={FLAME_SIZE} viewBox="0 0 24 24">
      <DrawnStroke d={FLAME_OUTER} dash={64} delayMs={0} color={color} clock={clock} still={still} />
      <DrawnStroke d={FLAME_INNER} dash={26} delayMs={250} color={color} clock={clock} still={still} />
    </Svg>
  );
}

/**
 * What stands in the icon slot above the number, in each state. Live leaves
 * it empty for the embers to fly through; the rest draw the flame as it is
 * that day - whooshing, crowned, a bolt, dying down, burnt out, or not lit
 * yet - with the steam or smoke coming off it.
 */
export default function StateIcon({ state, theme, accent, cool, rubies, animate, clock, entry, still }) {
  switch (state) {
    case "today":
      return (
        <>
          <WhooshFlame color={accent} entry={entry} />
          <Wisp color={theme.secondary} kind="steam" delayMs={1500} clock={clock} still={still} />
          <Wisp color={theme.secondary} kind="steam" delayMs={2900} offsetX={6} clock={clock} still={still} />
        </>
      );
    case "record":
      return <DroppingCrown rubies={rubies} animate={animate} entry={entry} />;
    case "charged":
      return (
        <>
          <CracklingBolt theme={theme} clock={clock} still={still} />
          {ARCS.map((arc) => (
            <Arc key={arc.left} arc={arc} color={theme.charge} clock={clock} still={still} />
          ))}
        </>
      );
    case "cool":
      return (
        <>
          <CoolingFlame
            color={accent}
            scale={cool.flameScale}
            opacity={cool.flameOpacity}
            clock={clock}
            still={still}
          />
          <Wisp color={theme.quietText} kind="smoke" delayMs={1400} clock={clock} still={still} />
        </>
      );
    case "cobweb":
      return (
        <>
          <BurntFlame color={accent} entry={entry} />
          <Wisp color={theme.quietText} kind="smoke" delayMs={600} clock={clock} still={still} />
          <Wisp color={theme.quietText} kind="smoke" delayMs={3200} clock={clock} still={still} />
        </>
      );
    case "never":
      return <DrawingFlame color={accent} clock={clock} still={still} />;
    default:
      return null;
  }
}

const iconStyles = StyleSheet.create({
  flame: {
    width: FLAME_SIZE,
    height: FLAME_SIZE,
    transformOrigin: FLAME_FOOT,
  },
  wisp: {
    position: "absolute",
    width: 8,
    height: 12,
  },
  crown: {
    position: "absolute",
    left: 0,
    top: CROWN_TOP,
    width: 44,
    height: 30,
    transformOrigin: [22, 30, 0],
  },
  crownScale: {
    width: 44,
    height: 30,
    transformOrigin: [22, 30, 0],
    transform: [{ scale: CROWN_SCALE }],
  },
  // Crown.js tilts itself to sit on an avatar's ring; on the card it stands.
  crownUpright: {
    left: 0,
    top: 0,
    transform: [],
  },
  arc: {
    position: "absolute",
    top: 3,
    width: 8,
    height: 12,
  },
});
