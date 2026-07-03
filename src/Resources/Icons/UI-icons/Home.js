import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";

function Home({ width = 24, height = 24, color, thickness = 1.8 }) {
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
      <Path d="M4 10.75 10.94 5.1a1.7 1.7 0 0 1 2.12 0L20 10.75" />
      <Path d="M6.25 9.75V19a1 1 0 0 0 1 1H10v-3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h2.75a1 1 0 0 0 1-1V9.75" />
    </Svg>
  );
}

export default Home;
