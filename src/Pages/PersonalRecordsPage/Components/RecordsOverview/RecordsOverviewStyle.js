import { StyleSheet } from "react-native";

// Colours are read from `theme` in the component body, never here:
// applyAccentTheme() mutates Colors at runtime, so a colour captured in
// StyleSheet.create is the colour from whenever the module first loaded.
export default StyleSheet.create({
  screen: { gap: 22 },

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
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },

  // The period
  periodBlock: { gap: 8 },

  // The three numbers
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 11,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  kpiValueLine: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27,
    fontVariant: ["tabular-nums"],
  },
  kpiUnit: { fontSize: 12, fontWeight: "700", lineHeight: 20 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },

  // Strength
  strengthCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  strengthValue: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    fontVariant: ["tabular-nums"],
  },
  strengthCopy: { flex: 1, minWidth: 0, gap: 2 },
  strengthTitle: { fontSize: 14, fontWeight: "800", lineHeight: 19 },

  // Biggest gains
  gainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  gainName: { width: 108, gap: 1 },
  gainNameText: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  gainTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  gainFill: { height: 6, borderRadius: 3 },
  gainDelta: {
    width: 70,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  moreRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 2,
    alignItems: "center",
  },
  moreText: { fontSize: 13, fontWeight: "700" },

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

  // Every exercise
  listCard: { paddingVertical: 6 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  exerciseCopy: { flex: 1, minWidth: 0, gap: 2 },
  exerciseName: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  directionPill: {
    width: 26,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  directionText: { fontSize: 13, fontWeight: "900", lineHeight: 16 },

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
