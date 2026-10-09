import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  // The bottom navigation sits under the navigator, not over it (App.js), so
  // the page ends where the bar begins; this is the same breathing room as
  // PublicProfilePage and Home.
  scrollContent: { paddingBottom: 28 },

  // Behind the status bar once the hero has scrolled under it, so the clock
  // does not sit on top of the text going past.
  statusBarBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },

  ownerRow: { marginTop: 16, marginHorizontal: 20 },
  description: {
    marginTop: 12,
    marginHorizontal: 20,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  stats: { marginTop: 12, marginHorizontal: 20 },

  // How it's done, and what others lift
  section: { marginTop: 24, marginHorizontal: 20 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  steps: { gap: 9 },
  step: { flexDirection: "row", alignItems: "flex-start" },
  stepNumber: {
    width: 18,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Add (or edit your own) and Save
  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 24,
    marginHorizontal: 20,
  },
  primaryButton: {
    flex: 1.6,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  notice: {
    marginTop: 10,
    marginHorizontal: 20,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  footnote: {
    marginTop: 12,
    marginHorizontal: 20,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 15,
  },

  // Unavailable, error, offline
  stateScreen: { flex: 1 },
  stateTopBar: { marginHorizontal: 16 },
  stateBlock: { paddingBottom: 80 },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  // The menu sheet, measured like PublicProfilePage's.
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
});
