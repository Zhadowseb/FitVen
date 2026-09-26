import { useState } from "react";
import { TouchableOpacity, View, useColorScheme, useWindowDimensions } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CategoryPodiumStyle";
import RingAvatar from "./RingAvatar";
import { formatValue, readableTone, unitLabel } from "../categoryLeaderboardFormat";
import { Colors } from "@resources/GlobalStyling/colors";
import RadialGlow from "@resources/Components/GymLeaderboard/RadialGlow";
import { ThemedText } from "@resources/ThemedComponents";
import { mixHexColors } from "@utils/colorMix";
import { podiumName } from "@utils/gymCategories";

// Second, first, third: the winner in the middle and highest.
const PODIUM_ORDER = [1, 0, 2];
const AVATAR_SIZE = [56, 46, 46];
const PLINTH_HEIGHT = [58, 42, 32];
const GLOW_WIDTH = 300;
// The list's side padding, for the card's width before it has been measured.
const PAGE_GUTTERS = 40;

/**
 * The top three of a category: pictures in gold, silver and bronze rings,
 * first name and initial, the value in the category's colour, and a plinth
 * with the place - only #1's tinted gold. Somebody else opens their profile;
 * you do not.
 */
export default function CategoryPodium({ rows = [], kind, tone, valueColor, onOpenPerson, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { width: windowWidth } = useWindowDimensions();
  // The glow stands over #1, in the middle: measured once the card is laid
  // out, and until then taken from the window, so it does not start at the edge.
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const cardWidth = measuredWidth ?? windowWidth - PAGE_GUTTERS;
  const medals = [theme.record, theme.medalSilver, theme.medalBronze];

  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }, style]}
    >
      <RadialGlow
        color={tone}
        width={GLOW_WIDTH}
        height={240}
        top={-120}
        left={(cardWidth - GLOW_WIDTH) / 2}
        centerOpacity={0.26}
        midOpacity={0.07}
      />

      <View style={styles.podium}>
        {PODIUM_ORDER.map((position) => {
          const row = rows[position];

          if (!row) {
            return <View key={`empty-${position}`} style={styles.column} />;
          }

          const person = row.person ?? {};
          // The contract puts isMe on the person; the RPC's row carries is_me too.
          const isMe = Boolean(person.isMe || row.isMe);
          const isFirst = position === 0;
          const medal = medals[position];
          // Only #1's plinth is tinted gold. The place is written in its
          // medal's colour, darkened where the tint would take it under 4.5:1.
          const plinthSurface = isFirst
            ? mixHexColors(theme.cardBackground, theme.record, colorScheme === "light" ? 0.16 : 0.14)
            : mixHexColors(theme.cardBackground, theme.title, 0.05);
          const plinthText = readableTone(medal, [plinthSurface], theme.title);
          // Metal: the medal colour pulled toward the page at one end and
          // toward the ink at the other, so it catches light in both themes.
          const ring = [mixHexColors(medal, theme.background, 0.28), mixHexColors(medal, theme.title, 0.22)];
          const canOpen = Boolean(onOpenPerson) && Boolean(person.id) && !isMe;
          const Person = canOpen ? TouchableOpacity : View;
          const personProps = canOpen
            ? {
                activeOpacity: 0.75,
                accessibilityRole: "button",
                accessibilityHint: t("publicProfile.opensProfile"),
                onPress: () => onOpenPerson(person),
              }
            : {};

          return (
            <View key={String(person.id ?? `rank-${position}`)} style={styles.column}>
              <Person style={styles.person} {...personProps}>
                <RingAvatar uri={person.avatarUrl} size={AVATAR_SIZE[position]} colors={ring} />
                <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
                  {isMe ? t("common.you") : podiumName(person.displayName) || t("common.member")}
                </ThemedText>
              </Person>

              <View style={styles.valueGroup}>
                <ThemedText
                  style={[styles.value, isFirst ? styles.valueFirst : null]}
                  setColor={valueColor}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatValue(kind, row.value)}
                </ThemedText>
                <ThemedText style={styles.unit} setColor={theme.quietText} numberOfLines={1}>
                  {unitLabel(kind, row.value, t)}
                </ThemedText>
              </View>

              <View style={[styles.plinth, { height: PLINTH_HEIGHT[position], backgroundColor: plinthSurface }]}>
                <ThemedText style={styles.plinthText} setColor={plinthText}>
                  {position + 1}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
