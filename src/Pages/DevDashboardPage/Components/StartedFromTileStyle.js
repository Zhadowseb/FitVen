import { StyleSheet } from "react-native";

export default StyleSheet.create({
  list: {
    gap: 5,
    marginTop: 3,
    marginBottom: 2,
  },
  item: {
    gap: 3,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  itemLabel: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: "700",
  },
  itemShare: {
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  note: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
  },
});
