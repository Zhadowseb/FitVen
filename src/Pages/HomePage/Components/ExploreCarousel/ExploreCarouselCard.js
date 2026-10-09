import { useState } from "react";
import { Image, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./ExploreCarouselCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * One card on Home's "From Explore" rail: a picture, or a tinted tile with an
 * icon, and under it a kicker that says what kind of thing it is, a title of
 * up to two lines and one line of detail. The whole card is one touch target.
 *
 * `tone` tints the tile. `toneText` is that colour as ink - the kicker and
 * the icon - which for the accent is `primaryText`, not `primary`. `image` is
 * an Image source; without one, or when it fails to load, the tile shows
 * `icon` (a component, drawn at 26 with `iconProps`). A picture gets a quiet
 * veil so it sits with the tinted tiles beside it.
 */
export default function ExploreCarouselCard({
  kicker,
  title,
  meta,
  tone,
  toneText,
  image = null,
  icon: Icon = null,
  iconProps = null,
  accessibilityLabel,
  onPress,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  // Which picture failed, rather than whether: a new one (a poster's link is
  // signed afresh on every load) gets its own try.
  const imageKey = typeof image === "number" ? image : image?.uri ?? null;
  const [failedImage, setFailedImage] = useState(null);
  const showImage = imageKey !== null && failedImage !== imageKey;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      <View style={[styles.media, { backgroundColor: withAlpha(tone, isLight ? 0.12 : 0.16) }]}>
        {showImage ? (
          <>
            <Image
              source={image}
              style={styles.fill}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              onError={() => setFailedImage(imageKey)}
            />
            <View
              style={[
                styles.fill,
                { backgroundColor: withAlpha(Colors.dark.background, isLight ? 0.1 : 0.22) },
              ]}
            />
          </>
        ) : Icon ? (
          <Icon width={26} height={26} color={toneText} {...iconProps} />
        ) : null}
      </View>

      <View style={styles.body}>
        <ThemedText style={styles.kicker} setColor={toneText} numberOfLines={1}>
          {kicker}
        </ThemedText>
        <ThemedText style={styles.title} setColor={theme.title} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
          {meta}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

/**
 * A card's shape before there is anything to put on it: the first load, with
 * nothing kept from before. Still - it is there for a moment, and a shimmer
 * would be one more thing moving on Home.
 */
export function ExploreCarouselCardPlaceholder() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const bar = { backgroundColor: withAlpha(theme.title, 0.07) };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <View style={[styles.media, { backgroundColor: withAlpha(theme.title, 0.04) }]} />
      <View style={styles.body}>
        <View style={[styles.line, styles.kickerLine]}>
          <View style={[styles.bar, styles.kickerBar, bar]} />
        </View>
        <View>
          <View style={[styles.line, styles.titleLine]}>
            <View style={[styles.bar, styles.titleBar, bar]} />
          </View>
          <View style={[styles.line, styles.titleLine]}>
            <View style={[styles.bar, styles.titleBarShort, bar]} />
          </View>
        </View>
        <View style={[styles.line, styles.metaLine]}>
          <View style={[styles.bar, styles.metaBar, bar]} />
        </View>
      </View>
    </View>
  );
}
