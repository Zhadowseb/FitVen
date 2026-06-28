import { StatusBar, TouchableOpacity, useColorScheme, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedText,
  ThemedView,
} from "../../../../Resources/ThemedComponents";
import {
  HEART_RATE_ZONE_BANDS,
  HEART_RATE_ZONE_THRESHOLDS,
  getHeartRateZoneColor,
  TEST_MAX_HEART_RATE,
} from "./RunHeartRateChartConfig";
import styles from "./RunHeartRateChartPageStyle";

const CHART = {
  left: 58,
  right: 966,
  top: 22,
  bottom: 326,
  minBpm: 60,
  maxBpm: TEST_MAX_HEART_RATE,
};

const Y_AXIS_TICKS = [220, 200, 180, 160, 140, 120, 100, 80, 60];
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

function getYPosition(bpm) {
  const range = CHART.maxBpm - CHART.minBpm;
  const clampedBpm = Math.min(Math.max(Number(bpm), CHART.minBpm), CHART.maxBpm);

  return (
    CHART.top +
    (1 - (clampedBpm - CHART.minBpm) / range) *
      (CHART.bottom - CHART.top)
  );
}

function buildHeartRatePath(history, durationMinutes) {
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
        CHART.left +
        (elapsedMinutes / xRange) * (CHART.right - CHART.left),
      y: getYPosition(point?.y),
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

function buildActualHeartRateSegments(history, durationMinutes) {
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
      Math.max(Number(point?.y) || CHART.minBpm, CHART.minBpm),
      CHART.maxBpm
    );

    return {
      bpm,
      x:
        CHART.left +
        (elapsedMinutes / xRange) * (CHART.right - CHART.left),
      y: getYPosition(bpm),
    };
  });
  const segments = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const bpmDifference = end.bpm - start.bpm;
    const crossingRatios =
      bpmDifference === 0
        ? []
        : HEART_RATE_ZONE_THRESHOLDS.map(
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
        color: getHeartRateZoneColor(midpointBpm),
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
  const screenBackground = theme.background ?? "#0E0F12";
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const heartRateColor = theme.secondary ?? "#60daac";
  const plannedColor = theme.planned ?? "#FFDD00";
  const actualSegments = buildActualHeartRateSegments(
    actualHistory,
    durationMinutes
  );
  const plannedPath = buildHeartRatePath(plannedHistory, durationMinutes);

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
                {HEART_RATE_ZONE_BANDS.map((band) => (
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
          {HEART_RATE_ZONE_BANDS.map((band) => {
            const min = Math.max(CHART.minBpm, band.min);
            const max = Math.min(CHART.maxBpm, band.max);
            const top = getYPosition(max);
            const bottom = getYPosition(min);

            return (
              <Rect
                key={band.zone}
                x={CHART.left}
                y={top}
                width={CHART.right - CHART.left}
                height={Math.max(0, bottom - top)}
                fill={band.color}
                fillOpacity="0.2"
              />
            );
          })}

          {Y_AXIS_TICKS.map((tick) => {
            const y = getYPosition(tick);

            return (
              <G key={tick}>
                <Line
                  x1={CHART.left}
                  x2={CHART.right}
                  y1={y}
                  y2={y}
                  stroke={cardBorder}
                  strokeWidth="1"
                  strokeDasharray="5 8"
                />
                <SvgText
                  x="7"
                  y={y + 4}
                  fill={quietText}
                  fontSize="12"
                  fontWeight="700"
                >
                  {tick}
                </SvgText>
              </G>
            );
          })}

          {X_AXIS_RATIOS.map((ratio) => {
            const x = CHART.left + ratio * (CHART.right - CHART.left);

            return (
              <Line
                key={ratio}
                x1={x}
                x2={x}
                y1={CHART.top}
                y2={CHART.bottom}
                stroke={cardBorder}
                strokeWidth="1"
                strokeDasharray="5 8"
              />
            );
          })}

          {HEART_RATE_ZONE_BANDS.map((band) => {
            const min = Math.max(CHART.minBpm, band.min);
            const max = Math.min(CHART.maxBpm, band.max);

            return (
              <SvgText
                key={`zone:${band.zone}`}
                x={CHART.right - 8}
                y={(getYPosition(min) + getYPosition(max)) / 2 + 4}
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
            const x = CHART.left + ratio * (CHART.right - CHART.left);
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
