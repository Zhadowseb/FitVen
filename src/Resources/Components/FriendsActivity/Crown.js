import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { useBreathAnimation, useSheenAnimation } from "../animationHooks";
import { placeCrownOnRing } from "@utils/crownPlacement";
import { AVATAR_RING_WIDTH, AVATAR_SIZE } from "./FriendsActivityStyle";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

let crownInstanceCounter = 0;

// Drawn in a 44 x 30 box: three points with a ball on each, a band across
// the bottom, the rubies set in the band.
const CROWN_BODY =
  "M 6 27 L 6 20 L 8.5 6.5 L 15 15 L 22 3 L 29 15 L 35.5 6.5 L 38 20 L 38 27 Q 22 29.5 6 27 Z";
const CROWN_BAND = "M 6 20 Q 22 22.6 38 20 L 38 27 Q 22 29.5 6 27 Z";
const CROWN_BALLS = [
  [8.5, 5.4],
  [22, 1.9],
  [35.5, 5.4],
];
const CROWN_BOX = { width: 44, height: 30 };
const CROWN_TILT_DEG = -8;
const RUBY_Y = 24;

// Tilted, with both bottom corners - (6, 27) and (38, 27) in the drawing -
// resting on the middle of the ring's stroke.
const CROWN_PLACEMENT = placeCrownOnRing({
  box: CROWN_BOX,
  corners: [
    [6, 27],
    [38, 27],
  ],
  angleDeg: CROWN_TILT_DEG,
  ringCentre: [AVATAR_SIZE / 2, AVATAR_SIZE / 2],
  ringRadius: AVATAR_SIZE / 2 - AVATAR_RING_WIDTH / 2,
});
const RUBY_SPOTS = { 2: [16.5, 27.5], 3: [13, 22, 31] };
const GOLD_EDGE = "#8A5A12";

// A four-pointed glint, centred on (x, y).
function glintPath(x, y, size) {
  const waist = size * 0.14;

  return [
    `M ${x} ${y - size}`,
    `L ${x + waist} ${y - waist}`,
    `L ${x + size} ${y}`,
    `L ${x + waist} ${y + waist}`,
    `L ${x} ${y + size}`,
    `L ${x - waist} ${y + waist}`,
    `L ${x - size} ${y}`,
    `L ${x - waist} ${y - waist}`,
    "Z",
  ].join(" ");
}

// One ruby's glint: a star that flashes over it now and then, each ruby on
// its own turn so they catch the light one after another.
function RubyGlint({ x, index, animate, seed }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: 520,
    gapMs: 1900 + (seed % 3) * 250,
    headStartMs: index * 720 + (seed % 5) * 110,
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.6] });

  return (
    <Animated.View
      style={[
        styles.glint,
        { left: x - 6, top: RUBY_Y - 6, opacity, transform: [{ scale }, { rotate: "12deg" }] },
      ]}
    >
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d={glintPath(6, 6, 5.5)} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

// Light running across the gold now and then, kept inside the crown's shape.
// An SVG attribute cannot go through the native driver, so this one runs on
// the JS thread - a narrow bar for under a second every few seconds.
function useGoldShine(enabled, seed) {
  const x = useRef(new Animated.Value(-14)).current;

  useEffect(() => {
    if (!enabled) {
      x.setValue(-14);
      return undefined;
    }

    const animation = Animated.sequence([
      Animated.delay(900 + (seed % 4) * 400),
      Animated.loop(
        Animated.sequence([
          Animated.timing(x, {
            toValue: 50,
            duration: 900,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.delay(3600),
          Animated.timing(x, { toValue: -14, duration: 0, useNativeDriver: false }),
        ])
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
      x.setValue(-14);
    };
  }, [enabled, seed, x]);

  return x;
}

/**
 * The crown on somebody who set a personal record in the workout they
 * finished today: gold, three points, a ruby for each record - two or three -
 * that glint in turn, and a shine running across the gold now and then.
 * It sits tilted on the top of the avatar's ring, outside the layout, unless
 * `style` puts it somewhere else - on the days-since card's number.
 */
export default function Crown({ rubies = 2, animate = false, seed = 0, style = null }) {
  const ids = useRef(
    (() => {
      const id = ++crownInstanceCounter;

      return {
        gold: `crown-gold-${id}`,
        band: `crown-band-${id}`,
        ruby: `crown-ruby-${id}`,
        shine: `crown-shine-${id}`,
        clip: `crown-clip-${id}`,
      };
    })()
  ).current;
  const spots = RUBY_SPOTS[rubies >= 3 ? 3 : 2];
  const shineX = useGoldShine(animate, seed);
  const rubyGlow = useBreathAnimation(animate, { periodMs: 1800, low: 0.25 });

  return (
    <View style={[styles.crown, style]} pointerEvents="none">
      <Svg width={44} height={30} viewBox="0 0 44 30">
        <Defs>
          <LinearGradient id={ids.gold} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF1B0" />
            <Stop offset="0.45" stopColor="#F2C14E" />
            <Stop offset="1" stopColor="#B7791F" />
          </LinearGradient>
          <LinearGradient id={ids.band} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F7D774" />
            <Stop offset="1" stopColor="#C98A1C" />
          </LinearGradient>
          <RadialGradient id={ids.ruby} cx="40%" cy="35%" r="65%">
            <Stop offset="0" stopColor="#FF9AA5" />
            <Stop offset="0.45" stopColor="#D0102E" />
            <Stop offset="1" stopColor="#6E0018" />
          </RadialGradient>
          <LinearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.75} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={ids.clip}>
            <Path d={CROWN_BODY} />
          </ClipPath>
        </Defs>

        <Path d={CROWN_BODY} fill={`url(#${ids.gold})`} stroke={GOLD_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <Path d={CROWN_BAND} fill={`url(#${ids.band})`} stroke={GOLD_EDGE} strokeWidth={0.7} strokeLinejoin="round" />
        <Path d="M 7 21.2 Q 22 23.6 37 21.2" stroke="#FFF6CF" strokeOpacity={0.7} strokeWidth={0.6} fill="none" />
        {CROWN_BALLS.map(([x, y]) => (
          <Circle key={x} cx={x} cy={y} r={1.9} fill="#FFF1B0" stroke={GOLD_EDGE} strokeWidth={0.6} />
        ))}

        {/* Clipped on a group, not on the bar: a clip on a transformed
            element is transformed with it, and would slant off the crown. */}
        <G clipPath={`url(#${ids.clip})`}>
          <AnimatedRect
            x={shineX}
            y="0"
            width="10"
            height="30"
            fill={`url(#${ids.shine})`}
            transform="skewX(-18)"
          />
        </G>

        {spots.map((x) => (
          <Ellipse key={x} cx={x} cy={RUBY_Y} rx={2.7} ry={2.3} fill={`url(#${ids.ruby})`} stroke="#5A0012" strokeWidth={0.5} />
        ))}
        {spots.map((x) => (
          <Circle key={`light-${x}`} cx={x - 0.9} cy={RUBY_Y - 0.9} r={0.65} fill="#FFFFFF" fillOpacity={0.85} />
        ))}
      </Svg>

      {/* The rubies glow up and down together, and glint one at a time. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rubyGlow }]}>
        <Svg width={44} height={30} viewBox="0 0 44 30">
          {spots.map((x) => (
            <Circle key={x} cx={x} cy={RUBY_Y} r={3.8} fill="#FF3B55" fillOpacity={0.35} />
          ))}
        </Svg>
      </Animated.View>
      {spots.map((x, index) => (
        <RubyGlint key={x} x={x} index={index} animate={animate} seed={seed} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  crown: {
    position: "absolute",
    left: CROWN_PLACEMENT.left,
    top: CROWN_PLACEMENT.top,
    width: CROWN_BOX.width,
    height: CROWN_BOX.height,
    transform: [{ rotate: `${CROWN_TILT_DEG}deg` }],
  },
  glint: {
    position: "absolute",
    width: 12,
    height: 12,
  },
});
