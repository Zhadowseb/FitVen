import * as React from "react"
import Svg, { Path } from "react-native-svg"
import { useColorScheme } from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function ReplayHistory({ width, height, color }) {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const iconColor = color ? color : theme.primary ?? "#f7742eff"

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width || 24}
      height={height || 24}
      color={iconColor}
      fill="none"
      stroke={iconColor}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C8.9587 2 6.2345 3.35767 4.4004 5.5" />
      <Path d="M4 2.5V6H7.5" />
      <Path d="M12 8V12L14 14" />
    </Svg>
  )
}

export default ReplayHistory
