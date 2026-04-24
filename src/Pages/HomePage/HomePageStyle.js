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
  quickAccessSection: {
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 0,
  },
  quickAccessGrid: {
    gap: 12,
  },
  quickAccessCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    overflow: "hidden",
  },
  quickAccessAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  quickAccessCardHeader: {
    marginBottom: 10,
  },
  quickAccessCardEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  quickAccessCardTitle: {
    lineHeight: 28,
  },
  quickAccessCardDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  quickAccessMetricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  quickAccessMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  quickAccessMetricValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  quickAccessMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 12,
    textTransform: "uppercase",
    marginTop: 4,
    textAlign: "center",
  },
  quickAccessFooter: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickAccessFooterText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  quickAccessFooterAccent: {
    width: 28,
    height: 8,
    borderRadius: 999,
  },
  feedbackPortal: {
    marginTop: 12,
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: "hidden",
  },
  feedbackPortalGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -84,
    right: -46,
    opacity: 0.18,
  },
  feedbackPortalGlowSecondary: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -40,
    left: -18,
    opacity: 0.12,
  },
  feedbackPortalTopRow: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  feedbackPortalSticker: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: -30,
    transform: [{ rotate: "8deg" }],
  },
  feedbackPortalStickerText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  feedbackPortalTitle: {
    lineHeight: 28,
    marginBottom: 8,
  },
  feedbackPortalDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
});
