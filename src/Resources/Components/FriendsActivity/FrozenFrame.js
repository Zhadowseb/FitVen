import { useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { withAlpha } from "../../GlobalStyling/colors";
import { useBreathAnimation, useSheenAnimation } from "../animationHooks";
import { buildFrostGeometry, iciclePath } from "@utils/frostGeometry";

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

function FrameSvg({ geometry, children }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      {children}
    </Svg>
  );
}

// One group of ferns, shimmering on its own period.
function FernLayer({ geometry, group, color, animate, periodMs }) {
  const opacity = useBreathAnimation(animate, { periodMs, low: 0.45 });
  const ferns = geometry.ferns[group];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <FrameSvg geometry={geometry}>
        <Path d={ferns.stems} stroke={color} strokeWidth={1.15} strokeLinecap="round" fill="none" />
        <Path d={ferns.shoots} stroke={color} strokeWidth={0.7} strokeLinecap="round" fill="none" />
      </FrameSvg>
    </Animated.View>
  );
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
      <FrameSvg geometry={geometry}>
        <Path d={d} fill={color} />
      </FrameSvg>
    </Animated.View>
  );
}

// Light catching the ice: a slanted band crossing the whole block now and
// then, the way a glass catches a window.
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
            <Stop offset="0.5" stopColor={color} stopOpacity={0.22} />
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
  // Faint while it is high up behind the text, clearest in the middle.
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
 * The tile of somebody who has not trained in a month, as a block of ice: a
 * thick glassy rim with its edges catching the light, frost ferns growing in
 * from every side, loose crystals, short icicles under the top of the rim.
 *
 * And it moves, while the strip is on screen and motion is allowed: the frost
 * shimmers in two groups out of step, sparkles blink along the rim, a band of
 * light crosses the ice now and then, and a few flakes of snow fall through.
 *
 * Drawn behind the tile's text rather than over it, so a name or a status is
 * never iced out, and outside the layout - measured, not measuring.
 */
export default function FrozenFrame({ theme, colorScheme, seed = 0, animate = false, cornerRadius = 20 }) {
  const icicleGradientId = useRef(`frost-icicle-${++frostInstanceCounter}`).current;
  const rimGradientId = useRef(`frost-rim-${++frostInstanceCounter}`).current;
  const hazeXId = useRef(`frost-haze-x-${++frostInstanceCounter}`).current;
  const hazeYId = useRef(`frost-haze-y-${++frostInstanceCounter}`).current;
  const [size, setSize] = useState(null);
  const isLight = colorScheme === "light";
  const ice = theme.ice;
  const shine = isLight ? "#FFFFFF" : "#F2FAFF";
  const frostColor = isLight ? withAlpha(ice, 0.6) : withAlpha(ice, 0.62);
  const geometry = useMemo(
    () => (size ? buildFrostGeometry({ ...size, seed, cornerRadius }) : null),
    [cornerRadius, seed, size]
  );

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
      {geometry ? (
        <>
          <FrameSvg geometry={geometry}>
            <Defs>
              <LinearGradient id={icicleGradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ice} stopOpacity={isLight ? 0.75 : 0.9} />
                <Stop offset="1" stopColor={ice} stopOpacity={0.15} />
              </LinearGradient>
              {/* Brighter at the top left, where the light comes from. */}
              <LinearGradient id={rimGradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={shine} stopOpacity={isLight ? 0.95 : 0.78} />
                <Stop offset="0.45" stopColor={ice} stopOpacity={0.42} />
                <Stop offset="1" stopColor={shine} stopOpacity={isLight ? 0.7 : 0.5} />
              </LinearGradient>
              {/* Frost clouding the glass in from each edge, gone by the middle. */}
              <LinearGradient id={hazeXId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={ice} stopOpacity={0.24} />
                <Stop offset="0.18" stopColor={ice} stopOpacity={0.06} />
                <Stop offset="0.5" stopColor={ice} stopOpacity={0} />
                <Stop offset="0.82" stopColor={ice} stopOpacity={0.06} />
                <Stop offset="1" stopColor={ice} stopOpacity={0.24} />
              </LinearGradient>
              <LinearGradient id={hazeYId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ice} stopOpacity={0.16} />
                <Stop offset="0.14" stopColor={ice} stopOpacity={0} />
                <Stop offset="0.84" stopColor={ice} stopOpacity={0} />
                <Stop offset="1" stopColor={ice} stopOpacity={0.24} />
              </LinearGradient>
            </Defs>

            {/* The block's cold, a tint over everything inside. */}
            <Rect
              x="0"
              y="0"
              width={geometry.width}
              height={geometry.height}
              fill={ice}
              fillOpacity={isLight ? 0.06 : 0.07}
            />
            <Rect x="0" y="0" width={geometry.width} height={geometry.height} fill={`url(#${hazeXId})`} />
            <Rect x="0" y="0" width={geometry.width} height={geometry.height} fill={`url(#${hazeYId})`} />

            {/* The rim: a thick band of ice, a bright outer edge, and the
                inner edge where the ice meets the tile. */}
            <Rect
              x={geometry.rim / 2}
              y={geometry.rim / 2}
              width={geometry.width - geometry.rim}
              height={geometry.height - geometry.rim}
              rx={cornerRadius - geometry.rim / 2}
              fill="none"
              stroke={`url(#${rimGradientId})`}
              strokeWidth={geometry.rim}
            />
            <Rect
              x="0.75"
              y="0.75"
              width={geometry.width - 1.5}
              height={geometry.height - 1.5}
              rx={cornerRadius - 0.75}
              fill="none"
              stroke={shine}
              strokeOpacity={isLight ? 0.95 : 0.7}
              strokeWidth={1.5}
            />
            <Rect
              x={geometry.rim}
              y={geometry.rim}
              width={geometry.width - geometry.rim * 2}
              height={geometry.height - geometry.rim * 2}
              rx={Math.max(4, cornerRadius - geometry.rim)}
              fill="none"
              stroke={ice}
              strokeOpacity={0.55}
              strokeWidth={1}
            />

            <Path d={geometry.crystals} stroke={frostColor} strokeWidth={0.9} strokeLinecap="round" fill="none" />

            {geometry.icicles.map((icicle, index) => (
              <Path key={index} d={iciclePath(icicle)} fill={`url(#${icicleGradientId})`} />
            ))}
          </FrameSvg>

          <FernLayer geometry={geometry} group={0} color={frostColor} animate={animate} periodMs={3000 + (seed % 3) * 300} />
          <FernLayer geometry={geometry} group={1} color={frostColor} animate={animate} periodMs={3900 + (seed % 2) * 400} />

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
