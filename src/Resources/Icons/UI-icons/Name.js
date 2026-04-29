import * as React from "react"
import Svg, { Path } from "react-native-svg"
import { useColorScheme } from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function Name({ width = 24, height = 24, color, thickness, ...props }) {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const strokeColor = color ?? theme.iconColor

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color={strokeColor}
      fill="none"
      stroke={strokeColor}
      strokeWidth={thickness ?? 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <Path d="M2 12c0-4.243 0-6.364 1.464-7.682C4.93 3 7.286 3 12 3c4.714 0 7.071 0 8.535 1.318C22 5.636 22 7.758 22 12c0 4.243 0 6.364-1.465 7.682C19.072 21 16.714 21 12 21s-7.071 0-8.536-1.318C2 18.364 2 16.242 2 12z" />
      <Path d="M5 16.5c1.208-2.581 5.712-2.75 7 0m-1.5-7a2 2 0 11-4 0 2 2 0 014 0zM15 10h4M15 14h4" />
    </Svg>
  )
}

export default Name
