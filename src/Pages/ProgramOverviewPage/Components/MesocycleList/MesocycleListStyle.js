import { StyleSheet } from "react-native";

export default StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerCount: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCountText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  timeline: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  rail: {
    flexDirection: "column",
    alignItems: "center",
    width: 28,
    flexShrink: 0,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeNumber: {
    fontSize: 12,
    fontWeight: "800",
  },
  connector: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    overflow: "hidden",
  },
  blockStatusRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  statusPillNotStarted: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillNotStartedText: {
    fontSize: 11,
    fontWeight: "800",
  },
  activeStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  focusTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  weekBars: {
    flexDirection: "row",
    gap: 4,
  },
  weekBar: {
    width: 16,
    height: 6,
    borderRadius: 3,
  },
  progressGroup: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressCountText: {
    fontSize: 11,
    fontWeight: "700",
  },
  progressCountStrong: {
    fontWeight: "800",
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  footerText: {
    fontSize: 11,
    fontWeight: "700",
  },
  footerDateText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  addNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addWeekCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addWeekCopy: {
    flex: 1,
    gap: 1,
  },
  addWeekTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  addWeekSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  addCard: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addCopy: {
    flex: 1,
    gap: 1,
  },
  addTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  addSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
});
