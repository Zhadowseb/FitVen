import { StyleSheet } from "react-native";

// Layout only. Every colour on the card comes from the theme in the
// component body (src/Pages/AGENTS.md); each layer file keeps its own few
// positions next to the drawing they belong to.
export default StyleSheet.create({
  card: {
    width: 104,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    // Everything drawn round the content is cut to the card's rounded shape.
    overflow: "hidden",
  },
  // The flame's 20 dp, whatever stands in it, so the number never moves when
  // a crown or a bolt takes the flame's place.
  iconSlot: {
    width: 44,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.1,
    lineHeight: 32,
    // Tabular, so 7 and 11 do not move the box between two days.
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
