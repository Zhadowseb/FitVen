import * as React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A phone whose screen stays on. Off, the screen is an empty outline; on, it
// is lit - filled, with light coming off both sides - so the state reads
// without the colour. Not a sun: a sun beside a header reads as the theme
// switch.
function ScreenOn({ width = 24, height = 24, color, on = false, thickness = 1.7 }) {
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
      <Rect x="7" y="2.75" width="10" height="18.5" rx="2.25" />
      <Rect
        x="9.25"
        y="5.25"
        width="5.5"
        height="10.75"
        rx="0.75"
        fill={on ? iconColor : "none"}
        strokeWidth={on ? 0 : thickness * 0.7}
      />
      <Path d="M11 18.6h2" />
      {on ? (
        <Path d="M4.4 8.6 2.9 7.6M4.2 12H2.5M4.4 15.4l-1.5 1M19.6 8.6l1.5-1M19.8 12h1.7M19.6 15.4l1.5 1" />
      ) : null}
    </Svg>
  );
}

export default ScreenOn;
