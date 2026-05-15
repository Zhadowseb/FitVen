import { StyleSheet } from "react-native";

export default StyleSheet.create({
  exerciseCard: {
    borderWidth: 1,
    borderRadius: 24,
    marginBottom: 8,
    marginHorizontal: 6,
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
    lineHeight: 16,
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: 2,
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

  dragHandle: {
    marginLeft: 6,
  },

  dragHandleActive: {
    opacity: 0.72,
  },

  summaryCollapsedRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "stretch",
  },

  summaryRow: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 999,
    marginRight: 10,
  },

  summaryTextBlock: {
    flex: 1,
    paddingRight: 10,
    justifyContent: "center",
  },

  summaryChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },

  summaryChipGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginRight: 6,
    marginBottom: 6,
  },

  summaryRepeatCount: {
    fontWeight: "700",
    marginLeft: 8,
    marginRight: 6,
    letterSpacing: 0.2,
  },

  summaryChip: {
    minHeight: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  summaryChipText: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  summaryExpandButton: {
    width: 30,
    marginLeft: 5,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  expandedSection: {
    marginTop: 10,
    marginHorizontal: -12,
    marginBottom: -12,
  },
});
