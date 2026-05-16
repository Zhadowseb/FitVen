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

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 0,
    paddingRight: 10,
  },

  setProgressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 1,
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

  exerciseTitle: {
    marginBottom: 0,
  },

  exerciseMeta: {
    lineHeight: 13,
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: 1,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },

  settingsActionButton: {
    marginLeft: 1,
  },

  floatingDragHandle: {
    position: "absolute",
    top: -0,
    right: -4,
    zIndex: 3,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  dragHandleActive: {
    opacity: 0.72,
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
    marginTop: 12,
    marginBottom: -4,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryRow: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryTextBlock: {
    flex: 1,
    paddingRight: 10,
    justifyContent: "center",
  },

  summaryChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },

  summaryChip: {
    minHeight: 26,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  summaryRepeatBadge: {
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

  summaryRepeatBadgeText: {
    fontWeight: "900",
    lineHeight: 10,
  },

  summaryChipText: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  summaryExpandButton: {
    width: 24,
    height: 28,
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  expandedSection: {
    marginTop: 10,
    marginHorizontal: -12,
    marginBottom: -12,
  },
});
