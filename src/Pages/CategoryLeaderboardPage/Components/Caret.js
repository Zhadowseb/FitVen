import Svg, { Path } from "react-native-svg";

// A filter pill's caret: the curve CustomExercisesPage's sort button uses,
// pointing down - "this opens a list".
export default function Caret({ color, size = 12 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 9s4.419 6 6 6c1.581 0 6-6 6-6" />
    </Svg>
  );
}
