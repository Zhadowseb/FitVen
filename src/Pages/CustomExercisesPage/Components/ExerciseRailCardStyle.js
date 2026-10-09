import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  card: { width: 196, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  touch: { flex: 1 },
  body: { flex: 1, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  tag: { alignSelf: "flex-start" },
  name: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  owner: { flexDirection: "row", alignItems: "center", gap: 6 },
  ownerName: { flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  // At the bottom of the card whatever the name's length, so the row of
  // cards ends in one line.
  footer: { marginTop: "auto", minHeight: 28, justifyContent: "center" },
  // Room for the pill, which sits over the footer's right end.
  footerWithPill: { paddingRight: 96 },
  users: { fontSize: 10.5, fontWeight: "800", lineHeight: 14, fontVariant: ["tabular-nums"] },

  // Its own touch target beside the card's, not inside it: nested in the
  // card's button a screen reader could not reach it.
  pill: {
    position: "absolute",
    right: 12,
    bottom: 12,
    height: 28,
    minWidth: 76,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pillText: { fontSize: 12, fontWeight: "800", lineHeight: 15 },
});
