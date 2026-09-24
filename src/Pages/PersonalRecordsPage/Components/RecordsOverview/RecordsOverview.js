import { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import styles from "./RecordsOverviewStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedSegmentedControl, ThemedText } from "@resources/ThemedComponents";
import {
  RECORDS_PERIODS,
  buildExerciseGains,
  buildExerciseList,
  buildLatestRecords,
  buildMuscleGroupSets,
  buildStats,
  buildStrengthSummary,
  buildVolumeBuckets,
} from "@utils/recordsInsights";
import { formatRelativeDay } from "@utils/dateUtils";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 132;
const CHART_BASELINE = CHART_HEIGHT - 6;
const EXERCISES_SHOWN = 6;
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
 * The Records overview, read top to bottom in one period that the selector
 * at the top sets for all of it: three numbers against the period before,
 * whether you are getting stronger, the biggest gains, the volume, the latest
 * records, every exercise, and the sets per muscle group.
 */
export default function RecordsOverview({
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
  const [showAllExercises, setShowAllExercises] = useState(false);

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
  const latest = useMemo(() => buildLatestRecords(sets, { limit: 8 }), [sets]);
  const exercises = useMemo(() => buildExerciseList(sets, { now }), [sets, now]);
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

  if (sets.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border }]}>
        <ThemedText style={styles.emptyTitle} setColor={title}>
          {t("records.empty.title")}
        </ThemedText>
        <ThemedText style={styles.emptyBody} setColor={quiet}>
          {t("records.empty.body")}
        </ThemedText>
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
      text: delta === 0 ? t("records.kpi.same") : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`,
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
      label: t("records.kpi.workouts"),
      value: formatNumber(stats.current.workouts),
      change: countChange(stats.current.workouts, stats.previous?.workouts),
    },
    {
      key: "records",
      label: t("records.kpi.records"),
      value: formatNumber(stats.current.records),
      tone: gold,
      change: countChange(stats.current.records, stats.previous?.records),
    },
    {
      key: "volume",
      label: t("records.kpi.volume"),
      value: formatNumber(stats.current.volume / 1000, { maximumFractionDigits: 1 }),
      unit: t("records.kpi.tonnes"),
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
        ? t("records.strength.up")
        : strength.averagePct < -STEADY_BAND
          ? t("records.strength.down")
          : t("records.strength.flat");

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

  /* ----------------------------------------------------------- exercises -- */

  const shownExercises = showAllExercises ? exercises : exercises.slice(0, EXERCISES_SHOWN);
  const directionMark = (direction) =>
    direction === "up"
      ? { glyph: "↑", tone: up, label: t("records.exercises.up") }
      : direction === "down"
        ? { glyph: "↓", tone: down, label: t("records.exercises.down") }
        : direction === "flat"
          ? { glyph: "→", tone: quiet, label: t("records.exercises.flat") }
          : null;

  const leastGroup = muscles[muscles.length - 1];

  return (
    <View style={styles.screen}>
      {/* One period for the whole page. */}
      <View style={styles.periodBlock}>
        <ThemedSegmentedControl
          options={RECORDS_PERIODS.map((entry) => ({
            value: entry.key,
            label: t(`records.periods.${entry.key}`),
          }))}
          value={period.key}
          onChange={onChangePeriod}
        />
        <ThemedText style={styles.caption} setColor={quiet}>
          {days === null
            ? t("records.periodNoteAll")
            : t("records.periodNote", { period: t(`records.periodsBefore.${period.key}`) })}
        </ThemedText>
      </View>

      {/* Three numbers, each against the period before. */}
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.key} style={[styles.kpi, { backgroundColor: card, borderColor: border }]}>
            <ThemedText style={styles.kpiLabel} setColor={quiet} numberOfLines={1}>
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
                {t("records.strength.detail", {
                  improving: strength.improving,
                  count: strength.measured,
                })}
              </ThemedText>
            </View>
          </>
        ) : (
          <ThemedText style={styles.emptyBody} setColor={quiet}>
            {t("records.strength.empty")}
          </ThemedText>
        )}
      </View>

      {/* Biggest gains */}
      <View style={styles.section}>
        {sectionHead(t("records.gains.title"))}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          {movers.length === 0 ? (
            <ThemedText style={styles.emptyBody} setColor={quiet}>
              {t("records.gains.empty")}
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
                  accessibilityLabel={t("records.gains.open", { name: mover.name })}
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
                      {`${formatKg(mover.bestNow)} kg`}
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
                  ? t("records.gains.showFewer")
                  : t("records.gains.showAll", { count: measured.length })}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Volume */}
      <View style={styles.section}>
        {sectionHead(
          volume.unit === "week" ? t("records.volume.weekTitle") : t("records.volume.monthTitle")
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
            {volume.unit === "week" ? t("records.volume.weekAverage") : t("records.volume.monthAverage")}
          </ThemedText>
        </View>
      </View>

      {/* Latest records */}
      {latest.length > 0 ? (
        <View style={styles.section}>
          {sectionHead(t("records.latest.title"))}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recordStrip}>
            {latest.map((record, index) => (
              <TouchableOpacity
                key={`${record.name}-${record.at}-${record.reps}-${index}`}
                activeOpacity={0.85}
                onPress={() => onSelectExercise?.(record.name)}
                style={[
                  styles.recordCard,
                  { backgroundColor: withAlpha(gold, 0.08), borderColor: withAlpha(gold, 0.3) },
                ]}
              >
                <ThemedText style={styles.recordName} setColor={title} numberOfLines={1}>
                  {record.name}
                </ThemedText>
                <View style={styles.recordWeightLine}>
                  <ThemedText style={styles.recordWeight} setColor={gold}>
                    {formatKg(record.weight)}
                  </ThemedText>
                  <ThemedText style={styles.recordWeightMeta} setColor={quiet}>
                    {`kg × ${record.reps}`}
                  </ThemedText>
                </View>
                <ThemedText style={styles.caption} setColor={quiet} numberOfLines={1}>
                  {formatRelativeDay(record.at, now)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Every exercise */}
      <View style={styles.section}>
        {sectionHead(t("records.exercises.title"), formatNumber(exercises.length))}

        <View style={[styles.card, styles.listCard, { backgroundColor: card, borderColor: border }]}>
          {shownExercises.map((exercise, index) => {
            const mark = directionMark(exercise.direction);

            return (
              <TouchableOpacity
                key={exercise.name}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("records.gains.open", { name: exercise.name })}
                onPress={() => onSelectExercise?.(exercise.name)}
                style={[styles.exerciseRow, index > 0 && { borderTopWidth: 1, borderTopColor: hairline }]}
              >
                <View style={styles.exerciseCopy}>
                  <ThemedText style={styles.exerciseName} setColor={title} numberOfLines={1}>
                    {exercise.name}
                  </ThemedText>
                  <ThemedText style={styles.caption} setColor={quiet} numberOfLines={1}>
                    {t("records.exercises.heaviest", {
                      lift: `${formatKg(exercise.heaviest.weight)} kg × ${exercise.heaviest.reps}`,
                    })}
                    {` · ${formatRelativeDay(exercise.lastAt, now)}`}
                  </ThemedText>
                </View>
                {mark ? (
                  <View
                    accessibilityLabel={mark.label}
                    style={[styles.directionPill, { backgroundColor: withAlpha(mark.tone, 0.14) }]}
                  >
                    <ThemedText style={styles.directionText} setColor={mark.tone}>
                      {mark.glyph}
                    </ThemedText>
                  </View>
                ) : null}
                <ChevronRight width={15} height={15} color={quiet} />
              </TouchableOpacity>
            );
          })}

          {exercises.length > EXERCISES_SHOWN ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => setShowAllExercises((value) => !value)}
              style={[styles.moreRow, { borderTopColor: hairline }]}
            >
              <ThemedText style={styles.moreText} setColor={theme.primaryText ?? theme.primary}>
                {showAllExercises
                  ? t("records.exercises.showFewer")
                  : t("records.exercises.showAll", { count: exercises.length })}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Sets per muscle group */}
      {muscles.length > 0 ? (
        <View style={styles.section}>
          {sectionHead(t("records.muscles.title"))}

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            {muscles.slice(0, 6).map((group, index, list) => {
              const biggest = list[0]?.setCount || 1;
              const isLowest = group === leastGroup && muscles.length > 1;

              return (
                <View key={group.label} style={[styles.muscleRow, { marginBottom: 10 }]}>
                  <ThemedText style={styles.muscleName} setColor={quiet} numberOfLines={1}>
                    {group.label}
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
                {t("records.muscles.summary", { group: leastGroup.label, count: leastGroup.setCount })}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
