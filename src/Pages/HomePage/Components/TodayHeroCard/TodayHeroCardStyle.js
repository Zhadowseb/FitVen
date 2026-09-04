import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageZone: {
    position: "relative",
    height: 112,
    overflow: "hidden",
  },
  completedImageZone: {
    height: 150,
  },
  completedImageTint: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  chip: {
    position: "absolute",
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
  },
  chipLeft: {
    left: 14,
  },
  chipRight: {
    right: 14,
    borderWidth: 0,
  },
  completedChip: {
    gap: 7,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  typeChipLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  overlayText: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 7,
    gap: 2,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  completedMetaText: {
    fontWeight: "800",
  },
  buttonZone: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  completedCard: {
    borderWidth: 1.25,
  },
  completedBody: {
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  startButton: {
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowOffset: { width: 44, height: 44 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    marginHorizontal: 18,
  },
  upNextRow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upNextRowBare: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 0,
  },
  dateBadge: {
    width: 44,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    flexShrink: 0,
  },
  dateBadgeWeekday: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  dateBadgeNumber: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  upNextTextColumn: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  upNextEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  upNextTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    // Radius comes from styles.card, so both states read as the same card.
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  emptyCopy: {
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 23,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyStartButton: {
    alignSelf: "stretch",
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStartButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
