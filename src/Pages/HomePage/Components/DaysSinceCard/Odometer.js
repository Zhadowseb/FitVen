import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import styles from "./DaysSinceCardStyle";
import { ThemedText } from "@resources/ThemedComponents";
import {
  ODOMETER_LINE,
  ODOMETER_STRIP,
  odometerOpacity,
  odometerPosition,
  odometerStripOffset,
  planOdometer,
} from "@utils/daysSinceCard";

// One digit's column: a strip of 0-9 (and 0 again), clipped to one line,
// rolled to its digit.
function Column({ column, index, durationMs, entry, color }) {
  const style = useAnimatedStyle(() => {
    const elapsed = entry.value;
    const position = odometerPosition(column, index, elapsed, durationMs);

    return {
      opacity: odometerOpacity(column, index, elapsed),
      transform: [{ translateY: -odometerStripOffset(position) * ODOMETER_LINE }],
    };
  });

  return (
    <View style={odometerStyles.column}>
      <Animated.View style={style}>
        {ODOMETER_STRIP.map((digit, line) => (
          <ThemedText key={line} style={[styles.value, odometerStyles.line]} setColor={color}>
            {digit}
          </ThemedText>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * The day count, rolling in like an odometer: each digit a column that turns
 * to its number, 80 ms after the one before it - with an extra full turn on
 * the way in, a single step when the day ticks over at midnight, and down
 * from 3 to 0 on a day you trained. A column the number grows into fades in;
 * one it no longer needs fades out and is taken away once the roll is over.
 *
 * `from` is the number the card showed before, when it showed one. `entry`
 * is the card's clock held once the entrance is over, so a finished roll
 * costs nothing.
 */
export default function Odometer({ value, from = null, entry, animate, color }) {
  const plan = useMemo(() => planOdometer({ to: value, from }), [from, value]);
  const dropsColumn = plan.columns.some((column) => !column.shownAfter);
  const [settled, setSettled] = useState(!animate);

  useEffect(() => {
    if (!dropsColumn || settled) {
      return undefined;
    }

    if (!animate) {
      setSettled(true);
      return undefined;
    }

    const timer = setTimeout(() => setSettled(true), plan.totalMs + 30);

    return () => clearTimeout(timer);
  }, [animate, dropsColumn, plan.totalMs, settled]);

  return (
    <View
      style={odometerStyles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {plan.columns.map((column, index) =>
        column.shownAfter || !settled ? (
          <Column
            key={index}
            column={column}
            index={index}
            durationMs={plan.durationMs}
            entry={entry}
            color={color}
          />
        ) : null
      )}
    </View>
  );
}

const odometerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    height: ODOMETER_LINE,
  },
  // Clipped to one line. The clip reaches a little past each side, so the
  // tight letter spacing never shaves a digit's ink; the margins give that
  // room back to the layout.
  column: {
    height: ODOMETER_LINE,
    overflow: "hidden",
    paddingHorizontal: 3,
    marginHorizontal: -3,
  },
  line: {
    height: ODOMETER_LINE,
  },
});
