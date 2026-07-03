import * as React from "react";
import { useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Colors } from "../../GlobalStyling/colors";

function UpwardGraf({ width = 24, height = 24, color, thickness = 1.5, ...props }) {
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
      <Path d="M2 21h20M4 18v-3M8 14V9M12 11V9M16 11V5M20 5V3" />
    </Svg>
  );
}

export default UpwardGraf;
