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
      strokeLinejoin="round"
      {...props}
    >
      <Path d="M12 22a7.5 7.5 0 007.5-7.5c0-1 0-3-2-5.5 0 0-.1 2.854-2.074 2.44-3.193-.667.93-6.937-4.926-9.44 0 5-6 6.5-6 12.5A7.5 7.5 0 0012 22z" />
      <Path d="M12 19.001c1.933 0 3.5-2.015 3.5-4.5-3.2 1.2-4.333-1.563-4.5-3.501-1.446.553-2.5 2.826-2.5 4 0 2.485 1.567 4.001 3.5 4.001z" />
    </Svg>
  )
}

export default SvgComponent
