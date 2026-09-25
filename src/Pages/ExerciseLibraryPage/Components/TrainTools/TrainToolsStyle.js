import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  // What each tool draws under its number sits on the tile's floor, so the
  // two line up although one is taller than the other.
  foot: {
    marginTop: "auto",
  },

  // 1RM calculator: the exercise on the left, the set it came from on the right.
  setRow: {
    height: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  setValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  setEmpty: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  // Sick days: a cell a month, January first.
  monthGrid: {
    flexDirection: "row",
    height: 14,
    gap: 2.5,
  },
  month: {
    flex: 1,
    borderRadius: 4,
  },
  monthUpcoming: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  monthCurrent: {
    borderWidth: 1.5,
  },
});
