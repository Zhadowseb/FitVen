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
    borderRadius: 14,
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
    alignItems: "center",
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

  // As wide as the actions on the right, so the title stays centred.
  headerMainExpanded: {
    paddingLeft: 88,
    paddingRight: 0,
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

  // Two 40 dp icons and their 4 dp gaps.
  actionsRowExpanded: {
    width: 88,
    minHeight: 32,
    justifyContent: "flex-end",
  },

  collapsedExpandButton: {
    width: 24,
    height: 32,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // 40 x 40 with a radius, so the open panel's icon can sit on a surface.
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },

  summaryCollapsedRow: {
    marginTop: 4,
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

  firstSetActionSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 26,
  },

  firstSetButton: {
    minHeight: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },

  firstSetButtonDisabled: {
    opacity: 0.6,
  },

  firstSetButtonText: {
    fontWeight: "800",
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

  // The clipping lives here so the animated height can trim the content
  // vertically. The negative horizontal margins sit on this layer too, so the
  // bleed past the card edge is outside the clip.
  expandedAnimator: {
    marginTop: 10,
    marginHorizontal: -12,
    marginBottom: -12,
    overflow: "hidden",
  },

  expandedSection: {
    overflow: "visible",
    position: "relative",
    zIndex: 1,
  },
});
