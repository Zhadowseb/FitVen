import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { useBreathAnimation } from "../animationHooks";
import { boltPath, buildCharge } from "@utils/tileMoodGeometry";

let chargeInstanceCounter = 0;

const GLOW_SIZE = 190;

// A strike, the way current moves: no build-up, on at once, a stutter of
// flashes over a fifth of a second, gone. [opacity, how long it holds]
const STRIKE = [
  [1, 45],
  [0.15, 30],
  [1, 35],
  [0.4, 25],
  [0.95, 40],
  [0, 0],
];

function useStrike(enabled, { gapMs, headStartMs }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      opacity.setValue(0);
      return undefined;
    }

    const step = ([value, holdMs]) =>
      Animated.sequence([
        Animated.timing(opacity, { toValue: value, duration: 0, useNativeDriver: true }),
        Animated.delay(holdMs),
      ]);
    const animation = Animated.sequence([
      Animated.delay(headStartMs),
      Animated.loop(Animated.sequence([...STRIKE.map(step), Animated.delay(gapMs)])),
    ]);

    animation.start();

    return () => {
      animation.stop();
      opacity.setValue(0);
    };
  }, [enabled, gapMs, headStartMs, opacity]);

  return opacity;
}

// The glow behind the avatar: steady, pulsing, the charge that is there
// whether or not a bolt is showing. Wide and soft rather than bright at the
// heart, so it reads as a charge in the air and not as a lamp.
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
            <Stop offset="0" stopColor={theme.chargeCore} stopOpacity={0.2} />
            <Stop offset="0.55" stopColor={theme.charge} stopOpacity={0.1} />
            <Stop offset="1" stopColor={theme.charge} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

// One little bolt: strikes - on at once, flickers, gone - then waits its
// turn in the same spot.
function StrikeBolt({ bolt, theme, animate }) {
  const opacity = useStrike(animate, { gapMs: bolt.gapMs, headStartMs: bolt.delayMs });
  const box = bolt.size * 2;
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
          transform: [{ rotate: `${bolt.rotate}deg` }],
        },
      ]}
    >
      <Svg width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`}>
        {/* A thin halo round the stroke, then the bolt itself. */}
        <Path d={d} fill="none" stroke={theme.charge} strokeOpacity={0.35} strokeWidth={1.1} strokeLinejoin="round" />
        <Path d={d} fill={theme.chargeCore} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The tile of somebody who trained in the last five days, charged and ready
 * to go again: a wide, soft glow pulsing steadily behind the avatar, and
 * tiny yellow bolts striking here and there around it - on at once and
 * flickering out, the way current moves. More bolts, more often, the day
 * after; the odd one by the fifth day.
 *
 * Behind the text and outside the layout. Off screen and under reduced
 * motion only the glow stays, still.
 */
export default function ChargeFrame({ theme, seed = 0, level = 3, animate = false, focus = "avatar" }) {
  const [size, setSize] = useState(null);
  const geometry = useMemo(() => {
    if (!size) {
      return null;
    }

    // "middle": the glow behind whatever sits in the middle of the box - the
    // number on the days-since card - with room kept round it.
    const middle =
      focus === "middle"
        ? { centre: { x: size.width / 2, y: size.height / 2 }, clearance: 26 }
        : {};

    return buildCharge({ ...size, seed, level, ...middle });
  }, [focus, level, seed, size]);

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
                <StrikeBolt key={index} bolt={bolt} theme={theme} animate={animate} />
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
