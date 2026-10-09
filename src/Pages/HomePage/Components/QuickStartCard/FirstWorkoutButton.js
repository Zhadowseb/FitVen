import { useEffect, useId, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "@localization";

import styles, {
  SHINE_OVERHANG,
  SHINE_SKEW_DEG,
  SHINE_WIDTH,
} from "./FirstWorkoutButtonStyle";
import { useAnimationsEnabled } from "@resources/Components/animationHooks";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Plus from "@resources/Icons/UI-icons/Plus";
import { ThemedText } from "@resources/ThemedComponents";

// White on every accent: it is light falling on the fill, the way the shine
// on the crown and the trophy is, not a colour of the theme.
const SHINE_COLOR = "#FFFFFF";
// A pass takes the first 55 % of a 3.2 s cycle and the light is gone for the
// rest. The first one waits 800 ms, so it does not cross while Home is still
// arriving.
const CYCLE_MS = 3200;
const SWEEP_MS = CYCLE_MS * 0.55;
const FIRST_PASS_DELAY_MS = 800;
const SWEEP_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const SKEW = `-${SHINE_SKEW_DEG}deg`;
const SLANT = Math.tan((SHINE_SKEW_DEG * Math.PI) / 180);

/**
 * The light crossing the button: a slanted white stripe, faint at both edges.
 *
 * It starts 130 % of its own width left of the button, as designed. The end
 * is past the right edge, not the design's 330 %: that was drawn for a
 * narrower button, and on this one the light would stop three quarters of the
 * way across and stand there, lit, until the next pass.
 */
function Shine({ width, height }) {
  const gradientId = `${useId().replace(/[^\w-]/g, "")}firstWorkoutShine`;
  const progress = useSharedValue(0);
  // How far the slant carries the stripe's ends out past its middle.
  const lean = (SLANT * (height + 2 * SHINE_OVERHANG)) / 2;
  const from = -1.3 * SHINE_WIDTH;
  const to = Math.max(3.3 * SHINE_WIDTH, width + lean);

  useEffect(() => {
    progress.value = withDelay(
      FIRST_PASS_DELAY_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWEEP_MS, easing: SWEEP_EASING }),
          withDelay(CYCLE_MS - SWEEP_MS, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );

    return () => cancelAnimation(progress);
  }, [progress]);

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: from + (to - from) * progress.value }, { skewX: SKEW }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.shine, moving]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={SHINE_COLOR} stopOpacity={0} />
            <Stop offset="0.5" stopColor={SHINE_COLOR} stopOpacity={0.35} />
            <Stop offset="1" stopColor={SHINE_COLOR} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The empty workout, when it is the only thing Quick start has to offer:
 * nothing is open today and the split has no session due. Then it is not the
 * quiet button under a primary one but the block's whole action, in the
 * accent, filling everything under the eyebrow - so the block is exactly as
 * tall as the counter beside it - with a light crossing it now and then.
 *
 * It is only called the first workout for somebody who has never finished
 * one (`isFirst`). The same block also comes up for somebody with months of
 * history - today's session is done, or nothing they do repeats yet - and to
 * them it is the empty workout it always was, in the same dress.
 *
 * The light moves only while Home is on screen, the app is in front and
 * reduce motion is off (useAnimationsEnabled). Otherwise there is none - not
 * a stripe standing still.
 */
export default function FirstWorkoutButton({ onPress, isFirst = true }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();
  // The light's travel depends on the button's size, so it waits for it.
  const [size, setSize] = useState(null);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t(isFirst ? "home.quickStart.startFirst" : "home.quickStart.startEmpty")}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.button, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
    >
      <View
        style={styles.surface}
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          const height = Math.round(event.nativeEvent.layout.height);

          setSize((current) =>
            current?.width === width && current?.height === height ? current : { width, height }
          );
        }}
      >
        <View style={[styles.icon, { backgroundColor: theme.textInverted }]}>
          <Plus width={20} height={20} color={theme.primary} thickness={2.6} />
        </View>

        <View>
          <ThemedText style={styles.title} setColor={theme.textInverted} numberOfLines={1}>
            {t(isFirst ? "home.quickStart.firstWorkout" : "home.quickStart.emptyWorkout")}
          </ThemedText>

          <ThemedText
            style={styles.subtitle}
            setColor={withAlpha(theme.textInverted, 0.7)}
            numberOfLines={1}
          >
            {t(isFirst ? "home.quickStart.firstWorkoutSub" : "home.quickStart.emptyWorkoutSub")}
          </ThemedText>
        </View>

        {animate && size ? <Shine width={size.width} height={size.height} /> : null}
      </View>
    </TouchableOpacity>
  );
}
