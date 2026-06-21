import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 18,
  },

  runLayout: {
    width: "92%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: 12,
  },

  runFlowShell: {
    marginBottom: 12,
  },

  runFlowHeader: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  runFlowEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  runFlowTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },

  runFlowGrid: {
    gap: 9,
  },

  runFlowCard: {
    minHeight: 108,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  runFlowCardCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  runFlowCardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },

  runFlowCardSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  runFlowImageFrame: {
    width: 88,
    height: 76,
    flexShrink: 0,
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  runFlowImage: {
    width: "100%",
    height: "100%",
  },

  runLoadingCard: {
    width: "100%",
    minHeight: 180,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    width: "100%",
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 14,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    borderRadius: 28,
    borderWidth: 1,
  },

  heroMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  heroMetricGroup: {
    flex: 1,
    minWidth: 0,
    height: 76,
    flexDirection: "row",
    alignItems: "center",
  },

  heroMetricCard: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  heroMetricHeader: {
    width: "100%",
    height: 20,
    marginBottom: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  heroMetricDivider: {
    width: 1,
    height: 54,
    opacity: 0.7,
  },

  heroMetricLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    textAlign: "center",
  },

  heroMetricValue: {
    width: "100%",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  heroMetricUnit: {
    marginTop: 2,
    height: 11,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  heroPrimaryButton: {
    flex: 1,
    minHeight: 66,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff7a2b",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },

  heroPlayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginRight: 13,
  },

  heroPauseSymbol: {
    width: 14,
    height: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    marginRight: 13,
  },

  heroPauseBar: {
    width: 5,
    height: "100%",
    borderRadius: 2,
  },

  heroPrimaryButtonText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },

  heroSecondaryButton: {
    width: 72,
    minHeight: 66,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroSecondaryButtonText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  sectionShell: {
    width: "100%",
    marginBottom: 14,
  },

  segmentCard: {
    width: "100%",
    minHeight: 68,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  segmentMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  segmentIconFrame: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  segmentTextBlock: {
    flex: 1,
    minWidth: 0,
  },

  segmentEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 5,
  },

  segmentSummaryText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },

  segmentActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  intervalsCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 22,
    paddingTop: 23,
    paddingBottom: 18,
    borderRadius: 28,
    borderWidth: 1,
  },

  intervalsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  intervalsTitleBlock: {
    flex: 1,
    minWidth: 0,
  },

  intervalsEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 3.4,
    marginBottom: 7,
  },

  intervalsTitle: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
  },

  intervalsSetCount: {
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  intervalsSummary: {
    marginTop: 15,
    marginBottom: 18,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
  },

  runTableShell: {
    width: "auto",
    marginHorizontal: -22,
    marginBottom: -18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    overflow: "visible",
  },

  emptyState: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
  },

  emptyStateText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  runTableHeaderRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },

  runTableHeaderCell: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  runTableHeaderLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  runTableHeaderUnit: {
    fontSize: 7,
    lineHeight: 8,
    fontWeight: "700",
    textAlign: "center",
  },

  runTableRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderLeftColor: "transparent",
    borderRightWidth: 1,
    borderRightColor: "transparent",
    paddingHorizontal: 8,
  },

  runTableRowActive: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },

  lastRunTableRow: {
    borderBottomWidth: 0,
  },

  runTableCell: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },

  runSetColumn: {
    width: "15%",
  },

  runDistanceColumn: {
    width: "18%",
  },

  runPaceColumn: {
    width: "19%",
  },

  runTimeColumn: {
    width: "18%",
  },

  runZoneColumn: {
    width: "20%",
  },

  runDoneColumn: {
    width: "10%",
  },

  setNumberBadge: {
    width: 28,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  setNumberText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  pauseIconBadge: {
    width: 28,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  pauseBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },

  activeTimeText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  zoneAnchor: {
    position: "relative",
    width: "100%",
    alignItems: "center",
  },

  zonePill: {
    minWidth: 36,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  zoneText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },

  zoneDropdownOverlay: {
    flex: 1,
  },

  zoneDropdownBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  zoneDropdownContainer: {
    position: "absolute",
    width: 238,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    elevation: 12,
    zIndex: 50,
  },

  zoneDropdownOption: {
    flex: 1,
    minWidth: 0,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  zoneDropdownClear: {
    borderWidth: 1,
  },

  zoneDropdownText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
  },

  doneButton: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  doneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  tableAddRow: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  valuePill: {
    width: "94%",
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  bottomsheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2eff",
    paddingBottom: 18,
    marginBottom: 18,
  },

  bottomsheetEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 5,
  },

  bottomsheetSetTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
  },

  bottomsheetEditGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  bottomsheetField: {
    flex: 1,
    minWidth: 0,
  },

  bottomsheetFieldLabel: {
    marginBottom: 7,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 2.1,
  },

  bottomsheetEditCell: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  zoneChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },

  zoneChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  zoneChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  bottomsheetActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  bottomsheetAction: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    gap: 8,
  },

  bottomsheetActionDanger: {
    backgroundColor: "transparent",
  },

  bottomsheetActionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
});
