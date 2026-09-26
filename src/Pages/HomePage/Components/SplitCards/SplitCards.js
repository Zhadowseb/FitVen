import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
// formatDate is a module export, not part of what useTranslation() returns.
// Taking it from the hook gave `undefined`, and calling that crashed Home on
// launch - but only for an account with a real split that has settled
// weekdays, which is to say only on a phone with months of history. Every
// device this was tried on before release had too little data to reach it.
import { formatDate, useTranslation } from "@localization";

import SplitForming from "./SplitForming";
import styles from "./SplitCardsStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { splitFormingState } from "@utils/splitForming";

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
  // A session started from the quick-start button was never named, so the
  // guess has no name to show. Numbered by where it sits in the history
  // rather than by the row order, which sorts by who has waited longest and
  // would renumber the cards under the finger.
  const name =
    group.name ?? t("home.split.unnamed", { number: (group.historyOrder ?? 0) + 1 });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        group.isUpNext ? t("home.split.upNext", { name }) : name
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
        {name}
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

// The cards themselves, once there is a split to show.
function SplitRow({ groups, theme, onOpenGroup, onOpenAll, t }) {
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

/**
 * The sessions the person actually runs, one card each, under "Your split".
 *
 * The card with the orange left edge is the one that has waited longest, and
 * it is the same session the quick-start button opens. Tapping any of them
 * opens that session directly.
 *
 * The cards wait a week from the first finished workout (`firstWorkoutAt`,
 * see Utils/splitForming.js), even when the guess could already make groups:
 * somebody who trains one muscle group a day has no split to recognise before
 * the week has gone round once. Until then, and whenever there is no split,
 * the block says what it will become rather than vanishing - seven dots that
 * fill a day at a time (SplitForming). A row that appears weeks later cannot
 * be looked forward to, and somebody who has just installed the app should
 * not meet a Home with a hole in it.
 */
export default function SplitCards({
  groups = [],
  firstWorkoutAt = null,
  onOpenGroup,
  onOpenAll,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { filledDots, showSplit, weekIsOver } = splitFormingState({
    firstWorkoutAt,
    now: Date.now(),
    groupCount: groups.length,
  });

  return (
    <View>
      <ThemedText accessibilityRole="header" style={styles.eyebrow} setColor={theme.quietText}>
        {t("home.split.eyebrow")}
      </ThemedText>

      {showSplit ? (
        <SplitRow
          groups={groups}
          theme={theme}
          onOpenGroup={onOpenGroup}
          onOpenAll={onOpenAll}
          t={t}
        />
      ) : (
        <SplitForming filledDots={filledDots} weekIsOver={weekIsOver} />
      )}
    </View>
  );
}
