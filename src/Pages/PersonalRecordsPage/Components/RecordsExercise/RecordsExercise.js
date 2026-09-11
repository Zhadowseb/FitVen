import React, { useMemo } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import styles from "./RecordsExerciseStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import {
  ThemedSegmentedControl,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import {
  EXERCISE_PERIODS,
  buildExerciseSeries,
  buildRecentSessions,
  buildRepLadder,
} from "../../../../Utils/recordsInsights";

const W = 340;
const H = 190;
// The axis numbers live in this gutter, outside the plot. Inside it they end
// up underneath the gradient fill. 20 was the design's figure and it clips a
// three-digit number - "129.5" arrived on the device as "29.5" - so the
// numbers are whole and the gutter is wide enough for them.
const GUTTER = 28;
const PAD = { top: 14, right: 8, bottom: 30 };
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function kg(value) {
  if (!Number.isFinite(value)) return "–";
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function shortDate(at) {
  const date = new Date(at);
  return `${date.getUTCDate()}. ${MONTHS[date.getUTCMonth()]}`;
}

function relative(at, now) {
  const days = Math.round((now - at) / 86400000);
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days < 7) return `${days} dage siden`;
  if (days < 31) return `${Math.floor(days / 7)} uger siden`;
  return `${Math.max(1, Math.floor(days / 30))} mdr siden`;
}

/** Catmull-Rom through the points, emitted as cubic beziers. */
function smoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

export default function RecordsExercise({
  name,
  sets,
  now,
  periodKey,
  onChangePeriod,
  onBack,
}) {
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const gold = theme.record;
  const up = theme.secondary;
  const quiet = theme.quietText;
  const title = theme.title;
  const card = theme.cardBackground;
  const border = theme.border;
  const hairline = theme.hairline;

  const period =
    EXERCISE_PERIODS.find((entry) => entry.key === periodKey) ??
    EXERCISE_PERIODS[1];

  const series = useMemo(
    () => buildExerciseSeries(sets, { name, now, days: period.days }),
    [sets, name, now, period.days]
  );
  const ladder = useMemo(
    () => buildRepLadder(sets, { name, now, days: period.days }),
    [sets, name, now, period.days]
  );
  const sessions = useMemo(
    () => buildRecentSessions(sets, { name, limit: 3 }),
    [sets, name]
  );

  const chart = useMemo(() => {
    const points = series.points;

    if (points.length === 0) {
      return null;
    }

    const from = series.from ?? points[0].at;
    const to = series.to;
    const span = Math.max(1, to - from);
    const values = points.map((point) => point.e1rm);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const padding = high === low ? Math.max(2, high * 0.08) : (high - low) * 0.14;
    const minValue = Math.max(0, low - padding);
    const maxValue = high + padding;
    const range = maxValue - minValue || 1;
    const plotLeft = GUTTER;
    const plotWidth = W - GUTTER - PAD.right;
    const plotHeight = H - PAD.top - PAD.bottom;
    const baseline = PAD.top + plotHeight;

    const place = (point) => ({
      ...point,
      x: plotLeft + ((point.at - from) / span) * plotWidth,
      y: PAD.top + ((maxValue - point.e1rm) / range) * plotHeight,
    });

    const placedSegments = series.segments.map((segment) => segment.map(place));
    const placed = placedSegments.flat();
    const best = placed.reduce(
      (highest, point) => (!highest || point.e1rm > highest.e1rm ? point : highest),
      null
    );

    // Month marks at their real position, dropped when the label would collide
    // with the one before it. At twelve weeks the first two months sit on top
    // of each other otherwise.
    const marks = [];
    let lastX = -Infinity;
    const cursor = new Date(from);
    cursor.setUTCDate(1);

    while (cursor.getTime() <= to) {
      const at = cursor.getTime();

      if (at >= from) {
        const x = plotLeft + ((at - from) / span) * plotWidth;

        if (x - lastX > 34) {
          marks.push({ x, label: MONTHS[cursor.getUTCMonth()] });
          lastX = x;
        }
      }

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const gaps = series.gaps.map((gap) => ({
      ...gap,
      x1: plotLeft + ((gap.fromAt - from) / span) * plotWidth,
      x2: plotLeft + ((gap.toAt - from) / span) * plotWidth,
    }));

    return {
      placedSegments,
      placed,
      best,
      baseline,
      marks,
      gaps,
      axis: [maxValue, (maxValue + minValue) / 2, minValue].map((value, index) => ({
        value,
        y: PAD.top + (plotHeight / 2) * index,
      })),
    };
  }, [series]);

  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const change =
    first && last && first.e1rm > 0 && series.points.length > 1
      ? (last.e1rm - first.e1rm) / first.e1rm
      : null;

  // Section 5.3, phrased forward. Comparing across rep counts reads as a
  // judgement on the set that was done, which is not the point.
  const nextStep = useMemo(() => {
    const done = ladder.filter((slot) => slot.weight !== null);

    if (done.length === 0) {
      return null;
    }

    const newest = done.reduce((latest, slot) =>
      !latest || slot.at > latest.at ? slot : latest
    );

    return {
      reps: newest.reps,
      current: newest.weight,
      target: Math.round((newest.weight + 2.5) * 2) / 2,
      isToday: now - newest.at < 86400000,
    };
  }, [ladder, now]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Tilbage til Records"
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.uiBackground }]}
        >
          {/* Mirrored: the icon set has no left chevron. */}
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <ChevronRight width={17} height={17} color={title} thickness={2} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerText}>
          <ThemedText style={styles.overline} setColor={quiet}>
            Records
          </ThemedText>
          <ThemedText style={styles.pageTitle} setColor={title} numberOfLines={1}>
            {name}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <ThemedText style={styles.overline} setColor={quiet}>
          Estimeret 1RM
        </ThemedText>

        <View style={styles.chartHead}>
          <ThemedText style={styles.chartValue} setColor={title}>
            {kg(series.best)}
          </ThemedText>
          <ThemedText style={styles.chartUnit} setColor={quiet}>
            kg
          </ThemedText>
          {change !== null ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: withAlpha(change >= 0 ? up : theme.danger, 0.16) },
              ]}
            >
              <ThemedText
                style={styles.pillText}
                setColor={change >= 0 ? up : theme.danger}
              >
                {`${change >= 0 ? "+" : ""}${(change * 100).toFixed(0)} % i perioden`}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {chart ? (
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
              <LinearGradient id="recordsE1rmFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.primary} stopOpacity="0.28" />
                <Stop offset="1" stopColor={theme.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* A break is shaded and named, not bridged silently. */}
            {chart.gaps.map((gap) => (
              <React.Fragment key={`gap-${gap.fromAt}`}>
                <Rect
                  x={gap.x1}
                  y={PAD.top}
                  width={Math.max(1, gap.x2 - gap.x1)}
                  height={chart.baseline - PAD.top}
                  fill={withAlpha(title, 0.025)}
                />
                <SvgText
                  x={(gap.x1 + gap.x2) / 2}
                  y={PAD.top + 10}
                  fill={quiet}
                  fontSize="9"
                  textAnchor="middle"
                >
                  {`${gap.days} dage`}
                </SvgText>
              </React.Fragment>
            ))}

            {chart.placedSegments.map((segment, index) => (
              <Path
                key={`fill-${index}`}
                d={`${smoothPath(segment)} L ${segment[segment.length - 1].x} ${
                  chart.baseline
                } L ${segment[0].x} ${chart.baseline} Z`}
                fill="url(#recordsE1rmFill)"
              />
            ))}

            {/* Dashed grey between segments: the line the data does not support. */}
            {chart.placedSegments.slice(0, -1).map((segment, index) => {
              const next = chart.placedSegments[index + 1];
              const a = segment[segment.length - 1];
              const b = next[0];

              return (
                <Path
                  key={`bridge-${index}`}
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                  stroke={withAlpha(title, 0.3)}
                  strokeWidth={1.4}
                  strokeDasharray="3 4"
                  fill="none"
                />
              );
            })}

            {chart.placedSegments.map((segment, index) => (
              <Path
                key={`line-${index}`}
                d={smoothPath(segment)}
                stroke={theme.primary}
                strokeWidth={2.2}
                fill="none"
              />
            ))}

            <Rect
              x={GUTTER}
              y={chart.baseline}
              width={W - GUTTER - PAD.right}
              height={1}
              fill={withAlpha(title, 0.16)}
            />

            {/* One tick per session under the baseline, so you can see when you
                trained and not only what the number was. */}
            {chart.placed.map((point) => (
              <Rect
                key={`tick-${point.at}`}
                x={point.x - 0.6}
                y={chart.baseline + 2}
                width={1.2}
                height={5}
                fill={withAlpha(theme.primary, 0.75)}
              />
            ))}

            {chart.placed.map((point) => (
              <Circle
                key={`dot-${point.at}`}
                cx={point.x}
                cy={point.y}
                r={2.6}
                fill={theme.primary}
              />
            ))}

            {chart.best ? (
              <>
                <Path
                  d={`M ${chart.best.x} ${chart.best.y} L ${chart.best.x} ${chart.baseline}`}
                  stroke={withAlpha(gold, 0.5)}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <Circle cx={chart.best.x} cy={chart.best.y} r={5.5} fill={withAlpha(gold, 0.25)} />
                <Circle cx={chart.best.x} cy={chart.best.y} r={3.2} fill={gold} />
              </>
            ) : null}

            {/* Drawn last, in the gutter, so the fill cannot cover them. */}
            {chart.axis.map((tick) => (
              <SvgText
                key={`axis-${tick.y}`}
                x={GUTTER - 4}
                y={tick.y + 3}
                fill={quiet}
                fontSize="9"
                textAnchor="end"
              >
                {Math.round(tick.value)}
              </SvgText>
            ))}

            {chart.marks.map((mark) => (
              <SvgText
                key={`mark-${mark.x}`}
                x={mark.x}
                y={H - 12}
                fill={quiet}
                fontSize="9"
                textAnchor="middle"
              >
                {mark.label}
              </SvgText>
            ))}
          </Svg>
        ) : (
          <ThemedText style={styles.caption} setColor={quiet}>
            Ingen sæt med vægt i perioden.
          </ThemedText>
        )}

        <ThemedSegmentedControl
          options={EXERCISE_PERIODS.map((entry) => ({
            value: entry.key,
            label: entry.label,
          }))}
          value={period.key}
          onChange={onChangePeriod}
        />

        {last ? (
          <ThemedText style={styles.caption} setColor={quiet}>
            {`Bedste sæt ${relative(last.at, now)} · ${kg(last.weight)} × ${last.reps}`}
          </ThemedText>
        ) : null}
      </View>

      {nextStep ? (
        <View
          style={[
            styles.nextStep,
            { backgroundColor: withAlpha(gold, 0.08), borderColor: withAlpha(gold, 0.3) },
          ]}
        >
          <ThemedText style={styles.nextStepTitle} setColor={title}>
            {`Næste skridt på ${nextStep.reps} reps`}
          </ThemedText>
          <ThemedText style={styles.caption} setColor={quiet}>
            {`prøv ${kg(nextStep.target)} × ${nextStep.reps} · du tog ${kg(
              nextStep.current
            )} × ${nextStep.reps}`}
          </ThemedText>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <View style={styles.sectionHead}>
          <ThemedText style={styles.overline} setColor={quiet}>
            Rekord pr. reps
          </ThemedText>
          <View style={[styles.sectionRule, { backgroundColor: hairline }]} />
        </View>

        <View style={styles.grid}>
          {ladder.map((slot) => {
            const empty = slot.weight === null;

            return (
              <View
                key={slot.reps}
                style={[
                  styles.tile,
                  empty
                    ? { borderColor: withAlpha(title, 0.16), borderStyle: "dashed" }
                    : slot.isNewInPeriod
                      ? {
                          backgroundColor: withAlpha(gold, 0.08),
                          borderColor: withAlpha(gold, 0.3),
                        }
                      : { backgroundColor: card, borderColor: border },
                ]}
              >
                <ThemedText style={styles.tileReps} setColor={quiet}>
                  {`${slot.reps} REPS`}
                </ThemedText>
                <View style={styles.tileValueLine}>
                  <ThemedText
                    style={styles.tileValue}
                    setColor={empty ? quiet : slot.isNewInPeriod ? gold : title}
                  >
                    {empty ? "—" : kg(slot.weight)}
                  </ThemedText>
                  {empty ? null : (
                    <ThemedText style={styles.tileUnit} setColor={quiet}>
                      kg
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={styles.caption} setColor={quiet}>
                  {empty ? "intet sæt" : shortDate(slot.at)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>

      {sessions.length > 0 ? (
        <View style={{ gap: 12 }}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.overline} setColor={quiet}>
              Seneste sæt
            </ThemedText>
            <View style={[styles.sectionRule, { backgroundColor: hairline }]} />
          </View>

          <View style={[styles.card, { backgroundColor: card, borderColor: border, gap: 10 }]}>
            {sessions.map((session) => (
              <View key={session.at} style={styles.sessionRow}>
                <ThemedText style={styles.sessionDate} setColor={quiet}>
                  {relative(session.at, now)}
                </ThemedText>
                <ThemedText
                  style={styles.sessionSets}
                  setColor={title}
                  numberOfLines={2}
                >
                  {session.sets
                    .map((set) => `${kg(set.weight)} × ${set.reps}`)
                    .join(" · ")}
                </ThemedText>
                {session.hasRecord ? (
                  <ThemedText style={styles.tileReps} setColor={gold}>
                    PR
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
