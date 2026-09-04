import { useRef } from "react";
import { View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

let glowInstanceCounter = 0;

const GLOW_WIDTH = 280;
const GLOW_HEIGHT = 230;
const STAR_SIZE = 120;

// Five-pointed star with rounded tips, drawn in its own 24-unit box.
const STAR_PATH =
  "M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3-5.6-3.2-5.6 3.2 1.3-6.3L3 9.2l6.4-.7z";

/**
 * Colored haze behind the post header, plus a large watermark star when the
 * workout set a record. Purely decorative - the parent clips it.
 */
export default function PostHeaderGlow({
  color,
  starColor = null,
  centerOpacity = 0.38,
  midOpacity = 0.1,
  starOpacity = 0.13,
}) {
  const gradientId = useRef(`post-glow-${++glowInstanceCounter}`).current;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0 }}>
      <Svg
        width={GLOW_WIDTH}
        height={GLOW_HEIGHT}
        style={{ position: "absolute", top: -80, right: -60 }}
      >
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={centerOpacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={midOpacity} />
            <Stop offset="78%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={GLOW_WIDTH}
          height={GLOW_HEIGHT}
          fill={`url(#${gradientId})`}
        />
      </Svg>

      {starColor ? (
        <Svg
          width={STAR_SIZE}
          height={STAR_SIZE}
          viewBox="0 0 24 24"
          opacity={starOpacity}
          style={{ position: "absolute", top: -22, right: 22 }}
        >
          <Path
            d={STAR_PATH}
            fill={starColor}
            stroke={starColor}
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
