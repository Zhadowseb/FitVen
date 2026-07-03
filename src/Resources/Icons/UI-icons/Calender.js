import * as React from "react"
import Svg, { Path } from "react-native-svg"
import { useColorScheme } from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function SvgComponent({width, height, color, thickness}) {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const iconColor = color ? color : theme.iconColor ?? "#141B34"

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color={iconColor}
      fill="none"
      stroke={iconColor}
      strokeWidth={thickness ? thickness : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M16 2v4M8 2v4M13 4h-2C7.229 4 5.343 4 4.172 5.172 3 6.343 3 8.229 3 12v2c0 3.771 0 5.657 1.172 6.828C5.343 22 7.229 22 11 22h2c3.771 0 5.657 0 6.828-1.172C21 19.657 21 17.771 21 14v-2c0-3.771 0-5.657-1.172-6.828C18.657 4 16.771 4 13 4zM3 10h18M11.995 14h.01m-.01 4h.01m3.986-4H16m-8 0h.009M8 18h.009" />
    </Svg>
  )
}

export default SvgComponent
