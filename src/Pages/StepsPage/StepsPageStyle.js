import { StyleSheet } from "react-native";

// Layout only: the page's colours are set inline from the theme (a Style.js is
// read once, before the accent is applied - see src/Pages/AGENTS.md).
export default StyleSheet.create({
  content: {
    paddingBottom: 32,
  },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
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

  period: {
    marginHorizontal: 20,
    marginTop: 16,
  },

  /* access prompt */
  prompt: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "700",
  },
  promptButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  promptButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },

  /* hero */
  hero: {
    marginHorizontal: 20,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroCaption: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },
  heroNumber: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroSplit: {
    fontSize: 12,
    fontWeight: "700",
  },
  zonePill: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  zoneSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  zonePillText: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* cards */
  card: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  chartCard: {
    marginTop: 14,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderRadius: 20,
  },
  legend: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  noData: {
    paddingVertical: 32,
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* tiles */
  tiles: {
    marginHorizontal: 20,
    marginTop: 10,
    gap: 10,
  },
  tileRow: {
    flexDirection: "row",
    gap: 10,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tileValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  tileDetail: {
    fontSize: 11,
  },

  /* sources */
  sourcesCard: {
    padding: 16,
    paddingVertical: 14,
    gap: 10,
  },
  sourcesHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourcesTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  sourcesPeriod: {
    fontSize: 12,
    fontWeight: "700",
  },
  sourcesBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    flexDirection: "row",
  },
  sourcesLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
  },
  sourcesLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourcesLegendText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* training */
  trainingCard: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  trainingHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trainingIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  trainingTitles: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  trainingTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  trainingSubtitle: {
    fontSize: 12,
  },
  trainingList: {
    marginTop: 10,
  },
  trainingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    minHeight: 44,
  },
  trainingDay: {
    width: 34,
    fontSize: 12,
    fontWeight: "800",
  },
  trainingName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: "700",
  },
  trainingMeta: {
    fontWeight: "600",
  },
  trainingSteps: {
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  trainingScience: {
    paddingTop: 4,
    paddingBottom: 12,
    marginTop: 6,
    borderTopWidth: 1,
  },
  trainingEmpty: {
    paddingVertical: 10,
    fontSize: 12.5,
    fontWeight: "600",
  },

  /* target */
  targetRow: {
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  targetText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  targetValue: {
    fontWeight: "800",
  },
  targetButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  targetButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },

  /* target sheet */
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  option: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionTexts: {
    flex: 1,
    gap: 1,
  },
  optionName: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  optionRange: {
    fontSize: 12,
    fontWeight: "600",
  },
});
