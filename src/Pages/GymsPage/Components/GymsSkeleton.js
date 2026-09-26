import { Animated, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./GymsSkeletonStyle";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";
import { Colors } from "@resources/GlobalStyling/colors";

// A level's list and its title in outline while they load (the cards have
// their own, CategoryCardSkeleton). A slow breath while somebody can see
// them; still with reduce motion or off screen.
function Breathing({ children, style }) {
  const { t } = useTranslation();
  const { animate } = useAnimationsEnabled();
  const opacity = useBreathAnimation(animate, { periodMs: 1800, low: 0.55 });

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={[{ opacity }, style]}
    >
      {children}
    </Animated.View>
  );
}

export function RowsSkeleton({ count = 4 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const shape = { backgroundColor: theme.chipBackground };

  return (
    <Breathing
      style={[styles.list, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <View style={[styles.tile, shape]} />
          <View style={styles.rowCopy}>
            <View style={[styles.rowTitle, shape]} />
            <View style={[styles.rowMeta, shape]} />
          </View>
        </View>
      ))}
    </Breathing>
  );
}

export function HeaderSkeleton() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const shape = { backgroundColor: theme.chipBackground };

  return (
    <Breathing style={styles.header}>
      <View style={[styles.crumbs, shape]} />
      <View style={[styles.title, shape]} />
      <View style={[styles.subtitle, shape]} />
    </Breathing>
  );
}
