import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../../Resources/GlobalStyling/colors";

// Page-local icon (not in shared UI-icons): horizontal three-dot ellipsis
// for the header overflow circle. Spec paths: M5 12h.01 M12 12h.01 M19 12h.01.
function DotsHorizontalIcon({ width = 18, height = 18, color, thickness = 2 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.text;

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
    >
      <Path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Svg>
  );
}

export default DotsHorizontalIcon;
