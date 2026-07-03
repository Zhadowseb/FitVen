import * as React from "react"
import Svg, { Path } from "react-native-svg"

function SvgComponent(props) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      color="#da1212"
      fill="none"
      stroke="#da1212"
      strokeWidth={1.5}
      strokeLinecap="round"
      {...props}
    >
      <Path d="M5 20v-6M5 11V4M9 8h6M2 14h6M16 12h6M12 8V4M12 20v-9M19 12V4M19 20v-5" />
    </Svg>
  )
}

export default SvgComponent
