import * as React from "react"
import Svg, { G, Path } from "react-native-svg"
import {useColorScheme} from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function SvgComponent({width, height, color}) {

  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light

  return (
    <Svg
      width={width}
      height={height}
      viewBox="-0.16 -0.16 16.32 16.32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="#000"
      strokeWidth={0.00016}
    >
      <G fill={color ? color : theme.primary}>
        <Path d="M8 12a2 2 0 110 4 2 2 0 010-4zM8 6a2 2 0 110 4 2 2 0 010-4zM10 2a2 2 0 10-4 0 2 2 0 004 0z" />
      </G>
    </Svg>
  )
}

export default SvgComponent

