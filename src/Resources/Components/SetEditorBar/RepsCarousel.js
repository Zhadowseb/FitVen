import { useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";

import ThemedText from "../../ThemedComponents/ThemedText";
import { repsCarouselNumbers, repsFromSwipe } from "@utils/repsCarousel";

// The carousel in the bar over the keyboard while the reps of a set are
// edited: the number before, the number now and the number after - 7 · 8 · 9 -
// which can be swiped. Each number passed is one rep, and onChange is called
// with the new count; the set list shows it at once and saves it once the
// swiping has stopped. Typing in the field above still works, and the carousel
// shows what is typed.
//
// It claims a gesture only when it is more sideways than up and down.

// How far a finger moves for one rep.
export const REPS_SWIPE_STEP_PX = 28;
const BOX_WIDTH = 176;
const BOX_HEIGHT = 32;

export default function RepsCarousel({
  value,
  onChange,
  suffix = "",
  suffixColor,
  borderColor,
  textColor,
  quietColor,
  accessibilityLabel,
  onActivate,
}) {
  const numbers = repsCarouselNumbers(value);
  const valueRef = useRef(numbers.current);
  const onChangeRef = useRef(onChange);
  const slide = useRef(new Animated.Value(0)).current;
  const dragRef = useRef({ startValue: 0 });

  valueRef.current = numbers.current;
  onChangeRef.current = onChange;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragRef.current.startValue = valueRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const { reps, offset } = repsFromSwipe(
            dragRef.current.startValue,
            gesture.dx,
            REPS_SWIPE_STEP_PX
          );

          slide.setValue(offset);

          if (reps !== valueRef.current) {
            onChangeRef.current?.(reps);
          }
        },
        onPanResponderRelease: () => {
          Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
      }),
    []
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: numbers.current }}
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
      style={[styles.box, { borderColor }]}
    >
      <Animated.View style={[styles.row, { transform: [{ translateX: slide }] }]}>
        <ThemedText style={[styles.neighbour, styles.before]} setColor={quietColor}>
          {numbers.before ?? ""}
        </ThemedText>
        <View style={styles.centre}>
          <ThemedText style={styles.current} setColor={textColor}>
            {numbers.current}
          </ThemedText>
          {suffix ? (
            <ThemedText style={styles.suffix} setColor={suffixColor ?? quietColor}>
              {suffix}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText style={[styles.neighbour, styles.after]} setColor={quietColor}>
          {numbers.after}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  centre: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  current: {
    fontSize: 20,
    fontWeight: "900",
  },
  suffix: {
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 1,
  },
  neighbour: {
    fontSize: 15,
    fontWeight: "600",
    opacity: 0.5,
    // No blur on text in React Native: smaller and fainter stands in for it.
    transform: [{ scale: 0.85 }],
    minWidth: 18,
  },
  before: {
    textAlign: "left",
  },
  after: {
    textAlign: "right",
  },
});
