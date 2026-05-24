import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 28,
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
  profileCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  accountCard: {
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  cardEyebrow: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  cardTitle: {
    marginBottom: 8,
  },
  accountValue: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardBody: {
    lineHeight: 20,
  },
  feedbackPortal: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
  },
  feedbackPortalGlowPrimary: {
    position: "absolute",
    width: 360,
    height: 310,
    top: -160,
    right: -138,
  },
  feedbackPortalGlowSecondary: {
    position: "absolute",
    width: 310,
    height: 270,
    bottom: -144,
    left: -118,
  },
  feedbackPortalHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  feedbackPortalStatusCluster: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackPortalStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
    opacity: 0.84,
  },
  feedbackPortalEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 3.2,
  },
  feedbackPortalActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackPortalTitle: {
    fontSize: 26,
    lineHeight: 31,
    marginBottom: 8,
  },
  feedbackPortalDescription: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 290,
  },
  feedbackPortalChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  feedbackPortalChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedbackPortalChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  avatarSection: {
    marginTop: 18,
    alignItems: "center",
  },
  avatarButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarButtonPressed: {
    opacity: 0.88,
  },
  avatarButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  avatarHelperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  identityList: {
    marginTop: 16,
    gap: 14,
  },
  identityGroup: {
    gap: 4,
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  identityValue: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  relationshipSummaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    marginBottom: 6,
  },
  relationshipSummaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  relationshipSummaryCardPressed: {
    opacity: 0.88,
  },
  relationshipSummaryValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  relationshipSummaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  relationshipSummaryHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  formSection: {
    marginTop: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrapper: {
    marginTop: 0,
  },
  bioInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackBanner: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    marginTop: 24,
  },
  primaryButton: {
    marginTop: 0,
    borderRadius: 18,
    height: 52,
  },
  logoutButton: {
    marginTop: 0,
  },
  relationshipModal: {
    maxHeight: 520,
  },
  relationshipModalContent: {
    minHeight: 0,
  },
  relationshipList: {
    maxHeight: 320,
  },
  relationshipListContent: {
    paddingBottom: 4,
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  relationshipCopy: {
    flex: 1,
    gap: 4,
  },
  relationshipDisplayName: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  relationshipUsername: {
    fontSize: 13,
    lineHeight: 18,
  },
  relationshipStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  relationshipCloseButton: {
    marginTop: 8,
  },
  errorText: {
    marginTop: 12,
    textAlign: "center",
  },
});
