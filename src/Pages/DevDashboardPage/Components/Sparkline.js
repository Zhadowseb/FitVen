import { useState } from "react";
import { View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";

import styles from "./SparklineStyle";

// Room for half the stroke at the top and bottom, so a peak is not shaved off.
const INSET = 2;

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The points in pixels. The range covers the thresholds as well as the values,
 * so a dashed line is always inside the frame and the line reads against it.
 * A missing week keeps its place on the x axis and is simply skipped.
 */
function layout(values, thresholds, width, height) {
  const numbers = values.filter(isNumber);
  const levels = thresholds.map((line) => line.value).filter(isNumber);

  if (numbers.length === 0 && levels.length === 0) {
    return null;
  }

  let min = Math.min(...numbers, ...levels);
  let max = Math.max(...numbers, ...levels);

  if (max === min) {
    min -= 1;
    max += 1;
  }

  const usable = height - 2 * INSET;
  const y = (value) => INSET + (1 - (value - min) / (max - min)) * usable;
  const step = values.length > 1 ? (width - 2 * INSET) / (values.length - 1) : 0;
  const points = values
    .map((value, index) =>
      isNumber(value) ? `${(INSET + index * step).toFixed(1)},${y(value).toFixed(1)}` : null
    )
    .filter(Boolean);

  return {
    points: points.length > 1 ? points.join(" ") : null,
    lines: thresholds
      .filter((line) => isNumber(line.value))
      .map((line) => ({ key: `${line.value}`, y: y(line.value).toFixed(1), color: line.color })),
  };
}

/**
 * A line over the weeks, 28 high. Drawn at its measured width rather than
 * through a stretched viewBox, which would stretch the stroke with it.
 *
 * `thresholds` are `{ value, color }`, drawn dashed.
 */
export default function Sparkline({ values = [], color, thresholds = [], height = 28 }) {
  const [width, setWidth] = useState(0);
  const geometry = width > 0 ? layout(values, thresholds, width, height) : null;

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {geometry ? (
        <Svg width={width} height={height}>
          {geometry.lines.map((line) => (
            <Line
              key={line.key}
              x1={0}
              x2={width}
              y1={line.y}
              y2={line.y}
              stroke={line.color}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ))}

          {geometry.points ? (
            <Polyline
              points={geometry.points}
              fill="none"
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
