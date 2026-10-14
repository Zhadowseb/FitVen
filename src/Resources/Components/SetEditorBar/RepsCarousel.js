import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, Vibration, View } from "react-native";

import ThemedText from "../../ThemedComponents/ThemedText";
import {
  repsAsNumber,
  repsAtScroll,
  scrollPositionFor,
  settledReps,
  visibleRepsWindow,
} from "@utils/repsCarousel";
import { setEditorBar } from "@utils/setEditorBar";

// The carousel in the bar over the keyboard while the reps of a set are
// edited: the number now in the middle and two on each side - 6 · 7 · 8 · 9 ·
// 10 - on a strip that goes on as far as a finger does.
//
// While a finger is down the strip follows it freely, like scrolling a page.
// Every number that passes the middle is the count for as long as it is there:
// the cell shows it at once (onPreview) and the phone ticks once - nothing is
// saved yet, and none of it holds up the scroll: the numbers move on their own
// values, and what is handed to the screen is one small cell. Letting go
// settles the strip on the nearest number (a flick carries it further), and
// only then is onChange called with the count, to be saved. Typing in the field
// above still works, and the carousel follows what is typed.
//
// It takes hold of the finger the moment it touches, anywhere in the middle of
// the toolbar and not only on the box, and the page behind it does not scroll
// while a finger is on it (ThemedKeyboardProtection): only the sideways part of
// a drag moves the strip, so the finger can wander up and down the screen.

// How far apart the numbers are, and so how far a finger goes for one rep.
export const REPS_ITEM_SPACING_PX = 44;
// Numbers drawn on each side of the middle. Two show; the others are the buffer.
const SPREAD = 6;
const BOX_WIDTH = 232;
const BOX_HEIGHT = 34;
const ITEM_WIDTH = 40;
// One short tick for every number that becomes the count.
const TICK_MS = 8;

export default function RepsCarousel({
  value,
  onChange,
  onPreview,
  suffix = "",
  suffixColor,
  borderColor,
  textColor,
  accessibilityLabel,
  onActivate,
}) {
  const current = repsAsNumber(value);
  // The strip's position, in pixels: the reps n are in the middle at n * step.
  const scroll = useRef(new Animated.Value(current * REPS_ITEM_SPACING_PX)).current;
  // The number in the middle now, which is also where the drawn window is
  // centred. Changes while a finger drags; the strip itself does not wait for it.
  const [middle, setMiddle] = useState(current);
  const middleRef = useRef(current);
  const valueRef = useRef(current);
  const onChangeRef = useRef(onChange);
  const onPreviewRef = useRef(onPreview);
  const dragRef = useRef({ startReps: current, startScroll: current * REPS_ITEM_SPACING_PX });
  // Where the strip is, whoever moves it.
  const positionRef = useRef(current * REPS_ITEM_SPACING_PX);
  // True from the finger landing until the strip has settled and the count has
  // been handed over: ticks and previews belong to it, and the strip is not put
  // back to the saved count in the meantime.
  const activeRef = useRef(false);
  const itemStyleCache = useRef(new Map());

  valueRef.current = current;
  onChangeRef.current = onChange;
  onPreviewRef.current = onPreview;

  // Each number's own look: where it is, and how bright and big - biggest in the
  // middle, fainter towards the edges (no blur on text in React Native).
  const styleFor = (reps) => {
    const cached = itemStyleCache.current.get(reps);

    if (cached) {
      return cached;
    }

    const step = REPS_ITEM_SPACING_PX;
    const here = reps * step;
    const base = BOX_WIDTH / 2 - ITEM_WIDTH / 2 + here;
    const inputRange = [here - 2 * step, here - step, here, here + step, here + 2 * step];
    const made = {
      opacity: scroll.interpolate({ inputRange, outputRange: [0.25, 0.5, 1, 0.5, 0.25], extrapolate: "clamp" }),
      transform: [
        { translateX: scroll.interpolate({ inputRange: [0, 1], outputRange: [base, base - 1] }) },
        { scale: scroll.interpolate({ inputRange, outputRange: [0.8, 0.9, 1.25, 0.9, 0.8], extrapolate: "clamp" }) },
      ],
    };

    itemStyleCache.current.set(reps, made);

    return made;
  };

  // The number in the middle follows the strip, whoever moves it.
  useEffect(() => {
    const id = scroll.addListener(({ value: position }) => {
      positionRef.current = position;

      const reps = repsAtScroll(position, REPS_ITEM_SPACING_PX);

      if (reps === middleRef.current) {
        return;
      }

      middleRef.current = reps;
      setMiddle(reps);

      if (activeRef.current) {
        Vibration.vibrate(TICK_MS);
        onPreviewRef.current?.(reps);
      }
    });

    return () => scroll.removeListener(id);
  }, []);

  // The count changed from outside - typed, saved - while no finger is on the
  // strip: it goes there.
  useEffect(() => {
    if (!activeRef.current) {
      scroll.setValue(current * REPS_ITEM_SPACING_PX);
    }
  }, [current]);

  useEffect(
    () => () => {
      scroll.stopAnimation();
      setEditorBar.setDragging(false);
    },
    []
  );

  const settleOn = (reps, { commit }) => {
    const target = reps * REPS_ITEM_SPACING_PX;

    scroll.stopAnimation((position) => {
      const distance = Math.abs(target - position) / REPS_ITEM_SPACING_PX;

      Animated.timing(scroll, {
        toValue: target,
        duration: 140 + Math.min(distance, 12) * 28,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        activeRef.current = false;

        if (commit && reps !== dragRef.current.startReps) {
          onChangeRef.current?.(reps);
        }
      });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          setEditorBar.setDragging(true);
          activeRef.current = true;
          // The finger may land on a strip that is still gliding: the drag
          // takes it from where it is.
          scroll.stopAnimation();
          dragRef.current.startReps = valueRef.current;
          dragRef.current.startScroll = positionRef.current;
        },
        // The strip follows the finger and nothing else happens here: no render
        // of the page, no write.
        onPanResponderMove: (_event, gesture) => {
          scroll.setValue(
            scrollPositionFor(dragRef.current.startScroll, gesture.dx, REPS_ITEM_SPACING_PX)
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          setEditorBar.setDragging(false);

          const position = scrollPositionFor(dragRef.current.startScroll, gesture.dx, REPS_ITEM_SPACING_PX);

          settleOn(settledReps(position, gesture.vx, REPS_ITEM_SPACING_PX), { commit: true });
        },
        // Taken away: back to the count it had, and the cell with it.
        onPanResponderTerminate: () => {
          setEditorBar.setDragging(false);
          onPreviewRef.current?.(dragRef.current.startReps);
          settleOn(dragRef.current.startReps, { commit: false });
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
        {visibleRepsWindow(middle, SPREAD).map((reps) => (
          <Animated.View key={reps} style={[styles.item, styleFor(reps)]}>
            <ThemedText style={styles.number} setColor={textColor}>
              {reps}
            </ThemedText>
            {reps === middle && suffix ? (
              <ThemedText style={styles.suffix} setColor={suffixColor ?? textColor}>
                {suffix}
              </ThemedText>
            ) : null}
          </Animated.View>
        ))}
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
  item: {
    position: "absolute",
    left: 0,
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
