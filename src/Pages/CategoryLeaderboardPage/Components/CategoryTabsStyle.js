import { StyleSheet } from "react-native";

// Layout only, and the same measures as GenderSegment: 3 apart inside 3 of
// padding, 34 high, radius 9 inside 12.
export default StyleSheet.create({
  control: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentIdle: {
    borderColor: "transparent",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  labelSelected: {
    fontWeight: "800",
  },
});
