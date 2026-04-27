import * as React from "react";
import { useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Colors } from "../../GlobalStyling/colors";

function Library({ width = 24, height = 24, color, thickness = 1.5, ...props }) {
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
      strokeLinecap="square"
      {...props}
    >
      <Path d="M16.263 10.5H7.737c-2.581 0-3.872 0-4.466.853-.593.852-.152 2.073.73 4.514l1.084 3c.46 1.273.69 1.91 1.204 2.271.513.362 1.186.362 2.532.362h6.358c1.346 0 2.019 0 2.532-.362.514-.362.744-.998 1.204-2.271l1.084-3c.882-2.441 1.323-3.662.73-4.514-.594-.853-1.885-.853-4.466-.853zM19 8c0-.466 0-.699-.076-.883a1 1 0 00-.541-.54c-.184-.077-.417-.077-.883-.077h-11c-.466 0-.699 0-.883.076a1 1 0 00-.54.541C5 7.301 5 7.534 5 8M16.5 4c0-.466 0-.699-.076-.883a1 1 0 00-.541-.54C15.699 2.5 15.466 2.5 15 2.5H9c-.466 0-.699 0-.883.076a1 1 0 00-.54.541C7.5 3.301 7.5 3.534 7.5 4" />
    </Svg>
  );
}

export default Library;
