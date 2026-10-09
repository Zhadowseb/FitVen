import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  // 1fr | 44 | 54, gap 8, padding 9/14
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  headRow: {
    alignItems: "center",
    borderBottomWidth: 1,
  },
  head: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  headName: {
    flex: 1,
    minWidth: 0,
  },
  headShare: {
    width: 44,
    textAlign: "right",
  },
  headCommits: {
    width: 54,
    textAlign: "right",
  },
  nameCell: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  shareCell: {
    width: 44,
    alignItems: "flex-end",
  },
  commitsCell: {
    width: 54,
    alignItems: "flex-end",
  },
  nameLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 6,
    rowGap: 4,
  },
  name: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
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
  number: {
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  sub: {
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  message: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 12,
    fontWeight: "700",
  },
  footerBlock: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 7,
    borderTopWidth: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  unmeasured: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  unmeasuredLead: {
    fontWeight: "800",
  },
});
