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
      <Path d="M20 13V8h-5" />
      <Path d="M20 8l-5 5c-.883.883-1.324 1.324-1.865 1.373-.09.008-.18.008-.27 0-.541-.05-.982-.49-1.865-1.373s-1.324-1.324-1.865-1.373a1.493 1.493 0 00-.27 0c-.541.05-.982.49-1.865 1.373l-3 3" />
    </Svg>
  )
}

export default SvgComponent
