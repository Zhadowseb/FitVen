import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },

  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },

  pageHeaderTitleEyebrow: {
    marginBottom: 2,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  pageHeaderTitleMain: {
    lineHeight: 26,
    textAlign: "center",
  },

  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionEyebrow: {
    marginBottom: 3,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },

  sectionCount: {
    paddingBottom: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
  },

  typeList: {
    gap: 10,
  },

  typeCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },

  typeHeader: {
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  typeIconFrame: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  typeCopy: {
    flex: 1,
    minWidth: 0,
  },

  typeCategory: {
    marginBottom: 2,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  typeTitle: {
    marginBottom: 5,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },

  typeMetrics: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
  },

  availableStatus: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 0,
  },

  availableStatusText: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "900",
    textAlign: "center",
  },

  typeSettingRow: {
    minHeight: 52,
    marginHorizontal: 14,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  typeSettingCopy: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  typeSettingTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  typeSettingMeta: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },

  maxHeartRateRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },

  maxHeartRateBadge: {
    minHeight: 22,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  maxHeartRateBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  maxHeartRateSourceList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  maxHeartRateSourceOption: {
    width: "48%",
    minHeight: 58,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  maxHeartRateSourceOptionCopy: {
    flex: 1,
    minWidth: 0,
  },

  maxHeartRateSourceOptionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  maxHeartRateSourceOptionDetail: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },

  clearManualButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  clearManualButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
  },

  modalAction: {
    flex: 1,
    borderRadius: 16,
  },

  feedbackText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
