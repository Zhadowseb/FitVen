import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

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
