import * as React from "react";
import { useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Colors } from "../../GlobalStyling/colors";

function Social({ width = 24, height = 24, color, thickness = 1.5, ...props }) {
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
      {...props}
    >
      <Path d="M15.5 11a3.5 3.5 0 10-7 0 3.5 3.5 0 007 0zM15.483 11.35a3.5 3.5 0 10-2.465-3.7M10.983 7.65a3.5 3.5 0 10-2.466 3.7M22 16.5c0-2.761-2.462-5-5.5-5" />
      <Path d="M17.5 19.5c0-2.761-2.462-5-5.5-5s-5.5 2.239-5.5 5M7.5 11.5c-3.038 0-5.5 2.239-5.5 5" />
    </Svg>
  );
}

export default Social;
