import { StyleSheet } from "react-native";

// Layout only, the measures of CustomExercisesPage's SortSheet so the app's
// choose-one sheets look alike.
export default StyleSheet.create({
  header: { paddingBottom: 14, gap: 2 },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 25 },
  hint: { marginTop: 4, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  rows: { gap: 8 },
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: "800", lineHeight: 19 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
