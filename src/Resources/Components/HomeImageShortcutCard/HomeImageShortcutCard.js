import { ImageBackground, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";
import TailArrowUpRight from "../../Icons/UI-icons/TailArrowUpRight";
import { ThemedTitle } from "../../ThemedComponents";
import styles from "./HomeImageShortcutCardStyle";

const HomeImageShortcutCard = ({
  accentColor = null,
  accentSide = null,
  accessibilityLabel,
  imageSource,
  onPress,
  title,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.card, { borderColor: cardBorder }]}
    >
      <ImageBackground
        source={imageSource}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        <View style={styles.scrim} />

        <View style={styles.headerRow}>
          <View style={styles.actionIcon}>
            <TailArrowUpRight width={15} height={15} stroke="#ffffff" color="#ffffff" />
          </View>
        </View>

        <View style={styles.content}>
          <ThemedTitle type="h3" style={styles.title} numberOfLines={2}>
            {title}
          </ThemedTitle>
        </View>
      </ImageBackground>

      {accentColor ? (
        <View
          pointerEvents="none"
          style={[
            styles.sideAccent,
            accentSide === "right"
              ? styles.sideAccentRight
              : styles.sideAccentLeft,
            { backgroundColor: accentColor },
          ]}
        />
      ) : null}
    </TouchableOpacity>
  );
};

export default HomeImageShortcutCard;
