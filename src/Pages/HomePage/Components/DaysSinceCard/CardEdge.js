import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { STILL_MS } from "./useSceneClock";
import { mixHexColors } from "@utils/colorMix";
import { coolLook, cometDashes, cometOffset, edgeGeometry } from "@utils/daysSinceCard";
import {
  EASE_OUT,
  LINEAR,
  clamp01,
  cubicBezier,
  loopProgress,
  onceProgress,
  sampleTrack,
} from "@utils/keyframeTimeline";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WHITE = "#FFFFFF";
// A comet that starts late fades in over this, rather than popping up.
const COMET_FADE_IN_MS = 160;
// A zap is a comet that runs one lap in the first 12 % of the crackle, and
// is gone by 13 %.
const ZAP_LAP = [
  [0, 0],
  [0.12, 1],
  [1, 1],
];
const ZAP_OPACITY = [
  [0, 1],
  [0.12, 1],
  [0.13, 0],
  [1, 0],
];
const DRAW_IN_MS = 650;
const DRAW_IN_CURVE = [0.45, 0, 0.2, 1];
const PULSE_MS = 800;
const PULSE_OPACITY = [
  [0, 0],
  [0.2, 1],
  [1, 0],
];
const PULSE_WIDTH = [
  [0, 1],
  [0.2, 4],
  [1, 1],
];
const MARCH_MS = 1400;
const MARCH_DASH = [4, 4];
const MARCH_SHIFT = -16;

// The edges that only flash, each drawn once and faded as a whole.
// The fire lights the edge up each time it flares.
const FIRE_FLASH = {
  width: 3,
  delayMs: 900,
  periodMs: 3000,
  curve: EASE_OUT,
  rest: 0,
  track: [
    [0, 0],
    [0.05, 1],
    [0.3, 0],
    [1, 0],
  ],
};
// A charged edge flickers with each crackle of the bolt.
const ZAP_FLICKER = {
  width: 1.5,
  delayMs: 900,
  periodMs: 3400,
  curve: LINEAR,
  rest: 0.4,
  track: [
    [0, 0.4],
    [0.02, 1],
    [0.04, 0.2],
    [0.06, 1],
    [0.09, 0.4],
    [0.12, 0.4],
    [1, 0.4],
  ],
};
// A month gone: a neon tube that tries to come on every seven seconds.
const DEAD_NEON = {
  width: 1.6,
  delayMs: 1500,
  periodMs: 7000,
  curve: LINEAR,
  rest: 0,
  track: [
    [0, 0],
    [0.01, 0.8],
    [0.02, 0],
    [0.032, 0.6],
    [0.04, 0],
    [0.05, 0.9],
    [0.065, 0],
    [1, 0],
  ],
};

/**
 * What the edge does in each state, in the theme's colours: a still line to
 * sit on, the comets that run round it, and the layers that draw in, pulse
 * or flash. A comet's length is a percentage of the way round, as in the
 * design; `cycleMs` is a lap, or for a zap the crackle it runs in.
 */
function edgeLook({ state, days, theme, gold, accent, stampAtMs }) {
  switch (state) {
    case "live":
      return {
        base: { color: theme.fire, opacity: 0.5, width: 1.5 },
        comets: [
          { color: theme.chargeCore, length: 9, cycleMs: 1700, delayMs: 300 },
          // Half a lap behind.
          { color: theme.fire, length: 9, cycleMs: 1700, delayMs: 300 - 850 },
        ],
        flashOver: { timing: FIRE_FLASH, color: theme.chargeCore },
      };
    case "today":
      return {
        base: { color: theme.secondary, opacity: 0.25, width: 1.2 },
        drawIn: theme.secondary,
        comets: [
          {
            color: mixHexColors(theme.secondary, WHITE, 0.45),
            length: 13,
            cycleMs: 6000,
            delayMs: 1100,
          },
        ],
        pulse: { color: theme.secondary, atMs: stampAtMs },
      };
    case "record":
      return {
        base: { color: theme.record, opacity: 0.25, width: 1.2 },
        drawIn: theme.record,
        comets: [
          { color: mixHexColors(gold, WHITE, 0.45), length: 16, cycleMs: 3800, delayMs: 1100 },
          { color: theme.secondary, length: 10, cycleMs: 3800, delayMs: 1100 - 1900 },
        ],
        pulse: { color: gold, atMs: stampAtMs },
      };
    case "charged":
      return {
        flashUnder: { timing: ZAP_FLICKER, color: theme.charge },
        comets: [
          { color: theme.chargeCore, length: 18, cycleMs: 3400, delayMs: 900, width: 2.2, zap: true },
          { color: theme.charge, length: 12, cycleMs: 3400, delayMs: 900 + 170, zap: true },
        ],
      };
    case "cool": {
      const look = coolLook(days, theme);

      return {
        base: { color: accent, opacity: 0.3, width: 1.2 },
        comets: [
          {
            color: look.cometColor,
            length: 7,
            cycleMs: look.cometLapMs,
            delayMs: 0,
            width: 1.6,
            opacity: look.cometOpacity,
          },
        ],
      };
    }
    case "cobweb":
      return {
        base: { color: theme.quietText, opacity: 0.4, width: 1.2, dash: [3, 3] },
        flashOver: { timing: DEAD_NEON, color: theme.heatCool },
      };
    default:
      return {
        march: { color: theme.quietText, opacity: 0.55, width: 1.5 },
      };
  }
}

// One of a comet's three dashes. Its head sits `lap` of the way round
// whatever its length, so the three move as one.
function CometDash({ d, color, dash, perimeter, delayMs, cycleMs, zap, clock, still }) {
  const { length, gap, strokeWidth, strokeOpacity } = dash;
  const animatedProps = useAnimatedProps(() => {
    if (zap) {
      // A zap only exists for the moment the bolt crackles.
      const time = clock.value;

      if (still || time < delayMs) {
        return { opacity: 0 };
      }

      const p = loopProgress(time, delayMs, cycleMs);
      const opacity = sampleTrack(ZAP_OPACITY, p, LINEAR);

      if (opacity <= 0) {
        return { opacity: 0 };
      }

      return {
        opacity,
        strokeDashoffset: cometOffset(length, perimeter, sampleTrack(ZAP_LAP, p, LINEAR)),
      };
    }

    const time = still ? STILL_MS : clock.value;

    return {
      opacity: still ? 1 : clamp01((time - delayMs) / COMET_FADE_IN_MS),
      strokeDashoffset: cometOffset(length, perimeter, loopProgress(time, delayMs, cycleMs)),
    };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={strokeOpacity}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={[length, gap]}
      animatedProps={animatedProps}
    />
  );
}

// Today and a record: the edge draws itself a full lap on the way in, and
// stays drawn.
function DrawIn({ d, perimeter, color, entry }) {
  // A touch longer than the edge, so no seam is left where it closes.
  const length = perimeter + 1;
  const animatedProps = useAnimatedProps(() => {
    const t = onceProgress(entry.value, 0, DRAW_IN_MS);
    const eased = cubicBezier(
      DRAW_IN_CURVE[0],
      DRAW_IN_CURVE[1],
      DRAW_IN_CURVE[2],
      DRAW_IN_CURVE[3],
      t
    );

    return { strokeDashoffset: length * (1 - eased) };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

// The edge swelling once with the stamp.
function Pulse({ d, color, atMs, entry }) {
  const animatedProps = useAnimatedProps(() => {
    const t = onceProgress(entry.value, atMs, PULSE_MS);

    if (t <= 0 || t >= 1) {
      return { opacity: 0 };
    }

    return {
      opacity: sampleTrack(PULSE_OPACITY, t, EASE_OUT),
      strokeWidth: sampleTrack(PULSE_WIDTH, t, EASE_OUT),
    };
  });

  return <AnimatedPath d={d} fill="none" stroke={color} strokeWidth={1} animatedProps={animatedProps} />;
}

// Never: a dashed edge marching round, waiting.
function March({ d, color, opacity, width, clock, still }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: still ? 0 : MARCH_SHIFT * loopProgress(clock.value, 0, MARCH_MS),
  }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeDasharray={MARCH_DASH}
      animatedProps={animatedProps}
    />
  );
}

// An edge that only flashes: drawn once, and faded as a whole on the native
// side, so the flicker never redraws the SVG.
function FlashEdge({ d, box, color, timing, clock, still }) {
  const style = useAnimatedStyle(() => {
    if (still) {
      return { opacity: timing.rest };
    }

    const p = loopProgress(clock.value, timing.delayMs, timing.periodMs);

    return { opacity: sampleTrack(timing.track, p, timing.curve) };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box.width} height={box.height}>
        <Path d={d} fill="none" stroke={color} strokeWidth={timing.width} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The card's edge, in every state: comets running round it, the edge
 * drawing itself in and pulsing, flickering like a dying neon tube or
 * marching, as the state has it. It lies over the content, outside the
 * layout.
 *
 * `box` is the card's padding box; the edge runs 1 dp inside it. A comet's
 * dashes are the design's percentages of the way round, made dp by the
 * edge's perimeter.
 */
export default function CardEdge({
  state,
  days,
  theme,
  gold,
  accent,
  box,
  clock,
  entry,
  still,
  stampAtMs = 0,
}) {
  const edge = useMemo(() => edgeGeometry(box.width, box.height), [box.height, box.width]);
  const look = edgeLook({ state, days, theme, gold, accent, stampAtMs });
  const cometShapes = (look.comets ?? [])
    .map((comet) => `${comet.length}:${comet.width ?? 2}:${comet.opacity ?? 1}`)
    .join("|");
  // Only the dashes' geometry is kept between renders; colours are read
  // fresh, so a new accent shows at once.
  const dashes = useMemo(
    () =>
      (look.comets ?? []).map((comet) =>
        cometDashes(comet.length, edge.perimeter, {
          width: comet.width ?? 2,
          opacity: comet.opacity ?? 1,
        })
      ),
    // `look` is new every render; its comets' shapes are what matter.
    [cometShapes, edge.perimeter]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {look.flashUnder ? (
        <FlashEdge
          d={edge.d}
          box={box}
          color={look.flashUnder.color}
          timing={look.flashUnder.timing}
          clock={clock}
          still={still}
        />
      ) : null}

      <Svg width={box.width} height={box.height}>
        {look.base ? (
          <Path
            d={edge.d}
            fill="none"
            stroke={look.base.color}
            strokeOpacity={look.base.opacity}
            strokeWidth={look.base.width}
            strokeDasharray={look.base.dash}
          />
        ) : null}
        {look.drawIn ? (
          <DrawIn d={edge.d} perimeter={edge.perimeter} color={look.drawIn} entry={entry} />
        ) : null}
        {(look.comets ?? []).map((comet, cometIndex) =>
          (dashes[cometIndex] ?? []).map((dash, dashIndex) => (
            <CometDash
              key={`${cometIndex}-${dashIndex}`}
              d={edge.d}
              color={comet.color}
              dash={dash}
              perimeter={edge.perimeter}
              delayMs={comet.delayMs}
              cycleMs={comet.cycleMs}
              zap={Boolean(comet.zap)}
              clock={clock}
              still={still}
            />
          ))
        )}
        {look.pulse ? (
          <Pulse d={edge.d} color={look.pulse.color} atMs={look.pulse.atMs} entry={entry} />
        ) : null}
        {look.march ? (
          <March
            d={edge.d}
            color={look.march.color}
            opacity={look.march.opacity}
            width={look.march.width}
            clock={clock}
            still={still}
          />
        ) : null}
      </Svg>

      {look.flashOver ? (
        <FlashEdge
          d={edge.d}
          box={box}
          color={look.flashOver.color}
          timing={look.flashOver.timing}
          clock={clock}
          still={still}
        />
      ) : null}
    </View>
  );
}
