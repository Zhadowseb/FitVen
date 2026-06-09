import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";

function Bell({ width = 24, height = 24, color, thickness = 1.5 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const strokeColor = color ?? theme.iconColor;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke={strokeColor}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 8.9c0-3.1-2.4-5.4-6-5.4s-6 2.3-6 5.4c0 6-2.1 6.8-2.1 8.1h16.2C20.1 15.7 18 14.9 18 8.9z" />
      <Path d="M9.8 20.2c.4.8 1.2 1.3 2.2 1.3s1.8-.5 2.2-1.3" />
    </Svg>
  );
}

export default Bell;
