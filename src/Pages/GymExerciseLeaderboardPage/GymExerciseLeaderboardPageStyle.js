import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeaderTitleEyebrow: {
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pageHeaderTitleMain: {
    textAlign: "center",
    lineHeight: 26,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
  podiumCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 22,
    paddingHorizontal: 12,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  podiumColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 5,
  },
  // The picture and the name, which open the lifter's profile. The column's
  // own spacing, so the podium looks the same with or without the link.
  podiumLifter: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 5,
  },
  podiumAvatarRing: {
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumName: {
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
  },
  podiumNameFirst: {
    fontSize: 13,
  },
  podiumWeightGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  podiumWeight: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  podiumWeightFirst: {
    fontSize: 24,
  },
  podiumUnit: {
    fontSize: 11,
    fontWeight: "700",
  },
  podiumNoVideo: {
    fontSize: 10,
    fontWeight: "800",
  },
  plinth: {
    width: "100%",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  plinthText: {
    fontSize: 13,
    fontWeight: "800",
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  // The list is the page's scroller now, so the card cannot be one View around
  // every row - that is the thing a recycling list exists to avoid. Each row
  // draws the sides, the first draws the top, and the last one on screen draws
  // the bottom. Same 20 px radius and 1 px border as listCard above.
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 100,
  },
  listHeader: {
    gap: 14,
  },
  listHeaderSpaced: {
    marginBottom: 14,
  },
  listFootnotes: {
    marginTop: 14,
    gap: 14,
  },
  listRowCard: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  listRowCardFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  listRowCardLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  footerRow: {
    paddingVertical: 13,
    alignItems: "center",
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "800",
  },
  footnote: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  pinnedMe: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  pinnedNote: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pinnedNoteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pinnedNoteTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  pinnedNoteBody: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sheetBody: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  sheetOption: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  sheetOptionBody: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 15,
  },
});
