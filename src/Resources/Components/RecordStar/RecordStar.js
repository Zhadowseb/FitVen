import { useEffect, useId, useRef } from "react";
import { View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import styles from "./RecordStarStyle";
import { useAnimationsEnabled } from "../animationHooks";
import { Colors } from "@resources/GlobalStyling/colors";

// The same five points as Resources/Icons/UI-icons/Star.
const STAR = "M12 2l2.4 6.2 6.6.3-5.2 4.2 1.8 6.4L12 15.4 6.4 19.1l1.8-6.4L3 8.5l6.6-.3z";
const SPARK = "M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4z";
// Short enough that a star 9 dp from the corner keeps its sparks inside the card.
const SPARKS = [
  { dx: -11, dy: -9 },
  { dx: 11, dy: -8 },
  { dx: 10, dy: 11 },
  { dx: -10, dy: 10 },
];
const SPARK_DURATION = 680;
const SPARK_STAGGER = 45;
const BURST_DURATION = SPARK_DURATION + SPARK_STAGGER * (SPARKS.length - 1);
const SHINE_DURATION = 720;
const TWINKLE_DURATION = 520;
// Half a second from one card's star to the next, on the way in and at every
// glint, so each one lands on its own.
const STAGGER = 500;
const IDLE_EVERY = 5000;
// Back on screen after another one: no second pop-in, just the glints again,
// soon enough that the page does not look asleep.
const RESUME_AFTER = 700;
const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const SMOOTH = Easing.inOut(Easing.quad);

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function Spark({ burst, order, dx, dy, color }) {
  const style = useAnimatedStyle(() => {
    const local = Math.min(
      1,
      Math.max(0, (burst.value * BURST_DURATION - order * SPARK_STAGGER) / SPARK_DURATION)
    );
    const eased = 1 - Math.pow(1 - local, 2.2);
    const reach = interpolate(eased, [0, 0.6, 1], [0, 1, 1.25]);

    return {
      opacity: interpolate(eased, [0, 0.25, 0.6, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: dx * reach },
        { translateY: dy * reach },
        { scale: interpolate(eased, [0, 0.6, 1], [0, 1, 0]) },
        { rotate: `${90 * eased}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.spark, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 10 10">
        <Path d={SPARK} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A gold star for the corner of a record card. It pops in with a ring, four
 * sparks and a shine across it, then glints every five seconds. `index`
 * staggers a row of cards so they read left to right. With reduce motion on
 * it simply sits there; off screen or with the app in the background the
 * glints stop, and they pick up again - without a second pop-in - on return.
 */
export default function RecordStar({ size = 22, index = 0, style }) {
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const gold = theme.record;
  // recordLight equals record in light mode, so the highlight borrows the bright gold.
  const glow = scheme === "dark" ? theme.recordLight : Colors.dark.record;
  const { animate, reduceMotion } = useAnimationsEnabled();
  const poppedRef = useRef(false);
  const id = useId().replace(/:/g, "");

  const pop = useSharedValue(0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);
  const shine = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    const all = [pop, ring, burst, shine, twinkle];
    const rest = () => {
      ring.value = 0;
      burst.value = 0;
      shine.value = 0;
      twinkle.value = 0;
    };

    all.forEach(cancelAnimation);

    if (reduceMotion) {
      poppedRef.current = true;
      pop.value = 1;
      rest();
      return undefined;
    }

    if (!animate) {
      // Seen once already: it stays, still. Never seen: it waits to pop in.
      if (poppedRef.current) {
        pop.value = 1;
      }

      rest();
      return undefined;
    }

    const start = index * STAGGER;
    const sweep = () =>
      withSequence(
        withTiming(1, { duration: SHINE_DURATION, easing: SMOOTH }),
        withTiming(0, { duration: 0 })
      );
    const idleSweeps = () =>
      withRepeat(
        withSequence(sweep(), withDelay(IDLE_EVERY - SHINE_DURATION, withTiming(0, { duration: 0 }))),
        -1
      );
    let idleAt;

    if (!poppedRef.current) {
      poppedRef.current = true;

      const shineAt = start + 640;

      idleAt = shineAt + IDLE_EVERY;
      pop.value = withDelay(start, withTiming(1, { duration: 560, easing: POP }));
      ring.value = withDelay(
        start + 360,
        withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) })
      );
      burst.value = withDelay(
        start + 400,
        withTiming(1, { duration: BURST_DURATION, easing: Easing.linear })
      );
      shine.value = withDelay(
        shineAt,
        withSequence(sweep(), withDelay(idleAt - shineAt - SHINE_DURATION, idleSweeps()))
      );
    } else {
      idleAt = start + RESUME_AFTER;
      pop.value = 1;
      rest();
      shine.value = withDelay(idleAt, idleSweeps());
    }

    twinkle.value = withDelay(
      idleAt,
      withRepeat(
        withSequence(
          withTiming(1, { duration: TWINKLE_DURATION, easing: SMOOTH }),
          withTiming(0, { duration: 0 }),
          withDelay(IDLE_EVERY - TWINKLE_DURATION, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );

    return () => all.forEach(cancelAnimation);
  }, [animate, reduceMotion, index]);

  const bodyStyle = useAnimatedStyle(() => {
    const bump = Math.sin(Math.PI * twinkle.value);

    return {
      opacity: interpolate(pop.value, [0, 0.35, 1], [0, 1, 1], "clamp"),
      transform: [
        { scale: pop.value * (1 + 0.12 * bump) },
        { rotate: `${-35 * (1 - pop.value) + 8 * bump}deg` },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.55 * (1 - ring.value),
    transform: [{ scale: 0.5 + 1.2 * ring.value }],
  }));

  const shineProps = useAnimatedProps(() => ({ x: -8 + 32 * shine.value }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        style={[
          styles.ring,
          { borderColor: glow, borderRadius: (size + 8) / 2 },
          ringStyle,
        ]}
      />

      {SPARKS.map((spark, order) => (
        <Spark key={order} burst={burst} order={order} dx={spark.dx} dy={spark.dy} color={glow} />
      ))}

      <Animated.View style={[styles.fill, bodyStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Defs>
            <ClipPath id={`${id}clip`}>
              <Path d={STAR} />
            </ClipPath>
            <LinearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={glow} />
              <Stop offset="1" stopColor={gold} />
            </LinearGradient>
          </Defs>

          <Path
            d={STAR}
            fill={`url(#${id}gold)`}
            stroke={`url(#${id}gold)`}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <G clipPath={`url(#${id}clip)`}>
            <G transform="rotate(20 12 12)">
              <AnimatedRect animatedProps={shineProps} y={-6} width={6} height={36} fill="#FFFFFF" opacity={0.55} />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
