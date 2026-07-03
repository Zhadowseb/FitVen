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
      strokeLinejoin="round"
      {...props}
    >
      <Path d="M15 2h-5M4 13.5a8.5 8.5 0 0114.51-6.01m0 0A8.5 8.5 0 0112.5 22H3M18.51 7.49L20 6M8 19H3M6 16H3M12.5 13.5L16 10" />
    </Svg>
  )
}

export default SvgComponent
