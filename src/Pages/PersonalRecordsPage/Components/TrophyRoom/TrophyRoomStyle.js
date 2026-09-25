import { StyleSheet } from "react-native";

// Colours are read from `theme` in the component body, never here:
// applyAccentTheme() mutates Colors at runtime, so a colour captured in
// StyleSheet.create is the colour from whenever the module first loaded.
export default StyleSheet.create({
  screen: { gap: 24 },

  overline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  caption: { fontSize: 11, lineHeight: 15 },
  section: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },

  // The trophy and the number
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  heroCount: { alignItems: "center", marginTop: 6, gap: 2 },
  heroNumber: { fontSize: 56, fontWeight: "900", lineHeight: 62, letterSpacing: -1 },
  heroLabel: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  heroLift: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 3,
  },
  heroLiftValue: { fontSize: 16, fontWeight: "800", lineHeight: 21 },
  emptyTitle: { fontSize: 18, fontWeight: "800", lineHeight: 23, textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 18, textAlign: "center", maxWidth: 280 },

  // The podium
  podiumRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  medal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  medalNumber: { fontSize: 14, fontWeight: "900", lineHeight: 18 },
  podiumCopy: { flex: 1, minWidth: 0, gap: 2 },
  podiumName: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  podiumWeight: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  podiumKg: { fontSize: 20, fontWeight: "900", lineHeight: 24 },
  podiumUnit: { fontSize: 11, fontWeight: "700", lineHeight: 18 },
  goal: { borderTopWidth: 1, paddingVertical: 13, gap: 8 },
  goalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalTitle: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },

  // The shelf of new records
  shelf: { gap: 10, paddingRight: 4 },
  recordCard: {
    width: 132,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 5,
  },
  recordStar: { position: "absolute", top: 9, right: 9 },
  // Clear of the star in the corner.
  recordName: { fontSize: 12, fontWeight: "800", lineHeight: 16, paddingRight: 22 },
  recordWeightLine: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  recordWeight: { fontSize: 19, fontWeight: "900", lineHeight: 23 },
  recordWeightMeta: { fontSize: 11, lineHeight: 16 },
  recordFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  newPill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  newPillText: { fontSize: 10, fontWeight: "900", lineHeight: 13, textTransform: "uppercase" },

  // Milestones
  milestoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  milestone: {
    flexBasis: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  milestoneHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  milestoneIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneTitle: { fontSize: 14, fontWeight: "800", lineHeight: 18 },

  // Through to the statistics
  statsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  statsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statsCopy: { flex: 1, minWidth: 0, gap: 2 },
  statsTitle: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
});
