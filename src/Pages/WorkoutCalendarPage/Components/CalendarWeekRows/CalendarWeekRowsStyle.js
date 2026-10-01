import { StyleSheet } from "react-native";

// Layout only; the colours come from the grid palette at render time.
export default StyleSheet.create({
  weekRow: {
    paddingTop: 5,
  },

  outsideMonth: {
    opacity: 0.32,
  },

  weekdayText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase",
    paddingBottom: 2,
  },
});
