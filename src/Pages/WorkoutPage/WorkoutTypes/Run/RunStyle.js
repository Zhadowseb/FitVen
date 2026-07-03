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

  runFlowTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },

  runFlowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  runFlowCard: {
    width: "48.5%",
    minHeight: 174,
    borderRadius: 20,
    borderWidth: 1,
    padding: 9,
    alignItems: "stretch",
    overflow: "hidden",
  },

  runFlowCardCopy: {
    flex: 1,
    minWidth: 0,
    marginTop: 8,
  },

  runFlowCardTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },

  runFlowCardSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },

  runFlowImageFrame: {
    width: "100%",
    height: 86,
    borderRadius: 15,
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

  runFocusTitleButton: {
    alignSelf: "center",
    maxWidth: "92%",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: -1,
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  runFocusTitle: {
    width: "100%",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "center",
  },

  speedTimerCountdown: {
    width: "100%",
    fontSize: 54,
    lineHeight: 61,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  activeTimerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTimerIconButtonPlaceholder: {
    width: 44,
    height: 44,
  },

  speedTimerPrimaryValue: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  speedTimerValueLine: {
    width: "100%",
    minHeight: 38,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },

  speedTimerUnitInline: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  activeRunDashboard: {
    width: "100%",
    marginBottom: 14,
    gap: 8,
  },

  enduranceDashboard: {
    width: "100%",
    marginBottom: 14,
    gap: 10,
  },

  customRunDashboard: {
    width: "100%",
    marginBottom: 14,
    gap: 10,
  },

  customRunMetricsCard: {
    width: "100%",
    minHeight: 112,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
  },

  customRunMetricsRow: {
    width: "100%",
    minHeight: 84,
    flexDirection: "row",
    alignItems: "stretch",
  },

  customRunActions: {
    minHeight: 76,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  customRunMetric: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },

  customRunMetricLabel: {
    minHeight: 20,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
  },

  customRunMetricValue: {
    width: "100%",
    marginTop: 4,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },

  customRunMetricMeta: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  customRunMetricDivider: {
    position: "absolute",
    top: 8,
    right: 0,
    bottom: 8,
    width: 1,
    opacity: 0.7,
  },

  customHeartRateCard: {
    width: "100%",
    minHeight: 230,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
  },

  customHeartRateHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  customHeartRateValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  customHeartRateUnit: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  customHeartRateZone: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  customHeartRateViewport: {
    position: "relative",
    width: "100%",
    height: 92,
    marginTop: 18,
    overflow: "hidden",
  },

  customHeartRateScrollView: {
    width: "100%",
    height: 92,
  },

  customHeartRateTrack: {
    position: "relative",
    height: 92,
  },

  customHeartRateCenterLine: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: "50%",
    width: 1,
    opacity: 0.35,
    zIndex: 2,
  },

  customHeartRateZoneBand: {
    position: "absolute",
    top: 18,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  customHeartRateZoneBandFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.2,
  },

  customHeartRateZoneBandText: {
    paddingHorizontal: 8,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  customHeartRateZoneBoundary: {
    position: "absolute",
    top: 12,
    width: 58,
    height: 74,
    marginLeft: -29,
    alignItems: "center",
  },

  customHeartRateZoneBoundaryLine: {
    width: 1,
    height: 54,
    opacity: 0.55,
  },

  customHeartRateZoneBoundaryText: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  customHeartRateCurrentDot: {
    position: "absolute",
    top: 34,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    zIndex: 3,
  },

  customHeartRateRecenterRow: {
    width: "100%",
    minHeight: 30,
    marginTop: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  customHeartRateRecenterButton: {
    minHeight: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  customHeartRateRecenterText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  customHeartRateScaleMeta: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  customHeartRateScaleText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  endurancePlanCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },

  endurancePlanControlHeader: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  endurancePlanStats: {
    minHeight: 94,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },

  endurancePlanStatsStandalone: {
    borderTopWidth: 0,
  },

  endurancePlanStat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  endurancePlanStatLabelRow: {
    minHeight: 18,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  endurancePlanStatLabel: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  endurancePlanStatValue: {
    width: "100%",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },

  endurancePlanStatMeta: {
    width: "100%",
    marginTop: 3,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  endurancePlanStatDivider: {
    width: 1,
    marginVertical: 16,
    opacity: 0.7,
  },

  enduranceRoutesCard: {
    width: "100%",
    minHeight: 104,
    marginHorizontal: 0,
    marginTop: 10,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  enduranceRoutesIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  enduranceRoutesCopy: {
    flex: 1,
    minWidth: 0,
  },

  enduranceRoutesEyebrow: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  enduranceRoutesTitle: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },

  enduranceRoutesDescription: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },

  enduranceRoutesBadge: {
    minHeight: 27,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  enduranceRoutesBadgeText: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  statPrioritySection: {
    width: "100%",
    marginTop: 10,
  },

  statPriorityCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },

  statPriorityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  statPriorityHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },

  statPriorityTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },

  statPriorityDescription: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },

  statPriorityList: {
    marginTop: 12,
    gap: 7,
  },

  statPriorityRow: {
    minHeight: 41,
    paddingLeft: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },

  statPriorityRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  statPriorityRankText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  statPriorityLabel: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  statPriorityDragHandle: {
    width: 46,
    minHeight: 41,
    alignItems: "center",
    justifyContent: "center",
  },

  enduranceProgressCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },

  enduranceProgressStats: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "stretch",
  },

  enduranceProgressStat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 5,
    justifyContent: "center",
  },

  enduranceProgressDivider: {
    width: 1,
    marginVertical: 9,
    opacity: 0.7,
  },

  enduranceProgressLabel: {
    minHeight: 22,
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
  },

  enduranceProgressValue: {
    width: "100%",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },

  enduranceProgressMeta: {
    width: "100%",
    marginTop: 3,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  enduranceProgressTrack: {
    width: "100%",
    height: 8,
    marginTop: 16,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(128, 128, 128, 0.22)",
  },

  enduranceProgressFill: {
    height: "100%",
    borderRadius: 4,
  },

  enduranceProgressPercent: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  enduranceActions: {
    width: "100%",
    minHeight: 64,
    paddingHorizontal: 26,
    paddingTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 42,
  },

  enduranceControl: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  enduranceControlLabel: {
    marginTop: 5,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },

  workoutPlanToggle: {
    width: "100%",
    minHeight: 52,
    marginBottom: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  workoutPlanToggleCopy: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  workoutPlanToggleTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  workoutPlanToggleAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  workoutPlanToggleLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  completedRunDashboard: {
    width: "100%",
    marginBottom: 4,
    gap: 10,
  },

  completedSummaryCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 0,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
  },

  completedDistanceRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 7,
  },

  completedDistanceValue: {
    maxWidth: "78%",
    fontSize: 58,
    lineHeight: 68,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  completedDistanceUnit: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },

  completedSummaryStats: {
    minHeight: 70,
    marginHorizontal: -18,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },

  completedSummaryStat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  completedSummaryStatLabelRow: {
    maxWidth: "100%",
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  completedSummaryStatLabel: {
    flexShrink: 1,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
  },

  completedSummaryStatValue: {
    width: "100%",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  completedSummaryStatDivider: {
    position: "absolute",
    top: 14,
    right: 0,
    bottom: 14,
    width: 1,
  },

  completionChartCard: {
    width: "100%",
    minHeight: 220,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
  },

  completionChartPressable: {
    width: "100%",
  },

  completionChartHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  completionChartHeading: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  completionChartIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  completionChartTitleCopy: {
    flex: 1,
    minWidth: 0,
  },

  completionChartTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },

  completionChartSubtitle: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },

  completionChartValueWrap: {
    maxWidth: 88,
    alignItems: "flex-end",
  },

  completionChartHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  completionChartValue: {
    width: "100%",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },

  completionChartValueLabel: {
    marginTop: 1,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
  },

  completionChart: {
    marginTop: 7,
  },

  completionChartAxis: {
    marginTop: -6,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  completionChartAxisLabel: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "800",
  },

  completedRouteCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },

  completedRouteMap: {
    width: "100%",
    height: 218,
  },

  completedRouteEmpty: {
    width: "100%",
    minHeight: 218,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  completedRouteEmptyIcon: {
    width: 52,
    height: 52,
    marginBottom: 10,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  completedRouteEmptyTitle: {
    marginBottom: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  completedRouteEmptyText: {
    maxWidth: 260,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  completedRouteFooter: {
    minHeight: 48,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  completedRouteFooterItem: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  completedRouteFooterValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  completedRouteFooterMeta: {
    flexShrink: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  completedPlanHeading: {
    marginTop: 7,
    marginBottom: -1,
    marginLeft: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  completedPlanTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },

  activeSummaryCard: {
    width: "100%",
    minHeight: 82,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  activeSummaryItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  activeSummaryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  activeSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },

  activeSummaryLabel: {
    marginBottom: 4,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  activeSummaryValue: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  activeSummaryDivider: {
    width: 1,
    height: 48,
    opacity: 0.7,
  },

  activeTitledCardShell: {
    width: "100%",
  },

  activeCardTitle: {
    marginLeft: 14,
    marginBottom: 5,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  activeCurrentSetCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
  },

  currentSetTimerRow: {
    width: "100%",
    minHeight: 98,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },

  currentSetActionWrap: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
  },

  currentSetActionLabel: {
    marginTop: 9,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
    textAlign: "center",
  },

  currentSetTimerSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },

  activeSetStatRow: {
    width: "100%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "stretch",
  },

  activeSetStatItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  activeSetStatHeader: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 4,
  },

  activeSetStatLabel: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },

  activeSetStatValue: {
    width: "100%",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  activeSetStatDivider: {
    position: "absolute",
    right: 0,
    top: 8,
    bottom: 8,
    width: 1,
    opacity: 0.55,
  },

  activeEffortCard: {
    width: "100%",
    minHeight: 86,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  activeEffortItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  activeEffortIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  activeEffortCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },

  activeEffortLabel: {
    width: "100%",
    marginBottom: 5,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  activeEffortDivider: {
    width: 1,
    height: 54,
    opacity: 0.7,
  },

  nextIntervalCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
  },

  nextIntervalTitleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  nextIntervalTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
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

  planStartActionShell: {
    width: "100%",
    marginBottom: 14,
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
