import * as React from "react"
import Svg, { Circle, Path } from "react-native-svg"

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
      {...props}
    >
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8v4l2 2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export default SvgComponent
