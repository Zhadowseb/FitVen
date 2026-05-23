import { StyleSheet } from "react-native";

export default StyleSheet.create({
  listContainer: {
    paddingHorizontal: 10,
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
    marginBottom: 12,
    padding: 0,
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },

  cardAccentRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
  },

  touchable: {
    minHeight: 218,
    paddingLeft: 22,
    paddingRight: 18,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: "space-between",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 30,
  },

  statusBadge: {
    minHeight: 28,
    maxWidth: 132,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    marginRight: 8,
  },

  statusLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  workoutTypeRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },

  workoutTypeBadge: {
    minHeight: 28,
    maxWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  workoutTypeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    marginLeft: 4,
  },

  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    height: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    gap: 5,
  },

  openBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  cardBodyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 18,
  },

  programInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
    justifyContent: "center",
  },

  title: {
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 8,
  },

  dateBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  dateRange: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  statusAction: {
    width: 94,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },

  completedCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  progressCaption: {
    marginTop: 6,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  progressDetail: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },

  metricGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },

  metricTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "center",
  },

  metricValue: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
  },

  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textTransform: "uppercase",
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
