import { StyleSheet } from "react-native";

export default StyleSheet.create({
  listContainer: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 14,
  },

  listHeaderLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 4,
    textTransform: "uppercase",
  },

  listHeaderCount: {
    fontSize: 13,
    fontWeight: "700",
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
    marginBottom: 14,
    padding: 0,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },

  cardAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },

  touchable: {
    paddingLeft: 22,
    paddingRight: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 10,
  },

  statusLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  title: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 8,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  },

  metaText: {
    fontSize: 14,
    lineHeight: 20,
  },

  metaNumber: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  metaSeparator: {
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 8,
  },

  progressSection: {
    marginBottom: 16,
  },

  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  progressText: {
    fontSize: 13,
    lineHeight: 18,
  },

  progressNumber: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  progressPercent: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900",
  },

  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },

  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  dateRange: {
    fontSize: 13,
    lineHeight: 18,
  },

  emptyCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 26,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
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

  emptyButton: {
    marginTop: 2,
  },
});
