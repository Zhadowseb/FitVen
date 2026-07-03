import { StyleSheet } from "react-native";

export default StyleSheet.create({

  listHeader: {
    paddingTop: 0,
  },

  card: {
    flexDirection: "column",
    paddingTop: 14,
    paddingBottom: 12,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  cardHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  weekNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  weekNumberBadgeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },

  cardHeaderTitle: {
    flex: 1,
    marginBottom: 0,
  },

  cardHeaderSide: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },

  optionsButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  weekdaysShell: {
    paddingTop: 2,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },

  bottomsheet_title: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2eff",
    paddingBottom: 30,
  },
  bottomsheet_body: {
    justifyContent: "center",
    padding: 20,
    paddingLeft: 0,
  },

  option_text: {
    paddingLeft: 10,
    fontWeight: 600,
    fontSize: 16,
  },

  option: {
    flexDirection: "row",
    paddingTop: 20,
  },

  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 2,
    paddingBottom: 2,
  },

  weekdayTouchable: {
    flex: 1,
    alignItems: "center",
  },

  focus: {
    flex: 8,
    justifyContent: "center",
    alignItems: "center",
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

  sickContinuationModal: {
    borderWidth: 1,
    borderRadius: 18,
  },

  sickContinuationContent: {
    gap: 18,
  },

  sickContinuationText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  sickContinuationButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  sickContinuationButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  sickContinuationPrimaryButton: {
    borderWidth: 1,
  },

  sickContinuationButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  sicknessDetailsModal: {
    width: "92%",
    maxHeight: "86%",
    borderWidth: 1,
    borderRadius: 18,
  },

  sicknessDetailsContent: {
    gap: 14,
  },

  sicknessDetailsScroll: {
    gap: 14,
    paddingBottom: 2,
  },

  sicknessDetailsDate: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },

  sicknessTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  sicknessTypeOption: {
    flexBasis: "48%",
    minHeight: 132,
    alignItems: "center",
    gap: 8,
  },

  sicknessTypeImageCard: {
    width: "100%",
    aspectRatio: 1.22,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },

  sicknessTypeImage: {
    width: "100%",
    height: "100%",
  },

  sicknessTypeLabel: {
    minHeight: 32,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  sicknessNoteLabel: {
    marginBottom: 7,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  sicknessNoteInput: {
    minHeight: 92,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 12,
  },

  sicknessDetailsButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
});
