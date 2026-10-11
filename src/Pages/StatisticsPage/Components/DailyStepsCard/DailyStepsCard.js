import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { changePercent } from "@utils/dailySteps";
import { getStepZone, getZoneById } from "@utils/stepZones";

// The "Daily steps" section on Statistics (design: StepsStatistics.dc.html): the
// walked steps per day, averaged per week, as twelve bars each in the colour of
// its step zone, held against the person's target. The training part is on the
// Steps page, not here. Tapping the card opens the Steps page.

const WIDTH = 340;
const HEIGHT = 128;
const BASELINE = 122;
const PLOT = BASELINE - 8;

export default function DailyStepsCard({ steps, onOpen }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;

  // The newest week that has a number, and the one before it.
  const weeks = steps.weeks;
  const lastIndex = weeks.reduce((found, week, index) => (week.average !== null ? index : found), -1);

  if (lastIndex < 0) {
    return null;
  }

  const current = weeks[lastIndex];
  const previous = weeks[lastIndex - 1] ?? null;
  const isThisWeek = lastIndex === weeks.length - 1;
  const zone = getStepZone(current.average, theme);
  const change = changePercent(current.average, previous?.average ?? NaN);
  const target = steps.targetSteps;
  const targetZone = getZoneById(steps.targetZoneId);
  const targetColor = theme.stepZones[targetZone.id];
  const maxValue = Math.max(target * 1.25, ...weeks.map((week) => (week.average ?? 0) * 1.08), 1);
  const slot = WIDTH / weeks.length;
  const barWidth = Math.min(18, slot * 0.62);
  const y = (value) => BASELINE - (Math.min(value, maxValue) / maxValue) * PLOT;

  const direction = change === null ? "" : change > 0 ? "+" : change < 0 ? "−" : "";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("statistics.steps.a11y", {
        average: formatNumber(current.average),
        zone: t(zone.labelKey),
      })}
      activeOpacity={0.85}
      onPress={onOpen}
      style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
    >
      <View style={styles.headline}>
        <View style={styles.headlineText}>
          <View style={styles.numberRow}>
            <ThemedText style={styles.number} setColor={theme.title}>
              {formatNumber(current.average)}
            </ThemedText>
            <ThemedText style={styles.perDay} setColor={theme.quietText}>
              {t("statistics.steps.perDay")}
            </ThemedText>
          </View>
          <ThemedText style={styles.caption} setColor={theme.quietText}>
            {t(isThisWeek ? "statistics.steps.averageThisWeek" : "statistics.steps.averageLastWeek", {
              zone: t(zone.labelKey),
            })}
          </ThemedText>
        </View>

        {change !== null ? (
          <View style={[styles.change, { backgroundColor: withAlpha(change >= 0 ? theme.stepZones.sweetSpot : theme.quietText, 0.14) }]}>
            <ThemedText style={styles.changeText} setColor={change >= 0 ? theme.stepZones.sweetSpot : theme.quietText}>
              {`${direction}${Math.abs(change)} %`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {weeks.map((week, index) => {
            if (week.average === null) {
              return null;
            }

            const top = y(week.average);

            return (
              <Rect
                key={week.start}
                x={index * slot + (slot - barWidth) / 2}
                y={top}
                width={barWidth}
                height={BASELINE - top}
                rx={4}
                fill={theme.stepZones[getStepZone(week.average, theme).id]}
              />
            );
          })}
          <Line
            x1={0}
            x2={WIDTH}
            y1={y(target)}
            y2={y(target)}
            stroke={targetColor}
            strokeWidth={1.2}
            strokeDasharray="4 4"
            opacity={0.7}
          />
          <SvgText x={WIDTH} y={y(target) - 4} textAnchor="end" fontSize={10} fontWeight="700" fill={targetColor}>
            {t(targetZone.labelKey)}
          </SvgText>
          <Rect x={0} y={BASELINE} width={WIDTH} height={1} fill={theme.border} />
        </Svg>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.caption} setColor={theme.quietText}>
          {t("statistics.steps.last12Weeks")}
        </ThemedText>
        <ThemedText style={styles.link} setColor={theme.primaryText ?? theme.primary}>
          {t("statistics.steps.see")}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  headline: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  headlineText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  number: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  perDay: {
    fontSize: 13,
    fontWeight: "700",
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
  },
  change: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
  },
  link: {
    fontSize: 12,
    fontWeight: "800",
  },
});
