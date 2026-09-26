import { View, useColorScheme } from "react-native";

import styles from "./DownloadsCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { formatBucketLabel, formatCount } from "@utils/devDashboard";

const TRACK_HEIGHT = 96;

/**
 * The two bar colours.
 *
 * The design names four greys. They are derived from `title` here instead, so
 * the chart follows the light and dark schemes and any accent theme rather
 * than staying dark-mode grey on a white card.
 */
export function getBarColors(theme) {
  return {
    ios: withAlpha(theme.title, 0.55),
    android: withAlpha(theme.title, 0.24),
    latestIos: theme.title,
    latestAndroid: theme.quietText,
  };
}

function PlatformBox({ label, box, barColor, theme }) {
  const hasChange = box.changePercent !== null && box.changePercent !== undefined;
  const isUp = hasChange && box.changePercent >= 0;

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.platformRow}>
        {/* The repository has no App Store or Play mark, and an approximation
            of somebody's trademark is worse than none. The square is the
            platform's own colour in the chart below, so the box and its bars
            read as the same thing. */}
        <View style={[styles.platformKey, { backgroundColor: barColor }]} />

        <ThemedText style={styles.platformName} setColor={theme.quietText}>
          {label}
        </ThemedText>
      </View>

      <ThemedText style={styles.count} setColor={theme.title}>
        {formatCount(box.downloads)}
      </ThemedText>

      {hasChange ? (
        <View style={styles.changeRow}>
          <ThemedText
            style={styles.changeArrow}
            setColor={isUp ? theme.secondary : theme.danger}
          >
            {isUp ? "↑" : "↓"}
          </ThemedText>

          <ThemedText
            style={styles.changeValue}
            setColor={isUp ? theme.secondary : theme.danger}
          >
            {Math.abs(box.changePercent)}%
          </ThemedText>

          <ThemedText style={styles.changeLabel} setColor={theme.quietText}>
            mod forrige
          </ThemedText>
        </View>
      ) : (
        <ThemedText style={styles.changeLabel} setColor={theme.quietText}>
          ingen sammenligning
        </ThemedText>
      )}
    </View>
  );
}

const CHART_TITLES = {
  day: "DOWNLOADS PR. DAG",
  week: "DOWNLOADS PR. UGE",
  month: "DOWNLOADS PR. MÅNED",
};

/**
 * Downloads: one box per store and a stacked bar per bucket.
 *
 * With no rows at all the boxes show an em dash and the chart says so in
 * words. That is the state the screen is in until a store has sent a report
 * for a day - for the App Store, not before the app is released, however
 * correctly the keys are set - and it must not look like a month of zero
 * downloads.
 */
export default function DownloadsCard({ stats }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const bars = getBarColors(theme);
  const lastIndex = stats.buckets.length - 1;

  return (
    <>
      <View style={styles.row}>
        <PlatformBox
          label="APP STORE"
          box={stats.platforms.ios}
          barColor={bars.ios}
          theme={theme}
        />
        <PlatformBox
          label="GOOGLE PLAY"
          box={stats.platforms.android}
          barColor={bars.android}
          theme={theme}
        />
      </View>

      <View
        style={[
          styles.chart,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.chartHeader}>
          <ThemedText style={styles.chartTitle} setColor={theme.quietText}>
            {CHART_TITLES[stats.grouping]}
          </ThemedText>

          <View style={styles.chartTotal}>
            <ThemedText style={styles.chartTotalValue} setColor={theme.title}>
              {formatCount(stats.total)}
            </ThemedText>
            <ThemedText style={styles.chartTotalLabel} setColor={theme.quietText}>
              i alt
            </ThemedText>
          </View>
        </View>

        {stats.buckets.length > 0 ? (
          <View style={styles.bars}>
            {stats.buckets.map((bucket, index) => {
              const height = Math.round(TRACK_HEIGHT * bucket.fill);
              const isLatest = index === lastIndex;
              const iosHeight =
                bucket.total > 0 ? Math.round(height * (bucket.ios / bucket.total)) : 0;

              return (
                <View key={bucket.at} style={styles.column}>
                  <View style={[styles.track, { height: TRACK_HEIGHT }]}>
                    <View
                      style={[
                        styles.stack,
                        { height: Math.max(height, bucket.total > 0 ? 2 : 0) },
                      ]}
                    >
                      <View
                        style={[
                          styles.segmentTop,
                          {
                            height: iosHeight,
                            backgroundColor: isLatest ? bars.latestIos : bars.ios,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.segmentBottom,
                          {
                            flex: 1,
                            backgroundColor: isLatest
                              ? bars.latestAndroid
                              : bars.android,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <ThemedText
                    style={styles.bucketLabel}
                    setColor={theme.quietText}
                    numberOfLines={1}
                  >
                    {formatBucketLabel(bucket.at, stats.grouping)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.bars, styles.emptyBars]}>
            <ThemedText style={styles.emptyText} setColor={theme.quietText}>
              {stats.hasData
                ? "Ingen downloads i perioden."
                : "Ingen tal fra butikkerne endnu."}
            </ThemedText>
          </View>
        )}

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: bars.ios }]} />
            <ThemedText style={styles.legendLabel} setColor={theme.quietText}>
              iOS
            </ThemedText>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: bars.android }]} />
            <ThemedText style={styles.legendLabel} setColor={theme.quietText}>
              Android
            </ThemedText>
          </View>
        </View>
      </View>
    </>
  );
}
