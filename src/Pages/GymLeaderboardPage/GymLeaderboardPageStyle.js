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
  // The path sits close under Centre / Friends, as a caption to it.
  crumbs: {
    marginTop: -2,
    paddingHorizontal: 2,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionLabel: {
    flexShrink: 0,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionHint: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  cards: {
    gap: 12,
  },
  // The cards of the gender or scope before, while the new ones load.
  refreshing: {
    opacity: 0.55,
  },
  notice: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  noticeBody: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  noticeAction: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
    marginTop: 4,
  },
  noticeActionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  // "All exercises": one line to every exercise's own ranking.
  allRow: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  allCopy: {
    flex: 1,
    minWidth: 0,
  },
  allTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    lineHeight: 18,
  },
  allDetail: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
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
});
