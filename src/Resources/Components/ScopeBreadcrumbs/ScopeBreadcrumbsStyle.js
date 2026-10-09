import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  // When the path is wider than the screen the last part - usually the long
  // centre name - gives way first and ellipsizes, and the parts before it only
  // after that, so the way back up stays readable.
  part: {
    flexShrink: 1,
    minWidth: 0,
  },
  lastPart: {
    flexShrink: 4,
    minWidth: 0,
  },
  chevron: {
    flexShrink: 0,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "800",
    lineHeight: 17,
  },
});
