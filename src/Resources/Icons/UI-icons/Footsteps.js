import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// Two footprints, for steps. Takes the same props as the other UI icons.
function Footsteps({ width = 24, height = 24, color, thickness = 2 }) {
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
      <Path d="M8 3c2 0 3 2 3 4.5S10 12 8 12 5 10 5 7.5 6 3 8 3zM9 15h-2.5a1.5 1.5 0 0 0 0 3H9v-3zM16 9c2 0 3 2 3 4.5S18 18 16 18s-3-2-3-4.5S14 9 16 9z" />
    </Svg>
  );
}

export default Footsteps;
