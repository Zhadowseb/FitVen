import { StyleSheet } from "react-native";

// Layout only; the colours are set inline in RestoringSession.js, from the theme.
export const BAR_WIDTH = 210;

export default StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  stage: { width: 340, height: 190, marginTop: 26 },
  lift: { position: "absolute", left: 0, right: 0, top: 40, height: 100, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", left: 6, right: 6, height: 8, borderRadius: 4 },
  row: { flexDirection: "row", alignItems: "center" },
  collar: { width: 8, height: 22, borderRadius: 3, marginHorizontal: 1.5 },
  gap: { width: 100, height: 8 },
  // What a shadow is, so black in either scheme.
  shadow: { position: "absolute", left: 30, right: 30, bottom: 6, height: 12, borderRadius: 6, backgroundColor: "#000" },
  title: { marginTop: 14, fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.4 },
  message: { marginTop: 12, height: 22, fontSize: 15, fontWeight: "600" },
  track: { position: "absolute", bottom: 80, width: BAR_WIDTH, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { width: 0.36 * BAR_WIDTH, height: 4, borderRadius: 2 },
});
