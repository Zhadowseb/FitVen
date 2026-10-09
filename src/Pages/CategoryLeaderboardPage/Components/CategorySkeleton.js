import { Animated, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CategorySkeletonStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";

const PODIUM_ORDER = [1, 0, 2];
const AVATAR_SIZE = [56, 46, 46];
const PLINTH_HEIGHT = [58, 42, 32];
const NAME_WIDTHS = ["62%", "48%", "56%", "44%", "52%"];

/**
 * The first load: the podium and the list in outline, where they will be, so
 * nothing jumps when they arrive. Breathes while somebody can see it and
 * holds still with reduced motion or off screen.
 */
export default function CategorySkeleton({ podium = true, rows = 5 }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();
  const opacity = useBreathAnimation(animate, { periodMs: 1800, low: 0.55 });
  const shape = theme.chipBackground;
  const card = { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder };

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={[styles.stack, { opacity }]}
    >
      {podium ? (
        <View style={[styles.podiumCard, card]}>
          <View style={styles.podium}>
            {PODIUM_ORDER.map((position) => (
              <View key={position} style={styles.column}>
                <View
                  style={[
                    styles.avatar,
                    {
                      width: AVATAR_SIZE[position] + 9,
                      height: AVATAR_SIZE[position] + 9,
                      backgroundColor: shape,
                    },
                  ]}
                />
                <View style={[styles.podiumName, { backgroundColor: shape }]} />
                <View style={[styles.podiumValue, { backgroundColor: shape }]} />
                <View style={[styles.plinth, { height: PLINTH_HEIGHT[position], backgroundColor: shape }]} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.listCard, card]}>
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index}>
            <View style={styles.row}>
              <View style={[styles.rank, { backgroundColor: shape }]} />
              <View style={[styles.rowAvatar, { backgroundColor: shape }]} />
              <View style={styles.rowCopy}>
                <View style={[styles.rowName, { width: NAME_WIDTHS[index % NAME_WIDTHS.length], backgroundColor: shape }]} />
                <View style={[styles.rowMeta, { backgroundColor: shape }]} />
              </View>
              <View style={[styles.rowValue, { backgroundColor: shape }]} />
            </View>
            {index < rows - 1 ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
