import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// Camera with a plus: attach a video to a lift.
function CameraPlus({ width = 24, height = 24, color, thickness = 2.2 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.iconColor;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke={iconColor}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 8.5a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M15.5 10.5l4-2.3v7.6l-4-2.3" />
      <Path d="M9.25 9.5v5M6.75 12h5" />
    </Svg>
  );
}

export default CameraPlus;
