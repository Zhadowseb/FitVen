import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingLeft: 8,
    paddingRight: 20,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  field: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontWeight: "600", paddingVertical: 0 },
  scope: { paddingHorizontal: 20, paddingTop: 10 },

  hint: { marginTop: 18, fontSize: 13, fontWeight: "600", lineHeight: 18, textAlign: "center" },
  spinner: { marginTop: 18 },

  section: { marginTop: 20, gap: 9 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  list: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  thumb: { width: 36, height: 36, borderRadius: 10 },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  rowMeta: { fontSize: 11, fontWeight: "700", lineHeight: 15 },
  more: { borderTopWidth: 1, paddingVertical: 12, alignItems: "center" },
  moreText: { fontSize: 12.5, fontWeight: "800" },
});
