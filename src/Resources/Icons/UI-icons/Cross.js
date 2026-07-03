import * as React from "react"
import Svg, { Path } from "react-native-svg"
import {useColorScheme} from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function Cross({width, height, color}) {

  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const iconColor = color ?? theme.iconColor

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color={iconColor}
      fill="none"
      stroke={iconColor}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10 10-4.477 10-10zM15 15L9 9m0 6l6-6" />
    </Svg>
  )
}

export default Cross
