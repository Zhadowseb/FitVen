import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

function Star({ width = 24, height = 24, color, filled = true, thickness = 1.7 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.planned;

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill={filled ? iconColor : "none"}
      stroke={filled ? "none" : iconColor}
      strokeWidth={filled ? 0 : thickness}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 2l2.4 6.2 6.6.3-5.2 4.2 1.8 6.4L12 15.4 6.4 19.1l1.8-6.4L3 8.5l6.6-.3z" />
    </Svg>
  );
}

export default Star;
