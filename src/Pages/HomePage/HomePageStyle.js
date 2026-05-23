import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  contentContainer: {
    paddingBottom: 28,
  },
  socialSectionSpacer: {
    marginTop: 8,
  },
  homeShortcutRow: {
    marginHorizontal: 18,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  feedbackPortal: {
    marginTop: 12,
    marginHorizontal: 18,
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
});
