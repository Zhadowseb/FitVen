import { StyleSheet } from "react-native";

// Layout only. Every colour is applied inline from the theme, so light, dark
// and the accent themes all reach it.
export default StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top bar
  topBar: {
    height: 44,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  topBarSide: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  // Identity
  identityRow: {
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  displayName: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  usernameLine: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "700",
  },
  usernameCode: {
    fontSize: 11,
    fontWeight: "700",
  },
  gymLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gymName: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  skeletonName: {
    width: "72%",
    height: 22,
    borderRadius: 7,
  },
  skeletonUsername: {
    width: "46%",
    height: 12,
    borderRadius: 5,
    marginTop: 5,
  },
  identityError: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  retryText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
  },
  bio: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  banner: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  // Edit profile / View as others
  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 9,
  },
  actionButton: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  editButton: {
    flex: 1.4,
  },
  viewAsOthersButton: {
    flex: 1,
    borderWidth: 1,
  },
  actionText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  // Followers / Following
  statsCard: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: "row",
  },
  statColumn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
  },

  // Sections under the identity: an eyebrow, 9 over what it names
  section: {
    marginTop: 24,
    gap: 9,
  },

  // Settings tiles
  tileGrid: {
    gap: 8,
  },
  tileRow: {
    flexDirection: "row",
    gap: 8,
  },

  // Appearance
  appearanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  appearanceGroup: {
    gap: 8,
  },
  appearanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  appearanceLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Feedback
  feedbackRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  feedbackTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  feedbackSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
  },

  // Account
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  accountRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  accountEmail: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  logoutPill: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  accountError: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 17,
  },
  accountLinkRow: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountLinkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  footer: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  // Delete account
  errorText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },
  deleteModalBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  deleteModalPrompt: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  deleteModalConfirm: {
    marginTop: 16,
  },
  deleteModalCancel: {
    marginTop: 8,
  },
});
