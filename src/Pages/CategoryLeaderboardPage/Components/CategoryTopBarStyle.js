import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  // The list's own 20 at the sides; the header's gap below.
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 10,
  },
  // Level with the eyebrow and the title, not with the middle of a column
  // that grows with the explanation.
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  eyebrow: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  explanation: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
});
