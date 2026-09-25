import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  header: { paddingBottom: 14, gap: 2 },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 25 },
  rows: { gap: 8 },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14.5, fontWeight: "800", lineHeight: 19 },
  rowDetail: { fontSize: 11.5, fontWeight: "600", lineHeight: 15 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
