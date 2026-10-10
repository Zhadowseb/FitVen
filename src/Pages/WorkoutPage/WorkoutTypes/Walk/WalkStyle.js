import { StyleSheet } from "react-native";

// Layout only. Colours never live in a Style.js: applyAccentTheme() changes
// them after this file has run, so the screen sets them inline (see
// src/Pages/AGENTS.md). Sizes follow WalkWorkout.dc.html.
export default StyleSheet.create({
  screen: {
    flex: 1,
  },

  glow: {
    position: "absolute",
    top: -110,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.12,
  },

  scrollContent: {
    paddingBottom: 24,
  },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  autoPause: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  autoPauseText: {
    fontSize: 13,
    fontWeight: "800",
  },
  switchTrack: {
    width: 30,
    height: 18,
    borderRadius: 9,
  },
  switchThumb: {
    position: "absolute",
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  /* map */
  mapCard: {
    marginHorizontal: 20,
    marginTop: 10,
    height: 236,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  mapEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  mapEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  mapEmptyButton: {
    minHeight: 44,
    alignSelf: "center",
  },
  hereAnchor: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 0,
    height: 0,
  },
  hereRing: {
    position: "absolute",
    left: -14,
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  hereDot: {
    position: "absolute",
    left: -8,
    top: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  mapLabel: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  mapLabelText: {
    fontSize: 11,
    fontWeight: "700",
  },

  /* time */
  timeBlock: {
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  timeValue: {
    marginTop: 2,
    fontWeight: "800",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },

  /* controls */
  controls: {
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sideButton: {
    width: 68,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  sideButtonText: {
    fontSize: 11,
    fontWeight: "800",
  },
  mainButton: {
    flex: 1,
    minWidth: 0,
    height: 64,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 6,
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: "800",
  },

  /* stats */
  statsCard: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    marginVertical: 14,
  },

  /* cadence */
  cadenceCard: {
    marginHorizontal: 20,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  figureBox: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cadenceCell: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cadenceValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  cadenceDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 6,
  },

  /* lock */
  lockRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  lockMessage: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  unlockButton: {
    marginTop: 28,
    minWidth: 220,
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  unlockFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  unlockText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
