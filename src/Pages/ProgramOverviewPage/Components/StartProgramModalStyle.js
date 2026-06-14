import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    width: "94%",
    maxHeight: 680,
    borderRadius: 28,
  },
  content: {
    gap: 14,
    minHeight: 0,
  },
  hero: {
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  weekPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  yearButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  yearButtonText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  yearTitle: {
    minWidth: 62,
    textAlign: "center",
  },
  weekOptionList: {
    maxHeight: 310,
  },
  weekOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  weekOptionTextContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  weekOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weekOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  currentWeekBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 8,
  },
  currentWeekBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  weekOptionRange: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginLeft: 12,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  selectionValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  startButton: {
    flex: 1,
    borderRadius: 18,
  },
});
