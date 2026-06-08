import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    lineHeight: 34,
  },
  summaryPill: {
    minWidth: 86,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  monthHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 12,
  },
  monthHeaderText: {
    flex: 1,
  },
  monthTitle: {
    lineHeight: 28,
  },
  monthMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  monthActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 10,
  },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  monthControl: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextMonthIcon: {
    transform: [{ rotate: "180deg" }],
  },
  stateCard: {
    marginHorizontal: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  monthPager: {
    flex: 1,
  },
  monthPage: {
    flex: 1,
    paddingHorizontal: 8,
  },
  weekdayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 2,
  },
  weekdayHeaderCell: {
    width: "14.2857%",
    alignItems: "center",
  },
  weekdayHeaderText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  calendarGrid: {
    width: "100%",
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  daySlot: {
    width: "14.2857%",
    alignItems: "center",
  },
  daySlotOutsideMonth: {
    opacity: 0.32,
  },
  emptyMonth: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
  },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayContextOverlay: {
    flex: 1,
  },
  dayContextBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  dayContextMenu: {
    position: "absolute",
    width: 266,
    borderRadius: 10,
    borderWidth: 1,
    paddingTop: 16,
    paddingBottom: 10,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  dayContextHeader: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  dayContextMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  dayContextTitle: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  dayContextBody: {
    paddingTop: 8,
  },
  dayContextAction: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 14,
  },
  dayContextActionIcon: {
    width: 26,
    alignItems: "center",
  },
  dayContextActionText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
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
    lineHeight: 20,
    fontWeight: "800",
  },
  programTargetMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  programDayModal: {
    maxHeight: "78%",
  },
  programDayModalBody: {
    gap: 0,
  },
  programDayDate: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 12,
  },
  programDayList: {
    flexShrink: 1,
  },
  programDayListContent: {
    gap: 10,
    paddingBottom: 4,
  },
  programDayCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  programDayHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  programDayDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
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
  programDayAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  programDayActionText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
});
