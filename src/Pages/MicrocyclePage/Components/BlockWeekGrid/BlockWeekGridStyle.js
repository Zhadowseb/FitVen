import { StyleSheet } from "react-native";

export const CELL_HEIGHT = 42;

export default StyleSheet.create({
  weekdayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  weekdayCell: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
    alignItems: "center",
  },

  // The handoff asks for 9 px here. 11 is the floor the app now holds itself
  // to, and this screen was flagged for 8-9 px labels in the first place.
  weekdayInitial: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "center",
  },

  weekRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // A filled band, so one week is visibly one group and the eye can find where
  // the next one starts.
  weekBand: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  weekNumber: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    flexShrink: 0,
  },

  weekFocus: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  weekFocusSpacer: {
    flex: 1,
  },

  weekDates: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },


  // Dates sit on their own row above the cells: inside a 42 px cell they had to
  // compete with the icon or the count.
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },

  dateCell: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
    alignItems: "center",
  },

  dateText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },

  dateTextToday: {
    fontWeight: "900",
  },






  weekGrid: {
    flexDirection: "row",
    alignItems: "center",
  },

  cellSlot: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
  },

  cell: {
    height: CELL_HEIGHT,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  cellSelected: {
    borderWidth: 1.5,
  },

  cellRestDate: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  cellFallbackLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },

  cellCount: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  cellDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },

  cellDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },

  listContent: {
    paddingBottom: 24,
  },

  // ---- multi-workout dropdown ----

  dropdownOverlay: {
    flex: 1,
  },

  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  dropdown: {
    position: "absolute",
    width: 214,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.95,
    shadowRadius: 40,
    elevation: 14,
  },

  dropdownHeader: {
    paddingTop: 9,
    paddingHorizontal: 11,
    paddingBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  dropdownDate: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  dropdownCount: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  dropdownList: {
    maxHeight: 44 * 5,
  },

  dropdownRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderTopWidth: 1,
  },

  dropdownRowCopy: {
    flex: 1,
    minWidth: 0,
  },

  dropdownRowName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  dropdownRowMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
});
