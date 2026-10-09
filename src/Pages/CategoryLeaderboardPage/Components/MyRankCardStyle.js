import { StyleSheet } from "react-native";

// Layout only. The row's measures match RankRow's, so your row reads as one
// more line of the list, lifted out of it.
export default StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  inner: {
    borderLeftWidth: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingLeft: 13,
    paddingRight: 16,
  },
  rank: {
    minWidth: 28,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
  // As on the list's rows: a word under the number, kg and % beside it.
  valueGroup: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  valueGroupInline: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  message: {
    paddingVertical: 12,
    paddingLeft: 13,
    paddingRight: 16,
    gap: 3,
  },
  messageTitle: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  messageDetail: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
});
