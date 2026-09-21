import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useColorScheme } from "react-native";
import { Colors } from "../../GlobalStyling/colors";

// A single quaver. Note.js already exists and is a notepad, so the music one
// carries its full name.
function MusicNote({ width = 24, height = 24, color, thickness = 2.2 }) {
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
      <Path d="M10 17.5V5.2l8-2.2v11.8" />
      <Circle cx="7" cy="17.5" r="3" />
      <Circle cx="15" cy="14.8" r="3" />
    </Svg>
  );
}

export default MusicNote;
