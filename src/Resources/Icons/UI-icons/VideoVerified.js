import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A camera with a tick inside: the lift has a video and the centre has
// confirmed it. Without the tick it is the plain camera used for "attach".
function VideoVerified({ width = 24, height = 24, color, thickness = 2.4, showCheck = true }) {
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
      <Path d="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <Path d="M16 10l4-2.5v9L16 14" />
      {showCheck ? <Path d="M7.5 12.5l2 2 3.5-4" /> : null}
    </Svg>
  );
}

export default VideoVerified;
