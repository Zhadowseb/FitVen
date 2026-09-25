import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import Odometer from "./Odometer";
import styles from "./DaysSinceCardStyle";
import { ThemedText } from "@resources/ThemedComponents";
import { planOdometer } from "@utils/daysSinceCard";
import { EASE_OUT, LINEAR, ease, loopProgress, onceProgress, sampleTrack } from "@utils/keyframeTimeline";

const POP = [0.34, 1.56, 0.64, 1];
// A workout today: once the counter is down to 0 it is stamped, with a ring
// going out from it.
const STAMP_MS = 420;
const STAMP_SCALE = [
  [0, 1],
  [0.35, 1.28],
  [1, 1],
];
const STAMP_REST = { transform: [{ scale: 1 }] };
const RING_MS = 700;
const RING_SIZE = 46;
// Charged: the number takes the shock each time the bolt crackles, and glows.
const SHOCK_DELAY_MS = 900;
const SHOCK_MS = 3400;
const SHOCK_X = [
  [0, 0],
  [0.02, -1.5],
  [0.04, 1.5],
  [0.06, -1],
  [0.08, 0.5],
  [0.12, 0],
  [1, 0],
];
const SHOCK_Y = [
  [0, 0],
  [0.02, 0.5],
  [0.04, -0.5],
  [0.06, 0],
  [0.12, 0],
  [1, 0],
];
const SHOCK_GLOW = [
  [0, 0],
  [0.02, 1],
  [0.06, 0.67],
  [0.12, 0],
  [1, 0],
];
const SHOCK_REST = { transform: [{ translateX: 0 }, { translateY: 0 }] };
const GLOW_RADIUS = 12;

function Stamp({ atMs, entry, children }) {
  const style = useAnimatedStyle(() => {
    const t = onceProgress(entry.value, atMs, STAMP_MS);

    if (t <= 0 || t >= 1) {
      return STAMP_REST;
    }

    return { transform: [{ scale: sampleTrack(STAMP_SCALE, t, POP) }] };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

function Ring({ atMs, color, entry }) {
  const style = useAnimatedStyle(() => {
    const t = onceProgress(entry.value, atMs, RING_MS);

    if (t <= 0 || t >= 1) {
      return { opacity: 0 };
    }

    const e = ease(EASE_OUT, t);

    return { opacity: 0.8 * (1 - e), transform: [{ scale: 0.4 + 1.1 * e }] };
  });

  return <Animated.View style={[countStyles.ring, { borderColor: color }, style]} />;
}

function Shock({ clock, still, children }) {
  const style = useAnimatedStyle(() => {
    const time = clock.value;

    if (still || time < SHOCK_DELAY_MS) {
      return SHOCK_REST;
    }

    const p = loopProgress(time, SHOCK_DELAY_MS, SHOCK_MS);

    if (p >= 0.12) {
      return SHOCK_REST;
    }

    return {
      transform: [
        { translateX: sampleTrack(SHOCK_X, p, LINEAR) },
        { translateY: sampleTrack(SHOCK_Y, p, LINEAR) },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

// The glow round the digits as the shock goes through them: the number
// again behind the digits, in its own colour with a blur of it round every
// one, faded up and down. Padded, so the blur is never cut at the text's box.
function ShockGlow({ value, color, clock, still }) {
  const style = useAnimatedStyle(() => {
    const time = clock.value;

    if (still || time < SHOCK_DELAY_MS) {
      return { opacity: 0 };
    }

    return { opacity: sampleTrack(SHOCK_GLOW, loopProgress(time, SHOCK_DELAY_MS, SHOCK_MS), LINEAR) };
  });

  return (
    <Animated.View style={[countStyles.glow, style]} pointerEvents="none">
      <ThemedText
        numberOfLines={1}
        style={[styles.value, countStyles.glowText, { textShadowColor: color }]}
        setColor={color}
      >
        {value}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * The day count in the states that show one: the odometer, stamped with a
 * ring going out on the day you trained, and jolted and glowing with each
 * crackle while charged. None of it changes the number's size.
 */
export default function DayCount({ state, value, from, color, animate, clock, entry, still }) {
  const odometer = (
    <Odometer value={value} from={from} entry={entry} animate={animate} color={color} />
  );

  if (state === "today" || state === "record") {
    const stampAtMs = planOdometer({ to: value, from }).totalMs;

    return (
      <View>
        <Stamp atMs={stampAtMs} entry={entry}>
          {odometer}
        </Stamp>
        <Ring atMs={stampAtMs} color={color} entry={entry} />
      </View>
    );
  }

  if (state === "charged") {
    return (
      <Shock clock={clock} still={still}>
        <ShockGlow value={value} color={color} clock={clock} still={still} />
        {odometer}
      </Shock>
    );
  }

  return odometer;
}

const countStyles = StyleSheet.create({
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: RING_SIZE,
    height: RING_SIZE,
    marginLeft: -RING_SIZE / 2,
    marginTop: -RING_SIZE / 2,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  // Wider and taller than the number, so its glow is never cut or wrapped.
  glow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -GLOW_RADIUS * 2,
    right: -GLOW_RADIUS * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  glowText: {
    paddingHorizontal: GLOW_RADIUS + 2,
    paddingVertical: GLOW_RADIUS,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: GLOW_RADIUS,
  },
});
