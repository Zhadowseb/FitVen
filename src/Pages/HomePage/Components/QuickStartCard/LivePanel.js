import { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "@localization";

import LivePanelBody from "./LivePanelBody";
import PanelConfetti from "./PanelConfetti";
import styles from "./LivePanelStyle";
import useLivePanelState from "./useLivePanelState";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled } from "@resources/Components/animationHooks";
import { ThemedText } from "@resources/ThemedComponents";
import { EASE_IN_OUT, sampleTrack } from "@utils/keyframeTimeline";
import { livePanelTone, newlyFilledBars } from "@utils/liveQuickStart";
import { formatCountdownTime, formatElapsedTime } from "@utils/timeUtils";

// The panel's colours cross over in 400 ms when it turns gold or green.
const TONE_MS = 400;
// A view comes in over 360 ms, rising 8 dp as it fades up.
const ENTER_MS = 360;
const ENTER_CURVE = Easing.bezier(0.2, 0.8, 0.3, 1);
const ENTER_RISE = 8;
// The rest runs out of the panel; when it stops, what is left drains away in 400 ms.
const DRAIN_OUT_MS = 400;
// The flash when the rest is over.
const FLASH_FROM = 0.35;
const FLASH_MS = 700;
// The dot's ring goes out 5 dp and fades, then comes back in.
const DOT_MS = 1400;
const DOT_SIZE = 7;
const DOT_SPREAD = [
  [0, 0],
  [0.6, 5],
  [1, 0],
];
const DOT_ALPHA = [
  [0, 0.55],
  [0.6, 0],
  [1, 0.55],
];
// Next to nothing rather than nothing: a scale of 0 is a matrix Android
// cannot take apart.
const EMPTY = 0.001;

// The live dot, its ring breathing out and in.
function LiveDot({ tone, animate }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(phase);
    phase.value = 0;

    if (!animate) {
      return undefined;
    }

    phase.value = withRepeat(withTiming(1, { duration: DOT_MS, easing: Easing.linear }), -1);

    return () => cancelAnimation(phase);
  }, [animate, phase]);

  const ringStyle = useAnimatedStyle(() => {
    const spread = sampleTrack(DOT_SPREAD, phase.value, EASE_IN_OUT);

    return {
      opacity: sampleTrack(DOT_ALPHA, phase.value, EASE_IN_OUT),
      transform: [{ scale: 1 + (2 * spread) / DOT_SIZE }],
    };
  });

  return (
    <View style={styles.dot}>
      {animate ? (
        <Animated.View style={[styles.dotRing, { backgroundColor: tone }, ringStyle]} />
      ) : null}
      <View style={[styles.dot, { backgroundColor: tone }]} />
    </View>
  );
}

// The body, faded up into place whenever the view changes - once somebody
// can see it. A change made while Home was under the workout screen plays
// when they come back to it.
function BodyFrame({ visible, animate, children }) {
  const shown = useSharedValue(visible && !animate ? 1 : 0);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!visible || playedRef.current) {
      return;
    }

    playedRef.current = true;
    cancelAnimation(shown);

    if (animate) {
      shown.value = withTiming(1, { duration: ENTER_MS, easing: ENTER_CURVE });
    } else {
      shown.value = 1;
    }
  }, [animate, shown, visible]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: ENTER_RISE * (1 - shown.value) }],
  }));

  return <Animated.View style={[styles.body, style]}>{children}</Animated.View>;
}

/**
 * Quick start while a workout is running: the whole block is one panel that
 * opens it, and shows what matters right now - the first set, the rest
 * counting down and draining out of the panel, "ready" once it is over, the
 * next set, a new record in gold with confetti, or, green, that every set is
 * done. On top, a live dot and how long the workout has been going.
 *
 * Colours are fire while training, the record star's gold for a record and
 * the green of a finished day - all from the theme. It moves only while
 * Home is on screen, the app is in front and reduce motion is off.
 */
export default function LivePanel({ workout, live, onOpen }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Light mode's record gold is dark enough to read as text; the light it
  // catches borrows the bright gold, as the record star does.
  const gold = colorScheme === "dark" ? theme.recordLight : Colors.dark.record;
  const { animate, visible } = useAnimationsEnabled();
  const { view, focus, progress, record, rest, restKey, readyKey, elapsed } = useLivePanelState({
    workout,
    live,
    visible,
  });
  const tone = livePanelTone(view, {
    fire: theme.fire,
    record: theme.record,
    finished: theme.secondary,
  });

  // The border and the wash cross over to the new colour.
  const surface = withAlpha(tone, 0.07);
  const background = useSharedValue(surface);
  const border = useSharedValue(tone);

  useEffect(() => {
    if (animate) {
      background.value = withTiming(surface, { duration: TONE_MS });
      border.value = withTiming(tone, { duration: TONE_MS });
    } else {
      background.value = surface;
      border.value = tone;
    }
  }, [animate, background, border, surface, tone]);

  const panelStyle = useAnimatedStyle(() => ({
    backgroundColor: background.value,
    borderColor: border.value,
  }));

  // The rest drains out of the panel, from full to empty, in one smooth run.
  const drain = useSharedValue(0);
  const resting = view === "rest";
  const fraction = resting ? rest?.fraction ?? 0 : 0;
  const remaining = resting ? rest?.remaining ?? 0 : 0;
  const drainFromRef = useRef({ fraction, remaining });

  drainFromRef.current = { fraction, remaining };

  useEffect(() => {
    if (!animate) {
      return;
    }

    cancelAnimation(drain);

    if (resting && drainFromRef.current.remaining > 0) {
      drain.value = drainFromRef.current.fraction;
      drain.value = withTiming(0, {
        duration: drainFromRef.current.remaining * 1000,
        easing: Easing.linear,
      });
    } else {
      drain.value = withTiming(0, { duration: DRAIN_OUT_MS, easing: Easing.out(Easing.ease) });
    }
  }, [animate, drain, restKey, resting]);

  // Still, it follows the seconds.
  useEffect(() => {
    if (!animate) {
      cancelAnimation(drain);
      drain.value = fraction;
    }
  }, [animate, drain, fraction]);

  const drainStyle = useAnimatedStyle(() => ({
    opacity: drain.value <= EMPTY ? 0 : 1,
    transform: [{ scaleX: Math.max(EMPTY, drain.value) }],
  }));

  // It flashes once as the rest runs out - or, if that happened while Home
  // was out of sight, as soon as it is back.
  const flash = useSharedValue(0);
  const flashedRef = useRef(null);

  useEffect(() => {
    if (readyKey === null || !visible || flashedRef.current === readyKey) {
      return;
    }

    flashedRef.current = readyKey;

    if (animate) {
      flash.value = FLASH_FROM;
      flash.value = withTiming(0, { duration: FLASH_MS, easing: Easing.out(Easing.ease) });
    }
  }, [animate, flash, readyKey, visible]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  // The bars that filled in since the panel last showed them.
  const showsBars = view !== "record" && view !== "finished";
  const seenRef = useRef(null);
  const fills = showsBars ? newlyFilledBars(seenRef.current, focus.set) : [];

  useEffect(() => {
    if (visible && showsBars && focus.set) {
      seenRef.current = { exerciseId: focus.set.exerciseId, doneFlags: focus.set.doneFlags };
    }
  });

  const name = workout?.name ?? t("home.quickStart.todaysWorkout");
  const viewKey = `${view}|${focus.set?.setId ?? focus.set?.exerciseId ?? "-"}|${record?.setId ?? ""}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        resting && rest
          ? t("home.quickStart.live.continueResting", {
              name,
              time: formatCountdownTime(rest.remaining),
            })
          : t("home.quickStart.continueNamed", { name })
      }
      activeOpacity={0.85}
      onPress={onOpen}
      style={liveStyles.press}
    >
      <Animated.View style={[styles.panel, panelStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.drain, { backgroundColor: withAlpha(tone, 0.13) }, drainStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: tone }, flashStyle]}
        />

        <View style={styles.top}>
          <LiveDot tone={tone} animate={animate} />
          <ThemedText style={styles.eyebrow} setColor={tone} numberOfLines={1}>
            {t("home.quickStart.live.inProgress")}
          </ThemedText>
          <ThemedText style={styles.clock} setColor={theme.quietText}>
            {formatElapsedTime(elapsed)}
          </ThemedText>
        </View>

        <BodyFrame key={viewKey} visible={visible} animate={animate}>
          <LivePanelBody
            view={view}
            focus={focus}
            progress={progress}
            record={record}
            rest={rest}
            theme={theme}
            accent={tone}
            gold={gold}
            fills={fills}
            fallbackName={name}
            animate={animate}
            visible={visible}
          />
        </BodyFrame>

        {view === "record" && record && animate ? (
          <PanelConfetti
            key={record.setId}
            colors={[gold, theme.record, theme.fire, theme.secondary]}
          />
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

const liveStyles = StyleSheet.create({
  press: {
    flex: 1,
  },
});
