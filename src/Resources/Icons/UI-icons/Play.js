import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A filled play triangle, for the "review this video" button.
function Play({ width = 24, height = 24, color }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.iconColor;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill={iconColor}
      stroke={iconColor}
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <Path d="M7.5 5.2v13.6a1 1 0 0 0 1.52.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8a1 1 0 0 0-1.52.86z" />
    </Svg>
  );
}

export default Play;
