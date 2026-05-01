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
  calendarShortcut: {
    marginTop: 12,
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  calendarShortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarShortcutBody: {
    flex: 1,
  },
  calendarShortcutEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  calendarShortcutTitle: {
    lineHeight: 26,
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
