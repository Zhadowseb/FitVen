import { useMemo } from "react";
import { View } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import {
  BucketChart,
  Card,
  EmptyState,
  Section,
  ShareBars,
  StatTiles,
  WeekdayBars,
  detailStyles as styles,
  formatDuration,
} from "../DetailBlocks/DetailBlocks";
import { buildFrequency } from "@utils/statisticsInsights";

// Keys under home.weekdays, Monday first - the short names the calendar uses.
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const KINDS = ["strength", "run", "walk"];

/**
 * How often and how steadily you train, from every finished workout of any
 * kind: per week, the weeks in a row, the weekdays, the time it took and
 * what kind of workouts they were.
 */
export default function FrequencyDetail({ workouts, period, now, emptyBody }) {
  const { t } = useTranslation();
  const frequency = useMemo(
    () => buildFrequency(workouts, { period, now }),
    [workouts, period, now]
  );

  if (frequency.count === 0) {
    return <EmptyState title={t("statistics.frequency.empty")} body={emptyBody} />;
  }

  const streakNote =
    frequency.streak.weeks === 0
      ? t("statistics.frequency.streakNone")
      : frequency.streak.includesThisWeek
        ? t("statistics.frequency.streakThisWeek")
        : t("statistics.frequency.streakLastWeek");

  return (
    <View style={styles.screen}>
      <StatTiles
        tiles={[
          {
            key: "perWeek",
            label: t("statistics.frequency.perWeek"),
            value: formatNumber(frequency.perWeek, { maximumFractionDigits: 1 }),
          },
          {
            key: "workouts",
            label: t("statistics.frequency.workouts"),
            value: formatNumber(frequency.count),
          },
          {
            key: "streak",
            label: t("statistics.frequency.streak"),
            value: formatNumber(frequency.streak.weeks),
            note: streakNote,
          },
          {
            key: "longest",
            label: t("statistics.frequency.longest"),
            value: formatNumber(frequency.longestStreak),
            note: t("statistics.frequency.longestNote"),
          },
        ]}
      />

      <Section
        label={
          frequency.chart.unit === "week"
            ? t("statistics.frequency.weekTitle")
            : t("statistics.frequency.monthTitle")
        }
      >
        <Card>
          <BucketChart chart={frequency.chart} gradientId="statisticsFrequencyBar" />
        </Card>
      </Section>

      <Section label={t("statistics.frequency.weekdaysTitle")}>
        <Card>
          <WeekdayBars
            counts={frequency.weekdays}
            labels={WEEKDAY_KEYS.map((key) => t(`home.weekdays.${key}`))}
          />
        </Card>
      </Section>

      {/* Only the workouts that kept a time; with none, there is nothing to say. */}
      {frequency.timedCount > 0 ? (
        <Section label={t("statistics.frequency.timeTitle")}>
          <StatTiles
            tiles={[
              {
                key: "total",
                label: t("statistics.frequency.total"),
                value: formatDuration(frequency.totalSeconds, t),
              },
              {
                key: "average",
                label: t("statistics.frequency.average"),
                value: formatDuration(frequency.averageSeconds, t),
                note:
                  frequency.timedCount < frequency.count
                    ? t("statistics.frequency.timeBasis", { count: frequency.timedCount })
                    : null,
              },
            ]}
          />
        </Section>
      ) : null}

      <Section label={t("statistics.frequency.typesTitle")}>
        <Card>
          <ShareBars
            rows={KINDS.map((kind) => ({
              key: kind,
              label: t(`statistics.frequency.types.${kind}`),
              share: frequency.byKind[kind] / frequency.count,
              valueLabel: formatNumber(frequency.byKind[kind]),
            }))}
          />
        </Card>
      </Section>
    </View>
  );
}
