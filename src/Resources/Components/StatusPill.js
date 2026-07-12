import { Animated, StyleSheet, Text, View } from "react-native";
import { useBlinkAnimation } from "./animationHooks";

// Small status pill from the redesign: optional dot + uppercase 10px/800 label
// on an alpha-tinted background (e.g. "IN PROGRESS", "3 LIVE", "ACTIVE").
function StatusPill({
  label,
  color,
  backgroundColor,
  dot = true,
  blinkDot = false,
  dotSize = 6,
  textStyle,
  style,
}) {
  const blinkOpacity = useBlinkAnimation(blinkDot);

  return (
    <View style={[styles.pill, { backgroundColor }, style]}>
      {dot ? (
        <Animated.View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              opacity: blinkDot ? blinkOpacity : 1,
            },
          ]}
        />
      ) : null}
      <Text style={[styles.label, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

export default StatusPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  dot: {},
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
