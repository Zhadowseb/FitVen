import { useState } from "react";
import { View, useColorScheme } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";

import { Colors } from "../GlobalStyling/colors";

// Stacked bars of steps, one per day (or per week): the walked steps at the
// bottom in green, the steps training added stacked on top in orange, and a
// dashed line at the person's target with its name. Used on the Steps page.
//
// `bars` is [{ key, label, walked, training, highlight }]; a bar with no number
// (walked and training both null) is just its label - nothing is drawn for a
// day the phone said nothing about. The chart gets one summary label from its
// caller (`summary`); its parts are not read one by one.

const HEIGHT = 170;
const PLOT = 148; // bars and the target line live above the labels
const LABEL_Y = 166;
const MAX_BAR = 28;

export default function StepsBarChart({ bars, target, targetLabel, summary, targetColor }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [width, setWidth] = useState(0);

  const totals = bars.map((bar) => (bar.walked ?? 0) + (bar.training ?? 0));
  const maxValue = Math.max(target * 1.25, Math.max(0, ...totals) * 1.08, 1);
  const y = (value) => PLOT - (Math.min(value, maxValue) / maxValue) * PLOT;
  const step = width > 0 ? width / Math.max(1, bars.length) : 0;
  const barWidth = Math.min(MAX_BAR, step * 0.6);
  const green = theme.secondary ?? theme.primary;
  const accent = targetColor ?? green;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <Line
            x1={0}
            x2={width}
            y1={y(target)}
            y2={y(target)}
            stroke={accent}
            strokeWidth={1.2}
            strokeDasharray="4 4"
            opacity={0.7}
          />
          <SvgText
            x={width}
            y={y(target) - 5}
            textAnchor="end"
            fontSize={10}
            fontWeight="700"
            fill={accent}
          >
            {targetLabel}
          </SvgText>

          {bars.map((bar, index) => {
            const x = index * step + (step - barWidth) / 2;
            const walked = bar.walked ?? 0;
            const training = bar.training ?? 0;
            const hasBar = walked + training > 0;
            const top = y(walked + training);
            const walkedTop = y(walked);

            return (
              <G key={bar.key}>
                {hasBar && training > 0 ? (
                  <Rect x={x} y={top} width={barWidth} height={PLOT - top} rx={6} fill={theme.primary} />
                ) : null}
                {hasBar && walked > 0 ? (
                  <Rect
                    x={x}
                    y={walkedTop}
                    width={barWidth}
                    height={PLOT - walkedTop}
                    rx={6}
                    fill={green}
                  />
                ) : null}
                {hasBar && walked > 0 && training > 0 ? (
                  <Rect x={x} y={walkedTop} width={barWidth} height={1.5} fill={theme.cardBackground} />
                ) : null}
                <SvgText
                  x={x + barWidth / 2}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="800"
                  fill={bar.highlight ? theme.title : theme.quietText}
                >
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
    </View>
  );
}
