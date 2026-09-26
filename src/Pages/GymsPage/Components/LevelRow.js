import { Image, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./LevelRowStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "@resources/ThemedComponents";
import { regionInitials } from "@utils/gymCategories";
import { getChainColor, getChainInitials } from "@utils/gymUtils";

/** A country's code on a tile; yours in the accent. */
export function CountryTile({ code, isYours = false }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: isYours ? withAlpha(theme.primary, 0.14) : theme.raisedSurface },
      ]}
    >
      <ThemedText style={styles.countryCode} setColor={isYours ? theme.primaryText : theme.mutedStrong}>
        {String(code ?? "").toUpperCase()}
      </ThemedText>
    </View>
  );
}

/** Two letters of a region's name in the cool blue the global screens wear. */
export function RegionTile({ name }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.tile, styles.regionTile, { backgroundColor: withAlpha(theme.heatCool, 0.12) }]}>
      <ThemedText style={styles.initials} setColor={theme.heatCool}>
        {regionInitials(name)}
      </ThemedText>
    </View>
  );
}

/**
 * A centre's photo, or its chain's initials on the chain's colour - the tile
 * the centre lists have always used, so a row without a photo still says
 * which chain it is.
 */
export function GymTile({ imageUrl, chain }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (imageUrl) {
    return (
      <View style={[styles.tile, { backgroundColor: theme.raisedSurface }]}>
        <Image source={{ uri: imageUrl }} style={styles.tileImage} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[styles.tile, { backgroundColor: withAlpha(getChainColor(chain), 0.16) }]}>
      <ThemedText style={styles.initials} setColor={theme.mutedStrong}>
        {getChainInitials(chain)}
      </ThemedText>
    </View>
  );
}

/**
 * One line of a level's list - a country, a region, a centre, a search hit.
 * Without onPress it is shown and cannot be pressed, and has no chevron.
 */
export default function LevelRow({ tile, title, meta, onPress, divider = false, regionDivider = false }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const Row = onPress ? TouchableOpacity : View;
  const rowProps = onPress
    ? {
        activeOpacity: 0.85,
        accessibilityRole: "button",
        accessibilityLabel: meta ? `${title}, ${meta}` : title,
        onPress,
      }
    : { accessible: true, accessibilityLabel: meta ? `${title}, ${meta}` : title };

  return (
    <View>
      <Row style={styles.row} {...rowProps}>
        {tile}
        <View style={styles.copy}>
          <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {meta ? (
            <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
              {meta}
            </ThemedText>
          ) : null}
        </View>
        {onPress ? <ChevronRight width={18} height={18} color={theme.chevron} /> : null}
      </Row>
      {divider ? (
        <View
          style={[
            styles.divider,
            regionDivider ? styles.dividerRegion : null,
            { backgroundColor: theme.hairline },
          ]}
        />
      ) : null}
    </View>
  );
}
