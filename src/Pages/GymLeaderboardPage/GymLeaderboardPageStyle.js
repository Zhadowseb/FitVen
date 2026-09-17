import { StyleSheet } from "react-native";

export const HERO_HEIGHT = 230;

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  hero: {
    height: HERO_HEIGHT,
    width: "100%",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFallbackText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
  },
  heroTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPill: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroCopy: {
    padding: 18,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  heroMeta: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
  },
  featuredCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredHeader: {
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  featuredHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  featuredExercise: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  featuredCount: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  topRow: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  topAvatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topName: {
    fontSize: 15,
    fontWeight: "800",
  },
  topMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topRank: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  topWeightGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  topWeight: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  topUnit: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyTop: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  emptyTopText: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginHorizontal: 16,
  },
  meRow: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  meLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meLabel: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  meRank: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  meSpacer: {
    flex: 1,
  },
  meWeight: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  meGap: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  meBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  meBarFill: {
    height: 4,
    borderRadius: 2,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  moreRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moreCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  moreExercise: {
    fontSize: 14,
    fontWeight: "800",
  },
  moreTop: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  moreRank: {
    fontSize: 13,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "right",
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
  reviewRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  reviewBody: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  stateBlock: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
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
  sheetSearch: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    paddingVertical: 0,
  },
  sheetSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sheetRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetRowTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  sheetRowMeta: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  sheetCheck: {
    width: 22,
    alignItems: "center",
  },
});
