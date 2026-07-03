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
      {...props}
    >
      <Path d="M12 22a5 5 0 003-9V5c0-.932 0-1.398-.152-1.766a2 2 0 00-1.082-1.082C13.4 2 12.932 2 12 2s-1.399 0-1.766.152a2 2 0 00-1.082 1.082C9 3.602 9 4.068 9 5v8a5 5 0 003 9z" />
      <Path d="M12 15a2 2 0 100 4 2 2 0 000-4zm0 0V8" strokeLinecap="round" />
    </Svg>
  );
}

export default SvgComponent;
