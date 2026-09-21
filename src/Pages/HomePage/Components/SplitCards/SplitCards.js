import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SplitCardsStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

// Two or three fit the width; four start to crowd, so from three the row
// scrolls and the cards take a fixed width instead of sharing what is there.
const SCROLL_FROM_GROUPS = 3;
const SCROLLING_CARD_WIDTH = 148;
const SCROLLING_CARD_INTERVAL = 156;

// Past this, three cards and a way into the rest. Four narrow cards say less
// than three and a door.
const MAX_INLINE_GROUPS = 4;

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function formatWeekdays(weekdays, formatDate) {
  if (!weekdays?.length) {
    return null;
  }

  // A real date that falls on each weekday, so the names come from the
  // language the person picked rather than a list hardcoded here.
  const reference = new Date(2026, 0, 4);

  return weekdays
    .map((weekday) => {
      const date = new Date(reference);

      date.setDate(reference.getDate() + WEEKDAY_ORDER.indexOf(weekday) + 1);

      return formatDate(date, { weekday: "short" });
    })
    .join(" · ");
}

function SplitCard({ group, theme, width, onPress, t, formatDate }) {
  const weekdayLine = formatWeekdays(group.weekdays, formatDate);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        group.isUpNext
          ? t("home.split.upNext", { name: group.name })
          : group.name
      }
      activeOpacity={0.85}
      onPress={() => onPress?.(group)}
      style={[
        styles.card,
        width ? { width } : styles.cardFlex,
        {
          backgroundColor: withAlpha(theme.title, 0.05),
          borderColor: withAlpha(theme.title, 0.08),
        },
        group.isUpNext
          ? { borderLeftWidth: 3, borderLeftColor: theme.primary }
          : null,
      ]}
    >
      <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
        {group.name}
      </ThemedText>

      {weekdayLine ? (
        <ThemedText style={styles.weekdays} setColor={theme.quietText} numberOfLines={1}>
          {weekdayLine}
        </ThemedText>
      ) : null}

      <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={1}>
        {t("home.split.meta", {
          exercises: group.exerciseCount,
          sets: group.setCount,
        })}
      </ThemedText>
    </TouchableOpacity>
  );
}

/**
 * The sessions the person actually runs, one card each.
 *
 * The card with the orange left edge is the one that has waited longest, and
 * it is the same session the quick-start button opens. Tapping any of them
 * opens that session directly.
 *
 * Nothing is drawn when there is no split: an empty row is worse than no row.
 */
export default function SplitCards({ groups = [], onOpenGroup, onOpenAll }) {
  const { t, formatDate } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (!groups.length) {
    return null;
  }

  if (groups.length < SCROLL_FROM_GROUPS) {
    return (
      <View style={styles.row}>
        {groups.map((group) => (
          <SplitCard
            key={group.lastWorkoutId}
            group={group}
            theme={theme}
            onPress={onOpenGroup}
            t={t}
            formatDate={formatDate}
          />
        ))}
      </View>
    );
  }

  // Longest-waiting first, so what is shown is what is due.
  const ordered = [...groups].sort((left, right) => right.daysSince - left.daysSince);
  const overflows = ordered.length > MAX_INLINE_GROUPS;
  const shown = overflows ? ordered.slice(0, 3) : ordered;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SCROLLING_CARD_INTERVAL}
      decelerationRate="fast"
      contentContainerStyle={styles.scrollRow}
    >
      {shown.map((group) => (
        <SplitCard
          key={group.lastWorkoutId}
          group={group}
          theme={theme}
          width={SCROLLING_CARD_WIDTH}
          onPress={onOpenGroup}
          t={t}
          formatDate={formatDate}
        />
      ))}

      {overflows ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("home.split.openAll")}
          activeOpacity={0.85}
          onPress={onOpenAll}
          style={[
            styles.card,
            styles.allCard,
            { width: SCROLLING_CARD_WIDTH, borderColor: withAlpha(theme.title, 0.08) },
          ]}
        >
          <ThemedText style={styles.name} setColor={theme.primaryText} numberOfLines={1}>
            {t("home.split.allCount", { count: ordered.length })}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
