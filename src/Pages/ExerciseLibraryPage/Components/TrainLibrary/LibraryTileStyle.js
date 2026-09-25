import { StyleSheet } from "react-native";

export default StyleSheet.create({
  // Two to a row: the row decides the width, and minWidth lets the title
  // shrink instead of pushing the tile wider than its half.
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: "800",
  },
  // The tools: a smaller box, a tighter gap and a smaller title, so
  // "1RM calculator" stands whole at 375 pt.
  headerCompact: {
    gap: 7,
  },
  iconBoxCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  titleCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  addendum: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
