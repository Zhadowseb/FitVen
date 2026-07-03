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
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <Circle cx={5} cy={18.9668} r={3} />
      <Path d="M11.5 6.967h-2c-1.933 0-3.5 1.343-3.5 3s1.567 3 3.5 3h3c1.933 0 3.5 1.343 3.5 3s-1.567 3-3.5 3H11M18.25 2.033c-2.071 0-3.75 1.628-3.75 3.637 0 1.148.469 2.04 1.406 2.838.661.562 1.863 1.768 2.344 2.525.505-.742 1.683-1.963 2.344-2.525C21.53 7.711 22 6.818 22 5.67c0-2.009-1.679-3.637-3.75-3.637z" />
      <Path d="M18.385 5.533h-.125m.25 0a.25.25 0 11-.5 0 .25.25 0 01.5 0z" />
    </Svg>
  )
}

export default SvgComponent
