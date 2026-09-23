import { useMemo, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { withAlpha } from "../../GlobalStyling/colors";
import { useSheenAnimation } from "../animationHooks";
import { buildEmbers } from "@utils/tileMoodGeometry";
import TileGlow from "./TileGlow";

// One spark: a hot core inside a soft glow, climbing, drifting, shrinking
// and going out.
function Ember({ ember, theme, animate }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: ember.durationMs,
    gapMs: 0,
    headStartMs: ember.delayMs,
  });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -ember.rise] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, ember.drift] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 0.75, 0],
  });
  const glowSize = ember.size * 4;
  const core = ember.hot ? theme.fireCore : theme.fire;

  return (
    <Animated.View
      style={[
        styles.ember,
        {
          left: ember.x - glowSize / 2,
          bottom: ember.bottom,
          width: glowSize,
          height: glowSize,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: glowSize / 2, backgroundColor: withAlpha(theme.fire, 0.22) },
        ]}
      />
      <View
        style={{
          width: ember.size,
          height: ember.size,
          borderRadius: ember.size / 2,
          backgroundColor: core,
        }}
      />
    </Animated.View>
  );
}

/**
 * The tile of somebody training right now, on a fire: a warm glow welling up
 * from the bottom and flickering, and sparks rising off it through the tile.
 * The flames round the avatar are drawn with the avatar.
 *
 * Behind the text and outside the layout; still off screen and under reduced
 * motion, when only the glow is left.
 */
export default function EmberFrame({ theme, seed = 0, animate = false }) {
  const [width, setWidth] = useState(0);
  const embers = useMemo(() => (width > 0 ? buildEmbers({ width, seed }) : []), [seed, width]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);

        setWidth((current) => (current === next ? current : next));
      }}
    >
      <TileGlow
        inner={theme.fireCore}
        outer={theme.fire}
        periodMs={1300 + (seed % 3) * 150}
        low={0.62}
        animate={animate}
      />

      {animate
        ? embers.map((ember, index) => (
            <Ember key={index} ember={ember} theme={theme} animate={animate} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ember: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
