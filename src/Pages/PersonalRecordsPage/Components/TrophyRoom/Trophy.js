import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { useBreathAnimation, useSheenAnimation } from "@resources/Components/animationHooks";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

let trophyInstanceCounter = 0;

// Drawn in a 64 x 64 box: a cup with two handles on a stem, a base and a
// plinth, a star on the cup. The same golds as the crown on a friend's
// avatar, so a record wears one gold wherever it shows.
const VIEW = 64;
const CUP = "M 17 9 H 47 V 15 C 47 29 40.5 36.5 32 38.5 C 23.5 36.5 17 29 17 15 Z";
const HANDLE_LEFT = "M 17.5 13 C 9 13 8 26 19.5 27.5";
const HANDLE_RIGHT = "M 46.5 13 C 55 13 56 26 44.5 27.5";
const STEM = "M 29.5 38.2 H 34.5 L 35.5 46 H 28.5 Z";
const BASE = "M 23 46 H 41 Q 43 46 43 48 V 51 H 21 V 48 Q 21 46 23 46 Z";
const PLINTH = "M 18 51 H 46 Q 47 51 47 52 V 56 H 17 V 52 Q 17 51 18 51 Z";
const GOLD_EDGE = "#8A5A12";

function starPath(cx, cy, outer, inner) {
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;

    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }

  return `M ${points.join(" L ")} Z`;
}

const EMBLEM = starPath(32, 21.5, 5.4, 2.3);

// A four-pointed glint, centred in a 12 x 12 box.
function glintPath(size) {
  const c = 6;
  const waist = size * 0.14;

  return [
    `M ${c} ${c - size}`,
    `L ${c + waist} ${c - waist}`,
    `L ${c + size} ${c}`,
    `L ${c + waist} ${c + waist}`,
    `L ${c} ${c + size}`,
    `L ${c - waist} ${c + waist}`,
    `L ${c - size} ${c}`,
    `L ${c - waist} ${c - waist}`,
    "Z",
  ].join(" ");
}

// Where the glints catch the light, as fractions of the box, each on its own turn.
const GLINTS = [
  { x: 0.2, y: 0.14, size: 5.5, delay: 600 },
  { x: 0.83, y: 0.3, size: 4.5, delay: 1900 },
  { x: 0.74, y: 0.8, size: 4, delay: 3100 },
];

function Glint({ spot, box, animate }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: 620,
    gapMs: 3400,
    headStartMs: spot.delay,
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.3, 1.15, 0.5] });

  return (
    <Animated.View
      style={[
        styles.glint,
        {
          left: spot.x * box - 6,
          top: spot.y * box - 6,
          opacity,
          transform: [{ scale }, { rotate: "15deg" }],
        },
      ]}
    >
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d={glintPath(spot.size)} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

// Light running across the cup now and then. An SVG attribute cannot go
// through the native driver, so this one runs on the JS thread - a narrow bar,
// for about a second, every few seconds.
function useCupShine(enabled) {
  const x = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!enabled) {
      x.setValue(-20);
      return undefined;
    }

    const animation = Animated.sequence([
      Animated.delay(700),
      Animated.loop(
        Animated.sequence([
          Animated.timing(x, {
            toValue: 70,
            duration: 1100,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.delay(3800),
          Animated.timing(x, { toValue: -20, duration: 0, useNativeDriver: false }),
        ])
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
      x.setValue(-20);
    };
  }, [enabled, x]);

  return x;
}

/**
 * The trophy at the top of the room: gold, a star on the cup, a warm glow
 * behind it that breathes, light running across the gold and glints catching
 * around it. `dimmed` for the room with nothing in it yet - the same trophy,
 * waiting, and still.
 */
export default function Trophy({ size = 96, animate = false, dimmed = false }) {
  const ids = useRef(
    (() => {
      const id = ++trophyInstanceCounter;

      return {
        gold: `trophy-gold-${id}`,
        dark: `trophy-dark-${id}`,
        glow: `trophy-glow-${id}`,
        shine: `trophy-shine-${id}`,
        clip: `trophy-clip-${id}`,
      };
    })()
  ).current;
  const moving = animate && !dimmed;
  const shineX = useCupShine(moving);
  const glow = useBreathAnimation(moving, { periodMs: 3400, low: 0.45 });
  const glowBox = size * 1.5;

  return (
    <View
      style={{ width: size, height: size, opacity: dimmed ? 0.4 : 1 }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {dimmed ? null : (
        <Animated.View
          style={[
            styles.glow,
            {
              width: glowBox,
              height: glowBox,
              left: (size - glowBox) / 2,
              top: (size - glowBox) / 2,
              opacity: glow,
            },
          ]}
        >
          <Svg width={glowBox} height={glowBox} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={ids.glow} cx="50%" cy="46%" r="50%">
                <Stop offset="0" stopColor="#F2C14E" stopOpacity={0.5} />
                <Stop offset="0.55" stopColor="#F2C14E" stopOpacity={0.16} />
                <Stop offset="1" stopColor="#F2C14E" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${ids.glow})`} />
          </Svg>
        </Animated.View>
      )}

      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          <LinearGradient id={ids.gold} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF1B0" />
            <Stop offset="0.45" stopColor="#F2C14E" />
            <Stop offset="1" stopColor="#B7791F" />
          </LinearGradient>
          <LinearGradient id={ids.dark} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C98A1C" />
            <Stop offset="1" stopColor="#7A4E0E" />
          </LinearGradient>
          <LinearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.8} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={ids.clip}>
            <Path d={CUP} />
          </ClipPath>
        </Defs>

        <Path d={HANDLE_LEFT} stroke={GOLD_EDGE} strokeWidth={4.4} strokeLinecap="round" fill="none" />
        <Path d={HANDLE_RIGHT} stroke={GOLD_EDGE} strokeWidth={4.4} strokeLinecap="round" fill="none" />
        <Path d={HANDLE_LEFT} stroke={`url(#${ids.gold})`} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        <Path d={HANDLE_RIGHT} stroke={`url(#${ids.gold})`} strokeWidth={2.8} strokeLinecap="round" fill="none" />

        <Path d={PLINTH} fill={`url(#${ids.dark})`} stroke={GOLD_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <Path d={BASE} fill={`url(#${ids.gold})`} stroke={GOLD_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <Path d={STEM} fill={`url(#${ids.gold})`} stroke={GOLD_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <Path d={CUP} fill={`url(#${ids.gold})`} stroke={GOLD_EDGE} strokeWidth={0.9} strokeLinejoin="round" />
        <Path d="M 18.5 10.6 H 45.5" stroke="#FFF6CF" strokeOpacity={0.85} strokeWidth={0.9} strokeLinecap="round" />
        <Path d="M 21 15 C 21 25 25 31.5 29 34" stroke="#FFF6CF" strokeOpacity={0.45} strokeWidth={1.1} strokeLinecap="round" fill="none" />
        <Path d={EMBLEM} fill="#FFF6CF" fillOpacity={0.9} stroke={GOLD_EDGE} strokeWidth={0.5} strokeLinejoin="round" />

        {/* Clipped on a group, not on the bar: a clip on a transformed
            element is transformed with it, and would slant off the cup. */}
        <G clipPath={`url(#${ids.clip})`}>
          <AnimatedRect
            x={shineX}
            y="0"
            width="12"
            height="44"
            fill={`url(#${ids.shine})`}
            transform="skewX(-18)"
          />
        </G>
      </Svg>

      {dimmed
        ? null
        : GLINTS.map((spot) => <Glint key={spot.delay} spot={spot} box={size} animate={moving} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
  },
  glint: {
    position: "absolute",
    width: 12,
    height: 12,
  },
});
