import { useRef } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

let gradientInstanceCounter = 0;

// Vertical fade laid over a cover image so it melts into the card below.
// `color` must be a hex color (the card surface); stops mirror the handoff
// recipe: linear-gradient(180deg, color@0.1 0%, color@0.4 45%, color@1 100%).
function CoverGradient({
  color,
  stops = [
    { offset: "0%", opacity: 0.1 },
    { offset: "45%", opacity: 0.4 },
    { offset: "100%", opacity: 1 },
  ],
  style,
}) {
  // Ids are global in the SVG runtime; keep them unique per mounted instance.
  const gradientId = useRef(
    `cover-gradient-${++gradientInstanceCounter}`
  ).current;

  return (
    <Svg
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {stops.map((stop, index) => (
            <Stop
              key={index}
              offset={stop.offset}
              stopColor={color}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

export default CoverGradient;
