import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";

// A small figure walking in place, drawn from rounded bars with transforms and
// nothing else, so it runs on the native driver. One phase value loops 0 -> 1
// per stride (two steps); every joint reads the same phase, and the leg and arm
// that are behind are the same curve half a stride later.
//
// Drawn in the 64 x 84 box of the design (WalkWorkout.dc.html) and scaled to
// fit. Decorative: the screen hides it from screen readers.

const BOX_WIDTH = 64;
const BOX_HEIGHT = 84;
const STROKE = 5;
const SAMPLES = 16;

const TAU = Math.PI * 2;

// A curve sampled at SAMPLES + 1 points over one stride, closed on itself.
const sample = (curve) =>
  Array.from({ length: SAMPLES + 1 }, (_, index) => curve(index / SAMPLES));

// The same curve half a stride later.
const halfStrideLater = (values) =>
  values.map((_, index) => values[(index + SAMPLES / 2) % SAMPLES]);

// Hip, knee, shoulder and elbow swing, in degrees, from the design's keyframes.
const THIGH = sample((t) => -28 * Math.cos(TAU * t));
const SHANK = (() => {
  // Straight through the design's five keyframes: 6, 10, 22, 62, 6.
  const keys = [6, 10, 22, 62, 6];

  return sample((t) => {
    const scaled = t * 4;
    const from = Math.min(3, Math.floor(scaled));

    return keys[from] + (keys[from + 1] - keys[from]) * (scaled - from);
  });
})();
const UPPER_ARM = sample((t) => 26 * Math.cos(TAU * t));
const FOREARM = sample((t) => -32 + 14 * Math.cos(TAU * t));
// The body rises on each step: twice per stride.
const BOB = sample((t) => -1.25 * (1 - Math.cos(2 * TAU * t)));

const INPUT = Array.from({ length: SAMPLES + 1 }, (_, index) => index / SAMPLES);

const degrees = (values) => values.map((value) => `${value}deg`);

// A bar hanging from its top end, which is where it turns. A child bar is
// hung from this one's bottom end.
function Limb({ left, top, length, color, phase, curve, thickness = STROKE, foot = 0, opacity = 1, children }) {
  const rotate = useMemo(
    () => phase.interpolate({ inputRange: INPUT, outputRange: degrees(curve) }),
    [phase, curve]
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: left - thickness / 2,
        top,
        width: thickness,
        height: length,
        opacity,
        transform: [{ translateY: -length / 2 }, { rotate }, { translateY: length / 2 }],
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: -thickness / 2,
          width: thickness,
          height: length + thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
        }}
      />
      {foot > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: length - thickness / 2,
            width: foot + thickness,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: color,
          }}
        />
      ) : null}
      {children}
    </Animated.View>
  );
}

// The figure from the back to the front: the far arm and leg (fainter, half a
// stride behind), the torso and head, then the near leg and arm. A child bar is
// hung from its parent's bottom end, on the parent's centre line.
function Body({ phase, color, near, far }) {
  const [thigh, shank, upperArm, forearm] = near;
  const [farThigh, farShank, farUpperArm, farForearm] = far;

  return (
    <>
      <Limb left={32} top={22} length={12} color={color} phase={phase} curve={farUpperArm} opacity={0.5}>
        <Limb left={STROKE / 2} top={12} length={11} color={color} phase={phase} curve={farForearm} />
      </Limb>
      <Limb left={31} top={44} length={18} color={color} phase={phase} curve={farThigh} opacity={0.5}>
        <Limb left={STROKE / 2} top={18} length={17} color={color} phase={phase} curve={farShank} foot={6} />
      </Limb>

      <View
        style={{
          position: "absolute",
          left: 31 - STROKE / 2,
          top: 19,
          width: STROKE,
          height: 25,
          borderRadius: STROKE / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 33 - 6.5,
          top: 9 - 6.5,
          width: 13,
          height: 13,
          borderRadius: 6.5,
          backgroundColor: color,
        }}
      />

      <Limb left={31} top={44} length={18} color={color} phase={phase} curve={thigh}>
        <Limb left={STROKE / 2} top={18} length={17} color={color} phase={phase} curve={shank} foot={6} />
      </Limb>
      <Limb left={32} top={22} length={12} color={color} phase={phase} curve={upperArm}>
        <Limb left={STROKE / 2} top={12} length={11} color={color} phase={phase} curve={forearm} />
      </Limb>
    </>
  );
}

function WalkFigure({ color, strideSeconds, animate, width = 52, height = 68 }) {
  const phase = useRef(new Animated.Value(0.25)).current;
  const scale = Math.min(width / BOX_WIDTH, height / BOX_HEIGHT);

  const near = useMemo(() => [THIGH, SHANK, UPPER_ARM, FOREARM], []);
  const far = useMemo(
    () => [
      halfStrideLater(THIGH),
      halfStrideLater(SHANK),
      halfStrideLater(UPPER_ARM),
      halfStrideLater(FOREARM),
    ],
    []
  );
  const bob = useMemo(
    () => phase.interpolate({ inputRange: INPUT, outputRange: BOB }),
    [phase]
  );

  // The loop only restarts when the stride has changed enough to see, so a
  // cadence that wobbles by a step does not make the figure stutter.
  const strideMs = strideSeconds ? Math.round((strideSeconds * 1000) / 50) * 50 : null;

  useEffect(() => {
    if (!animate || !strideMs) {
      // A still pose: nothing to do while no cadence is known, or when the
      // reader has asked for less motion.
      phase.setValue(0.25);
      return undefined;
    }

    phase.setValue(0);

    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: strideMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [animate, strideMs, phase]);

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          width: BOX_WIDTH,
          height: BOX_HEIGHT,
          transform: [{ scale }, { translateY: bob }],
        }}
      >
        <Body phase={phase} color={color} near={near} far={far} />
      </Animated.View>
    </View>
  );
}

export default memo(WalkFigure);
