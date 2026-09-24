import { useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { useSheenAnimation } from "../animationHooks";
import { buildSteam } from "@utils/tileMoodGeometry";
import TileGlow from "./TileGlow";

let steamInstanceCounter = 0;

// One puff of mist: a soft round cloud, swelling as it rises and thinning
// out before the top. Round and blurred at every edge, so a handful of them
// overlapping reads as one flowing mist rather than as shapes.
function Puff({ puff, color, animate }) {
  const gradientId = useRef(`steam-puff-${++steamInstanceCounter}`).current;
  const progress = useSheenAnimation(animate, {
    sweepMs: puff.durationMs,
    gapMs: 0,
    headStartMs: puff.delayMs,
  });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -puff.rise] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, puff.drift] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.6] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.puff,
        {
          left: puff.x - puff.size / 2,
          top: puff.y - puff.size / 2,
          width: puff.size,
          height: puff.size,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.2} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.08} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The tile of somebody done for the day, still steaming: a mist lying along
 * the bottom and breathing, and soft puffs welling up out of it, swelling
 * and thinning as they rise.
 *
 * Behind the text and outside the layout. Off screen and under reduced
 * motion only the mist along the bottom stays.
 */
export default function SteamFrame({ theme, seed = 0, animate = false }) {
  const [size, setSize] = useState(null);
  const puffs = useMemo(() => (size ? buildSteam({ ...size, seed }) : []), [seed, size]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        const height = Math.round(event.nativeEvent.layout.height);

        setSize((current) =>
          current?.width === width && current?.height === height ? current : { width, height }
        );
      }}
    >
      <TileGlow
        inner={theme.steam}
        outer={theme.steam}
        strength={0.3}
        height={110}
        periodMs={3400 + (seed % 3) * 300}
        low={0.55}
        animate={animate}
      />

      {animate
        ? puffs.map((puff, index) => (
            <Puff key={index} puff={puff} color={theme.steam} animate={animate} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  puff: {
    position: "absolute",
  },
});
