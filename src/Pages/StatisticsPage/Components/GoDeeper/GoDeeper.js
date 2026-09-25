import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./GoDeeperStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Distance from "@resources/Icons/UI-icons/Distance";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import Fire from "@resources/Icons/UI-icons/Fire";
import Layers from "@resources/Icons/UI-icons/Layers";
import { ThemedText } from "@resources/ThemedComponents";
import { STATISTICS_METRICS, wholePercent } from "@utils/statisticsInsights";

// A row with nothing in the period says so quietly rather than with a zero.
const EMPTY_VALUE = "–";
const ICON_SIZE = 18;

function MetricIcon({ metric, color }) {
  switch (metric) {
    case "intensity":
      return <Fire width={ICON_SIZE} height={ICON_SIZE} color={color} />;
    case "frequency":
      return <Calender width={ICON_SIZE} height={ICON_SIZE} color={color} />;
    case "setTypes":
      return <Layers width={ICON_SIZE} height={ICON_SIZE} color={color} />;
    case "runs":
      return <Distance width={ICON_SIZE} height={ICON_SIZE} color={color} stroke={color} />;
    default:
      return <Dumbbell width={ICON_SIZE} height={ICON_SIZE} color={color} />;
  }
}

function teaserText(metric, teaser, t) {
  switch (metric) {
    case "intensity":
      return t("statistics.intensity.teaser", {
        value: formatNumber(wholePercent(teaser.average)),
      });
    case "frequency": {
      const perWeek = Math.round(teaser.perWeek * 10) / 10;

      return t("statistics.frequency.teaser", {
        value: formatNumber(perWeek, { maximumFractionDigits: 1 }),
        count: perWeek,
      });
    }
    case "setTypes":
      return teaser.type === "working"
        ? t("statistics.setTypes.onlyWorking")
        : t(`statistics.setTypes.teaser.${teaser.type}`, {
            value: formatNumber(wholePercent(teaser.share)),
          });
    case "runs":
      return t("statistics.runs.teaser", {
        km: formatNumber(teaser.km, { maximumFractionDigits: teaser.km < 10 ? 1 : 0 }),
        count: teaser.count,
      });
    default:
      return t("common.exercises", { count: teaser.count });
  }
}

/**
 * "Go deeper": the five deep dives, each with its one number in the page's
 * period, and a dash when the period has nothing for it.
 */
export default function GoDeeper({ teasers, onOpen }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const quiet = theme.quietText;
  const hairline = theme.hairline;
  const accent = theme.primaryText ?? theme.primary;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText style={styles.overline} setColor={quiet}>
          {t("statistics.deeper.title")}
        </ThemedText>
        <View style={[styles.sectionRule, { backgroundColor: hairline }]} />
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        {STATISTICS_METRICS.map((metric, index) => {
          const title = t(`statistics.${metric}.title`);
          const teaser = teasers?.[metric] ?? null;
          const text = teaser ? teaserText(metric, teaser, t) : EMPTY_VALUE;

          return (
            <TouchableOpacity
              key={metric}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={teaser ? `${title}, ${text}` : title}
              onPress={() => onOpen?.(metric)}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: hairline }]}
            >
              <View style={[styles.iconBox, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                <MetricIcon metric={metric} color={accent} />
              </View>
              <View style={styles.copy}>
                <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
                  {title}
                </ThemedText>
                <ThemedText
                  style={styles.teaser}
                  setColor={teaser ? theme.text : quiet}
                  numberOfLines={1}
                >
                  {text}
                </ThemedText>
              </View>
              <ChevronRight width={15} height={15} color={quiet} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
