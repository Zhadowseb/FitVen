import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  monthMeta: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
  },
  monthControl: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextMonthIcon: {
    transform: [{ rotate: "180deg" }],
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 70,
  },
  errorTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  errorBody: {
    maxWidth: 310,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryButton: {
    minWidth: 120,
    minHeight: 44,
    borderRadius: 22,
    marginTop: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  monthPager: {
    flex: 1,
  },

  weekRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },

  daySlot: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
  },

  weekListHeader: {
    marginBottom: 4,
    paddingTop: 14,
    borderTopWidth: 1,
  },

  // Shared by both grid headings, so "Dates" and "Workouts" read as a pair.
  sectionEyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  monthSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 12,
  },

  viewPill: {
    minHeight: 30,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },

  viewPillText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },

  // Rotated a quarter turn: the pill opens a list below, it does not navigate.
  viewPillChevron: {
    transform: [{ rotate: "90deg" }],
  },

  viewMenuTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingBottom: 6,
  },

  viewMenuOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  viewMenuOptionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },

  weekListRow: {
    paddingTop: 5,
  },

  weekListSection: {
    paddingTop: 2,
  },
  // No flex: inside a vertically scrolling page the pager takes the height of
  // its tallest month instead of stretching and leaving a gap under the grid.
  // Each month is its own vertical scroll, so the grid and the week list under
  // it swipe as one page.
  monthPage: {
    // No padding here: each page is a ScrollView, and horizontal padding on a
    // ScrollView's style insets the frame rather than the content, which
    // pushed the last column off the screen.
  },

  monthPageContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  weekdayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  weekdayHeaderCell: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
    alignItems: "center",
  },
  weekdayHeaderText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  calendarGrid: {
    width: "100%",
  },
  daySlotOutsideMonth: {
    opacity: 0.32,
  },
  daySheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  daySheetHeaderText: {
    flex: 1,
  },
  daySheetEyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  daySheetTitle: {
    marginTop: 3,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  daySheetBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  daySheetBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  daySheetSectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  daySheetEmptyText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  daySheetList: {
    gap: 10,
  },
  daySheetAddButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  daySheetAddText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  dayWorkoutCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  dayWorkoutMain: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dayWorkoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayWorkoutIconLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
  dayWorkoutText: {
    flex: 1,
    minWidth: 0,
  },
  dayWorkoutName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  dayWorkoutStatus: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  dayWorkoutMeta: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  dayWorkoutActions: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  dayWorkoutAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  dayWorkoutActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  dayProgramRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  programTargetModal: {
    maxHeight: "70%",
  },
  programTargetModalBody: {
    gap: 10,
  },
  programTargetDate: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -4,
  },
  programTargetList: {
    flexShrink: 1,
  },
  programTargetListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  programTargetOption: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  programTargetName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  programTargetMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  programDayDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  programDayText: {
    flex: 1,
  },
  programDayName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  programDayMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
});
