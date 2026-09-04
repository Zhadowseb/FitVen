import { StyleSheet } from "react-native";

export default StyleSheet.create({
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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

  filterChipTextSelected: {
    fontWeight: "800",
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  listHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },

  countBadge: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  // Placeholder shaped like a real card, so the page keeps its height and the
  // filter row above it does not jump while programs load.
  skeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },

  skeletonCover: {
    height: 140,
  },

  skeletonBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 10,
  },

  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },

  skeletonLineShort: {
    width: "42%",
  },

  skeletonLineTitle: {
    height: 18,
    width: "68%",
  },

  skeletonLineWide: {
    width: "88%",
  },

  skeletonBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },

  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    borderRadius: 18,
    overflow: "hidden",
  },

  statusRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },

  cover: {
    position: "relative",
    height: 140,
    overflow: "hidden",
  },

  coverImage: {
    width: "100%",
    height: "100%",
  },

  statusPill: {
    position: "absolute",
    top: 12,
    left: 12,
  },

  statusPillComplete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },

  statusPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  typePill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },

  typePillLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  body: {
    paddingTop: 2,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 12,
  },

  titleGroup: {
    gap: 2,
  },

  // Sits outside the card-wide touchable, so the button press cannot be
  // swallowed by the navigate-to-program press.
  cardFooter: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },

  cardAction: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  cardActionText: {
    fontSize: 15,
    fontWeight: "800",
  },

  dateRange: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    fontVariant: ["tabular-nums"],
  },

  title: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  metaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  metaNumber: {
    fontSize: 12,
    fontWeight: "800",
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },

  progressGroup: {
    gap: 6,
  },

  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  progressPercent: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  progressCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  emptyCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 26,
    borderRadius: 18,
    overflow: "hidden",
  },

  filteredEmpty: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
  },

  filteredEmptyText: {
    fontSize: 13,
    fontWeight: "600",
  },

  filteredEmptyAction: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  filteredEmptyActionText: {
    fontSize: 13,
    fontWeight: "800",
  },

  emptyContent: {
    gap: 14,
  },

  errorCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 22,
    borderRadius: 18,
    overflow: "hidden",
  },

  errorContent: {
    alignItems: "center",
    gap: 10,
  },

  errorTitle: {
    textAlign: "center",
  },

  errorText: {
    maxWidth: 310,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },

  errorAction: {
    minWidth: 140,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  errorActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  emptyText: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },

  emptySubtext: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
});
