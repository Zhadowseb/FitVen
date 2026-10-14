import { useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";

import ThemedText from "@resources/ThemedComponents/ThemedText";
import { repsCarouselNumbers, repsFromSwipe } from "@utils/repsCarousel";

// The small carousel over the reps of the set being edited: the number before,
// the number now and the number after - 7 · 8 · 9 - which can be swiped. Each
// number passed is one rep, and onChange is called with the new count; the
// set list shows it at once and saves it once the swiping has stopped.
//
// The real field - the cell under this - is what is typed in; this shows what
// it holds. It claims a gesture only when it is more sideways than up and
// down, so the table still scrolls under a finger that starts on it.

// How far a finger moves for one rep.
export const REPS_SWIPE_STEP_PX = 28;
const BOX_WIDTH = 94;
const MIN_BOX_WIDTH = 66;
const BOX_HEIGHT = 32;

export default function RepsCarousel({
  value,
  width = 0,
  onChange,
  suffix = "",
  suffixColor,
  surface,
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
      style={[
        styles.box,
        {
          width: Math.min(BOX_WIDTH, Math.max(width, MIN_BOX_WIDTH)),
          backgroundColor: surface,
          borderColor,
        },
      ]}
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
    position: "absolute",
    alignSelf: "center",
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
    justifyContent: "center",
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 9,
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
    minWidth: 14,
  },
  before: {
    textAlign: "left",
  },
  after: {
    textAlign: "right",
  },
});
