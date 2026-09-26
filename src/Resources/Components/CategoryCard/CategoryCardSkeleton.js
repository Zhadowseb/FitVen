import { Animated, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CategoryCardSkeletonStyle";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";
import { Colors } from "@resources/GlobalStyling/colors";

/**
 * Category cards in outline while they load: a title, #1 with a value, your
 * line. A slow breath while somebody can see them; still with reduce motion
 * or off screen.
 */
export default function CategoryCardSkeleton({ count = 4 }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();
  const opacity = useBreathAnimation(animate, { periodMs: 1800, low: 0.55 });
  const shape = { backgroundColor: theme.chipBackground };

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={[styles.stack, { opacity }]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        >
          <View style={styles.head}>
            <View style={[styles.title, shape]} />
            <View style={[styles.line, shape]} />
          </View>
          <View style={styles.top}>
            <View style={[styles.avatar, shape]} />
            <View style={styles.topCopy}>
              <View style={[styles.name, shape]} />
              <View style={[styles.meta, shape]} />
            </View>
            <View style={[styles.value, shape]} />
          </View>
          <View style={[styles.me, shape]} />
        </View>
      ))}
    </Animated.View>
  );
}
