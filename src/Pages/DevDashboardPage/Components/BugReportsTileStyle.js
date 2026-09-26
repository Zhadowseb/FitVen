import { StyleSheet } from "react-native";

export default StyleSheet.create({
  versions: {
    gap: 4,
    marginTop: 2,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  version: {
    width: 52,
    fontSize: 10,
    fontWeight: "700",
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  count: {
    minWidth: 14,
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  more: {
    fontSize: 10,
    fontWeight: "700",
  },
});
