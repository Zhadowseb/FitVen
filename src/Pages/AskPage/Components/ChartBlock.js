import { View, useColorScheme } from "react-native";
import { formatDate, useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import Sparkline from "@resources/Components/Sparkline";
import styles from "../AskPageStyle";

const CHART_HEIGHT = 72;

// The month of a point's date, the way the design's axis names it ("Aug").
function monthOf(x) {
  return x ? formatDate(x, { month: "short" }) : "";
}

/**
 * A chart from the person's own numbers: the app's line (Sparkline), a title
 * and range above it and the summary under it. The model sends numbers, never
 * a picture. The card is one element to a screen reader, with a sentence made
 * of the same title, range and summary.
 */
export default function ChartBlock({ block }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const first = block.series[0];
  const last = block.series[block.series.length - 1];
  const sentence = block.range
    ? t("ask.chart.a11y", { title: block.title, range: block.range, summary: block.summary })
    : t("ask.chart.a11yNoRange", { title: block.title, summary: block.summary });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={sentence}
      style={[styles.chartCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      <View style={styles.chartHead}>
        <ThemedText style={styles.chartTitle} setColor={theme.title}>
          {block.title}
        </ThemedText>
        {block.range ? (
          <ThemedText style={styles.chartRange} setColor={theme.quietText}>
            {block.range}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.chartPlot}>
        <Sparkline
          values={block.series.map((point) => point.y)}
          color={theme.primaryText}
          height={CHART_HEIGHT}
        />
      </View>

      <View style={styles.chartFoot}>
        <ThemedText style={styles.chartFootText} setColor={theme.quietText}>
          {monthOf(first?.x)}
        </ThemedText>
        <ThemedText style={styles.chartSummary} setColor={theme.title}>
          {block.summary}
        </ThemedText>
        <ThemedText style={styles.chartFootText} setColor={theme.quietText}>
          {monthOf(last?.x)}
        </ThemedText>
      </View>
    </View>
  );
}
