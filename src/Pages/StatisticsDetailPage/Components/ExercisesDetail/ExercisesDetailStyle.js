import { StyleSheet } from "react-native";

// Layout only: colours are applied inline from `theme` (src/Pages/AGENTS.md).
// The rows are the "Every exercise" list's from the old Records overview.
export default StyleSheet.create({
  listCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 6 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  exerciseCopy: { flex: 1, minWidth: 0, gap: 2 },
  exerciseName: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  caption: { fontSize: 11, lineHeight: 15 },
  directionPill: {
    width: 26,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  directionText: { fontSize: 13, fontWeight: "900", lineHeight: 16 },
});
