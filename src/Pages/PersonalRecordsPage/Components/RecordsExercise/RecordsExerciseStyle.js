import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: { gap: 20 },

  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  overline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageTitle: { fontSize: 22, fontWeight: "800", lineHeight: 27 },
  caption: { fontSize: 11, lineHeight: 15 },

  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  chartHead: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  chartValue: { fontSize: 31, fontWeight: "800", lineHeight: 35 },
  chartUnit: { fontSize: 14, fontWeight: "800", lineHeight: 22 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: "auto",
  },
  pillText: { fontSize: 11, fontWeight: "800" },

  nextStep: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  nextStepTitle: { fontSize: 13, fontWeight: "800", lineHeight: 18 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 2,
  },
  // 9 px is deliberate. At 11 the three columns wrap on a narrow phone and the
  // grid stops reading as a ladder.
  tileReps: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  tileValueLine: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  tileValue: { fontSize: 17, fontWeight: "800", lineHeight: 21 },
  tileUnit: { fontSize: 9.5, fontWeight: "700", lineHeight: 14 },

  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionDate: { width: 66, fontSize: 11, lineHeight: 15 },
  sessionSets: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17 },
});
