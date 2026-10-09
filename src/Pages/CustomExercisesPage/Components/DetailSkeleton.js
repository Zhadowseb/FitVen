import { Animated, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import styles from "./DetailSkeletonStyle";
import DetailTopBar from "./DetailTopBar";
import { Colors } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";

const TAG_WIDTHS = [64, 78, 70];
const ROW_WIDTHS = ["92%", "78%", "86%"];

/**
 * The exercise page while it loads: the hero and the rows in outline, with a
 * slow breath while somebody can see it and none with reduce motion. Back
 * works from the start - nobody should have to wait for a page to leave it.
 */
export default function DetailSkeleton({ onBack }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { animate } = useAnimationsEnabled();
  const opacity = useBreathAnimation(animate, { periodMs: 1800, low: 0.55 });
  const shape = theme.chipBackground;

  return (
    <View>
      <Animated.View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("common.loading")}
        style={{ opacity }}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder },
          ]}
        />

        <View style={styles.titleBlock}>
          <View style={[styles.name, { backgroundColor: shape }]} />
          <View style={styles.tags}>
            {TAG_WIDTHS.map((width) => (
              <View key={width} style={[styles.tag, { width, backgroundColor: shape }]} />
            ))}
          </View>
        </View>

        <View
          style={[
            styles.card,
            styles.ownerCard,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: shape }]} />
          <View style={styles.ownerCopy}>
            <View style={[styles.lineStrong, { backgroundColor: shape }]} />
            <View style={[styles.lineQuiet, { backgroundColor: shape }]} />
          </View>
        </View>

        <View
          style={[
            styles.card,
            styles.statsCard,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[styles.stat, index > 0 ? [styles.statDivided, { borderLeftColor: theme.border }] : null]}
            >
              <View style={[styles.statValue, { backgroundColor: shape }]} />
              <View style={[styles.statLabel, { backgroundColor: shape }]} />
            </View>
          ))}
        </View>

        <View style={styles.rows}>
          <View style={[styles.eyebrow, { backgroundColor: shape }]} />
          {ROW_WIDTHS.map((width) => (
            <View key={width} style={[styles.row, { width, backgroundColor: shape }]} />
          ))}
        </View>
      </Animated.View>

      <DetailTopBar surface="block" onBack={onBack} style={[styles.topBar, { top: insets.top + 8 }]} />
    </View>
  );
}
