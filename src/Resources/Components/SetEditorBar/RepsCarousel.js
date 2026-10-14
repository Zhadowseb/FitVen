import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";

import ThemedText from "../../ThemedComponents/ThemedText";
import { clampRepsDrag, repsCarouselItems, settleReps } from "@utils/repsCarousel";
import { setEditorBar } from "@utils/setEditorBar";

// The carousel in the bar over the keyboard while the reps of a set are
// edited: the number now in the middle and two on each side - 6 · 7 · 8 · 9 ·
// 10. While a finger is down the numbers follow it, smoothly, like scrolling a
// page; nothing snaps and nothing is saved. When the finger lets go the strip
// settles on the nearest number (a flick carries it a little further), and only
// then is onChange called with the new count. The set list shows it at once and
// saves it a moment later. Typing in the field above still works, and the
// carousel shows what is typed.
//
// It takes hold of the finger the moment it touches, anywhere in the middle of
// the toolbar and not only on the box: waiting for a sideways move of a few
// pixels, and for it to be clearly more sideways than up, let a thumb's slightly
// curved start slip past it. Nothing else in the toolbar's middle needs the
// touch.

// How far apart the numbers are, and so how far a finger goes for one rep.
export const REPS_ITEM_SPACING_PX = 44;
const SPREAD = 3;
const BOX_WIDTH = 232;
const BOX_HEIGHT = 34;
const ITEM_WIDTH = 40;

// The emphasis of a number follows how near the middle it is, as the strip
// moves: the one in the middle is biggest and brightest, the next two smaller
// and fainter. No blur on text in React Native: size and opacity stand in.
function emphasis(slide, offset) {
  const centre = -offset * REPS_ITEM_SPACING_PX;
  const step = REPS_ITEM_SPACING_PX;
  const inputRange = [centre - 2 * step, centre - step, centre, centre + step, centre + 2 * step];

  return {
    opacity: slide.interpolate({ inputRange, outputRange: [0.25, 0.5, 1, 0.5, 0.25], extrapolate: "clamp" }),
    scale: slide.interpolate({ inputRange, outputRange: [0.8, 0.9, 1.25, 0.9, 0.8], extrapolate: "clamp" }),
  };
}

export default function RepsCarousel({
  value,
  onChange,
  suffix = "",
  suffixColor,
  borderColor,
  textColor,
  accessibilityLabel,
  onActivate,
}) {
  const items = repsCarouselItems(value, SPREAD);
  const current = items[SPREAD].value;
  const valueRef = useRef(current);
  const onChangeRef = useRef(onChange);
  const slide = useRef(new Animated.Value(0)).current;
  const dragRef = useRef({ startValue: 0 });
  // A settle waiting for the new count to arrive: the strip stays where the
  // finger left it until the numbers are re-centred on it, then glides home.
  const pendingRef = useRef(null);

  valueRef.current = current;
  onChangeRef.current = onChange;

  const glideHome = () =>
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 3,
      speed: 14,
    }).start();

  useEffect(() => {
    const pending = pendingRef.current;

    if (pending && pending.reps === current) {
      pendingRef.current = null;
      clearTimeout(pending.timer);
      slide.setValue(pending.offset);
      glideHome();
    }
  }, [current]);

  useEffect(
    () => () => {
      clearTimeout(pendingRef.current?.timer);
      setEditorBar.setDragging(false);
    },
    []
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          slide.stopAnimation();
          setEditorBar.setDragging(true);
          clearTimeout(pendingRef.current?.timer);
          pendingRef.current = null;
          dragRef.current.startValue = valueRef.current;
        },
        // The strip follows the finger, and that is all: no snapping, no tap,
        // no change of the count until the finger lets go.
        onPanResponderMove: (_event, gesture) => {
          slide.setValue(clampRepsDrag(dragRef.current.startValue, gesture.dx, REPS_ITEM_SPACING_PX));
        },
        onPanResponderRelease: (_event, gesture) => {
          setEditorBar.setDragging(false);

          const { reps, offset } = settleReps(
            dragRef.current.startValue,
            gesture.dx,
            gesture.vx,
            REPS_ITEM_SPACING_PX
          );

          if (reps === dragRef.current.startValue) {
            glideHome();
            return;
          }

          // The strip stays where the finger left it until the new count has
          // come back and the numbers are drawn around it; then it glides the
          // rest of the way. If the count never comes back it goes home anyway.
          pendingRef.current = {
            reps,
            offset,
            timer: setTimeout(() => {
              pendingRef.current = null;
              glideHome();
            }, 400),
          };
          onChangeRef.current?.(reps);
        },
        onPanResponderTerminate: () => {
          setEditorBar.setDragging(false);
          glideHome();
        },
      }),
    []
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={styles.touchArea}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: current }}
      accessibilityActions={[
        { name: "increment" },
        { name: "decrement" },
        { name: "activate" },
      ]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;

        if (action === "increment") {
          onChangeRef.current?.(valueRef.current + 1);
        } else if (action === "decrement") {
          onChangeRef.current?.(Math.max(0, valueRef.current - 1));
        } else if (action === "activate") {
          onActivate?.();
        }
      }}
    >
      <View style={[styles.box, { borderColor }]} pointerEvents="none">
      <Animated.View style={[styles.strip, { transform: [{ translateX: slide }] }]}>
        {items.map((item) => {
          const { opacity, scale } = emphasis(slide, item.offset);
          const isCurrent = item.offset === 0;

          return (
            <Animated.View
              key={item.offset}
              style={[
                styles.item,
                {
                  left: BOX_WIDTH / 2 - ITEM_WIDTH / 2 + item.offset * REPS_ITEM_SPACING_PX,
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              <ThemedText style={styles.number} setColor={textColor}>
                {item.value ?? ""}
              </ThemedText>
              {isCurrent && suffix ? (
                <ThemedText style={styles.suffix} setColor={suffixColor ?? textColor}>
                  {suffix}
                </ThemedText>
              ) : null}
            </Animated.View>
          );
        })}
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The whole middle of the toolbar, so a thumb does not have to find the box.
  touchArea: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  strip: {
    ...StyleSheet.absoluteFillObject,
  },
  item: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: ITEM_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontSize: 17,
    fontWeight: "800",
  },
  suffix: {
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 1,
  },
});
