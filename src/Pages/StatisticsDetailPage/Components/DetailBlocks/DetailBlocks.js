import { View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { formatDate, formatNumber } from "@localization";

import styles from "./DetailBlocksStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { splitDuration, wholePercent } from "@utils/statisticsInsights";

// The pieces every deep dive is built from: a section head, cards, number
// tiles, bars, the bar chart and the weekday columns, plus the formatting they
// share. Styled after the Statistics overview so both levels read as one page.

export { styles as detailStyles };

/** What a number column shows when there is nothing to put in it. */
export const EMPTY_VALUE = "–";

// The volume chart's geometry, so the bars look the same on both levels.
const CHART_WIDTH = 340;
const CHART_HEIGHT = 132;
const CHART_BASELINE = CHART_HEIGHT - 6;

export function useDetailTheme() {
  const scheme = useColorScheme();

  return Colors[scheme] ?? Colors.light;
}

/* --------------------------------------------------------- formatting -- */

// The rows' days are UTC midnights. Rebuilt as the same calendar day in the
// phone's own zone before formatting, so the 3rd never prints as the 2nd
// (RecordsExercise does the same).
function calendarDay(at) {
  const date = new Date(at);

  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatDay(at) {
  return formatDate(calendarDay(at), { day: "numeric", month: "short" });
}

function formatMonth(at) {
  return formatDate(calendarDay(at), { month: "short", year: "numeric" });
}

export function formatPercent(share, t) {
  return t("statistics.units.percent", { value: formatNumber(wholePercent(share)) });
}

/** Kilometres with one decimal, whole from a hundred up. */
export function formatKm(km) {
  return formatNumber(km, { maximumFractionDigits: km >= 100 ? 0 : 1 });
}

/** "1 h 43 min", "5 h", "38 min". */
export function formatDuration(seconds, t) {
  const split = splitDuration(seconds);

  if (!split) {
    return EMPTY_VALUE;
  }

  if (split.hours === 0) {
    return t("statistics.units.minutes", { minutes: split.minutes });
  }

  return split.minutes === 0
    ? t("statistics.units.hours", { hours: formatNumber(split.hours) })
    : t("statistics.units.duration", { hours: formatNumber(split.hours), minutes: split.minutes });
}

/* --------------------------------------------------------- components -- */

export function Section({ label, note, children }) {
  const theme = useDetailTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText style={styles.overline} setColor={theme.quietText}>
          {label}
        </ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: theme.hairline }]} />
        {note ? (
          <ThemedText style={styles.caption} setColor={theme.quietText}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }) {
  const theme = useDetailTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Caption({ children }) {
  const theme = useDetailTheme();

  return (
    <ThemedText style={styles.caption} setColor={theme.quietText}>
      {children}
    </ThemedText>
  );
}

/**
 * Number tiles, two to a row: `{ key, label, value, unit?, note?, tone? }`.
 * An odd one out takes the whole last row.
 */
export function StatTiles({ tiles }) {
  const theme = useDetailTheme();

  return (
    <View style={styles.tileGrid}>
      {tiles.map((tile) => (
        <View
          key={tile.key}
          style={[styles.tile, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        >
          <ThemedText style={styles.tileLabel} setColor={theme.quietText} numberOfLines={2}>
            {tile.label}
          </ThemedText>
          <View style={styles.tileValueLine}>
            <ThemedText
              style={styles.tileValue}
              setColor={tile.tone ?? theme.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {tile.value}
            </ThemedText>
            {tile.unit ? (
              <ThemedText style={styles.tileUnit} setColor={theme.quietText}>
                {tile.unit}
              </ThemedText>
            ) : null}
          </View>
          {tile.note ? (
            <ThemedText style={styles.caption} setColor={theme.quietText} numberOfLines={2}>
              {tile.note}
            </ThemedText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** One big number, with a title and a line under it saying what it is. */
export function HeroNumber({ value, title, caption, tone }) {
  const theme = useDetailTheme();

  return (
    <View style={[styles.hero, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <ThemedText style={styles.heroValue} setColor={tone ?? theme.primaryText ?? theme.primary}>
        {value}
      </ThemedText>
      <View style={styles.heroCopy}>
        <ThemedText style={styles.heroTitle} setColor={theme.title}>
          {title}
        </ThemedText>
        {caption ? (
          <ThemedText style={styles.caption} setColor={theme.quietText}>
            {caption}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Horizontal bars, one per row: `{ key, label, share, valueLabel, color? }`.
 * The longest share fills its track, so the shape of the spread reads at a
 * glance; the figure beside each bar says what it is.
 */
export function ShareBars({ rows }) {
  const theme = useDetailTheme();
  const largest = Math.max(0, ...rows.map((row) => row.share));

  return (
    <View style={styles.bars}>
      {rows.map((row) => (
        <View key={row.key} style={styles.barRow}>
          <ThemedText style={styles.barLabel} setColor={theme.quietText} numberOfLines={1}>
            {row.label}
          </ThemedText>
          <View style={[styles.barTrack, { backgroundColor: withAlpha(theme.title, 0.06) }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${largest > 0 ? (row.share / largest) * 100 : 0}%`,
                  backgroundColor: row.color ?? theme.primary,
                },
              ]}
            />
          </View>
          <ThemedText style={styles.barValue} setColor={theme.title}>
            {row.valueLabel}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * The bars of buildPeriodBuckets, drawn like the overview's volume chart, with
 * the first and the last bar's week or month under the chart.
 */
export function BucketChart({ chart, gradientId }) {
  const theme = useDetailTheme();
  const buckets = chart.buckets;
  const largest = Math.max(0, ...buckets.map((bucket) => bucket.value));
  const slot = CHART_WIDTH / Math.max(1, buckets.length);
  const barWidth = Math.min(18, slot * 0.62);
  const usable = CHART_BASELINE - 8;
  const label = chart.unit === "week" ? formatDay : formatMonth;
  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  return (
    <>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.primary} stopOpacity="0.95" />
            <Stop offset="1" stopColor={theme.primary} stopOpacity="0.45" />
          </LinearGradient>
        </Defs>

        {buckets.map((bucket, index) => {
          // An empty bucket keeps a 3 dp stub, so the gap reads as nothing
          // logged rather than as a missing column.
          const height =
            bucket.isEmpty || largest === 0 ? 3 : Math.max(4, (bucket.value / largest) * usable);

          return (
            <Rect
              key={bucket.start}
              x={index * slot + (slot - barWidth) / 2}
              y={CHART_BASELINE - height}
              width={barWidth}
              height={height}
              rx={Math.min(4, barWidth / 3)}
              fill={bucket.isEmpty ? withAlpha(theme.title, 0.14) : `url(#${gradientId})`}
            />
          );
        })}

        <Rect x={0} y={CHART_BASELINE} width={CHART_WIDTH} height={1} fill={withAlpha(theme.title, 0.16)} />
      </Svg>

      {first ? (
        <View style={styles.chartLabels}>
          <ThemedText style={styles.caption} setColor={theme.quietText}>
            {label(first.start)}
          </ThemedText>
          {last !== first ? (
            <ThemedText style={styles.caption} setColor={theme.quietText}>
              {label(last.start)}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/** Seven columns, Monday first, each with its count over it and its day under it. */
export function WeekdayBars({ counts, labels }) {
  const theme = useDetailTheme();
  const largest = Math.max(0, ...counts);

  return (
    <View style={styles.weekdayRow}>
      {counts.map((count, index) => (
        <View key={labels[index]} style={styles.weekdayColumn}>
          <ThemedText style={styles.weekdayCount} setColor={count > 0 ? theme.title : theme.quietText}>
            {formatNumber(count)}
          </ThemedText>
          <View style={[styles.weekdayTrack, { backgroundColor: withAlpha(theme.title, 0.06) }]}>
            <View
              style={[
                styles.weekdayFill,
                {
                  height: `${largest > 0 ? (count / largest) * 100 : 0}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <ThemedText style={styles.weekdayLabel} setColor={theme.quietText} numberOfLines={1}>
            {labels[index]}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** A figure in a card: a quiet label over it and a quiet line under it. */
export function HighlightRow({ label, value, detail }) {
  const theme = useDetailTheme();

  return (
    <View style={styles.highlightRow}>
      <View style={styles.highlightCopy}>
        <ThemedText style={styles.highlightLabel} setColor={theme.quietText}>
          {label}
        </ThemedText>
        <ThemedText style={styles.highlightValue} setColor={theme.title} numberOfLines={1}>
          {value}
        </ThemedText>
        {detail ? (
          <ThemedText style={styles.caption} setColor={theme.quietText} numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export function Rule() {
  const theme = useDetailTheme();

  return <View style={[styles.highlightRule, { backgroundColor: theme.hairline }]} />;
}

/** A period with nothing in it for this deep dive. */
export function EmptyState({ title, body }) {
  const theme = useDetailTheme();

  return (
    <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <ThemedText style={styles.emptyTitle} setColor={theme.title}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
          {body}
        </ThemedText>
      ) : null}
    </View>
  );
}
