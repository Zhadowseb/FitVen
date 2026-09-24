import { useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useSheenAnimation } from "../animationHooks";

let borderInstanceCounter = 0;

/**
 * A coloured edge round a friend tile, in its mood's colours.
 *
 * Drawn as a gradient behind the tile's content, which is inset by
 * TILE_BORDER_WIDTH (FriendsActivityStyle) so only a ring of it shows. With
 * `periodMs` the gradient turns, and the bright middle of it runs round the
 * edge as two highlights chasing each other - a rotation, so it goes through
 * the native driver and costs nothing on the JS thread. Without, it sits
 * still, on the diagonal.
 *
 * `stops` are [offset, colour, opacity] across the gradient.
 */
export default function TileBorder({ stops, periodMs = null, animate = false, radius = 20 }) {
  const gradientId = useRef(`tile-border-${++borderInstanceCounter}`).current;
  const [size, setSize] = useState(null);
  const turns = animate && periodMs !== null;
  const progress = useSheenAnimation(turns, { sweepMs: periodMs ?? 1000, gapMs: 0, linear: true });
  const rotate = turns
    ? progress.interpolate({ inputRange: [0, 1], outputRange: ["45deg", "405deg"] })
    : "45deg";
  // A square that covers the tile at every angle it turns through.
  const side = size ? Math.ceil(Math.hypot(size.width, size.height)) + 4 : 0;

  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;

        setSize((current) =>
          current?.width === width && current?.height === height ? current : { width, height }
        );
      }}
    >
      {size ? (
        <Animated.View
          style={{
            position: "absolute",
            width: side,
            height: side,
            left: (size.width - side) / 2,
            top: (size.height - side) / 2,
            transform: [{ rotate }],
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                {stops.map(([offset, color, opacity = 1]) => (
                  <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
