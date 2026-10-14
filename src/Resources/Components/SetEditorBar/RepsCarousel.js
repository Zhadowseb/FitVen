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
// Numbers drawn on each side of the middle. Two show; the others are the
// buffer. The window is only drawn again when the middle has moved RECENTRE
// numbers from its centre, not on every number: a render per number made the
// scroll laggy.
const SPREAD = 9;
const RECENTRE = 4;
// A flick that goes far draws everything it passes, up to this many numbers
// on each side, so it never runs over blank space waiting for a render.
const MAX_SPREAD = 40;
// Pixels per millisecond the strip goes on at after a flick: the further a
// finger was going the further it carries.
const GLIDE_PX_PER_MS = 2.2;
const BOX_WIDTH = 232;
const BOX_HEIGHT = 34;
const ITEM_WIDTH = 40;
// One short tick for every number that becomes the count - and not more often
// than this, or a fast flick buzzes instead of ticking.
const TICK_MS = 8;
const MIN_TICK_GAP_MS = 35;
const MIN_PREVIEW_GAP_MS = 30;

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
  // Where the drawn window is centred. It follows the strip in jumps, not number
  // by number; the strip itself, the emphasis and the ticks never wait for it.
  const [windowCentre, setWindowCentre] = useState(current);
  const [spread, setSpread] = useState(SPREAD);
  const windowCentreRef = useRef(current);
  // True while the strip glides after a flick: the drawn window has been made
  // wide for it and stays as it is until it has settled.
  const glidingRef = useRef(false);
  const lastPreviewRef = useRef(0);
  // The number in the middle now.
  const middleRef = useRef(current);
  // The count the suffix (an AMRAP target) belongs to: the saved one.
  const lastTickRef = useRef(0);
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

      // Only a render when the middle has come near the edge of what is drawn.
      if (!glidingRef.current && Math.abs(reps - windowCentreRef.current) >= RECENTRE) {
        windowCentreRef.current = reps;
        setWindowCentre(reps);
      }

      if (activeRef.current) {
        const now = Date.now();

        if (now - lastTickRef.current >= MIN_TICK_GAP_MS) {
          lastTickRef.current = now;
          Vibration.vibrate(TICK_MS);
        }

        // The cell keeps up with a flick without being asked for every
        // number: the last one is always shown when the strip has settled.
        if (now - lastPreviewRef.current >= MIN_PREVIEW_GAP_MS) {
          lastPreviewRef.current = now;
          onPreviewRef.current?.(reps);
        }
      }
    });

    return () => scroll.removeListener(id);
  }, []);

  // Put the strip on the phone's UI thread from the start: the numbers then
  // move there, with the finger, and a busy JS thread - a render of the cell, a
  // tick - cannot hold the scroll up. (A value only moves to the UI thread once
  // an animation with the native driver has run on it; this is a first, empty
  // one.)
  useEffect(() => {
    Animated.timing(scroll, {
      toValue: valueRef.current * REPS_ITEM_SPACING_PX,
      duration: 1,
      useNativeDriver: true,
    }).start();
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

  // Takes the strip from `position` (where the finger let go - known here, so
  // there is no asking the UI thread first) to `reps`. A far target gets a
  // wider drawn window for the glide, and a speed that starts about where the
  // finger left off and slows quickly, not a long tail.
  const settleOn = (reps, position, { commit }) => {
    const target = reps * REPS_ITEM_SPACING_PX;
    const distance = Math.abs(target - position) / REPS_ITEM_SPACING_PX;

    if (distance > RECENTRE) {
      const from = repsAtScroll(position, REPS_ITEM_SPACING_PX);
      const centre = Math.round((from + reps) / 2);

      glidingRef.current = true;
      windowCentreRef.current = centre;
      setWindowCentre(centre);
      setSpread(Math.min(MAX_SPREAD, Math.ceil(Math.abs(reps - from) / 2) + SPREAD));
    }

    Animated.timing(scroll, {
      toValue: target,
      duration: Math.round(120 + (distance * REPS_ITEM_SPACING_PX) / GLIDE_PX_PER_MS),
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      glidingRef.current = false;
      activeRef.current = false;
      windowCentreRef.current = reps;
      setWindowCentre(reps);
      setSpread(SPREAD);
      onPreviewRef.current?.(reps);

      if (commit && reps !== dragRef.current.startReps) {
        onChangeRef.current?.(reps);
      }
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
          glidingRef.current = false;
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

          settleOn(settledReps(position, gesture.vx, REPS_ITEM_SPACING_PX), position, { commit: true });
        },
        // Taken away: back to the count it had, and the cell with it.
        onPanResponderTerminate: () => {
          setEditorBar.setDragging(false);
          onPreviewRef.current?.(dragRef.current.startReps);
          settleOn(dragRef.current.startReps, positionRef.current, { commit: false });
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
        {visibleRepsWindow(windowCentre, spread).map((reps) => (
          <Animated.View key={reps} style={[styles.item, styleFor(reps)]}>
            <ThemedText style={styles.number} setColor={textColor}>
              {reps}
            </ThemedText>
            {reps === current && suffix ? (
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
