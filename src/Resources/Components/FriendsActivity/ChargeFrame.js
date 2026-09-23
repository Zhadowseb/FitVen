import { useMemo, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { withAlpha } from "../../GlobalStyling/colors";
import { useBreathAnimation } from "../animationHooks";
import { buildCharge } from "@utils/tileMoodGeometry";
import TileGlow from "./TileGlow";

// One mote of energy: a small bright core in a soft halo, wandering a slow
// loop - two breaths out of step, one sideways and one up and down - and
// glowing up and down on a third.
function Mote({ mote, theme, animate }) {
  const alongX = useBreathAnimation(animate, { periodMs: mote.periodXMs, low: 0 });
  const alongY = useBreathAnimation(animate, { periodMs: mote.periodYMs, low: 0 });
  const pulse = useBreathAnimation(animate, { periodMs: mote.pulseMs, low: 0.35 });
  const translateX = alongX.interpolate({
    inputRange: [0, 1],
    outputRange: [-mote.rangeX, mote.rangeX],
  });
  const translateY = alongY.interpolate({
    inputRange: [0, 1],
    outputRange: [mote.rangeY, -mote.rangeY],
  });
  const haloSize = mote.size * 6;

  return (
    <Animated.View
      style={[
        styles.mote,
        {
          left: mote.x - haloSize / 2,
          top: mote.y - haloSize / 2,
          width: haloSize,
          height: haloSize,
          opacity: pulse,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: haloSize / 2, backgroundColor: withAlpha(theme.charge, 0.12) },
        ]}
      />
      <View
        style={{
          width: mote.size * 2.4,
          height: mote.size * 2.4,
          borderRadius: mote.size * 1.2,
          backgroundColor: withAlpha(theme.charge, 0.35),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: mote.size,
            height: mote.size,
            borderRadius: mote.size / 2,
            backgroundColor: theme.chargeCore,
          }}
        />
      </View>
    </Animated.View>
  );
}

/**
 * The tile of somebody who trained in the last three days, with energy in
 * reserve: a cool glow resting along the bottom, breathing slowly, and a few
 * motes of light drifting lazily about the tile. Calm on purpose - it is
 * energy ready, not energy going off. The motes thin out as the days pass:
 * six the day after, two by the third day.
 *
 * Behind the text and outside the layout. Off screen and under reduced
 * motion the glow and the motes stay, still.
 */
export default function ChargeFrame({ theme, seed = 0, level = 3, animate = false }) {
  const [size, setSize] = useState(null);
  const geometry = useMemo(
    () => (size ? buildCharge({ ...size, seed, level }) : null),
    [level, seed, size]
  );

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
        inner={theme.chargeCore}
        outer={theme.charge}
        strength={0.42}
        height={100}
        periodMs={3600 + (seed % 3) * 400}
        low={0.5}
        animate={animate}
      />

      {geometry
        ? geometry.motes.map((mote, index) => (
            <Mote key={index} mote={mote} theme={theme} animate={animate} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mote: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
