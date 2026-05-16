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
    marginBottom: 10,
    padding: 0,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },

  touchable: {
    minHeight: 184,
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 18,
    paddingBottom: 16,
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
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginLeft: 10,
  },

  workoutTypeBadge: {
    minHeight: 28,
    maxWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    marginLeft: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  workoutTypeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    marginLeft: 4,
  },

  cardMenuIcon: {
    width: 20,
    height: 28,
    justifyContent: "center",
    alignItems: "flex-end",
    marginLeft: 6,
  },

  cardBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },

  programInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 16,
  },

  title: {
    fontSize: 20,
    lineHeight: 25,
    marginBottom: 4,
  },

  dateRange: {
    fontSize: 12,
    lineHeight: 17,
  },

  statusAction: {
    width: 72,
    height: 72,
    justifyContent: "center",
    alignItems: "center",
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

  metaPillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },

  metaPill: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    marginRight: 6,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },

  metaNumber: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
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
