import { useMemo } from "react";
import { View } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import {
  BucketChart,
  Caption,
  Card,
  EMPTY_VALUE,
  EmptyState,
  HighlightRow,
  Rule,
  Section,
  StatTiles,
  detailStyles as styles,
  formatDay,
  formatDuration,
  formatKm,
} from "../DetailBlocks/DetailBlocks";
import { buildRunSummary, formatPace } from "@utils/statisticsInsights";

/**
 * The period's runs: how many, how far, for how long and at what pace, the
 * fastest and the longest, and the kilometres week by week. Walks get one
 * quiet line of their own. There is no pulse here: a run does not keep its
 * heart rate once it is finished.
 */
export default function RunsDetail({ runs, period, emptyBody }) {
  const { t } = useTranslation();
  const summary = useMemo(() => buildRunSummary(runs, { period }), [runs, period]);

  const walks =
    summary.walks.count > 0 ? (
      <Caption>
        {t("statistics.runs.walks", {
          count: summary.walks.count,
          km: formatKm(summary.walks.km),
        })}
      </Caption>
    ) : null;

  if (summary.count === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title={t("statistics.runs.empty")} body={emptyBody} />
        {walks}
      </View>
    );
  }

  const pace = formatPace(summary.pace);
  const { fastest, longest } = summary;

  return (
    <View style={styles.screen}>
      <StatTiles
        tiles={[
          {
            key: "count",
            label: t("statistics.runs.count"),
            value: formatNumber(summary.count),
          },
          {
            key: "distance",
            label: t("statistics.runs.distance"),
            value: formatKm(summary.km),
            unit: t("statistics.units.km"),
          },
          {
            key: "time",
            label: t("statistics.runs.time"),
            value: formatDuration(summary.seconds, t),
          },
          {
            key: "pace",
            label: t("statistics.runs.pace"),
            value: pace ?? EMPTY_VALUE,
            unit: pace ? t("statistics.units.perKm") : null,
          },
        ]}
      />

      <Section label={t("statistics.runs.bestTitle")}>
        <Card>
          <HighlightRow
            label={t("statistics.runs.fastest")}
            value={fastest ? t("statistics.units.pace", { pace: formatPace(fastest.pace) }) : EMPTY_VALUE}
            detail={
              fastest
                ? t("statistics.runs.fastestDetail", {
                    km: formatKm(fastest.km),
                    date: formatDay(fastest.at),
                  })
                : t("statistics.runs.fastestNone")
            }
          />
          <Rule />
          <HighlightRow
            label={t("statistics.runs.longest")}
            value={longest ? `${formatKm(longest.km)} ${t("statistics.units.km")}` : EMPTY_VALUE}
            detail={
              !longest
                ? null
                : longest.seconds > 0
                  ? t("statistics.runs.longestDetail", {
                      time: formatDuration(longest.seconds, t),
                      date: formatDay(longest.at),
                    })
                  : formatDay(longest.at)
            }
          />
        </Card>
      </Section>

      <Section
        label={
          summary.chart.unit === "week"
            ? t("statistics.runs.weekTitle")
            : t("statistics.runs.monthTitle")
        }
      >
        <Card>
          <BucketChart chart={summary.chart} gradientId="statisticsRunsBar" />
        </Card>
      </Section>

      {walks}
    </View>
  );
}
