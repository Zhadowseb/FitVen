import { StyleSheet } from "react-native";

// Layout only: colours are applied inline from `theme` (src/Pages/AGENTS.md).
// Sizes follow the Statistics overview - its section heads, cards, number
// cards and bars - so a deep dive reads as the same page, one level down.
export default StyleSheet.create({
  screen: { gap: 22 },
  section: { gap: 12 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  overline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  caption: { fontSize: 11, lineHeight: 15 },

  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },

  // Numbers, two to a row whatever the width of the phone.
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: "40%",
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 4,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tileValueLine: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  tileValue: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27,
    fontVariant: ["tabular-nums"],
  },
  tileUnit: { fontSize: 12, fontWeight: "700", lineHeight: 20 },

  // One big number with what it means beside it.
  hero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroValue: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    fontVariant: ["tabular-nums"],
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 2 },
  heroTitle: { fontSize: 14, fontWeight: "800", lineHeight: 19 },

  // Horizontal bars, one per band.
  bars: { gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 88, fontSize: 12, lineHeight: 16 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barValue: {
    minWidth: 44,
    textAlign: "right",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },

  // The bar chart and the dates under its first and last bar.
  chartLabels: { flexDirection: "row", justifyContent: "space-between", gap: 8 },

  // Monday to Sunday.
  weekdayRow: { flexDirection: "row", gap: 6 },
  weekdayColumn: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  weekdayCount: { fontSize: 11, fontWeight: "700", lineHeight: 14, fontVariant: ["tabular-nums"] },
  weekdayTrack: {
    width: "100%",
    maxWidth: 28,
    height: 72,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  weekdayFill: { width: "100%", borderRadius: 6 },
  weekdayLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, lineHeight: 13 },

  // A figure with a label over it and a line under it, as a row in a card.
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  highlightCopy: { flex: 1, minWidth: 0, gap: 2 },
  highlightLabel: { fontSize: 12, lineHeight: 16 },
  highlightValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    fontVariant: ["tabular-nums"],
  },
  highlightRule: { height: StyleSheet.hairlineWidth },

  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  emptyBody: { fontSize: 13, lineHeight: 18 },
});
