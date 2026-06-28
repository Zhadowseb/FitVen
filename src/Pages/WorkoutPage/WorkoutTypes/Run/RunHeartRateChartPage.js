import { StatusBar, TouchableOpacity, useColorScheme, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";

import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedText,
  ThemedView,
} from "../../../../Resources/ThemedComponents";
import {
  FALLBACK_MAX_HEART_RATE,
  getHeartRateZoneThresholds,
  getHeartRateZoneColor,
} from "./RunHeartRateChartConfig";
import {
  buildHeartRateZones,
  normalizeMaxHeartRate,
} from "../../../../Utils/heartRateUtils";
import styles from "./RunHeartRateChartPageStyle";

const CHART_BOUNDS = {
  left: 58,
  right: 966,
  top: 22,
  bottom: 326,
};

const X_AXIS_RATIOS = [0, 0.25, 0.5, 0.75, 1];

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getYPosition(bpm, chart) {
  const range = chart.maxBpm - chart.minBpm;
  const clampedBpm = Math.min(
    Math.max(Number(bpm), chart.minBpm),
    chart.maxBpm
  );

  return (
    chart.top +
    (1 - (clampedBpm - chart.minBpm) / range) *
      (chart.bottom - chart.top)
  );
}

function buildHeartRatePath(history, durationMinutes, chart) {
  if (!Array.isArray(history) || history.length < 2) {
    return null;
  }

  const xRange = Math.max(Number(durationMinutes) || 0, 1);
  const points = history.map((point) => {
    const elapsedMinutes = Math.min(
      Math.max(Number(point?.x) || 0, 0),
      xRange
    );

    return {
      x:
        chart.left +
        (elapsedMinutes / xRange) * (chart.right - chart.left),
      y: getYPosition(point?.y, chart),
    };
  });

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previousPoint = points[index - 1];
    return `${path} L ${point.x} ${previousPoint.y} L ${point.x} ${point.y}`;
  }, "");
}

function buildActualHeartRateSegments(
  history,
  durationMinutes,
  chart,
  zoneBands
) {
  if (!Array.isArray(history) || history.length < 2) {
    return [];
  }

  const xRange = Math.max(Number(durationMinutes) || 0, 1);
  const points = history.map((point) => {
    const elapsedMinutes = Math.min(
      Math.max(Number(point?.x) || 0, 0),
      xRange
    );
    const bpm = Math.min(
      Math.max(Number(point?.y) || chart.minBpm, chart.minBpm),
      chart.maxBpm
    );

    return {
      bpm,
      x:
        chart.left +
        (elapsedMinutes / xRange) * (chart.right - chart.left),
      y: getYPosition(bpm, chart),
    };
  });
  const segments = [];
  const zoneThresholds = getHeartRateZoneThresholds(zoneBands);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const bpmDifference = end.bpm - start.bpm;
    const crossingRatios =
      bpmDifference === 0
        ? []
        : zoneThresholds.map(
            (threshold) => (threshold - start.bpm) / bpmDifference
          ).filter((ratio) => ratio > 0 && ratio < 1);
    const ratios = [0, ...crossingRatios.sort((left, right) => left - right), 1];

    for (let ratioIndex = 1; ratioIndex < ratios.length; ratioIndex += 1) {
      const startRatio = ratios[ratioIndex - 1];
      const endRatio = ratios[ratioIndex];
      const segmentStartX = start.x + (end.x - start.x) * startRatio;
      const segmentStartY = start.y + (end.y - start.y) * startRatio;
      const segmentEndX = start.x + (end.x - start.x) * endRatio;
      const segmentEndY = start.y + (end.y - start.y) * endRatio;
      const midpointBpm =
        start.bpm + bpmDifference * ((startRatio + endRatio) / 2);

      segments.push({
        color: getHeartRateZoneColor(midpointBpm, zoneBands),
        path: `M ${segmentStartX} ${segmentStartY} L ${segmentEndX} ${segmentEndY}`,
      });
    }
  }

  return segments;
}

const RunHeartRateChartPage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const durationSeconds = Math.max(
    0,
    Number(route.params?.durationSeconds) || 0
  );
  const durationMinutes = durationSeconds / 60;
  const actualHistory = Array.isArray(route.params?.actualHistory)
    ? route.params.actualHistory
    : [];
  const plannedHistory = Array.isArray(route.params?.plannedHistory)
    ? route.params.plannedHistory
    : [];
  const targetDisplay = route.params?.targetDisplay ?? "--";
  const maxHeartRate =
    normalizeMaxHeartRate(route.params?.maxHeartRate) ??
    FALLBACK_MAX_HEART_RATE;
  const routeZoneBands = route.params?.zoneBands;
  const zoneBands =
    Array.isArray(routeZoneBands) && routeZoneBands.length === 5
      ? routeZoneBands
      : buildHeartRateZones(maxHeartRate);
  const chart = {
    ...CHART_BOUNDS,
    minBpm: 60,
    maxBpm: Math.max(maxHeartRate, 61),
  };
  const yAxisTicks = [
    chart.maxBpm,
    ...Array.from(
      { length: Math.max(0, Math.floor((chart.maxBpm - 60) / 20)) },
      (_, index) => chart.maxBpm - (index + 1) * 20
    ).filter((tick) => tick > 60),
    60,
  ].filter((tick, index, ticks) => ticks.indexOf(tick) === index);
  const screenBackground = theme.background ?? "#0E0F12";
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const heartRateColor = theme.secondary ?? "#60daac";
  const plannedColor = theme.planned ?? "#FFDD00";
  const actualSegments = buildActualHeartRateSegments(
    actualHistory,
    durationMinutes,
    chart,
    zoneBands
  );
  const plannedPath = buildHeartRatePath(
    plannedHistory,
    durationMinutes,
    chart
  );

  return (
    <ThemedView
      safe
      style={[styles.screen, { backgroundColor: screenBackground }]}
    >
      <StatusBar hidden />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close heart rate chart"
          activeOpacity={0.72}
          onPress={() => navigation.goBack()}
          style={[styles.closeButton, { borderColor: cardBorder }]}
        >
          <Feather name="arrow-left" size={21} color={titleColor} />
        </TouchableOpacity>

        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow} setColor={heartRateColor}>
            HEART RATE
          </ThemedText>
          <ThemedText style={styles.title} setColor={titleColor}>
            Heart rate over time
          </ThemedText>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendZoneLine}>
                {zoneBands.map((band) => (
                  <View
                    key={band.zone}
                    style={[
                      styles.legendZoneSegment,
                      { backgroundColor: band.color },
                    ]}
                  />
                ))}
              </View>
              <ThemedText style={styles.legendLabel} setColor={quietText}>
                ACTUAL
              </ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendLineThin,
                  { backgroundColor: plannedColor },
                ]}
              />
              <ThemedText style={styles.legendLabel} setColor={quietText}>
                PLANNED
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.summary}>
          <ThemedText style={styles.summaryValue} setColor={heartRateColor}>
            {targetDisplay}
          </ThemedText>
          <ThemedText style={styles.summaryLabel} setColor={quietText}>
            TARGET
          </ThemedText>
        </View>
      </View>

      <View style={styles.chartShell}>
        <Svg width="100%" height="100%" viewBox="0 0 1000 370">
          {zoneBands.map((band) => {
            const min = Math.max(
              chart.minBpm,
              band.min - (band.zone > 1 ? 1 : 0)
            );
            const max = Math.min(chart.maxBpm, band.max);
            const top = getYPosition(max, chart);
            const bottom = getYPosition(min, chart);

            return (
              <Rect
                key={band.zone}
                x={chart.left}
                y={top}
                width={chart.right - chart.left}
                height={Math.max(0, bottom - top)}
                fill={band.color}
                fillOpacity="0.2"
              />
            );
          })}

          {yAxisTicks.map((tick) => {
            const y = getYPosition(tick, chart);

            return (
              <SvgText
                key={tick}
                x="7"
                y={y + 4}
                fill={quietText}
                fontSize="12"
                fontWeight="700"
              >
                {tick}
              </SvgText>
            );
          })}

          {zoneBands.map((band) => {
            const min = Math.max(chart.minBpm, band.min);
            const max = Math.min(chart.maxBpm, band.max);

            return (
              <SvgText
                key={`zone:${band.zone}`}
                x={chart.right - 8}
                y={
                  (getYPosition(min, chart) + getYPosition(max, chart)) / 2 + 4
                }
                fill={band.color}
                fontSize="11"
                fontWeight="900"
                textAnchor="end"
              >
                Z{band.zone}
              </SvgText>
            );
          })}

          {plannedPath ? (
            <Path
              d={plannedPath}
              fill="none"
              stroke={plannedColor}
              strokeWidth="1.4"
              strokeOpacity="0.76"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {actualSegments.map((segment, index) => (
            <Path
              key={`${index}:${segment.color}`}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {X_AXIS_RATIOS.map((ratio) => {
            const x = chart.left + ratio * (chart.right - chart.left);
            const label = formatClock(durationSeconds * ratio);

            return (
              <SvgText
                key={`time:${ratio}`}
                x={x}
                y="354"
                fill={quietText}
                fontSize="11"
                fontWeight="700"
                textAnchor={
                  ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"
                }
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </ThemedView>
  );
};

export default RunHeartRateChartPage;
