// The splash shown while the stored session is being restored: a barbell loads
// three plates a side one by one, lifts with a small shake, lands with a bump
// and starts over (6 s). Under it the title, a line that cycles every 3 s, and
// a thin progress bar sweeping at the bottom.
//
// It is shown for as long as the app is really waiting (see App.js) and never
// on a timer. Only Animated and View, all on the native driver. "Reduce
// motion" stops it on a still frame and the message does not cycle.
//
// Colours come from the theme (inline: a Style.js freezes them at import, see
// src/Pages/AGENTS.md), so the splash follows light and dark, and the accent
// once it has been read. `colors` can override any of them.

import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Text, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "../../GlobalStyling/colors";
import styles, { BAR_WIDTH } from "./RestoringSessionStyle";

const LOOP_MS = 6000; // one lift
const MESSAGE_MS = 3000; // one message
const BAR_MS = 1700; // one sweep of the progress bar

// Plate sizes from the middle outwards: the height, the colour, and when in the lift it appears.
const PLATES = [
  { h: 94, color: "primary", at: 0.06 },
  { h: 76, color: "secondary", at: 0.16 },
  { h: 58, color: "steel", at: 0.26 },
];

function plateStyle(t, colors, plate) {
  const range = [0, plate.at, plate.at + 0.06, plate.at + 0.09, 0.9, 0.97, 1];

  return {
    width: 14,
    height: plate.h,
    borderRadius: 4,
    backgroundColor: colors[plate.color],
    opacity: t.interpolate({ inputRange: range, outputRange: [0, 0, 1, 1, 1, 0, 0] }),
    transform: [{ scale: t.interpolate({ inputRange: range, outputRange: [0, 0, 1.25, 1, 1, 0, 0] }) }],
  };
}

function themeColors(theme) {
  return {
    bg: theme.background,
    title: theme.title,
    text: theme.text,
    quiet: theme.quietText,
    primary: theme.primary,
    secondary: theme.secondary,
    steel: theme.text,
    collar: theme.title,
    track: theme.border,
  };
}

export default function RestoringSession({ colors: colorOverrides, title, messages }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const colors = { ...themeColors(theme), ...colorOverrides };
  const { t } = useTranslation();
  const shownTitle = title ?? t("common.restoringSession.title");
  const lines = useMemo(
    () =>
      messages ?? [
        t("common.restoringSession.warmingUp"),
        t("common.restoringSession.loadingPlates"),
        t("common.restoringSession.chalkingUp"),
        t("common.restoringSession.spotting"),
      ],
    [messages, t]
  );

  const lift = useRef(new Animated.Value(0)).current; // 0..1 over LOOP_MS
  const bar = useRef(new Animated.Value(0)).current; // 0..1 over BAR_MS
  const messageFade = useRef(new Animated.Value(1)).current;
  const [messageIndex, setMessageIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      lift.setValue(0.5);
      bar.setValue(0.4);
      return undefined;
    }

    const lifting = Animated.loop(
      Animated.timing(lift, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true })
    );
    const sweeping = Animated.loop(
      Animated.timing(bar, {
        toValue: 1,
        duration: BAR_MS,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      })
    );

    lift.setValue(0);
    bar.setValue(0);
    lifting.start();
    sweeping.start();

    return () => {
      lifting.stop();
      sweeping.stop();
    };
  }, [reduceMotion, lift, bar]);

  useEffect(() => {
    if (reduceMotion) {
      return undefined;
    }

    const id = setInterval(() => {
      Animated.timing(messageFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setMessageIndex((index) => (index + 1) % lines.length);
        Animated.timing(messageFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    }, MESSAGE_MS);

    return () => clearInterval(id);
  }, [reduceMotion, lines.length, messageFade]);

  // The lift: at rest, up (with a small shake), down with a bump.
  const liftY = lift.interpolate({
    inputRange: [0, 0.4, 0.52, 0.62, 0.72, 0.75, 0.78, 1],
    outputRange: [0, 0, -74, -74, 0, 4, 0, 0],
  });
  const liftRotate = lift.interpolate({
    inputRange: [0, 0.4, 0.52, 0.54, 0.56, 0.58, 0.62, 0.72, 1],
    outputRange: ["0deg", "0deg", "-2deg", "2deg", "-2deg", "0deg", "0deg", "0deg", "0deg"],
  });
  const shadowScale = lift.interpolate({
    inputRange: [0, 0.4, 0.52, 0.62, 0.72, 1],
    outputRange: [1, 1, 0.6, 0.6, 1, 1],
  });
  const shadowOpacity = lift.interpolate({
    inputRange: [0, 0.4, 0.52, 0.62, 0.72, 1],
    outputRange: [0.5, 0.5, 0.2, 0.2, 0.5, 0.5],
  });
  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-0.4 * BAR_WIDTH, BAR_WIDTH] });

  const side = (mirror) => {
    const plates = mirror ? PLATES : [...PLATES].reverse();

    return plates.map((plate) => (
      <Animated.View key={`${mirror ? "r" : "l"}${plate.h}`} style={plateStyle(lift, colors, plate)} />
    ));
  };

  return (
    <View
      style={[styles.root, { backgroundColor: colors.bg }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={shownTitle}
    >
      {/* Brand name, upper-cased by the style: the same word in every language. */}
      <Text style={[styles.brand, { color: colors.quiet }]}>FitVen</Text>

      <View style={styles.stage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={[styles.lift, { transform: [{ translateY: liftY }, { rotate: liftRotate }] }]}>
          <View style={[styles.bar, { backgroundColor: colors.steel }]} />
          <View style={styles.row}>
            {side(false)}
            <View style={[styles.collar, { backgroundColor: colors.collar }]} />
            <View style={styles.gap} />
            <View style={[styles.collar, { backgroundColor: colors.collar }]} />
            {side(true)}
          </View>
        </Animated.View>
        <Animated.View style={[styles.shadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]} />
      </View>

      <Text style={[styles.title, { color: colors.title }]}>{shownTitle}</Text>
      <Animated.Text style={[styles.message, { color: colors.text, opacity: messageFade }]}>
        {lines[messageIndex % lines.length]}
      </Animated.Text>

      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary, transform: [{ translateX: barX }] }]} />
      </View>
    </View>
  );
}
