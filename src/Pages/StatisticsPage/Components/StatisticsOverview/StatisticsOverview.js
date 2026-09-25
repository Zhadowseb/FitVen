import { useMemo } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import styles from "./StatisticsOverviewStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import RecordStar from "@resources/Components/RecordStar/RecordStar";
import { ThemedSegmentedControl, ThemedText } from "@resources/ThemedComponents";
import {
  RECORDS_PERIODS,
  buildExerciseGains,
  buildMuscleGroupSets,
  buildStats,
  buildStrengthSummary,
  buildVolumeBuckets,
} from "@utils/recordsInsights";
import { muscleGroupLabel } from "@utils/exerciseMuscleGroups";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 132;
const CHART_BASELINE = CHART_HEIGHT - 6;
// Under a percent either way is noise, not a direction.
const STEADY_BAND = 0.01;

function formatKg(value) {
  if (!Number.isFinite(value)) {
    return "–";
  }

  return formatNumber(Math.round(value * 2) / 2, { maximumFractionDigits: 1 });
}

function formatSignedKg(value) {
  const rounded = Math.round(value * 2) / 2;

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${formatKg(Math.abs(rounded))} kg`;
}

function formatSignedPercent(fraction) {
  const rounded = Math.round(fraction * 100);

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)} %`;
}

/**
 * The top of the Statistics page, read top to bottom in one period that the
 * selector at the top sets for all of it: three numbers against the period
 * before, whether you are getting stronger, the biggest gains, the volume and
 * the sets per muscle group. It was the Records overview; the latest records
 * went to the trophy room and the list of every exercise became a deep dive.
 */
export default function StatisticsOverview({
  sets,
  groupsByExercise,
  now,
  periodKey,
  onChangePeriod,
  onSelectExercise,
  showAllMovers,
  onToggleAllMovers,
}) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const gold = theme.record;
  const up = theme.secondary;
  // A decline is not an error. `danger` is the colour of something gone wrong
  // and an exercise that slipped is not that, so it gets its own muted red.
  const down = scheme === "dark" ? "#D4685C" : "#B4503F";
  const quiet = theme.quietText;
  const title = theme.title;
  const card = theme.cardBackground;
  const border = theme.border;
  const hairline = theme.hairline;

  const period =
    RECORDS_PERIODS.find((entry) => entry.key === periodKey) ?? RECORDS_PERIODS[1];
  const days = period.days;

  const stats = useMemo(() => buildStats(sets, { now, days }), [sets, now, days]);
  const strength = useMemo(() => buildStrengthSummary(sets, { now, days }), [sets, now, days]);
  const gains = useMemo(
    () => buildExerciseGains(sets, { now, windowDays: days }),
    [sets, now, days]
  );
  const volume = useMemo(() => buildVolumeBuckets(sets, { now, days }), [sets, now, days]);
  const muscles = useMemo(
    () => buildMuscleGroupSets(sets, { groupsByExercise, now, days }),
    [sets, groupsByExercise, now, days]
  );

  // Four biggest gains and the single biggest decline; with "show all",
  // everything measured, largest change first either way.
  const measured = useMemo(
    () => gains.filter((gain) => Number.isFinite(gain.gainKg) && gain.gainKg !== 0),
    [gains]
  );
  const movers = useMemo(() => {
    if (showAllMovers) {
      return [...measured].sort((left, right) => Math.abs(right.gainKg) - Math.abs(left.gainKg));
    }

    const rising = measured
      .filter((gain) => gain.gainKg > 0)
      .sort((left, right) => right.gainKg - left.gainKg)
      .slice(0, 4);
    const falling = measured
      .filter((gain) => gain.gainKg < 0)
      .sort((left, right) => left.gainKg - right.gainKg)
      .slice(0, 1);

    return [...rising, ...falling];
  }, [measured, showAllMovers]);
  const biggestMove = Math.max(0, ...movers.map((mover) => Math.abs(mover.gainKg)));

  const sectionHead = (label, note) => (
    <View style={styles.sectionHead}>
      <ThemedText style={styles.overline} setColor={quiet}>
        {label}
      </ThemedText>
      <View style={[styles.sectionRule, { backgroundColor: hairline }]} />
      {note ? (
        <ThemedText style={styles.caption} setColor={quiet}>
          {note}
        </ThemedText>
      ) : null}
    </View>
  );

  // One period for the whole page - and for the deep dives under it, which
  // is why it stays when there is no strength training to show: a runner
  // still reads the rest of the page in it.
  const periodSelector = (
    <View style={styles.periodBlock}>
      <ThemedSegmentedControl
        options={RECORDS_PERIODS.map((entry) => ({
          value: entry.key,
          label: t(`statistics.periods.${entry.key}`),
        }))}
        value={period.key}
        onChange={onChangePeriod}
      />
    </View>
  );

  if (sets.length === 0) {
    return (
      <View style={styles.screen}>
        {periodSelector}

        <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border }]}>
          <ThemedText style={styles.emptyTitle} setColor={title}>
            {t("statistics.empty.title")}
          </ThemedText>
          <ThemedText style={styles.emptyBody} setColor={quiet}>
            {t("statistics.empty.body")}
          </ThemedText>
        </View>
      </View>
    );
  }

  /* ---------------------------------------------------------------- kpis -- */

  // "+3", "−2" or "same" against the period before; a percentage for volume.
  const countChange = (current, before) => {
    if (before === null || before === undefined) {
      return null;
    }

    const delta = current - before;

    return {
      text: delta === 0 ? t("statistics.kpi.same") : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`,
      tone: delta > 0 ? up : delta < 0 ? down : quiet,
    };
  };
  const volumeChange = (() => {
    if (!stats.previous || stats.previous.volume <= 0) {
      return null;
    }

    const change = (stats.current.volume - stats.previous.volume) / stats.previous.volume;

    return {
      text: formatSignedPercent(change),
      tone: change > STEADY_BAND ? up : change < -STEADY_BAND ? down : quiet,
    };
  })();
  const kpis = [
    {
      key: "workouts",
      label: t("statistics.kpi.workouts"),
      value: formatNumber(stats.current.workouts),
      change: countChange(stats.current.workouts, stats.previous?.workouts),
    },
    {
      key: "records",
      label: t("statistics.kpi.records"),
      value: formatNumber(stats.current.records),
      tone: gold,
      change: countChange(stats.current.records, stats.previous?.records),
    },
    {
      key: "volume",
      label: t("statistics.kpi.volume"),
      value: formatNumber(stats.current.volume / 1000, { maximumFractionDigits: 1 }),
      unit: t("statistics.kpi.tonnes"),
      change: volumeChange,
    },
  ];

  /* ------------------------------------------------------------ strength -- */

  const strengthTone =
    strength === null
      ? quiet
      : strength.averagePct > STEADY_BAND
        ? up
        : strength.averagePct < -STEADY_BAND
          ? down
          : quiet;
  const strengthTitle =
    strength === null
      ? null
      : strength.averagePct > STEADY_BAND
        ? t("statistics.strength.up")
        : strength.averagePct < -STEADY_BAND
          ? t("statistics.strength.down")
          : t("statistics.strength.flat");

  /* -------------------------------------------------------------- volume -- */

  const buckets = volume.buckets;
  const volumeMax = Math.max(1, ...buckets.map((bucket) => bucket.volume));
  const slot = CHART_WIDTH / Math.max(1, buckets.length);
  const barWidth = Math.min(18, slot * 0.62);
  const usable = CHART_BASELINE - 8;
  const averagePath = buckets
    .map((bucket, index) => {
      const x = index * slot + slot / 2;
      const y = CHART_BASELINE - (bucket.average / volumeMax) * usable;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const leastGroup = muscles[muscles.length - 1];

  return (
    <View style={styles.screen}>
      {periodSelector}

      {/* Three numbers, each against the period before. */}
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.key} style={[styles.kpi, { backgroundColor: card, borderColor: border }]}>
            <ThemedText
              style={[styles.kpiLabel, kpi.key === "records" && styles.kpiLabelStarred]}
              setColor={quiet}
              numberOfLines={1}
            >
              {kpi.label}
            </ThemedText>
            <View style={styles.kpiValueLine}>
              <ThemedText style={styles.kpiValue} setColor={kpi.tone ?? title} numberOfLines={1}>
                {kpi.value}
              </ThemedText>
              {kpi.unit ? (
                <ThemedText style={styles.kpiUnit} setColor={quiet}>
                  {kpi.unit}
                </ThemedText>
              ) : null}
            </View>
            {kpi.change ? (
              <View style={[styles.chip, { backgroundColor: withAlpha(kpi.change.tone, 0.14) }]}>
                <ThemedText style={styles.chipText} setColor={kpi.change.tone}>
                  {kpi.change.text}
                </ThemedText>
              </View>
            ) : null}
            {kpi.key === "records" ? <RecordStar size={20} index={0} style={styles.kpiStar} /> : null}
          </View>
        ))}
      </View>

      {/* Are you getting stronger. */}
      <View style={[styles.strengthCard, { backgroundColor: card, borderColor: border }]}>
        {strength ? (
          <>
            <ThemedText style={styles.strengthValue} setColor={strengthTone}>
              {formatSignedPercent(strength.averagePct)}
            </ThemedText>
            <View style={styles.strengthCopy}>
              <ThemedText style={styles.strengthTitle} setColor={title}>
                {strengthTitle}
              </ThemedText>
              <ThemedText style={styles.caption} setColor={quiet}>
                {t("statistics.strength.detail", {
                  improving: strength.improving,
                  count: strength.measured,
                })}
              </ThemedText>
            </View>
          </>
        ) : (
          <ThemedText style={styles.emptyBody} setColor={quiet}>
            {t("statistics.strength.empty")}
          </ThemedText>
        )}
      </View>

      {/* Biggest gains */}
      <View style={styles.section}>
        {sectionHead(t("statistics.gains.title"))}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          {movers.length === 0 ? (
            <ThemedText style={styles.emptyBody} setColor={quiet}>
              {t("statistics.gains.empty")}
            </ThemedText>
          ) : (
            movers.map((mover, index) => {
              const isDown = mover.gainKg < 0;
              const tone = isDown ? down : up;

              return (
                <TouchableOpacity
                  key={mover.name}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("statistics.gains.open", { name: mover.name })}
                  onPress={() => onSelectExercise?.(mover.name)}
                  style={[
                    styles.gainRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: hairline },
                  ]}
                >
                  <View style={styles.gainName}>
                    <ThemedText style={styles.gainNameText} setColor={title} numberOfLines={1}>
                      {mover.name}
                    </ThemedText>
                    <ThemedText style={styles.caption} setColor={quiet} numberOfLines={1}>
                      {`${formatKg(mover.bestNow)} ${t("common.kg")}`}
                    </ThemedText>
                  </View>
                  <View style={[styles.gainTrack, { backgroundColor: withAlpha(title, 0.06) }]}>
                    <View
                      style={[
                        styles.gainFill,
                        {
                          width: `${biggestMove === 0 ? 0 : (Math.abs(mover.gainKg) / biggestMove) * 100}%`,
                          backgroundColor: tone,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.gainDelta} setColor={tone}>
                    {formatSignedKg(mover.gainKg)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })
          )}

          {movers.length < measured.length || showAllMovers ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={onToggleAllMovers}
              style={[styles.moreRow, { borderTopColor: hairline }]}
            >
              <ThemedText style={styles.moreText} setColor={theme.primaryText ?? theme.primary}>
                {showAllMovers
                  ? t("statistics.gains.showFewer")
                  : t("statistics.gains.showAll", { count: measured.length })}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Volume */}
      <View style={styles.section}>
        {sectionHead(
          volume.unit === "week" ? t("statistics.volume.weekTitle") : t("statistics.volume.monthTitle")
        )}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            <Defs>
              <LinearGradient id="recordsVolumeBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.primary} stopOpacity="0.95" />
                <Stop offset="1" stopColor={theme.primary} stopOpacity="0.45" />
              </LinearGradient>
            </Defs>

            {buckets.map((bucket, index) => {
              // An empty bucket keeps a 3 dp stub, so the gap reads as nothing
              // logged rather than as a missing column.
              const height = bucket.isEmpty ? 3 : Math.max(4, (bucket.volume / volumeMax) * usable);

              return (
                <Rect
                  key={bucket.start}
                  x={index * slot + (slot - barWidth) / 2}
                  y={CHART_BASELINE - height}
                  width={barWidth}
                  height={height}
                  rx={Math.min(4, barWidth / 3)}
                  fill={bucket.isEmpty ? withAlpha(title, 0.14) : "url(#recordsVolumeBar)"}
                />
              );
            })}

            {buckets.length > 1 ? (
              <Path d={averagePath} stroke={gold} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            ) : null}

            <Rect x={0} y={CHART_BASELINE} width={CHART_WIDTH} height={1} fill={withAlpha(title, 0.16)} />
          </Svg>

          <ThemedText style={styles.caption} setColor={quiet}>
            {volume.unit === "week" ? t("statistics.volume.weekAverage") : t("statistics.volume.monthAverage")}
          </ThemedText>
        </View>
      </View>

      {/* Sets per muscle group */}
      {muscles.length > 0 ? (
        <View style={styles.section}>
          {sectionHead(t("statistics.muscles.title"))}

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            {muscles.slice(0, 6).map((group, index, list) => {
              const biggest = list[0]?.setCount || 1;
              const isLowest = group === leastGroup && muscles.length > 1;

              return (
                <View key={group.label} style={[styles.muscleRow, { marginBottom: 10 }]}>
                  <ThemedText style={styles.muscleName} setColor={quiet} numberOfLines={1}>
                    {muscleGroupLabel(group.label, t)}
                  </ThemedText>
                  <View style={[styles.muscleTrack, { backgroundColor: withAlpha(title, 0.06) }]}>
                    <View
                      style={[
                        styles.muscleFill,
                        {
                          width: `${(group.setCount / biggest) * 100}%`,
                          backgroundColor: isLowest ? quiet : theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.muscleValue} setColor={title}>
                    {formatNumber(group.setCount)}
                  </ThemedText>
                </View>
              );
            })}

            {leastGroup ? (
              <ThemedText style={styles.caption} setColor={quiet}>
                {t("statistics.muscles.summary", { group: muscleGroupLabel(leastGroup.label, t), count: leastGroup.setCount })}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
