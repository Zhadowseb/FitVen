import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  tag: {
    height: 20,
    maxWidth: "100%",
    borderRadius: 6,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  tagText: { flexShrink: 1, fontSize: 10.5, fontWeight: "800", lineHeight: 13 },
});
