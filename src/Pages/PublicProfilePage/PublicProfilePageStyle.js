import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  pressed: { opacity: 0.7 },

  // Header: back, the preview's title, the menu.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonSpace: { width: 36, height: 36 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
    textAlign: "center",
  },
  headerSpacer: { flex: 1 },

  previewBanner: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  // Identity
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 27,
  },
  username: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  usernameCode: { fontSize: 11, fontWeight: "700" },
  centreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  centreText: { flexShrink: 1, fontSize: 11.5, fontWeight: "800", lineHeight: 15 },
  centreSuffix: { fontWeight: "700" },

  bio: {
    marginTop: 12,
    marginHorizontal: 20,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Follow and Share
  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    marginHorizontal: 20,
  },
  followButton: {
    flex: 1.5,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  followText: { fontSize: 14.5, fontWeight: "800" },
  shareButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  shareText: { fontSize: 14, fontWeight: "800" },
  // The preview shows the button someone else would press, and lets nobody press it.
  previewDisabled: { opacity: 0.45 },
  followError: {
    marginTop: 8,
    marginHorizontal: 20,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  // Followers, following, workouts
  stats: {
    flexDirection: "row",
    marginTop: 14,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  statDivided: { borderLeftWidth: 1 },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Sections: records, activity, posts
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 9,
  },
  eyebrow: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionAction: { fontSize: 11.5, fontWeight: "800" },
  recordList: { gap: 8 },
  activityAverage: { fontSize: 10.5, fontWeight: "700" },
  activityAverageValue: {
    fontSize: 11.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  footnote: {
    marginTop: 8,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  postsFailed: { fontSize: 12, fontWeight: "700", lineHeight: 16 },

  stateBlock: { minHeight: 320, justifyContent: "center" },

  // The menu sheet, the same measurements as the feed's post options.
  menuTitle: {
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  menuTitleText: { fontSize: 15, fontWeight: "700" },
  menuBody: { paddingVertical: 18 },
  menuOption: {
    minHeight: 44,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuOptionText: { flexShrink: 1, fontSize: 15, fontWeight: "700" },

  // The report dialog, as on Social and the feed.
  reportReasonList: { gap: 8, marginTop: 4 },
  reportReason: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  reportReasonText: { fontSize: 14, fontWeight: "600" },
  reportNote: { marginTop: 12, minHeight: 80 },
  reportError: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
});
