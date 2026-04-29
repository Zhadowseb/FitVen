import * as React from "react"
import Svg, { Path } from "react-native-svg"
import {useColorScheme} from "react-native"
import { Colors } from "../../GlobalStyling/colors"

function Resistance({width, height, color}) {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light

  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      color={color ? color : theme.primary}
      fill="none"
      stroke={color ? color : theme.primary}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M7.734 13.732s.906-1.222 1.5-1.5c1.795-.84 2.16-1.206 3-3.001.279-.595 1.5-1.5 1.5-1.5m-3.5 8.502s1.222-.906 1.5-1.5c.84-1.796 1.206-2.16 3-3.001.595-.279 1.5-1.5 1.5-1.5M14.431 2.892a1.3 1.3 0 011.839-.003l4.811 4.798a1.3 1.3 0 01.003 1.84l-1.528 1.533a1.3 1.3 0 01-1.839.003l-4.812-4.798a1.3 1.3 0 01-.002-1.839l1.528-1.534zM4.414 12.902a1.3 1.3 0 011.838-.003l4.812 4.798a1.3 1.3 0 01.003 1.84L9.538 21.07a1.3 1.3 0 01-1.838.003l-4.812-4.798a1.3 1.3 0 01-.003-1.839l1.529-1.534zM17.938 3.453c1.882-2.468 5.202.387 2.605 2.576M3.378 17.977c-2.38 1.992.62 5.182 2.69 2.489" />
    </Svg>
  )
}

export default Resistance
