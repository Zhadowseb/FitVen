import { StyleSheet } from "react-native";

export default StyleSheet.create({
  exerciseCardFrame: {
    marginBottom: 8,
    marginHorizontal: 6,
    overflow: "visible",
    position: "relative",
  },

  exerciseCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: "hidden",
    position: "relative",
  },

  exerciseCardExpanded: {
    overflow: "visible",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  headerRowExpanded: {
    minHeight: 32,
    position: "relative",
    zIndex: 2,
  },

  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 0,
    paddingRight: 10,
  },

  headerMainExpanded: {
    paddingLeft: 38,
    paddingRight: 0,
  },

  setProgressClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 1,
    overflow: "hidden",
  },

  setProgressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    overflow: "hidden",
  },

  setProgressSegment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    height: "100%",
  },

  setProgressDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -1,
  },

  checkboxShell: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  checkbox: {
    marginLeft: 2,
  },

  titleBlock: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },

  titleBlockExpanded: {
    alignItems: "center",
    paddingRight: 0,
  },

  exerciseTitle: {
    fontSize: 19,
    lineHeight: 25,
    marginBottom: 0,
  },

  exerciseTitleExpanded: {
    width: "100%",
    textAlign: "center",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionsRowExpanded: {
    width: 38,
    minHeight: 32,
    justifyContent: "center",
  },

  actionButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },

  exerciseSetCount: {
    marginLeft: 8,
    fontWeight: "900",
  },

  historySection: {
    marginTop: 10,
  },

  historySummaryBar: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  historySummaryMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  historySummaryLabel: {
    marginLeft: 6,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  historySummaryValue: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    fontWeight: "800",
  },

  historySummaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },

  historySummaryDate: {
    marginLeft: 8,
    fontWeight: "700",
  },

  historyChevron: {
    marginLeft: 6,
  },

  historyChevronExpanded: {
    transform: [{ rotate: "180deg" }],
  },

  historyPanel: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  historySessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  historySessionRowLast: {
    marginBottom: 0,
  },

  historyDateColumn: {
    width: 78,
    paddingTop: 3,
  },

  historyRelativeDate: {
    fontWeight: "800",
  },

  historyDate: {
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  historySetChips: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  historySetChip: {
    minHeight: 26,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 5,
    marginBottom: 5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  historySetChipText: {
    fontWeight: "800",
  },

  historySetChipSeparator: {
    marginHorizontal: 4,
    fontWeight: "700",
    opacity: 0.48,
  },

  historySetChipCount: {
    position: "absolute",
    top: -7,
    right: -5,
    minWidth: 15,
    height: 15,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },

  historySetChipCountText: {
    fontWeight: "900",
    lineHeight: 10,
  },

  historyStateRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  historyStateText: {
    marginLeft: 8,
    fontWeight: "700",
  },

  historyEmptyText: {
    minHeight: 36,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "700",
  },

  summaryCollapsedRow: {
    marginTop: 8,
    marginBottom: -4,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },

  summaryRow: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
    justifyContent: "center",
  },

  summaryChipRow: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 8,
  },

  summarySetItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  summaryChip: {
    minHeight: 0,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  summarySetConnector: {
    width: 14,
    height: 1,
    position: "relative",
  },

  summarySetConnectorArrow: {
    position: "absolute",
    top: -3,
    right: -1,
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 5,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  summaryChipText: {
    fontWeight: "700",
  },

  summaryWeightText: {
    fontWeight: "800",
  },

  summaryUnitText: {
    marginLeft: 3,
    fontWeight: "600",
  },

  summaryExpandButton: {
    width: 24,
    height: 28,
    flexShrink: 0,
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  expandedSection: {
    marginTop: 10,
    marginHorizontal: -12,
    marginBottom: -12,
    overflow: "visible",
    position: "relative",
    zIndex: 1,
  },
});
