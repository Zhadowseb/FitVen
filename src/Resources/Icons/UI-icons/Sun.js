import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

function Sun({ width = 24, height = 24, color, thickness = 1.7 }) {
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
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </Svg>
  );
}

export default Sun;
