import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 14,
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
  headerCount: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  searchField: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    paddingVertical: 0,
  },
  mapCard: {
    height: 300,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  mapCardExpanded: {
    height: 520,
  },
  map: {
    flex: 1,
  },
  mapPill: {
    position: "absolute",
    top: 12,
    left: 12,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  mapExpandButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Directly under the expand button, same size and treatment, so the two
  // read as one column of map controls.
  mapLocateButton: {
    position: "absolute",
    top: 52,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mapNotice: {
    paddingHorizontal: 4,
    marginTop: -4,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
  // The colour key under the map. Wraps rather than scrolls: five chains fit
  // on two lines at phone width, and a row you have to drag is a row nobody
  // reads.
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 4,
    marginTop: -4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  pin: {
    borderRadius: 999,
    borderWidth: 2,
  },
  pinHome: {
    width: 16,
    height: 16,
  },
  pinOther: {
    width: 14,
    height: 14,
  },
  pinMe: {
    width: 14,
    height: 14,
  },
  pinPulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  pinShell: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  cardEyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  strongestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  strongestExercise: {
    width: 64,
    fontSize: 12,
    fontWeight: "800",
  },
  strongestCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  strongestName: {
    fontSize: 14,
    fontWeight: "800",
  },
  strongestMeta: {
    fontSize: 11,
    fontWeight: "700",
  },
  strongestWeight: {
    width: 60,
    textAlign: "right",
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
  },
  cardFooterText: {
    fontSize: 13,
    fontWeight: "800",
  },
  gymRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  gymRowHome: {
    borderLeftWidth: 2,
  },
  chainTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chainTileText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gymCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  gymNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gymName: {
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  gymBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gymBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  gymMeta: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  gymCount: {
    fontSize: 13,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "right",
  },
  divider: {
    height: 1,
    marginLeft: 68,
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
});
