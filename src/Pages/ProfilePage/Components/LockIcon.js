import * as React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../../Resources/GlobalStyling/colors";

// Page-local icon (not in shared UI-icons): small padlock used on the
// Username/Email rows. Spec: rect(4,11,16,10,rx2) + shackle path, sw 1.8.
function LockIcon({ width = 15, height = 15, color, thickness = 1.8 }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconColor = color ?? theme.quietText ?? theme.iconColor;

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
      <Rect x={4} y={11} width={16} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 018 0v4" />
    </Svg>
  );
}

export default LockIcon;
