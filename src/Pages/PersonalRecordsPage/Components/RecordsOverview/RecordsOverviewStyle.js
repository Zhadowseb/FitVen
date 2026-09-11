import { StyleSheet } from "react-native";

// Colours are read from `theme` in the component body, never here:
// applyAccentTheme() mutates Colors at runtime, so a colour captured in
// StyleSheet.create is the colour from whenever the module first loaded.
export default StyleSheet.create({
  screen: { gap: 22 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  overline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageTitle: { fontSize: 22, fontWeight: "800", lineHeight: 27 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  caption: { fontSize: 11, lineHeight: 15 },

  section: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },

  // Biggest movers
  gainRow: { paddingBottom: 11, gap: 6 },
  gainDivider: { height: StyleSheet.hairlineWidth, marginBottom: 11 },
  gainTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  gainName: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
  gainBest: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  gainPct: {
    width: 46,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  gainBottomLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  gainBefore: { width: 58, fontSize: 11, lineHeight: 15 },
  gainDelta: {
    width: 48,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  // The track carries a zero line so a decline has somewhere to go. Without it
  // a drop would either be invisible or be drawn as if it were progress.
  gainTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  gainZero: { position: "absolute", top: 0, bottom: 0, width: 1 },
  gainFill: { position: "absolute", top: 0, bottom: 0, borderRadius: 5 },

  legend: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  rowAction: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowActionText: { fontSize: 15, fontWeight: "600" },

  // Statistics
  rateCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8, overflow: "hidden" },
  rateValueLine: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  rateValue: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  rateUnit: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  compareLine: { flexDirection: "row", alignItems: "center", gap: 6 },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
    justifyContent: "center",
    gap: 4,
  },
  tileValueLine: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  tileValue: { fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileUnit: { fontSize: 12, fontWeight: "700", lineHeight: 17 },

  // Weekly volume
  volumeHead: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  volumeValue: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  volumeUnit: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: "800" },

  // Latest records
  recordStrip: { gap: 10, paddingRight: 4 },
  recordCard: {
    width: 118,
    borderWidth: 1,
    borderRadius: 15,
    padding: 11,
    gap: 5,
  },
  recordName: { fontSize: 12, fontWeight: "800", lineHeight: 16 },
  recordWeightLine: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  recordWeight: { fontSize: 17, fontWeight: "800", lineHeight: 21 },
  recordWeightMeta: { fontSize: 11, lineHeight: 15 },

  // Sets per muscle group
  muscleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { width: 66, fontSize: 12, lineHeight: 16 },
  muscleTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  muscleFill: { height: 8, borderRadius: 4 },
  muscleValue: {
    width: 34,
    textAlign: "right",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },

  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  emptyBody: { fontSize: 13, lineHeight: 18 },
});
