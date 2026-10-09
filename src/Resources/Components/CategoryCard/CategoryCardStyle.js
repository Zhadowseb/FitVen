import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 19.5,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  description: {
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
  },
  chevron: {
    marginTop: 3,
  },
  topRow: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  topName: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
  topMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  topMeta: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  valueGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    flexShrink: 0,
  },
  topValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  topUnit: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  empty: {
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
  },
  emptyOnly: {
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginHorizontal: 16,
  },
  meRow: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  meLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meLabel: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  meRank: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "700",
  },
  meSpacer: {
    flex: 1,
  },
  meValueGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    flexShrink: 0,
  },
  meValue: {
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  meUnit: {
    fontSize: 11,
    fontWeight: "700",
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});
