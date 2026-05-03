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
      stroke="#141B34"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    > 
      <Path d="M9 6.65s6.938-.542 7.915.435c.977.977.435 7.915.435 7.915m-.85-7.5l-10 10" />
    </Svg>
  )
}

export default SvgComponent
