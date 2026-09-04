import { StyleSheet } from "react-native";

export default StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", gap: 4.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  cellsRow: { width: "100%", flexDirection: "row", gap: 4, marginTop: 4 },
  cell: { flex: 1, minWidth: 0, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 2, alignItems: "center", justifyContent: "center" },
  weight: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  reps: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  struck: { textDecorationLine: "line-through" },
  compactRow: { width: "100%", flexDirection: "row", marginTop: 4, borderRadius: 10, overflow: "hidden" },
  compactCell: { flex: 1, minWidth: 0, paddingVertical: 5, paddingHorizontal: 2, alignItems: "center", borderRightWidth: 1 },
  inline: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  classicRow: { width: "100%", flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6, marginTop: 5 },
  classicSetGroup: { flexDirection: "row", alignItems: "center" },
  classicSetBubble: { height: 37, paddingHorizontal: 11, borderWidth: 1, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  classicReps: { lineHeight: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  classicSeparator: { lineHeight: 16, marginHorizontal: 4, fontWeight: "800" },
  classicWeight: { lineHeight: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
  classicUnit: { lineHeight: 12, marginTop: 2, marginLeft: 3, fontWeight: "700" },
  classicConnector: { width: 10, height: 1 },
});
