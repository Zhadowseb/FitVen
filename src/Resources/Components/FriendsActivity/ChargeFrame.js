import { useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from "react-native-svg";

import { useBreathAnimation, useSheenAnimation } from "../animationHooks";
import { boltPath, buildCharge } from "@utils/tileMoodGeometry";

let chargeInstanceCounter = 0;

const GLOW_SIZE = 130;
const POP_MS = 460;

// The glow behind the avatar: steady, pulsing, the charge that is there
// whether or not a bolt is showing.
function CentreGlow({ centre, theme, animate }) {
  const gradientId = useRef(`charge-glow-${++chargeInstanceCounter}`).current;
  const pulse = useBreathAnimation(animate, { periodMs: 2200, low: 0.5 });
  const scale = pulse.interpolate({ inputRange: [0.5, 1], outputRange: [0.9, 1.06] });

  return (
    <Animated.View
      style={[
        styles.glow,
        {
          left: centre.x - GLOW_SIZE / 2,
          top: centre.y - GLOW_SIZE / 2,
          opacity: pulse,
          transform: [{ scale }],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.chargeCore} stopOpacity={0.4} />
            <Stop offset="0.5" stopColor={theme.charge} stopOpacity={0.16} />
            <Stop offset="1" stopColor={theme.charge} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

// One little bolt: pops up with a flash, holds for a blink, and goes, then
// waits its turn in the same spot.
function PopBolt({ bolt, theme, animate }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: POP_MS,
    gapMs: bolt.gapMs,
    headStartMs: bolt.delayMs,
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.6, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.18, 0.4, 1],
    outputRange: [0.3, 1.2, 1, 0.85],
  });
  const box = bolt.size * 2.4;
  const d = boltPath(bolt.size);

  return (
    <Animated.View
      style={[
        styles.bolt,
        {
          left: bolt.x - box / 2,
          top: bolt.y - box / 2,
          width: box,
          height: box,
          opacity,
          transform: [{ scale }, { rotate: `${bolt.rotate}deg` }],
        },
      ]}
    >
      <Svg width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`}>
        <G>
          {/* A soft flash round it, then the bolt itself. */}
          <Circle cx="0" cy="0" r={bolt.size * 0.9} fill={theme.charge} fillOpacity={0.14} />
          <Path d={d} fill="none" stroke={theme.charge} strokeOpacity={0.45} strokeWidth={2.2} strokeLinejoin="round" />
          <Path d={d} fill={theme.chargeCore} stroke={theme.charge} strokeWidth={0.5} strokeLinejoin="round" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * The tile of somebody who trained in the last three days, charged and ready
 * to go again: a glow pulsing steadily behind the avatar, and tiny yellow
 * bolts popping up here and there around it. More bolts, more often, the day
 * after; the odd one by the third day.
 *
 * Behind the text and outside the layout. Off screen and under reduced
 * motion only the glow stays, still.
 */
export default function ChargeFrame({ theme, seed = 0, level = 3, animate = false }) {
  const [size, setSize] = useState(null);
  const geometry = useMemo(
    () => (size ? buildCharge({ ...size, seed, level }) : null),
    [level, seed, size]
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
          <CentreGlow centre={geometry.centre} theme={theme} animate={animate} />
          {animate
            ? geometry.bolts.map((bolt, index) => (
                <PopBolt key={index} bolt={bolt} theme={theme} animate={animate} />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  bolt: {
    position: "absolute",
  },
});
