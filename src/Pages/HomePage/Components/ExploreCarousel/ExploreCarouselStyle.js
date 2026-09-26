import { StyleSheet } from "react-native";

// Between two cards; the rail snaps to a card's width plus this.
export const RAIL_GAP = 9;

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  // The same head as Home's other blocks and Explore's rows.
  header: {
    marginTop: 18,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  action: { fontSize: 11.5, fontWeight: "800", lineHeight: 15 },

  railScroll: { marginTop: 9 },
  rail: { paddingHorizontal: 20, gap: RAIL_GAP },
  placeholders: { flexDirection: "row", gap: RAIL_GAP },
});
