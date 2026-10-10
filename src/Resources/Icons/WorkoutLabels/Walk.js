import * as React from "react"
import Svg, { Circle, Path } from "react-native-svg"
import {useColorScheme} from "react-native"
import { Colors } from "../../GlobalStyling/colors"

// A figure mid-stride. Takes the same props as Run, so a screen that draws a
// workout's icon can swap one for the other.
function Walk({width, height, primaryColor}) {

  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const color = primaryColor ? primaryColor : theme.primary

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={13} cy={4} r={1.8} fill={color} stroke="none" />
      <Path d="M12.5 7.5l-2 5.5 3.5 2.5 1 5.5" />
      <Path d="M10.5 13l-2 7.5" />
      <Path d="M12 8.5l-3 2-1.5 3M12.8 8.8l2 2.7 2.7 1" />
    </Svg>
  )
}

export default Walk
