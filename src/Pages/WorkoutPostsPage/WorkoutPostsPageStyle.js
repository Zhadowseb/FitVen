import { StyleSheet } from "react-native";

export default StyleSheet.create({
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },

  pageHeaderTitleEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  pageHeaderTitleMain: {
    textAlign: "center",
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },

  filterChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
  },

  listContent: {
    paddingBottom: 28,
  },

  sheetTitle: {
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
  },

  sheetTitleText: {
    fontSize: 15,
    fontWeight: "800",
  },

  sheetSubtitleText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  sheetBody: {
    paddingTop: 6,
  },

  sheetOption: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },

  sheetOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },

  stateBlock: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },

  stateTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  stateText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
});
