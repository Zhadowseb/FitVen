import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A bookmark: put something on your list without taking it. Filled once it is.
function Bookmark({ width = 24, height = 24, color, filled = false, thickness = 1.7 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.iconColor;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill={filled ? iconColor : "none"}
      stroke={iconColor}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6.5 4.5c0-.83.67-1.5 1.5-1.5h8c.83 0 1.5.67 1.5 1.5v15.1c0 .4-.46.64-.79.4L12 16.5 7.29 20c-.33.24-.79 0-.79-.4V4.5z" />
    </Svg>
  );
}

export default Bookmark;
