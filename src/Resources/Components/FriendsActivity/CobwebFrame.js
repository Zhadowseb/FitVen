import { useMemo, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { useBreathAnimation, useSheenAnimation } from "../animationHooks";
import { buildCobwebGeometry } from "@utils/cobwebGeometry";

function TileSvg({ geometry, children }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      {children}
    </Svg>
  );
}

/**
 * One corner web, swaying a degree or two on the draught, pivoting on the
 * corner it hangs from.
 */
function Web({ web, geometry, silk, animate, periodMs }) {
  const breath = useBreathAnimation(animate, { periodMs, low: 0 });
  const rotate = breath.interpolate({ inputRange: [0, 1], outputRange: ["-1.6deg", "1.2deg"] });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: [web.anchor[0], web.anchor[1], 0], transform: [{ rotate }] },
      ]}
    >
      <TileSvg geometry={geometry}>
        {web.sheets ? <Path d={web.sheets} fill={silk} fillOpacity={0.07} /> : null}
        {/* A faint halo, so the threads read as silk catching light rather
            than as pencil lines. */}
        <Path d={`${web.spokes} ${web.rings}`} stroke={silk} strokeOpacity={0.1} strokeWidth={1.8} fill="none" />
        <Path d={web.spokes} stroke={silk} strokeOpacity={0.5} strokeWidth={0.55} strokeLinecap="round" fill="none" />
        <Path d={web.rings} stroke={silk} strokeOpacity={0.42} strokeWidth={0.42} strokeLinecap="round" fill="none" />
        {web.doubled ? <Path d={web.doubled} stroke={silk} strokeOpacity={0.22} strokeWidth={0.35} fill="none" /> : null}
        {web.loose ? <Path d={web.loose} stroke={silk} strokeOpacity={0.4} strokeWidth={0.4} fill="none" /> : null}
      </TileSvg>
    </Animated.View>
  );
}

// Eight legs, bent at the knee, round a small body.
function spiderLegs(x, y) {
  const legs = [];

  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 4; leg += 1) {
      const angle = ((-50 + leg * 33) * Math.PI) / 180;
      const knee = [x + side * Math.cos(angle) * 3.4, y + Math.sin(angle) * 2.6 - 1.4];
      const foot = [x + side * Math.cos(angle) * 6.2, y + Math.sin(angle) * 4.6 + 2.2];

      legs.push(`M ${x} ${y} L ${knee[0]} ${knee[1]} L ${foot[0]} ${foot[1]}`);
    }
  }

  return legs.join(" ");
}

const SPIDER_BOX = 16;
const THREAD_ABOVE = 90;

/**
 * The spider: lets itself down on its thread, hangs there, and climbs back
 * up, swinging a little as it goes. The thread runs up past the top of the
 * tile, which crops it.
 */
function Spider({ spider, silk, body, animate, seed }) {
  const climb = useBreathAnimation(animate, { periodMs: 9000 + (seed % 3) * 1200, low: 0 });
  const swing = useBreathAnimation(animate, { periodMs: 2600, low: 0 });
  const translateY = climb.interpolate({
    inputRange: [0, 1],
    outputRange: [spider.maxDrop, spider.restDrop],
  });
  const rotate = swing.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "4deg"] });
  const centre = SPIDER_BOX / 2;

  return (
    <Animated.View
      style={[
        styles.spider,
        {
          left: spider.x - centre,
          top: -THREAD_ABOVE,
          height: THREAD_ABOVE + SPIDER_BOX,
          transformOrigin: [centre, 0, 0],
          transform: [{ translateY }, { rotate }],
        },
      ]}
    >
      <Svg width={SPIDER_BOX} height={THREAD_ABOVE + SPIDER_BOX}>
        <Path d={`M ${centre} 0 L ${centre} ${THREAD_ABOVE + 4}`} stroke={silk} strokeOpacity={0.5} strokeWidth={0.4} />
        <G transform={`translate(0 ${THREAD_ABOVE})`}>
          <Path
            d={spiderLegs(centre, 7)}
            stroke={body}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Ellipse cx={centre} cy={7.6} rx={2.4} ry={2.9} fill={body} stroke={silk} strokeOpacity={0.3} strokeWidth={0.4} />
          <Circle cx={centre} cy={4.4} r={1.5} fill={body} stroke={silk} strokeOpacity={0.3} strokeWidth={0.4} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function Dust({ speck, height, color, animate }) {
  const progress = useSheenAnimation(animate, {
    sweepMs: speck.durationMs,
    gapMs: 0,
    headStartMs: speck.delayMs,
    linear: true,
  });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-4, height + 4] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, speck.drift] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.55, 0.55, 0],
  });

  return (
    <Animated.View
      style={[
        styles.dust,
        {
          left: speck.x,
          width: speck.size * 2,
          height: speck.size * 2,
          borderRadius: speck.size,
          backgroundColor: color,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  );
}

/**
 * The tile of somebody who has not trained in a month, left to gather
 * cobwebs: old webs in the top corners and the bottom right - never the
 * bottom left, where the status line starts - a loose thread across the top,
 * a spider on a line of silk, and dust drifting down.
 *
 * It moves while the strip is on screen and motion is allowed: the webs sway
 * on their corners, the spider lets itself down and climbs back up, and the
 * dust falls. Drawn behind the tile's text and outside the layout.
 */
export default function CobwebFrame({ theme, seed = 0, animate = false, cornerRadius = 20 }) {
  const [size, setSize] = useState(null);
  const silk = theme.cobweb;
  const geometry = useMemo(
    () => (size ? buildCobwebGeometry({ ...size, seed, cornerRadius }) : null),
    [cornerRadius, seed, size]
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
      {geometry ? (
        <>
          <TileSvg geometry={geometry}>
            <Path d={geometry.strand} stroke={silk} strokeOpacity={0.32} strokeWidth={0.42} fill="none" />
          </TileSvg>

          {geometry.webs.map((web, index) => (
            <Web
              key={web.corner}
              web={web}
              geometry={geometry}
              silk={silk}
              animate={animate}
              periodMs={4200 + index * 900 + (seed % 3) * 300}
            />
          ))}

          {animate
            ? geometry.dust.map((speck, index) => (
                <Dust key={index} speck={speck} height={geometry.height} color={silk} animate={animate} />
              ))
            : null}

          <Spider spider={geometry.spider} silk={silk} body={theme.spider} animate={animate} seed={seed} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spider: {
    position: "absolute",
    width: SPIDER_BOX,
  },
  dust: {
    position: "absolute",
    top: 0,
  },
});
