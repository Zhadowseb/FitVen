import * as React from "react";
import Svg, { Path } from "react-native-svg";

function SvgComponent({
  width = 24,
  height = 24,
  color = "#141B34",
  thickness = 1.5,
  ...props
}) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke={color}
      strokeWidth={thickness}
      strokeLinejoin="round"
      strokeLinecap="round"
      {...props}
    >
      <Path d="M5 22V3" />
      <Path d="M5 4.5c4-2 8 2 12 0v9c-4 2-8-2-12 0v-9z" />
    </Svg>
  );
}

export default SvgComponent;
