import * as React from "react"
import Svg, { Path } from "react-native-svg"
import {useColorScheme} from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function Delete({width, height, color}) {

  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const iconColor = color ?? theme.iconColor

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color="currentColor"
      fill="none"
      stroke={iconColor}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Path d="M19.5 5.5l-.402 6.506M4.5 5.5l.605 10.025c.154 2.567.232 3.85.874 4.774.317.456.726.842 1.2 1.131.671.41 1.502.533 2.821.57M20 15l-7 7m7 0l-7-7M3 5.5h18m-4.944 0l-.683-1.408c-.453-.936-.68-1.403-1.071-1.695a1.994 1.994 0 00-.275-.172C13.594 2 13.074 2 12.035 2c-1.066 0-1.599 0-2.04.234a2 2 0 00-.278.18c-.395.303-.616.788-1.058 1.757L8.053 5.5" />
    </Svg>
  )
}

export default Delete
