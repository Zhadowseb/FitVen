import { StyleSheet } from "react-native";

// Layout only. The fill, the shadow's colour and the ink come from the
// component body (src/Pages/AGENTS.md).
export default StyleSheet.create({
  // Fills everything under the eyebrow, so the block is exactly as tall as
  // the days-since counter beside it - the same as FirstWorkoutButton.
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    justifyContent: "space-between",
    gap: 10,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  source: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.5,
    fontWeight: "800",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 23,
  },
  meta: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  // Only a picture of a button: the whole card is what is pressed.
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // On top of QuickStartCardStyle's chevron: a little longer, 12 by 10, and
  // nudged right so the triangle looks centred in the circle.
  play: {
    borderLeftWidth: 12,
    marginLeft: 2,
  },
});
