import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./PersonalRecordsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Calender from "../../Resources/Icons/UI-icons/Calender";
import TradeUp from "../../Resources/Icons/UI-icons/TradeUp";
import {
  ThemedHeader,
  ThemedPicker,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { programService, weightliftingService } from "../../Services";

const TREND_CHART_WIDTH = 320;
const TREND_CHART_HEIGHT = 190;
const TREND_CHART_PADDING = {
  top: 18,
  right: 18,
  bottom: 34,
  left: 44,
};
const MUSCLE_LOAD_CHART_WIDTH = 320;
const MUSCLE_LOAD_CHART_HEIGHT = 300;
const MUSCLE_LOAD_CHART_CENTER = {
  x: 160,
  y: 150,
};
const MUSCLE_LOAD_CHART_RADIUS = 112;
const MUSCLE_LOAD_LABEL_RADIUS = 136;
const MUSCLE_LOAD_GRID_STEPS = [0.2, 0.4, 0.6, 0.8, 1];

function formatTrendAxisValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  const roundedValue = Math.round(numericValue * 2) / 2;

  return Number.isInteger(roundedValue)
    ? String(roundedValue)
    : roundedValue.toFixed(1);
}

function buildTrendChartGeometry(points = []) {
  const validPoints = points.filter((point) =>
    Number.isFinite(Number(point?.estimatedOneRepMax))
  );

  if (validPoints.length === 0) {
    return null;
  }

  const values = validPoints.map((point) => Number(point.estimatedOneRepMax));
  const rawMinValue = Math.min(...values);
  const rawMaxValue = Math.max(...values);
  const rawRange = rawMaxValue - rawMinValue;
  const valuePadding =
    rawRange === 0 ? Math.max(2, rawMaxValue * 0.08) : rawRange * 0.12;
  const minValue = Math.max(0, rawMinValue - valuePadding);
  const maxValue = rawMaxValue + valuePadding;
  const valueRange = maxValue - minValue || 1;
  const plotWidth =
    TREND_CHART_WIDTH -
    TREND_CHART_PADDING.left -
    TREND_CHART_PADDING.right;
  const plotHeight =
    TREND_CHART_HEIGHT -
    TREND_CHART_PADDING.top -
    TREND_CHART_PADDING.bottom;
  const baselineY = TREND_CHART_PADDING.top + plotHeight;

  const chartPoints = validPoints.map((point, index) => {
    const x =
      TREND_CHART_PADDING.left +
      (validPoints.length === 1
        ? plotWidth / 2
        : (index / (validPoints.length - 1)) * plotWidth);
    const y =
      TREND_CHART_PADDING.top +
      ((maxValue - Number(point.estimatedOneRepMax)) / valueRange) *
        plotHeight;

    return {
      ...point,
      x,
      y,
    };
  });

  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    chartPoints.length > 1
      ? `${path} L ${chartPoints[chartPoints.length - 1].x} ${baselineY} L ${
          chartPoints[0].x
        } ${baselineY} Z`
      : null;
  const singlePointLine =
    chartPoints.length === 1
      ? {
          x1: Math.max(TREND_CHART_PADDING.left, chartPoints[0].x - 28),
          x2: Math.min(
            TREND_CHART_WIDTH - TREND_CHART_PADDING.right,
            chartPoints[0].x + 28
          ),
          y: chartPoints[0].y,
        }
      : null;
  const gridLines = [0, 0.5, 1].map((offset) => {
    const y = TREND_CHART_PADDING.top + plotHeight * offset;
    const value = maxValue - valueRange * offset;

    return {
      y,
      label: formatTrendAxisValue(value),
    };
  });

  return {
    chartPoints,
    path,
    areaPath,
    singlePointLine,
    gridLines,
    baselineY,
    firstLabel: chartPoints[0]?.dateDisplay ?? "Workout 1",
    lastLabel:
      chartPoints.length > 1
        ? chartPoints[chartPoints.length - 1]?.dateDisplay ??
          `Workout ${chartPoints.length}`
        : null,
  };
}

function getMuscleLoadRadarPoint(index, pointCount, radius) {
  const angle = -Math.PI / 2 + (index / pointCount) * Math.PI * 2;

  return {
    x: MUSCLE_LOAD_CHART_CENTER.x + Math.cos(angle) * radius,
    y: MUSCLE_LOAD_CHART_CENTER.y + Math.sin(angle) * radius,
  };
}

function buildClosedPath(points = []) {
  if (points.length === 0) {
    return "";
  }

  return (
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ") + " Z"
  );
}

function getRadarTextAnchor(x) {
  if (x < MUSCLE_LOAD_CHART_CENTER.x - 8) {
    return "end";
  }

  if (x > MUSCLE_LOAD_CHART_CENTER.x + 8) {
    return "start";
  }

  return "middle";
}

function buildMuscleLoadRadarGeometry(points = []) {
  const validPoints = points.filter((point) =>
    Number.isFinite(Number(point?.value))
  );

  if (validPoints.length === 0) {
    return null;
  }

  const values = validPoints.map((point) => Number(point.value));
  const rawMaxValue = Math.max(...values, 0);
  const maxValue = rawMaxValue <= 0 ? 1 : rawMaxValue;
  const pointCount = validPoints.length;

  const chartPoints = validPoints.map((point, index) => {
    const valueRatio = Math.max(0, Number(point.value) || 0) / maxValue;
    const radarPoint = getMuscleLoadRadarPoint(
      index,
      pointCount,
      MUSCLE_LOAD_CHART_RADIUS * Math.min(1, valueRatio)
    );
    const labelPoint = getMuscleLoadRadarPoint(
      index,
      pointCount,
      MUSCLE_LOAD_LABEL_RADIUS
    );

    return {
      ...point,
      x: radarPoint.x,
      y: radarPoint.y,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      textAnchor: getRadarTextAnchor(labelPoint.x),
      isHighest: Number(point.value) === rawMaxValue && rawMaxValue > 0,
    };
  });
  const axisLines = validPoints.map((point, index) => ({
    key: point.key,
    ...getMuscleLoadRadarPoint(index, pointCount, MUSCLE_LOAD_CHART_RADIUS),
  }));
  const gridPaths = MUSCLE_LOAD_GRID_STEPS.map((step) =>
    buildClosedPath(
      validPoints.map((_, index) =>
        getMuscleLoadRadarPoint(
          index,
          pointCount,
          MUSCLE_LOAD_CHART_RADIUS * step
        )
      )
    )
  );

  return {
    chartPoints,
    axisLines,
    gridPaths,
    dataPath: buildClosedPath(chartPoints),
  };
}

const PersonalRecordsPage = () => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [summaries, setSummaries] = useState([]);
  const [muscleLoadPrograms, setMuscleLoadPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const selectedProgramIdRef = useRef(null);
  const [muscleLoad, setMuscleLoad] = useState(null);
  const [muscleLoadLoading, setMuscleLoadLoading] = useState(false);
  const [selectedExerciseName, setSelectedExerciseName] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hideEmptyRepRanges, setHideEmptyRepRanges] = useState(false);
  const muscleLoadProgramItems = useMemo(
    () =>
      muscleLoadPrograms.map((program) => ({
        label:
          typeof program?.program_name === "string" &&
          program.program_name.trim() !== ""
            ? program.program_name.trim()
            : `Program ${program.program_id}`,
        value: program.program_id,
      })),
    [muscleLoadPrograms]
  );

  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const primarySoft = "rgba(247, 116, 46, 0.16)";
  const primaryRowSurface = "rgba(247, 116, 46, 0.09)";
  const secondarySoft = "rgba(96, 218, 172, 0.22)";
  const backgroundColor = theme.background ?? "#0e0f12";
  const cardSurface = theme.cardBackground ?? backgroundColor;
  const panelSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const invertedText = theme.cardBackground ?? theme.textInverted ?? "#1b1918";

  const updateSelectedProgramId = useCallback((programId) => {
    selectedProgramIdRef.current = programId;
    setSelectedProgramId(programId);
  }, []);

  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const nextSummaries =
        await weightliftingService.getPersonalRecordExerciseSummaries(db);
      setSummaries(nextSummaries);

      if (selectedExerciseName) {
        const nextDetail =
          await weightliftingService.getPersonalRecordExerciseDetail(
            db,
            selectedExerciseName
          );
        setSelectedDetail(nextDetail);
      }
    } catch (error) {
      console.error("Failed to load personal records:", error);
      setSummaries([]);
      setSelectedDetail(null);
    } finally {
      setLoading(false);
    }
  }, [db, selectedExerciseName]);

  const loadMuscleLoadData = useCallback(
    async (programId) => {
      if (!programId) {
        setMuscleLoad(null);
        setMuscleLoadLoading(false);
        return;
      }

      try {
        setMuscleLoadLoading(true);
        const nextMuscleLoad =
          await weightliftingService.getProgramWeeklyMuscleLoad(db, programId);

        setMuscleLoad(nextMuscleLoad);
      } catch (error) {
        console.error("Failed to load program muscle load:", error);
        setMuscleLoad(null);
      } finally {
        setMuscleLoadLoading(false);
      }
    },
    [db]
  );

  const loadMuscleLoadPrograms = useCallback(async () => {
    try {
      const nextPrograms = (await programService.getProgramOptions(db)).filter(
        (program) => Number.isFinite(Number(program?.program_id))
      );
      const selectedProgram =
        nextPrograms.find(
          (program) =>
            Number(program.program_id) ===
            Number(selectedProgramIdRef.current)
        ) ??
        nextPrograms[0] ??
        null;
      const nextSelectedProgramId = selectedProgram?.program_id ?? null;

      setMuscleLoadPrograms(nextPrograms);
      updateSelectedProgramId(nextSelectedProgramId);
      await loadMuscleLoadData(nextSelectedProgramId);
    } catch (error) {
      console.error("Failed to load program muscle load programs:", error);
      setMuscleLoadPrograms([]);
      updateSelectedProgramId(null);
      setMuscleLoad(null);
      setMuscleLoadLoading(false);
    }
  }, [db, loadMuscleLoadData, updateSelectedProgramId]);

  const openExerciseDetail = async (exerciseName) => {
    try {
      setDetailLoading(true);
      setSelectedExerciseName(exerciseName);

      const detail =
        await weightliftingService.getPersonalRecordExerciseDetail(
          db,
          exerciseName
        );
      setSelectedDetail(detail);
    } catch (error) {
      console.error("Failed to load personal record detail:", error);
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeExerciseDetail = () => {
    setSelectedExerciseName(null);
    setSelectedDetail(null);
  };

  const handleChangeMuscleLoadProgram = useCallback(
    (programId) => {
      updateSelectedProgramId(programId);
      loadMuscleLoadData(programId);
    },
    [loadMuscleLoadData, updateSelectedProgramId]
  );

  useFocusEffect(
    useCallback(() => {
      loadSummaries();
      loadMuscleLoadPrograms();
    }, [loadMuscleLoadPrograms, loadSummaries])
  );

  const renderMuscleLoadCard = () => {
    const points = muscleLoad?.points ?? [];
    const hasPrograms = muscleLoadProgramItems.length > 0;
    const chartGeometry = buildMuscleLoadRadarGeometry(points);
    const hasMuscleLoadData = !!muscleLoad?.hasData && !!chartGeometry;

    return (
      <View
        style={[
          styles.muscleLoadCard,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View style={styles.muscleLoadHeader}>
          <View style={styles.muscleLoadHeaderText}>
            <ThemedText style={styles.muscleLoadEyebrow} setColor={primaryColor}>
              PERSONAL RECORDS
            </ThemedText>
            <ThemedText style={styles.muscleLoadTitle} setColor={titleColor}>
              Weekly muscle load
            </ThemedText>
          </View>

          {hasPrograms && (
            <ThemedPicker
              value={selectedProgramId}
              items={muscleLoadProgramItems}
              onChange={handleChangeMuscleLoadProgram}
              placeholder="Program"
              title="Pick program"
              style={styles.muscleLoadPicker}
            />
          )}
        </View>

        <View
          style={[
            styles.muscleLoadChartFrame,
            {
              backgroundColor: cardSurface,
            },
          ]}
        >
          {muscleLoadLoading ? (
            <View style={styles.muscleLoadEmptyState}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : hasPrograms && hasMuscleLoadData ? (
            <Svg
              width="100%"
              height={MUSCLE_LOAD_CHART_HEIGHT}
              viewBox={`0 0 ${MUSCLE_LOAD_CHART_WIDTH} ${MUSCLE_LOAD_CHART_HEIGHT}`}
            >
              <Defs>
                <LinearGradient
                  id="personalRecordMuscleLoadFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor={primaryColor} stopOpacity="0.34" />
                  <Stop offset="1" stopColor={primaryColor} stopOpacity="0.14" />
                </LinearGradient>
              </Defs>

              {chartGeometry.axisLines.map((axisLine) => (
                <Line
                  key={`axis-${axisLine.key}`}
                  x1={MUSCLE_LOAD_CHART_CENTER.x}
                  y1={MUSCLE_LOAD_CHART_CENTER.y}
                  x2={axisLine.x}
                  y2={axisLine.y}
                  stroke={quietText}
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
              ))}

              {chartGeometry.gridPaths.map((path, index) => (
                <Path
                  key={`grid-${index}`}
                  d={path}
                  fill="none"
                  stroke={quietText}
                  strokeOpacity={
                    index === chartGeometry.gridPaths.length - 1 ? 0.24 : 0.13
                  }
                  strokeWidth={
                    index === chartGeometry.gridPaths.length - 1 ? 1.7 : 1
                  }
                />
              ))}

              {!!chartGeometry.dataPath && (
                <Path
                  d={chartGeometry.dataPath}
                  fill="url(#personalRecordMuscleLoadFill)"
                  stroke={primaryColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                />
              )}

              {chartGeometry.chartPoints.map((point) => (
                <G key={point.key}>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={point.isHighest ? 4.8 : 3.6}
                    fill={point.isHighest ? secondaryColor : primaryColor}
                    stroke={cardSurface}
                    strokeWidth={2}
                  />
                  <SvgText
                    x={point.labelX}
                    y={point.labelY + 4}
                    fill={quietText}
                    fontSize="9"
                    fontWeight="900"
                    textAnchor={point.textAnchor}
                  >
                    {point.label}
                  </SvgText>
                </G>
              ))}
            </Svg>
          ) : (
            <View style={styles.muscleLoadEmptyState}>
              <ThemedText style={styles.muscleLoadEmptyTitle} setColor={titleColor}>
                No muscle load yet
              </ThemedText>
              <ThemedText style={styles.muscleLoadEmptyText} setColor={quietText}>
                Program strength sets will appear here.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.muscleLoadMetaRow}>
          <View
            style={[
              styles.muscleLoadMetaItem,
              {
                backgroundColor: panelSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.muscleLoadMetaValue} setColor={titleColor}>
              {muscleLoad?.weekCount ?? 0}
            </ThemedText>
            <ThemedText style={styles.muscleLoadMetaLabel} setColor={quietText}>
              weeks
            </ThemedText>
          </View>

          <View
            style={[
              styles.muscleLoadMetaItem,
              {
                backgroundColor: panelSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.muscleLoadMetaValue} setColor={titleColor}>
              {muscleLoad?.scoredExerciseCount ?? 0}
            </ThemedText>
            <ThemedText style={styles.muscleLoadMetaLabel} setColor={quietText}>
              exercises
            </ThemedText>
          </View>

          <View
            style={[
              styles.muscleLoadMetaItem,
              {
                backgroundColor: panelSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.muscleLoadMetaValue} setColor={titleColor}>
              {hasMuscleLoadData ? "3:1" : "--"}
            </ThemedText>
            <ThemedText style={styles.muscleLoadMetaLabel} setColor={quietText}>
              points
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const renderExerciseList = () => (
    <View style={styles.exerciseList}>
      {loading && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
        </View>
      )}

      {!loading && summaries.length === 0 && (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.emptyStateTitle} setColor={titleColor}>
            No records yet
          </ThemedText>
          <ThemedText style={styles.emptyStateText} setColor={quietText}>
            Completed strength sets will appear here when they have weight and reps.
          </ThemedText>
        </View>
      )}

      {!loading &&
        summaries.map((summary) => (
          <TouchableOpacity
            key={summary.exerciseName}
            activeOpacity={0.88}
            onPress={() => openExerciseDetail(summary.exerciseName)}
            style={[
              styles.exerciseListItem,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.exerciseListIcon,
                { backgroundColor: primarySoft },
              ]}
            >
              <TradeUp
                width={21}
                height={21}
                stroke={primaryColor}
                color={primaryColor}
              />
            </View>

            <View style={styles.exerciseListText}>
              <ThemedText
                style={styles.exerciseListTitle}
                setColor={titleColor}
                numberOfLines={1}
              >
                {summary.exerciseName}
              </ThemedText>
              <ThemedText style={styles.exerciseListMeta} setColor={quietText}>
                {summary.latestRecordRelativeDateLabel
                  ? `Last PR ${summary.latestRecordDateDisplay} - ${summary.latestRecordRelativeDateLabel}`
                  : `Last PR ${summary.latestRecordDateDisplay}`}
              </ThemedText>
            </View>

            <View style={styles.exerciseListStats}>
              <ThemedText style={styles.exerciseListStatValue} setColor={titleColor}>
                {summary.setCount}
              </ThemedText>
              <ThemedText style={styles.exerciseListStatLabel} setColor={quietText}>
                sets
              </ThemedText>
            </View>
          </TouchableOpacity>
        ))}
    </View>
  );

  const renderRecordDetail = () => {
    const detail = selectedDetail;
    const visibleRecordRows =
      detail && hideEmptyRepRanges
        ? detail.rows.filter((row) => row.hasRecord)
        : detail?.rows ?? [];

    if (detailLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
        </View>
      );
    }

    if (!detail) {
      return (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.emptyStateTitle} setColor={titleColor}>
            No records found
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={closeExerciseDetail}
            style={[styles.backToListButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.backToListText} setColor={primaryColor}>
              All records
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const renderOneRepMaxTrend = () => {
      const trend = detail.oneRepMaxTrend;
      const chartGeometry = buildTrendChartGeometry(trend?.points ?? []);
      const hasTrend = !!chartGeometry;
      const bestPoint = trend?.bestPoint ?? null;
      const latestPoint = trend?.latestPoint ?? null;

      return (
        <View
          style={[
            styles.trendCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.trendHeader}>
            <View style={styles.trendHeaderText}>
              <ThemedText style={styles.trendEyebrow} setColor={primaryColor}>
                ESTIMATED 1RM
              </ThemedText>
              <ThemedText style={styles.trendTitle} setColor={titleColor}>
                Progression
              </ThemedText>
            </View>

            <View
              style={[
                styles.trendCountPill,
                {
                  backgroundColor: primarySoft,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ThemedText style={styles.trendCountValue} setColor={primaryColor}>
                {trend?.pointCount ?? 0}
              </ThemedText>
              <ThemedText style={styles.trendCountLabel} setColor={quietText}>
                workouts
              </ThemedText>
            </View>
          </View>

          <View style={styles.trendMetrics}>
            <View style={styles.trendMetric}>
              <ThemedText style={styles.trendMetricLabel} setColor={quietText}>
                BEST
              </ThemedText>
              <ThemedText style={styles.trendMetricValue} setColor={titleColor}>
                {bestPoint?.estimatedOneRepMaxDisplay ?? "--"}
              </ThemedText>
              <ThemedText
                style={styles.trendMetricSubvalue}
                setColor={quietText}
                numberOfLines={1}
              >
                {bestPoint?.setDisplay ?? "No set"}
              </ThemedText>
            </View>

            <View style={styles.trendMetric}>
              <ThemedText style={styles.trendMetricLabel} setColor={quietText}>
                LATEST
              </ThemedText>
              <ThemedText style={styles.trendMetricValue} setColor={titleColor}>
                {latestPoint?.estimatedOneRepMaxDisplay ?? "--"}
              </ThemedText>
              <ThemedText
                style={styles.trendMetricSubvalue}
                setColor={quietText}
                numberOfLines={1}
              >
                {latestPoint?.dateDisplay ?? "No workout"}
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.trendChartFrame,
              {
                backgroundColor: panelSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            {hasTrend ? (
              <Svg
                width="100%"
                height={TREND_CHART_HEIGHT}
                viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`}
              >
                <Defs>
                  <LinearGradient
                    id="personalRecordTrendFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop
                      offset="0"
                      stopColor={primaryColor}
                      stopOpacity="0.26"
                    />
                    <Stop
                      offset="1"
                      stopColor={primaryColor}
                      stopOpacity="0.01"
                    />
                  </LinearGradient>
                </Defs>

                {chartGeometry.gridLines.map((line, index) => (
                  <G key={`grid-${index}`}>
                    <Line
                      x1={TREND_CHART_PADDING.left}
                      y1={line.y}
                      x2={TREND_CHART_WIDTH - TREND_CHART_PADDING.right}
                      y2={line.y}
                      stroke={quietText}
                      strokeOpacity={index === 2 ? 0.22 : 0.12}
                      strokeWidth={1}
                    />
                    <SvgText
                      x={TREND_CHART_PADDING.left - 8}
                      y={line.y + 3}
                      fill={quietText}
                      fontSize="9"
                      fontWeight="800"
                      textAnchor="end"
                    >
                      {line.label}
                    </SvgText>
                  </G>
                ))}

                {chartGeometry.areaPath && (
                  <Path
                    d={chartGeometry.areaPath}
                    fill="url(#personalRecordTrendFill)"
                  />
                )}

                {chartGeometry.singlePointLine && (
                  <Line
                    x1={chartGeometry.singlePointLine.x1}
                    y1={chartGeometry.singlePointLine.y}
                    x2={chartGeometry.singlePointLine.x2}
                    y2={chartGeometry.singlePointLine.y}
                    stroke={primaryColor}
                    strokeLinecap="round"
                    strokeOpacity={0.82}
                    strokeWidth={3}
                  />
                )}

                {chartGeometry.chartPoints.length > 1 && (
                  <Path
                    d={chartGeometry.path}
                    fill="none"
                    stroke={primaryColor}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                  />
                )}

                {chartGeometry.chartPoints.map((point) => {
                  const isBestPoint = point.setId === bestPoint?.setId;

                  return (
                    <Circle
                      key={point.id}
                      cx={point.x}
                      cy={point.y}
                      r={chartGeometry.chartPoints.length > 24 ? 2.2 : 3.4}
                      fill={isBestPoint ? secondaryColor : primaryColor}
                      stroke={panelSurface}
                      strokeWidth={2}
                    />
                  );
                })}

                <SvgText
                  x={TREND_CHART_PADDING.left}
                  y={TREND_CHART_HEIGHT - 12}
                  fill={quietText}
                  fontSize="9"
                  fontWeight="800"
                  textAnchor="start"
                >
                  {chartGeometry.firstLabel}
                </SvgText>

                {chartGeometry.lastLabel && (
                  <SvgText
                    x={TREND_CHART_WIDTH - TREND_CHART_PADDING.right}
                    y={TREND_CHART_HEIGHT - 12}
                    fill={quietText}
                    fontSize="9"
                    fontWeight="800"
                    textAnchor="end"
                  >
                    {chartGeometry.lastLabel}
                  </SvgText>
                )}
              </Svg>
            ) : (
              <View style={styles.trendEmptyState}>
                <ThemedText style={styles.trendEmptyTitle} setColor={titleColor}>
                  No trend yet
                </ThemedText>
                <ThemedText style={styles.trendEmptyText} setColor={quietText}>
                  Complete weighted sets to build your progression.
                </ThemedText>
              </View>
            )}
          </View>

          {!!latestPoint && (
            <View style={styles.trendFooter}>
              <ThemedText style={styles.trendFooterLabel} setColor={quietText}>
                LATEST SET
              </ThemedText>
              <ThemedText
                style={styles.trendFooterValue}
                setColor={titleColor}
                numberOfLines={1}
              >
                {latestPoint.setDisplay} - {latestPoint.dateDisplay}
              </ThemedText>
            </View>
          )}
        </View>
      );
    };

    return (
      <View>
        <View style={styles.recordToolbar}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={closeExerciseDetail}
            style={[styles.backToListButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.backToListText} setColor={primaryColor}>
              All records
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setHideEmptyRepRanges((current) => !current)}
            style={[
              styles.recordFilterButton,
              {
                backgroundColor: hideEmptyRepRanges ? primaryColor : cardSurface,
                borderColor: hideEmptyRepRanges ? primaryColor : cardBorder,
              },
            ]}
          >
            <ThemedText
              style={styles.recordFilterText}
              setColor={hideEmptyRepRanges ? invertedText : quietText}
              numberOfLines={1}
            >
              {hideEmptyRepRanges ? "Show all" : "Hide empty"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.recordCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.recordCardAccent, { backgroundColor: primaryColor }]}
          />

          <View style={styles.recordCardHeader}>
            <View
              style={[
                styles.recordIconTile,
                { backgroundColor: primarySoft },
              ]}
            >
              <TradeUp
                width={25}
                height={25}
                stroke={primaryColor}
                color={primaryColor}
              />
            </View>

            <View style={styles.recordHeaderText}>
              <ThemedText style={styles.recordEyebrow} setColor={primaryColor}>
                PERSONAL RECORDS
              </ThemedText>
              <ThemedTitle
                type="h3"
                style={[styles.recordTitle, { color: titleColor }]}
                numberOfLines={1}
              >
                {detail.exerciseName}
              </ThemedTitle>
            </View>
          </View>

          <View style={[styles.tableHeader, { backgroundColor: backgroundColor }]}>
            <ThemedText style={styles.tableHeaderText} setColor={quietText}>
              REPS
            </ThemedText>
            <ThemedText
              style={[styles.tableHeaderText, styles.tableHeaderWeight]}
              setColor={quietText}
            >
              WEIGHT
            </ThemedText>
            <ThemedText
              style={[styles.tableHeaderText, styles.tableHeaderDate]}
              setColor={quietText}
            >
              DATE
            </ThemedText>
          </View>

          {visibleRecordRows.map((row) => (
            <View
              key={row.reps}
              style={[
                styles.recordRow,
                {
                  borderTopColor: cardBorder,
                  backgroundColor:
                    row.isNew && row.hasRecord
                      ? primaryRowSurface
                      : cardSurface,
                },
              ]}
            >
              {row.isNew && row.hasRecord && (
                <View
                  pointerEvents="none"
                  style={[styles.recordRowAccent, { backgroundColor: primaryColor }]}
                />
              )}

              <View
                style={[
                  styles.repsBadge,
                  {
                    backgroundColor: panelSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <ThemedText style={styles.repsBadgeText} setColor={titleColor}>
                  {row.reps}
                </ThemedText>
              </View>

              <View style={styles.recordWeightCell}>
                <View style={styles.recordWeightLine}>
                  <ThemedText
                    style={[
                      styles.recordWeightValue,
                      !row.hasRecord && styles.mutedRecordValue,
                    ]}
                    setColor={row.hasRecord ? titleColor : quietText}
                  >
                    {row.weightDisplay}
                  </ThemedText>
                  {row.hasRecord && (
                    <ThemedText style={styles.recordWeightUnit} setColor={quietText}>
                      KG
                    </ThemedText>
                  )}
                  {!!row.gainDisplay && (
                    <View
                      style={[
                        styles.gainBadge,
                        { backgroundColor: secondarySoft },
                      ]}
                    >
                      <ThemedText style={styles.gainBadgeText} setColor={secondaryColor}>
                        {row.gainDisplay}
                      </ThemedText>
                    </View>
                  )}
                  {row.isNew && row.hasRecord && (
                    <View
                      style={[
                        styles.newBadge,
                        { backgroundColor: primarySoft },
                      ]}
                    >
                      <ThemedText style={styles.newBadgeText} setColor={primaryColor}>
                        NEW
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={[styles.progressTrack, { backgroundColor: panelSurface }]}>
                  {row.hasRecord && (
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${row.progressPercent}%`,
                          backgroundColor: row.isNew ? primaryColor : quietText,
                        },
                      ]}
                    />
                  )}
                </View>
              </View>

              <View style={styles.recordDateCell}>
                <View style={styles.recordDateLine}>
                  {row.hasRecord && (
                    <Calender
                      width={13}
                      height={13}
                      color={quietText}
                      thickness={1.7}
                    />
                  )}
                  <ThemedText
                    style={[
                      styles.recordDateText,
                      !row.hasRecord && styles.mutedRecordValue,
                    ]}
                    setColor={row.hasRecord ? titleColor : quietText}
                    numberOfLines={1}
                  >
                    {row.hasRecord ? row.dateDisplay : "No set"}
                  </ThemedText>
                </View>
                {!!row.relativeDateLabel && (
                  <ThemedText style={styles.recordRelativeDate} setColor={quietText}>
                    {row.relativeDateLabel}
                  </ThemedText>
                )}
              </View>
            </View>
          ))}
        </View>

        {renderOneRepMaxTrend()}
      </View>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={10} style={styles.pageHeaderTitleEyebrow} setColor={quietText}>
            Library
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Personal Records
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!selectedExerciseName && renderMuscleLoadCard()}
        {selectedExerciseName ? renderRecordDetail() : renderExerciseList()}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default PersonalRecordsPage;
