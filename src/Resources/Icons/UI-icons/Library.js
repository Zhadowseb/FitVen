import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";

function Library({ width = 24, height = 24, color, thickness = 1.8 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.iconColor;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color={iconColor}
      fill="none"
      stroke={iconColor}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5.5 4.5h10.75A2.25 2.25 0 0 1 18.5 6.75V20H7.25A2.75 2.75 0 0 1 4.5 17.25V5.5a1 1 0 0 1 1-1Z" />
      <Path d="M7.25 16.5H18.5" />
      <Path d="M7.25 16.5a1.75 1.75 0 0 0 0 3.5" />
      <Path d="M8 8h7" />
      <Path d="M8 11h5" />
    </Svg>
  );
}

export default Library;
