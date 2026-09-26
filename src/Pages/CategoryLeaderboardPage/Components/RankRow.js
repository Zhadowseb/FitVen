import React from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./RankRowStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";
import { NO_VALUE, formatValue, unitBesideValue, unitLabel } from "@utils/categoryFormat";

/**
 * One place on the list from #4 down (from #1 on Progress). The list is the
 * page's scroller, so the card is drawn in slices: every row its sides, the
 * first the top, and whatever closes the list the bottom - usually the "···"
 * before your own row.
 *
 * Somebody else's row opens their profile, the way LeaderboardRow does it;
 * yours is tinted and opens nothing.
 */
function RankRow({ row, kind, subtitle, valueColor, isFirst = false, closesCard = false, onOpenPerson, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const person = row?.person ?? {};
  // The contract puts isMe on the person; the RPC's row carries is_me too.
  const isMe = Boolean(person.isMe || row?.isMe);
  const canOpen = Boolean(onOpenPerson) && Boolean(person.id) && !isMe;
  const Body = canOpen ? TouchableOpacity : View;
  const bodyProps = canOpen
    ? {
        activeOpacity: 0.75,
        accessibilityRole: "button",
        accessibilityHint: t("publicProfile.opensProfile"),
        onPress: () => onOpenPerson({ ...person, isMe }),
      }
    : // Read as one line, like the rows that are buttons.
      { accessible: true };

  return (
    <View
      style={[
        styles.slice,
        isFirst ? styles.sliceFirst : null,
        closesCard ? styles.sliceLast : null,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        style,
      ]}
    >
      <Body
        style={[
          styles.row,
          isMe
            ? { backgroundColor: withAlpha(theme.primary, 0.08), borderLeftColor: theme.primary }
            : styles.rowPlain,
        ]}
        {...bodyProps}
      >
        <ThemedText style={styles.rank} setColor={isMe ? theme.primaryText : theme.quietText} numberOfLines={1}>
          {row?.rank ? `#${row.rank}` : NO_VALUE}
        </ThemedText>

        <UserAvatar
          uri={person.avatarUrl}
          size={34}
          iconSize={16}
          borderWidth={isMe ? 2 : 0}
          borderColor={isMe ? theme.primary : "transparent"}
        />

        <View style={styles.copy}>
          <ThemedText style={styles.name} setColor={isMe ? theme.primaryText : theme.title} numberOfLines={1}>
            {isMe ? t("common.you") : person.displayName || t("common.member")}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={styles.subtitle} setColor={theme.quietText} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        <View style={unitBesideValue(kind) ? styles.valueGroupInline : styles.valueGroup}>
          <ThemedText style={styles.value} setColor={isMe ? theme.title : valueColor} numberOfLines={1}>
            {formatValue(kind, row?.value)}
          </ThemedText>
          <ThemedText style={styles.unit} setColor={theme.quietText} numberOfLines={1}>
            {unitLabel(kind, row?.value, t)}
          </ThemedText>
        </View>
      </Body>

      {!closesCard ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
    </View>
  );
}

export default React.memo(RankRow);

/**
 * "···": the list goes on, and then there is you. Closes the list's card; the
 * row itself is pinned at the bottom of the screen, so it is always in sight.
 */
export function ListGapRow({ standalone = false }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  // Decoration: a screen reader goes from the last row straight to yours.
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" };

  if (standalone) {
    return (
      <ThemedText style={[styles.dots, styles.dotsStandalone]} setColor={theme.quietText} {...hidden}>
        ···
      </ThemedText>
    );
  }

  return (
    <View
      style={[styles.slice, styles.sliceLast, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      {...hidden}
    >
      <ThemedText style={styles.dots} setColor={theme.quietText}>
        ···
      </ThemedText>
    </View>
  );
}
