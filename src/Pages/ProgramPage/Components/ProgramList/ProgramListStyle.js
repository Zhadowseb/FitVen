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

  cardDropShadow: {
    marginBottom: 22,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.48,
    shadowRadius: 20,
    elevation: 14,
  },

  cardGlow: {
    borderRadius: 20,
    padding: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 14,
    elevation: 6,
  },

  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },

  touchable: {
    minHeight: 236,
    position: "relative",
  },

  coverImage: {
    minHeight: 236,
    overflow: "hidden",
  },

  coverImageLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },

  coverImageSegment: {
    flex: 1,
    height: "100%",
  },

  coverImageSegmentDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255, 255, 255, 0.16)",
  },

  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 6, 9, 0.46)",
  },

  coverTone: {
    ...StyleSheet.absoluteFillObject,
  },

  coverContent: {
    minHeight: 236,
    paddingLeft: 19,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
    justifyContent: "space-between",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 30,
  },

  workoutTypeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 10,
  },

  workoutTypeBadge: {
    minHeight: 28,
    maxWidth: 118,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  workoutTypeText: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },

  cardMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(5, 7, 10, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },

  statusStamp: {
    position: "absolute",
    top: 64,
    right: 18,
    borderWidth: 2,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: "7deg" }],
    shadowOpacity: 0.46,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  statusStampText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  coverDetails: {
    minWidth: 0,
  },

  title: {
    color: "#ffffff",
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 10,
  },

  dateRange: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },

  coverFooter: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },

  statusAction: {
    width: 54,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  completedCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  metaPillRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  metaPill: {
    minHeight: 24,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    marginRight: 5,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  metaText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },

  metaNumber: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
  },

  coverSpine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
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
