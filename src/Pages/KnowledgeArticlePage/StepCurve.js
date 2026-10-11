import { View, useColorScheme } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { useTranslation } from "@localization";

import { Colors } from "../../Resources/GlobalStyling/colors";
import { STEP_BAR_TICKS, STEP_ZONES, getZoneBarSegments } from "../../Utils/stepZones";

// The curve of health benefit by daily steps (design: KnowledgeZones.dc.html):
// steep up to about 4,000, flattening after 7,000-10,000, with the five zones
// as a strip under it and their limits as ticks. The strip is drawn from the
// same zones the rest of the app uses.

const WIDTH = 310;
const HEIGHT = 132;

// The design's curve, as drawn.
const CURVE =
  "M0.0 104.0 L6.5 95.6 L12.9 87.9 L19.4 80.9 L25.8 74.6 L32.3 68.9 L38.8 63.7 L45.2 58.9 L51.7 54.6 L58.1 50.7 L64.6 47.2 L71.0 43.9 L77.5 41.0 L84.0 38.4 L90.4 35.9 L96.9 33.7 L103.3 31.8 L109.8 29.9 L116.2 28.3 L122.7 26.8 L129.2 25.4 L135.6 24.2 L142.1 23.1 L148.5 22.1 L155.0 21.2 L161.5 20.3 L167.9 19.6 L174.4 18.9 L180.8 18.2 L187.3 17.7 L193.8 17.1 L200.2 16.7 L206.7 16.2 L213.1 15.9 L219.6 15.5 L226.0 15.2 L232.5 14.9 L239.0 14.6 L245.4 14.4 L251.9 14.2 L258.3 14.0 L264.8 13.8 L271.2 13.6 L277.7 13.5 L284.2 13.3 L290.6 13.2 L297.1 13.1 L303.5 13.0 L310.0 12.9";

export default function StepCurve() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const segments = getZoneBarSegments(0, 0);
  let cursor = 0;
  const strip = STEP_ZONES.map((zone, index) => {
    const x = cursor;
    const width = segments[index].widthShare * WIDTH;

    cursor += width;

    return { zone, x, width };
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("knowledge.curve.a11y")}
    >
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Path d={CURVE} fill="none" stroke={theme.title} strokeWidth={2.5} strokeLinecap="round" />
        <SvgText x={0} y={10} fontSize={9.5} fontWeight="700" fill={theme.quietText}>
          {t("knowledge.curve.benefit")}
        </SvgText>

        {strip.map(({ zone, x, width }) => (
          <Rect key={zone.id} x={x} y={108} width={width} height={6} fill={theme.stepZones[zone.id]} />
        ))}

        {STEP_BAR_TICKS.map((tick) => (
          <SvgText
            key={tick.label}
            x={strip[tick.segment].x + strip[tick.segment].width}
            y={128}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight="700"
            fill={theme.quietText}
          >
            {tick.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
