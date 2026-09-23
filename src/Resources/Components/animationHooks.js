import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// Whether the OS asks for reduced motion. Read once and then followed, so a
// change in Settings takes effect without a restart.
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(Boolean(enabled))
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}

// Three bars of a music equalizer: scaleY 0.4 <-> 1.0 over 900 ms
// ease-in-out, offset 0 / -300 / -600 ms so they never move together.
// Returns three Animated values to use as scaleY. Disabled -> bars stand still
// at full height.
export function useEqualizerAnimation(enabled = true, periodMs = 900) {
  const bars = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    if (!enabled) {
      bars.forEach((bar) => bar.setValue(1));
      return undefined;
    }

    const loops = bars.map((bar, index) => {
      // A negative delay in CSS means "start part-way through"; here the same
      // effect is a head start of the remaining time on the first cycle.
      const headStart = (index * (periodMs / 3)) % (periodMs * 2);

      return Animated.loop(
        Animated.sequence([
          Animated.delay(headStart),
          Animated.timing(bar, {
            toValue: 0.4,
            duration: periodMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 1,
            duration: periodMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    });

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
      bars.forEach((bar) => bar.setValue(1));
    };
  }, [bars, enabled, periodMs]);

  return bars;
}

// A news ticker: two copies of the text sit side by side and the pair slides
// left by half its total width, then jumps back, so the seam is invisible.
// Returns a translateX to put on the moving row. Runs only when `enabled` and
// the text is wider than its container; otherwise the value stays at 0.
export function useTickerAnimation({
  enabled = true,
  textWidth = 0,
  containerWidth = 0,
  durationMs = 9000,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const shouldScroll =
    enabled && textWidth > 0 && containerWidth > 0 && textWidth > containerWidth + 1;

  useEffect(() => {
    if (!shouldScroll) {
      translateX.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(translateX, {
          toValue: -textWidth,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      translateX.setValue(0);
    };
  }, [durationMs, shouldScroll, textWidth, translateX]);

  return { translateX, isScrolling: shouldScroll };
}

// fvBlink from the handoff: opacity 1 <-> 0.2, 1s, stepped (hard on/off).
export function useBlinkAnimation(enabled = true, periodMs = 1000) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      opacity.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 0,
          delay: periodMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 0,
          delay: periodMs / 2,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [enabled, opacity, periodMs]);

  return opacity;
}

// fvPulse from the handoff: scale 1 -> 1.45 while opacity 0.5 -> 0,
// 2.4s ease-out, infinite. Returns { scale, opacity } to spread onto an
// absolutely-positioned glow layer behind the pulsing element.
export function usePulseAnimation(enabled = true, periodMs = 2400) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      progress.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: periodMs * 0.7,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: periodMs * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [enabled, periodMs, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1.45, 1.45],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.5, 0, 0],
  });

  return { scale, opacity };
}

// fvSpin from the handoff: continuous 360deg linear rotation.
export function useSpinAnimation(enabled = true, periodMs = 2000) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      progress.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: periodMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [enabled, periodMs, progress]);

  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
}

// A shine crossing a tile: progress 0 -> 1 over `sweepMs`, then a pause of
// `gapMs`, forever. `headStartMs` holds the first sweep back, so a row of
// tiles does not flash in step. Disabled -> parked at 0, off the tile.
// `linear` for something that should move at one speed, like falling snow.
export function useSheenAnimation(
  enabled = true,
  { sweepMs = 1300, gapMs = 4000, headStartMs = 0, linear = false } = {}
) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      progress.setValue(0);
      return undefined;
    }

    const animation = Animated.sequence([
      Animated.delay(headStartMs),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: sweepMs,
            easing: linear ? Easing.linear : Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(gapMs),
          Animated.timing(progress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [enabled, gapMs, headStartMs, linear, progress, sweepMs]);

  return progress;
}

// A slow breath: opacity `low` <-> 1 over `periodMs`, ease-in-out.
// Disabled -> fully there.
export function useBreathAnimation(enabled = true, { periodMs = 2600, low = 0.6 } = {}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      opacity.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: low,
          duration: periodMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: periodMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [enabled, low, opacity, periodMs]);

  return opacity;
}

// Whether the loops may run: on screen, app in the foreground, and the OS not
// asking for reduced motion. Everything that loops on Home reads this - the
// friends strip and the days-since card alike.
export function useAnimationsEnabled() {
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active" || AppState.currentState == null
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });

    return () => subscription.remove();
  }, []);

  return { animate: isFocused && isAppActive && !reduceMotion, reduceMotion };
}
