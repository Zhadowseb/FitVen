import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 6 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 25 },
  reset: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: 12, fontWeight: "800" },

  section: { marginTop: 12, gap: 8 },
  sectionLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "800" },
});
