import { StyleSheet } from "react-native";

// Layout only: the colour of each type comes from setTypeColor() in the
// component, the same one the set list paints its badges with.
export default StyleSheet.create({
  stack: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    gap: 2,
  },
  stackPart: { height: 12 },

  legend: { gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
  legendCount: {
    minWidth: 36,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  legendShare: {
    minWidth: 44,
    textAlign: "right",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
