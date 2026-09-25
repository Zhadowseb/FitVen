import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A video camera struck through: "no video", where a clip would otherwise be.
function CameraOff({ width = 24, height = 24, color, thickness = 1.6 }) {
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
      <Path d="M15.5 10.2l4.1-2.6c.6-.4 1.4.1 1.4.8v7.2c0 .7-.8 1.2-1.4.8l-4.1-2.6" />
      <Path d="M8.2 6H12.5c1.66 0 3 1.34 3 3v4.3M15.1 17.1c-.5.56-1.23.9-2.6.9H6c-1.66 0-3-1.34-3-3V9c0-1.37.6-2.2 1.5-2.6" />
      <Path d="M3 3l18 18" />
    </Svg>
  );
}

export default CameraOff;
