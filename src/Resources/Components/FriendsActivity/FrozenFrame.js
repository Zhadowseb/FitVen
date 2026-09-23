import { useMemo, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useBreathAnimation, useSheenAnimation } from "../animationHooks";
import { buildFrostGeometry } from "@utils/frostGeometry";

// Grown by scripts/art/generate-frost-texture.py - frost ferns, haze, a glassy
// rim and icicles, as a transparent picture. Two variants, so two frozen
// friends side by side do not wear the same frost.
const FROST_TEXTURES = [
  require("../../Images/Frost/frost-a.png"),
  require("../../Images/Frost/frost-b.png"),
];

let frostInstanceCounter = 0;

// A four-pointed glint of `size`, centred on (x, y).
function glintPath(x, y, size) {
  const waist = size * 0.22;

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

// One group of rim sparkles, blinking in and out.
function SparkleLayer({ geometry, group, color, animate, periodMs }) {
  const opacity = useBreathAnimation(animate, { periodMs, low: 0 });
  const d = geometry.sparkles
    .filter((sparkle) => sparkle.group === group)
    .map((sparkle) => glintPath(sparkle.x, sparkle.y, sparkle.size))
    .join(" ");

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        <Path d={d} fill={color} />
      </Svg>
    </Animated.View>
  );
}

// Light catching the ice: a slanted band crossing the whole block now and
// then, the way a pane catches a window.
function IceSheen({ geometry, color, animate, seed }) {
  const gradientId = useRef(`frost-sheen-${++frostInstanceCounter}`).current;
  const progress = useSheenAnimation(animate, {
    sweepMs: 1800,
    gapMs: 4200,
    headStartMs: (seed * 1100) % 5000,
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, geometry.width + 40],
  });

  return (
    <Animated.View
      style={[
        styles.sheen,
        { height: geometry.height + 120, transform: [{ translateX }, { rotate: "22deg" }] },
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={color} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

function Snowflake({ flake, height, color, animate }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: flake.durationMs,
    gapMs: 0,
    headStartMs: flake.delayMs,
    linear: true,
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-flake.size * 2, height + flake.size * 2],
  });
  // In and out at the ends, so a flake never pops into view.
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 0.8, 0.8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.flake,
        {
          left: flake.x,
          width: flake.size * 2,
          height: flake.size * 2,
          borderRadius: flake.size,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

/**
 * The tile of somebody who has not trained in a month, frozen over like a
 * window pane: the frost texture, and on top of it what makes it live.
 *
 * The frost breathes - the other variant fades in and out over it, so the
 * ferns seem to creep and settle - sparkles blink along the rim, a band of
 * light crosses the ice now and then, and a few flakes of snow fall through.
 * All of it stops off screen and under reduced motion.
 *
 * Drawn behind the tile's text rather than over it, so a name or a status is
 * never iced out, and outside the layout - measured, not measuring. In the
 * light theme the white frost would vanish on a white card, so it is tinted
 * the theme's ice blue instead.
 */
export default function FrozenFrame({ theme, colorScheme, seed = 0, animate = false, cornerRadius = 20 }) {
  const [size, setSize] = useState(null);
  const isLight = colorScheme === "light";
  const shine = isLight ? "#FFFFFF" : "#F2FAFF";
  const texture = FROST_TEXTURES[seed % FROST_TEXTURES.length];
  const otherTexture = FROST_TEXTURES[(seed + 1) % FROST_TEXTURES.length];
  const creep = useBreathAnimation(animate, { periodMs: 5200 + (seed % 3) * 600, low: 0.05 });
  const creepOpacity = creep.interpolate({ inputRange: [0.05, 1], outputRange: [0.32, 0] });
  const geometry = useMemo(
    () => (size ? buildFrostGeometry({ ...size, seed, cornerRadius }) : null),
    [cornerRadius, seed, size]
  );
  const tint = isLight ? { tintColor: theme.ice } : null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        const height = Math.round(event.nativeEvent.layout.height);

        setSize((current) =>
          current?.width === width && current?.height === height ? current : { width, height }
        );
      }}
    >
      <Image source={texture} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.frost, tint]} />
      <Animated.Image
        source={otherTexture}
        resizeMode="stretch"
        style={[StyleSheet.absoluteFill, tint, { opacity: creepOpacity }]}
      />

      {geometry ? (
        <>
          <IceSheen geometry={geometry} color={shine} animate={animate} seed={seed} />

          {animate
            ? geometry.snow.map((flake, index) => (
                <Snowflake
                  key={index}
                  flake={flake}
                  height={geometry.height}
                  color={shine}
                  animate={animate}
                />
              ))
            : null}

          <SparkleLayer geometry={geometry} group={0} color={shine} animate={animate} periodMs={1500} />
          <SparkleLayer geometry={geometry} group={1} color={shine} animate={animate} periodMs={2100} />
          <SparkleLayer geometry={geometry} group={2} color={shine} animate={animate} periodMs={2700} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frost: {
    opacity: 0.92,
  },
  sheen: {
    position: "absolute",
    top: -60,
    left: 0,
    width: 40,
  },
  flake: {
    position: "absolute",
    top: 0,
  },
});
