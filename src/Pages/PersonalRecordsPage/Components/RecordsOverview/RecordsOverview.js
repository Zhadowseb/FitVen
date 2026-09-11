import { useMemo } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import styles from "./RecordsOverviewStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedSegmentedControl,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import {
  RECORDS_PERIODS,
  buildDirections,
  buildExerciseGains,
  buildLatestRecords,
  buildMuscleGroupSets,
  buildStats,
  buildWeeklyVolume,
} from "../../../../Utils/recordsInsights";

const VOLUME_WEEKS = 12;
const CHART_WIDTH = 340;
const CHART_HEIGHT = 152;
const BAR_WIDTH = 16;

function formatKg(value) {
  if (!Number.isFinite(value)) {
    return "–";
  }

  const rounded = Math.round(value * 2) / 2;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSigned(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "–";
  }

  const rounded = Number(value.toFixed(digits));

  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function formatRate(workoutsPerRecord) {
  if (!Number.isFinite(workoutsPerRecord)) {
    return null;
  }

  // More records than workouts rounds down to zero, and "every 0th workout"
  // is not a thing. The floor is one.
  const low = Math.max(1, Math.floor(workoutsPerRecord));
  const high = Math.max(low, Math.ceil(workoutsPerRecord));

  return low === high ? `hver ${low}.` : `hver ${low}.-${high}.`;
}

function relativeDay(at, now) {
  const days = Math.round((now - at) / 86400000);

  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days < 7) return `${days} dage siden`;
  if (days < 31) return `${Math.floor(days / 7)} uger siden`;

  return `${Math.max(1, Math.floor(days / 30))} mdr siden`;
}

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
    RECORDS_PERIODS.find((entry) => entry.key === periodKey) ??
    RECORDS_PERIODS[0];

  const gains = useMemo(
    () => buildExerciseGains(sets, { now, windowDays: 84 }),
    [sets, now]
  );
  const directions = useMemo(() => buildDirections(sets, { now }), [sets, now]);
  const stats = useMemo(
    () => buildStats(sets, { now, days: period.days }),
    [sets, now, period.days]
  );
  const volume = useMemo(
    () => buildWeeklyVolume(sets, { now, weeks: VOLUME_WEEKS }),
    [sets, now]
  );
  const latest = useMemo(() => buildLatestRecords(sets, { limit: 8 }), [sets]);
  const muscles = useMemo(
    () =>
      buildMuscleGroupSets(sets, {
        groupsByExercise,
        now,
        days: period.days,
      }),
    [sets, groupsByExercise, now, period.days]
  );

  // Four biggest gains and the single biggest decline, which is why the
  // selection has to be named underneath: without it a drop among the five
  // looks like the sort is broken.
  const movers = useMemo(() => {
    const measured = gains.filter((gain) => Number.isFinite(gain.gainKg));
    const rising = measured
      .filter((gain) => gain.gainKg > 0)
      .sort((left, right) => right.gainKg - left.gainKg)
      .slice(0, 4);
    const falling = measured
      .filter((gain) => gain.gainKg < 0)
      .sort((left, right) => left.gainKg - right.gainKg)
      .slice(0, 1);

    if (showAllMovers) {
      // Everything with a measured change, biggest first in both directions,
      // so the list stays sorted by how much moved rather than by sign.
      return measured.sort(
        (left, right) => Math.abs(right.gainKg) - Math.abs(left.gainKg)
      );
    }

    return [...rising, ...falling];
  }, [gains, showAllMovers]);

  const measuredCount = useMemo(
    () => gains.filter((gain) => Number.isFinite(gain.gainKg)).length,
    [gains]
  );

  const scale = useMemo(() => {
    const biggestUp = Math.max(0, ...movers.map((mover) => mover.gainKg));
    const biggestDown = Math.abs(Math.min(0, ...movers.map((m) => m.gainKg)));
    const span = biggestUp + biggestDown;

    return {
      biggestUp,
      biggestDown,
      span,
      // With nothing negative the zero line sits at the left edge and every
      // bar reads as an ordinary one.
      zeroRatio: span === 0 ? 0 : biggestDown / span,
    };
  }, [movers]);

  const improving = useMemo(() => {
    const qualified = directions.filter((entry) => entry.qualifies);

    return {
      qualified: qualified.length,
      up: qualified.filter((entry) => entry.direction === "up").length,
    };
  }, [directions]);

  const thisWeek = volume[volume.length - 1];
  const volumeMax = Math.max(1, ...volume.map((week) => week.volume));
  const averageNow = thisWeek?.average ?? 0;
  const versusAverage =
    averageNow > 0 ? (thisWeek.volume - averageNow) / averageNow : null;

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

  return (
    <View style={styles.screen}>
      {/* Biggest movers */}
      <View style={styles.section}>
        {/* The label is load-bearing: these are estimated 1RMs, not lifted
            sets, and without saying so they contradict the record strip. */}
        {sectionHead("Største ryk", "est. 1RM · 12 uger")}

        {movers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <ThemedText style={styles.emptyTitle} setColor={title}>
              Ingen ryk at vise endnu
            </ThemedText>
            <ThemedText style={styles.emptyBody} setColor={quiet}>
              Gentag en øvelse over et par uger, så kan vi måle om den går frem.
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            {movers.map((mover, index) => {
              const isDown = mover.gainKg < 0;
              const magnitude = Math.abs(mover.gainKg);
              const width =
                scale.span === 0 ? 0 : (magnitude / scale.span) * 100;
              const zeroLeft = scale.zeroRatio * 100;

              return (
                <TouchableOpacity
                  key={mover.name}
                  activeOpacity={0.85}
                  onPress={() => onSelectExercise?.(mover.name)}
                  style={styles.gainRow}
                >
                  {index > 0 ? (
                    <View
                      style={[styles.gainDivider, { backgroundColor: hairline }]}
                    />
                  ) : null}

                  <View style={styles.gainTopLine}>
                    <ThemedText
                      style={[
                        styles.gainName,
                        { fontWeight: index === 0 ? "800" : "700" },
                      ]}
                      setColor={title}
                      numberOfLines={1}
                    >
                      {mover.name}
                    </ThemedText>
                    <ThemedText style={styles.gainBest} setColor={title}>
                      {`${formatKg(mover.bestNow)} kg`}
                    </ThemedText>
                    <ThemedText
                      style={styles.gainPct}
                      setColor={isDown ? down : up}
                    >
                      {mover.gainPct === null
                        ? "ny"
                        : `${formatSigned(mover.gainPct * 100, 0)} %`}
                    </ThemedText>
                  </View>

                  <View style={styles.gainBottomLine}>
                    <ThemedText style={styles.gainBefore} setColor={quiet}>
                      {mover.bestBefore === null
                        ? "først nu"
                        : `før ${formatKg(mover.bestBefore)}`}
                    </ThemedText>

                    <View
                      style={[
                        styles.gainTrack,
                        { backgroundColor: withAlpha(title, 0.05) },
                      ]}
                    >
                      <View
                        style={[
                          styles.gainZero,
                          {
                            left: `${zeroLeft}%`,
                            backgroundColor: withAlpha(title, 0.22),
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.gainFill,
                          isDown
                            ? {
                                right: `${100 - zeroLeft}%`,
                                width: `${width}%`,
                                backgroundColor: down,
                              }
                            : {
                                left: `${zeroLeft}%`,
                                width: `${width}%`,
                                backgroundColor: up,
                              },
                        ]}
                      />
                    </View>

                    <ThemedText
                      style={styles.gainDelta}
                      setColor={isDown ? down : up}
                    >
                      {`${formatSigned(mover.gainKg)}`}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: up }]} />
                <ThemedText style={styles.caption} setColor={quiet}>
                  frem
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: down }]} />
                <ThemedText style={styles.caption} setColor={quiet}>
                  tilbage
                </ThemedText>
              </View>
              <ThemedText style={styles.caption} setColor={quiet}>
                {showAllMovers
                  ? "alle øvelser med en målt ændring"
                  : "4 største frem og den største tilbage"}
              </ThemedText>
            </View>
          </View>
        )}

        {measuredCount > movers.length || showAllMovers ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={onToggleAllMovers}
            style={[styles.rowAction, { borderColor: border }]}
          >
            <ThemedText style={styles.rowActionText} setColor={title}>
              {showAllMovers
                ? "Vis færre"
                : `Vis alle ${measuredCount} øvelser`}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Statistics */}
      <View style={styles.section}>
        {sectionHead("Statistik")}

        <ThemedSegmentedControl
          options={RECORDS_PERIODS.map((entry) => ({
            value: entry.key,
            label: entry.label,
          }))}
          value={period.key}
          onChange={onChangePeriod}
        />

        <View
          style={[
            styles.rateCard,
            { backgroundColor: card, borderColor: withAlpha(gold, 0.24) },
          ]}
        >
          <ThemedText style={styles.overline} setColor={gold}>
            Rekord
          </ThemedText>
          <View style={styles.rateValueLine}>
            <ThemedText style={styles.rateValue} setColor={title}>
              {formatRate(stats.current.workoutsPerRecord) ?? "ingen endnu"}
            </ThemedText>
            {stats.current.workoutsPerRecord ? (
              <ThemedText style={styles.rateUnit} setColor={quiet}>
                træning
              </ThemedText>
            ) : null}
          </View>
          {/* A rate on its own says nothing. The comparison is what turns it
              into information, so it is part of the card, not an extra. */}
          <ThemedText style={styles.caption} setColor={quiet}>
            {formatRate(stats.previous.workoutsPerRecord)
              ? `før ${formatRate(stats.previous.workoutsPerRecord)}`
              : "ingen sammenligning for perioden før"}
          </ThemedText>
        </View>

        <View style={styles.tileGrid}>
          {[
            { key: "workouts", value: `${stats.current.workouts}`, label: "Træninger" },
            { key: "records", value: `${stats.current.records}`, label: "Rekorder" },
            {
              key: "improving",
              value:
                improving.qualified >= 4
                  ? `${improving.up}`
                  : `${improving.qualified}`,
              unit:
                improving.qualified >= 4 ? `af ${improving.qualified}` : "følges",
              label: "I fremgang",
            },
            {
              key: "per",
              value:
                stats.current.perWorkout === null
                  ? "–"
                  : stats.current.perWorkout.toFixed(1),
              label: "Pr. træning",
            },
          ].map((tile) => (
            <View
              key={tile.key}
              style={[styles.tile, { backgroundColor: card, borderColor: border }]}
            >
              <View style={styles.tileValueLine}>
                <ThemedText style={styles.tileValue} setColor={title}>
                  {tile.value}
                </ThemedText>
                {tile.unit ? (
                  <ThemedText style={styles.tileUnit} setColor={quiet}>
                    {tile.unit}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={styles.overline} setColor={quiet}>
                {tile.label}
              </ThemedText>
            </View>
          ))}
        </View>

        <ThemedText style={styles.caption} setColor={quiet}>
          {period.days === null
            ? "Hele din historik. Ingen periode at sammenligne med."
            : `Sammenligningen er de ${Math.round(period.days / 7)} uger før perioden`}
        </ThemedText>
      </View>

      {/* Weekly volume */}
      <View style={styles.section}>
        {sectionHead("Volumen pr. uge")}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText style={styles.caption} setColor={quiet}>
            denne uge
          </ThemedText>
          <View style={styles.volumeHead}>
            <ThemedText style={styles.volumeValue} setColor={title}>
              {((thisWeek?.volume ?? 0) / 1000).toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.volumeUnit} setColor={quiet}>
              ton
            </ThemedText>
            {versusAverage !== null ? (
              <View
                style={[
                  styles.pill,
                  { backgroundColor: withAlpha(versusAverage >= 0 ? up : down, 0.16) },
                ]}
              >
                <ThemedText
                  style={styles.pillText}
                  setColor={versusAverage >= 0 ? up : down}
                >
                  {`${formatSigned(versusAverage * 100, 0)} % mod snit`}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <Svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <Defs>
              <LinearGradient id="recordsVolumeBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.primary} stopOpacity="0.95" />
                <Stop offset="1" stopColor={theme.primary} stopOpacity="0.45" />
              </LinearGradient>
            </Defs>

            {volume.map((week, index) => {
              const slot = CHART_WIDTH / VOLUME_WEEKS;
              const x = index * slot + (slot - BAR_WIDTH) / 2;
              const usable = CHART_HEIGHT - 26;
              // An empty week keeps a 3 dp stub so the gap reads as "nothing
              // logged" rather than as a missing column.
              const height = week.isEmpty
                ? 3
                : Math.max(4, (week.volume / volumeMax) * usable);

              return (
                <Rect
                  key={week.weekStart}
                  x={x}
                  y={CHART_HEIGHT - 18 - height}
                  width={BAR_WIDTH}
                  height={height}
                  rx={4}
                  fill={
                    week.isEmpty
                      ? withAlpha(title, 0.14)
                      : "url(#recordsVolumeBar)"
                  }
                />
              );
            })}

            {/* Four-week average, counting the empty weeks. Skipping them
                would make the line rise through a break. */}
            <Path
              d={volume
                .map((week, index) => {
                  const slot = CHART_WIDTH / VOLUME_WEEKS;
                  const x = index * slot + slot / 2;
                  const usable = CHART_HEIGHT - 26;
                  const y =
                    CHART_HEIGHT - 18 - (week.average / volumeMax) * usable;

                  return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              stroke={gold}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
            />

            <Rect
              x={0}
              y={CHART_HEIGHT - 18}
              width={CHART_WIDTH}
              height={1}
              fill={withAlpha(title, 0.16)}
            />
          </Svg>

          <ThemedText style={styles.caption} setColor={quiet}>
            12 uger · guldlinjen er 4-ugers snit
          </ThemedText>
        </View>
      </View>

      {/* Latest records */}
      {latest.length > 0 ? (
        <View style={styles.section}>
          {sectionHead("Nyeste rekorder")}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recordStrip}
          >
            {latest.map((record, index) => (
              <TouchableOpacity
                key={`${record.name}-${record.at}-${record.reps}-${index}`}
                activeOpacity={0.85}
                onPress={() => onSelectExercise?.(record.name)}
                style={[
                  styles.recordCard,
                  {
                    backgroundColor: withAlpha(gold, 0.08),
                    borderColor: withAlpha(gold, 0.3),
                  },
                ]}
              >
                <ThemedText
                  style={styles.recordName}
                  setColor={title}
                  numberOfLines={1}
                >
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
                <ThemedText style={styles.caption} setColor={quiet}>
                  {relativeDay(record.at, now)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Sets per muscle group */}
      {muscles.length > 0 ? (
        <View style={styles.section}>
          {sectionHead("Sæt pr. muskelgruppe", period.label)}

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            {muscles.slice(0, 6).map((group, index, list) => {
              const biggest = list[0]?.setCount || 1;
              const isLowest = index === list.length - 1 && list.length > 1;

              return (
                <View key={group.label} style={[styles.muscleRow, { marginBottom: 10 }]}>
                  <ThemedText
                    style={styles.muscleName}
                    setColor={quiet}
                    numberOfLines={1}
                  >
                    {group.label}
                  </ThemedText>
                  <View
                    style={[
                      styles.muscleTrack,
                      { backgroundColor: withAlpha(title, 0.06) },
                    ]}
                  >
                    <View
                      style={[
                        styles.muscleFill,
                        {
                          width: `${(group.setCount / biggest) * 100}%`,
                          // The lowest group is drawn in a solid muted colour
                          // rather than a faded one: it is the group the
                          // caption points at, so it has to be visible.
                          backgroundColor: isLowest ? quiet : theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.muscleValue} setColor={title}>
                    {group.setCount}
                  </ThemedText>
                </View>
              );
            })}

            <ThemedText style={styles.caption} setColor={quiet}>
              {`${muscles.reduce((sum, group) => sum + group.setCount, 0)} loggede sæt i perioden · ${
                muscles[muscles.length - 1]?.label ?? "–"
              } er lavest belastet`}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
