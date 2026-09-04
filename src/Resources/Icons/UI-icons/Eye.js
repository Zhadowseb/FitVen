import * as React from "react";
import Svg, { Path, Circle } from "react-native-svg";

export default function Eye({ width = 24, height = 24, color = "currentColor", thickness = 1.7 }) {
  return (
    <Svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2.5 12s3.3-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.3 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <Circle cx="12" cy="12" r="2.4" />
    </Svg>
  );
}
