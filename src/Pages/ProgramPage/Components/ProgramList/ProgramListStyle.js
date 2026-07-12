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
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },

  filterChipText: {
    fontSize: 12.5,
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
    fontSize: 10,
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
    fontSize: 10.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },

  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    borderRadius: 20,
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
    fontSize: 10,
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
    fontSize: 10,
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

  dateRange: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    fontVariant: ["tabular-nums"],
  },

  title: {
    fontSize: 20,
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
    fontSize: 10,
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
    borderRadius: 20,
    overflow: "hidden",
  },

  filteredEmpty: {
    paddingVertical: 24,
    alignItems: "center",
  },

  filteredEmptyText: {
    fontSize: 13.5,
    fontWeight: "600",
  },

  emptyContent: {
    gap: 14,
  },

  emptyText: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },

  emptySubtext: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
