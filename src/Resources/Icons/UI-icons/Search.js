import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";

function Search({ width = 24, height = 24, color, thickness = 1.8 }) {
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
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M16 16l4 4" />
    </Svg>
  );
}

export default Search;
